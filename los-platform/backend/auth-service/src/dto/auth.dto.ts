import { IsNotEmpty, IsString, Matches, MinLength, MaxLength, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OtpPurpose } from '../../entities/otp-session.entity';

export class SendOtpDto {
  @ApiProperty({ example: '9876543210', description: '10-digit Indian mobile number' })
  @IsNotEmpty()
  @IsString()
  @Matches(/^[6-9]\d{9}$/, { message: 'Invalid mobile number format' })
  mobile: string;

  @ApiProperty({ 
    enum: ['LOGIN', 'AADHAAR_CONSENT', 'LOAN_APPLICATION_SUBMIT', 'DISBURSEMENT_CONFIRM', 'PASSWORD_RESET'],
    example: 'LOGIN'
  })
  @IsNotEmpty()
  @IsEnum(OtpPurpose)
  purpose: OtpPurpose;

  @ApiProperty({ enum: ['SMS', 'WHATSAPP'], default: 'SMS', description: 'Delivery channel' })
  @IsOptional()
  @IsEnum(['SMS', 'WHATSAPP'])
  channel?: 'SMS' | 'WHATSAPP' = 'SMS';
}

export class VerifyOtpDto {
  @ApiProperty({ example: '9876543210' })
  @IsNotEmpty()
  @IsString()
  @Matches(/^[6-9]\d{9}$/)
  mobile: string;

  @ApiProperty({ example: '482931', description: '6-digit OTP' })
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  otp: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsNotEmpty()
  @IsString()
  sessionId: string;

  @ApiPropertyOptional({ description: 'Device fingerprint for session binding' })
  @IsOptional()
  @IsString()
  deviceFingerprint?: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  refreshToken: string;
}

export class RevokeTokenDto {
  @ApiProperty({ description: 'Access token or JTI to revoke' })
  @IsNotEmpty()
  @IsString()
  tokenOrJti: string;

  @ApiPropertyOptional({ description: 'Reason for revocation' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class RevokeAllSessionsDto {
  @ApiProperty({ description: 'User ID to revoke all sessions for' })
  @IsNotEmpty()
  @IsString()
  userId: string;

  @ApiPropertyOptional({ description: 'Session ID to keep active' })
  @IsOptional()
  @IsString()
  exceptSessionId?: string;
}

export class LoginResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType: string;

  @ApiProperty({ example: 900 })
  expiresIn: number;

  @ApiProperty({ example: ['application:read', 'application:write'] })
  scope: string[];
}

export class SendOtpResponseDto {
  @ApiProperty()
  sessionId: string;

  @ApiProperty({ example: 300 })
  expiresIn: number;

  @ApiProperty({ example: 'XXXXXX3210' })
  maskedMobile: string;
}

export class LdapLoginDto {
  @ApiProperty({ example: 'jsmith', description: 'LDAP username (sAMAccountName)' })
  @IsNotEmpty()
  @IsString()
  username: string;

  @ApiProperty({ example: 'SecurePassword123' })
  @IsNotEmpty()
  @IsString()
  password: string;

  @ApiPropertyOptional({ description: 'Device fingerprint for session binding' })
  @IsOptional()
  @IsString()
  deviceFingerprint?: string;
}
