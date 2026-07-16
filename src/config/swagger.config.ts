import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

const SWAGGER_PATH = 'api/docs';

export function isSwaggerEnabled(): boolean {
  return (
    process.env.NODE_ENV !== 'production' ||
    process.env.SWAGGER_ENABLED === 'true'
  );
}

export function setupSwagger(app: INestApplication): void {
  if (!isSwaggerEnabled()) {
    return;
  }

  const config = new DocumentBuilder()
    .setTitle('Wallet & Payments API')
    .setDescription(
      [
        '## Naming',
        '- **Transfer** = Flutterwave funding (credit).',
        '- **Withdrawal** = P2P or bank outflow (debit).',
        '- **Balance** = SUM(successful credits) − SUM(successful debits); never a cached column.',
        '',
        '## Safety',
        '- Amounts are integer **kobo**.',
        '- Create a **transaction PIN** via `POST /auth/pin` before any funding or withdrawal.',
        '- `POST /transfers` and `POST /withdrawals` require body field `pin` (4 digits) and header `Idempotency-Key` (UUID v4).',
        '- Debits use `FOR UPDATE` + fresh SUM. P2P locks both wallets by ascending id.',
        '- Flutterwave webhook: verify → store event → enqueue; money only in workers.',
        '- Login / PIN: 3 failed attempts lock the account for 5 minutes (separate counters).',
      ].join('\n'),
    )
    .setVersion('0.1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    swaggerOptions: { persistAuthorization: true },
  });
}

export { SWAGGER_PATH };
