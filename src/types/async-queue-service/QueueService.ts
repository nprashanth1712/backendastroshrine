// help determine type of api to fetch in the backend

import { HeaderTraceRequest } from "../request-header/TraceHeader";
import { InitializeNotificationRequest } from "./NotificationTypes";

// when dequeue'ing queue
export type QueueMessageRequestType =
	| "validateTempHostStatus"
	| "validateTempHostBalance"
	| "validateRazorpayPayment"
	| "handleUserOrderProcess"
	| "handleHeartBeat"
	| "processChannelApproxWaitTime"
	| "validateAgoraRecordingStatus"
	| "initializeNotification"
	| "handleUserNotificationVisibility"


export interface ValidateTempHostStatusRequest {
	userId: string;
	channelId: string;
	channelType: string;
}

export interface ValidateTempHostBalance extends HeaderTraceRequest {
	channelId: string;
	channelType: string;
	userId: string;
}

export interface ValidateRazorpayPaymentRequest extends HeaderTraceRequest {
	tryCounter: number;
	orderId: string;
}
export interface ProcessChannelApproxWaitTime extends HeaderTraceRequest {
	channelId: string;
	channelType: string;
	includeWaitlist: boolean;
}

export interface HandleUserOrderProcess extends HeaderTraceRequest {
	userId: string;
	hostId: string;
	userOrderTs: number;
}
export interface HandleAddUserBalance extends HeaderTraceRequest {
	channelId: string;
	channelType: string;
}

export interface ValidateAgoraRecordingStatus extends HeaderTraceRequest {
	channelId: string;
	channelType: string;
	userOrder: {
		userId: string;
		ts: number;
	};
	recordingId: string;
	resourceId: string;
}

export interface HandleUserNotificationVisibility extends HeaderTraceRequest {
	userId: string
}

export type QueueMessageData =
	| ValidateTempHostStatusRequest
	| ValidateTempHostBalance
	| HandleAddUserBalance
	| ValidateRazorpayPaymentRequest
	| HandleUserOrderProcess
	| ValidateAgoraRecordingStatus
	| InitializeNotificationRequest
	| HandleUserNotificationVisibility
	| null;


export interface QueueMessageSQSRequest {
	requestType: QueueMessageRequestType;
	timeToDelay: number;
	data: QueueMessageData
}



