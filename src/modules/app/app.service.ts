import { AppResponse, createResponse } from '@app/shared/appresponse.shared';
import { messageFactory, messages } from '@app/shared/messages.shared';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
	async status(): Promise<AppResponse> {
		return createResponse(200, messageFactory(messages.S1, [messages.G1]));
	}
}
