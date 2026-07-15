import { Type } from 'class-transformer';
import {
  Equals,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateWithdrawalDto {
  @Equals('WALLET', {
    message: 'Only destinationType WALLET is supported in this release',
  })
  destinationType!: 'WALLET';

  @ValidateIf((o: CreateWithdrawalDto) => o.destinationType === 'WALLET')
  @IsString()
  @MinLength(3)
  recipientUsername!: string;

  /** Amount in kobo. */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50_000_000_00)
  amount!: number;

  @IsOptional()
  @IsString()
  currency?: string;
}
