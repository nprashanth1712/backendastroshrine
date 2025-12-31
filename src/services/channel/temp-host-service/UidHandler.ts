import { getLatestOnlineHostChannel, getHostChannel, updateTempHostInfo } from "../../../data-access/LivestreamDao";
import { Channel, TempHost } from "../../../types/livestream/models/Livestream";
import { fetchActiveChannelByIdAndType } from "./CommonImports";

export const tempHostUidHandler = async ({
    channelId,
    channelType,
    status,
    userId,
}: {
    channelId: string;
    channelType: string;
    userId: string;
    status: string | number;
}): Promise<TempHost> => {


    const channel = await fetchActiveChannelByIdAndType({channelId, channelType})
    if (!channel?.channelId) {
        throw {
            statusCode: 404,
            code: "ChannelNotFound",
            message: "The channel does not exist",
        };
    }
    const channelData = await getHostChannel(channel);
    const { tempHost } = channelData;

    if (!tempHost.id || tempHost.id != userId) {
        throw {
            statusCode: 403,
            code: "TempHostNotExist",
            message: "The temporary host does not exist",
        };
    }
    tempHost.uid = Number(status);
    const response = await updateTempHostInfo({
        channelId: channelData.channelId,
        createTs: channelData.createTs,
        tempHost,
    } as Channel);
    return response as TempHost;
};