export type WebhookProviderValue = 'FLUTTERWAVE';
export type WebhookEventStatusValue = 'RECEIVED' | 'PROCESSED' | 'FAILED';

export interface WebhookEventEntity {
  id: string;
  provider: WebhookProviderValue;
  eventType: string;
  providerEventId: string;
  reference: string | null;
  payload: unknown;
  status: WebhookEventStatusValue;
  processedAt: Date | null;
  createdAt: Date;
}

export interface CreateWebhookEventData {
  provider: WebhookProviderValue;
  eventType: string;
  providerEventId: string;
  reference?: string | null;
  payload: unknown;
}

export abstract class WebhookEventRepository {
  abstract findById(id: string): Promise<WebhookEventEntity | null>;
  abstract findByProviderEventId(
    provider: WebhookProviderValue,
    providerEventId: string,
  ): Promise<WebhookEventEntity | null>;
  abstract create(data: CreateWebhookEventData): Promise<WebhookEventEntity>;
  abstract markProcessed(id: string): Promise<WebhookEventEntity>;
  abstract markFailed(id: string): Promise<WebhookEventEntity>;
}
