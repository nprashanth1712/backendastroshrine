// import { updateAstrologerNotification } from "../../data-access/AstrologerNotificationsDao";
// import { getUserById } from "../../data-access/UserDao";
// import { updateUserNotification } from "../../data-access/UserNotificationsDao";
// import { EndUser, UserNotification, UserNotificationSubType, UserNotificationSubTypeArray } from "../../types/user/models/User";

// export const handleAddAstrologerNotification = async ({
//     id,
//     type,
//     subType,
//     notificationData,
// }: {
//     id: string;
//     type: string;
//     subType: string;
//     notificationData: UserNotificationSubTypeArray;
// }) => {
//     const userData: EndUser = await getUserById(id);
//     let astrologerNotifications: UserNotification = userData?.notifications;

//     if (!astrologerNotifications) {
//         astrologerNotifications = {};
//     }
//     // if the type doesn't exist
//     if (typeof astrologerNotifications[type] == "undefined") {
//         astrologerNotifications[type] = {};
//     }
//     if (typeof astrologerNotifications[type][subType] == "undefined") {
//         astrologerNotifications[type][subType] = [];
//     }

//     astrologerNotifications[type][subType]!.push(notificationData);
//     console.log("the modified notification data is ", JSON.stringify(astrologerNotifications, null, 2));

//     const response = await updateAstrologerNotification({ id, notifications: astrologerNotifications });
//     return response as UserNotification;
// };

// export const handleAddAstrologerNotification = async ({
//     id,
//     type,
//     subType,
//     notificationData,
// }: {
//     id: string;
//     type: string;
//     subType: string;
//     notificationData: UserNotificationSubTypeArray;
// }) => {
//     const userData: EndUser = await getUserById(id);
//     let astrologerNotifications: UserNotification = userData?.notifications;

//     if (!astrologerNotifications) {
//         astrologerNotifications = {};
//     }
//     // if the type doesn't exist
//     if (typeof astrologerNotifications[type] == "undefined") {
//         astrologerNotifications[type] = [];
//     }
  
//     astrologerNotifications[type].push(notificationData);
//     console.log("the modified notification data is ", JSON.stringify(astrologerNotifications, null, 2));

//     const response = await updateAstrologerNotification({ id, notifications: astrologerNotifications });
//     return response as UserNotification;
// };

// export const handleUpdateAstrologerNotificationRead = async ({
//     id,
//     type,
//     subType,
//     notificationId,
//     readStatus,
// }: {
//     id: string;
//     type: string;
//     subType: string;
//     notificationId: string;
//     readStatus: boolean;
// }) => {
//     const userData: EndUser = await getUserById(id);
//     let astrologerNotifications: UserNotification = userData?.notifications;

//     if (!astrologerNotifications) {
//         throw {
//             statusCode: 404,
//             code: "NotificationNotFound",
//             message: "The notification being updated was not found.",
//         };
//     }
//     // if the type doesn't exist
//     if (typeof astrologerNotifications![type!] == "undefined") {
//         throw {
//             statusCode: 404,
//             code: "NotificationNotFound",
//             message: "The notification being updated was not found.",
//         };
//     }
//     if (typeof astrologerNotifications![type][subType] == "undefined") {
//         throw {
//             statusCode: 404,
//             code: "NotificationNotFound",
//             message: "The notification being updated was not found.",
//         };
//     }

//     let currentNotification = astrologerNotifications[type][subType]!.find((value) => value.id == notificationId);

//     if (typeof currentNotification == "undefined") {
//         throw {
//             statusCode: 404,
//             code: "NotificationNotFound",
//             message: "The notification being updated was not found.",
//         };
//     }
//     currentNotification!.read = readStatus;

//     const response = await updateAstrologerNotification({ id, notifications: astrologerNotifications });
//     return response as UserNotification;
// };

// export const handleUpdateAstrologerNotificationRead = async ({
//     id,
//     type,
//     subType,
//     notificationId,
//     readStatus,
// }: {
//     id: string;
//     type: string;
//     subType: string;
//     notificationId: string;
//     readStatus: boolean;
// }) => {
//     const userData: EndUser = await getUserById(id);
//     let astrologerNotifications: UserNotification = userData?.notifications;

//     if (!astrologerNotifications) {
//         throw {
//             statusCode: 404,
//             code: "NotificationNotFound",
//             message: "The notification being updated was not found.",
//         };
//     }
//     // if the type doesn't exist
//     if (typeof astrologerNotifications![type!] == "undefined") {
//         throw {
//             statusCode: 404,
//             code: "NotificationNotFound",
//             message: "The notification being updated was not found.",
//         };
//     }

//     let currentNotification = astrologerNotifications[type].find((value) => value.id == notificationId);

//     if (typeof currentNotification == "undefined") {
//         throw {
//             statusCode: 404,
//             code: "NotificationNotFound",
//             message: "The notification being updated was not found.",
//         };
//     }
//     currentNotification!.read = readStatus;

//     const response = await updateAstrologerNotification({ id, notifications: astrologerNotifications });
//     return response as UserNotification;
// };
