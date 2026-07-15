import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateTransferDto {
  /** Amount in kobo (integer minor units). */
  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(50_000_000_00)
  amount!: number;

  @IsOptional()
  @IsString()
  currency?: string;
}
