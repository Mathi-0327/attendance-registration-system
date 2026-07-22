import { defineConfig } from "drizzle-kit";

const isPostgres = !!process.env.DATABASE_URL;

export default defineConfig({
  out: "./migrations",
  schema: "./database/schema/index.ts",
  dialect: isPostgres ? "postgresql" : "sqlite",
  dbCredentials: isPostgres ? {
    url: process.env.DATABASE_URL!,
  } : {
    url: "./database/sqlite.db",
  },
});
