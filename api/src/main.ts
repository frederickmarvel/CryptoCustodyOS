import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('v1', { exclude: ['api/docs', 'api-json', 'health'] });

  const config = new DocumentBuilder()
    .setTitle('Custodian API')
    .setDescription('Crypto custody backend API — Phase 1 skeleton')
    .setVersion('0.1.0')
    .addSecurity('X-API-Key', {
      type: 'apiKey',
      in: 'header',
      name: 'X-API-Key',
    })
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  app.enableShutdownHooks();

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Custodian API running on http://localhost:${port}`);
  console.log(`OpenAPI docs at http://localhost:${port}/api/docs`);
}

bootstrap();
