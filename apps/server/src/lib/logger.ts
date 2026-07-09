import log4js from 'log4js';
import { env } from '../config/env.js';

log4js.configure({
  appenders: {
    stdout: {
      type: 'stdout'
    }
  },
  categories: {
    default: {
      appenders: ['stdout'],
      level: env.LOG_LEVEL
    }
  }
});

export const logger = log4js.getLogger();

export function getLogger(category: string) {
  return log4js.getLogger(category);
}
