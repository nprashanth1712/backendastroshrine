import { String } from "aws-sdk/clients/acm";

// Supabase Migration: Using Supabase DAOs instead of DynamoDB
import { ChannelDao } from "../../data-access-supabase/ChannelDao";
import { UserDao } from "../../data-access-supabase/UserDao";
import { AstrologerDao } from "../../data-access-supabase/AstrologerDao";
import { invalidParameter, invalidOperation } from "../../utils/ErrorUtils";
import { ValidStatusTransitions } from "../../constants/TempHostStatus";
import { Channel, ChannelType, RejectedUserSession, Waitlist } from "../../types/livestream/models/Livestream";
import { EndUser, JoinedChannel, RejectedSessionListForUser } from "../../types/user/models/User";
import { sendMessageToSQS } from "../queue-service/SqsConsumer";
import { Astrologer, UserWaitlist } from "../../types/astrologer/Astrologer";
import { ProcessChannelApproxWaitTime } from "../../types/async-queue-service/QueueService";
import { InitializeNotificationRequest } from "../../types/async-queue-service/NotificationTypes";
import { publishMessage } from "../Pusher";

// Adapter functions to match the old DynamoDB interface
const getHostChannel = ChannelDao.getHostChannel.bind(ChannelDao);
const getLatestOnlineHostChannel = ChannelDao.getLatestOnlineHostChannel.bind(ChannelDao);
const updateTempHostList = ChannelDao.updateTempHostList.bind(ChannelDao);
const updateTempHost = ChannelDao.updateTempHost.bind(ChannelDao);
const updateWaitlist = ChannelDao.updateWaitlist.bind(ChannelDao);
const getUserById = UserDao.getUserById.bind(UserDao);
const updateUserJoinedChannels = UserDao.updateUserJoinedChannels.bind(UserDao);
const getAstrologerById = AstrologerDao.getAstrologerById.bind(AstrologerDao);
const updateAstrologerPersonalWaitlist = AstrologerDao.updateAstrologerPersonalWaitlist.bind(AstrologerDao);

export const handleAddUserToWaitlist = async ({
	channelId,
	channelType,
	waitlist,
}: {
	channelId: string;
	channelType: string;
	waitlist: Waitlist;
}) => {
	const currentTime = Date.now();
	waitlist.waitlistJoinTs = currentTime;
	const waitlistUser: EndUser = await getUserById(waitlist.id);
	if (!waitlistUser) {
		throw {
			statusCode: 404,
			code: "UserNotFound",
			message: "User does not exist",
		};
	}

	const channelIndex = await getLatestOnlineHostChannel({ channelId });
	const channel = channelIndex.find((value) => value.channelType.toLowerCase() == channelType.toLowerCase());
	const channelKey: keyof UserWaitlist = channelType.toLowerCase() as keyof UserWaitlist; // "livestream", "chat", "call"

	const { updatedRejectedList, rejectedSession } = retrieveUserRejectedSessionByChannel({
		userData: waitlistUser,
		channelId,
		channelType,
	});
	if (rejectedSession) waitlist.waitlistJoinTs = rejectedSession.waitlistJoinTs;

	const astrologerDetails: Astrologer = await getAstrologerById(channelId);

	let updatedUserJoinedChannels: Array<JoinedChannel> = waitlistUser?.joinedChannels ?? [];
	updatedUserJoinedChannels.push({
		id: channelId,
		name: astrologerDetails.name,
		channelType: channelType.toUpperCase(),
		subType: waitlist.subType || "NA",
	});
	console.log("handleAddUserToWaitlist", waitlist, channelIndex);

	// if the channel is offline or the waitlist type doesn't match the current channel online type
	if (!channel || channelType.toLowerCase() != waitlist.channelType?.toLowerCase()) {
		return updateWaitlistWhenChannelOffline({
			astrologerDetails,
			userId: waitlist.id,
			channelKey,
			updatedUserJoinedChannels,
			waitlist,
			rejectedDetails: {
				rejected: rejectedSession ? true : false,
				rejectedTime: rejectedSession?.rejectedTime,
				updatedRejectedList,
			},
		});
	}

	const updatedWaitlist = await updateWaitlistWhenChannelOnline({
		channel,
		waitlist,
		updatedUserJoinedChannels,
		userData: waitlistUser,
		rejectedDetails: {
			updatedRejectedList,
			rejected: rejectedSession ? true : false,
			rejectedTime: rejectedSession?.rejectedTime,
		},
	});

	await sendMessageToSQS({
		messageRequest: {
			requestType: "processChannelApproxWaitTime",
			data: {
				channelId: channelId,
				channelType,
				includeWaitlist: true,
			} as ProcessChannelApproxWaitTime,
			timeToDelay: 0,
		},
	});
	await sendMessageToSQS({
		messageRequest: {
			requestType: "initializeNotification",
			timeToDelay: 0,
			data: {
				subType: "waitlistnotification",
				notificationData: {
					channelId,
					channelName: astrologerDetails.name,
					channelType,
					waitlistUserName: waitlistUser.name,
					waitlistUserId: waitlistUser.id,
					isJoined: true,
				},
			} as InitializeNotificationRequest,
		},
	});
	return updatedWaitlist;
};

