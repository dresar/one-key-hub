import { neon } from "@neondatabase/serverless";
import { config } from "./config.js";

type RowShape = Record<string, unknown>;
const sql = neon(config.databaseUrl);

const query = async <T extends RowShape = RowShape>(text: string, values: unknown[] = []) => {
  const rows = (await sql.query(text, values)) as T[];
  return { rows };
};

export const pool = {
  query,
  connect: async () => {
    return {
      query,
      release: () => undefined,
    };
  },
};

export const q = async <T extends RowShape = RowShape>(text: string, values: unknown[] = []) => {
  const res = await pool.query<T>(text, values);
  return res.rows;
};

