import { AbstractSchedulerDao } from '@app/database/mongo/abstract/scheduler.abstract';
import { AbstractSchedulerSvc } from './scheduler.abstract';
import { AppConfigService } from '@app/config/appconfig.service';
import { DatabaseService } from '@app/database/database.service';
import AppLogger from '@app/core/logger/app-logger';
import { JwtService } from '@nestjs/jwt';
import { AuthMailService } from '@app/core/mail/mail.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { AppResponse, createResponse } from '@app/shared/appresponse.shared';
import { messages } from '@app/shared/messages.shared';
import { SendEmail, SendMailModel } from './models/email.principle.model';
import { ISendMailOptions } from '@nestjs-modules/mailer';
import { EmailLogStatus, Scores } from '@app/core/enums/mail-enums';
import { Types } from 'mongoose';
import { FetchJobseeker, PageDetails } from './models/jobseeker-reminder.model';
import { join } from 'path';
import { readFileSync } from 'fs';
import { BlobServiceClient } from '@azure/storage-blob';
import { compile } from 'handlebars';
import { TimestampValue, RepostFrequency } from '@app/core/enums/reminder.enum';
import { unix_ts_now } from '@app/core/utils/timestamp.utils';
import { stringify } from 'csv-stringify';
import { promisify } from 'util';
import { blobInfo } from './models/blob.principle';

const stringifyAsync: any = promisify(stringify);
@Injectable()
export class SchedulerService implements AbstractSchedulerSvc {
	private readonly scheduleTxn: AbstractSchedulerDao;
	constructor(
		private readonly _appConfigSvc: AppConfigService,
		private _jwtService: JwtService,
		readonly _dbSvc: DatabaseService,
		readonly _loggerSvc: AppLogger,
		private _mailService: AuthMailService
	) {
		this.scheduleTxn = _dbSvc.scheduleTxn;
	}

	async uploadFileToBlob(blobInfo: blobInfo): Promise<AppResponse> {
		try {
			const blobData = this._appConfigSvc.get('blobStorage'),
				connString = blobData.blobAccountConnectionString,
				containerName = blobData.blobEmployerContainer,
				blobServiceClient = BlobServiceClient.fromConnectionString(connString),
				blobContainer = blobServiceClient.getContainerClient(containerName),
				blobDirectory = blobInfo.dirName,
				fileName = blobContainer.getBlockBlobClient(`${blobDirectory}/${blobInfo.fileName}`),
				fileData = Buffer.from(blobInfo.file);

			const contentLength = Buffer.byteLength(blobInfo.file, 'utf8');
			const uploadRes = await fileName.upload(fileData, contentLength);
			if (uploadRes?._response?.status !== HttpStatus.CREATED) {
				return createResponse(HttpStatus.BAD_REQUEST, messages.E8);
			}
			const data = {
				fileName: blobInfo?.fileName,
				url: uploadRes?._response?.request?.url
			};
			return createResponse(HttpStatus.OK, messages.S4, data);
		} catch (error) {
			this._loggerSvc.error(error.stack, HttpStatus.INTERNAL_SERVER_ERROR);
			return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
		}
	}

