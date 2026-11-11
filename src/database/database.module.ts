import { DatabaseService } from '@app/database/database.service';
import { AbstractSchedulerDao } from '@app/database/mongo/abstract/scheduler.abstract';
import { mongoDbProvider } from '@app/database/mongo/connection/connection.mongo';
import { mongoDbModelsProvider } from '@app/database/mongo/connection/models.connection.mongo';
import { AuthDao } from '@app/database/mongo/dao/scheduler.dao';
import { Module } from '@nestjs/common';

@Module({
	providers: [
		...mongoDbProvider,
		...mongoDbModelsProvider,
		DatabaseService,
		{
			provide: AbstractSchedulerDao,
			useClass: AuthDao
		}
	],
	exports: [DatabaseService]
})
export class DatabaseModule {}
