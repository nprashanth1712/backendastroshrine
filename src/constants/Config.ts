import AWS from "aws-sdk";
import { DocumentClient } from "aws-sdk/clients/dynamodb";
import http from "http";
import dotenv from "dotenv";
dotenv.config();
import OpenAI from "openai";

const agent = new http.Agent({
	keepAlive: true,
	maxSockets: Infinity,
});

AWS.config.update({
	region: process.env.AWS_DEFAULT_REGION,
	accessKeyId: process.env.AWS_ACCESS_KEY_ID,
	secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
	httpOptions: {
		agent,
	},
});

export const dynamoClient: DocumentClient = new AWS.DynamoDB.DocumentClient({
	sslEnabled: false,
	paramValidation: false,
	convertResponseTypes: false,
	httpOptions: {
		agent,
	},
});

export const cloudWatchLogsClient = new AWS.CloudWatchLogs({
	region: process.env.AWS_DEFAULT_REGION,
	accessKeyId: process.env.AWS_ACCESS_KEY_ID,
	secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
	sslEnabled: false,
});

export const storageConfig = {
	vendor: 1,
	region: 14,
	bucket: process.env.AWS_S3_BUCKET_CHANNEL_MEDIA,
	accessKey: process.env.AWS_ACCESS_KEY_ID,
	secretKey: process.env.AWS_SECRET_ACCESS_KEY,
	fileNamePrefix: [],
};

// OpenAI is optional - only initialize if API key is provided
export const openAIClient = process.env.OPENAI_API_KEY 
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;


export const USER_SESSION_TABLE="UserSessionTable";
export const CHAT_KEY_TABLE = "PrivateChatKey";
export const CHAT_TABLE = "PrivateChatSession";
export const LIVESTREAM_TABLE = "Channel";
export const USER_TABLE = "User"
export const USER_SEQUENCE_TABLE = "UserSequenceGenerator"
export const PRIVATE_CALL_TABLE = "PrivateCall";
export const TEMPLATE_TABLE = "ContentTemplate";
export const PRIVATE_CHAT_TABLE = "PrivateChat";
export const CASES_TABLE = "Cases";
export const ORDER_TABLE = "Order";
export const SESSION_ORDER_TABLE = "SessionOrder";
export const PAGES_TABLE = "Pages";
export const REVIEWS_TABLE = "UserReviews";
export const USERORDER_TABLE = "UserOrder";
export const FOLLOWERS_TABLE = "Followers";
export const GIFTS_TABLE = "Gifts";
export const KUNDLI_TABLE = "KundliProfile";
export const ASTROLOGER_TABLE = 'Astrologer';
export const METADATA_TABLE = 'Metadata';
export const CHAT_USER_TABLE = "ChatUserKey";
export const ASTROLOGER_ORDER_TABLE = "AstrologerOrder";
export const EARNINGS_TABLE = "AstrologerEarnings";
export const NOTIFICATONS_TABLE = "Notifications";
export const AGENT_CHAT_TABLE = "CHATBOT_ASTROLOGER";

export const ZOHO_MAIL_ADDRESS = "astrolive9@gmail.com";
export const ZOHO_MAIL_PASS =  "HelloAstro@123";
export const RAZORPAY_KEY_ID = "rzp_test_NS0WlFLQqV2nww";
export const RAZORPAY_KEY_SECRET = "DZMxuHWCPfa4SNcAFvvs73dj";

