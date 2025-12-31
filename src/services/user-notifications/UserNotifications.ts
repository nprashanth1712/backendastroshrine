// import { getUserById } from "../../data-access/UserDao";
// import { updateUserNotification } from "../../data-access/UserNotificationsDao";
// import { EndUser, UserNotification, UserNotificationSubType, UserNotificationSubTypeArray } from "../../types/user/models/User";

// Supabase Migration: Using Supabase DAOs instead of DynamoDB
import { NotificationDao } from "../../data-access-supabase/NotificationDao";
import { NotificationTable, NotificationTableArrayType } from "../../types/notifications/NotificationTable";
import { EndUser } from "../../types/user/models/User";

// Adapter functions to match the old DynamoDB interface
const getUserNotificationsByUserId = NotificationDao.getUserNotificationsByUserId.bind(NotificationDao);
const updateUserNotificationsById = NotificationDao.updateUserNotificationsById.bind(NotificationDao);

// export const handleAddUserNotification = async ({
// 	id,
// 	type,
// 	subType,
// 	notificationData,
// }: {
// 	id: string;
// 	type: string;
// 	subType: string;
// 	notificationData: UserNotificationSubTypeArray;
// }) => {
// 	const userData: EndUser = await getUserById(id);
// 	let userNotifications: UserNotification = userData?.notifications;

// 	if (!userNotifications) {
// 		userNotifications = {};
// 	}
// 	// if the type doesn't exist
// 	if (typeof userNotifications[type] == "undefined") {
// 		userNotifications[type] = [];
// 	}
	
// 	userNotifications[type]!.push(notificationData);
// 	console.log("the modified notification data is ", JSON.stringify(userNotifications, null, 2));

// 	const response = await updateUserNotification({ id, notifications: userNotifications });
// 	return response as UserNotification;
// };

export const handleUpdateUserNotificationRead = async ({
	id,
	type,
	notificationId,
	readStatus,
}: {
	id: string;
	type: string;
	notificationId: string;
	readStatus: boolean;
}) => {
	const userNotifications: NotificationTable= await getUserNotificationsByUserId({id});
	console.log("User notoi", userNotifications)
	if (!userNotifications?.id) {
		throw {
			statusCode: 404,
			code: "NotificationNotFound",
			message: "The notification being updated was not found.",
		};
	}
	
	
	console.log("EHRE")

	if (!['inappnotifications', 'pushnotifications'].includes(type.toLowerCase())) {
		throw {statusCode: 400, code: "InvalidNotificationType", message: "The notification type is not valid"}
	}
	let currentNotification = userNotifications[type as keyof NotificationTable] as NotificationTableArrayType[];
	
	if (typeof currentNotification == "undefined") {
		throw {
			statusCode: 404,
			code: "NotificationNotFound",
			message: "The notification being updated was not found.",
		};
	}

	const notificationIndex: number = currentNotification.findIndex((value) => value.id == notificationId);
	if (notificationIndex == -1) {
		throw {
			statusCode: 404,
			code: "NotificationNotFound",
			message: "The notification being updated was not found.",
		};
	}

	currentNotification[notificationIndex].read = readStatus;

	

	const response = await updateUserNotificationsById({ id, inAppNotifications:  userNotifications.inAppNotifications, pushNotifications: userNotifications.pushNotifications, lastUpdated: Date.now()});
	return response as NotificationTable;
};

