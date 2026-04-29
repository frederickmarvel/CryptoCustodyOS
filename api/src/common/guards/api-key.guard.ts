import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ApiKeyService } from '../../api-key/api-key.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly apiKeyService: ApiKeyService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const rawKey = request.headers['x-api-key'] as string;

    if (!rawKey) {
      throw new UnauthorizedException('Missing X-API-Key header');
    }

    const apiKey = await this.apiKeyService.validate(rawKey);
    if (!apiKey) {
      throw new UnauthorizedException('Invalid or expired API key');
    }

    (request as Request & { apiKey: typeof apiKey }).apiKey = apiKey;
    return true;
  }
}
