import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export class CreateTransferDto {
  @ApiProperty({
    description: 'Amount in kobo (integer minor units)',
    example: 10_000,
    minimum: 100,
  })
  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(50_000_000_00)
  amount!: number;

  @ApiPropertyOptional({ example: 'NGN', default: 'NGN' })
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
