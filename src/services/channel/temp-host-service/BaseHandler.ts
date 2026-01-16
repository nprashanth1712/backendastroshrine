import { getLatestOnlineHostChannel, getHostChannel, updateTempHostInfo } from "../../../data-access/LivestreamDao";
import { Channel, ChannelType, TempHost } from "../../../types/livestream/models/Livestream";
import { invalidParameter } from "../../../utils/ErrorUtils";
import { callAcceptedHandler } from "./AcceptedHandler";
import { callRejectedHandler } from "./RejectedHandler";
import { callTerminatedHandler } from "./TerminatedHandler";
import { tempHostUidHandler } from "./UidHandler";

type HandlerFunction = ({
	channelId,
	status,
	channelType,
	userId,
}: {
	channelId: string;
	status: string;
	channelType: ChannelType;
	userId: string;
}) => Promise<TempHost>;

export const tempHostPatchHandler = ({ op, path }: { op: string; path: string }): HandlerFunction => {
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

const replaceHandler = ({ path }: { path: string }): HandlerFunction => {
	switch (path.toUpperCase()) {
		case "STATUS":
			return statusHandler;
		case "UID":
			return tempHostUidHandler;
		default:
			throw {
				statusCode: 400,
				code: "INVALID_PARAM",
				message: invalidParameter(path),
			};
	}
};

const statusHandler = ({
	channelId,
	status,
	userId,
	channelType,
}: {
	channelId: string;
	status: string;
	userId: string;
	channelType: string;
}): Promise<TempHost> => {
	switch (status.toUpperCase()) {
		case "REJECTED":
			return callRejectedHandler({ channelId, channelType, userId, status });
		case "ACCEPTED":
			return callAcceptedHandler({ channelId, channelType, userId, status });
		case "TERMINATED_BY_ASTROLOGER":
		case "TERMINATED_BY_CLIENT":
		case "TERMINATED_BY_SYSTEM":
			return callTerminatedHandler({
				channelId,
				channelType,
				status,
				userId,
				force: false,
			}) as Promise<TempHost>;
		default:
			throw {
				statusCode: 400,
				code: "INVALID_PARAM",
				message: invalidParameter(status),
			};
	}
};

// const deviceIdHandler = async ({
// 	channelId,
// 	channelType,
// 	status,
// }: {
// 	channelId: string;
// 	channelType: string;
// 	status: string;
// }): Promise<TempHost> => {
// 	const channelIndex = await getLatestOnlineHostChannel({ channelId });
// 	const channel = channelIndex.find((value) => value.channelType.toLowerCase() == channelType.toLowerCase());
// 	if (!channel?.channelId) {
// 		throw {
// 			statusCode: 404,
// 			code: "ChannelNotFound",
// 			message: "The channel does not exist {deviceIdHandler}",
// 		};
// 	}
// 	const channelData = await getHostChannel(channel);
// 	if (channelData.tempHost?.activeDeviceId) {
// 		throw {
// 			statusCode: 400,
// 			code: "UnableToJoinChannel",
// 			message: "The deviceId should be the same",
// 		};
// 	}
// 	const { tempHost } = channelData;
// 	tempHost.activeDeviceId = status;
// 	const response = await updateTempHostInfo({
// 		channelId: channelData.channelId,
// 		createTs: channelData.createTs,
// 		tempHost,
// 	} as Channel);
// 	return response as TempHost;
// };
