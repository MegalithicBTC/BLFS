/**
 * Purpose: TypeORM configuration; registers entities.
 * Called by: src/index.ts at startup.
 */
import { DataSource } from 'typeorm';
import { Shop } from './entities/Shop';
import { WalletConnection } from './entities/WalletConnection';
import { Order } from './entities/Order';

const sync = process.env.TYPEORM_SYNC ? process.env.TYPEORM_SYNC === 'true' : true;
const migrationsRun = process.env.TYPEORM_MIGRATIONS_RUN === 'true';

export const AppDataSource = new DataSource({
  type: 'sqlite',
  database: process.env.SQLITE_PATH || './data/app.sqlite',
  entities: [Shop, WalletConnection, Order],
  synchronize: sync,
  migrationsRun,
  logging: false
});
