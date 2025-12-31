import {
	DocumentClient,
	TransactWriteItemList,
	TransactWriteItemsInput,
	TransactWriteItemsOutput,
} from "aws-sdk/clients/dynamodb";
import dotenv from "dotenv";
import { DynOutWithError } from "../types/Common";
import {
	ASTROLOGER_ORDER_TABLE,
	ASTROLOGER_TABLE,
	CHAT_KEY_TABLE,
	CHAT_USER_TABLE,
	dynamoClient,
	LIVESTREAM_TABLE,
	USER_SEQUENCE_TABLE,
	USER_TABLE,
	USERORDER_TABLE,
} from "../constants/Config";
import {
	AcceptCallDataToUpdate,
	Channel,
	ChannelType,
	TempHost,
	TempHostWithChatId,
	TerminateCallDataToUpdate,
	UpdateTempHostList,
	UpdateWaitlistData,
	Waitlist,
} from "../types/livestream/models/Livestream";
import { invalidParameter, missingParameter } from "../utils/ErrorUtils";
import { CurrentUserOrder, EndUser } from "../types/user/models/User";
import { UserOrder } from "../types/order/UserOrder";
import { getUserById, updateUserJoinedChannels } from "./UserDao";
import { getAstrologerById } from "./AstrologerDao";
import { PrivateChatKey } from "../types/chat/Chat";
import { ulid } from "ulid";
import { getChatKeyByUserIds } from "./ChatDao";
import { AstrologerOrder } from "../types/order/AstrologerOrder";
import { Astrologer, AstrologerCurrentChannel } from "../types/astrologer/Astrologer";
import { AssertionError } from "assert";
import { create } from "domain";
import { createHostRecordingSession, getSessionByUserIdDeviceId } from "./SessionDao";
import { UserSession } from "../types/session/Session";
import { transformSampleReply } from "@redis/time-series/dist/commands";

dotenv.config();

/**
 * start a livestream through the host details and id
 * @date 3/23/2024 - 10:43:49 AM
 *
 * @async
 * @param {Channel} param0
 * @param {Channel} param0.channel_id
 * @param {Channel} param0.host
 * @returns {Promise<Channel>}
 */
export const enableHostChannel = async ({
	channelId,
	deviceId,
	statusType,
	host,
	waitlist,
	createTs,
	rate,
	offer,
	astrologer,
	approxWaitTime,
	transactItemList,
}: {
	channelId: string;
	deviceId: string;
	statusType: string;
	host: EndUser & {uid: number};
	createTs: number;
	rate: number;
	offer: number;
	astrologer: Astrologer;
	waitlist: Array<Waitlist>;
	approxWaitTime: number;
	transactItemList: TransactWriteItemList;
}): Promise<Channel> => {
	const uidPrmz: DynOutWithError<DocumentClient.UpdateItemOutput> = await nextChannelToken();
	const uid: number = uidPrmz.Attributes?.nextUID;

	let currentChannelSessionData: UserSession = await getSessionByUserIdDeviceId({
		userId: "RECORDING_" + channelId,
		deviceId,
	});
	if (!currentChannelSessionData?.uid) {
		currentChannelSessionData = await createHostRecordingSession({ channelId: channelId, deviceId });
	}
	// TODO lookup for channel instead
	// const channelSessionData =

	const channel: Channel = {
		channelId,
		channelType: statusType.toUpperCase(),
		host: {
			id: astrologer.id,
			uid: host.uid,
			name: astrologer.name,
		} as Astrologer & {uid: number},
		rate,
		channelName: astrologer?.name,
		recordingUid: currentChannelSessionData.uid,
		offer,
		rejectedSessionList: [],
		createTs,
		channelStatus: "ACTIVE",
		channelToken: uid,
		waitlist,
		tempHost: {} as TempHost & {uid: number},
		tempHostsList: [],
		ranking: astrologer.ranking,
		approxWaitTime: approxWaitTime,
	};
	console.log("waitlist inside enableHostChannel", waitlist);

	const userPersonalWaitlist = {
		livestream: waitlist.filter((value) => value.channelType?.toLowerCase() == "livestream"),
		call: waitlist.filter((value) => value.channelType?.toLowerCase() == "call"),
		chat: waitlist.filter((value) => value.channelType?.toLowerCase() == "chat"),
	};
	const transactParam: DocumentClient.TransactWriteItemsInput = {
		TransactItems: [
			{
				Put: {
					TableName: LIVESTREAM_TABLE,
					Item: channel,
					ConditionExpression: "attribute_not_exists(channelId)",
				},
			},
			{
				Update: {
					TableName: ASTROLOGER_TABLE,
					Key: {
						id: channelId,
					},
					ExpressionAttributeNames: { "#available": "available" },
					UpdateExpression:
						"set #available = :available, waitlist = :userWaitlist, currentChannel = :currentChannel",
					ExpressionAttributeValues: {
						":currentChannel": astrologer.currentChannel,
						":available": 1,
						":userWaitlist": userPersonalWaitlist,
					},
				},
			},
		],
	};
	transactParam.TransactItems.push(...transactItemList);
	await dynamoClient.transactWrite(transactParam).promise();
	return channel;
};

