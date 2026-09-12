import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { activeProfile, clearConversation, recordNotification } from "../conversation.js";

registerMainMenuItem({ label: "⚙️ Настройки", data: "settings:open", order: 40 });

function settingsKeyboard() {
  return inlineKeyboard([
    [inlineButton("Хранить 10 сообщений", "settings:length:10"), inlineButton("Хранить 20 сообщений", "settings:length:20")],
    [inlineButton("Включить историю", "settings:persist:on"), inlineButton("Не хранить историю", "settings:persist:off")],
    [inlineButton("Удалить мои данные", "settings:delete")],
    [inlineButton("⬅️ В меню", "menu:main")],
  ]);
}

function settingsText(ctx: Ctx): string {
  const profile = activeProfile(ctx);
  if (!profile) return "Сначала выбери язык — тогда появятся личные настройки.";
  return `Здесь всё под твоим контролем. Сейчас храню ${profile.settings.sessionLength} последних сообщений; история ${profile.settings.persistSessions ? "включена" : "выключена"}.`;
}

const composer = new Composer<Ctx>();

composer.callbackQuery("settings:open", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply(settingsText(ctx), { reply_markup: settingsKeyboard() });
});

composer.callbackQuery(/^settings:length:(10|20)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const profile = activeProfile(ctx);
  if (!profile) {
    await ctx.reply("Сначала выбери язык — тогда я смогу сохранить настройку.");
    return;
  }
  profile.settings.sessionLength = Number(ctx.match[1]) as 10 | 20;
  if (ctx.session.conversation) {
    ctx.session.conversation.messages = ctx.session.conversation.messages.slice(-profile.settings.sessionLength);
  }
  await ctx.reply(`Готово, буду хранить ${profile.settings.sessionLength} последних сообщений.`, { reply_markup: settingsKeyboard() });
});

composer.callbackQuery(/^settings:persist:(on|off)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const profile = activeProfile(ctx);
  if (!profile) {
    await ctx.reply("Сначала выбери язык — тогда я смогу сохранить настройку.");
    return;
  }
  const enabled = ctx.match[1] === "on";
  profile.settings.persistSessions = enabled;
  if (!enabled) clearConversation(ctx, profile);
  await ctx.reply(enabled ? "История включена. Буду помнить последние сообщения." : "История выключена и очищена. Я не буду сохранять новые сообщения.", { reply_markup: settingsKeyboard() });
});

composer.callbackQuery("settings:delete", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply("Удалить язык, настройки и историю без возможности вернуть их?", {
    reply_markup: inlineKeyboard([[inlineButton("Удалить данные", "settings:delete:confirm"), inlineButton("Оставить данные", "settings:open")]]),
  });
});

composer.callbackQuery("settings:delete:confirm", async (ctx) => {
  await ctx.answerCallbackQuery();
  const profile = activeProfile(ctx);
  const id = profile?.telegramId;
  ctx.session.profile = undefined;
  ctx.session.conversation = undefined;
  ctx.session.step = undefined;
  await recordNotification(ctx, "deletion", `Пользователь ${id ?? "неизвестен"} запросил удаление данных.`);
  await ctx.reply("Твои язык, настройки и история удалены. Когда захочешь вернуться, нажми /start.");
});

export default composer;
