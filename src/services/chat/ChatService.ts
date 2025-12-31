// Supabase Migration: Using Supabase DAOs instead of DynamoDB
import { ChatDao } from "../../data-access-supabase/ChatDao";
import { ChatUser, PrivateChat, PrivateChatKey } from "../../types/chat/Chat";
import { invalidParameter } from "../../utils/ErrorUtils";
import { PutObjectCommand, s3Client } from "../AWSS3";
import { publishMessage } from "../Pusher";
import { sendMessageToSQS } from "../queue-service/SqsConsumer";
import { InitializeNotificationRequest, UserNotificationNameSpace } from "../../types/async-queue-service/NotificationTypes";
import { ChatHelpers } from "./ChatHelpers";

// Adapter functions to match the old DynamoDB interface
const editMessage = ChatDao.editMessage.bind(ChatDao);
const getChatById = ChatDao.getChatById.bind(ChatDao);
const getChatDataListById = ChatDao.getChatDataListById.bind(ChatDao);
const getChatDataListByIdTs = ChatDao.getChatDataListByIdTs.bind(ChatDao);
const getKeyDataById = ChatDao.getKeyDataById.bind(ChatDao);
const hideMessage = ChatDao.hideMessage.bind(ChatDao);
const sendMessage = ChatDao.sendMessage.bind(ChatDao);
const updateChatKeyUsersList = ChatDao.updateChatKeyUsersList.bind(ChatDao);

// export const parseMessagePatch = (pathString: string) => {
// 	try {
// 		let handledPath = pathString.split("/");
// 		console.log("handled path", handledPath);
// 		const pathToChange = handledPath[1];

// 		const params = handledPath[0].split("&");
// 		const userId = params[0];
// 		console.log("param", params);
// 		const ts = params[1].split("=")[1];
// 		console.log({ userId, ts: parseInt(ts), pathToChange });
// 		return { userId, ts: parseInt(ts), pathToChange };
// 	} catch (error) {
// 		console.log(error);
// 		throw {
// 			statusCode: 400,
// 			code: "INVALID_PARAM",
// 			message: invalidParameter(pathString),
// 		};
// 	}
// };

export const parsePatchPath = (pathString: string) => {
	try {
		let pathPrefix = pathString.split("/");
		const firstElement = pathPrefix.shift() as string;
		const firstPath = firstElement.split("==")[0].trim();
		const firstPathValue = firstElement.split("==")[1].trim();

		return {
			prefixPath: firstPath,
			prefixPathValue: firstPathValue.replaceAll("'", ""),
			path: pathPrefix.join("/"),
		};
	} catch (error) {
		console.log("Error in parsePatchPath = ", error);
		console.log(error);
		throw {
			statusCode: 400,
			code: "INVALID_PARAM",
			message: invalidParameter(pathString),
		};
	}
};

/**
 * @todo add description
 * @date 3/23/2024 - 11:26:47 AM
 *
 * @param {{ op: string; path: string }} param0
 * @param {string} param0.op
 * @param {string} param0.path
 * @returns {unknown}
 */
const chatKeyPatchHandler = ({ op, path }: { op: string; path: string }) => {
	switch (op) {
		default:
		case "REPLACE":
			return chatKeyReplaceHandler({ path });

			throw {
				statusCode: 400,
				code: "INVALID_PARAM",
				message: invalidParameter(op),
			};
	}
};

const chatMessagePatchHandler = ({ op, path }: { op: string; path: string }) => {
	switch (op) {
		default:
		case "REPLACE":
			return chatMessageUserIdHandler({ path });
			throw {
				statusCode: 400,
				code: "INVALID_PARAM",
				message: invalidParameter(op),
			};
	}
};
const chatMessageUserIdHandler = ({ path }: { path: string }) => {
	const parsedPath = parsePatchPath(path);
	switch (parsedPath.prefixPath.toUpperCase()) {
		case "@USERID": {
			return chatMessageTimestampHandler({ userId: parsedPath.prefixPathValue, path: parsedPath.path });
		}
		default:
			throw {
				statusCode: 400,
				code: "INVALID_PARAM",
				message: invalidParameter(path),
			};
	}
};

const chatMessageTimestampHandler = ({ userId, path }: { userId: string; path: string }) => {
	const parsedPath = parsePatchPath(path);
	switch (parsedPath.prefixPath.toUpperCase()) {
		case "@TS": {
			return messagePathMethodHandler({
				userId,
				ts: parseInt(parsedPath.prefixPathValue),
				path: parsedPath.path,
			});
		}
		default:
			throw {
				statusCode: 400,
				code: "INVALID_PARAM",
				message: invalidParameter(path),
			};
	}
};

