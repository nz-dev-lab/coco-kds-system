import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:5174',
    ],
    credentials: true,
  });
  
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  //Swagger setup
  if (configService.get<string>('NODE_ENV') === 'development') {
    const SwaggerConfig = new DocumentBuilder()
      .setTitle('Cocoeats KDS API')
      .setDescription('API documentation for the Cocoeats Kitchen Display System (KDS)')
      .setVersion('1.0')
      .addBearerAuth(
        { 
          type: 'http', 
          scheme: 'bearer', 
          bearerFormat: 'JWT', 
          name: 'Authorization', 
          in: 'header' 
        }, 
        'JWT-auth' // This name here is important for matching the security in the controller
      )
      .build();
    const document = SwaggerModule.createDocument(app, SwaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
    console.log(`📖 Swagger docs available at http://localhost:${configService.get<number>('PORT', 3001)}/api/docs`);
  }

  const port = configService.get<number>('PORT', 3001);
  await app.listen(port);
  console.log(`🚀 KDS API running on http://localhost:${port}`);
}
bootstrap();