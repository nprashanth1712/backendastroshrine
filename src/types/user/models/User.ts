import { Waitlist } from "../../livestream/models/Livestream";
import { BooleanModel } from "aws-sdk/clients/gamelift";

type Host = {
	uid: number;
	name: string;
	id: string;
};

export type JoinedChannel = {
	id: string;
	name: string;
	channelType: string;
	subType: string;
};

export type Device = {
	imeiNumber: string;
};

export interface CurrentUserOrder {
	channelId: string;
	channelType: string;
	channelCreateTs: number;
	tempHost: {
		status: string;
	};
	userOrderTs: number;
}

export interface RejectedSessionListForUser {
	channelId: string;
	channelType: string;
	subType: string;
	rejectedTime: number;
	waitlistJoinTs: number;
}



export interface UserOfferType {
	productType: string,
	status: "ACTIVE" | "INACTIVE",
	expire: number, 
	remainingUsage: number,
	coupanCodeOffer: number,
	startTs: number,
	endTs: number,
}


export type EndUser = {
	id: string;
	name: string;
	phoneNumber: string;
	available: number;
	balance: number;
	rejectedSessionList: Array<RejectedSessionListForUser>;
	currentUserOrder: CurrentUserOrder;
	lastOnlineTs: number;
	availableOffers: Array<UserOfferType>,                                                                           
	joinedChannels: Array<JoinedChannel>;
	isSupport : "true" | "false",
	profile: UserProfile;
};

export type EndUserApiResponse = {
	id: string;
	name: string;
	phoneNumber: string;
	available: number;
	balance: number;
	rejectedSessionList: Array<RejectedSessionListForUser>;
	currentUserOrder: CurrentUserOrder;
	lastOnlineTs: number;
	availableOffers: Array<UserOfferType>,                                                                           
	joinedChannels: Array<JoinedChannel>;
	isSupport : boolean,
	profile: UserProfile;
};


export interface UserProfile {
	dateTimeOfBirth: number;
	email: string;
	gender: string;
	placeOfBirth: {
		displayValue: string;
		geoLocation: {
			lat: number;
			long: number;
		};
	};
	aboutMe: string;
	profilePic: string;
}
