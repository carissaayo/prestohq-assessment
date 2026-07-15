import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { buildRedisConnectionSettings } from '../redis/redis-connection.util';
import {
  TRANSFER_COMPLETE_QUEUE,
  WITHDRAWAL_PAYOUT_QUEUE,
  WITHDRAWAL_SETTLE_QUEUE,
} from './queue.constants';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const keyPrefix = config.get<string>('redis.keyPrefix') ?? 'wallet-api:';
        const settings = buildRedisConnectionSettings({
          url: config.get<string>('redis.url'),
          host: config.get<string>('redis.host'),
          port: config.get<number>('redis.port'),
          password: config.get<string>('redis.password'),
          maxRetriesPerRequest: null,
          lazyConnect: false,
          commandTimeout: null,
        });

        return {
          connection: settings.url
            ? { url: settings.url, ...settings.options }
            : settings.options,
          prefix: `${keyPrefix}bull:`,
        };
      },
    }),
    BullModule.registerQueue(
      { name: TRANSFER_COMPLETE_QUEUE },
      { name: WITHDRAWAL_PAYOUT_QUEUE },
      { name: WITHDRAWAL_SETTLE_QUEUE },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
