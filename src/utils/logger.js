const winston = require('winston');
const { combine, timestamp, printf, colorize, align, json } = winston.format;
const path = require('path');

// Create logs directory if it doesn't exist
const fs = require('fs');
const logDir = 'logs';
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

// Define log format
const logFormat = printf(({ level, message, timestamp, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(metadata).length > 0) {
        msg += ' ' + JSON.stringify(metadata, null, 2);
    }
    return msg;
});

// Create logger instance
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: combine(
        timestamp({
            format: 'YYYY-MM-DD HH:mm:ss',
        }),
        json(),
        logFormat
    ),
    transports: [
        // Write all logs with level `error` and below to `error.log`
        new winston.transports.File({ 
            filename: path.join(logDir, 'error.log'), 
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
        // Write all logs to `combined.log`
        new winston.transports.File({ 
            filename: path.join(logDir, 'combined.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
    ],
    exitOnError: false, // Do not exit on handled exceptions
});

// If we're not in production, log to the console as well
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: combine(
            colorize({ all: true }),
            timestamp({
                format: 'YYYY-MM-DD HH:mm:ss',
            }),
            logFormat
        ),
        level: 'debug',
    }));
}

// Handle uncaught exceptions
logger.exceptions.handle(
    new winston.transports.File({ filename: path.join(logDir, 'exceptions.log') })
);

// Handle unhandled promise rejections
process.on('unhandledRejection', (ex) => {
    throw ex;
});

module.exports = logger;
