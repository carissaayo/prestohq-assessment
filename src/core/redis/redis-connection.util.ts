export type RedisConnectionInput = {
  url?: string;
  host?: string;
  port?: number;
  password?: string;
  maxRetriesPerRequest?: number | null;
  lazyConnect?: boolean;
  commandTimeout?: number | null;
};

/**
 * Prefer a single REDIS_URL (Render, Upstash, etc.).
 * Host/port/password are only used when url is absent.
 */
export function buildRedisConnectionSettings(input: RedisConnectionInput) {
  const shared: Record<string, unknown> = {
    maxRetriesPerRequest: input.maxRetriesPerRequest ?? null,
    lazyConnect: input.lazyConnect ?? false,
  };

  if (input.commandTimeout !== undefined) {
    shared.commandTimeout = input.commandTimeout;
  }

  if (input.url?.trim()) {
    return {
      connection: {
        url: input.url.trim(),
        ...shared,
      },
    };
  }

  const options: Record<string, unknown> = {
    host: input.host ?? '127.0.0.1',
    port: input.port ?? 6379,
    ...shared,
  };

  if (input.password) {
    options.password = input.password;
  }

  return { connection: options };
}
