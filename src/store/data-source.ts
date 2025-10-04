/**
 * Purpose: TypeORM configuration; registers entities.
 * Called by: src/index.ts at startup.
 */
import { DataSource } from 'typeorm';
import { Shop } from './entities/Shop';
import { WalletConnection } from './entities/WalletConnection';
import { Order } from './entities/Order';

const migrationsRun = process.env.TYPEORM_MIGRATIONS_RUN === 'true';

export const AppDataSource = new DataSource({
  type: 'sqlite',
  database: process.env.SQLITE_PATH || './data/app.sqlite',
  entities: [Shop, WalletConnection, Order],
  synchronize: true,
  migrationsRun,
  logging: false
});
