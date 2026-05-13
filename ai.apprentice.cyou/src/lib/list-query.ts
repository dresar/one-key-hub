type SortDirection = "asc" | "desc";

export type ListQuery = {
  search: string | null;
  status: string | null;
  provider: string | null;
  from: string | null;
  to: string | null;
  sortBy: string;
  sortDir: SortDirection;
  page: number;
  pageSize: number;
  limit: number;
  offset: number;
};

const toInt = (value: string | undefined, fallback: number) => {
  if (!value) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const parseListQuery = (
  query: (key: string) => string | undefined,
  opts?: {
    defaultSortBy?: string;
    allowedSortBy?: string[];
    defaultPageSize?: number;
    maxPageSize?: number;
  }
): ListQuery => {
  const allowedSortBy = opts?.allowedSortBy ?? ["created_at"];
  const defaultSortBy = opts?.defaultSortBy && allowedSortBy.includes(opts.defaultSortBy) ? opts.defaultSortBy : allowedSortBy[0];
  const defaultPageSize = opts?.defaultPageSize ?? 20;
  const maxPageSize = opts?.maxPageSize ?? 100;

  const search = (query("search") || "").trim() || null;
  const status = (query("status") || "").trim() || null;
  const provider = (query("provider") || "").trim() || null;
  const from = (query("from") || "").trim() || null;
  const to = (query("to") || "").trim() || null;

  const rawSortBy = (query("sortBy") || "").trim();
  const sortBy = allowedSortBy.includes(rawSortBy) ? rawSortBy : defaultSortBy;
  const rawSortDir = (query("sortDir") || "").trim().toLowerCase();
  const sortDir: SortDirection = rawSortDir === "asc" ? "asc" : "desc";

  const page = clamp(toInt(query("page"), 1), 1, 100000);
  const pageSize = clamp(toInt(query("pageSize"), defaultPageSize), 1, maxPageSize);
  const limit = pageSize;
  const offset = (page - 1) * pageSize;

  return {
    search,
    status,
    provider,
    from,
    to,
    sortBy,
    sortDir,
    page,
    pageSize,
    limit,
    offset,
  };
};

export const makePagedResponse = <T>(items: T[], total: number, page: number, pageSize: number) => ({
  items,
  meta: {
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  },
});
