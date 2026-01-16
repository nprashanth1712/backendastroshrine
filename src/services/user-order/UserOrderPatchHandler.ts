// Supabase Migration: Using Supabase DAOs instead of DynamoDB
import { ChannelDao } from "../../data-access-supabase/ChannelDao";
import { UserDao } from "../../data-access-supabase/UserDao";
import {
	updateUserOrderEndTs,
	updateUserOrderRecordingAvailable,
	updateUserOrderTentativeTs,
} from "../../data-access/UserOrdersDao";
import { UserOrder } from "../../types/order/UserOrder";
import { invalidParameter, missingParameter } from "../../utils/ErrorUtils";
import { publishMessage } from "../Pusher";

// Adapter functions to match the old DynamoDB interface
const getHostChannel = ChannelDao.getHostChannel.bind(ChannelDao);
const getLatestOnlineHostChannel = ChannelDao.getLatestOnlineHostChannel.bind(ChannelDao);
const getUserById = UserDao.getUserById.bind(UserDao);



type UserOrderHandlerFunction = ({
	userId,
	ts,
	value,
}: {
	userId: string;
	ts: number;
	value: any;
}) => Promise<UserOrder>;


export const userOrderPatchHandler = ({ op, path }: { op: string; path: string }): UserOrderHandlerFunction=> {
	switch (op.toUpperCase()) {
		case "REPLACE":
			return replaceHandler({ path });
		default:
			throw {
				statusCode: 400,
				code: "INVALID_PARAM",
				message: invalidParameter(op),
			};
	}
};

const replaceHandler = ({ path }: { path: string }): UserOrderHandlerFunction => {
	switch (path.toLowerCase()) {
		case "tentativets": {
			return handleUpdateUserOrderTentativeTs;
		}
		case "endts": {
			return handleUpdateUserOrderEndTs;
		}
		case 'recordingavailable': {
			return handleUserOrderRecordingAvailable;
		}
		default:
			throw {
				statusCode: 400,
				code: "INVALID_PARAM",
				message: invalidParameter(path),
			};
	}
};

const handleUpdateUserOrderEndTs = async ({userId, ts, value}: {userId: string, ts: number, value: number}) => {
	if (!value || value.toString().length != 13 || isNaN(parseInt(value.toString()))) {
		throw {statusCode: 400, code: "MissingParameter", message: {err: missingParameter("value")}}
	}
	return await updateUserOrderEndTs({userId, ts, value})
}

const handleUpdateUserOrderTentativeTs = async ({ userId, ts, value }: { userId: string; ts: number; value: number }) => {
	const userData = await getUserById(userId);

	if (!value || value.toString().length != 13 || isNaN(parseInt(value.toString()))) {
		throw {statusCode: 400, code: "MissingParameter", message: {err: missingParameter("value")}}
	}

	if (userData.currentUserOrder?.channelId) {
		throw { statusCode: 400, code: "UserIsNotInChannel", message: "The user is not in any channel" };
	}
	const channelIndex = await getLatestOnlineHostChannel({ channelId: userData.currentUserOrder?.channelId });
	const channel = channelIndex.find((value) => value.channelType.toLowerCase() == userData.currentUserOrder.channelType);
	if (!channel?.channelId) {
		throw { statusCode: 404, code: "ChannelNotFound", message: "The channel does not exist or is offline" };
	}
	const channelData = await getHostChannel(channel);
	const { tempHost } = channelData;
	tempHost.orderTentativeEndTs = value;
	const updatedUserOrderTentativeTs: UserOrder = await updateUserOrderTentativeTs({
		userId,
		ts,
		channel: { channelId: channelData?.channelId, createTs: channelData?.createTs, tempHost },
	});
	await publishMessage({
		uri: `public_${channelData?.channelId}`,
		action: `${tempHost?.channelType.toUpperCase()}_TEMPHOST_UPDATE`,
		message: tempHost,
	});
	console.log("User order update patch pusher done")
	return updatedUserOrderTentativeTs;
};

const handleUserOrderRecordingAvailable = async ({
	userId,
	ts,
	value,
}: {
	userId: string;
	ts: number;
	value: boolean;
}) => {
/*
	const userData = await getUserById(userId);

	if (userData.currentUserOrder?.channelId) {
		throw { statusCode: 400, code: "UserIsNotInChannel", message: "The user is not in any channel" };
	}
	const channelIndex = await getLatestOnlineHostChannel({ channelId: userData.currentUserOrder?.channelId });
	const channel = channelIndex.find((value) => value.channelType.toLowerCase() == userData.currentUserOrder.channelType);
	if (!channel?.channelId) {
		throw { statusCode: 404, code: "ChannelNotFound", message: "The channel does not exist or is offline" };
	}
*/
	// we dont really need to check this stuff right

	const userOrder: UserOrder = await updateUserOrderRecordingAvailable({
		userId,
		ts,
		recordingAvailable: value,
	});
	return userOrder;
};
