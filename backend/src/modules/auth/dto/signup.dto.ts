import { IsEmail, IsIn, IsString, Length, Matches, MaxLength } from 'class-validator';
import { NormalizeEmail, Trim } from '../../../common/validation/transforms';
import { SIGNUP_ROLES, SignupRole } from '../../users/schemas/user.schema';

export class SignupDto {
  @Trim()
  @IsString()
  @Length(2, 60, { message: 'Name must be between 2 and 60 characters' })
  name: string;

  @NormalizeEmail()
  @IsEmail({}, { message: 'Enter a valid email address' })
  @MaxLength(254)
  email: string;

  // bcrypt only uses the first 72 bytes of a password, so the upper bound stays well below that.
  @IsString()
  @Length(8, 64, { message: 'Password must be between 8 and 64 characters' })
  @Matches(/[A-Za-z]/, { message: 'Password must contain at least one letter' })
  @Matches(/\d/, { message: 'Password must contain at least one number' })
  password: string;

  @IsIn(SIGNUP_ROLES, { message: 'Role must be mentee or mentor' })
  role: SignupRole;
}
