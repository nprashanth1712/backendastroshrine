import { Astrologer, HostProfile } from "../../astrologer/Astrologer";
import { EndUser, JoinedChannel, RejectedSessionListForUser, UserProfile } from "../../user/models/User";

export type TempHost = EndUser & {
	activeDeviceId?: string;
	orderTentativeEndTs: number;
	channelType: string;
	subType: string;
	status?: string;
	requestedTime?: number;
	rejectedTime?: number;
	endTime?: number;
	startTime?: number;
	waitlistJoinTs: number,
};

export interface RejectedUserSession {
	userId: string;
	uid: number;
	channelType: string;
	subType: string;
	rejectedTime: number;
}

export type TH = {
	id: string;
	uid: number;
	name: string;
	role: string;
	activeDeviceId?: string;
	orderTentativeEndTs: number;
	channelType: string;
	subType: string;
	status?: string;
	requestedTime?: number;
	rejectedTime?: number;
	endTime?: number;
	startTime?: number;
};

export type TempHostWithChatId = TempHost & { chatId?: string };

export interface Waitlist {
	name?: string;
	uid?: number;
	id: string;
	channelType?: string;
	waitlistJoinTs?: number,
	subType?: string;
}

export type ChannelType = "livestream" | "call" | "chat" | string;

export type ChannelSubType = "video" | "audio" | "anonymous" | "private" | string;


export interface Channel {
	channelId: string;
	host: Astrologer & {uid: number};
	createTs: number;
	recordingUid: number,
	channelName: string,
	channelStatus?: string;
	tempHost: TempHost & {uid: number};
	tempHostsList?: Array<EndUser>;
	waitlist: Array<Waitlist>;
	channelType: string;
	rejectedSessionList: Array<RejectedUserSession>;
	rate: number;
	offer: number;
	ranking: number,
	channelToken?: number;
	approxWaitTime: number;
}

// export interface TerminateCallDataToUpdate  {
//     channelId: string,
//     createTs: number,
//     tempHost: TempHost,
//     balanceInformation: {
//         available: number,
//         temporary: number,
//     }
//     userOrderData: {
//         userId: string,
//         ts: number,
//         status: string,
//         amount: number,
//     },
//     updatedUserData: {
//         id: string,
//         status: string,
//     }
//     userTimeSpentUpdate: {
//         id: string,
//         channelTimeSpent: ChannelTimeSpent
//     },
//     hostTimeSpentUpdate: {
//         id: string,
//         channelTimeSpent: ChannelTimeSpent,
//     },

// }

export interface TerminateCallDataToUpdate {
	channelId: string;
	createTs: number;
	tempHost: TempHost; // user id
	balance: number;
	userOrderData: {
		// user id
		ts: number;
		status: string;
		amount: number;
	};

	timeSpent: number,
	hostProfileUpdated: HostProfile;
	channelDisable?: boolean;
	userAstrologerChatId: string,
	returnParams?: boolean; // if true, the transact params will be returned instead of being executed
}

export interface AcceptCallDataToUpdate {
	channelId: string;
	createTs: number;
	tempHost: TempHost;
	channelRate: number;
	timestamp: number;
	orderTentativeEndTs: number;
	userOrderData: {
		orderType: string;
		subOrderType: string;
        resourceId?: string,
        recordingId?: string,
		recordingAvailable: boolean,
	};
	chatExist?: boolean;
}

export interface UpdateWaitlistData {
	updatedChannel: Channel;
	userJoinedChannelData: {
		userId: string;
		joinedChannels: Array<JoinedChannel>;
		rejectedList?: Array<RejectedSessionListForUser>
	};
	returnParams?: boolean;
}
export interface UpdateTempHostList {
	channelId: string;
	createTs: number;
	tempHost: TempHost;
	rejectedUserSession: RejectedUserSession;
	rejectedSessionForUser: RejectedSessionListForUser
}
