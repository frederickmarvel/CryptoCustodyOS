import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { ApiKey } from '../../api-key/api-key.entity';

export const CurrentApiKey = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): ApiKey => {
    const request = ctx.switchToHttp().getRequest<Request & { apiKey: ApiKey }>();
    return request.apiKey;
  },
);
