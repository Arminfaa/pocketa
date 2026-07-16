import cron from "node-cron";
import { isWebPushConfigured } from "../config/env";
import { processDebtReminders } from "../services/pushReminders";

/** Runs every minute; sends at most once per reminder key when Tehran hour matches. */
export function startReminderCron(): void {
  if (!isWebPushConfigured()) {
    // eslint-disable-next-line no-console
    console.warn("[cron] Web push VAPID keys missing — debt reminders disabled");
    return;
  }

  cron.schedule(
    "* * * * *",
    () => {
      void processDebtReminders()
        .then((result: { checked: number; sent: number }) => {
          if (result.sent > 0) {
            // eslint-disable-next-line no-console
            console.log(
              `[cron] debt reminders: checked=${result.checked} sent=${result.sent}`
            );
          }
        })
        .catch((err: unknown) => {
          // eslint-disable-next-line no-console
          console.error("[cron] debt reminders failed", err);
        });
    },
    { timezone: "Asia/Tehran" }
  );

  // eslint-disable-next-line no-console
  console.log("[cron] debt reminder job started (Asia/Tehran)");
}
