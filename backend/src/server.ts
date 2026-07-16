import { app } from "./app";
import { connectDb } from "./config/db";
import { env } from "./config/env";

async function start() {
  await connectDb();
  app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Server running on http://localhost:${env.PORT}`);
  });
}

void start();

