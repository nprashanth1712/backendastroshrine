// Supabase Migration: Using Supabase DAOs instead of DynamoDB
import { AstrologerDao } from "../../data-access-supabase/AstrologerDao";
import { ChannelDao } from "../../data-access-supabase/ChannelDao";
import { UserDao } from "../../data-access-supabase/UserDao";
import { UserWaitlist, PricingData, AstrologerCurrentChannel } from "../../types/astrologer/Astrologer";
import { UserNotificationNameSpace } from "../../types/async-queue-service/NotificationTypes";
import { ProcessChannelApproxWaitTime } from "../../types/async-queue-service/QueueService";
import { Channel, Waitlist } from "../../types/livestream/models/Livestream";
import { EndUser } from "../../types/user/models/User";
import { publishMessage } from "../Pusher";
import { sendMessageToSQS } from "../queue-service/SqsConsumer";
import { handleDisableChannel } from "./ChannelEnd";
import { callTerminatedHandler } from "./temp-host-service/TerminatedHandler";

// Adapter functions to match the old DynamoDB interface
const getAstrologerById = AstrologerDao.getAstrologerById.bind(AstrologerDao);
const getLatestOnlineHostChannelList = ChannelDao.getLatestOnlineHostChannelList.bind(ChannelDao);
const getHostChannel = ChannelDao.getHostChannel.bind(ChannelDao);
const disableHostChannel = ChannelDao.disableHostChannel.bind(ChannelDao);
const enableHostChannel = ChannelDao.enableHostChannel.bind(ChannelDao);
const getUserById = UserDao.getUserById.bind(UserDao);

const enableChannelPreProcessing = async ({
	channelId,
	host,
	channelType,
}: {
	channelId: string;
	host: EndUser;
	channelType: string;
}) => {
	// const transactItemsDataList: DocumentClient.TransactWriteItemList = [];

	const currentLiveChannelList: Array<Channel> = (await getLatestOnlineHostChannelList({
		channelId: host.id,
	})) as Array<Channel>;


	console.timeLog();
	for (const currentChannel of currentLiveChannelList) {
		console.log("list length: ", currentLiveChannelList.length);
		const curChannelType = currentChannel.channelType.toLowerCase();

		// can only have call and chat, or livestream
		if (
			(channelType.toLowerCase() == "call" &&
				(curChannelType == "call" || curChannelType == "livestream")) ||
			(channelType.toLowerCase() == "chat" &&
				(curChannelType == "chat" || curChannelType == "livestream")) ||
			channelType.toLowerCase() == "livestream"
		) {
			
			await handleDisableChannel({channelId, channelType: curChannelType});
			
			console.timeLog();
			publishMessage({
				uri: `public_${host.id}`,
				action: "CHANNEL_ENDED",
				message: currentChannel,
			});
		}
	}
	// console.log("Final transactItemsDataList is :", transactItemsDataList)
	// return transactItemsDataList;
};

export const handleEnableHostChannel = async ({
	channelId,
	host,
	channelType,
	deviceId,
}: {
	channelId: string;
	host: EndUser & {uid: number};
	channelType: string;
	deviceId: string
}) => {
	await enableChannelPreProcessing({ channelId, channelType, host });

	const astrologerDetails = await getAstrologerById(channelId);
	if (!astrologerDetails?.id) {
		throw {
			statusCode: 404,
			code: "UserNotFound",
			message: "The astrologer does not exist",
		};
	}

	const currentChannelTypeKey = channelType.toLowerCase() as keyof UserWaitlist;
	const currentPricingTypeKey = channelType.toLowerCase() as keyof PricingData;
	const channelKey = channelType.toLowerCase() as keyof AstrologerCurrentChannel;


	const waitlistToAdd =
		(astrologerDetails?.waitlist[currentChannelTypeKey] as Array<Waitlist>) ?? ([] as Array<Waitlist>);
	astrologerDetails.currentChannel[channelKey] = {...astrologerDetails.currentChannel[channelKey], approxTime: 0, enabled: true}

	const rateToAdd = astrologerDetails?.pricingData[currentPricingTypeKey].rate ?? 1;
	const offerToAdd = astrologerDetails?.pricingData[currentPricingTypeKey].offer ?? 0;


	console.log("handleEnableHostChannel: waitlist and rate: ", astrologerDetails, rateToAdd);
	const currentTime = Date.now();


	const responseData = await enableHostChannel({
		channelId,
		rate: rateToAdd,
		offer: offerToAdd,
		waitlist: waitlistToAdd,
		createTs: currentTime,
		host,
		deviceId,
		astrologer: astrologerDetails,
		approxWaitTime: 0,
		transactItemList: [],
		statusType: channelType == "NONE" ? "ONLINE" : channelType,
	});

	await enableHostChannelPostProcess({channelId, channelType, channelName: astrologerDetails.name, channelCreateTs: currentTime})
	return responseData;
};

const enableHostChannelPostProcess = async ({channelId, channelCreateTs, channelType, channelName} : {channelId: string, channelCreateTs: number, channelType: string, channelName: string}) => {
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
	})
	console.log("reached ehre");
	await sendMessageToSQS({
		messageRequest: {
			requestType: "initializeNotification",
			timeToDelay: 0,
			data: {
				subType: "initializeChannelStart",
				channelId,
				channelName,
				channelType,
				channelCreateTs,
				isStarting: true,
			} as UserNotificationNameSpace.InitializeChannelStart
		}
	})
}