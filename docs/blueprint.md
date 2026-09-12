# Местный собеседник — Bot specification

**Archetype:** community

**Voice:** warm and encouraging — write every user-facing message, button label, error, and empty state in this voice.

A Telegram conversational assistant that greets users, asks their nationality, then conducts a natural-style dialogue in the language associated with that nationality (Russian, Dagestani variant, Azerbaijani, or a fallback). It provides a persistent menu, supports switching language mid-conversation, stores a short recent-message context per user, and notifies the owner/admin on new sign-ups and critical errors.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- Russian-speaking Telegram users from the Caucasus and nearby regions
- Dagestani speakers seeking conversational help in their local language
- Azerbaijani speakers who prefer native-language replies
- Users who want an easy menu-driven chat assistant with language switching

## Success criteria

- New users receive a nationality/language prompt on first run and their choice is persisted
- Users can start a new chat, ask free-text questions, and receive replies in the chosen language
- Language switch mid-session immediately changes the language of subsequent replies
- Last N messages (default 20) are stored per user and used to provide context for replies
- Owner/admin receives a new-signup notification and critical error alerts to ADMIN_CHAT_ID

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Open the main menu and run first-run nationality flow when needed
  - outputs: main_menu, language_prompt_if_first_run
- **/help** (command, actor: user, command: /help) — Show brief help and list menu actions (fallback surface)
  - outputs: help_text
- **💬 Новый чат** (button, actor: user, callback: chat:new) — Clear recent conversation context and start fresh
  - outputs: session_cleared, prompt_for_question
- **🧠 Задать вопрос** (button, actor: user, callback: chat:ask) — Prompt user for a free-text question (ForceReply or open text entry)
  - inputs: user_text
  - outputs: bot_reply, session_appended
- **🌐 Сменить язык** (button, actor: user, callback: lang:choose) — Re-open nationality/language selection buttons
  - outputs: language_selection_keyboard, language_updated
- **⚙️ Настройки** (button, actor: user, callback: settings:open) — Open simple preferences (e.g., session length toggle, privacy/data deletion request)
  - inputs: toggle_values
  - outputs: settings_saved
- **ℹ️ О боте** (button, actor: user, callback: about:show) — Show short about text and supported languages
  - outputs: about_text

## Flows

### First-run nationality selection
_Trigger:_ /start when user record missing

1. Bot sends: 'Кто ты по национальности?' with inline buttons: 🇷🇺 Русский, 🏔️ Дагестанец, 🇦🇿 Азербайджанец, 🇨🇭 Другое
2. User taps one option
3. If 'Другое' -> prompt user to type preferred language (ForceReply)
4. Persist user_profile.language_tag and create conversation_session with empty history
5. Send welcome message in chosen language and show main menu keyboard
6. Notify ADMIN_CHAT_ID of new sign-up (user id, chosen language)

_Data touched:_ user_profile, conversation_session, admin_notifications

### Main menu navigation
_Trigger:_ user presses persistent keyboard button

1. Bot displays persistent custom keyboard with actions (Новый чат, Задать вопрос, Сменить язык, Настройки, О боте)
2. User chooses an action and bot executes corresponding callback flow

_Data touched:_ user_profile, conversation_session

### Ask question (free-text)
_Trigger:_ button 'Задать вопрос' or ForceReply

1. Bot prompts user to send their question (ForceReply or open text field)
2. User sends free-text message
3. System appends message to conversation_session (truncate to last N messages)
4. Bot generates reply in conversation_session.language_tag (see missing_fields for AI provider details)
5. Bot sends reply and appends to session history

_Data touched:_ conversation_session, user_profile

### Change language mid-conversation
_Trigger:_ button 'Сменить язык'

1. Bot re-displays nationality/language buttons
2. User selects new language (or types if 'Другое')
3. Update user_profile.language_tag and mark subsequent replies to use new tag
4. Notify user that language has switched and continue conversation; do not delete session history unless user chooses 'Новый чат'

_Data touched:_ user_profile, conversation_session

### Language fallback
_Trigger:_ reply generation requested for unsupported language

1. Detect language support gap
2. Respond in Russian with a polite message offering supported alternatives
3. Log fallback event and notify admin if repeated or critical
4. If user selects alternative, update user_profile.language_tag

_Data touched:_ conversation_session, admin_notifications

### Settings: session length & data deletion
_Trigger:_ button 'Настройки'

1. Show simple toggles: session length (default 20), opt-in/out of session persistence, request data deletion
2. Persist owner-saved preferences per user_profile
3. On data deletion request, delete conversation_session history and confirm to user; log action

_Data touched:_ user_profile, conversation_session

### Admin notification on errors
_Trigger:_ critical error or repeated fallback

1. Generate structured notification with error type, user id (if applicable), timestamp, and recent logs
2. Send to ADMIN_CHAT_ID
3. If admin not set, escalate to internal logs and mark for owner setup

