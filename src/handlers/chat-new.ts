import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { registerMainMenuItem } from "../toolkit/index.js";
import { activeProfile, clearConversation } from "../conversation.js";

registerMainMenuItem({ label: "💬 Новый чат", data: "chat:new", order: 10 });

const composer = new Composer<Ctx>();

composer.callbackQuery("chat:new", async (ctx) => {
  await ctx.answerCallbackQuery();
  const profile = activeProfile(ctx);
  if (!profile) {
    await ctx.reply("Сначала выбери язык — потом начнём новый разговор.");
    return;
  }
  clearConversation(ctx, profile);
  ctx.session.step = "awaiting_question";
  await ctx.reply("Начали с чистого листа. Напиши, что хочешь обсудить.", {
    reply_markup: { force_reply: true, input_field_placeholder: "Напиши вопрос…" },
  });
});

export default composer;
