import { DeviceList } from "../../types/notifications/Notifications";
import { ulid } from "ulid";
import { NotificationTable, NotificationTableArrayType } from "../../types/notifications/NotificationTable";
import { handleAddUserNotification } from "./NotificationTableHandler";


export const updateNotificationsInUserTableHandler = async ({
	notificationData,
	deviceList,
}: {
	notificationData: any;
	deviceList: DeviceList;
}) => {
	switch (notificationData?.subType.toLowerCase()) {
		case "initializechannelstart": {
            return await handleChannelStartNotification({notificationData, deviceList})
		}
        case "temphostnotification": {
            return await handleTempHostNotification({notificationData, deviceList})
        }
		case "waitlistnotification": {
			return await handleWaitlistNotification({notificationData, deviceList})
		}
		case "chatmessagenotification" : {
			return await handleChatMessageNotification({notificationData, deviceList})
		}
		case "astrologerreviewnotification": {
			return await handleAstrologerReviewNotification({notificationData, deviceList})
		}
        default : {
            console.log("default param in updatenotifications in user table");
            return 0;
        }
	}
};


const handleChannelStartNotification = async ({
	notificationData,
	deviceList,
}: {
	notificationData: any;
	deviceList: DeviceList;
}) => {
    const message = notificationData.isStarting ? `${notificationData?.channelName} started ${notificationData?.channelType.toUpperCase()}`
    : `${notificationData?.channelName} ended ${notificationData?.channelType.toUpperCase()}`
	const userNotificationDataToAdd: NotificationTableArrayType = {
		createTs: notificationData?.channelCreateTs,
		critical: false,
		expireTs: Date.now() + 10 * 10000,
		read: false,
		message: message,
		metadata: {
			channelId: notificationData?.channelId,
			hostName: notificationData?.channelName,
			imageUrl: notificationData?.pictureUrl,
			actions: {
				props: {
					channel: {
						channelId: notificationData?.channelCreateTs,
						createTs: notificationData?.channelCreateTs,
						channelType: notificationData?.channelType
					}
				},
				navigateTo: "AudienceView",
			},
		},
		id: "",
	};


	for await (const devices of uniquelyAssignDevicesByUserId(deviceList)) {
		userNotificationDataToAdd.id = ulid();
		await handleAddUserNotification({
			userId: devices.userId,
			types: ["pushNotifications", "inAppNotifications"],
			notificationData: userNotificationDataToAdd,
		});
	}
    console.log("REACHED HERE ISHAN TRIPATHI")
	return 0;
};

const handleTempHostNotification = async ({
	notificationData,
	deviceList,
}: {
	notificationData: any;
	deviceList: DeviceList;
}) => {
    
	const userNotificationDataToAdd: NotificationTableArrayType = {
		createTs: notificationData?.channelCreateTs,
		critical: false,
		expireTs: Date.now() + 10 * 10000,
		read: false,
		message: `${notificationData?.channelName} is calling you for ${notificationData?.channelType}`,
		metadata: {
			channelId: notificationData?.channelId,
			hostName: notificationData?.channelName,
			imageUrl: notificationData?.pictureUrl,
			actions: {
				props: {
					channel: {
						channelId: notificationData?.channelCreateTs,
						createTs: notificationData?.channelCreateTs,
						channelType: notificationData?.channelType
					}
				},
				navigateTo: "AudienceView",
			},
		},
		id: ulid(),
	};
	notificationData.id = ulid();
	await handleAddUserNotification({
		userId: deviceList![0].userId,
		types: ["inAppNotifications", "pushNotifications"],
		notificationData: userNotificationDataToAdd,
	});
	return 0;
};


const handleWaitlistNotification = async ({
    notificationData,
    deviceList
}: {notificationData: any, deviceList: DeviceList}) => {

    const message = notificationData.isJoined ? `${notificationData?.waitlistUserName} has joined your waitlist for ${notificationData?.channelType}` 
    : `${notificationData?.waitlistUserName} has left your waitlist for ${notificationData?.channelType}`
    const userNotificationDataToAdd: NotificationTableArrayType = {
		createTs: notificationData?.channelCreateTs,
		critical: false,
		expireTs: Date.now() + 10 * 10000,
		read: false,
		message: message,
		metadata: {
			channelId: notificationData?.channelId,
			hostName: notificationData?.channelName,
            userId: notificationData?.waitlistUserId,
			imageUrl: notificationData?.pictureUrl,
			actions: {
				props: {
					channel: {
						channelId: notificationData?.channelCreateTs,
						createTs: notificationData?.channelCreateTs,
						channelType: notificationData?.channelType
					}
				},
				navigateTo: "AudienceView",
			},
		},
		id: ulid(),
	};
	await handleAddUserNotification({
		userId: deviceList![0].userId,
		types: ["inAppNotifications", "pushNotifications"],
		notificationData: userNotificationDataToAdd,
	});
}

const handleChatMessageNotification = async({
	notificationData,
    deviceList
}: {notificationData: any, deviceList: DeviceList}) => {
	const message = notificationData.name + " sent a new message";
	const messageBody = notificationData.message;

	const userNotificationDataToAdd: NotificationTableArrayType = {
		createTs: notificationData.ts,
		critical: false,
		expireTs: Date.now() + 10 * 10000,
		read: false,
		message: message,
		metadata: {
			...notificationData,
			actions: {
				props: {
					chat: {
						chatId: notificationData.chatId,
					}
				},
				navigateTo: "ChatApp",
			},
		},
		id: ulid(),
	};

	for await (const devices of uniquelyAssignDevicesByUserId(deviceList)) {
		userNotificationDataToAdd.id = ulid();
		await handleAddUserNotification({
			userId: devices.userId,
			types: ["pushNotifications", "inAppNotifications"],
			notificationData: userNotificationDataToAdd,
		});
	}
}

const handleAstrologerReviewNotification = async({
	notificationData,
    deviceList
}: {notificationData: any, deviceList: DeviceList}) => {
	const message = notificationData?.isReply ? "You got a reply on your review" : "Reviewd you"
	const messageBody = notificationData.message;

	const userNotificationDataToAdd: NotificationTableArrayType = {
		createTs: notificationData.ts,
		critical: false,
		expireTs: Date.now() + 10 * 10000,
		read: false,
		message: message,
		metadata: {
			...notificationData,
			actions: {
				props: {
					id: notificationData.hostId,
				},
				navigateTo: "AstroProfile",
			},
		},
		id: ulid(),
	};

	for await (const devices of uniquelyAssignDevicesByUserId(deviceList)) {
		userNotificationDataToAdd.id = ulid();
		await handleAddUserNotification({
			userId: devices.userId,
			types: ["pushNotifications", "inAppNotifications"],
			notificationData: userNotificationDataToAdd,
		});
	}
}
const uniquelyAssignDevicesByUserId = (deviceList: DeviceList): DeviceList => {
    const deviceListMap = new Map(deviceList.map((value) => [value.userId, value]));
    return [...deviceListMap.values()]
}


const splitArrayIntoChunks = (arr: Array<any>, chunkSize: number): Array<Array<any>> => {
    let result = [];
    for (let i = 0; i < arr.length; i += chunkSize) {
        let chunk = arr.slice(i, i + chunkSize);
        result.push(chunk);
    }
    return result;
}