import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import {
  registerMainMenuItem,
  inlineButton,
  inlineKeyboard,
  mainMenuKeyboard,
} from "../toolkit/index.js";

registerMainMenuItem({ label: "📋 My bookings", data: "booking:manage", order: 20 });

const SERVICES: Record<string, { name: string; price: number }> = {
  consult: { name: "Consultation", price: 50 },
  service: { name: "Standard Service", price: 100 },
  premium: { name: "Premium Service", price: 180 },
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function dayLabel(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

interface BookingRecord {
  id: string;
  serviceId: string;
  providerId: string;
  date: string;
  time: string;
  recurrence: string;
  status: string;
  paymentStatus: string;
}

function getBookings(session: Record<string, unknown>): BookingRecord[] {
  return (session.bookings as BookingRecord[]) ?? [];
}

function setBookings(session: Record<string, unknown>, bookings: BookingRecord[]): void {
  session.bookings = bookings;
}

const composer = new Composer<Ctx>();

composer.callbackQuery("booking:manage", async (ctx) => {
  await ctx.answerCallbackQuery();
  const bookings = getBookings(ctx.session as Record<string, unknown>);

  if (bookings.length === 0) {
    await ctx.editMessageText(
      "No bookings yet — tap 📅 Book service to schedule one.",
      { reply_markup: inlineKeyboard([[inlineButton("📅 Book service", "booking:start")]]) },
    );
    return;
  }

  const active = bookings.filter((b) => b.status === "confirmed");
  if (active.length === 0) {
    await ctx.editMessageText(
      "No active bookings — tap 📅 Book service to schedule one.",
      { reply_markup: inlineKeyboard([[inlineButton("📅 Book service", "booking:start")]]) },
    );
    return;
  }

  const rows = active.map((b) => {
    const svc = SERVICES[b.serviceId];
    return [inlineButton(
      `${svc?.name ?? b.serviceId} — ${dayLabel(b.date)} ${b.time}`,
      `bk:view:${b.id}`,
    )];
  });
  rows.push([inlineButton("⬅️ Back to menu", "menu:main")]);

  await ctx.editMessageText("Your active bookings:", {
    reply_markup: inlineKeyboard(rows),
  });
});

composer.callbackQuery(/^bk:view:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const bookingId = ctx.match[1];
  const bookings = getBookings(ctx.session as Record<string, unknown>);
  const booking = bookings.find((b) => b.id === bookingId);
  if (!booking) {
    await ctx.editMessageText("Booking not found.", {
      reply_markup: mainMenuKeyboard(),
    });
    return;
  }

  const svc = SERVICES[booking.serviceId];
  const text = [
    `${svc?.name ?? booking.serviceId} — $${svc?.price ?? "?"}`,
    `Date: ${dayLabel(booking.date)}`,
    `Time: ${booking.time}`,
    `Status: ${booking.status}`,
    `Payment: ${booking.paymentStatus}`,
    `Booking ID: ${booking.id}`,
  ].join("\n");

  await ctx.editMessageText(text, {
    reply_markup: inlineKeyboard([
      [inlineButton("Reschedule", `bk:reschedule:${booking.id}`)],
      [inlineButton("Cancel booking", `bk:cancel:${booking.id}`)],
      [inlineButton("Receipt", `bk:receipt:${booking.id}`)],
      [inlineButton("⬅️ Back", "booking:manage")],
    ]),
  });
});

composer.callbackQuery(/^bk:reschedule:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const bookingId = ctx.match[1];
  const bookings = getBookings(ctx.session as Record<string, unknown>);
  const booking = bookings.find((b) => b.id === bookingId);
  if (!booking) {
    await ctx.editMessageText("Booking not found.", { reply_markup: mainMenuKeyboard() });
    return;
  }

  const bookingTime = new Date(`${booking.date}T${booking.time}`).getTime();
  const now = Date.now();
  const hoursUntil = (bookingTime - now) / (1000 * 60 * 60);

  if (hoursUntil < 24) {
    await ctx.editMessageText(
      "This booking is within 24 hours — rescheduling is not available. " +
      "You may cancel instead (refund may apply).",
      { reply_markup: inlineKeyboard([[inlineButton("⬅️ Back", `bk:view:${bookingId}`)]]) },
    );
    return;
  }

  const days: string[] = [];
  const nowDate = new Date();
  for (let i = 1; i <= 7; i++) {
    const d = new Date(nowDate);
    d.setDate(d.getDate() + i);
    days.push(d.toISOString().split("T")[0]);
  }

  const rows = days.map((d) => [inlineButton(dayLabel(d), `bk:resdate:${bookingId}:${d}`)]);
  rows.push([inlineButton("⬅️ Back", `bk:view:${bookingId}`)]);

  await ctx.editMessageText("Pick a new date:", {
    reply_markup: inlineKeyboard(rows),
  });
});

