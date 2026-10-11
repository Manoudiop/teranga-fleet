import { testDatabaseUrl } from './test-database';

// Les variables d'environnement l'emportent sur le fichier .env dans ConfigModule.
process.env.DATABASE_URL = testDatabaseUrl();
process.env.NODE_ENV = 'test';
// Les tests enchaînent beaucoup de connexions : limite relevée, sauf dans le test dédié.
process.env.AUTH_RATE_LIMIT = process.env.AUTH_RATE_LIMIT ?? '1000';
process.env.UPLOAD_DIR = process.env.UPLOAD_DIR ?? './uploads-test';
process.env.STORAGE_DRIVER = 'local';
