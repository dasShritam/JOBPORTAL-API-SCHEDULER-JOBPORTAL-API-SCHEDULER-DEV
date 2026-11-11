import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AbstractSchedulerSvc } from './scheduler.abstract';
import { AppResponse } from '@app/shared/appresponse.shared';

@ApiTags('Scheduler')
@Controller('scheduler')
export class SchedulerController {
	constructor(private readonly scheduleSvc: AbstractSchedulerSvc) {}

	@Get('processFailedEmail')
	async processFailedEmail(): Promise<AppResponse> {
		return this.scheduleSvc.processFailedEmail();
	}
	@Get('send-reminder-jobseeker')
	async sendReminder(): Promise<AppResponse> {
		return this.scheduleSvc.sendReminder();
	}
	@Get('activate-account-reminder')
	async sendActivateReminder(): Promise<AppResponse> {
		return this.scheduleSvc.sendActivateReminder();
	}
	@Get('refresh-jobs')
	async refreshJobs(): Promise<AppResponse> {
		return this.scheduleSvc.refreshJobs();
	}
	@Get('notify-job')
	async sendNotification(): Promise<AppResponse> {
		return this.scheduleSvc.sendNotification();
	}
}
