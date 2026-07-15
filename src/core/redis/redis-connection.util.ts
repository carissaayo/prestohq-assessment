export type RedisConnectionInput = {
  url?: string;
  host?: string;
  port?: number;
  password?: string;
  maxRetriesPerRequest?: number | null;
  lazyConnect?: boolean;
  commandTimeout?: number | null;
};

export function buildRedisConnectionSettings(input: RedisConnectionInput) {
  const options: Record<string, unknown> = {
    host: input.host ?? '127.0.0.1',
    port: input.port ?? 6379,
    maxRetriesPerRequest: input.maxRetriesPerRequest ?? null,
    lazyConnect: input.lazyConnect ?? false,
  };

  if (input.password) {
    options.password = input.password;
  }

  if (input.commandTimeout !== undefined) {
    options.commandTimeout = input.commandTimeout;
  }

  return {
    url: input.url,
    options,
  };
}
