import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { registerMainMenuItem } from "../toolkit/index.js";
import {
  UNSUPPORTED_REPLY,
  activeProfile,
  appendMessage,
  clampQuestion,
  isSupported,
  limitedReply,
  recordFallback,
} from "../conversation.js";

registerMainMenuItem({ label: "🧠 Задать вопрос", data: "chat:ask", order: 20 });

const composer = new Composer<Ctx>();

composer.callbackQuery("chat:ask", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!activeProfile(ctx)) {
    await ctx.reply("Сначала выбери язык — так я смогу отвечать удобнее для тебя.");
    return;
  }
  ctx.session.step = "awaiting_question";
  await ctx.reply("Напиши свой вопрос — я внимательно прочитаю.", {
    reply_markup: { force_reply: true, input_field_placeholder: "Напиши вопрос…" },
  });
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "awaiting_question") return next();
  const profile = activeProfile(ctx);
  if (!profile) return next();
  const question = clampQuestion(ctx.message.text);
  if (!question.text) {
    await ctx.reply("В сообщении ничего не видно. Напиши вопрос ещё раз.");
    return;
  }
  if (question.shortened) {
    await ctx.reply("Сообщение получилось длинным, поэтому я взял первые 1500 символов.");
  }
  ctx.session.step = undefined;
  appendMessage(ctx, profile, "user", question.text);
  if (!isSupported(profile.languageTag)) {
    await ctx.reply(UNSUPPORTED_REPLY);
    appendMessage(ctx, profile, "bot", UNSUPPORTED_REPLY);
    await recordFallback(ctx, profile.languageTag);
    return;
  }
  const reply = limitedReply(profile.languageTag, question.text);
  await ctx.reply(reply);
  appendMessage(ctx, profile, "bot", reply);
});

export default composer;
