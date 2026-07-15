import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LoggerModule } from './core/logger/logger.module';
import { QueueModule } from './core/queue/queue.module';
import { SecurityModule } from './core/security/security.module';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { TransfersModule } from './modules/transfers/transfers.module';
import { WalletsModule } from './modules/wallets/wallets.module';
import { WithdrawalsModule } from './modules/withdrawals/withdrawals.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    SecurityModule,
    LoggerModule,
    PrismaModule,
    DatabaseModule,
    QueueModule,
    AuthModule,
    WalletsModule,
    TransfersModule,
    WithdrawalsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
