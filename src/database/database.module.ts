import { Module } from '@nestjs/common';

/**
 * Binds abstract repositories to Prisma implementations.
 * Task 1+ will register User/Wallet/… repositories here.
 */
@Module({
  providers: [],
  exports: [],
})
export class DatabaseModule {}
