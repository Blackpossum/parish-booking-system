import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * Catches everything that escapes a handler so nothing fails silently.
 *
 * Before this, an unexpected throw surfaced as a bare 500 with no stack in the
 * logs, which made production failures near-impossible to diagnose from
 * Railway's log view alone.
 *
 * Expected failures (4xx — validation, 401, the 409 double-booking conflict)
 * are logged at `warn` without a stack, since they are normal traffic. Only
 * genuine 5xx get a stack trace.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    // Preserve Nest's shape for HttpExceptions (ValidationPipe returns an array
    // of messages, and the frontend already renders those).
    const body = isHttp
      ? exception.getResponse()
      : { statusCode: status, message: 'Internal server error' };

    const where = `${req.method} ${req.originalUrl}`;

    if (status >= 500) {
      const stack = exception instanceof Error ? exception.stack : String(exception);
      this.logger.error(`${where} -> ${status}`, stack);
    } else {
      const detail =
        typeof body === 'object' && body !== null && 'message' in body
          ? JSON.stringify((body as { message: unknown }).message)
          : String(body);
      this.logger.warn(`${where} -> ${status} ${detail}`);
    }

    res.status(status).json(body);
  }
}