export const updateChannelApproxTime = async ({
	channelId,
	createTs,
	currentChannel,
	channelType,
	value,
}: {
	channelId: string;
	createTs: number;
	currentChannel: AstrologerCurrentChannel;
	channelType: string;
	value: number;
}) => {
	console.log("THe approx wait time is ", value);
	const params: DocumentClient.TransactWriteItemsInput = {
		TransactItems: [
			{
				Update: {
					TableName: LIVESTREAM_TABLE,

					Key: {
						channelId: channelId,
						createTs,
					},

					UpdateExpression: `set approxWaitTime = :approxWaitTime`,
					ExpressionAttributeValues: { ":approxWaitTime": value },
				},
			},
			{
				Update: {
					TableName: ASTROLOGER_TABLE,
					Key: {
						id: channelId,
					},
					UpdateExpression: "set currentChannel = :currentChannel",
					ExpressionAttributeValues: { ":currentChannel": currentChannel },
				},
			},
		],
	};

	const resp = await dynamoClient.transactWrite(params).promise();
	return resp;
};

export const updateChannelOffer = async ({
	channelId,
	createTs,
	channelType,
	value,
}: {
	channelId: string;
	createTs: number;
	channelType: string;
	value: number;
}) => {
	const params = {
		TableName: LIVESTREAM_TABLE,
		Key: {
			channelId: channelId,
			createTs: createTs,
		},
		UpdateExpression: `set #offer= :offer`,
		ExpressionAttributeValues: { ":offer": value },
		ExpressionAttributeNames: { "#offer": "offer" },
		ReturnValues: "ALL_NEW",
	};
	const resp = await dynamoClient.update(params).promise();
	return resp.Attributes;
};

export const updateChannelStatus = async ({
	channelId,
	createTs,
	channelType,
	value,
}: {
	channelId: string;
	createTs: number;
	channelType: string;
	value: string;
}) => {
	const params = {
		TableName: LIVESTREAM_TABLE,
		Key: {
			channelId: channelId,
			createTs: createTs,
		},
		UpdateExpression: `set #channelStatus= :channelStatus`,
		ExpressionAttributeValues: { ":channelStatus": value },
		ExpressionAttributeNames: { "#channelStatus": "channelStatus" },
		ReturnValues: "ALL_NEW",
	};
	const resp = await dynamoClient.update(params).promise();
	return resp.Attributes;
};

