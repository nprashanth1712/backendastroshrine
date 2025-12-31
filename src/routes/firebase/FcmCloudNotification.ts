import sendFcmNotification from "../../services/firebase/FCMPublishNotification";
import getLogger from "../../services/Logger";
import express, { Request, Response, NextFunction } from "express";
import { invalidParameter, missingParameter } from "../../utils/ErrorUtils";
import { DeviceList, NotificationData, NotificationViewData } from "../../types/notifications/Notifications";

const logger = getLogger();
const router = express.Router({ mergeParams: true });

router.use(express.json());

const sendFcmNotificationRouter = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const {
			notificationChannelType,
			notificationViewData,
			notificationData,
			deviceList,
		}: {
			notificationChannelType: string;
			notificationViewData: NotificationViewData;
			notificationData: NotificationData,
			deviceList: DeviceList;
		} = req.body;

		console.log("Notification request ", JSON.stringify(req.body, null, 2));


		if (!notificationChannelType) {
			console.log("the first happened")
			throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("notificationChannelType")};
			return;
		}
		console.log("notification data is ", notificationData)
		if (!notificationData?.userId) {
			console.log("the sec happened")
			throw {statusCode: 400, code: "InvalidParameter", message: invalidParameter("notificationData")};
		}
		if (!notificationViewData?.title) {
			console.log("the third happened")

			throw {statusCode: 400, code: "InvalidParameter", message: invalidParameter("notificationViewData")};
			return;
		}
		if (deviceList.length <= 0) {
			console.log("the fourht happened")
			throw {statusCode: 400, code: "InvalidParameter", message: invalidParameter("deviceList.length")};
			return;
		}


		const resp = await sendFcmNotification({
			notificationChannelType,
			notificationViewData,
			notificationData,
			deviceList
		});
		
		res.status(200).json(resp);
	} catch (error) {
		next(error);
	}
};

router.post("/", sendFcmNotificationRouter);

export default router;
