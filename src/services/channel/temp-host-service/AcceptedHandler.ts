import { TransactWriteItemList } from "aws-sdk/clients/dynamodb";
// Supabase Migration: Using Supabase DAOs instead of DynamoDB
import { ChannelDao } from "../../../data-access-supabase/ChannelDao";
import { UserDao } from "../../../data-access-supabase/UserDao";
import { ChatDao } from "../../../data-access-supabase/ChatDao";
import { TempHost, TempHostWithChatId, AcceptCallDataToUpdate, Channel } from "../../../types/livestream/models/Livestream";
import { logInformation } from "../../logging/CloudWatchService";
import { sendMessageToSQS } from "../../queue-service/SqsConsumer";
import { initiateRecording } from "../../agora-recording/ChannelIntegration";
import { fetchActiveChannelByIdAndType, getChannelDiscountedPrice, validateTransition } from "./CommonImports";
import { StartRecordingResponse } from "../../../types/recordings/Recording";
import { updateUserOrderEndTs, updateUserOrderRecordingResource } from "../../../data-access/UserOrdersDao";

// Adapter functions to match the old DynamoDB interface
const updateTempHostAccepted = ChannelDao.updateTempHostAccepted.bind(ChannelDao);
const getUserById = UserDao.getUserById.bind(UserDao);
const getChatKeyByUserIds = ChatDao.getChatKeyByUserIds.bind(ChatDao);

export const callAcceptedHandler = async ({
	channelId,
	channelType,
	userId,
	status,
}: {
	channelId: string;
	channelType: string;
	userId: string;
	status: string;
}): Promise<TempHost | TempHostWithChatId> => {
	// initialize channel and a constant time for this function
	let transactItemList: TransactWriteItemList = [];
	const currentTime = Date.now();
	const channel: Channel = await fetchActiveChannelByIdAndType({ channelId, channelType });

	// check temphost and validate their status
	if (!channel.tempHost?.id || channel.tempHost?.id != userId) {
		throw {
			statusCode: 403,
			code: "TempHostNotExist",
			message: "The temporary host does not exist",
		};
	}

	validateTransition(channel.tempHost.status, status);

	// This data is used for writing, so it is different than the actual channel
	let channelDataModified: Channel = { ...channel };
	const { tempHost, host } = channelDataModified;

	const userData = await getUserById(tempHost?.id); // get useer as the temphost is valid

	if (!userData?.id) {
		throw {
			statusCode: 404, code: "UserNotFound", message: "The temphost user does not exists"
		}
	}
	// handle when the channel rate is 0, make it 1
	if (channelDataModified.rate <= 0) {
		channelDataModified.rate = 1;
	}

	const currentChannelRate: number = getChannelDiscountedPrice(channelDataModified);
	console.log("The current channel rate is ", currentChannelRate);
	const channelTentativeTime: number = (userData?.balance / currentChannelRate) * 60000 + currentTime;
	console.log("CHANNEL TENTATIVE TS IS ", channelTentativeTime);

	// fully parse the TempHost object
	channelDataModified = {
		...channelDataModified,
		tempHost: {
			...tempHost,
			status,
			startTime: currentTime,
			orderTentativeEndTs: channelTentativeTime,
		},
	};

	const chatExists = await checkUserHostChatKeyExist({ channelData: channelDataModified }); // check chat for user and temp host


	// HANDLE the items used for
	const transactItemsData: AcceptCallDataToUpdate = {
		channelId: channelDataModified.channelId,
		createTs: channelDataModified.createTs,
		tempHost: channelDataModified.tempHost,
		channelRate: currentChannelRate ?? 1,
		timestamp: currentTime,
		userOrderData: {
			orderType: channelType.toUpperCase(),
			subOrderType: channelDataModified.tempHost.subType.toLowerCase() ?? "NA",
			recordingAvailable: true,
		},
		orderTentativeEndTs: channelTentativeTime,
		chatExist: chatExists,
	};

	console.log("The data is ", JSON.stringify(transactItemList, null, 0));
	// HANDLE QUEUE
	const queueTimeoutDelaySeconds = (channelTentativeTime - currentTime) / 1000 - 60;
	if (queueTimeoutDelaySeconds < 60) {
		throw {
			statusCode: 400,
			code: "NotEnoughBalance",
			message: "The balance is not enough",
		};
	}

	let tempHostUpdated: TempHostWithChatId;
	try {
		tempHostUpdated = await updateTempHostAccepted(transactItemsData);
		const startRecordingResponse: StartRecordingResponse = await initiateRecording({
			channelId,
			tempHost: channelDataModified.tempHost,
			hostUid: host.uid.toString(),
		});

		const updatedOrder =  await updateUserOrderRecordingResource({userId, currentTime, 
			resourceId: startRecordingResponse.resourceId,
			recordingId: startRecordingResponse.sid})
		console.log("changedOrder:", updatedOrder);
		
		callAcceptedPostProcess({
			channelId,
			channelType,
			tempHost,
			queueTimeoutDelaySeconds,
			currentTime,
			recordingResponse: startRecordingResponse,
		});
		return tempHostUpdated;
	} catch (error) {
		console.log("Error in updating TempHost.status -> ACCEPTED ", error);
		throw error;
	}
};

const checkUserHostChatKeyExist = async ({ channelData }: { channelData: Channel }) => {
	let chatUserList = [channelData.channelId, channelData.tempHost.id].sort();
	const chatExists = (await getChatKeyByUserIds({
		userIdListStr: chatUserList.join("#"),
	}))[0];
	if (chatExists?.id) return true;
	return false;
};

const callAcceptedPostProcess = async ({
	channelId,
	channelType,
	tempHost,
	queueTimeoutDelaySeconds,
	recordingResponse,
	currentTime,
}: {
	channelId: string;
	channelType: string;
	tempHost: TempHost;
	queueTimeoutDelaySeconds: number;
	recordingResponse: StartRecordingResponse;
	currentTime: number;
}) => {
	console.log("the time for validateTempHostBalance ", queueTimeoutDelaySeconds);
	await sendMessageToSQS({
		messageRequest: {
			timeToDelay: Math.min(queueTimeoutDelaySeconds, 15 * 60),
			requestType: "validateTempHostBalance",
			data: {
				channelId: channelId,
				channelType: tempHost?.channelType,
				userId: tempHost?.id,
			},
		},
	});
	await sendMessageToSQS({
		messageRequest: {
			requestType: "validateAgoraRecordingStatus",
			timeToDelay: 100,
			data: {
				channelId,
				channelType,
				recordingId: recordingResponse.sid,
				resourceId: recordingResponse.resourceId,
				userOrder: {
					userId: tempHost.id,
					ts: currentTime,
				},
			},
		},
	});

	logInformation({
		logType: "info",
		title: "User accepted as TempHost",
		information: {
			userId: tempHost?.id,
			channelId: channelId,
			channelType: tempHost?.channelType,
			timestamp: currentTime,
		},
	});
};
