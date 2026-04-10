import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission } from './permissions';

export const SCOPES_KEY = 'scopes';

export const RequireScopes = (...scopes: Permission[]) => {
  return (target: any, key?: string | symbol, descriptor?: PropertyDescriptor) => {
    if (descriptor) {
      Reflect.defineMetadata(SCOPES_KEY, scopes, descriptor.value);
    } else {
      Reflect.defineMetadata(SCOPES_KEY, scopes, target);
    }
  };
};

@Injectable()
export class ScopesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredScopes = this.reflector.getAllAndOverride<Permission[]>(SCOPES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredScopes || requiredScopes.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }

    const userScopes: string[] = user.scope || [];

    const hasAllScopes = requiredScopes.every((scope) =>
      userScopes.includes(scope),
    );

    if (!hasAllScopes) {
      throw new ForbiddenException(
        `Access denied. Missing scopes: ${requiredScopes
          .filter((s) => !userScopes.includes(s))
          .join(', ')}`,
      );
    }

    return true;
  }
}
