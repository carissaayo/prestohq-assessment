import { randomUUID } from 'crypto';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request = require('supertest');

import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { TransformResponseInterceptor } from '../src/common/interceptors/transform-response.interceptor';
import { Reflector } from '@nestjs/core';

type Authed = {
  token: string;
  userId: string;
  username: string;
  walletId: string;
};

describe('Concurrency safety (Option A)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    process.env.FLUTTERWAVE_MOCK = 'true';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(
      new TransformResponseInterceptor(app.get(Reflector)),
    );
    await app.init();

    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  async function register(prefix: string): Promise<Authed> {
    const email = `${prefix}${Date.now()}${Math.floor(Math.random() * 1e6)}@example.com`;
    const username = `${prefix}${Date.now().toString().slice(-5)}${Math.floor(Math.random() * 1000)}`;
    const res = await api()
      .post('/api/v1/auth/register')
      .send({ email, username, password: 'Password1!' })
      .expect(201);

    return {
      token: res.body.accessToken as string,
      userId: res.body.data.user.id as string,
      username: res.body.data.user.username as string,
      walletId: res.body.data.user.walletId as string,
    };
  }

  async function seedCredit(walletId: string, amount: number): Promise<void> {
    await prisma.walletTransaction.create({
      data: {
        walletId,
        type: 'CREDIT',
        purpose: 'FLUTTERWAVE_FUNDING',
        status: 'SUCCESSFUL',
        amount,
        idempotencyKey: `e2e-seed-${randomUUID()}`,
      },
    });
  }

  async function getBalance(token: string): Promise<number> {
    const res = await api()
      .get('/api/v1/wallets/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return res.body.data.wallet.balance as number;
  }

  it('allows exactly one of 20 concurrent P2P withdrawals of 6000 against 10000', async () => {
    const sender = await register('csa');
    const recipient = await register('csb');
    await seedCredit(sender.walletId, 10_000);

    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        api()
          .post('/api/v1/withdrawals')
          .set('Authorization', `Bearer ${sender.token}`)
          .set('Idempotency-Key', randomUUID())
          .send({
            destinationType: 'WALLET',
            recipientUsername: recipient.username,
            amount: 6_000,
          })
          .then((res) => ({ status: res.status, body: res.body }))
          .catch((err) => ({
            status: err.status ?? err.response?.status ?? 500,
            body: err.response?.body,
          })),
      ),
    );

    const ok = results.filter((r) => r.status === 201 || r.status === 200);
    const insufficient = results.filter((r) => r.status === 422);

    expect(ok.length).toBe(1);
    expect(insufficient.length).toBe(19);

    const senderBal = await getBalance(sender.token);
    const recipientBal = await getBalance(recipient.token);

    expect(senderBal).toBe(4_000);
    expect(recipientBal).toBe(6_000);
  });

  it('handles concurrent bidirectional P2P without deadlock or negative balances', async () => {
    const a = await register('cba');
    const b = await register('cbb');
    await seedCredit(a.walletId, 10_000);
    await seedCredit(b.walletId, 10_000);

    const jobs = [
      ...Array.from({ length: 10 }, () => ({
        token: a.token,
        recipient: b.username,
      })),
      ...Array.from({ length: 10 }, () => ({
        token: b.token,
        recipient: a.username,
      })),
    ];

    const results = await Promise.all(
      jobs.map((job) =>
        api()
          .post('/api/v1/withdrawals')
          .set('Authorization', `Bearer ${job.token}`)
          .set('Idempotency-Key', randomUUID())
          .send({
            destinationType: 'WALLET',
            recipientUsername: job.recipient,
            amount: 6_000,
          })
          .then((res) => ({ status: res.status }))
          .catch((err) => ({
            status: err.status ?? err.response?.status ?? 500,
          })),
      ),
    );

    // No 5xx / unexpected hang — only 2xx or 422
    for (const r of results) {
      expect([200, 201, 422]).toContain(r.status);
    }

    const aBal = await getBalance(a.token);
    const bBal = await getBalance(b.token);

    // Funds can bounce A↔B under locking, so many of the 20 requests may succeed.
    // Safety claims: no deadlock/5xx, never negative, system total conserved.
    expect(aBal).toBeGreaterThanOrEqual(0);
    expect(bBal).toBeGreaterThanOrEqual(0);
    expect(aBal + bBal).toBe(20_000);

    const successes = results.filter((r) => r.status === 200 || r.status === 201);
    expect(successes.length).toBeGreaterThanOrEqual(1);
  });
});
