export function messageFactory(message: string, msgParams?: string[]): string {
	if (msgParams) {
		msgParams.forEach((val, key) => {
			message = message.split(`ARG${key}`).join(val?.toString());
		});
	}
	return message;
}

export const enum messages {
	//ARG0,ARG1 ... ARGn should be in sequence.
	//Genaral messages : Start with Gn
	G1 = 'Captive jobs',
	G2 = 'Alchemy',
	G3 = 'SCHEDULER API DOCUMENTATION',
	G4 = 'Scheduler API',
	//Success messages : Start with Sn
	S1 = `ARG0 scheduler service is up and running`,
	S2 = 'Connected to mongo db!',
	S3 = `ARG0 scheduler service is listening on ARG1`,
	S4 = 'Success',
	//Warning messages : Start with Wn
	W1 = 'No jobseeker found.',
	W2 = 'No members found',
	W3 = 'No record found ',
	//Error messages : Start with En
	E1 = `ARG0 scheduler service start failed! :: ARG1`,
	E2 = 'Oops! An error occurred while processing your request',
	E3 = 'Unauthorized request!',
	E4 = 'An error occurred while establishing connection to mongo db : ARG0',
	E5 = 'Mongo database connection disconnected!',
	E6 = 'Mongo database connection disconnected through app termination!',
	E7 = 'Upload failed',
	E8 = 'We are sorry, but you do not have access to this resource [ARG0]!',
	E9 = 'You do not have permission to access the feature you are requesting. Please contact the system administrator or customer support for further assistance!'
}
