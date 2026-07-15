import { Injectable } from '@nestjs/common';

import type { ServiceResponseData } from './common/handlers/response-handler';

@Injectable()
export class AppService {
  getHealth(): ServiceResponseData {
    return {
      message: 'Wallet & Payments API is healthy',
      service: 'wallet-api',
      version: '0.1.0',
    };
  }
}
