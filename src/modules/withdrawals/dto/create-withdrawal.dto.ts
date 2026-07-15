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
    description: 'Required when destinationType is WALLET',
    example: 'bob_user',
  })
  @ValidateIf((o: CreateWithdrawalDto) => o.destinationType === 'WALLET')
  @IsString()
  @MinLength(3)
  recipientUsername?: string;

  @ApiPropertyOptional({
    description: 'Required when destinationType is BANK (3-digit code)',
    example: '058',
  })
  @ValidateIf((o: CreateWithdrawalDto) => o.destinationType === 'BANK')
  @IsString()
  @Matches(/^\d{3}$/, { message: 'bankCode must be 3 digits' })
  bankCode?: string;

  @ApiPropertyOptional({
    description:
      'Required for BANK. Mock: ending 000 fails initiate; 999 fails settle.',
    example: '0123456789',
  })
  @ValidateIf((o: CreateWithdrawalDto) => o.destinationType === 'BANK')
  @IsString()
  @MinLength(10)
  @MaxLength(10)
  accountNumber?: string;

  @ApiPropertyOptional({ example: 'Ada Okeke' })
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
}
