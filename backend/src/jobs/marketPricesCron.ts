import cron from "node-cron";
import { refreshMarketPricesDaily } from "../services/market-prices.service";

/**
 * Daily market price refresh in Asia/Tehran.
 * Primary slot 14:00; later slots retry if the earlier fetch failed
 * (quota/network) so the app is less likely to stay on yesterday's prices.
 */
const CRON_SLOTS = ["0 14 * * *", "0 16 * * *", "0 20 * * *"] as const;

export function startMarketPricesCron(): void {
  for (const expression of CRON_SLOTS) {
    cron.schedule(
      expression,
      () => {
        void refreshMarketPricesDaily()
          .then(() => {
            // eslint-disable-next-line no-console
            console.log(`[cron] market prices refreshed (${expression} Asia/Tehran)`);
          })
          .catch((err: unknown) => {
            // eslint-disable-next-line no-console
            console.error("[cron] market prices refresh failed", err);
          });
      },
      { timezone: "Asia/Tehran" }
    );
  }

  // eslint-disable-next-line no-console
  console.log(
    "[cron] market prices job started (14:00 / 16:00 / 20:00 Asia/Tehran)"
  );
}
