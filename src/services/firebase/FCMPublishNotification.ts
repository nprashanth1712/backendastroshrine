import admin from "firebase-admin";
import { DeviceList, NotificationData, NotificationViewData } from "../../types/notifications/Notifications";
import lodash from "lodash";
import { updateNotificationsInUserTableHandler } from "../notifications/HandleFirebaseNotifications";

admin.initializeApp({
	credential: admin.credential.applicationDefault(),
});

async function sendFcmNotification({
	notificationChannelType,
	notificationViewData,
	notificationData,
	deviceList,
}: {
	notificationChannelType: string;
	notificationViewData: NotificationViewData;
	notificationData: NotificationData;
	deviceList: DeviceList;
}) {
	let tokens = [];
	for (const data of deviceList!) {
		tokens.push(data.deviceId);
	}

	let notificationPayload;
	switch (notificationChannelType) {
		case "call":
			notificationPayload = getCallNotifeeData({
				tokens,
				deviceList,
				notificationData,
				notificationViewData,
			});
			break;

		case "message":
			notificationPayload = getMessageNotifeeData({
				tokens,
				deviceList,
				notificationData,
				notificationViewData,
			});
			break;

		case "push":
			notificationPayload = getPushNotifeeData({
				deviceList,
				tokens,
				notificationData,
				notificationViewData,
			});
			break;

		case "cancel":
			notificationPayload = {
				tokens,
				data: {
					type: "cancel",
					notificationId: "",
				},
			};
			break;

		default:
			console.log("Invalid notification type");
			return;
	}

	try {
		console.log(`fcm notification type:`, notificationChannelType);
		const updatedUserTableResponse = await updateNotificationsInUserTableHandler({notificationData, deviceList});
		const response = await admin.messaging().sendEachForMulticast(notificationPayload);
		console.log("Successfully sent message:", response);
		return response;
	} catch (error) {
		console.log("Error sending message:", error);
	}
}

const getCallNotifeeData = ({
	tokens,
	deviceList,
	notificationViewData,
	notificationData,
}: {
	tokens: Array<string>;
	deviceList: DeviceList;
	notificationViewData: NotificationViewData;
	notificationData: any;
}) => {
	const userIdList = deviceList.map((value) => value.userId);
	const notificationPayload = {
		tokens,
		data: {
			type: "call",
			userIdList: JSON.stringify(userIdList),
			notifee: JSON.stringify({
				data: stringifyObjectRecursively(notificationData),
				title: notificationViewData.title,
				subtitle: notificationViewData.subtitle,
				body: notificationViewData.body,
				android: {
					largeIcon: "ic_launcher",
					sound: "chorsong",
					vibrationPattern: [100, 200, 100, 200],
					ongoing: true,
					loopSound: true,
					autoCancel: true,
					importance: 4,
					foregroundServiceTypes: [4],
					asForegroundService: false,
					category: "call",
					colorized: true,
					color: "yellow",
					lightUpScreen: true,
					showChronometer: true,
					showTimestamp: true,
					fullScreenAction: {
						id: "default",
						launchActivity: "default",
					},
					actions: [
						{
							title: "<b>Decline</b> &#128111;",
							pressAction: {
								id: "decline",
							},
						},
						{
							title: '<p style="color: #f44336;"><b>Accept</b> &#128557;</p>',
							pressAction: {
								id: "accept",
								launchActivity: "default",
							},
						},
					],
				},
			}),
		},
	};
	return notificationPayload;
};

const getMessageNotifeeData = ({
	tokens,
	deviceList,
	notificationViewData,
	notificationData,
}: {
	tokens: Array<string>;
	deviceList: DeviceList;
	notificationViewData: NotificationViewData;
	notificationData: any;
}) => {
	const userIdList = deviceList.map((value) => value.userId);

	const notificationPayload = {
		tokens,
		data: {
			type: "message",
			userIdList: JSON.stringify(userIdList),
			notifee: JSON.stringify({
				data: stringifyObjectRecursively(notificationData),
				title: notificationViewData.title,
				subtitle: "💬",
				body: notificationViewData.body,
				android: {
					style: {
						type: 0,
						picture: "https://example.com/message-image.jpg",
					},
					autoCancel: true,
					importance: 4,
					colorized: true,
					color: "blue",
					lightUpScreen: true,
					showTimestamp: true,
					actions: [
						{
							title: "<b>Reply</b> &#128172;",
							pressAction: {
								id: "reply",
								launchActivity: "default",
							},
						},
						{
							title: "<b>Mark as Read</b>",
							pressAction: {
								id: "markRead",
								launchActivity: "default",
							},
						},
					],
				},
			}),
		},
	};
	return notificationPayload;
};

const getPushNotifeeData = ({
	tokens,
	deviceList,
	notificationViewData,
	notificationData,
}: {
	tokens: Array<string>;
	deviceList: DeviceList;
	notificationViewData: NotificationViewData;
	notificationData: any;
}) => {
	const userIdList = deviceList.map((value) => value.userId);

	console.log("The stringified object is", notificationData)
	console.log("the stringified object after is ");
	console.log(stringifyObjectRecursively(notificationData))
	const notificationPayload = {
		tokens,
		data: {
			type: "push",
			userIdList: JSON.stringify(userIdList),
			notifee: JSON.stringify({
				id: notificationData?.channelType,
				data: stringifyObjectRecursively(notificationData),
				title: notificationViewData.title,
				body: notificationViewData?.body,
				android: {
					byPassDnd: true,
					color: "yellow",
					pressAction: { id: "default", launchActivity: "default" },
				},
			}),
		},
	};
	return notificationPayload;
};

const stringifyObjectRecursively = (myObj: Object): Object => {
	return lodash.cloneDeepWith(myObj, value => {
		return !lodash.isPlainObject(value) ? lodash.toString(value) : undefined;
	  });
}

const addNotificationToUserList = async ({
	userList,
	notificationPayload,
}: {
	userList: Array<string>;
	notificationPayload: any;
}) => {};
export default sendFcmNotification;
