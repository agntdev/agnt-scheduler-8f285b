import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import {
  registerMainMenuItem,
  inlineButton,
  inlineKeyboard,
  mainMenuKeyboard,
} from "../toolkit/index.js";

registerMainMenuItem({ label: "📅 Book service", data: "booking:start", order: 10 });

const SERVICES = [
  { id: "consult", name: "Consultation", duration: 30, price: 50 },
  { id: "service", name: "Standard Service", duration: 60, price: 100 },
  { id: "premium", name: "Premium Service", duration: 90, price: 180 },
];

const PROVIDERS = [
  { id: "p1", name: "Alex" },
  { id: "p2", name: "Jordan" },
  { id: "p3", name: "Taylor" },
];

function fmtDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function nextDays(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 1; i <= n; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    out.push(fmtDate(d));
  }
  return out;
}

function slots(): string[] {
  return ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00"];
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function dayLabel(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

const composer = new Composer<Ctx>();

composer.callbackQuery("booking:start", async (ctx) => {
  await ctx.answerCallbackQuery();
  (ctx.session as any).step = "selecting_service";
  const rows = SERVICES.map((s) => [
    inlineButton(`${s.name} — $${s.price}`, `svc:${s.id}`),
  ]);
  await ctx.reply("Choose a service:", {
    reply_markup: inlineKeyboard([...rows, [inlineButton("Cancel", "bk:cancel")]]),
  });
});

composer.callbackQuery(/^svc:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const serviceId = ctx.match[1];
  const service = SERVICES.find((s) => s.id === serviceId);
  if (!service) return;
  (ctx.session as any).serviceId = serviceId;
  (ctx.session as any).step = "selecting_date";
  const days = nextDays(5);
  const rows = days.map((d) => [inlineButton(dayLabel(d), `dt:${d}`)]);
  await ctx.editMessageText(`${service.name} — Pick a date:`, {
    reply_markup: inlineKeyboard([...rows, [inlineButton("Back", "booking:start")]]),
  });
});

composer.callbackQuery(/^dt:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const date = ctx.match[1];
  (ctx.session as any).selectedDate = date;
  (ctx.session as any).step = "selecting_time";
  const timeSlots = slots();
  const rows = timeSlots.map((t) => [inlineButton(t, `tm:${t}`)]);
  await ctx.editMessageText(`Available times for ${dayLabel(date)}:`, {
    reply_markup: inlineKeyboard([...rows, [inlineButton("Back", `svc:${(ctx.session as any).serviceId}`)]]),
  });
});

composer.callbackQuery(/^tm:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const time = ctx.match[1];
  (ctx.session as any).selectedTime = time;
  (ctx.session as any).step = "selecting_provider";
  const rows = PROVIDERS.map((p) => [inlineButton(p.name, `prov:${p.id}`)]);
  rows.push([inlineButton("Auto-assign", "prov:auto")]);
  await ctx.editMessageText("Choose a provider:", {
    reply_markup: inlineKeyboard([...rows, [inlineButton("Back", `dt:${(ctx.session as any).selectedDate}`)]]),
  });
});

composer.callbackQuery(/^prov:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const providerId = ctx.match[1];
  const provider = providerId === "auto"
    ? PROVIDERS[0]
    : PROVIDERS.find((p) => p.id === providerId);
  if (!provider) return;
  (ctx.session as any).providerId = provider.id;
  (ctx.session as any).step = "selecting_recurrence";
  await ctx.editMessageText(`With ${provider.name} — One-time or recurring?`, {
    reply_markup: inlineKeyboard([
      [inlineButton("One-time", "rec:once"), inlineButton("Weekly", "rec:weekly")],
      [inlineButton("Back", "tm:select")],
    ]),
  });
});

composer.callbackQuery(/^rec:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const recurrence = ctx.match[1];
  const service = SERVICES.find((s) => s.id === (ctx.session as any).serviceId);
  const provider = PROVIDERS.find((p) => p.id === (ctx.session as any).providerId);
  const date = (ctx.session as any).selectedDate;
  const time = (ctx.session as any).selectedTime;
  if (!service || !provider || !date || !time) return;

  const summary = [
    `${service.name} — $${service.price}`,
    `${dayLabel(date)} at ${time}`,
    `Provider: ${provider.name}`,
    recurrence === "weekly" ? "Recurring: weekly" : "One-time",
  ].join("\n");

  (ctx.session as any).step = "confirming_booking";
  await ctx.editMessageText(summary, {
    reply_markup: inlineKeyboard([
      [inlineButton("Confirm & pay", "pay:confirm")],
      [inlineButton("Cancel", "bk:cancel")],
    ]),
  });
});

composer.callbackQuery("pay:confirm", async (ctx) => {
  await ctx.answerCallbackQuery();
  const service = SERVICES.find((s) => s.id === (ctx.session as any).serviceId);
  if (!service) return;
  (ctx.session as any).step = "processing_payment";
  await ctx.editMessageText("Processing payment…", {
    reply_markup: inlineKeyboard([
      [inlineButton(`Pay $${service.price}`, `pay:process`)],
    ]),
  });
});

composer.callbackQuery("pay:process", async (ctx) => {
  await ctx.answerCallbackQuery();
  const service = SERVICES.find((s) => s.id === (ctx.session as any).serviceId);
  const provider = PROVIDERS.find((p) => p.id === (ctx.session as any).providerId);
  const date = (ctx.session as any).selectedDate;
  const time = (ctx.session as any).selectedTime;
  if (!service || !provider || !date || !time) return;

  const bookingId = `BK-${(ctx.session as any).serviceId}-${(ctx.session as any).selectedDate}-${(ctx.session as any).selectedTime}`;
  (ctx.session as any).bookingId = bookingId;
  (ctx.session as any).step = "booking_complete";

  await ctx.editMessageText(
    `Booking confirmed!\n\n` +
    `Service: ${service.name}\n` +
    `Date: ${dayLabel(date)}\n` +
    `Time: ${time}\n` +
    `Provider: ${provider.name}\n` +
    `Booking ID: ${bookingId}\n\n` +
    `Payment of $${service.price} processed.`,
    { reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]) },
  );
});

composer.callbackQuery("bk:cancel", async (ctx) => {
  await ctx.answerCallbackQuery();
  (ctx.session as any).step = undefined;
  (ctx.session as any).serviceId = undefined;
  (ctx.session as any).providerId = undefined;
  (ctx.session as any).selectedDate = undefined;
  (ctx.session as any).selectedTime = undefined;
  await ctx.editMessageText("Booking cancelled.", {
    reply_markup: mainMenuKeyboard(),
  });
});

export default composer;