// update tempHost and the callstatus of the tempHost
export const updateTempHost = async ({
	channelId,
	createTs,
	tempHost,
	includedParams,
}: {
	channelId: string;
	createTs: number;
	tempHost: TempHost;
	includedParams: TransactWriteItemList;
}): Promise<TempHost> => {
	const transactParam: DocumentClient.TransactWriteItemsInput = {
		TransactItems: [
			{
				Update: {
					TableName: USER_TABLE,
					Key: {
						id: tempHost.id,
					},
					ExpressionAttributeNames: { "#available": "available" },
					UpdateExpression:
						"set #available = :available, currentUserOrder = :currentUserOrder",
					ExpressionAttributeValues: {
						":available": 1,
						":currentUserOrder": {
							channelId: channelId,
							channelCreateTs: createTs,
							channelType: tempHost?.channelType,
							tempHost: {
								status: tempHost?.status,
							},
						} as CurrentUserOrder,
					},
				},
			},
			{
				Update: {
					TableName: LIVESTREAM_TABLE,
					Key: {
						channelId,
						createTs,
					},
					UpdateExpression: "set tempHost = :tempHost",
					ExpressionAttributeValues: { ":tempHost": tempHost },
				},
			},
		],
	};
	if (includedParams.length > 0) transactParam.TransactItems.concat(includedParams);
	const resp: DynOutWithError<DocumentClient.TransactWriteItemsOutput> = await dynamoClient
		.transactWrite(transactParam)
		.promise();

	return tempHost;
};

export const updateTempHostInfo = async ({ channelId, createTs, tempHost }: Channel) => {
	const params: DocumentClient.UpdateItemInput = {
		TableName: LIVESTREAM_TABLE,
		Key: {
			channelId,
			createTs,
		},
		UpdateExpression: "set tempHost = :tempHost",
		ExpressionAttributeValues: { ":tempHost": tempHost },
		ReturnValues: "ALL_NEW",
	};
	const response = await dynamoClient.update(params).promise();
	return response.Attributes;
};

export const updateChannelHostInfo = async ({ channelId, createTs, host }: Channel) => {
	const params: DocumentClient.UpdateItemInput = {
		TableName: LIVESTREAM_TABLE,
		Key: {
			channelId,
			createTs,
		},
		UpdateExpression: "set host = :host",
		ExpressionAttributeValues: { ":host": host },
		ReturnValues: "ALL_NEW",
	};
	const response = await dynamoClient.update(params).promise();
	return response.Attributes;
};

// used when the rejected/terminated
export const updateTempHostList = async ({
	channelId,
	createTs,
	tempHost,
	rejectedUserSession,
	rejectedSessionForUser,
}: UpdateTempHostList): Promise<TempHost> => {
	const defaultObj = {};
	console.log(rejectedUserSession);
	const transactParam: DocumentClient.TransactWriteItemsInput = {
		TransactItems: [
			{
				Update: {
					TableName: USER_TABLE,
					Key: {
						id: tempHost.id,
					},
					ExpressionAttributeNames: { "#available": "available" },
					UpdateExpression:
						"set #available = :available, currentUserOrder = :currentUserOrder, rejectedSessionList = list_append(rejectedSessionList, :rejectedList)",

					ExpressionAttributeValues: {
						":available": 0,
						":currentUserOrder": {},
						":rejectedList": [rejectedSessionForUser],
					},
				},
			},
			{
				Update: {
					TableName: LIVESTREAM_TABLE,
					Key: {
						channelId,
						createTs,
					},
					UpdateExpression:
						"set tempHost = :defaultObj, #attrName = list_append(#attrName, :tempHost), rejectedSessionList = list_append(rejectedSessionList, :rejectedList)",
					ExpressionAttributeNames: {
						"#attrName": "tempHostsList",
					},
					ExpressionAttributeValues: {
						":tempHost": [tempHost],
						":defaultObj": defaultObj,
						":rejectedList": [rejectedUserSession],
					},
				},
			},
		],
	};

	console.log("call reject transact ", JSON.stringify(transactParam, null, 2))
	await dynamoClient
		.transactWrite(transactParam)
		.promise();
		console.log("HERE")
	return tempHost;
};

