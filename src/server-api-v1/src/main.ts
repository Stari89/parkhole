import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    app.enableCors({ origin: true });
    const configService = app.get(ConfigService);
    const appPort = configService.get<string>('APP_PORT');
    await app.listen(parseInt(appPort || '3000', 10));
}
bootstrap();
