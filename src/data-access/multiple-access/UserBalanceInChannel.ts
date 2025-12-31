import { DocumentClient } from "aws-sdk/clients/dynamodb";
import { TempHost } from "../../types/livestream/models/Livestream";
import { dynamoClient, LIVESTREAM_TABLE, ORDER_TABLE, USER_TABLE, USERORDER_TABLE } from "../../constants/Config";
import { UserOrder } from "../../types/order/UserOrder";
import { EndUser } from "../../types/user/models/User";
import { Order } from "../../types/order/Orders";

export const updateUserBalanceAndOrderInChannel = async ({
	userData,
	orderDetails,
	channel,
	ts,
}: {
	userData: EndUser;
	orderDetails: Order;
	channel?: { channelId: string; createTs: number; tempHost: TempHost };
	ts: number;
}) => {

	console.log("The user for order is ", userData)
	const userInChannelParams: DocumentClient.TransactWriteItemsInput = {
		TransactItems: [
			{
				Update: {
					TableName: ORDER_TABLE,
					Key: {
						userId: userData?.id,
						createTs: orderDetails?.createTs,
					},
					UpdateExpression: "set #status = :status",
					ExpressionAttributeNames: { "#status": "status" },
					ExpressionAttributeValues: { ":status": "PAID" },
				},
			},
			{
				Update: {
					TableName: USER_TABLE,
					Key: {
						id: userData?.id,
					},
					UpdateExpression: "set balance = :balance",
					ExpressionAttributeValues: { ":balance": userData?.balance },
				},
			},
		],
	};

    if (channel?.channelId) {
        console.log("the channel data inside order is ", channel);
        userInChannelParams.TransactItems.push(
            {
				Update: {
					TableName: USERORDER_TABLE,
					Key: {
						userId: userData?.id,
						ts,
					},
					UpdateExpression: "set orderTentativeEndTs = :newTs",
					ExpressionAttributeValues: {
						":newTs": channel?.tempHost.orderTentativeEndTs,
					},
				},
			},
			{
				Update: {
					TableName: LIVESTREAM_TABLE,
					Key: {
						channelId: channel?.channelId,
						createTs: channel?.createTs,
					},
					UpdateExpression: "set tempHost = :tempHost",
					ExpressionAttributeValues: { ":tempHost": channel?.tempHost },
				},
			},
        )
    }

    console.log("Transact for order is ", JSON.stringify(userInChannelParams, null, 2));
	await dynamoClient.transactWrite(userInChannelParams).promise();
	console.log("REACHED HERE");
	return { userId: userData?.id, ts: ts, orderTentativeEndTs: channel?.tempHost?.orderTentativeEndTs } as UserOrder;
};