// userOrder, tempHost.status and tempHostUser.callStatus, currentUserOrder
export const updateTempHostAccepted = async ({
	channelId,
	createTs,
	tempHost,
	userOrderData,
	timestamp,
	orderTentativeEndTs,
	chatExist,
}: AcceptCallDataToUpdate): Promise<TempHost> => {
	let chatId: string;
	const userData = await getUserById(tempHost.id);
	const hostData = await getAstrologerById(channelId);
	const item: UserOrder = {
		...userOrderData,
		userId: tempHost.id,
		hostId: channelId,
		hostName: hostData.name,
		userName: userData.name,
		hostIdTs: channelId + "#" + timestamp,
		ts: timestamp,
		amount: 0,
		status: "Initialized",
		orderTentativeEndTs: orderTentativeEndTs,
		orderEndTs: 0,
	};



	
	const userOrderJoined: CurrentUserOrder = {
		channelId: channelId,
		userOrderTs: timestamp,
		channelCreateTs: createTs,
		channelType: tempHost?.channelType.toUpperCase(),
		tempHost: {
			status: tempHost?.status as string,
		},
	};
	const transactParam: DocumentClient.TransactWriteItemsInput = {
		TransactItems: [
			{
				Update: {
					TableName: LIVESTREAM_TABLE,
					Key: {
						channelId,
						createTs,
					},
					UpdateExpression: "set tempHost = :tempHost",
					ExpressionAttributeValues: { ":tempHost": tempHost },
				},
			},
			{
				Put: {
					TableName: USERORDER_TABLE,
					Item: item,
					ConditionExpression: "attribute_not_exists(id)",
				},
			},
			{
				Update: {
					TableName: USER_TABLE,
					Key: {
						id: tempHost.id,
					},
					ExpressionAttributeNames: { "#available": "available" },

					UpdateExpression:
						"set #available = :available, currentUserOrder = :currentUserOrder",
					ExpressionAttributeValues: {
						":available": 1,
						":currentUserOrder": userOrderJoined,
					},
				},
			},
		],
	};
	const sortedUserListString = [channelId, tempHost?.id].sort().join("#");

	if (!chatExist) {
		chatId = ulid();
		const privateChatKey: PrivateChatKey = {
			users: [
				{
					id: tempHost?.id,
					role: "USER",
					lastRead: timestamp,
					lastReceived: timestamp,
				},
				{
					id: channelId,
					role: "ASTROLOGER",
					lastRead: timestamp,
					lastReceived: timestamp,
				},
			],
			status: "ACTIVE",
			id: chatId,
			userList: sortedUserListString,
		};
		transactParam.TransactItems.push({
			Put: {
				TableName: CHAT_KEY_TABLE,
				Item: privateChatKey,
			},
		});
	} else {
		const chatKey = (await getChatKeyByUserIds({
			userIdListStr: sortedUserListString,
		}))[0];
		chatId = chatKey.id;
		transactParam.TransactItems.push({
			Update: {
				TableName: CHAT_KEY_TABLE,
				Key: {
					id: chatKey.id,
				},
				UpdateExpression: "set #status = :newStatus",
				ExpressionAttributeValues: { ":newStatus": "ACTIVE" },
				ExpressionAttributeNames: { "#status": "status" },
			},
		});
	}

	// THE ChatUserKey
	for (const userId of [channelId, tempHost.id]) {
			const transactDataOfUser = {
				Put: {
					TableName: CHAT_USER_TABLE,
					Item: {
						userId: userId,
						tsChatId: timestamp + "#" + chatId,
					},
				},
			};

			transactParam.TransactItems.push(transactDataOfUser);
	}
	console.log("Call accepted list is :", JSON.stringify(transactParam.TransactItems, null, 2));
	const resp: DynOutWithError<DocumentClient.TransactWriteItemsOutput> = await dynamoClient
		.transactWrite(transactParam)
		.promise();
	(tempHost as TempHostWithChatId).chatId = chatId;
	return tempHost;
};

