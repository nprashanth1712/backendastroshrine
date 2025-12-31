export interface NotificationMetadata {
	chatId?: string;
	channelId?: string;
	imageUrl?: string;
	userId?: string;
	hostName?: string;
	actions: {
        props: any,
		navigateTo: string;
	};
}

export interface NotificationTableArrayType {
	id: string;
	message: string;
	read: boolean;
	expireTs: number;
	createTs: number;
	metadata: NotificationMetadata;
	critical: boolean;
}

export interface NotificationTable {
	id: string;
	lastUpdated: number;
	inAppNotifications: Array<NotificationTableArrayType>;
	pushNotifications: Array<NotificationTableArrayType>;
}
