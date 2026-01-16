import dotenv from "dotenv";
dotenv.config();

import { ulid } from "ulid";

import { DynOutWithError } from "../types/Common";
import { DocumentClient } from "aws-sdk/clients/dynamodb";
import { ASTROLOGER_TABLE, dynamoClient, NOTIFICATONS_TABLE } from "../constants/Config";
import { USER_TABLE, USER_SEQUENCE_TABLE } from "../constants/Config";
import {
	Astrologer,
	AstrologerCurrentChannel,
	AstrologerCurrentOffer,
	HostProfile,
	PricingData,
	UserWaitlist,
} from "../types/astrologer/Astrologer";
import { Waitlist } from "../types/livestream/models/Livestream";
import { EndUser, JoinedChannel, RejectedSessionListForUser } from "../types/user/models/User";
import { AstrologerRequest } from "../types/astrologer/Request";
import { generateAstrologerAboutMe } from "../services/openai-service/ClientResponse";

// currently required fields = id, uid, name, phoneNumber,
export const addAstrologer = async ({userData, astrologerDetails} : {userData: EndUser, astrologerDetails: AstrologerRequest.AstrologerDetails}): Promise<Astrologer> => {
	
	
	const astrologerId = ulid();

	const generatedAboutMe = await generateAstrologerAboutMe({astrologerDetails: {...astrologerDetails, name: userData.name, gender: userData.profile.gender}});

	console.log("The generated about me is ", generatedAboutMe)
	const astrologerData: Astrologer = {
		id: astrologerId,
		currentOffer: {} as AstrologerCurrentOffer,
		hostProfile: {
			gender: userData?.profile?.gender,
			experience: 0,
			earnings: 0,
			orders: 0,
			expertise: [],
			followers: 0,
			channelTimeSpent: {
				chat: 0,
				livestream: 0,
				call: 0,
			},

			profilePic: " ''",
			languages: ["English", "Hindi"],
			media: [],
			...astrologerDetails,
			aboutMe: generatedAboutMe
		},
		pricingData: {
			livestream: { rate: 1, offer: 0 },
			chat: { rate: 1, offer: 0 },
			call: { rate: 1, offer: 0 },
		},
		waitlist: { livestream: [], call: [], chat: [] } as UserWaitlist,
		name: userData.name,
		phoneNumber: userData.phoneNumber,

		lastOnlineTs: Date.now(),
		available: 1,
		currentChannel: {
			livestream: { enabled: false, approxTime: 0 },
			chat: { enabled: false, approxTime: 0 },
			call: { enabled: false, approxTime: 0 },
		},
		ranking: 100,
	};


	console.log("THE WHOLE ASTROLOGER IS ", astrologerData)
	const transactData: DocumentClient.TransactWriteItemsInput = {
		TransactItems: [
			{
				Put: {
					TableName: ASTROLOGER_TABLE,
					Item: astrologerData,
					ConditionExpression: "attribute_not_exists(id)",
				},
			},
			{
				Put: {
					TableName: "Settings",
					Item: {
						userId: astrologerId,
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
						id: astrologerId,
						inAppNotifications: [],
						pushNotifications: [],
					},
				},
			},
		],
	};
	await dynamoClient.transactWrite(transactData).promise();
	return astrologerData as Astrologer;
};

export const updateAstrologerPricingData = async ({ id, pricingData }: { id: string; pricingData: PricingData }) => {
	const params = {
		TableName: ASTROLOGER_TABLE,
		Key: {
			id,
		},
		UpdateExpression: "set pricingData = :pricingData",
		ExpressionAttributeValues: { ":pricingData": pricingData },
		ReturnValues: "ALL_NEW",
	};
	const resp = await dynamoClient.update(params).promise();
	return (await resp.Attributes) as Astrologer;
};

export const updateAstrologerHostProfile = async ({
	id,
	hostProfile,
	name,
}: {
	id: string;
	hostProfile: HostProfile;
	name: string;
}) => {
	const params = {
		TableName: ASTROLOGER_TABLE,
		Key: {
			id,
		},
		UpdateExpression: "set #name = :userName, hostProfile = :hostProfile",
		ExpressionAttributeNames: { "#name": "name" },
		ExpressionAttributeValues: { ":userName": name, ":hostProfile": hostProfile },
		ReturnValues: "ALL_NEW",
	};
	const resp = await dynamoClient.update(params).promise();
	return resp.Attributes as HostProfile;
};

export const updateAstrologerPersonalWaitlist = async ({
	id,
	waitlist,
	userId,
	joinedChannels,
	rejectedList,
}: {
	id: string;
	waitlist: {
		livestream: Array<Waitlist>;
		call: Array<Waitlist>;
		chat: Array<Waitlist>;
	};
	userId: string;
	joinedChannels: Array<JoinedChannel>;
	rejectedList?: Array<RejectedSessionListForUser>;
}) => {
	let updateParamsForUser = "set joinedChannels = :joinedChannels";
	let expressionAttributeValues: any = {
		":joinedChannels": joinedChannels,
	};
	if (rejectedList && rejectedList.length > 0) {
		updateParamsForUser += `, rejectedSessionList = :rejectedList`;
		expressionAttributeValues[":rejectedList"] = rejectedList ?? [];
	}
	const params: DocumentClient.TransactWriteItemsInput = {
		TransactItems: [
			{
				Update: {
					TableName: ASTROLOGER_TABLE,
					Key: {
						id,
					},
					UpdateExpression: "set waitlist = :waitlist",
					ExpressionAttributeValues: { ":waitlist": waitlist },
				},
			},
			{
				Update: {
					TableName: USER_TABLE,
					Key: {
						id: userId,
					},
					UpdateExpression: updateParamsForUser,
					ExpressionAttributeValues: expressionAttributeValues,
				},
			},
		],
	};
	console.log("inside the astrloger waitlist", JSON.stringify(params.TransactItems, null, 2));
	const resp = await dynamoClient.transactWrite(params).promise();
	return waitlist;
};