export const updateTempHostTerminatedList = async ({
	channelId,
	createTs,
	tempHost,
	balance,
	hostProfileUpdated,
	userOrderData,
	timeSpent,
	channelDisable,
	userAstrologerChatId,
	returnParams,

}: TerminateCallDataToUpdate): Promise<TempHost | DocumentClient.TransactWriteItemList> => {
	const defaultObj = {};

	let astrologerUpdateExpression: DocumentClient.UpdateExpression = `set hostProfile = :hostProfile`;
	const astrologerExpressionAttributeValues: DocumentClient.ExpressionAttributeValueMap = {
		":hostProfile": hostProfileUpdated,
	};
	let astrologerExpressionAttributeNames: DocumentClient.ExpressionAttributeNameMap = {};

	if (channelDisable) {
		astrologerUpdateExpression += ", #available = :available";
		astrologerExpressionAttributeValues[":available"] = 0;
		astrologerExpressionAttributeNames!["#available"] = "available";
	}

	console.log(
		"THe expressions are ",
		astrologerUpdateExpression,
		astrologerExpressionAttributeValues,
		astrologerExpressionAttributeNames
	);
	const transactParam: DocumentClient.TransactWriteItemsInput = {
		TransactItems: [
			{
				Update: {
					TableName: CHAT_KEY_TABLE,
					Key: {
						id: userAstrologerChatId, 
					},
					UpdateExpression: "set #status = :updatedStatus",
					ExpressionAttributeValues: {":updatedStatus": "INACTIVE"},
					ExpressionAttributeNames: {"#status": "status"}
				}
			},
			{
				Update: {
					TableName: USER_TABLE,
					Key: {
						id: tempHost.id,
					},
					ExpressionAttributeNames: { "#available": "available" },
					UpdateExpression:
						"set #available = :available, currentUserOrder = :currentUserOrder, balance = :userBalance",
					ExpressionAttributeValues: {
						":available": 0,
						":userBalance": balance,
						":currentUserOrder": {},
					},
				},
			},
			{
				Update: {
					TableName: LIVESTREAM_TABLE,
					Key: {
						channelId,
						createTs,
					},
					UpdateExpression:
						"set tempHost = :defaultObj, #attrName = list_append(#attrName, :tempHost)",
					ExpressionAttributeNames: {
						"#attrName": "tempHostsList",
					},
					ExpressionAttributeValues: {
						":tempHost": [tempHost],
						":defaultObj": defaultObj,
					},
				},
			},

			{
				Update: {
					TableName: ASTROLOGER_TABLE,
					Key: {
						id: channelId,
					},
					UpdateExpression: astrologerUpdateExpression,
					ExpressionAttributeValues: astrologerExpressionAttributeValues,
					...(channelDisable
						? { ExpressionAttributeNames: astrologerExpressionAttributeNames! }
						: null),
				},
			},
		],
	};
	if (userOrderData.ts) {
		const astrologerOrder: AstrologerOrder = {
			astrologerId: channelId,
			timeSpent,
			orderTs: tempHost?.endTime as number,
			orderType: tempHost?.channelType,
			subOrderType: tempHost?.subType,
			customerId: tempHost?.id,
			amount: userOrderData.amount,
		};

		transactParam.TransactItems.push({
			Put: {
				TableName: ASTROLOGER_ORDER_TABLE,
				Item: astrologerOrder,
			},
		});
		transactParam.TransactItems.push({
			Update: {
				TableName: USERORDER_TABLE,
				Key: {
					userId: tempHost.id,
					ts: userOrderData.ts,
				},
				UpdateExpression: "set #status = :status, #amount = :amountUsed, #orderEndTs = :orderEndTs",
				ExpressionAttributeNames: {
					"#status": "status",
					"#amount": "amount",
					"#orderEndTs": "orderEndTs"
				},
				ExpressionAttributeValues: {
					":status": userOrderData.status,
					":amountUsed": userOrderData.amount,
					":orderEndTs": tempHost?.endTime ?? Date.now()
				},
			},
		});
	}

	if (returnParams) return transactParam.TransactItems;
	console.log("The data for updating is ", JSON.stringify(transactParam.TransactItems, null, 2));

	await dynamoClient.transactWrite(transactParam).promise();
	return tempHost;
};

