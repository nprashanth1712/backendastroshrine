// Supabase Migration: Using Supabase DAOs instead of DynamoDB
import { ChatDao } from "../../data-access-supabase/ChatDao";
import { ChatUserKey } from "../../data-access/ChatUserTableDao";
import { ChatUserImpl } from "../../types/chat-user/ChatUser";
import { PrivateChat, PrivateChatKey, PrivateChatResponse } from "../../types/chat/Chat";

// Adapter functions to match the old DynamoDB interface
const getChatKeyByUserIds = ChatDao.getChatKeyByUserIds.bind(ChatDao);
const getKeyDataById = ChatDao.getKeyDataById.bind(ChatDao);

namespace ChatHelpers {
	export const parseChatForResponse = ({chat}: {chat: PrivateChat}) => {

		let currentMessage = chat.message;
			if (["image", "video"].includes(chat?.type?.toLowerCase())) {
				currentMessage =
					process.env.AWS_S3_URL?.replace("{{}}", process.env.AWS_S3_BUCKET_CHAT_MEDIA!) +
					"/" +
					currentMessage;
			} else if (chat?.type?.toLowerCase() == "recording") {
                currentMessage =
                process.env.AWS_S3_URL?.replace("{{}}", process.env.AWS_S3_BUCKET_CHANNEL_MEDIA!) +
                "/" +
                currentMessage;
            }
		const privateChatResponse: PrivateChatResponse = {
			id: chat.id,
			message: currentMessage,
			sentBy: chat.userTs.split('#')[1],
			ts: parseInt(chat.userTs.split('#')[0]),
			sentTs: chat.sentTs,
			type: chat.type,
			hidden: chat.hidden,
			repliedTo: chat.repliedTo,
			tags: chat.tags
		}
		return privateChatResponse
	}
	export const parseChatListForResponse = ({
		chats,
		tags,
		type,
	}: {
		chats: Array<PrivateChat>;
		tags?: string;
		type?: string;
	}): PrivateChatResponse[] => {
		let chatArray = chats;
		if (tags) {
			let tagsSortedDecoded;
			try {
				tagsSortedDecoded = atob(tags.toString());
			} catch (error) {
				throw {
					statusCode: 400,
					code: "ErrorInB64Conversion",
					message: "There is some error in b64 conversion",
				};
			}
			tagsSortedDecoded = tagsSortedDecoded.toString().split("#").sort().join("#");
			chatArray = chats.filter((value) => value.tags?.startsWith(tagsSortedDecoded));
		}

		chatArray = chatArray.filter((value) => {
			if ((typeof value.hidden == "boolean" && value.hidden == false) || !value.hidden) return value;
		});
		if (type) {
			chatArray = chatArray.filter((value) => value.type.toLowerCase() == type.toString().toLowerCase());
		}
		let returnData: Array<PrivateChatResponse> = chatArray.map((value) => {
			let currentMessage = value.message;
			if (["image", "video"].includes(value?.type?.toLowerCase())) {
				currentMessage =
					process.env.AWS_S3_URL?.replace("{{}}", process.env.AWS_S3_BUCKET_CHAT_MEDIA!) +
					"/" +
					currentMessage;
			} else if (value?.type?.toLowerCase() == "recording") {
                currentMessage =
                process.env.AWS_S3_URL?.replace("{{}}", process.env.AWS_S3_BUCKET_CHANNEL_MEDIA!) +
                "/" +
                currentMessage;
            }
			let result: any = {
				sentTs: value.sentTs,
				type: value.type,
				ts: parseInt(value.userTs.split("#")[0]),
				sentBy: value.userTs.split("#")[1],
				message: currentMessage,
			};
			if (value.repliedTo) result.repliedTo = value.repliedTo;

			return result;
		});

		return returnData;
	};
	export const getChatKeyByUserIdList = async ({ userIdList }: { userIdList: Array<string> }) => {
		const chatExists = await getChatKeyByUserIds({
			userIdListStr: userIdList.sort().join("#"),
		});
		return chatExists;
	};

	export const getChatKeysByUserIdHandler = async ({ userId }: { userId: string }) => {
		const chatUserKeyList: Array<ChatUserImpl> = await ChatUserKey.getChatUserKeyListByUserId({
			userId,
			ts: 1111111111111,
		});
		let chatKeysList: Array<PrivateChatKey> = [];

		console.log("chatuserkey list ", chatUserKeyList);
		console.log("reached here");
		for await (const chatUserKey of chatUserKeyList) {
			const thisChatId = chatUserKey.tsChatId.split("#")[1];
			const chatKey = await getKeyDataById({ id: thisChatId });
			chatKeysList.push(chatKey);
		}

		return chatKeysList;
	};
}
export { ChatHelpers };
