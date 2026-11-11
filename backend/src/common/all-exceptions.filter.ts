import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';

/**
 * Single error envelope for every failure:
 * { error: { code, message, details? }, requestId? }
 * Clients can branch on `code` without parsing prose.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const reply = host.switchToHttp().getResponse<FastifyReply>();
    const request = host.switchToHttp().getRequest<{ id?: string; url?: string }>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const normalized =
        typeof payload === 'string'
          ? { code: fallbackCode(status), message: payload }
          : (payload as Record<string, unknown>);

      void reply.status(status).send({
        error: {
          code: (normalized.code as string | undefined) ?? fallbackCode(status),
          message: (normalized.message as string | undefined) ?? exception.message,
          ...(normalized.details ? { details: normalized.details } : {}),
        },
        requestId: request.id,
      });
      return;
    }

    const error = exception instanceof Error ? exception : new Error(String(exception));
    this.logger.error(`${request.url ?? ''} ${error.message}`, error.stack);

    void reply.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
      requestId: request.id,
    });
  }
}

function fallbackCode(status: number): string {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return 'BAD_REQUEST';
    case HttpStatus.UNAUTHORIZED:
      return 'UNAUTHORIZED';
    case HttpStatus.FORBIDDEN:
      return 'FORBIDDEN';
    case HttpStatus.NOT_FOUND:
      return 'NOT_FOUND';
    case HttpStatus.CONFLICT:
      return 'CONFLICT';
    case HttpStatus.GONE:
      return 'GONE';
    case HttpStatus.TOO_MANY_REQUESTS:
      return 'RATE_LIMITED';
    default:
      return status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_FAILED';
  }
}
