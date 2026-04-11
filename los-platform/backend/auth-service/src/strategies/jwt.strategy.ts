import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import * as crypto from 'crypto';
import { JwtUser } from '@los/common';

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const padded = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), '=');
    return JSON.parse(Buffer.from(padded, 'base64url').toString('utf-8'));
  } catch {
    return null;
  }
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly publicKey: crypto.KeyObject;

  constructor(private configService: ConfigService) {
    const publicKeyPem = configService.get<string>('JWT_PUBLIC_KEY');
    if (!publicKeyPem) {
      throw new Error('JWT_PUBLIC_KEY is not configured. Set JWT_PUBLIC_KEY env var.');
    }
    this.publicKey = crypto.createPublicKey(publicKeyPem);

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: publicKeyPem,
      algorithms: ['RS256'],
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtUser) {
    if (!payload.sub || !payload.role) {
      throw new UnauthorizedException('Invalid token payload');
    }

    return {
      id: payload.sub,
      role: payload.role,
      branchCode: payload.branchCode,
      sessionId: payload.sessionId,
      scope: payload.scope || [],
      jti: payload.jti,
    };
  }
}
