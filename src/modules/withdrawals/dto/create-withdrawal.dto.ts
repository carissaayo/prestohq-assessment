import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  @ApiProperty({ enum: ['WALLET', 'BANK'], example: 'WALLET' })
  @IsIn(['WALLET', 'BANK'])
  destinationType!: 'WALLET' | 'BANK';

  @ApiPropertyOptional({
    description:
      'Required only when destinationType is WALLET. Omit for BANK.',
    example: 'bob_user',
  })
  @IsOptional()
  @ValidateIf((o: CreateWithdrawalDto) => o.destinationType === 'WALLET')
  @IsString()
  @MinLength(3)
  recipientUsername?: string;

  @ApiPropertyOptional({
    description:
      'Required only when destinationType is BANK (3-digit code). Omit for WALLET.',
    example: '058',
  })
  @IsOptional()
  @ValidateIf((o: CreateWithdrawalDto) => o.destinationType === 'BANK')
  @IsString()
  @Matches(/^\d{3}$/, { message: 'bankCode must be 3 digits' })
  bankCode?: string;

  @ApiPropertyOptional({
    description:
      'Required only for BANK (10 digits). Mock: ending 000 fails initiate; 999 fails settle. Omit for WALLET.',
    example: '0123456789',
  })
  @IsOptional()
  @ValidateIf((o: CreateWithdrawalDto) => o.destinationType === 'BANK')
  @IsString()
  @MinLength(10)
  @MaxLength(10)
  accountNumber?: string;

  @ApiPropertyOptional({
    description: 'Required only for BANK. Omit for WALLET.',
    example: 'Ada Okeke',
  })
  @IsOptional()
  @ValidateIf((o: CreateWithdrawalDto) => o.destinationType === 'BANK')
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  accountName?: string;

  @ApiProperty({ description: 'Amount in kobo', example: 5_000, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5_000_000_000)
  amount!: number;

  @ApiPropertyOptional({ example: 'NGN' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({
    description:
      '4-digit transaction PIN (required). Create via POST /auth/pin. Not included in idempotency hash.',
    example: '1234',
    minLength: 4,
    maxLength: 4,
  })
  @IsString()
  @Matches(/^\d{4}$/, { message: 'pin must be exactly 4 digits' })
  pin!: string;
}