const retrieveUserRejectedSessionByChannel = ({
	userData,
	channelId,
	channelType,
}: {
	userData: EndUser;
	channelId: string;
	channelType: string;
}): { updatedRejectedList: Array<RejectedSessionListForUser>; rejectedSession: RejectedSessionListForUser | null } => {
	let rejectedSessionList = userData.rejectedSessionList ?? [];
	const userRejectedSession = rejectedSessionList.find((value) => {
		if (value.channelId == channelId && value.channelType.toLowerCase() == channelType.toLowerCase()) {
			return value;
		}
	});
	rejectedSessionList = rejectedSessionList.filter(
		(value) => value.channelId == channelId && value.channelType.toLowerCase() == channelType.toLowerCase()
	);

	return { updatedRejectedList: rejectedSessionList, rejectedSession: userRejectedSession ?? null };
};

const updateWaitlistWhenChannelOffline = async ({
	astrologerDetails,
	channelKey,
	userId,
	waitlist,
	updatedUserJoinedChannels,
	rejectedDetails,
}: {
	astrologerDetails: Astrologer;
	channelKey: keyof UserWaitlist;
	userId: string;
	waitlist: Waitlist;
	updatedUserJoinedChannels: Array<JoinedChannel>;
	rejectedDetails: {
		updatedRejectedList: Array<RejectedSessionListForUser>;
		rejected: boolean;
		rejectedTime?: number;
	};
}): Promise<Array<Waitlist>> => {
	const isUserInWaitlist = (astrologerDetails?.waitlist[channelKey] ?? []).some(
		(element: { id: string }) => element.id === waitlist.id
	);

	if (isUserInWaitlist) {
		throw {
			statusCode: 423,
			code: "UserAlreadyExist",
			message: "Usr already added in the weaitlist",
		};
	}

	if (!astrologerDetails?.waitlist[channelKey]) astrologerDetails.waitlist[channelKey] = [];

	astrologerDetails.waitlist[channelKey].push(waitlist);
	astrologerDetails.waitlist[channelKey].sort((a, b) => b?.waitlistJoinTs ?? 0 - (a.waitlistJoinTs ?? 0));
	console.log("Astrologer waitlist", astrologerDetails.waitlist);
	await updateAstrologerPersonalWaitlist({
		id: astrologerDetails.id,
		waitlist: astrologerDetails.waitlist,
		userId: userId,
		joinedChannels: updatedUserJoinedChannels,
		rejectedList: rejectedDetails.updatedRejectedList,
	});
	return [waitlist];
};

const updateWaitlistWhenChannelOnline = async ({
	channel,
	waitlist,
	updatedUserJoinedChannels,
	userData,
	rejectedDetails,
}: {
	channel: Channel;
	waitlist: Waitlist;
	updatedUserJoinedChannels: Array<JoinedChannel>;
	userData: EndUser;
	rejectedDetails: {
		updatedRejectedList: Array<RejectedSessionListForUser>;
		rejected: boolean;
		rejectedTime?: number;
	};
}): Promise<Array<Waitlist>> => {
	const channelData: Channel = await getHostChannel(channel);
	const isUserInWaitlist = channelData.waitlist.some((element: { id: string }) => element.id === waitlist.id);
	if (isUserInWaitlist) {
		throw {
			statusCode: 423,
			code: "UserAlreadyExist",
			message: "User already added in the waitlist",
		};
	}

	// Add user to waitlist
	channelData.waitlist.push({
		id: waitlist.id,
		uid: waitlist.uid,
		name: waitlist.name,
		waitlistJoinTs: waitlist.waitlistJoinTs,
		subType: waitlist.subType || "NA",
		channelType: waitlist?.channelType?.toUpperCase(),
	});
	channelData.waitlist.sort((a, b) => b.waitlistJoinTs ?? 0 - (a.waitlistJoinTs ?? 0));

	// channels' rejected list
	if (rejectedDetails?.rejected) {
		const channelRejectedList: Array<RejectedUserSession> = (channel.rejectedSessionList ?? []).filter(
			(value) =>
				value.userId == userData?.id &&
				value.channelType.toLowerCase() == channel.channelType.toLowerCase()
		);
		console.log("the rejected channel list ", channelRejectedList);
		channelData.rejectedSessionList = channelRejectedList;
	}

	
	console.warn("Might be an error when updating waitlist: Adds an empty object ", channelData);

	const offerValue = channelData.offer ? (channelData.offer / 100) * channelData.rate : 0;
	const minimumBalanceRequired = channelData.rate * 5 - offerValue;

	if (userData.balance < minimumBalanceRequired) {
		throw {
			statusCode: 424,
			code: "UserLowOnBalance",
			message: "Could not join the waitlist, not enough balance",
		};
	}

	await updateWaitlist({
		updatedChannel: channelData,
		userJoinedChannelData: {
			userId: userData.id,
			joinedChannels: updatedUserJoinedChannels,
			rejectedList: rejectedDetails.updatedRejectedList,
		},
	});
	const updatedChannelData = await getHostChannel(channel);
	return updatedChannelData.waitlist;
};

