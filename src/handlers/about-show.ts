import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";

registerMainMenuItem({ label: "ℹ️ О боте", data: "about:show", order: 50 });

const composer = new Composer<Ctx>();

composer.callbackQuery("about:show", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply(
    "Я местный собеседник: помогу спокойно обсудить вопрос и не потерять нить разговора.\n\nПоддерживаю русский, дагестанский вариант и азербайджанский.",
    { reply_markup: inlineKeyboard([[inlineButton("⬅️ В меню", "menu:main")]]) },
  );
});

export default composer;
