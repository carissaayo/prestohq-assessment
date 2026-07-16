export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL,
  redis: {
    url: process.env.REDIS_URL,
    // Fallback only when REDIS_URL is unset
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT
      ? Number(process.env.REDIS_PORT)
      : undefined,
    password: process.env.REDIS_PASSWORD || undefined,
    keyPrefix: process.env.REDIS_KEY_PREFIX ?? 'wallet-api:',
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  },
  flutterwave: {
    secretKey: process.env.FLUTTERWAVE_SECRET_KEY,
    publicKey: process.env.FLUTTERWAVE_PUBLIC_KEY,
    webhookSecret: process.env.FLUTTERWAVE_WEBHOOK_SECRET,
    redirectUrl:
      process.env.FLUTTERWAVE_REDIRECT_URL ??
      'http://localhost:3010/funding/callback',
    mock: process.env.FLUTTERWAVE_MOCK ?? 'false',
  },
});
