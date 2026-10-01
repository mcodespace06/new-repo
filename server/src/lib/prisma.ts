import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

const defaultDbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/campusvoice?schema=public';
const defaultVaultDbUrl = process.env.VAULT_DATABASE_URL || defaultDbUrl;

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var vaultPrisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    datasources: {
      db: {
        url: defaultDbUrl,
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

export const vaultPrisma =
  global.vaultPrisma ||
  new PrismaClient({
    datasources: {
      db: {
        url: defaultVaultDbUrl,
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
  global.vaultPrisma = vaultPrisma;
}
