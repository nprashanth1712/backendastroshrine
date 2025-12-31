import { cloudWatchLogsClient } from "../../constants/Config";
import { Request } from "express";
const winston = require("winston");
const WinstonCW = require("winston-cloudwatch");

const winstonLogger = new winston.createLogger({
	format: winston.format.json(),
	transports: [
		new winston.transports.Console({
			timestamp: true,
			colorize: true,
		}),
	],
});

const cloudWatchConfig = {
	logGroupName: "nodeservlog",
	logStreamName: "nodeserverlogs",
	awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
	awsSecretKey: process.env.AWS_SECRET_ACCESS_KEY,
	awsRegion: process.env.AWS_DEFAULT_REGION,
	messageFormatter: ({ level, message, additionalInfo }: any) =>
		`[${level}] : ${message} \nAdditional Info: ${JSON.stringify(
			additionalInfo
		)}}`,
};

winstonLogger.add(new WinstonCW(cloudWatchConfig));
const loggingEnabled = false;

export const logHttpRequest = ({
	req,
	logType,
	message,
}: {
	req: Request;
	logType: "ERROR" | "INFO" | "WARN";
	message: string;
}) => {
	if (loggingEnabled) {
		winstonLogger.log(
			logType.toLowerCase(),
			`Requesting ${req.method} ${req.originalUrl}`,
			{ tags: "http", additionalInfo: { body: req.body, log: message } }
		);
	}
};

export const logInformation = ({
	logType,
	title,
	information,
}: {
	logType: string;
	title: string;
	information: {};
}) => {
	if (loggingEnabled) {
		winstonLogger.log(logType.toLowerCase(), `${title}`, {
			tags: "http",
			additionalInfo: information,
		});
	}
};