export const nextChannelToken = async (): Promise<DynOutWithError<DocumentClient.UpdateItemOutput>> => {
	const params = {
		TableName: USER_SEQUENCE_TABLE,
		Key: {
			seq: "channelToken",
		},
		UpdateExpression: "set nextUID = nextUID + :step",
		ExpressionAttributeValues: {
			":step": 1,
		},
		ReturnValues: "ALL_NEW",
	};

	return await dynamoClient.update(params).promise();
};

export const updateWaitlist = async ({
	updatedChannel: { channelId, createTs, waitlist, rejectedSessionList },
	userJoinedChannelData: { userId, joinedChannels, rejectedList },
	returnParams,
}: UpdateWaitlistData): Promise<Channel | TransactWriteItemList> => {


	// User Dynamo Update Params
	let updateParamsForUser = "set joinedChannels = :joinedChannels";
	let expressionAttributeValuesForUser: any = {
		":joinedChannels": joinedChannels,
	};

	// Channel Dynamo Update Params
	let updateParamsForChannel = "set waitlist = :waitlist";
	let expressionAttributeValuesForChannnel: any = {":waitlist": waitlist};



	// If rejected Session exists, update it for both user and channel
	if (rejectedList && rejectedList.length > 0) {

		// USER TABLE 
		updateParamsForUser += `, rejectedSessionList = :rejectedList`;
		expressionAttributeValuesForUser[":rejectedList"] = rejectedList ?? [];


		// CHANNEL TABLE 
		updateParamsForChannel += `, rejectedSessionList = :rejectedSessionList`;
		expressionAttributeValuesForChannnel[":rejectedSessionList"] = rejectedSessionList ?? [];
	}



	console.log("Rejected list ", updateParamsForUser, expressionAttributeValuesForUser);
	const params: DocumentClient.TransactWriteItemsInput = {
		TransactItems: [
			{
				Update: {
					TableName: LIVESTREAM_TABLE,
					Key: {
						channelId,
						createTs,
					},
					UpdateExpression: updateParamsForChannel,
					ExpressionAttributeValues: expressionAttributeValuesForChannnel,
				},
			},
			{
				Update: {
					TableName: USER_TABLE,
					Key: {
						id: userId,
					},
					UpdateExpression: updateParamsForUser,
					ExpressionAttributeValues: expressionAttributeValuesForUser,
				},
			},
		],
	};

	if (returnParams) return params.TransactItems;

	await dynamoClient.transactWrite(params).promise();
	return { channelId, createTs, waitlist } as Channel;
};

export const getLatestOnlineHostChannel = async ({
	channelId,
	channelStatus,
}: {
	channelId: string;
	channelStatus?: string;
}): Promise<Array<Channel>> => {
	const params: DocumentClient.QueryInput = {
		TableName: LIVESTREAM_TABLE,
		IndexName: "channelId-channelStatus-index",
		KeyConditionExpression: "channelId = :channelId and channelStatus = :channelStatus",
		Limit: 10,
		ExpressionAttributeValues: {
			":channelId": channelId,
			":channelStatus": channelStatus || "ACTIVE",
		},
	};
	const activeChannels: DynOutWithError<DocumentClient.QueryOutput> = await dynamoClient.query(params).promise();
	return (activeChannels.Items ? activeChannels.Items : []) as Array<Channel>;
};

export const getLatestOnlineHostChannelList = async ({ channelId }: { channelId: string }): Promise<Array<Channel>> => {
	const params: DocumentClient.QueryInput = {
		TableName: LIVESTREAM_TABLE,
		IndexName: "channelId-channelStatus-index",
		KeyConditionExpression: "channelId = :channelId and channelStatus = :channelStatus",
		ExpressionAttributeValues: {
			":channelId": channelId,
			":channelStatus": "ACTIVE",
		},
	};
	const activeChannels: DynOutWithError<DocumentClient.QueryOutput> = await dynamoClient.query(params).promise();
	return (activeChannels.Items ? activeChannels.Items : []) as Array<Channel>;
};

