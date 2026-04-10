import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, ip, headers } = request;
    const userAgent = headers['user-agent'] || '';
    const requestId = (headers['x-request-id'] as string) || uuidv4();

    request.startTime = Date.now();
    request.requestId = requestId;

    const now = Date.now();

    this.logger.log(
      `[${requestId}] ${method} ${url} - Started`,
      { userAgent, ip, requestId }
    );

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          const duration = Date.now() - now;
          this.logger.log(
            `[${requestId}] ${method} ${url} - ${response.statusCode} (${duration}ms)`,
            { statusCode: response.statusCode, duration, requestId }
          );
        },
        error: (error) => {
          const duration = Date.now() - now;
          this.logger.error(
            `[${requestId}] ${method} ${url} - Error (${duration}ms)`,
            { error: error.message, duration, requestId }
          );
        },
      })
    );
  }
}
