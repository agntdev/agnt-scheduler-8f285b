import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import {
  registerMainMenuItem,
  inlineButton,
  inlineKeyboard,
  mainMenuKeyboard,
} from "../toolkit/index.js";

registerMainMenuItem({ label: "💬 Contact", data: "contact:form", order: 30 });

const composer = new Composer<Ctx>();

composer.callbackQuery("contact:form", async (ctx) => {
  await ctx.answerCallbackQuery();
  (ctx.session as any).contactStep = "awaiting_message";
  await ctx.editMessageText(
    "How can we help? Type your message below and tap Send.",
    {
      reply_markup: inlineKeyboard([
        [inlineButton("Send message", "contact:send")],
        [inlineButton("Cancel", "contact:cancel")],
      ]),
    },
  );
});

composer.callbackQuery("contact:send", async (ctx) => {
  await ctx.answerCallbackQuery();
  (ctx.session as any).contactStep = "awaiting_message";
  await ctx.editMessageText("Type your message and send it — we'll get back to you shortly.");
});

composer.callbackQuery("contact:cancel", async (ctx) => {
  await ctx.answerCallbackQuery();
  (ctx.session as any).contactStep = undefined;
  await ctx.editMessageText("Contact form cancelled.", {
    reply_markup: mainMenuKeyboard(),
  });
});

composer.on("message:text", async (ctx, next) => {
  if ((ctx.session as any).contactStep !== "awaiting_message") return next();
  const msg = ctx.message.text.trim();
  if (!msg) return;
  (ctx.session as any).contactStep = "confirming";
  (ctx.session as any).contactMessage = msg;
  await ctx.reply(`Send this message?\n\n"${msg}"`, {
    reply_markup: inlineKeyboard([
      [inlineButton("Yes, send", "contact:confirm")],
      [inlineButton("Cancel", "contact:cancel")],
    ]),
  });
});

composer.callbackQuery("contact:confirm", async (ctx) => {
  await ctx.answerCallbackQuery();
  (ctx.session as any).contactStep = undefined;
  (ctx.session as any).contactMessage = undefined;
  await ctx.editMessageText(
    "Message sent! We'll get back to you shortly.",
    { reply_markup: mainMenuKeyboard() },
  );
});

export default composer;