_Data touched:_ admin_notifications, system_logs

## Owner-supplied settings

The OWNER provides these; they are collected in chat and injected into the environment at deploy. Read each one from the environment where it is used (`ctx.env.<KEY>` / `env.<KEY>` on Cloudflare Workers; `process.env.<KEY>` only as a Node/harness fallback — never the sole read). Do NOT invent your own way of learning the value, do NOT ask for it in a bot message, and do NOT hardcode a default.

- **ADMIN_CHAT_ID** — Telegram chat id where new sign-ups and critical error notifications are sent
  - this is the OWNER's own chat id; the platform already knows it. Read `ADMIN_CHAT_ID` via `ctx.env` (prefer toolkit `adminChatId` / `requireOwner`) — never ask a user, never treat whoever writes first as the admin, never invent claim-admin or open manage for everyone.
  - may be UNSET at runtime: the bot must still start, and the feature needing ADMIN_CHAT_ID must say so plainly instead of failing.

Your behavioral specs run WITHOUT these values, so no spec may depend on one.

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

An entity that merely NAMES an owner-supplied setting above (an admin chat, an API account) is not something to store or discover — read it from the environment.

- **user_profile** _(retention: persistent)_ — Persistent profile per Telegram user
  - fields: telegram_id (integer), language_tag (enum: ru, dag, az, other or user-provided string), settings (object: session_length, persist_sessions_flag), created_at (timestamp), last_active_at (timestamp)
- **conversation_session** _(retention: persistent)_ — Short-term message history used for contextual replies
  - fields: telegram_id (integer), messages (array of {role: user|bot, text, timestamp}), language_tag (copied from user_profile at time of message), last_updated (timestamp)
- **admin_notifications** _(retention: persistent)_ — Records of sign-ups and critical errors delivered to admin
  - fields: type (signup|error|fallback), telegram_id (optional), payload (string/object), sent_at (timestamp)

## Integrations

- **Telegram** (required) — Bot API messaging, inline callbacks and ForceReply
- **External AI / text-generation (optional)** (optional) — Optional provider for free-form conversational reply generation when owner supplies credentials
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- Set ADMIN_CHAT_ID to receive new-signup and critical error notifications
- Adjust supported language list and provide localized strings for ‘Dagestani’ variant
- Configure default session length (default 20) and whether to persist session history
- Enable or provide credentials for an external AI/text-generation provider (optional)
- Request user data deletion or export for GDPR/PRIVACY compliance

## Notifications

- New user sign-up (user id, chosen language) -> ADMIN_CHAT_ID
- Critical runtime errors and delivery failures -> ADMIN_CHAT_ID
- Repeated language fallback events (configurable threshold) -> ADMIN_CHAT_ID
- User-requested data deletion confirmation -> user and admin (log)

## Permissions & privacy

- Store Telegram id and short recent conversation history (default last 20 messages) to provide context-aware replies
- Store chosen language/nationality selection persistently to honor user preference
- Admin notifications include user id and chosen language; do not include full session content unless a critical error requires it
- Provide user-accessible control to delete stored conversation history and their profile
- No third-party sharing of personal data unless owner enables an external AI provider (in which case data sent to that provider must be disclosed and accepted by owner)

## Edge cases

- User selects 'Другое' and types an unsupported language -> bot stores the free-text tag and offers alternatives; warn owner in admin notification
- Owner has not provided ADMIN_CHAT_ID -> sign-up/error notifications are suppressed and logged internally; bot should prompt owner to configure admin notifications
- No external AI provider configured but user expects ChatGPT-like replies -> bot must use a safe fallback (templated/echo or limited rule-based responses) and inform user of limitations
- User sends extremely long messages -> truncate to configured per-message size and notify user
- User switches language repeatedly mid-session -> language_tag updates but history remains; offer 'Новый чат' to reset context
- Bot blocked or unable to message user -> log delivery failure and notify admin if repeated

## Required tests

- Dialog-level acceptance test: first-run nationality flow results in persisted language and welcome message in that language
- Dialog-level acceptance test: 'Задать вопрос' accepts free-text and bot replies, messages appended and truncated to N=20
- Language switch test: mid-session language change alters subsequent bot replies without losing history
- Fallback test: unsupported language triggers Russian fallback message and admin notification as configured
- Persistence test: session retention honors settings (default 20), New Chat clears session
- Admin notification test: new-signup and simulated critical error delivered to ADMIN_CHAT_ID
- Settings test: toggling session persistence and requesting data deletion removes session history and confirms to user

## Assumptions

- ‘Dagestani’ will be treated as a single localized variant chosen by the owner (not multiple dialect options)
- Owner will supply ADMIN_CHAT_ID before expecting operational admin notifications
- If owner does not provide an external AI provider, the bot will operate with limited templated/rule-based replies or simple echo behavior
- Default session length is 20 messages unless owner configures otherwise in settings
