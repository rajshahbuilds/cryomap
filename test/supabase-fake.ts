/**
 * In-memory fake of the subset of the supabase-js query builder the app uses.
 *
 * This is the **data-access seam**: business logic never talks to
 * supabase-js directly — it goes through repository modules that
 * accept a client. In tests we pass this fake instead of a real client, so the
 * lock state machine, repositories, versioning, etc. can be unit-tested with no
 * live Supabase project.
 *
 * Supported chain (enough for our access patterns):
 *   from(table).select("*").eq(col, val).order(col, { ascending }).single()
 *   from(table).insert(rowOrRows).select().single()
 *   from(table).update(patch).eq(col, val)
 *   from(table).delete().eq(col, val)
 *
 * Every chain is awaitable and resolves to `{ data, error }`, mirroring
 * supabase-js (PostgREST) responses.
 */

export type FakeRow = Record<string, unknown>;
export type FakeTables = Record<string, FakeRow[]>;
export type FakeError = { message: string };

type Op = "select" | "insert" | "update" | "delete" | "upsert";
type Predicate = (row: FakeRow) => boolean;

const asRow = (value: object): FakeRow => ({ ...(value as FakeRow) });

// Mimic a DB-generated primary key when none is supplied (most tables use a
// `uuid` `id` default). Applied to inserted/upserted rows only.
const withGeneratedId = (row: FakeRow): FakeRow =>
  "id" in row ? row : { id: crypto.randomUUID(), ...row };

export type QueryResult = {
  data: FakeRow | FakeRow[] | null;
  error: FakeError | null;
};

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a) > String(b) ? 1 : -1;
}

class FakeQuery implements PromiseLike<QueryResult> {
  private op: Op = "select";
  private opSet = false;
  private payload: FakeRow[] = [];
  private patch: FakeRow = {};
  private filters: Predicate[] = [];
  private orderBy: { col: string; ascending: boolean } | null = null;
  private wantSingle = false;
  private conflictKey = "id";
  // Retained for fidelity with supabase-js; the fake ignores column projection.
  private selectedColumns = "*";

  constructor(private readonly rows: FakeRow[]) {}

  select(columns = "*"): this {
    // A trailing `.select()` after insert/update means "return the rows";
    // it must not downgrade the operation back to a plain read.
    if (!this.opSet) this.op = "select";
    this.selectedColumns = columns;
    return this;
  }

  insert(payload: object | object[]): this {
    this.op = "insert";
    this.opSet = true;
    this.payload = (Array.isArray(payload) ? payload : [payload])
      .map(asRow)
      .map(withGeneratedId);
    return this;
  }

  update(patch: object): this {
    this.op = "update";
    this.opSet = true;
    this.patch = asRow(patch);
    return this;
  }

  upsert(payload: object | object[], opts?: { onConflict?: string }): this {
    this.op = "upsert";
    this.opSet = true;
    this.payload = (Array.isArray(payload) ? payload : [payload])
      .map(asRow)
      .map(withGeneratedId);
    if (opts?.onConflict) this.conflictKey = opts.onConflict;
    return this;
  }

  delete(): this {
    this.op = "delete";
    this.opSet = true;
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  order(column: string, opts?: { ascending?: boolean }): this {
    this.orderBy = { col: column, ascending: opts?.ascending ?? true };
    return this;
  }

  single(): this {
    this.wantSingle = true;
    return this;
  }

  maybeSingle(): this {
    this.wantSingle = true;
    return this;
  }

  private matches(): FakeRow[] {
    return this.rows.filter((row) => this.filters.every((f) => f(row)));
  }

  private run(): QueryResult {
    let result: FakeRow[];

    if (this.op === "insert") {
      this.rows.push(...this.payload);
      result = this.payload;
    } else if (this.op === "upsert") {
      result = [];
      for (const row of this.payload) {
        const existing = this.rows.find(
          (r) => r[this.conflictKey] === row[this.conflictKey],
        );
        if (existing) {
          Object.assign(existing, row);
          result.push(existing);
        } else {
          this.rows.push(row);
          result.push(row);
        }
      }
    } else if (this.op === "update") {
      result = this.matches();
      for (const row of result) Object.assign(row, this.patch);
    } else if (this.op === "delete") {
      result = this.matches();
      for (const row of result) {
        const index = this.rows.indexOf(row);
        if (index >= 0) this.rows.splice(index, 1);
      }
    } else {
      result = this.matches();
    }

    if (this.orderBy) {
      const { col, ascending } = this.orderBy;
      result = [...result].sort(
        (a, b) => compare(a[col], b[col]) * (ascending ? 1 : -1),
      );
    }

    if (this.wantSingle) {
      return { data: result[0] ?? null, error: null };
    }
    return { data: result, error: null };
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?:
      | ((value: QueryResult) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.run()).then(onfulfilled, onrejected);
  }
}

/** A stubbed Postgres function: given its args + the backing store, returns a result. */
export type RpcHandler = (
  args: Record<string, unknown>,
  tables: FakeTables,
) => QueryResult;

export interface SupabaseFake {
  /** Direct access to the backing store (for assertions/seeding in tests). */
  readonly tables: FakeTables;
  from(table: string): FakeQuery;
  rpc(name: string, args?: Record<string, unknown>): Promise<QueryResult>;
}

export function createSupabaseFake(
  seed: Record<string, object[]> = {},
  rpcs: Record<string, RpcHandler> = {},
): SupabaseFake {
  const tables: FakeTables = {};
  for (const [name, rows] of Object.entries(seed)) {
    tables[name] = rows.map(asRow);
  }

  return {
    tables,
    from(table: string) {
      tables[table] ??= [];
      return new FakeQuery(tables[table]);
    },
    rpc(name: string, args: Record<string, unknown> = {}) {
      const handler = rpcs[name];
      const result: QueryResult = handler
        ? handler(args, tables)
        : { data: null, error: { message: `unknown rpc: ${name}` } };
      return Promise.resolve(result);
    },
  };
}
