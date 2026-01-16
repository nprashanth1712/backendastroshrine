import { String } from "aws-sdk/clients/acm";

// Supabase Migration: Using Supabase DAOs instead of DynamoDB
import { ChannelDao } from "../../../data-access-supabase/ChannelDao";
import { UserDao } from "../../../data-access-supabase/UserDao";
import { AstrologerDao } from "../../../data-access-supabase/AstrologerDao";
import {
    Channel,
    TempHost,
    Waitlist,
} from "../../../types/livestream/models/Livestream";
import { EndUser, JoinedChannel } from "../../../types/user/models/User";
import { publishMessage } from "../../Pusher";
import { logInformation } from "../../logging/CloudWatchService";
import { sendMessageToSQS } from "../../queue-service/SqsConsumer";
import { DocumentClient, TransactWriteItemList } from "aws-sdk/clients/dynamodb";
import { callTerminatedHandler } from ".././temp-host-service/TerminatedHandler";
import { ProcessChannelApproxWaitTime } from "../../../types/async-queue-service/QueueService";
import { UserNotificationNameSpace } from "../../../types/async-queue-service/NotificationTypes";
import { Astrologer } from "../../../types/astrologer/Astrologer";

// Adapter functions to match the old DynamoDB interface
const getHostChannel = ChannelDao.getHostChannel.bind(ChannelDao);
const getLatestOnlineHostChannel = ChannelDao.getLatestOnlineHostChannel.bind(ChannelDao);
const updateTempHost = ChannelDao.updateTempHost.bind(ChannelDao);
const updateWaitlist = ChannelDao.updateWaitlist.bind(ChannelDao);
const enableHostChannel = ChannelDao.enableHostChannel.bind(ChannelDao);
const disableHostChannel = ChannelDao.disableHostChannel.bind(ChannelDao);
const getLatestOnlineHostChannelList = ChannelDao.getLatestOnlineHostChannelList.bind(ChannelDao);
const getUserById = UserDao.getUserById.bind(UserDao);
const getAstrologerById = AstrologerDao.getAstrologerById.bind(AstrologerDao);





export const handleAddToTempHost = async ({
    channelId,
    channelType,
    tempHost,
}: {
    channelId: string;
    channelType: string;
    tempHost: TempHost & {uid: number};
}): Promise<TempHost | Array<Waitlist>> => {
    const transactItemList: TransactWriteItemList = [];
    const currentTime = Date.now();

    const tempHostUser = await getUserById(tempHost.id);

    const channelIndex = await getLatestOnlineHostChannel({ channelId });
    const channel= channelIndex.find((value) => value.channelType.toLowerCase() == channelType.toLowerCase());


    // use this if only single temphost should be there
    // await checkAstrologerIsBusy({channelIndexList: channelIndex})

    if (!channel?.channelId) {
        throw {
            statusCode: 404,
            code: "ChannelNotFound",
            message: "The specified channel is not ACTIVE",
        };
    }
    if (!tempHostUser?.id) {
        throw {
            statusCode: 404,
            code: "UserNotFound",
            message: "User in the waitlist does not exist",
        };
    }
    if (tempHostUser.available) {
        throw {
            statusCode: 404,
            code: "UserOnACall",
            message: "User in another call",
        };
    }


    let channelDataModified = await getHostChannel(channel);

    if (channelDataModified.channelType?.toLowerCase() != tempHost?.channelType.toLowerCase()) {
        throw {
            statusCode: 423,
            code: "ChannelRestricted",
            message: "Channel is currently offline",
        };
    }

    // checking for length and nullability before accessing status
    if (channelDataModified?.tempHost?.status) {
        throw {
            statusCode: 423,
            code: "ChannelRestricted",
            message: "There is already someone in the session.",
        };
    }


    channelDataModified = {
        ...channelDataModified,
        tempHost: {
            ...tempHost,
            status: "REQUESTED",
            requestedTime: currentTime,
        },
    };

    // update rate if bad value
    if (channelDataModified.rate <= 0) {
        channelDataModified.rate = 1;
    }


    const offerValue = channelDataModified.offer ? (channelDataModified.offer / 100) * channelDataModified.rate : 0;
    const minimumBalanceRequired = channelDataModified.rate * 5 - offerValue;

    // Do not update the JoinedChannels if the waitlist user doesn't have balance
    // instead push it to last
    if (minimumBalanceRequired > tempHostUser.balance) {
        return handleTempHostNotEnoughBalance({channel: channelDataModified, tempHostUser});
    }

    const currentWaitlistUser: Waitlist  = (channelDataModified.waitlist.find(
        (element: Waitlist) => element.id != tempHost.id)!
    );
    channelDataModified.tempHost.waitlistJoinTs = currentWaitlistUser?.waitlistJoinTs ?? Date.now(); 
    const updatedWL: Array<Waitlist> = channelDataModified.waitlist.filter((element: Waitlist) => element.id != tempHost.id);
    
    // update joined channel waitlist of user and remove the current host data
    let userJoinedChannels: Array<JoinedChannel> = tempHostUser?.joinedChannels ?? [];
    let updatedJoinedChannel: Array<JoinedChannel> = userJoinedChannels.filter((joinedChannel) => {
        joinedChannel?.id != channelId;
    });

    if (updatedWL?.length != channelDataModified.waitlist?.length) {
        const updatedChannelWaitlistData: Channel = {
            ...channelDataModified,
            waitlist: updatedWL,
        };

        await updateWaitlist({
            updatedChannel: updatedChannelWaitlistData,
            userJoinedChannelData: {
                userId: tempHostUser?.id,
                joinedChannels: updatedJoinedChannel,
            },
        });
    }
    try {
        // update call status and set temphost
        console.log("before updateTempHost ", channelDataModified);


        const tempHostUpdated: TempHost = await updateTempHost({
            channelId: channelDataModified.channelId,
            createTs: channelDataModified.createTs,
            tempHost: channelDataModified.tempHost,
            includedParams: transactItemList,
        });

        console.log("before validateTempHostStatus ", tempHost);
        

        await addToTempHostPostProcess({channel: channelDataModified, userId: tempHostUser.id});


        logInformation({
            logType: "info",
            title: "User add to TempHost",
            information: {
                userId: tempHost?.id,
                channelId: channelId,
                channelType: tempHost?.channelType,
            },
        });
        return tempHostUpdated;
    } catch (error) {
        logInformation({
            logType: "error",
            title: "Error in: User add to TempHost",
            information: {
                userId: tempHost?.id,
                channelId: channelId,
                channelType: tempHost?.channelType,
                error: error,
            },
        });

        throw error;
    }
};


