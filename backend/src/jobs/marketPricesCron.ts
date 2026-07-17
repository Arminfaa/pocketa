import cron from "node-cron";
import { refreshMarketPricesDaily } from "../services/market-prices.service";

/**
 * Daily market price refresh at 14:00 Asia/Tehran.
 * Gold + free USD / USDT are fetched once and stored in MongoDB.
 */
export function startMarketPricesCron(): void {
  cron.schedule(
    "0 14 * * *",
    () => {
      void refreshMarketPricesDaily()
        .then(() => {
          // eslint-disable-next-line no-console
          console.log("[cron] market prices refreshed (14:00 Asia/Tehran)");
        })
        .catch((err: unknown) => {
          // eslint-disable-next-line no-console
          console.error("[cron] market prices refresh failed", err);
        });
    },
    { timezone: "Asia/Tehran" }
  );

  // eslint-disable-next-line no-console
  console.log("[cron] market prices job started (14:00 Asia/Tehran)");
}
