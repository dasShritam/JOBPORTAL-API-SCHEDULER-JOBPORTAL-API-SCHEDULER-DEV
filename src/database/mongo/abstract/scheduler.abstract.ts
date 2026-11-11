import { FetchEmail, MailModel } from '@app/modules/scheduler/models/email.principle.model';
import { FetchJobseeker, PageDetails } from '@app/modules/scheduler/models/jobseeker-reminder.model';
import { AppResponse } from '@app/shared/appresponse.shared';

export abstract class AbstractSchedulerDao {
	abstract fetchAllFailedMail(option: FetchEmail): Promise<AppResponse>;
	abstract updateEmailLog(emailArray: any): Promise<AppResponse>;
	abstract findJobseeker(daysAgoTimestamp: number): Promise<AppResponse>;
	abstract fetchJobseeker(option: FetchJobseeker): Promise<AppResponse>;
	abstract getEmailDetails(): Promise<AppResponse>;
	abstract createLogMail(logDetails: MailModel): Promise<void>;
	abstract findNonActivatedAccountCount(): Promise<AppResponse>;
	abstract fetchNonActivatedAccountUser(option: PageDetails): Promise<AppResponse>;
	abstract updateJobs(option: string): Promise<AppResponse>;
	abstract sendNotification(): Promise<AppResponse>;
}