const checkAstrologerIsBusy = async({channelIndexList}: {channelIndexList: Array<Channel>}) => {
    for await  (const channel of channelIndexList) {
        let currentChannel = await getHostChannel(channel);
        if (currentChannel?.tempHost?.id) {
            throw {
                statusCode: 400, code: "AstrologerIsBusy", message: "The astrologer is in session with someone in a channel."
            }
        }
    }
}

const handleTempHostNotEnoughBalance = async ({channel, tempHostUser}: {channel: Channel, tempHostUser: EndUser}) => {

    const currentWaitlistUser: Waitlist | undefined = channel.waitlist.find(
        (element: Waitlist) => element.id != tempHostUser.id
    );
    const updatedWL: Array<Waitlist> = channel.waitlist.filter(
        (element: Waitlist) => element.id != tempHostUser.id
    );
    // if currentWaitlitUser does not exist
    if (typeof currentWaitlistUser != "undefined" && currentWaitlistUser) updatedWL.push(currentWaitlistUser);
    
    if (updatedWL?.length != channel.waitlist.length) {
        const updatedChannelWaitlistData: Channel = {
            ...channel,
            waitlist: updatedWL,
        };
        await updateWaitlist({
            updatedChannel: updatedChannelWaitlistData,
            userJoinedChannelData: {
                userId: tempHostUser?.id,
                joinedChannels: tempHostUser?.joinedChannels ?? [],
            },
        });
        return ((await getHostChannel(channel)) as Channel).waitlist;
    }
    throw {
        statusCode: 401,
        code: "NotEnoughBalance",
        message: "User does not have enough balance",
    };
}



const addToTempHostPostProcess = async ({channel, userId}: {channel: Channel, userId: string}) => {
    await sendMessageToSQS({
        messageRequest: {
            timeToDelay: 20,
            requestType: "validateTempHostStatus",
            data: {
                userId,
                channelId: channel.channelId,
                channelType: channel.tempHost.channelType,
            },
        },
    });
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

    console.log("temphostpostprocess userId ", userId);
    await sendMessageToSQS({
        messageRequest: {
            requestType:  "initializeNotification",
            data: {
                subType: "temphostnotification",
                channelId: channel?.channelId,
                channelType: channel?.channelType,
                channelName: channel?.channelName,
                channelCreateTs: channel?.createTs,
                userId,
                status: "REQUESTED"
            } as UserNotificationNameSpace.TempHostNotification,
            timeToDelay: 0
        }
    })
    return;
}