	async sendEmail(emailInfo: SendMailModel): Promise<AppResponse> {
		try {
			const mailOptions: ISendMailOptions = {
				from: emailInfo.from,
				to: emailInfo.to,
				subject: emailInfo.sub,
				html: emailInfo.body
			};
			if (emailInfo?.cc) mailOptions['cc'] = emailInfo.cc;
			if (emailInfo?.bcc) mailOptions['bcc'] = emailInfo.bcc;
			if (emailInfo?.attachment?.length > 0) mailOptions['attachments'] = emailInfo.attachment;

			await this._mailService.sendEmail(mailOptions);
			return createResponse(HttpStatus.OK, messages.S4);
		} catch (error) {
			this._loggerSvc.error(error.stack, HttpStatus.INTERNAL_SERVER_ERROR);
			return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
		}
	}
	async dailyJobPostResponseReport(jsDetails: any) {
		try {
			const csvData = [['#', 'JOB TITLE', 'CANDIDATE NAME', 'EMAIL', 'PROFILE SCORE', 'MATCH']];
			jsDetails.map((details, index) => {
				const obj: any = {
					idx: index + 1,
					jobTitle: details?.jobTitle ? details?.jobTitle : 'Not Available',
					name: details?.name,
					email: details?.email ? details.email : 'Not Available',
					profileScore: details?.score ? details.score : 'Not Available',
					match: details?.matchType ? details?.matchType : 'Not Available'
				};

				const arr: any = Object.values(obj);

				csvData.push(arr);
			});

			return await stringifyAsync(csvData);
		} catch (error) {
			this._loggerSvc.error(error.stack, HttpStatus.INTERNAL_SERVER_ERROR);
			return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
		}
	}
	async processFailedEmail(): Promise<AppResponse> {
		try {
			const pageLimit = Number(this._appConfigSvc.get('app').pageLimit);
			const maxRetry = Number(this._appConfigSvc.get('mailConfig').maxMailRetry);
			const option = {
				pageLimit: pageLimit,
				maxRetry: maxRetry
			};
			const emailRes = await this.scheduleTxn.fetchAllFailedMail(option);
			if (emailRes.code !== HttpStatus.OK) return emailRes;
			let data = emailRes.data;
			while (data.length > 0) {
				const emailArray: any = [];
				for (let inner = 1; inner <= pageLimit; inner++) {
					const emailData = data[inner - 1];
					if (!emailData) break;
					const emailInfo: SendMailModel = {
						from: emailData.from,
						body: emailData.body,
						sub: emailData.sub
					};
					if (emailData?.to) {
						emailInfo.to = emailData.to;
					}
					if (emailData?.cc) {
						emailInfo.cc = emailData.cc;
					}
					if (emailData?.bcc) {
						emailInfo.bcc = emailData.bcc;
					}
					if (emailData?.atch?.length > 0) {
						const atch = await this.downloadAttachement(emailData?.atch);
						emailInfo.attachment = atch;
					}

					const res = await this.sendEmail(emailInfo);

					if (res.code === HttpStatus.OK) emailData.sts = EmailLogStatus.SENT;
					else emailData.sts = EmailLogStatus.FAILED;

					emailArray.push({
						updateOne: {
							filter: { _id: new Types.ObjectId(emailData._id) },
							update: { $set: { sts: emailData.sts, retry: emailData.retry + 1 } }
						}
					});
				}
				const updateRes = await this.scheduleTxn.updateEmailLog(emailArray);
				if (updateRes.code !== HttpStatus.OK) return updateRes;
				const emailRes = await this.scheduleTxn.fetchAllFailedMail(option);
				if (emailRes.code !== HttpStatus.OK) return emailRes;
				data = emailRes.data;
			}
			return createResponse(HttpStatus.OK, messages.S4);
		} catch (error) {
			this._loggerSvc.error(error.stack, HttpStatus.INTERNAL_SERVER_ERROR);
			return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
		}
	}
	async sendReminderEmail(emailInfo: SendEmail) {
		let resFnRef: AppResponse;
		const emailDetail = await this.scheduleTxn.getEmailDetails();
		const data = emailDetail?.data;
		const addCtus: any = {
			contactUs: data?.contactUs,
			contactEmail: data?.Email
		};
		if (emailInfo?.replacements?.redirectUrl || emailInfo?.replacements?.redirectUrl == '') {
			addCtus.redirectUrl = `${data?.uiUrl}${emailInfo?.replacements?.redirectUrl}`;
		}
		emailInfo.replacements = { ...emailInfo.replacements, ...addCtus };

		const file = join(__dirname, emailInfo.filePath),
			source = readFileSync(file, 'utf-8'),
			template = compile(source),
			replacements = emailInfo.replacements,
			htmlToSend = template(replacements),
			mailDetail: any = {
				from: emailInfo.mailOptions.from ? emailInfo.mailOptions.from : this._appConfigSvc.get('mailConfig').defaults.from.address,
				to: emailInfo?.mailOptions?.to
					? Array.isArray(emailInfo?.mailOptions?.to)
						? emailInfo?.mailOptions?.to.join(',')
						: emailInfo?.mailOptions?.to
					: null,
				cc: emailInfo?.mailOptions?.cc
					? Array.isArray(emailInfo?.mailOptions?.cc)
						? emailInfo?.mailOptions?.cc.join(',')
						: emailInfo?.mailOptions?.cc
					: null,
				bcc: emailInfo?.mailOptions?.bcc
					? Array.isArray(emailInfo?.mailOptions?.bcc)
						? emailInfo?.mailOptions?.bcc.join(',')
						: emailInfo?.mailOptions?.bcc
					: null,
				sub: emailInfo.mailOptions.subject,
				body: htmlToSend,
				atch: emailInfo.replacements.atchUrls ? emailInfo.replacements.atchUrls : [],
				retry: 0
			};

		try {
			const mailOptions: ISendMailOptions = {
				subject: emailInfo.mailOptions.subject,
				html: htmlToSend,
				text: emailInfo.mailOptions.text
			};
			if (emailInfo.mailOptions.to) {
				mailOptions.to = emailInfo.mailOptions.to;
			}
			if (emailInfo.mailOptions.bcc) {
				mailOptions.bcc = emailInfo.mailOptions.bcc;
			}
			if (emailInfo.mailOptions.attachments) {
				mailOptions.attachments = emailInfo.mailOptions.attachments;
			}
			await this._mailService.sendEmail(mailOptions);
			resFnRef = createResponse(HttpStatus.OK, messages.S4);
		} catch (error) {
			this._loggerSvc.error(error.stack, HttpStatus.INTERNAL_SERVER_ERROR);
			resFnRef = createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
		}
		resFnRef.code === HttpStatus.OK ? (mailDetail.sts = EmailLogStatus.SENT) : (mailDetail.sts = EmailLogStatus.FAILED);
		this.logMail(mailDetail);
		return resFnRef;
	}

