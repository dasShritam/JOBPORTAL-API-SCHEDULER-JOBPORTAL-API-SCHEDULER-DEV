import { ISendMailOptions } from '@nestjs-modules/mailer';

export interface SendMailModel {
	from: string;
	to?: string;
	body: any;
	cc?: string;
	bcc?: string;
	sub: string;
	attachment?: any[];
}
export interface FetchEmail {
	pageLimit: number;
	maxRetry: number;
}
export interface SendEmail {
	readonly filePath: string;
	replacements: any;
	readonly mailOptions: ISendMailOptions;
}
export interface MailModel {
	from: string;
	to: string;
	cc?: string;
	bcc?: string;
	sub: string;
	body: string;
	atch?: string[];
	sts: string;
	retry: number;
}
