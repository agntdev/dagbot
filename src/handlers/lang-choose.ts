import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, mainMenuKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { UNSUPPORTED_REPLY, activeProfile, isSupported, languageIn, languageName, recordNotification, saveProfile, welcomeFor } from "../conversation.js";
import { LANGUAGE_PROMPT, languageKeyboard } from "./start.js";

registerMainMenuItem({ label: "🌐 Сменить язык", data: "lang:choose", order: 30 });

const composer = new Composer<Ctx>();

async function setLanguage(ctx: Ctx, tag: string): Promise<void> {
  const hadProfile = Boolean(activeProfile(ctx));
  const profile = saveProfile(ctx, tag);
  if (!profile) {
    await ctx.reply("Открой диалог со мной в личных сообщениях — тогда я смогу сохранить язык.");
    return;
  }
  ctx.session.step = undefined;
  if (!isSupported(tag)) {
    await ctx.reply(UNSUPPORTED_REPLY, { reply_markup: mainMenuKeyboard() });
    await recordNotification(ctx, "fallback", `Выбран другой язык: ${tag}. Пользователь: ${profile.telegramId}.`);
    return;
  }
  if (!hadProfile) {
    await ctx.reply(welcomeFor(tag), { reply_markup: mainMenuKeyboard() });
    await recordNotification(ctx, "signup", `Новая регистрация: пользователь ${profile.telegramId}, язык ${languageName(tag)}.`);
    return;
  }
  await ctx.reply(`Готово, теперь отвечаю ${languageIn(tag)}. История чата сохранена.`, {
    reply_markup: mainMenuKeyboard(),
  });
}

composer.callbackQuery("lang:choose", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.step = undefined;
  await ctx.reply(LANGUAGE_PROMPT, { reply_markup: languageKeyboard() });
});

composer.callbackQuery(/^lang:set:(ru|dag|az)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  await setLanguage(ctx, ctx.match[1]);
});

composer.callbackQuery("lang:other", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.step = "awaiting_language";
  await ctx.reply("Напиши, на каком языке тебе удобнее общаться.", {
    reply_markup: { force_reply: true, input_field_placeholder: "Например: чеченский" },
  });
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "awaiting_language") return next();
  const tag = ctx.message.text.trim().toLowerCase().slice(0, 40);
  if (!tag) {
    await ctx.reply("Напиши название языка словами — я сохраню твой выбор.");
    return;
  }
  await setLanguage(ctx, tag);
});

export default composer;
