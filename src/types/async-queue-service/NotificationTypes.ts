import { HeaderTraceRequest } from "../request-header/TraceHeader";

export namespace UserNotificationNameSpace {
	
	export interface InitializeChannelStart extends HeaderTraceRequest {
		channelId: string;
		channelType: string;
		channelName: string;
		isStarting: boolean,
	}

	export interface TempHostNotification extends HeaderTraceRequest {
		channelId: string;
		channelType: string;
		channelName: string;
	}

	export interface WaitlistNotification extends HeaderTraceRequest {
		subType: string;
		channelId: string;
		channelType: string;
		channelName: string;
		waitlistUserId: string;
		waitlistUserName: string;
		isJoined: boolean;
	}
	
	export interface AstrologerReview extends HeaderTraceRequest {
		hostId: string;
		userId: string;
		ts: number;
        isReply: boolean,
	}

	export interface ChatMessage extends HeaderTraceRequest {
		subType: string;
		chatId: string;
		sentBy: string;
		name: string;
		chatType: string,
		userIdList: Array<string>;
		message: string;
		ts: number;
	}
	export interface WalletRecharge {
		userId: string,
		status: string,
		amount: number,
		ts: number,
	}
	export type NotificationData =
		| InitializeChannelStart
		| TempHostNotification
		| WaitlistNotification
		| AstrologerReview
		| ChatMessage
		| WalletRecharge;
}

export interface InitializeNotificationRequest extends HeaderTraceRequest {
	subType: string;
	notificationData: UserNotificationNameSpace.NotificationData;
}
