export class AppConfigService {
	private readonly envConfig: { [key: string]: any } = {};
	constructor() {
		/*App configurations*/
		this.envConfig.app = {
			port: parseInt(process.env.SCHEDULER_SVC_PORT, 10),
			environment: process.env.ENVIRONMENT,
			sa_uri: process.env.STORAGE_ACC_URI,
			pageLimit: process.env.PAGE_LIMIT,
			acActRemindInDay: process.env.ACCOUNT_ACT_REMIND_DAY
		};

		/*Database*/
		this.envConfig.db = {
			mongo: {
				uri: process.env.APP_CONNECTIONSTRING_MONGO
			}
		};

		/*blob configuration*/
		this.envConfig.blobStorage = {
			blobAccountName: process.env.BLOB_AC_NAME,
			blobAccountKey: process.env.BLOB_AC_KEY,
			blobAccountConnectionString: process.env.BLOB_CONNECTION_STRING,
			blobLoggerContainer: process.env.BLOB_LOGGER_CONTAINER,
			blobEmployerContainer: process.env.BLOB_EMPLOYER_CONTAINER
		};

		/*Logger*/
		this.envConfig.logger = {
			logLevel: process.env.LOG_LEVEL
		};

		/*Init mail credentials*/
		this.envConfig.mailConfig = {
			transport: {
				host: process.env.MAIL_SVC_HOST,
				port: parseInt(process.env.MAIL_SVC_PORT, 10),
				auth: {
					user: process.env.MAIL_SVC_USERNAME,
					pass: process.env.MAIL_SVC_PASSWORD
				},
				tls: {
					rejectUnauthorized: false
				}
			},
			defaults: {
				from: {
					name: process.env.MAIL_SVC_FROM_NAME,
					address: process.env.MAIL_SVC_FROM
				}
			},
			maxMailRetry: process.env.MAX_RETRY_LIMIT
		};
		this.envConfig.emailTemplate = {
			contactUs: process.env.EMAIL_TEMP_CONTACT_US,
			Email: process.env.EMAIL_TEMP_EMAIL,
			uiUrl: process.env.UI_URL
		};
	}

	get(key: string): any {
		return this.envConfig[key];
	}
}
