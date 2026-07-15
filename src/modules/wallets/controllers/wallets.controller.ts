import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import {
  CurrentUser,
  type JwtPayloadUser,
} from '../../../core/security/decorators/current-user.decorator';
import { ListWalletTransactionsQueryDto } from '../dto/list-wallet-transactions-query.dto';
import { WalletsService } from '../services/wallets.service';

@ApiTags('wallets')
@ApiBearerAuth('access-token')
@Controller('wallets')
export class WalletsController {
  constructor(private readonly wallets: WalletsService) {}

  @Get('me')
  @ApiOperation({
    summary: 'Current wallet with fresh balance (SUM of successful journal rows)',
  })
  getMe(@CurrentUser() user: JwtPayloadUser) {
    return this.wallets.getMe(user);
  }

  @Get('me/transactions')
  @ApiOperation({ summary: 'List wallet journal transactions (newest first)' })
  listTransactions(
    @CurrentUser() user: JwtPayloadUser,
    @Query() query: ListWalletTransactionsQueryDto,
  ) {
    return this.wallets.listMyTransactions(user, query);
  }
}
