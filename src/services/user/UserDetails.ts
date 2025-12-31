// Supabase Migration: Using Supabase DAOs instead of DynamoDB
import { UserDao } from "../../data-access-supabase/UserDao";
import { EndUser } from "../../types/user/models/User";
import { invalidParameter } from "../../utils/ErrorUtils";
import { handleChannelOffer, handleChannelRate } from "./UserPricingService";

// Adapter functions to match the old DynamoDB interface
const updateUserBalance = UserDao.updateUserBalance.bind(UserDao);
const updateUserIsSupportStatus = UserDao.updateUserIsSupportStatus.bind(UserDao);
const updateUserLastOnlineTs = UserDao.updateUserLastOnlineTs.bind(UserDao);

type UserHandlerFunction = ({
	id, value
}: {
	id: string, value: any
}) => Promise<EndUser>;


export const userPatchHandler = ({
	op,
	path,
}: {
	op: string;
	path: string;
}) : UserHandlerFunction => {
	switch (op) {
		case "REPLACE":
			return replaceHandler({ path });
		default:
			throw {
				statusCode: 400,
				code: "INVALID_PARAM",
				message: invalidParameter(op),
			};
	}
};

const replaceHandler = ({ path }: { path: string }): UserHandlerFunction => {
	switch (path.toLowerCase()) {
		// case "status":
		// 	return statusHandler;
		case "lastonlinets": { 
			return onlineTsHandler;
		}
		// case "balance":
		// 	return balanceHandler;
		case "issupport": {
			return isSupportHandler;
		}
		default:
			throw {
				statusCode: 400,
				code: "INVALID_PARAM",
				message: invalidParameter(path),
			};
	}
};

// const statusHandler = async (
// 	id: string,
// 	value: any,
// ): Promise<EndUser> => {
// 	switch (value.toUpperCase()) {
// 		case "ONLINE":
// 		case "ONLIVESTREAM":
// 		case "ONCHAT":
// 		case "ONCALL":
// 		case "OFFLINE":
// 			return await updateUserCallStatus({id, status: value });
// 		default:
// 			throw {
// 				statusCode: 400,
// 				code: "INVALID_PARAM",
// 				message: invalidParameter(value),
// 			};
// 	}
// };


const isSupportHandler = async ({id, value}: {id: string, value: boolean}) => {

	if (typeof value != 'boolean') {
		throw {
			statusCode: 400,
			code: "INVALID_PARAM",
			message: invalidParameter("value"),
		};
	}
	const dbValue = value ? "true" : "false";
	return updateUserIsSupportStatus({id, status: dbValue})
}

const onlineTsHandler = async ({id, value}: {id: string, value: string}) => {
	return updateUserLastOnlineTs({id});
}

const balanceHandler = async (
	id: string,
	value: any,
): Promise<EndUser> => {
	console.log(value);

	if (!value.available || !value.temporary) {
		throw {
			statusCode: 400,
			code: "INVALID_PARAM",
			message: invalidParameter(value),
		};
	}
	return await updateUserBalance({ id, balance: value });
};
