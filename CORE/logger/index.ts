import pino from 'pino';
import { config } from '../config/index.js';

const isDev = config.env === 'development';

export const logger = pino({
    level: isDev ? 'debug' : 'info',
    transport: {
        targets: [
            isDev 
                ? { 
                    target: 'pino-pretty', 
                    options: { 
                        colorize: true, 
                        translateTime: 'SYS:standard', 
                        ignore: 'pid,hostname' 
                    }, 
                    level: 'debug' 
                  }
                : { 
                    target: 'pino/file', 
                    options: { destination: 1 }, 
                    level: 'info' 
                  },
            
            {
                target: 'pino-roll',
                options: {
                    file: './logs/identity-service', 
                    size: '10m',                
                    interval: '1d',             
                    mkdir: true                 
                },
                level: 'info'
            }
        ],
    },
});
