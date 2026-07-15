import { Global, Module } from '@nestjs/common';

import { PrismaService } from './prisma.service';

/**
 * Raw Prisma client module. Feature services must inject abstract
 * repositories from `database/`, not PrismaService directly.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
