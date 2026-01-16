import { NextFunction, Request, Response } from "express";

import express from "express";

import getLogger from "../../services/Logger";
import { userNotificationPatchHandler } from "../../services/user-notifications/UserNotificationPatchHandler";
import { missingParameter } from "../../utils/ErrorUtils";
import { sendMessageToSQS } from "../../services/queue-service/SqsConsumer";
import { getUserNotificationsByUserId, updateUserNotificationsById } from "../../data-access/NotificationsDao";
import { NotificationTableArrayType } from "../../types/notifications/NotificationTable";

const logger = getLogger();
const router = express.Router({ mergeParams: true });



// const addUserNotificationRouter = async (req: Request, res: Response, next: NextFunction) => {
//     try {
//         const {id, type, subType} = req.params;

//         const { notificationData }: {notificationData: UserNotificationSubTypeArray} = req.body;

//         const response = await handleAddUserNotification({id, type, subType, notificationData});

//         await sendMessageToSQS({messageRequest: {requestType: "handleUserNotificationVisibility", data: {userId: id}, timeToDelay: 10}})
//         return res.status(200).json(response);
//     } catch(error) {
//         logger.error("[-] Error while adding astrologer notification through router\n");
//         next(error);
//     }
// }


const updateUserNotificationRouter = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {id} = req.params;
        const {op, path, value} : {op: string, path: string, value: {inAppNotifications: NotificationTableArrayType[], pushNotifications: NotificationTableArrayType[]}}= req.body;
        
        const response = await updateUserNotificationsById({id, lastUpdated: Date.now(), inAppNotifications: value.inAppNotifications, pushNotifications: value.pushNotifications});
        res.status(200).json(response);
    } catch(error) {
        logger.error("[-] Error while editing astrologer notification");
        next(error);
    }
}

const getUserNotificationRouter =  async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {id} = req.params; 
        let notificationData = await getUserNotificationsByUserId({id});
        if (!notificationData?.id) {
            notificationData= {id: id, inAppNotifications: [], lastUpdated: Date.now(), pushNotifications: []}
        }
        res.status(200).json(notificationData);
    } catch(error) {
        console.log("error in getting notification datat");
        next(error);
    }
}

const updateUserNotificationInformationRouter = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {id, notificationId, type}= req.params;

        const {op, path, value} = req.body;

        if (!op) {
			throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("op")};
        }
        if (!path) {
			throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("path")};
        }

        const patchHandler = userNotificationPatchHandler({op, path});
        const response = await patchHandler({id, type, notificationId, readStatus: value})
        return res.status(200).json(response);
    } catch(error) {
        console.log("Error in updating notification data");
        next(error);
    }
}

router.patch("/", updateUserNotificationRouter);
// router.post("/type/:type/:subType", addUserNotificationRouter);
router.get("/", getUserNotificationRouter);
router.patch("/type/:type/:notificationId", updateUserNotificationInformationRouter)
export default router;