export const handleRemoveUserFromWaitlist = async ({
	channelId,
	channelType,
	waitlistId,
}: {
	channelId: string;
	channelType: string;
	waitlistId: string;
}) => {
	const channelIndex: Array<Channel> = (await getLatestOnlineHostChannel({
		channelId,
	})) as Array<Channel>;
	// if the channel is not active
	const channel = channelIndex.find((value) => value.channelType.toLowerCase() == channelType.toLowerCase()) as Channel;
	const hostData: Astrologer = await getAstrologerById(channelId);
	const waitlistUser: EndUser = await getUserById(waitlistId);

	if (!waitlistUser?.id) {
		throw { statusCode: 404, code: "WaitlistUserNotFound", message: "Waitlist user does not exist" };
		return;
	}
	let userJoinedChannels: Array<JoinedChannel> = waitlistUser?.joinedChannels ?? [];
	let updatedUserJoinedChannels = userJoinedChannels.filter(
		(curChannel) =>
			curChannel?.id != channelId ||
			(curChannel?.id == channelId && curChannel.channelType.toLowerCase() != channelType.toLowerCase())
	);

	if (!channel) {
		return removeFromWaitlistWhenChannelOffline({
			channelId,
			channelType,
			hostData,
			waitlistUser,
			updatedUserJoinedChannels,
		});
	}

	const response = await removeFromWaitlistWhenChannelOnline({ channel, updatedUserJoinedChannels, waitlistUser });
	return response;
};

const removeFromWaitlistWhenChannelOffline = async ({
	channelId,
	channelType,
	hostData,
	waitlistUser,
	updatedUserJoinedChannels,
}: {
	channelId: string;
	channelType: string;
	hostData: Astrologer;
	waitlistUser: EndUser;
	updatedUserJoinedChannels: Array<JoinedChannel>;
}) => {
	const channelKey: keyof UserWaitlist = channelType.toLowerCase() as keyof UserWaitlist;
	hostData.waitlist[channelKey] = hostData.waitlist[channelKey].filter((element: any) => element?.id != waitlistUser?.id);
	const resp = await updateAstrologerPersonalWaitlist({
		id: channelId,
		waitlist: hostData.waitlist,
		userId: waitlistUser.id,
		joinedChannels: updatedUserJoinedChannels,
	});
	return resp;
};

const removeFromWaitlistWhenChannelOnline = async ({
	channel,
	waitlistUser,
	updatedUserJoinedChannels,
}: {
	channel: Channel;
	waitlistUser: EndUser;
	updatedUserJoinedChannels: Array<JoinedChannel>;
}) => {
	const channelObj: Channel = await getHostChannel(channel);
	let item = await channelObj;
	item.waitlist = item.waitlist.filter((value) => value.id != waitlistUser?.id);

	console.log("before updateWaitlist");
	const resp = await updateWaitlist({
		updatedChannel: item,
		userJoinedChannelData: { userId: waitlistUser.id, joinedChannels: updatedUserJoinedChannels },
	});

	const newChannelData = await getHostChannel(channel);

	removeFromWaitlistPostProcess({ channel, astrologerName: channel.channelName, waitlistUser });
	return newChannelData.waitlist;
};

const removeFromWaitlistPostProcess = async ({
	channel,
	astrologerName,
	waitlistUser,
}: {
	channel: Channel;
	astrologerName: string;
	waitlistUser: EndUser;
}) => {
	await sendMessageToSQS({
		messageRequest: {
			requestType: "processChannelApproxWaitTime",
			data: {
				channelId: channel.channelId,
				channelType: channel.channelType,
				includeWaitlist: true,
			} as ProcessChannelApproxWaitTime,
			timeToDelay: 0,
		},
	});
	await publishMessage({
		uri: `public_${channel.channelId}`,
		action: channel.channelType.toUpperCase() + "_WAITLIST_REMOVE",
		message: channel || [],
	});

	await sendMessageToSQS({
		messageRequest: {
			requestType: "initializeNotification",
			timeToDelay: 0,
			data: {
				subType: "waitlistnotification",
				notificationData: {
					channelId: channel.channelId,
					channelName: astrologerName,
					channelType: channel.channelType,
					waitlistUserName: waitlistUser.name,
					waitlistUserId: waitlistUser.id,
					isJoined: false,
				},
			} as InitializeNotificationRequest,
		},
	});
};
