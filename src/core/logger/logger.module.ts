import { Global, Module } from '@nestjs/common';

import { AppLogger } from './index';

@Global()
@Module({
  providers: [AppLogger],
  exports: [AppLogger],
})
export class LoggerModule {}
