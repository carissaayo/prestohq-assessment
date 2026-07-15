import { Injectable } from '@nestjs/common';
import type { Prisma, WebhookEvent as PrismaWebhook } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateWebhookEventData,
  WebhookEventEntity,
  WebhookEventRepository,
  WebhookEventStatusValue,
  WebhookProviderValue,
} from '../repositories/webhook-event.repository';

@Injectable()
export class PrismaWebhookEventRepository extends WebhookEventRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findById(id: string): Promise<WebhookEventEntity | null> {
    const row = await this.prisma.webhookEvent.findUnique({ where: { id } });
    return row ? this.toEntity(row) : null;
  }

  async findByProviderEventId(
    provider: WebhookProviderValue,
    providerEventId: string,
  ): Promise<WebhookEventEntity | null> {
    const row = await this.prisma.webhookEvent.findUnique({
      where: {
        provider_providerEventId: { provider, providerEventId },
      },
    });
    return row ? this.toEntity(row) : null;
  }

  async create(data: CreateWebhookEventData): Promise<WebhookEventEntity> {
    const row = await this.prisma.webhookEvent.create({
      data: {
        provider: data.provider,
        eventType: data.eventType,
        providerEventId: data.providerEventId,
        reference: data.reference ?? null,
        payload: data.payload as Prisma.InputJsonValue,
      },
    });
    return this.toEntity(row);
  }

  async markProcessed(id: string): Promise<WebhookEventEntity> {
    const row = await this.prisma.webhookEvent.update({
      where: { id },
      data: { status: 'PROCESSED', processedAt: new Date() },
    });
    return this.toEntity(row);
  }

  async markFailed(id: string): Promise<WebhookEventEntity> {
    const row = await this.prisma.webhookEvent.update({
      where: { id },
      data: { status: 'FAILED', processedAt: new Date() },
    });
    return this.toEntity(row);
  }

  private toEntity(row: PrismaWebhook): WebhookEventEntity {
    return {
      id: row.id,
      provider: row.provider as WebhookProviderValue,
      eventType: row.eventType,
      providerEventId: row.providerEventId,
      reference: row.reference,
      payload: row.payload,
      status: row.status as WebhookEventStatusValue,
      processedAt: row.processedAt,
      createdAt: row.createdAt,
    };
  }
}
