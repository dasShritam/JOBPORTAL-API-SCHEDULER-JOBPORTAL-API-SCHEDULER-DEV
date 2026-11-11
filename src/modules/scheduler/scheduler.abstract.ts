import { AppResponse } from '@app/shared/appresponse.shared';

export abstract class AbstractSchedulerSvc {
	abstract processFailedEmail(): Promise<AppResponse>;
	abstract sendReminder(): Promise<AppResponse>;
	abstract sendActivateReminder(): Promise<AppResponse>;
	abstract refreshJobs(): Promise<AppResponse>;
	abstract sendNotification(): Promise<AppResponse>;
}
