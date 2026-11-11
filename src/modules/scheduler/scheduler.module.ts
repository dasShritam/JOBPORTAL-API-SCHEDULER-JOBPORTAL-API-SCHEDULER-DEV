import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AbstractSchedulerSvc } from './scheduler.abstract';
import { SchedulerController } from './scheduler.controller';
import { SchedulerService } from './scheduler.service';

@Module({
	imports: [],
	controllers: [SchedulerController],
	providers: [
		{
			provide: AbstractSchedulerSvc,
			useClass: SchedulerService
		},
		JwtService
	]
})
export class SchedulerModule {}
