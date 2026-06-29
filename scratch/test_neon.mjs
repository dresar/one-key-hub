import { neon } from "@neondatabase/serverless";
const url = "postgresql://neondb_owner:npg_CRWPpk7YF6vA@ep-frosty-scene-a1cugl6e-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const sql = neon(url);
console.log("sql is function:", typeof sql === "function");
console.log("sql.query is function:", typeof sql.query === "function");
