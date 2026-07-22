// import { neonConfig, Pool } from '@neondatabase/serverless';
// import { drizzle } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import path from 'path';
// import ws from 'ws';
import * as schema from "./schema/index";

// Required for neon-serverless to work in Node.js
// neonConfig.webSocketConstructor = ws;

let db: any;
let dbPool: any;

/*
if (process.env.DATABASE_URL) {
    dbPool = new Pool({ connectionString: process.env.DATABASE_URL });
    db = drizzle(dbPool, { schema });
} else {
*/
console.log("Using local SQLite database");
const sqlite = new Database(path.resolve(process.cwd(), 'database', 'sqlite.db'));
db = drizzleSqlite(sqlite, { schema });
//}

export { db, dbPool };
