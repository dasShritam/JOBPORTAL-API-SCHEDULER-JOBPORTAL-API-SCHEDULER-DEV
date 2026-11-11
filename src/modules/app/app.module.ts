import { CoreModule } from '@app/core/core.module';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SchedulerModule } from '../scheduler/scheduler.module';

@Module({
	imports: [CoreModule, SchedulerModule],
	controllers: [AppController],
	providers: [AppService]
})
export class AppModule {}
