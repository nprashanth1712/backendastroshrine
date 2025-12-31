// Supabase Migration: Using Supabase DAOs instead of DynamoDB
import { UserDao } from "../../data-access-supabase/UserDao";
import { EndUser } from "../../types/user/models/User";
import { ChatHelpers } from "../chat/ChatHelpers";

// Adapter functions to match the old DynamoDB interface
const getAllSupportUsers = UserDao.getAllSupportUsers.bind(UserDao);

export namespace SupportUserHelper {
	export const getLeastBusySupportUser = async (): Promise<EndUser> => {
		const supportUserList: Array<EndUser> = await getAllSupportUsers();


		console.log("THE SUPPORT USER LIST IS ", supportUserList)
		if (supportUserList.length == 0) {
			throw {
				statusCode: 404,
				code: "SupportUserNotFound",
				message: "There are no support users",
			};
		}
		let leastBusyUser = supportUserList[0];
		let leastBusyUserCount = Number.MAX_SAFE_INTEGER;

		for await (const supportUser of supportUserList) {
			let data = await ChatHelpers.getChatKeysByUserIdHandler({ userId: supportUser?.id });
			data = data.filter(value => value.status == "ACTIVE") 
			if (data.length < leastBusyUserCount) {
				leastBusyUser = supportUser;
				leastBusyUserCount = data.length;
			}
		}

		return leastBusyUser;
	};
}
