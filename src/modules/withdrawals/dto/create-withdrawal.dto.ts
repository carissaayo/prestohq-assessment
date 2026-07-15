import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateWithdrawalDto {
  @IsIn(['WALLET', 'BANK'])
  destinationType!: 'WALLET' | 'BANK';

  @ValidateIf((o: CreateWithdrawalDto) => o.destinationType === 'WALLET')
  @IsString()
  @MinLength(3)
  recipientUsername?: string;

  @ValidateIf((o: CreateWithdrawalDto) => o.destinationType === 'BANK')
  @IsString()
  @Matches(/^\d{3}$/, { message: 'bankCode must be 3 digits' })
  bankCode?: string;

  @ValidateIf((o: CreateWithdrawalDto) => o.destinationType === 'BANK')
  @IsString()
  @MinLength(10)
  @MaxLength(10)
  accountNumber?: string;

  @ValidateIf((o: CreateWithdrawalDto) => o.destinationType === 'BANK')
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  accountName?: string;

  /** Amount in kobo. */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5_000_000_000)
  amount!: number;

  @IsOptional()
  @IsString()
  currency?: string;
}