	async sendReminder(): Promise<AppResponse> {
		try {
			const pageLimit = Number(this._appConfigSvc.get('app').pageLimit);
			const days = Number(this._appConfigSvc.get('app').acActRemindInDay);
			const daysAgoTimestamp = unix_ts_now() - days * TimestampValue.DAY;
			const totalJobseekers = await this.scheduleTxn.findJobseeker(daysAgoTimestamp);
			if (totalJobseekers.code !== 200) return totalJobseekers;
			const limit = Math.ceil(totalJobseekers.data / pageLimit);
			for (let i = 1; i <= limit; i++) {
				const option: FetchJobseeker = {
					pageId: i,
					pageLimit: pageLimit,
					daysAgoTimestamp: daysAgoTimestamp
				};
				const jobSeekerRes = await this.scheduleTxn.fetchJobseeker(option);
				if (jobSeekerRes.code !== HttpStatus.OK) return jobSeekerRes;
				if (jobSeekerRes?.data?.length === 0) break;
				const emailAddress = jobSeekerRes.data
					.filter((obj) => obj.hasOwnProperty('mail'))
					.map((e) => {
						if (e?.mail) {
							return e.mail;
						}
					});

				if (emailAddress.length > 0) {
					const jsMail = emailAddress.join(',');
					const emailInfo: SendEmail = {
						filePath: '../../core/mail/templates/UpdateProfile.html',
						replacements: {},
						mailOptions: {
							bcc: jsMail,
							subject: `${messages.G1.toUpperCase()} | Update Profile`,
							text: 'Update Profile for jobseeker'
						}
					};

					const emailRes = await this.sendReminderEmail(emailInfo);
					if (emailRes.code === HttpStatus.NOT_FOUND) return emailRes;
				}
			}

			return createResponse(HttpStatus.OK, messages.S4);
		} catch (error) {
			this._loggerSvc.error(error.stack, HttpStatus.INTERNAL_SERVER_ERROR);
			return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
		}
	}

	async logMail(logDetail: any): Promise<void> {
		this.scheduleTxn.createLogMail(logDetail);
	}

	async sendActivateReminder(): Promise<AppResponse> {
		try {
			const pageLimit = Number(this._appConfigSvc.get('app').pageLimit);
			const totalUser = await this.scheduleTxn.findNonActivatedAccountCount();
			if (totalUser.code !== 200) return totalUser;
			const limit = Math.ceil(totalUser.data / pageLimit);

			for (let i = 1; i <= limit; i++) {
				const option: PageDetails = {
					pageId: i,
					pageLimit: pageLimit
				};
				const userRes = await this.scheduleTxn.fetchNonActivatedAccountUser(option);
				if (userRes.code !== HttpStatus.OK) return userRes;
				if (userRes?.data?.length == 0) break;
				const emailAddress = userRes.data
					.filter((obj) => obj.hasOwnProperty('mail'))
					.map((e) => {
						if (e?.mail) {
							return e.mail;
						}
					});

				if (emailAddress.length > 0) {
					const jsMail = emailAddress.join(',');
					const emailInfo: SendEmail = {
						filePath: '../../core/mail/templates/ActiveAccount.html',
						replacements: {},
						mailOptions: {
							bcc: jsMail,
							subject: `${messages.G1.toUpperCase()} | ACTIVATE ACCOUNT`,
							text: 'Activate account'
						}
					};

					const emailRes = await this.sendReminderEmail(emailInfo);
					if (emailRes.code === HttpStatus.NOT_FOUND) return emailRes;
				}
			}

			return createResponse(HttpStatus.OK, messages.S4);
		} catch (error) {
			this._loggerSvc.error(error.stack, HttpStatus.INTERNAL_SERVER_ERROR);
			return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
		}
	}

