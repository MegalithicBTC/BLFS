/**
 * Purpose: JSON logs to console + rotated files; simple HTTP access log.
 * Used by: app entry; any util needing logger.
 */
import winston from 'winston';
import 'winston-daily-rotate-file';

const logDir = process.env.LOG_DIR || '/logs';
const level = process.env.LOG_LEVEL || 'info';
const retentionDays = Number(process.env.LOG_RETENTION_DAYS || '14');

const transport = new (winston.transports as any).DailyRotateFile({
  dirname: logDir, filename: 'app-%DATE%.log', datePattern: 'YYYY-MM-DD', maxFiles: `${retentionDays}d`, zippedArchive: true
});

export const logger = winston.createLogger({
  level, format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [transport, new winston.transports.Console({ level })]
});

export function httpLogger(req: any, res: any, next: any) {
  const start = Date.now();
  res.on('finish', () => logger.info({ msg: 'http', method: req.method, url: req.originalUrl || req.url, status: res.statusCode, ms: Date.now() - start }));
  next();
}