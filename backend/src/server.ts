import { app } from "./app";
import { connectDb } from "./config/db";
import { env } from "./config/env";
import { startReminderCron } from "./jobs/reminderCron";
import { startMarketPricesCron } from "./jobs/marketPricesCron";
import {
  refreshCurrencyIfNeeded,
  refreshGoldIfNeeded,
} from "./services/market-prices.service";

async function start() {
  await connectDb();
  startReminderCron();
  startMarketPricesCron();

  // Bootstrap snapshots if missing (does not re-hit APIs when today's cache exists)
  void Promise.all([
    refreshGoldIfNeeded(),
    refreshCurrencyIfNeeded(),
  ]).catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.warn("[startup] market prices bootstrap skipped/failed", err);
  });

  app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Server running on http://localhost:${env.PORT}`);
  });
}

void start();
