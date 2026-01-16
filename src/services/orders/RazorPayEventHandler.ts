import { Payments } from "razorpay/dist/types/payments";
// Supabase Migration: Using Supabase DAOs instead of DynamoDB
import { OrderDao } from "../../data-access-supabase/OrderDao";
import { UserDao } from "../../data-access-supabase/UserDao";
import { ChannelDao } from "../../data-access-supabase/ChannelDao";
import { publishMessage } from "../Pusher";
import { addPaymentDetailsHandler } from "./RazorPayService";
import { logInformation } from "../logging/CloudWatchService";
import { sendMessageToSQS } from "../queue-service/SqsConsumer";
import { Channel, TempHost } from "../../types/livestream/models/Livestream";
import { getUserOrderByUserIdTs, getSpecificUserOrderByUserIdTs, updateUserOrderTentativeTs } from "../../data-access/UserOrdersDao";
import { ProcessChannelApproxWaitTime } from "../../types/async-queue-service/QueueService";
import { EndUser } from "../../types/user/models/User";
import { Order } from "../../types/order/Orders";
import { updateUserBalanceAndOrderInChannel } from "../../data-access/multiple-access/UserBalanceInChannel";
import { USER_SEQUENCE_TABLE } from "../../constants/Config";

// Adapter functions to match the old DynamoDB interface
const editOrderStatus = OrderDao.editOrderStatus.bind(OrderDao);
const getOrderByRazorPayId = OrderDao.getOrderByRazorPayId.bind(OrderDao);
const getOrderByUserIdCreateTs = OrderDao.getOrderByUserIdCreateTs.bind(OrderDao);
const getUserById = UserDao.getUserById.bind(UserDao);
const updateUserBalance = UserDao.updateUserBalance.bind(UserDao);
const getHostChannel = ChannelDao.getHostChannel.bind(ChannelDao);
const getLatestOnlineHostChannel = ChannelDao.getLatestOnlineHostChannel.bind(ChannelDao);

export const razorPayEventHandler = async ({ eventRawContent }: { eventRawContent: any }) => {
	console.log(eventRawContent);
	// if (!eventRawContent) {
	//     throw {statusCode: 400, code: "RazorPayContentError", message: "Could not parse raw content"}
	// }
	switch (eventRawContent.event) {
		case "payment.authorized":
		case "payment.failed":
		case "payment.captured": {
			console.log("payment.captured ", JSON.stringify(eventRawContent));

			return await handlePaymentAuthorized({
				paymentEntity: eventRawContent.payload.payment.entity,
			});
		}
		case "order.paid": {
			console.log("order.paid", JSON.stringify(eventRawContent));
			return await handleOrderPaid({
				paymentEntity: eventRawContent.payload.order.entity,
			});
		}
		default: {
			return;
		}
	}
};

const handlePaymentAuthorized = async ({ paymentEntity }: { paymentEntity: Payments.RazorpayPayment }) => {
	console.log("in handlePaymentAuthorized");
	console.log(paymentEntity);
	if (paymentEntity.status == "failed" || paymentEntity.status == "captured") {
		const orderData = await getOrderByRazorPayId({
			razorPayOrderId: paymentEntity.order_id,
		});
		logInformation({
			logType: "info",
			title: `User Payment Order ${paymentEntity.status.toUpperCase()}`,
			information: {
				userId: orderData.razorPayOrderId,
				amount: orderData.amount,
				timestamp: orderData.createTs,
				orderId: orderData.razorPayOrderId,
			},
		});
	}
	const response = await addPaymentDetailsHandler({ paymentEntity });
	return response;
};

