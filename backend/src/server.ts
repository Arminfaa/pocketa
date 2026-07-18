import { app } from "./app";
import { connectDb } from "./config/db";
import { env } from "./config/env";
import { startReminderCron } from "./jobs/reminderCron";
import { startMarketPricesCron } from "./jobs/marketPricesCron";
import {
  refreshCurrencyIfNeeded,
  refreshGoldIfNeeded,
} from "./services/market-prices.service";
import { migrateLegacyInitialBalances } from "./services/account.service";
import { backfillTransactionTimes } from "./services/backfill-transaction-times.service";

async function start() {
  await connectDb();

  try {
    const migrated = await migrateLegacyInitialBalances();
    if (migrated.accountsUpdated > 0) {
      // eslint-disable-next-line no-console
      console.log(
        `[accounting] migrated legacy initialBalance on ${migrated.accountsUpdated} account(s)`
      );
    }
  } catch (err: unknown) {
    // eslint-disable-next-line no-console
    console.warn("[accounting] initialBalance migration skipped/failed", err);
  }

  try {
    const times = await backfillTransactionTimes();
    if (times.updated > 0) {
      // eslint-disable-next-line no-console
      console.log(
        `[transactions] backfilled time on ${times.updated}/${times.scanned} row(s) (skipped ${times.skipped})`
      );
    }
  } catch (err: unknown) {
    // eslint-disable-next-line no-console
    console.warn("[transactions] time backfill skipped/failed", err);
  }

  startReminderCron();
  startMarketPricesCron();

  // eslint-disable-next-line no-console
  console.log(
    `[market] keys configured: gold=${Boolean(env.GOLD_API_KEY?.trim())} navasan=${Boolean(env.NAVASAN_API_KEY?.trim())}`
  );

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
