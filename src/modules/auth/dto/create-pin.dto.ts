import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreatePinDto {
  @ApiProperty({
    example: '1234',
    description: 'New 4-digit transaction PIN',
    minLength: 4,
    maxLength: 4,
  })
  @IsString()
  @Matches(/^\d{4}$/, { message: 'pin must be exactly 4 digits' })
  pin!: string;

  @ApiProperty({
    example: '1234',
    description: 'Must match pin',
    minLength: 4,
    maxLength: 4,
  })
  @IsString()
  @Matches(/^\d{4}$/, { message: 'confirmPin must be exactly 4 digits' })
  confirmPin!: string;

  @ApiProperty({
    example: 'Password1!',
    description: 'Current account password (required to set the PIN)',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