const chatMessageReplaceHandler = ({ userId, ts, path }: { userId: string; ts: number; path: string }) => {
	switch (path.toUpperCase()) {
		case "LATEST": {
			return handleEditMessages;
		}
		case "HIDDEN": {
			return handleHideMessage;
		}
		default:
			throw {
				statusCode: 400,
				code: "INVALID_PARAM",
				message: invalidParameter(path),
			};
	}
};

export const messagePathMethodHandler = ({ userId, ts, path }: { userId: string; ts: number; path: string }): any => {
	switch (path.toUpperCase()) {
		case "LATEST": {
			return async function ({ id, value }: { id: string; value: string }) {
				return await handleEditMessages({ id, userId, oldTs: ts, value });
			};
		}
		case "HIDDEN": {
			return async function ({ id, value }: { id: string; value: boolean }) {
				return await handleHideMessage({ id, userId, oldTs: ts, value });
			};
		}
		default:
			throw {
				statusCode: 400,
				code: "INVALID_PARAM",
				message: invalidParameter(path),
			};
	}
};

export const handleHideMessage = async ({
	id,
	userId,
	oldTs,
	value,
}: {
	id: string;
	userId: string;
	oldTs: number;
	value: any;
}) => {
	const messageData = await getChatById({ id, userId, ts: oldTs });
	if (typeof value != "boolean") {
		throw {
			statusCode: 400,
			code: "InvalidValueType",
			message: "The value should be boolean",
		};
	}
	if (!messageData[0]) {
		throw {
			statusCode: 404,
			code: "MessageNotFound",
			message: "The message with the timestamp not found",
		};
	}
	return hideMessage({ id, userId, oldTs, value });
};

const handleEditMessages = async ({ id, userId, oldTs, value }: { id: string; userId: string; oldTs: number; value: any }) => {
	const messageData = await getChatById({ id, userId, ts: oldTs });
	if (typeof value != "string") {
		throw {
			statusCode: 400,
			code: "InvalidValueType",
			message: "The value should be string",
		};
	}
	if (value.length > 1024) {
		throw {
			statusCode: 401,
			code: "MessageTooLarge",
			message: "The message should be less than 1024 words",
		};
	}
	if (!messageData[0]) {
		throw {
			statusCode: 404,
			code: "MessageNotFound",
			message: "The message with the timestamp not found",
		};
	}
	return editMessage({ id, userId, oldTs, value });
};

const chatKeyReplaceHandler = async ({ path }: { path: string }) => {
	switch (path) {
		case "RECEIVED": {
			return updateChatKeyUsersList;
		}
		case "READ": {
			return updateChatKeyUsersList;
		}
		default:
			throw {
				statusCode: 400,
				code: "INVALID_PARAM",
				message: invalidParameter(path),
			};
	}
};

const parseUpdatedUser = ({
	keyData,
	path,
	userId,
	value,
}: {
	keyData: PrivateChatKey;
	path: string;
	userId: string;
	value: string;
}) => {
	let updatedUser;
	switch (path) {
		case "READ": {
			updatedUser = keyData.users
				.filter((user) => user.id === userId)
				.map((u) => {
					return { ...u, lastRead: parseInt(value) };
				})?.[0];
		}
		case "RECEIVED": {
			updatedUser = keyData.users
				.filter((user) => user.id === userId)
				.map((u) => {
					return { ...u, lastReceived: parseInt(value) };
				})?.[0];
		}
	}
	if (!updatedUser) {
		throw {
			statusCode: 404,
			code: "UserNotFound",
			message: `Could not find user`,
		};
	}
	return updatedUser;
};

export const getLatestUserChats = async ({ userId }: { userId: string }) => {
	const usersChatList = await ChatHelpers.getChatKeysByUserIdHandler({ userId });

	let receivedMessages: PrivateChat[] = [];

	const promises = usersChatList.map(async (chatData) => {
		const currentUser = chatData.users.find((value) => value.id === userId);

		if (!currentUser?.id) {
			throw {
				statusCode: 404,
				code: "UserNotFound",
				message: `Could not find user`,
			};
		}

		const messagesList = await getChatDataListByIdTs({
			id: chatData.id,
			ts: currentUser.lastReceived,
		});

		messagesList.forEach((value) => {
			receivedMessages.push(value as PrivateChat);
		});
	});

	try {
		await Promise.all(promises);

		return receivedMessages as Array<PrivateChat>;
	} catch (error) {
		console.error(error);
		throw error;
	}
};

