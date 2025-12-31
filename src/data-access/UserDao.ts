import { ulid } from "ulid";
import dotenv from "dotenv";
dotenv.config();

import { DynOutWithError } from "../types/Common";
import { DocumentClient } from "aws-sdk/clients/dynamodb";
import { dynamoClient, NOTIFICATONS_TABLE } from "../constants/Config";
import { USER_TABLE, USER_SEQUENCE_TABLE } from "../constants/Config";
import { CurrentUserOrder, EndUser, JoinedChannel, UserProfile } from "../types/user/models/User";

import { Waitlist } from "../types/livestream/models/Livestream";
import { DocumentClassifierDocumentTypeFormat } from "aws-sdk/clients/comprehend";
/**
 * add a new user to database
 * @date 3/23/2024 - 10:48:30 AM
 *
 * @async
 * @param {EndUser} user
 * @returns {Promise<EndUser>}
 */

export const initializeUser = async (userId: string, user: EndUser): Promise<EndUser> => {
	const userDetails = await getUserById(userId);
	// console.log("USER PROFILE:" + JSON.stringify(user.profile	));
	const item: EndUser = {
		id: userId,
		phoneNumber: userDetails.phoneNumber,
		name: user.name,
		balance: 0,
		lastOnlineTs: Date.now(),
		available: 0,
		profile:  {
			dateTimeOfBirth: user?.profile?.dateTimeOfBirth ?? 0,
			email: user?.profile?.email ?? "",
			gender: user?.profile?.gender ?? "" ,
			placeOfBirth: user?.profile?.placeOfBirth ?? {
				displayValue: "",
				geoLocation: {
					lat: 28.6139,
					long: 77.2088,
				},
			},
			aboutMe: user?.profile?.aboutMe ?? "",
			profilePic: user?.profile?.profilePic ?? "",
		},
		joinedChannels: [],
		availableOffers: [],
		rejectedSessionList: [],
		isSupport: "false",
		currentUserOrder: {} as CurrentUserOrder,
	};

	const transactParams: DocumentClient.TransactWriteItemsInput = {
		TransactItems: [
			{
				Put: {
					TableName: USER_TABLE,
					Item: item,
				},
			},
			{
				Put: {
					TableName: "Settings",
					Item: {
						userId,
						channel: {
							livestreamActive: true,
							chatActive: true,
							callActive: true,
						},
						appLanguage: "English",
					},
				},
			},
			{
				Put: {
					TableName: NOTIFICATONS_TABLE,
					Item: {
						id: userId,
						inAppNotifications: [],
						pushNotifications: [],
					},
				},
			},
		],
	};

	console.log("i am nice person", JSON.stringify(transactParams, null, 2));
	await dynamoClient.transactWrite(transactParams).promise();
	return item as EndUser;
};

/**
 * add a new user to database
 * @date 3/23/2024 - 10:48:30 AM
 *
 * @async
 * @param {EndUser} user
 * @returns {Promise<EndUser>}
 */
export const addUser = async (user: EndUser): Promise<EndUser> => {
	const uidPrmz: DynOutWithError<DocumentClient.UpdateItemOutput> = await nextUID();
	console.log("uidPrmx is " + JSON.stringify(uidPrmz));
	const uid: number = uidPrmz.Attributes?.nextUID;

	const item: EndUser = {
		name: user.name,
		phoneNumber: user.phoneNumber,
		id: user.id,
		balance: 0,
		available: 0,
		lastOnlineTs: Date.now(),
		profile: {} as UserProfile,
		availableOffers: [],
		rejectedSessionList: [],
		joinedChannels: [],
		isSupport: "false",
		currentUserOrder: {} as CurrentUserOrder,
	};
	const params = {
		TableName: USER_TABLE,
		Item: item,
		ConditionExpression: "attribute_not_exists(id)",
	};
	const data: DynOutWithError<DocumentClient.PutItemOutput> = await dynamoClient.put(params).promise();
	return item as EndUser;
};

export const updateUserProfile = async ({ id, profile }: { id: string; profile: UserProfile }) => {
	const params = {
		TableName: USER_TABLE,
		Key: {
			id,
		},
		UpdateExpression: "set profile = :profile",
		ExpressionAttributeValues: { ":profile": profile },
		ReturnValues: "ALL_NEW",
	};
	const resp = await dynamoClient.update(params).promise();
	return resp.Attributes as UserProfile;
};

export const updateUserBalance = async ({ id, balance }: { id: string; balance: number }) => {
	const params = {
		TableName: USER_TABLE,
		Key: {
			id,
		},
		UpdateExpression: "set balance = :balance",
		ExpressionAttributeValues: { ":balance": balance },
		ReturnValues: "ALL_NEW",
	};
	const resp = await dynamoClient.update(params).promise();
	return resp.Attributes as EndUser;
};

export const updateUserJoinedChannels = async ({ id, joinedChannels }: { id: string; joinedChannels: Array<JoinedChannel> }) => {
	const params = {
		TableName: USER_TABLE,
		Key: {
			id,
		},
		UpdateExpression: "set joinedChannels = :joinedChannels",
		ExpressionAttributeValues: { ":joinedChannels": joinedChannels },
		ReturnValues: "ALL_NEW",
	};
	const resp = await dynamoClient.update(params).promise();
	return resp.Attributes as EndUser;
};

