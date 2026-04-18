declare module "better-sqlite3" {
  export interface Statement<TResult = unknown> {
    run(...params: unknown[]): unknown;
    get(...params: unknown[]): TResult | undefined;
    all(...params: unknown[]): TResult[];
  }

  export default class Database {
    constructor(filename: string);
    exec(sql: string): this;
    prepare<TResult = unknown>(sql: string): Statement<TResult>;
  }
}