composer.callbackQuery(/^bk:resdate:(.+):(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const [, bookingId, newDate] = ctx.match;
  const sess = ctx.session as Record<string, unknown>;
  const bookings = getBookings(sess);
  const idx = bookings.findIndex((b) => b.id === bookingId);
  if (idx < 0) {
    await ctx.editMessageText("Booking not found.", { reply_markup: mainMenuKeyboard() });
    return;
  }

  bookings[idx].date = newDate;
  bookings[idx].status = "rescheduled";
  setBookings(sess, bookings);

  await ctx.editMessageText(
    `Booking rescheduled to ${dayLabel(newDate)}.`,
    { reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]) },
  );
});

composer.callbackQuery(/^bk:cancel:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const bookingId = ctx.match[1];
  const bookings = getBookings(ctx.session as Record<string, unknown>);
  const booking = bookings.find((b) => b.id === bookingId);
  if (!booking) {
    await ctx.editMessageText("Booking not found.", { reply_markup: mainMenuKeyboard() });
    return;
  }

  const bookingTime = new Date(`${booking.date}T${booking.time}`).getTime();
  const now = Date.now();
  const hoursUntil = (bookingTime - now) / (1000 * 60 * 60);

  let refundPct = 0;
  if (hoursUntil >= 48) refundPct = 100;
  else if (hoursUntil >= 24) refundPct = 50;

  const svc = SERVICES[booking.serviceId];
  const refundAmount = Math.round((svc?.price ?? 0) * refundPct / 100);

  await ctx.editMessageText(
    `Cancel this booking?\n\n` +
    (refundPct > 0
      ? `Refund: ${refundPct}% ($${refundAmount}) — within ${Math.round(hoursUntil)}h of appointment.`
      : "No refund — less than 24 hours before appointment."),
    {
      reply_markup: inlineKeyboard([
        [inlineButton("Yes, cancel", `bk:confirm-cancel:${bookingId}`)],
        [inlineButton("Keep booking", `bk:view:${bookingId}`)],
      ]),
    },
  );
});

composer.callbackQuery(/^bk:confirm-cancel:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const bookingId = ctx.match[1];
  const sess = ctx.session as Record<string, unknown>;
  const bookings = getBookings(sess);
  const idx = bookings.findIndex((b) => b.id === bookingId);
  if (idx < 0) {
    await ctx.editMessageText("Booking not found.", { reply_markup: mainMenuKeyboard() });
    return;
  }

  bookings[idx].status = "cancelled";
  setBookings(sess, bookings);

  await ctx.editMessageText(
    "Booking cancelled. You'll receive a refund if applicable.",
    { reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]) },
  );
});

composer.callbackQuery(/^bk:receipt:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const bookingId = ctx.match[1];
  const bookings = getBookings(ctx.session as Record<string, unknown>);
  const booking = bookings.find((b) => b.id === bookingId);
  if (!booking) {
    await ctx.editMessageText("Booking not found.", { reply_markup: mainMenuKeyboard() });
    return;
  }

  const svc = SERVICES[booking.serviceId];
  const receipt = [
    "Receipt",
    "",
    `Service: ${svc?.name ?? booking.serviceId}`,
    `Date: ${dayLabel(booking.date)}`,
    `Time: ${booking.time}`,
    `Amount: $${svc?.price ?? 0}`,
    `Payment: ${booking.paymentStatus}`,
    `Booking ID: ${booking.id}`,
    "",
    "Thank you for your booking!",
  ].join("\n");

  await ctx.editMessageText(receipt, {
    reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
  });
});

export default composer;
