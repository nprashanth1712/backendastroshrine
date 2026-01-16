import { DocumentClient } from "aws-sdk/clients/dynamodb";
import { ASTROLOGER_ORDER_TABLE, dynamoClient, USER_TABLE, USERORDER_TABLE } from "../../constants/Config";
import { AstrologerOrder } from "../../types/order/AstrologerOrder";
import { UserOrder } from "../../types/order/UserOrder";

export const initializeAstrologerAndUserOrder = async ({
	userId,
	hostId,
	userName,
	hostName,
	amount,
	orderType,
	subOrderType,
}: {
	userId: string;
	hostId: string;
	userName: string;
	hostName: string;
	amount: number;
	orderType: string;
	subOrderType: string;
	timestamp?: number;
}) => {
	const timestamp = Date.now();
	const userOrder: UserOrder = {
		userId,
		hostId,
		hostIdTs: hostId + "#" + timestamp,
		orderType,
		userName,
		hostName,
		subOrderType,
		ts: timestamp,
		amount,
		status: "Initialized",
		orderTentativeEndTs: timestamp,
		orderEndTs: timestamp,
	};
	const astrologerOrder: AstrologerOrder = {
		astrologerId: hostId,
		orderTs: timestamp,
		timeSpent: 0,
		orderType,
		subOrderType,
		customerId: userId,
		amount,
	};
	const params: DocumentClient.TransactWriteItemsInput = {
		TransactItems: [
			{
				Put: {
					TableName: USERORDER_TABLE,
					Item: userOrder,
				},
			},
            {
                Put: {
                    TableName: ASTROLOGER_ORDER_TABLE,
					Item: astrologerOrder,
                }
            },
            {
                Update: {
                    TableName: USER_TABLE,
                    Key: {
                        id: userId
                    },
                    UpdateExpression: `set balance = balance - :giftAmount`,
                    ExpressionAttributeValues: {":giftAmount": amount}
                }
            }
		],
	};

    await dynamoClient.transactWrite(params).promise();
    return userOrder;
};
