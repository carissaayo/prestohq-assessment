import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

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
}
