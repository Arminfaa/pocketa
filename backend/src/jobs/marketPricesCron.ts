import cron from "node-cron";
import { refreshMarketPricesDaily } from "../services/market-prices.service";

/**
 * Daily market price refresh in Asia/Tehran.
 * Multiple slots: first successful write for the day wins; later slots
 * only hit APIs when today's snapshot is still missing.
 */
const CRON_SLOTS = [
  "0 10 * * *",
  "0 14 * * *",
  "0 16 * * *",
  "0 18 * * *",
  "0 21 * * *",
] as const;

export function startMarketPricesCron(): void {
  for (const expression of CRON_SLOTS) {
    cron.schedule(
      expression,
      () => {
        void refreshMarketPricesDaily()
          .then(() => {
            // eslint-disable-next-line no-console
            console.log(`[cron] market prices checked (${expression} Asia/Tehran)`);
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
    "[cron] market prices job started (10/14/16/18/21 Asia/Tehran)"
  );
}
