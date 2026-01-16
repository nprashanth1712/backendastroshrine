import { DocumentClient, TransactWriteItemList } from "aws-sdk/clients/dynamodb";
// Supabase Migration: Using Supabase DAOs instead of DynamoDB
import { AstrologerDao } from "../../../data-access-supabase/AstrologerDao";
import { ChannelDao } from "../../../data-access-supabase/ChannelDao";
import { UserDao } from "../../../data-access-supabase/UserDao";
import { ChatDao } from "../../../data-access-supabase/ChatDao";
import { getSpecificUserOrderByUserIdTs } from "../../../data-access/UserOrdersDao";
import { ChannelTimeSpent } from "../../../types/astrologer/Astrologer";
import { Channel, TempHost, TerminateCallDataToUpdate } from "../../../types/livestream/models/Livestream";
import { StopRecordingRequest, StopRecordingResponse } from "../../../types/recordings/Recording";
import { handleStopRecordingReq } from "../../agora-recording/Utils";
import { logInformation } from "../../logging/CloudWatchService";
import { sendMessageToSQS } from "../../queue-service/SqsConsumer";
import { fetchActiveChannelByIdAndType, validateTransition } from "./CommonImports";
import { EndUser } from "../../../types/user/models/User";
import { stopRecording } from "../../agora-recording/ChannelIntegration";
import { ProcessChannelApproxWaitTime } from "../../../types/async-queue-service/QueueService";

// Adapter functions to match the old DynamoDB interface
const getAstrologerById = AstrologerDao.getAstrologerById.bind(AstrologerDao);
const getLatestOnlineHostChannel = ChannelDao.getLatestOnlineHostChannel.bind(ChannelDao);
const getHostChannel = ChannelDao.getHostChannel.bind(ChannelDao);
const updateTempHostTerminatedList = ChannelDao.updateTempHostTerminatedList.bind(ChannelDao);
const getUserById = UserDao.getUserById.bind(UserDao);
const getChatKeyByUserIds = ChatDao.getChatKeyByUserIds.bind(ChatDao);

