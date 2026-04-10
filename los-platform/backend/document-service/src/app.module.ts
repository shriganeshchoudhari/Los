import { Module } from '@nestjs/common';
import { DocumentModule } from './document.module';

@Module({
  imports: [DocumentModule],
})
export class AppModule {}