export const handleChatSendMessage = async ({
	id,
	sentBy,
	type,
	message,
	tags,
	sentTs,
	repliedTo,
}: {
	id: string;
	sentBy: string;
	type: string;
	message: any;
	tags?: string;
	sentTs: number;
	repliedTo: any;
}) => {
	console.log("NAMASTE GURU: ");

	let messageData;
	const privateChatKey = await getKeyDataById({ id });

	let chatType = "NORMAL";
	if (privateChatKey.userList?.includes('chatAssistant')) {
		chatType = "ASSISTANT";
	} else if (privateChatKey.userList?.includes("case")) {
		chatType = "SUPPORT"
	}


	privateChatKey.users.forEach(async (value) => {
		await publishMessage({
			uri: `global_${value.id}`,
			action: "NewMessage",
			message: "",
		});
	});
	const currentTs = Date.now();
	switch (type) {
		case "video":
		case "image": {
			const s3Url = await uploadChatMediaS3({
				id,
				ts: sentTs,
				file: message,
			});
			const currItem: PrivateChat = {
				id,
				userTs: currentTs + "#" + sentBy,
				sentTs,
				message: s3Url,
				type,
			};
			if (tags) currItem.tags = tags;
			if (
				repliedTo && repliedTo.userId && repliedTo.type &&
				repliedTo.ts.toString().length == 13 && repliedTo.message
			) {
				currItem.repliedTo = repliedTo;
			}



			await publishMessage({
				uri: `session_${id}`,
				action: "NewMessage",
				message: ChatHelpers.parseChatForResponse({chat: currItem})
			});

			messageData = await sendMessage(currItem);
			chatMessageSendPostProcess({chatId: id, sentBy, name: "", message: s3Url, ts: sentTs, chatType})
			return messageData;
		}
		case "text":
		default: {
			const currItem: PrivateChat = {
				id,
				userTs: currentTs + "#" + sentBy,
				sentTs,
				message,
				type,
			};
			if (tags) currItem.tags = tags;
			if (
				repliedTo &&
				repliedTo.userId &&
				repliedTo.type &&
				repliedTo.ts.toString().length == 13 &&
				repliedTo.message
			) {
				currItem.repliedTo = repliedTo;
			}
			await publishMessage({
				uri: `session_${id}`,
				action: "NewMessage",
				message: ChatHelpers.parseChatForResponse({chat: currItem}),
			});

			messageData = await sendMessage(currItem);
			chatMessageSendPostProcess({chatId: id, sentBy, name: "", message, ts: sentTs, chatType})
			return messageData;
		}
	}
};

const chatMessageSendPostProcess = async ({
	chatId,
	sentBy,
	name,
	message,
	ts,
	chatType
}: {
	chatId: string;
	sentBy: string;
	name: string;
	message: string;
	ts: number;
	chatType: string,
}) => {
	await sendMessageToSQS({
		messageRequest: {
			requestType: "initializeNotification",
			timeToDelay: 0,
			data: {
				subType: "chatmessagenotification",
				notificationData: {
					chatId,
					sentBy,
					name,
					chatType,
					message,
					ts,
				},
			} as InitializeNotificationRequest,
		},
	});
};
const uploadChatMediaS3 = async ({ id, ts, file }: { id: string; ts: number; file: any }) => {
	const fileTypeExtension = file.mimetype.split("/")[1];
	const fileKey = `chat/${id}/${ts}.${fileTypeExtension}`;
	const bucketParams = {
		Bucket: process.env.AWS_S3_BUCKET_CHAT_MEDIA,
		Key: fileKey,
		Body: file.data,
	};
	try {
		await s3Client.send(new PutObjectCommand(bucketParams));
		return fileKey;
	} catch (error: any) {
		throw {
			statusCode: 500,
			code: "FILE_UPLOAD_FAILED",
			message:
				"Failed to upload chat media " +
				id +
				" " +
				ts.toString() +
				" " +
				". err: " +
				JSON.stringify(error),
		};
	}
};

export { chatKeyPatchHandler, chatMessagePatchHandler, parseUpdatedUser, uploadChatMediaS3 };