// we use return params if we wnat to get the items to transact exactly instead of doing it in this function
export const callTerminatedHandler = async ({
	channelId,
	channelType,
	status,
	force,
	userId,
	channelDisable,
	returnParams,
}: {
	channelId: string;
	channelType: string;
	status: string;
	userId: string;
	force: boolean;
	channelDisable?: boolean;
	returnParams?: boolean;
}): Promise<TempHost | DocumentClient.TransactWriteItemList> => {
	// get channel if it exist
	const currentTime = Date.now();
	const channel = await fetchActiveChannelByIdAndType({ channelId, channelType });

	// the mutable data that is modified further
	let channelDataModified = {...channel};

	
	if (!channelDataModified?.tempHost?.id || channelDataModified?.tempHost?.id != userId) {
		throw {
			statusCode: 403,
			code: "TempHostNotExist",
			message: "The temporary host does not exist",
		};
	}

	const userAstrologerChatKey = (await getChatKeyByUserIds({
		userIdListStr: [channelId, userId].sort().join("#"),
	}))[0];

	
	const channelTypeKey = channelDataModified?.tempHost?.channelType?.toLowerCase() as keyof ChannelTimeSpent;

	// GET USER and ASTROLOGER
	// get user data for future purpose as tempHost is valid

	const userData = await getUserById(channelDataModified.tempHost.id);
	const astrologerData = await getAstrologerById(channelId);
	if (!userData?.id) {
		throw {
			statusCode: 403,
			code: "UserNotFound",
			message: "The user does not exist in db.",
		};
	}
	if (!astrologerData?.id) {
		throw {
			statusCode: 404,
			code: "AstrologerNotFound",
			message: "The astrologer does not exist.",
		};
	}

	// if not forced (unless abrupt disable or new channel), validate transition
	if (!force) {
		validateTransition(channelDataModified?.tempHost?.status, status);
	}

	// add "endTime" to the modified channel data
	channelDataModified = {
		...channelDataModified,
		tempHost: { ...channelDataModified.tempHost, status, endTime: currentTime },
	};

	// Ensure tempHost exists with required fields
	const tempHost = channelDataModified.tempHost;
	if (!tempHost || !tempHost.endTime || !tempHost.startTime) {
		throw {
			statusCode: 400,
			code: "InvalidTempHostData",
			message: "TempHost data is missing required time fields",
		};
	}

	// time spent of temphost
	let totalTimeSpent: number = tempHost.endTime - tempHost.startTime;

	// handle when the channel rate is 0, make it 1
	const channelRate = (channelDataModified.rate && channelDataModified.rate > 0) 
		? channelDataModified.rate 
		: 1;
	channelDataModified.rate = channelRate;

	// users amount used
	const channelOffer = channelDataModified.offer || 0;
	let amountUsed: number = (totalTimeSpent / 60000) * channelRate;
	amountUsed = amountUsed - (amountUsed / 100) * channelOffer;

	// updated users data
	const userBalance = userData.balance || 0;
	let userAmountAvailable: number = userBalance - amountUsed;
	const updatedUserBalance = userAmountAvailable < 0 ? 0 : userAmountAvailable;

	// update host time spent - ensure hostProfile exists
	if (!astrologerData.hostProfile) {
		astrologerData.hostProfile = {
			channelTimeSpent: { livestream: 0, chat: 0, call: 0 },
			orders: 0,
		} as any;
	}
	if (!astrologerData.hostProfile.channelTimeSpent) {
		astrologerData.hostProfile.channelTimeSpent = { livestream: 0, chat: 0, call: 0 };
	}
	if (astrologerData.hostProfile.channelTimeSpent[channelTypeKey] === undefined) {
		astrologerData.hostProfile.channelTimeSpent[channelTypeKey] = 0;
	}
	if (astrologerData.hostProfile.orders === undefined) {
		astrologerData.hostProfile.orders = 0;
	}
	
	astrologerData.hostProfile.channelTimeSpent[channelTypeKey] += totalTimeSpent;
	astrologerData.hostProfile.orders += 1;

	// Ensure channelId and createTs exist
	if (!channelDataModified.channelId || !channelDataModified.createTs) {
		throw {
			statusCode: 400,
			code: "InvalidChannelData",
			message: "Channel data is missing required fields",
		};
	}

	// this one is better, gotta test first
	const transactItemsData: TerminateCallDataToUpdate = {
		channelId: channelDataModified.channelId,
		createTs: channelDataModified.createTs,
		tempHost: tempHost as TempHost,
		balance: updatedUserBalance,
		timeSpent: totalTimeSpent,
		returnParams: returnParams ?? false,
		userOrderData: {
			ts: tempHost.startTime,
			status: "SUCCESS",
			amount: amountUsed,
		},
		userAstrologerChatId: userAstrologerChatKey?.id,
		hostProfileUpdated: astrologerData.hostProfile,
		channelDisable: channelDisable ?? false,
	};

	try {
		/// STOP RECORD ALSO /////

		await stopRecording({ channel: channelDataModified });

		// update temphostlist
		const response: TransactWriteItemList = (await updateTempHostTerminatedList(
			transactItemsData
		)) as TransactWriteItemList;

		// if returnParams, return without execution
		if (returnParams) return response;

		// async functions
		callTerminatedPostProcess({ channel: channelDataModified, currentTime });
	} catch (error) {
		console.log("Error in terminating TempHost.status -> TERMINATED ", error);
		throw error;
	}

	// await getHostChannel({ channelId, createTs: channelObj.createTs });
	return channelDataModified.tempHost;
};

const callTerminatedPostProcess = async ({ channel, currentTime }: { channel: Channel; currentTime: number }) => {
	await sendMessageToSQS({
		messageRequest: {
			requestType: "handleUserOrderProcess",
			timeToDelay: 2,
			data: {
				userId: channel.tempHost.id,
				hostId: channel.channelId,
				userOrderTs: channel.tempHost.startTime as number,
			},
		},
	});
	await sendMessageToSQS({
		messageRequest: {
			requestType: "processChannelApproxWaitTime",
			data: {
				channelId: channel.channelId,
				channelType: channel.channelType,
				includeWaitlist: false,
			} as ProcessChannelApproxWaitTime,
			timeToDelay: 0,
		},
	});
	logInformation({
		logType: "info",
		title: "User terminated from TempHost",
		information: {
			userId: channel.tempHost?.id,
			channelId: channel.channelId,
			channelType: channel.tempHost?.channelType,
			timestamp: currentTime,
		},
	});
};
