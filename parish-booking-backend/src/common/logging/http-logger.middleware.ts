import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

interface AuthedRequest extends Request {
  user?: { sub?: string; role?: string };
}

/**
 * One line per HTTP request, emitted on response finish so the status and
 * duration are known.
 *
 * Deliberately never logs request bodies or headers: they carry passwords
 * (POST /auth/login), bearer tokens and push subscription keys.
 */
@Injectable()
export class HttpLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: AuthedRequest, res: Response, next: NextFunction) {
    const startedAt = Date.now();

    res.on('finish', () => {
      const ms = Date.now() - startedAt;
      const { method, originalUrl } = req;
      const status = res.statusCode;

      // Railway's healthcheck polls /health continuously — logging it at `log`
      // level would bury everything else.
      const isNoise = originalUrl === '/health';

      const parts = [`${method} ${originalUrl} ${status} ${ms}ms`];

      // Who made the call, when the route is authenticated. Only the id — never
      // the token.
      if (req.user?.sub) parts.push(`user=${req.user.sub}`);
      if (req.user?.role) parts.push(`role=${req.user.role}`);

      // Railway tags every edge request with this; logging it lets an app log
      // line be matched against the platform's HTTP logs.
      const requestId = req.headers['x-railway-request-id'];
      if (typeof requestId === 'string') parts.push(`req=${requestId}`);

      const message = parts.join(' ');

      if (status >= 500) this.logger.error(message);
      else if (status >= 400) this.logger.warn(message);
      else if (isNoise) this.logger.debug(message);
      else this.logger.log(message);
    });

    next();
  }
}
