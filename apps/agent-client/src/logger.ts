import log4js from 'log4js';
import { env } from './config.js';

log4js.configure({
  appenders: {
    stdout: {
      type: 'stdout'
    }
  },
  categories: {
    default: {
      appenders: ['stdout'],
      level: env.logLevel
    }
  }
});

export const logger = log4js.getLogger('agent-client');

export function getLogger(category: string) {
  return log4js.getLogger(category);
}
