import { IsEmail, IsString, Length, MaxLength } from 'class-validator';
import { NormalizeEmail } from '../../../common/validation/transforms';

export class LoginDto {
  @NormalizeEmail()
  @IsEmail({}, { message: 'Enter a valid email address' })
  @MaxLength(254)
  email: string;

  @IsString()
  @Length(1, 128)
  password: string;
}
