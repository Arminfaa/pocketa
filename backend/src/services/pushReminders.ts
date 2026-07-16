import webpush from "web-push";
import { env, isWebPushConfigured } from "../config/env";
import { PushSubscriptionModel } from "../models/PushSubscription";
import { RecurringTransactionModel } from "../models/RecurringTransaction";
import { jalaliDaysUntil, todayJalali } from "../utils/jalaliDate";

let vapidReady = false;

function ensureVapid(): boolean {
  if (!isWebPushConfigured()) return false;
  if (!vapidReady) {
    webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
    vapidReady = true;
  }
  return true;
}

export function getVapidPublicKey(): string | null {
  if (!isWebPushConfigured()) return null;
  return env.VAPID_PUBLIC_KEY;
}

function tehranHour(): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tehran",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  return Number(parts.find((p) => p.type === "hour")?.value ?? "0");
}

function formatAmountFa(amount: number): string {
  return `${new Intl.NumberFormat("fa-IR").format(Math.round(amount))} تومان`;
}

async function sendToUser(
  userId: string,
  payload: { title: string; body: string; url?: string }
): Promise<void> {
  if (!ensureVapid()) return;

  const subs = await PushSubscriptionModel.find({ userId });
  if (subs.length === 0) return;

  const body = JSON.stringify(payload);
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.keys?.p256dh ?? "",
              auth: sub.keys?.auth ?? "",
            },
          },
          body
        );
      } catch (err: unknown) {
        const status = (err as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          await PushSubscriptionModel.deleteOne({ _id: sub._id });
        } else {
          // eslint-disable-next-line no-console
          console.error("[push] send failed", sub.endpoint.slice(0, 48), err);
        }
      }
    })
  );
}

/**
 * Reminds 3, 2, and 1 day(s) before nextPaymentDate at the item's reminderHour (Tehran).
 */
export async function processDebtReminders(): Promise<{ checked: number; sent: number }> {
  if (!ensureVapid()) return { checked: 0, sent: 0 };

  const hour = tehranHour();
  const today = todayJalali();

  const items = await RecurringTransactionModel.find({ active: true });
  const dueThisHour = items.filter((item) => (item.reminderHour ?? 20) === hour);

  let sent = 0;

  for (const item of dueThisHour) {
    const daysUntil = jalaliDaysUntil(item.nextPaymentDate, today);
    if (daysUntil < 1 || daysUntil > 3) continue;

    const key = `${item.nextPaymentDate}:${daysUntil}`;
    if ((item.reminderSentKeys ?? []).includes(key)) continue;

    const dayLabel = daysUntil === 1 ? "فردا" : `${daysUntil} روز دیگر`;

    await sendToUser(String(item.userId), {
      title: "یادآوری بدهی / قسط",
      body: `«${item.title}» ${dayLabel} سررسید می‌شود (${formatAmountFa(item.amount)})`,
      url: "/recurring",
    });

    item.reminderSentKeys = [...(item.reminderSentKeys ?? []), key].slice(-30);
    if (item.reminderHour == null) item.reminderHour = 20;
    await item.save();
    sent += 1;
  }

  return { checked: dueThisHour.length, sent };
}