export const handleOrderPaid = async ({ paymentEntity }: { paymentEntity: Payments.RazorpayPayment }) => {
	// Get order
	const orderDetails = await getOrderByRazorPayId({
		razorPayOrderId: paymentEntity.order_id,
	});

	if (!orderDetails) {
		throw {
			statusCode: 404,
			code: "OrderNotFound",
			message: "Could not find order",
		};
	}

	// update User Balance in the object
	const userData = await getUserById(orderDetails.userId);

	console.log("the user data before balance ", userData, orderDetails.amount)

	userData.balance += orderDetails.amount;
	if (!userData?.balance) {
		userData.balance = orderDetails.amount;
	}
	let transactMethodArgs: any = {
		userData,
		orderDetails,
		ts: userData?.currentUserOrder?.userOrderTs
	};
	
	if (userData.currentUserOrder?.channelId) {
		const transactDataToAppend = await handleOrderPaidInChannel({ userData, orderDetails });
		transactMethodArgs.channel = transactDataToAppend.channel;
	}

	await updateUserBalanceAndOrderInChannel(transactMethodArgs);

	logInformation({
		logType: "info",
		title: "User Paid Payment Order",
		information: {
			userId: orderDetails.razorPayOrderId,
			amount: orderDetails.amount,
			timestamp: orderDetails.createTs,
			orderId: orderDetails.razorPayOrderId,
		},
	});

	console.log("The userId and createTs are: ", JSON.stringify(orderDetails));
	const response = await getOrderByUserIdCreateTs({userId: orderDetails?.userId, createTs: orderDetails?.createTs});
	console.log("THE ORDER RESP: ", response);
	return response;
};

const handleOrderPaidInChannel = async ({
	userData,
	orderDetails,
}: {
	userData: EndUser;
	orderDetails: Order;
}): Promise<{
	channel: {
		channelId: string;
		createTs: number;
		tempHost: TempHost;
	};
}> => {
	const channelData: Channel = await getHostChannel({
		channelId: userData.currentUserOrder?.channelId,
		createTs: userData.currentUserOrder?.channelCreateTs,
	});
	// goes in queue

	const currentChannelRate = channelData?.rate;
	const queryDelayTimeoutMinutes = userData.balance / currentChannelRate;

	const userOrderData = await getSpecificUserOrderByUserIdTs({
		userId: userData?.id,
		ts: userData?.currentUserOrder.userOrderTs,
	});

	// new query tiem
	const newOrderTentativeEndTs = userOrderData.orderTentativeEndTs + (orderDetails.amount / currentChannelRate) * 60000;

	// update User order tentative time inside the TempHost and the UserOrder table;
	const tempHost = channelData.tempHost;
	tempHost.orderTentativeEndTs = newOrderTentativeEndTs;

	console.log("the user order tentative ts is ", tempHost?.orderTentativeEndTs);

	await updateUserOrderTentativeTs({
		userId: userData?.id,
		ts: userData?.currentUserOrder?.userOrderTs,
		channel: {
			channelId: userData.currentUserOrder.channelId,
			createTs: userData.currentUserOrder.channelCreateTs,
			tempHost: tempHost,
		},
	});

	handleOrderPaidInChannelPostProcess({userData, queryDelayTimeoutMinutes, channelData})
	return {
		channel: {
			channelId: userData?.currentUserOrder?.channelId,
			createTs: userData?.currentUserOrder?.channelCreateTs,
			tempHost: tempHost,
		},
	};
};


const handleOrderPaidInChannelPostProcess = async ({userData, queryDelayTimeoutMinutes, channelData }: {userData: EndUser, queryDelayTimeoutMinutes: number, channelData: Channel}) => {

	publishMessage({
		uri: "public_" + userData.currentUserOrder.channelId,
		action: userData.currentUserOrder.channelType.toUpperCase() + "_TEMPHOST_UPDATE",
		message: "Temphost Update",
	});
	await sendMessageToSQS({
		messageRequest: {
			timeToDelay: Math.min(queryDelayTimeoutMinutes * 60, 15 * 60),
			requestType: "validateTempHostBalance",
			data: {
				channelId: channelData?.channelId,
				channelType: channelData?.tempHost?.channelType,
				userId: channelData.tempHost?.id,
			},
		},
	});
	await sendMessageToSQS({
		messageRequest: {
			requestType: "processChannelApproxWaitTime",
			timeToDelay: 1,
			data: {
				channelId: channelData?.channelId,
				channelType: channelData?.channelType,
				includeWaitlist: false,
			} as ProcessChannelApproxWaitTime,
		},
	});
}