export const updateAstrologerName = async ({ id, name }: { id: string; name: string }) => {
	const params = {
		TableName: ASTROLOGER_TABLE,
		Key: {
			id,
		},
		UpdateExpression: "set #name = :name",
		ExpressionAttributeNames: { "#name": "name" },
		ExpressionAttributeValues: { ":name": name },
		ReturnValues: "ALL_NEW",
	};
	const resp = await dynamoClient.update(params).promise();
	return resp.Attributes as Astrologer;
};

export const updateAstrologerAvailability = async ({
	id,
	available,
	returnParams,
}: {
	id: string;
	available: 1 | 0;
	returnParams?: boolean;
}) => {
	const params: DocumentClient.UpdateItemInput = {
		TableName: ASTROLOGER_TABLE,
		Key: {
			id,
		},
		UpdateExpression: "set #available = :available",
		ExpressionAttributeNames: { "#available": "available" },
		ExpressionAttributeValues: { ":available": available },
		ReturnValues: "ALL_NEW",
	};
	const resp = await dynamoClient.update(params).promise();
	return (await resp.Attributes) as Astrologer;
};

export const updateAstrologerCurrentChannel = async ({
	id,
	currentChannel,
}: {
	id: string;
	currentChannel: AstrologerCurrentChannel;
}) => {
	const params: DocumentClient.UpdateItemInput = {
		TableName: ASTROLOGER_TABLE,
		Key: {
			id,
		},
		UpdateExpression: "set currentChannel = :currentChannel",
		ExpressionAttributeValues: { ":currentChannel": currentChannel },
		ReturnValues: "ALL_NEW",
	};
	const resp = await dynamoClient.update(params).promise();
	return (await resp.Attributes) as Astrologer;
};

export const updateAstrologerLastOnlineTs = async ({ id }: { id: string }) => {
	const params = {
		TableName: ASTROLOGER_TABLE,
		Key: {
			id,
		},
		UpdateExpression: "set lastOnlineTs = :lastOnlineTs",
		ExpressionAttributeValues: { ":lastOnlineTs": Date.now() },
		ReturnValues: "ALL_NEW",
	};
	const resp = await dynamoClient.update(params).promise();
	return (await resp.Attributes) as Astrologer;
};
export const updateAstrologerDataHash = async ({ id, dataHash }: { id: string; dataHash: string }) => {
	const params = {
		TableName: ASTROLOGER_TABLE,
		Key: {
			id,
		},
		UpdateExpression: "set dataHash = :dataHash",
		ExpressionAttributeValues: { ":dataHash": dataHash },
		ReturnValues: "ALL_NEW",
	};
	const resp = await dynamoClient.update(params).promise();
	return (await resp.Attributes) as Astrologer;
};

export const getAstrologerById = async (id: string): Promise<Astrologer> => {
	const params = {
		TableName: ASTROLOGER_TABLE,
		Key: {
			id,
		},
	};
	const resp: DynOutWithError<DocumentClient.GetItemOutput> = await dynamoClient.get(params).promise();
	return ((await resp.Item) || {}) as Astrologer;
};

export const getAllAstrologers = async (): Promise<Array<Astrologer>> => {
	const params = {
		TableName: ASTROLOGER_TABLE,
	};

	const users: DynOutWithError<DocumentClient.ScanOutput> = await dynamoClient.scan(params).promise();
	return (users.Items as Array<Astrologer>) || [];
};

export const getAstrologerByPhoneNumber = async ({ phoneNumber }: { phoneNumber: string }): Promise<Astrologer> => {
	const params: DocumentClient.QueryInput = {
		TableName: ASTROLOGER_TABLE,
		IndexName: "phoneNumber-index",
		KeyConditionExpression: "phoneNumber= :phoneNumber",
		ExpressionAttributeValues: {
			":phoneNumber": phoneNumber,
		},
	};

	const user: DynOutWithError<DocumentClient.QueryOutput> = await dynamoClient.query(params).promise();
	console.log(user);
	return user.Items?.[0] as Astrologer;
};

export const getAstrologerListByAvailable = async (available: number): Promise<Array<Astrologer>> => {
	const params: DocumentClient.QueryInput = {
		TableName: ASTROLOGER_TABLE,
		IndexName: "available-ranking-index",
		KeyConditionExpression: "#available = :available",
		ExpressionAttributeNames: { "#available": "available" },
		ExpressionAttributeValues: { ":available": available },
	};

	const users: DynOutWithError<DocumentClient.QueryOutput> = await dynamoClient.query(params).promise();
	return (users.Items as Array<Astrologer>) || [];
};

export const deleteAstrologer = async (id: string): Promise<Astrologer> => {
	const params = {
		TableName: ASTROLOGER_TABLE,
		Key: {
			id,
		},
	};
	const resp = await dynamoClient.delete(params).promise();
	return (await resp.Attributes) as Astrologer;
};
