import { serve } from "@hono/node-server";
import { config, assertConfig } from "./config.js";
import { createApp } from "./app.js";
import { q } from "./db.js";
import bcrypt from "bcryptjs";

assertConfig();

const seedDevelopmentAdmin = async () => {
  if (config.nodeEnv !== "development") return;
  const email = "admin@example.com";
  const plainPassword = "password123";
  const passwordHash = await bcrypt.hash(plainPassword, 10);
  await q(
    `insert into public.users (email, password_hash, display_name)
     values ($1, $2, $3)
     on conflict (email) do update set
       password_hash = excluded.password_hash,
       display_name = coalesce(public.users.display_name, excluded.display_name),
       updated_at = now()`,
    [email, passwordHash, "Admin Dev"]
  );
  // eslint-disable-next-line no-console
  console.log("Dev seed ready: admin@example.com / password123");
};

const start = async () => {
  await seedDevelopmentAdmin();
  const app = createApp();
  serve(
    {
      fetch: app.fetch,
      port: config.port,
    },
    () => {
      // eslint-disable-next-line no-console
      console.log(`Hono API running on http://127.0.0.1:${config.port}`);
    }
  );
};

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start server:", err);
  process.exit(1);
});
