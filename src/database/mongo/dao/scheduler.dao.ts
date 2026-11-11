import AppLogger from '@app/core/logger/app-logger';
import { AbstractSchedulerDao } from '../abstract/scheduler.abstract';
import { AppConfigService } from '@app/config/appconfig.service';
import { HttpStatus, Inject } from '@nestjs/common';
import { MongoConstants } from '../connection/constants.mongo';
import { Model } from 'mongoose';
import { AppResponse, createResponse } from '@app/shared/appresponse.shared';
import { messages } from '@app/shared/messages.shared';
import { EmailLogStatus, NotifyFrequency } from '@app/core/enums/mail-enums';
import { FetchEmail, MailModel } from '@app/modules/scheduler/models/email.principle.model';
import { FetchJobseeker, PageDetails } from '@app/modules/scheduler/models/jobseeker-reminder.model';
import { MASTER_SCHEMA_GROUP } from '../schemas';
import { RegMode } from '@app/core/enums/reg-mode.enum';
import { unix_ts_now, unix_ts_now_notime } from '@app/core/utils/timestamp.utils';
import { TimestampValue, RepostFrequency } from '@app/core/enums/reminder.enum';
import { JobPostStatus } from '@app/core/enums/job-post-status.enum';

export class AuthDao implements AbstractSchedulerDao {
	constructor(
		readonly _loggerSvc: AppLogger,
		private readonly _appConfigSvc: AppConfigService,
		@Inject(MongoConstants.LOG_MAIL_SCHEMA) private readonly _logMailSchema: Model<any>,
		@Inject(MongoConstants.JOBSEEKER_PROFILE_SCHEMA) private readonly _JSProfileSchema: Model<any>,
		@Inject(MongoConstants.GENERIC_SCHEMA) private readonly _genericSchema: Model<any>,
		@Inject(MongoConstants.USER_ACCOUNT_SCHEMA) private readonly _accountSchema: Model<any>,
		@Inject(MongoConstants.JOB_POST_SCHEMA) private readonly _jobPostSchema: Model<any>,
		@Inject(MongoConstants.JOB_POST_RESPONSE_SCHEMA) private readonly _jobPostResponseSchema: Model<any>
	) {}

	async fetchAllFailedMail(option: FetchEmail): Promise<AppResponse> {
		try {
			const res = await this._logMailSchema
				.aggregate([{ $match: { retry: { $lt: option.maxRetry }, sts: EmailLogStatus.FAILED } }])
				.limit(option.pageLimit);
			if (res.length > 0) {
				const emailLogRefId = res.map((e) => e._id);
				await this._logMailSchema.updateMany(
					{
						_id: {
							$in: [...emailLogRefId]
						}
					},
					{
						$set: {
							sts: EmailLogStatus.QUEUED
						}
					}
				);
			}
			return createResponse(HttpStatus.OK, messages.S4, res);
		} catch (error) {
			this._loggerSvc.error(error.stack, HttpStatus.INTERNAL_SERVER_ERROR);
			return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
		}
	}

	async updateEmailLog(emailArray: any): Promise<AppResponse> {
		try {
			await this._logMailSchema.bulkWrite(emailArray);
			return createResponse(HttpStatus.OK, messages.S4);
		} catch (error) {
			this._loggerSvc.error(error.stack, HttpStatus.INTERNAL_SERVER_ERROR);
			return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
		}
	}