export const addUserChannelTimeSpent = async ({
	id,
	channelTimeSpent,
}: {
	id: string;
	channelTimeSpent: { livestream: number; chat: number; call: number };
}) => {
	const params: DocumentClient.UpdateItemInput = {
		TableName: USER_TABLE,
		Key: {
			id,
		},
		UpdateExpression: `set channelTimeSpent = :channelTimeSpent`,
		ExpressionAttributeValues: { ":channelTimeSpent": channelTimeSpent },
		ReturnValues: "ALL_NEW",
	};
	const resp = await dynamoClient.update(params).promise();
	return resp.Attributes;
};

export const updateUserLanguages = async ({ id, languages }: { id: string; languages: Array<string> }) => {
	const params: DocumentClient.UpdateItemInput = {
		TableName: USER_TABLE,
		Key: {
			id,
		},
		UpdateExpression: `set languages = :langs`,
		ExpressionAttributeValues: { ":langs": languages },
		ReturnValues: "ALL_NEW",
	};
	const resp = await dynamoClient.update(params).promise();
	return resp.Attributes;
};

export const updateUserName = async ({ id, name }: { id: string; name: string }) => {
	const params = {
		TableName: USER_TABLE,
		Key: {
			id,
		},
		UpdateExpression: "set #name = :name",
		ExpressionAttributeNames: { "#name": "name" },
		ExpressionAttributeValues: { ":name": name },
		ReturnValues: "ALL_NEW",
	};
	const resp = await dynamoClient.update(params).promise();
	return resp.Attributes as EndUser;
};

export const updateUserAvailability = async ({ id, available }: { id: string; available: number }) => {
	const params: DocumentClient.UpdateItemInput = {
		TableName: USER_TABLE,
		Key: {
			id,
		},
		UpdateExpression: "set #available = :available",
		ExpressionAttributeNames: { "#available": "available" },
		ExpressionAttributeValues: { ":available": available },
		ReturnValues: "ALL_NEW",
	};
	const resp = await dynamoClient.update(params).promise();
	return resp.Attributes as EndUser;
};

export const updateUserLastOnlineTs = async ({ id }: { id: string }) => {
	const params = {
		TableName: USER_TABLE,
		Key: {
			id,
		},
		UpdateExpression: "set lastOnlineTs = :lastOnlineTs",
		ExpressionAttributeValues: { ":lastOnlineTs": Date.now() },
		ReturnValues: "ALL_NEW",
	};
	const resp = await dynamoClient.update(params).promise();
	return resp.Attributes as EndUser;
};

export const updateUserIsSupportStatus = async ({ id, status }: { id: string; status: string }) => {
	const params = {
		TableName: USER_TABLE,
		Key: {
			id,
		},
		UpdateExpression: "set isSupport = :isSupport",
		ExpressionAttributeValues: { ":isSupport": status },
		ReturnValues: "ALL_NEW",
	};
	const resp = await dynamoClient.update(params).promise();
	return resp.Attributes as EndUser;
};

export const nextUID = async (): Promise<DynOutWithError<DocumentClient.UpdateItemOutput>> => {
	const params = {
		TableName: USER_SEQUENCE_TABLE,
		Key: {
			seq: "seq",
		},
		UpdateExpression: "set nextUID = nextUID + :step",
		ExpressionAttributeValues: {
			":step": 1,
		},
		ReturnValues: "ALL_NEW",
	};

	return await dynamoClient.update(params).promise();
};

export const getUserById = async (id: string): Promise<EndUser> => {
	const params = {
		TableName: USER_TABLE,
		Key: {
			id,
		},
	};
	const resp: DynOutWithError<DocumentClient.GetItemOutput> = await dynamoClient.get(params).promise();
	return (resp.Item || {}) as EndUser;
};

export const getAllUsers = async (): Promise<Array<EndUser>> => {
	const params = {
		TableName: USER_TABLE,
	};

	const users: DynOutWithError<DocumentClient.ScanOutput> = await dynamoClient.scan(params).promise();
	return (users.Items as Array<EndUser>) || [];
};

export const getAllSupportUsers = async (): Promise<Array<EndUser>> => {
	const params: DocumentClient.QueryInput = {
		TableName: USER_TABLE,
		IndexName: "isSupport-index",
		KeyConditionExpression: "isSupport = :isSupportValue",
		ExpressionAttributeValues: { ":isSupportValue": "true" },
	};

	const response = await dynamoClient.query(params).promise();
	return response.Items as Array<EndUser>;
};
export const deleteUser = async (id: string): Promise<EndUser> => {
	const params = {
		TableName: USER_TABLE,
		Key: {
			id,
		},
	};
	const resp = await dynamoClient.delete(params).promise();
	return resp.Attributes as EndUser;
};

export const getUserByPhoneNumber = async ({ phoneNumber }: { phoneNumber: string }): Promise<EndUser> => {
	const params: DocumentClient.QueryInput = {
		TableName: USER_TABLE,
		IndexName: "userPhoneNumberGlobalIndex",
		KeyConditionExpression: "phoneNumber= :phoneNumber",
		ExpressionAttributeValues: {
			":phoneNumber": phoneNumber,
		},
	};

	const user: DynOutWithError<DocumentClient.QueryOutput> = await dynamoClient.query(params).promise();
	console.log(user);
	return user.Items?.[0] as EndUser;
};
