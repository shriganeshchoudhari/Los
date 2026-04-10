import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { LOSException } from '../exceptions/los.exception';

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: string;
    field?: string;
    retryable: boolean;
    retryAfterSeconds?: number;
  };
  meta: {
    requestId: string;
    timestamp: string;
    version: string;
    processingTimeMs: number;
  };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);
  private readonly apiVersion = 'v1';

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId = (request.headers['x-request-id'] as string) || uuidv4();
    const startTime = (request as any).startTime || Date.now();
    const processingTimeMs = Date.now() - startTime;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorResponse: ApiErrorResponse;

    if (exception instanceof LOSException) {
      status = exception.httpStatus;
      errorResponse = {
        success: false,
        error: {
          code: exception.code,
          message: exception.message,
          details: exception.details,
          field: exception.field,
          retryable: exception.retryable,
          retryAfterSeconds: exception.retryAfterSeconds,
        },
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
          version: this.apiVersion,
          processingTimeMs,
        },
      };
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as Record<string, any>;
        errorResponse = {
          success: false,
          error: {
            code: `HTTP_${status}`,
            message: resp.message || exception.message,
            details: resp.error,
            retryable: false,
          },
          meta: {
            requestId,
            timestamp: new Date().toISOString(),
            version: this.apiVersion,
            processingTimeMs,
          },
        };
      } else {
        errorResponse = {
          success: false,
          error: {
            code: `HTTP_${status}`,
            message: String(exceptionResponse),
            retryable: false,
          },
          meta: {
            requestId,
            timestamp: new Date().toISOString(),
            version: this.apiVersion,
            processingTimeMs,
          },
        };
      }
    } else if (exception instanceof Error) {
      this.logger.error(
        `Unhandled exception: ${exception.message}`,
        exception.stack,
        { requestId, path: request.url },
      );

      errorResponse = {
        success: false,
        error: {
          code: 'GEN_001',
          message: 'Internal server error',
          retryable: false,
        },
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
          version: this.apiVersion,
          processingTimeMs,
        },
      };
    } else {
      this.logger.error('Unknown exception type', { requestId, exception });
      errorResponse = {
        success: false,
        error: {
          code: 'GEN_001',
          message: 'Internal server error',
          retryable: false,
        },
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
          version: this.apiVersion,
          processingTimeMs,
        },
      };
    }

    response.setHeader('X-Request-ID', requestId);
    response.status(status).json(errorResponse);
  }
}
