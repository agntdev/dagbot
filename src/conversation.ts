import type { Ctx, ConversationMessage, ConversationSession, UserProfile } from "./bot.js";
import { adminChatId } from "./toolkit/index.js";

const MESSAGE_LIMIT = 1500;
const FALLBACK_THRESHOLD = 3;

let clock: () => Date = () => new Date();

/** Single injectable clock seam for all stored timestamps. */
export function now(): Date {
  return clock();
}

/** Test hook for time-sensitive callers; production code uses the real clock. */
export function setClockForTests(value?: () => Date): void {
  clock = value ?? (() => new Date());
}

export function userId(ctx: Ctx): number | undefined {
  return ctx.from?.id;
}

export function languageName(tag: string): string {
  if (tag === "ru") return "русский";
  if (tag === "dag") return "дагестанский";
  if (tag === "az") return "азербайджанский";
  return tag;
}

export function languageIn(tag: string): string {
  if (tag === "ru") return "по-русски";
  if (tag === "dag") return "на дагестанском варианте";
  if (tag === "az") return "по-азербайджански";
  return `на языке «${tag}»`;
}

export function isSupported(tag: string): boolean {
  return tag === "ru" || tag === "dag" || tag === "az";
}

export function ensureConversation(ctx: Ctx, profile: UserProfile): ConversationSession {
  if (!ctx.session.conversation || ctx.session.conversation.telegramId !== profile.telegramId) {
    ctx.session.conversation = {
      telegramId: profile.telegramId,
      messages: [],
      lastUpdated: now().toISOString(),
    };
  }
  return ctx.session.conversation;
}

export function saveProfile(ctx: Ctx, languageTag: string): UserProfile | undefined {
  const id = userId(ctx);
  if (id === undefined) return undefined;
  const stamp = now().toISOString();
  const current = ctx.session.profile;
  const profile: UserProfile = current && current.telegramId === id
    ? { ...current, languageTag, lastActiveAt: stamp }
    : {
        telegramId: id,
        languageTag,
        settings: { sessionLength: 20, persistSessions: true },
        createdAt: stamp,
        lastActiveAt: stamp,
      };
  ctx.session.profile = profile;
  ensureConversation(ctx, profile);
  return profile;
}

export function activeProfile(ctx: Ctx): UserProfile | undefined {
  const id = userId(ctx);
  const profile = ctx.session.profile;
  if (!profile || profile.telegramId !== id) return undefined;
  profile.lastActiveAt = now().toISOString();
  return profile;
}

export function appendMessage(ctx: Ctx, profile: UserProfile, role: ConversationMessage["role"], text: string): void {
  if (!profile.settings.persistSessions) return;
  const conversation = ensureConversation(ctx, profile);
  conversation.messages.push({ role, text, timestamp: now().toISOString(), languageTag: profile.languageTag });
  conversation.messages = conversation.messages.slice(-profile.settings.sessionLength);
  conversation.lastUpdated = now().toISOString();
}

export function clearConversation(ctx: Ctx, profile: UserProfile): void {
  ctx.session.conversation = {
    telegramId: profile.telegramId,
    messages: [],
    lastUpdated: now().toISOString(),
  };
}

export function clampQuestion(text: string): { text: string; shortened: boolean } {
  const normalized = text.trim();
  return normalized.length > MESSAGE_LIMIT
    ? { text: normalized.slice(0, MESSAGE_LIMIT), shortened: true }
    : { text: normalized, shortened: false };
}

export function welcomeFor(tag: string): string {
  if (tag === "dag") return "Рад знакомству. Пиши — я отвечу на дагестанском варианте.";
  if (tag === "az") return "Tanış olduğumuza şadam. Yazın, sizə azərbaycanca cavab verəcəyəm.";
  return "Рад знакомству. Пиши — я рядом и отвечу по-русски.";
}

export function limitedReply(tag: string, question: string): string {
  if (tag === "dag") return `Сизни гъалатI угъай. Азыр мен къыска суал-жувап режиминде ишлеймен: «${question}».`;
  if (tag === "az") return `Sizi başa düşdüm. Hazırda qısa söhbət rejimindəyəm: “${question}”.`;
  return `Я тебя понял. Пока я отвечаю в коротком режиме без внешнего ИИ: «${question}».`;
}

export const UNSUPPORTED_REPLY =
  "Пока я уверенно говорю по-русски, на дагестанском варианте и по-азербайджански. Выбери подходящий язык в меню — я сразу переключусь.";

export async function recordNotification(
  ctx: Ctx,
  type: "signup" | "error" | "fallback" | "deletion",
  payload: string,
): Promise<void> {
  const id = userId(ctx);
  const note = { type, telegramId: id, payload, sentAt: now().toISOString(), delivered: false } as const;
  const list = ctx.session.notifications ?? [];
  ctx.session.notifications = [...list, note].slice(-50);
  const admin = adminChatId(ctx as Ctx & { env?: Record<string, unknown> });
  if (!admin) return;
  try {
    await ctx.api.sendMessage(admin, `Местный собеседник\n${payload}`);
    const saved = ctx.session.notifications;
    if (saved) saved[saved.length - 1] = { ...saved[saved.length - 1], delivered: true };
  } catch {
    // Telegram delivery failures are retained in the durable notification log.
  }
}

export async function recordFallback(ctx: Ctx, tag: string): Promise<void> {
  const profile = activeProfile(ctx);
  const prior = (ctx.session.notifications ?? []).filter((n) => n.type === "fallback").length;
  if (prior + 1 >= FALLBACK_THRESHOLD || !isSupported(tag)) {
    await recordNotification(ctx, "fallback", `Неподдерживаемый язык: ${tag}. Пользователь: ${profile?.telegramId ?? "неизвестен"}.`);
  }
}
