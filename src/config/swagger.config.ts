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
        'Wallet funding (Transfer) and outflows (Withdrawal: P2P or bank).',
        'Transfer means Flutterwave funding; Withdrawal covers P2P and bank outflows.',
        'Balances are always computed as SUM(successful credits) − SUM(successful debits).',
        'POST /transfers and POST /withdrawals require an Idempotency-Key header (UUID).',
      ].join(' '),
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
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'Idempotency-Key',
        description: 'Client-supplied UUID for POST /transfers and POST /withdrawals',
      },
      'idempotency-key',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    swaggerOptions: { persistAuthorization: true },
  });
}

export { SWAGGER_PATH };
