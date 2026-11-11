import { AbstractSchedulerDao } from '@app/database/mongo/abstract/scheduler.abstract';
import { Injectable } from '@nestjs/common';

@Injectable()
export class DatabaseService {
	constructor(public scheduleTxn: AbstractSchedulerDao) {}
}