export const getHostChannel = async ({ channelId, createTs }: { channelId: string; createTs: number }): Promise<Channel> => {
	const params: DocumentClient.GetItemInput = {
		TableName: LIVESTREAM_TABLE,
		Key: { channelId, createTs },
	};

	const activeChannels: DynOutWithError<DocumentClient.GetItemOutput> = await dynamoClient.get(params).promise();
	return activeChannels.Item as Channel;
};

export const getAllOnlineChannels = async (): Promise<Array<Channel>> => {
	const params: DocumentClient.QueryInput = {
		TableName: LIVESTREAM_TABLE,
		IndexName: "channelStatusHostIndex",
		KeyConditionExpression: "channelStatus= :channelStatus",
		ExpressionAttributeValues: {
			":channelStatus": "ACTIVE",
		},
	};

	const activeChannels: DynOutWithError<DocumentClient.QueryOutput> = await dynamoClient.query(params).promise();
	return activeChannels.Items as Array<Channel>;
};

export const getChannelByChannelStatusName = async ({
	channelStatus,
	channelName,
	channelType,
}: {
	channelStatus: string;
	channelName: string;
	channelType?: string;
}) => {
	const params: DocumentClient.QueryInput = {
		TableName: LIVESTREAM_TABLE,
		IndexName: "channelStatus-channelName-index",
		KeyConditionExpression: "channelStatus= :channelStatus and begins_with(channelName, :queryName)",
		ExpressionAttributeValues: {
			":channelStatus": channelStatus,
			":queryName": channelName,
		},
	};
	if (channelType) {
		params.FilterExpression = "channelType = :channelType";
		(params.ExpressionAttributeValues as DocumentClient.ExpressionAttributeValueMap)[":channelType"] =
			channelType;
	}
	const activeChannels: DynOutWithError<DocumentClient.QueryOutput> = await dynamoClient.query(params).promise();
	return activeChannels.Items as Array<Channel>;
};

export const disableHostChannel = async ({
	channelId,
	createTs,
	channelStatus,
	hostUserWaitlist,
	hostCurrentChannel,
	includedParams,
	returnParams,
}: {
	channelId: string;
	createTs: number;
	channelStatus: string;
	hostUserWaitlist: any;
	hostCurrentChannel: AstrologerCurrentChannel;
	includedParams?: TransactWriteItemList;
	returnParams?: boolean;
}): Promise<TransactWriteItemList> => {
	const params: DocumentClient.TransactWriteItemsInput = {
		TransactItems: [
			{
				Update: {
					TableName: LIVESTREAM_TABLE,
					Key: {
						channelId,
						createTs,
					},
					UpdateExpression: "set channelStatus = :channelStatus",
					ExpressionAttributeValues: {
						":channelStatus": channelStatus,
					},
				},
			},
			{
				Update: {
					TableName: ASTROLOGER_TABLE,
					Key: {
						id: channelId,
					},
					ExpressionAttributeNames: { "#available": "available" },
					UpdateExpression:
						"set #available = :available, waitlist = :userWaitlist, currentChannel = :currentChannel",
					ExpressionAttributeValues: {
						":available": 0,
						":currentChannel": hostCurrentChannel,
						":userWaitlist": hostUserWaitlist,
					},
				},
			},
		],
	};
	console.log("retunrParams value is ", returnParams);
	if (includedParams) params.TransactItems.push(...includedParams);
	if (returnParams) {
		console.log("disableHostChannl returnParams true", params.TransactItems);
		return params.TransactItems;
	}
	console.log("DISABLE CHANNEL ", params)
	await dynamoClient
		.transactWrite(params)
		.promise();
	return {} as any;
};
