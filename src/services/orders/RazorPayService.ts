import Razorpay from "razorpay";
import { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } from "../../constants/Config";
// Supabase Migration: Using Supabase DAOs instead of DynamoDB
import { OrderDao } from "../../data-access-supabase/OrderDao";
import { Order, PaymentDetails } from "../../types/order/Orders";
import { invalidParameter } from "../../utils/ErrorUtils";
import { EndUser } from "../../types/user/models/User";
import { Payments } from "razorpay/dist/types/payments";
import { logInformation } from "../logging/CloudWatchService";
import { Orders } from "razorpay/dist/types/orders";
import { ulid } from "ulid";

// Adapter functions to match the old DynamoDB interface
const editUserPaymentDetails = OrderDao.editUserPaymentDetails.bind(OrderDao);
const getOrderByRazorPayId = OrderDao.getOrderByRazorPayId.bind(OrderDao);
const initializePaymentOrder = OrderDao.initializePaymentOrder.bind(OrderDao);

export const razorpay = new Razorpay({
	key_id: RAZORPAY_KEY_ID,
	key_secret: RAZORPAY_KEY_SECRET,
});

// export const initializeRazorpayOrder = async ({amount , userId}: {amount: number, userId: string}) => {
//     const receiptId =
//     const options = {
//         amount,
//         currency: "INR",
//         receipt: ""
//     }
// }
export const initializeOrder = async ({ amount, userId, isDummy}: { amount: number; userId: string, isDummy?: boolean}): Promise<Order> => {
	const options = {
		amount: amount,
		currency: "INR",
		receipt: "Unique ID for every order",
		payment_capture: 1,
	};
	try {
		const currentTime = Date.now();

		// HANDLE REAL OR DUMMY RESPONSE
		let response: Orders.RazorpayOrder;
		if (isDummy) {
			response = {id: 'dummy_' + ulid(), status: "PAID"} as any;
		} else {
			response = await razorpay.orders.create(options);
		}


		console.log(response);

		const orderResp = await initializePaymentOrder({
			id: response.id,
			userId,
			createTs: currentTime,
			amount: amount/1.18,
			status: response.status,
			paymentDetails: {} as PaymentDetails,
			isDummy
		});

		logInformation({
			logType: "info",
			title: "User initialized Payment Order",
			information: {
				userId: userId,
				amount: amount,
				timestamp: currentTime,
				orderId: orderResp.razorPayOrderId,
			},
		});
		console.log(orderResp);
		return orderResp as Order;
	} catch (err) {
		console.log(err);
		throw err;
	}
};

export const orderReplaceHandler = ({ op, path }: { op: string; path: string }) => {
	switch (op) {
		case "REPLACE": {
			return orderPathHandler({ path });
			3;
		}
		default: {
			throw {
				statusCode: 400,
				code: "INVALID_OPERATION",
				message: invalidParameter(op),
			};
		}
	}
};

const orderPathHandler = ({ path }: { path: string }) => {
	switch (path) {
		case "paymentDetails": {
			return addPaymentDetailsHandler;
		}
		default: {
			throw {
				statusCode: 400,
				code: "INVALID_PARAM",
				message: invalidParameter(path),
			};
		}
	}
};

// @TODO add a check for if payment is captured or soemthing lol
export const addPaymentDetailsHandler = async ({
	paymentEntity,
}: {
	paymentEntity: Payments.RazorpayPayment;
}): Promise<Order> => {
	const orderData: Order = (await getOrderByRazorPayId({ razorPayOrderId: paymentEntity.order_id })) as Order;
	if (!orderData) {
		throw { statusCode: 404, code: "OrderNotFound", message: "Could not find the order " };
		("");
	}
	if (["PAID", "CANCELLED"].includes(orderData.status.toUpperCase())) {
		throw {
			statusCode: 400,
			code: "CannotAddPayment",
			message: `Order is already ${orderData.status.toUpperCase()}`,
		};
	}
	console.log(orderData);
	const updatedPaymentArray = [
		...orderData.paymentDetails,
		{ id: paymentEntity.id, method: paymentEntity.method, status: paymentEntity.status.toUpperCase() },
	];

	const response = await editUserPaymentDetails({
		userId: orderData.userId,
		createTs: orderData.createTs,
		paymentDetails: updatedPaymentArray,
	});

	return response as Order;
};

// const paymentDetailsPatchHandler = async ({id, createTs, value} :
//     {id: string, createTs: number, value: PaymentDetails}) => {

//         if (!value.method || !value.status) {
//             throw {statusCode: 422, code: "INVALID_PAYMENT_PARAMS", message: "The payment details are not valid"}
//         }
//         const response = await editUserPaymentDetails({id, createTs, paymentDetails: value});
//         return response;

// }
