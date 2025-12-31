import { Payments } from "razorpay/dist/types/payments";
// Supabase Migration: Using Supabase DAOs instead of DynamoDB
import { OrderDao } from "../../data-access-supabase/OrderDao";
import { invalidOperation, invalidParameter } from "../../utils/ErrorUtils";

// Adapter functions to match the old DynamoDB interface
const editOrderStatus = OrderDao.editOrderStatus.bind(OrderDao);
const getOrderByRazorPayId = OrderDao.getOrderByRazorPayId.bind(OrderDao);
import { handleOrderPaid } from "./RazorPayEventHandler";
import { addPaymentDetailsHandler, razorpay } from "./RazorPayService";
import { sendMessageToSQS } from "../queue-service/SqsConsumer";
import { Order } from "../../types/order/Orders";
import { stringify } from "querystring";
import { InitializeNotificationRequest, UserNotificationNameSpace } from "../../types/async-queue-service/NotificationTypes";

enum OrderStates {
	CREATED,
	CANCELLED,
	PAID,
	FAILED,
}

type ValidStatusTransitions = {
	[key: string]: string[];
};
const ValidStatusTransitions: ValidStatusTransitions = Object.freeze({
	CREATED: ["CANCELLED", "PAID", "FAILED"],
	CANCELLED: [],
	PAID: [],
});

// const validTransition = (currentStatus: string, newStatus: string) => {
// 	switch(currentStatus) {
// 		if ()
// 	}
// }

export const orderGetHandler = async (orderId: string) => {
	return await getOrderByRazorPayId({ razorPayOrderId: orderId });
};

export const orderPatchHandler = ({ op, path }: { op: string; path: string }) => {
	switch (op.toUpperCase()) {
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

const replaceHandler = ({ path }: { path: string }) => {
	switch (path.toUpperCase()) {
		case "STATUS":
			return handleUpdateOrderStatus;

		default:
			throw {
				statusCode: 400,
				code: "INVALID_PARAM",
				message: invalidParameter(path),
			};
	}
};

const handleUpdateOrderStatus = async ({ orderId, status }: { orderId: string; status: string }) => {
	const orderData = await getOrderByRazorPayId({ razorPayOrderId: orderId });
	const razorPayPaymentInfoList = await razorpay.orders.fetchPayments(orderId);
	const razorPayPaymentInfo: Payments.RazorpayPayment = razorPayPaymentInfoList.items.at(-1) as Payments.RazorpayPayment;
	
	
	console.log("razorpay info ", razorPayPaymentInfo);
	if (!razorPayPaymentInfoList?.entity) {
		throw {
			statusCode: 400,
			code: "CannotPatchOrder",
			message: "The payment hasn't been initialize",
		};
	}
	// if (!ValidStatusTransitions[orderData.status.toUpperCase()].includes(status.toUpperCase()))
	// 	throw {
	// 		statusCode: 400,
	// 		code: "INVALID_OPERATION",
	// 		message: invalidOperation(`Invalid status transition : ${(orderData.status as string, status)}`),
	// 	};

	let returnValueOfOrder: Order = {} as Order;
	switch (status.toUpperCase()) {


		case "PAID": {
			await addPaymentDetailsHandler({ paymentEntity: razorPayPaymentInfo });
			const razorPayOrderInfo = await razorpay.orders.fetch(razorPayPaymentInfo.order_id);
			if (razorPayOrderInfo.status != "paid") {
				// only do this sqs message if the user is currently inside a channel as a temphost
				throw { statusCode: 400, code: "CannotPatchOrder", message: "The order is not paid" };
			}
			returnValueOfOrder = await handleOrderPaid({ paymentEntity: razorPayPaymentInfo });
			break;
		}



		case "FAILED": {
			await addPaymentDetailsHandler({ paymentEntity: razorPayPaymentInfo });
			returnValueOfOrder = await editOrderStatus({
				userId: orderData.userId,
				createTs: orderData.createTs,
				status: status.toUpperCase(),
			});
			break;
		}



		case "CANCELLED": {
			if (razorPayPaymentInfoList.items.at(-1)?.captured) {
				throw { statusCode: 400, code: "CannotCancelOrder", message: "Order is already paid." };
			}
			returnValueOfOrder = await editOrderStatus({
				userId: orderData.userId,
				createTs: orderData.createTs,
				status: status.toUpperCase(),
			});
			break;
		}


		default: {
			throw { statusCode: 400, code: "InvalidStatus", message: "The status is invalid for the order" };
		}
	}
	
	orderStatusPostProcessing({userId: orderData?.userId, status: status, amount: orderData?.amount, ts: orderData?.createTs});
	
	return returnValueOfOrder;
};

const orderStatusPostProcessing = async ({
	userId,
	status,
	amount,
	ts,
}: {
	userId: string;
	status: string;
	amount: number;
	ts: number;
}) => {
	await sendMessageToSQS({
		messageRequest: {
			requestType: "initializeNotification",
			timeToDelay: 0,
			data: {
				subType: "walletrechargenotification",
				notificationData: {
					userId,
					status,
					amount,
					ts,
				} as UserNotificationNameSpace.WalletRecharge,
			} as InitializeNotificationRequest,
		},
	});
};
