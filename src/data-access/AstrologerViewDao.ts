import { DocumentClient } from "aws-sdk/clients/dynamodb";
import { ASTROLOGER_TABLE, dynamoClient } from "../constants/Config";
import { DynOutWithError } from "../types/Common";
import { Astrologer, AstrologerViewCache } from "../types/astrologer/Astrologer";

export const getAstrologerViewData = async (id: string) => {
	const params = {
		TableName: ASTROLOGER_TABLE,
		Key: {
			id,
		},
	};
	const resp: DynOutWithError<DocumentClient.GetItemOutput> = await dynamoClient.get(params).promise();
	const astrologerDetails = resp.Item as Astrologer;
	console.log(astrologerDetails);
	const response: AstrologerViewCache = {
		hostProfile: {
			aboutMe: astrologerDetails?.hostProfile?.aboutMe,
			gender: astrologerDetails?.hostProfile?.gender,
			experience: astrologerDetails?.hostProfile?.experience,
			languages: astrologerDetails?.hostProfile?.languages,
			orders: astrologerDetails?.hostProfile?.orders,
			expertise: astrologerDetails?.hostProfile?.expertise,
			followers: astrologerDetails?.hostProfile?.followers,
			media: astrologerDetails?.hostProfile?.media,
			channelTimeSpent: astrologerDetails?.hostProfile?.channelTimeSpent,
			topReviews: astrologerDetails?.hostProfile?.topReviews,
		},
		ranking: astrologerDetails?.ranking,
		name: astrologerDetails?.name,
		id: astrologerDetails?.id,
		pricingData: astrologerDetails?.pricingData,
		currentChannel: astrologerDetails?.currentChannel,
		dataHash: astrologerDetails?.dataHash,
		// orders: astrologerDetails?.hostProfile?.orders,
	};
	return response;
};
