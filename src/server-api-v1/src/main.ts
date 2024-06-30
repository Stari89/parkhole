import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    app.enableCors({ origin: true });
    const configService = app.get(ConfigService);
    const appPort = configService.get<string>('APP_PORT');
    const config = new DocumentBuilder()
        .setTitle('Parkhole API')
        .setDescription('server-api-v1')
        .setVersion('0.0.1')
        .addBearerAuth()
        .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);

    await app.listen(parseInt(appPort || '3000', 10));
}
bootstrap();
