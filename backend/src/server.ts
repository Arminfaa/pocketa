import { app } from "./app";
import { connectDb } from "./config/db";
import { env } from "./config/env";
import { startReminderCron } from "./jobs/reminderCron";

async function start() {
  await connectDb();
  startReminderCron();
  app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Server running on http://localhost:${env.PORT}`);
  });
}

void start();