	async findJobseeker(daysAgoTimestamp: number): Promise<AppResponse> {
		try {
			const totalCount = await this._JSProfileSchema.countDocuments({ 'cp.cv.updated_at': { $lte: daysAgoTimestamp } });
			if (!totalCount) return createResponse(HttpStatus.PARTIAL_CONTENT, messages.W1);
			return createResponse(HttpStatus.OK, messages.S4, totalCount);
		} catch (error) {
			this._loggerSvc.error(error.stack, HttpStatus.INTERNAL_SERVER_ERROR);
			return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
		}
	}
	async fetchJobseeker(option: FetchJobseeker): Promise<AppResponse> {
		try {
			const res = await this._JSProfileSchema
				.aggregate([
					{ $match: { 'cp.cv.updated_at': { $lte: option.daysAgoTimestamp } } },
					{
						$lookup: {
							from: 'SecurityUserAccounts',
							localField: 'user_id',
							foreignField: '_id',
							as: 'userInfo'
						}
					},
					{
						$unwind: {
							path: '$userInfo'
						}
					},
					{
						$project: {
							_id: 0,
							mail: '$userInfo.ci.prim.mail.val'
						}
					}
				])
				.skip(option.pageLimit * (option.pageId - 1))
				.limit(option.pageLimit);
			return createResponse(HttpStatus.OK, messages.S4, res);
		} catch (error) {
			this._loggerSvc.error(error.stack, HttpStatus.INTERNAL_SERVER_ERROR);
			return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
		}
	}
	async getEmailDetails(): Promise<AppResponse> {
		try {
			const dbRes = await this._genericSchema.aggregate([
				{
					$match: {
						grp: MASTER_SCHEMA_GROUP.CTUS
					}
				},
				{
					$project: {
						_id: 0,
						e_details: '$name'
					}
				}
			]);

			let data = JSON.parse(dbRes[0]?.e_details);
			let mails = data?.mail?.secd?.length > 0 ? `${data.mail.prim} | ${data.mail.secd.join(' | ')}` : data.mail.prim;
			let phone = data?.ph?.secd?.length > 0 ? `${data.ph.prim} | ${data.ph.secd.join(' | ')}` : data.ph.prim;
			let uri = this._appConfigSvc.get('emailTemplate').uiUrl;
			let emailData = {
				contactUs: phone,
				Email: mails,
				uiUrl: uri
			};
			return createResponse(HttpStatus.OK, messages.S4, emailData);
		} catch (error) {
			this._loggerSvc.error(error.stack, HttpStatus.INTERNAL_SERVER_ERROR);
			return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
		}
	}
	async createLogMail(logDetails: MailModel): Promise<void> {
		try {
			await this._logMailSchema.create({
				from: logDetails.from,
				to: logDetails.to,
				cc: logDetails?.cc ? logDetails.cc : null,
				bcc: logDetails?.bcc ? logDetails.bcc : null,
				sub: logDetails.sub,
				body: logDetails.body,
				atch: logDetails?.atch ? logDetails?.atch : null,
				sts: logDetails.sts,
				retry: logDetails.retry
			});
		} catch (error) {
			this._loggerSvc.error(error.stack, HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}

	async findNonActivatedAccountCount(): Promise<AppResponse> {
		try {
			const totalCount = await this._accountSchema.countDocuments({ reg_mode: RegMode.CREDENTIALS, pwd: { $in: [[], null] } });
			if (!totalCount) return createResponse(HttpStatus.PARTIAL_CONTENT, messages.W1);
			return createResponse(HttpStatus.OK, messages.S4, totalCount);
		} catch (error) {
			this._loggerSvc.error(error.stack, HttpStatus.INTERNAL_SERVER_ERROR);
			return createResponse(HttpStatus.NOT_FOUND, messages.E2);
		}
	}
	async fetchNonActivatedAccountUser(option: PageDetails): Promise<AppResponse> {
		try {
			const res = await this._accountSchema
				.aggregate([
					{ $match: { reg_mode: RegMode.CREDENTIALS, pwd: { $in: [[], null] } } },
					{
						$project: {
							_id: 0,
							mail: '$ci.prim.mail.val'
						}
					}
				])
				.skip(option.pageLimit * (option.pageId - 1))
				.limit(option.pageLimit);
			return createResponse(HttpStatus.OK, messages.S4, res);
		} catch (error) {
			this._loggerSvc.error(error.stack, HttpStatus.INTERNAL_SERVER_ERROR);
			return createResponse(HttpStatus.NOT_FOUND, messages.E2);
		}
	}
	async updateJobs(option: string): Promise<AppResponse> {
		try {
			let days = 0;
			switch (option) {
				case RepostFrequency.WEEKLY:
					days = unix_ts_now() - TimestampValue.WEEK;
					break;
				case RepostFrequency.FORTNIGHT:
					days = unix_ts_now() - TimestampValue.FORTNIGHT;
					break;
				case RepostFrequency.MONTH:
					days = unix_ts_now() - TimestampValue.MONTH;
					break;
				default:
					break;
			}
			const query = {
				created_at: { $lte: days },
				'repost.freq': option,
				'repost.start_ts': { $lte: unix_ts_now() },
				'repost.end_ts': { $gte: unix_ts_now() },
				'status.val': JobPostStatus.PUBLISH
			};
			const update = { $set: { created_at: unix_ts_now() } };
			await this._jobPostSchema.updateMany(query, update);
			return createResponse(HttpStatus.OK, messages.S4);
		} catch (error) {
			this._loggerSvc.error(error.stack, HttpStatus.INTERNAL_SERVER_ERROR);
			return createResponse(HttpStatus.NOT_FOUND, messages.E2);
		}
	}
	async sendNotification(): Promise<AppResponse> {
		try {
			const jobs = await this._jobPostSchema.aggregate([
				{
					$match: {
						'notify.freq': NotifyFrequency.DAILY_SUMMARY
					}
				},
				{
					$lookup: {
						from: 'RecruitJobPostApplications',
						localField: '_id',
						foreignField: 'jobid',
						as: 'jobResponses'
					}
				},
				{
					$unwind: {
						path: '$jobResponses'
					}
				},

				{
					$match: {
						'jobResponses.created_at': {
							$gte: unix_ts_now_notime(),
							$lt: unix_ts_now_notime() + TimestampValue.DAY
						}
					}
				},

				{
					$lookup: {
						from: 'SecurityUserAccounts',
						localField: 'jobResponses.user_id',
						foreignField: '_id',
						as: 'userInfo'
					}
				},
				{
					$unwind: {
						path: '$userInfo'
					}
				},
				{
					$group: {
						_id: '$_id',
						title: { $first: '$title' },
						emp_mail: { $first: '$notify.mail' },
						co_id: { $first: '$co_id' },
						applicants: {
							$push: {
								name: '$userInfo.name',
								email: '$userInfo.ci.prim.mail.val',
								score: '$jobResponses.srs.ttl'
							}
						}
					}
				},
				{
					$project: {
						_id: 0,
						jobid: '$_id',
						title: 1,
						emp_mail: 1,
						applicants: 1,
						co_id: 1
					}
				}
			]);
			if (jobs.length == 0) {
				return createResponse(HttpStatus.PARTIAL_CONTENT, messages.W3);
			}

			return createResponse(HttpStatus.OK, messages.S4, jobs);
		} catch (error) {
			this._loggerSvc.error(error.stack, HttpStatus.INTERNAL_SERVER_ERROR);
			return createResponse(HttpStatus.NOT_FOUND, messages.E2);
		}
	}
}
