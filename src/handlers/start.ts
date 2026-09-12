import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, mainMenuKeyboard } from "../toolkit/index.js";
import { activeProfile } from "../conversation.js";

// The /start handler renders the bot's MAIN MENU — the primary way users operate
// a button-first bot. A feature adds its own button by calling
// `registerMainMenuItem(...)` in its own `src/handlers/<slug>.ts`; this handler
// renders whatever is registered (plus a Help button), so you do NOT edit this
// file to add a feature. Send ONE message — no placeholder line above the menu.
const composer = new Composer<Ctx>();

export const LANGUAGE_PROMPT = "Кто ты по национальности?";
export const MENU_WELCOME = "Выбирай, с чего начнём.";

export function languageKeyboard() {
  return inlineKeyboard([
    [inlineButton("🇷🇺 Русский", "lang:set:ru"), inlineButton("🏔️ Дагестанец", "lang:set:dag")],
    [inlineButton("🇦🇿 Азербайджанец", "lang:set:az"), inlineButton("🇨🇭 Другое", "lang:other")],
  ]);
}

composer.command("start", async (ctx) => {
  if (!activeProfile(ctx)) {
    await ctx.reply(LANGUAGE_PROMPT, { reply_markup: languageKeyboard() });
    return;
  }
  await ctx.reply(MENU_WELCOME, { reply_markup: mainMenuKeyboard() });
});

// "Back to menu" — re-render the main menu in place from any sub-view.
composer.callbackQuery("menu:main", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(MENU_WELCOME, { reply_markup: mainMenuKeyboard() });
});

export default composer;
