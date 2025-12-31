// Supabase Migration: Using Supabase DAOs instead of DynamoDB
import { NotificationDao } from "../../data-access-supabase/NotificationDao";
import { NotificationTable, NotificationTableArrayType } from "../../types/notifications/NotificationTable";

// Adapter functions to match the old DynamoDB interface
const getUserNotificationsByUserId = NotificationDao.getUserNotificationsByUserId.bind(NotificationDao);
const initializeUserNotifications = NotificationDao.initializeUserNotifications.bind(NotificationDao);
const updateUserNotificationsById = NotificationDao.updateUserNotificationsById.bind(NotificationDao);

const handleAddUserNotification = async ({
	userId,
	types,
	notificationData,
}: {
	userId: string;
	types: Array<string>;
	notificationData: NotificationTableArrayType;
}) => {
    console.log("THE user id is ", userId)
	const currentUserNotifications = await getUserNotificationsByUserId({ id: userId });

    if (!currentUserNotifications?.id) {
        await initializeUserNotifications({userId})
    }
    for (const type of types) {
        const notificationType = type as keyof NotificationTable;

        console.log("THE DATA IS ", currentUserNotifications[notificationType], "  ", currentUserNotifications[notificationType])
        const currentNotifications = currentUserNotifications[notificationType] as NotificationTableArrayType[];
        currentNotifications.push(notificationData);
    }
	
    console.log("REACHED HERE THE notiications is ", currentUserNotifications)
	const updatedNotification = await updateUserNotificationsById({
		id: userId,
		pushNotifications: currentUserNotifications.pushNotifications,
		inAppNotifications: currentUserNotifications.inAppNotifications,
		lastUpdated: Date.now(),
	});

    return updatedNotification as NotificationTable;
};

export {
    handleAddUserNotification
}