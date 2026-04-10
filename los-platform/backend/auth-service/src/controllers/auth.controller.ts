import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  Logger,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeaders } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from '../services/auth.service';
import {
  SendOtpDto,
  VerifyOtpDto,
  RefreshTokenDto,
  SendOtpResponseDto,
  LoginResponseDto,
  RevokeTokenDto,
  RevokeAllSessionsDto,
  LdapLoginDto,
} from '../dto';
import { Public, createError } from '@los/common';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('otp/send')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send OTP to mobile number' })
  @ApiResponse({ status: 200, description: 'OTP sent successfully', type: SendOtpResponseDto })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async sendOtp(
    @Body() dto: SendOtpDto,
    @Req() req: Request,
  ): Promise<SendOtpResponseDto> {
    const ipAddress = this.getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';

    this.logger.log(`OTP send request for ${dto.mobile} from ${ipAddress}`);

    return this.authService.sendOtp(dto, ipAddress, userAgent);
  }

  @Public()
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify OTP and receive JWT tokens' })
  @ApiResponse({ status: 200, description: 'Authentication successful', type: LoginResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid or expired OTP' })
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Req() req: Request,
  ): Promise<LoginResponseDto> {
    const ipAddress = this.getClientIp(req);

    this.logger.log(`OTP verify request for session ${dto.sessionId}`);

    return this.authService.verifyOtp(dto, ipAddress);
  }

  @Public()
  @Post('ldap/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bank staff LDAP/AD login (branch manager, loan officer, credit analyst)' })
  @ApiResponse({ status: 200, description: 'Authentication successful', type: LoginResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async ldapLogin(@Body() dto: LdapLoginDto): Promise<LoginResponseDto> {
    this.logger.log(`LDAP login attempt for user: ${dto.username}`);
    return this.authService.ldapLogin(dto.username, dto.password, dto.deviceFingerprint);
  }

  @Public()
  @Post('token/refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiResponse({ status: 200, description: 'Tokens refreshed', type: LoginResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refreshToken(@Body() dto: RefreshTokenDto): Promise<LoginResponseDto> {
    return this.authService.refreshToken(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Logout and revoke all sessions' })
  @ApiHeaders([
    { name: 'Authorization', description: 'Bearer token', required: true },
  ])
  @ApiResponse({ status: 204, description: 'Logged out successfully' })
  async logout(@Req() req: Request): Promise<void> {
    const user = req.user as any;
    const sessionId = user?.sessionId;

    await this.authService.logout(user?.sub, sessionId);
  }

  @Post('revoke')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a specific token (access token or JTI)' })
  @ApiResponse({ status: 200, description: 'Token revoked' })
  async revokeToken(@Body() dto: RevokeTokenDto): Promise<{ success: boolean }> {
    await this.authService.revokeToken(dto.tokenOrJti, dto.reason || 'User requested revocation');
    return { success: true };
  }

  @Post('sessions/revoke-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke all sessions for a user (admin)' })
  @ApiResponse({ status: 200, description: 'Sessions revoked', schema: { properties: { revokedCount: { type: 'number' } } } })
  async revokeAllSessions(@Body() dto: RevokeAllSessionsDto): Promise<{ revokedCount: number }> {
    const count = await this.authService.revokeAllUserSessions(dto.userId, dto.exceptSessionId);
    return { revokedCount: count };
  }

  private getClientIp(req: Request): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      req.socket.remoteAddress ||
      'unknown'
    );
  }
}