	async downloadAttachement(option: string[]): Promise<any> {
		const attchements = [];
		if (option.length > 0) {
			const length = option?.length;
			const blobCred = this._appConfigSvc.get('blobStorage'),
				connString = blobCred.blobAccountConnectionString;
			for (let e = 0; e < length; e++) {
				const extension = option[e].substring(option[e].lastIndexOf('.') + 1);
				const filename = option[e].substring(option[e].lastIndexOf('/') + 1);
				const segments = option[e].split('/');
				const containerName = segments[3];
				const blobName = option[e].split('/').slice(4).join('/');
				const blobServiceClient = BlobServiceClient.fromConnectionString(connString),
					containerClient = blobServiceClient.getContainerClient(containerName),
					blobClient = containerClient.getBlobClient(blobName);
				try {
					const response = await blobClient.download();
					const readableStream = response.readableStreamBody;
					const buffer = await this.streamToBuffer(readableStream);
					attchements.push({
						filename: filename,
						content: buffer,
						contentType: extension,
						encoding: 'utf-8',
						contentDisposition: 'attachment'
					});
				} catch (error) {
					continue;
				}
			}
		}
		return attchements;
	}

	async streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
		return new Promise((resolve, reject) => {
			const chunks: Buffer[] = [];
			stream.on('data', (chunk: Buffer) => chunks.push(chunk));
			stream.on('end', () => resolve(Buffer.concat(chunks)));
			stream.on('error', (error: Error) => reject(error));
		});
	}

	async refreshJobs(): Promise<AppResponse> {
		try {
			await this.scheduleTxn.updateJobs(RepostFrequency.WEEKLY);
			await this.scheduleTxn.updateJobs(RepostFrequency.FORTNIGHT);
			await this.scheduleTxn.updateJobs(RepostFrequency.MONTH);
			return createResponse(HttpStatus.OK, messages.S4);
		} catch (error) {
			this._loggerSvc.error(error.stack, HttpStatus.INTERNAL_SERVER_ERROR);
			return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
		}
	}

	async sendNotification(): Promise<AppResponse> {
		try {
			const dbRes = await this.scheduleTxn.sendNotification();
			if (dbRes.code !== HttpStatus.OK) return dbRes;
			await Promise.all(
				dbRes.data.map(async (res) => {
					const emailAddress = res?.emp_mail
						?.filter((mail) => mail)
						?.map((mail) => {
							if (mail) {
								return mail;
							}
						});
					const emailList = res?.applicants?.map((data) => ({
						...data,
						matchType:
							data?.score >= Scores.MINIMUM && data?.score < Scores.LOW
								? 'Low Match'
								: data?.score >= Scores.LOW && data?.score < Scores.MEDIUM
								? 'Medium Match'
								: data?.score >= Scores.MEDIUM && data?.score <= Scores.MAXIMUM
								? 'High Match'
								: 'No Match',
						jobTitle: res.title
					}));
					emailList.sort((a, b) => b.score - a.score);
					if (emailAddress?.length > 0) {
						const csvFile = await this.dailyJobPostResponseReport(emailList);
						const empMails = emailAddress.join(',');
						const csvName = `${unix_ts_now()}-daily-job-post-response.csv`;
						const csvInfo: blobInfo = {
							dirName: `${res?.co_id}/job/${res?.jobid}/daily-summary`,
							fileName: csvName,
							file: csvFile
						};
						const csvRes = await this.uploadFileToBlob(csvInfo);
						if (csvRes?.code !== HttpStatus.OK) return csvRes;
						const emailInfo: SendEmail = {
							filePath: '../../core/mail/templates/ApplicantSummary.html',
							replacements: {
								atchUrls: csvRes?.data?.url ? [csvRes?.data?.url] : []
							},
							mailOptions: {
								bcc: empMails,
								subject: `${messages.G1.toUpperCase()} | DAILY JOB POST RESPONSE SUMMARY`,
								text: 'Daily Job post response summary',
								attachments: [
									{
										filename: `daily-job-post-response.csv`,
										content: csvFile,
										contentType: 'text/csv',
										encoding: 'utf-8',
										contentDisposition: 'attachment'
									}
								]
							}
						};

						const emailRes = await this.sendReminderEmail(emailInfo);
						if (emailRes.code === HttpStatus.NOT_FOUND) return emailRes;
					}
				})
			);
			return createResponse(HttpStatus.OK, messages.S4);
		} catch (error) {
			this._loggerSvc.error(error.stack, HttpStatus.INTERNAL_SERVER_ERROR);
			return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
		}
	}
}
