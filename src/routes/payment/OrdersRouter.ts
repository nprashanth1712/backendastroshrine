import express, { NextFunction, Request, Response } from "express";

import getLogger from "../../services/Logger";
import Razorpay from "razorpay";
import { addPaymentDetailsHandler, initializeOrder, orderReplaceHandler, razorpay } from "../../services/orders/RazorPayService";
import { invalidParameter, missingParameter } from "../../utils/ErrorUtils";
import { editOrderStatus, getInitialOrderList, getOrderByRazorPayId, getOrderListByUserId } from "../../data-access/OrdersDao";
import { handleOrderPaid, razorPayEventHandler } from "../../services/orders/RazorPayEventHandler";
import { Order } from "../../types/order/Orders";
import { orderGetHandler, orderPatchHandler } from "../../services/orders/OrderService";
import { sendMessageToSQS } from "../../services/queue-service/SqsConsumer";
const logger = getLogger();

const router = express.Router({ mergeParams: true });
router.use(express.json());

const initializeOrderRouter = async (req: Request, res: Response, next: NextFunction) => {
	// #swagger.tags = ['Payment Control']
	// #swagger.summary = 'Start an order for userId for amount'
	/*#swagger.description = 'Require userId, and amount\n '
	
		#swagger.parameters['body'] = 
	{
		in: "body",
		description: "userId and amount.",
		'@schema': 
		{
			"required": ["userId", "amount"], 
		 	"properties" : 
			{
				"userId" : {
					"type" : "string",
					"description": "userId of the user",
				},
				"amount" : {
					"type": "number",
					"description": "amount of the order"
				},
			}
		}
	};  
	#swagger.responses[200] = {
		"description" : "List of payment order history",
		schema: [
			{
				"amount": 590,
				"createTs": 1733124935138,
				"razorPayOrderId": "order_PSE9XqzlDn82Ao",
				"paymentDetails": [
					{
						"method": "upi",
						"id": "pay_PSE9izrt8uixSz",
						"status": "authorized"
					},
					{
						"method": "upi",
						"id": "pay_PSE9izrt8uixSz",
						"status": "captured"
					}
				],
				"userId": "01JDVMQ65RZWCR4ZWCFTT46VWC",
				"status": "paid"
			},
		]
	}
	*/
	try {
		const body = req.body;
		if (!req.body.amount) {
			res.status(400).json({ err: missingParameter("amount") });
			return;
		}
		if (typeof req.body.amount != "number") {
			throw {statusCode: 400, code: "InvalidParameter", message: invalidParameter("amount") + "\nPlease enter a number" };
		}
		if (!req.body.userId) {
			res.status(400).json({ err: missingParameter("userId") });
			return;
		}
		let isDummyOrder = false;

		if (
			typeof req?.body?.isDummy == "boolean" &&
			req?.body?.isDummy == true &&
			process.env.DEV_ENVIRONMENT == "dev"
		) {
			isDummyOrder = true;
		}

		const ordersResponse = await initializeOrder({
			amount: body.amount,
			userId: body.userId,
			isDummy: isDummyOrder,
		});

		if (!isDummyOrder) {
			await sendMessageToSQS({
				messageRequest: {
					requestType: "validateRazorpayPayment",
					data: { orderId: ordersResponse.razorPayOrderId, tryCounter: 0 },
					timeToDelay: 0,
				},
			});
		}
		res.json(ordersResponse);
	} catch (err) {
		next(err);
	}
};

const getOrderListByUserIdRouter = async (req: Request, res: Response, next: NextFunction) => {
	// #swagger.tags = ['Payment Control']
	// #swagger.summary = 'Get Payment history by userId based on timestamp and last key'
	/* #swagger.description = 'Require userId, startTs, endTs and key.\n 
	"key" is used for timestamp of the last order's timestamp for next query.' 

	#swagger.parameters['startTs'] = {
		"in": "query",
		"required": "true",
		"type": "number", 
		"description": "timestamp from where to get the orders"
	}
	#swagger.parameters['endTs'] = {
		"required": "true",
		"type": "number", 
		"description": "timestamp till where to get the orders"
	}
	#swagger.parameters['key'] = {
		"required": "true",
		"type": "number", 
		"description": "the key of the last received orders timestamp for querying next."
	}
	#swagger.responses[200] = {
		"description" : "List of payment order history",
		schema: [
			{
				"amount": 590,
				"createTs": 1733124935138,
				"razorPayOrderId": "order_PSE9XqzlDn82Ao",
				"paymentDetails": [
					{},
					{
						"method": "upi",
						"id": "pay_PSE9izrt8uixSz",
						"status": "authorized"
					},
					{
						"method": "upi",
						"id": "pay_PSE9izrt8uixSz",
						"status": "captured"
					}
				],
				"userId": "01JDVMQ65RZWCR4ZWCFTT46VWC",
				"status": "paid"
			},
		]
	}
	*/
	try {
		const { userId } = req.params;
		const orderId = req.query.orderId as string;
		const startTs = req.query.startTs as string;
		const endTs = req.query.endTs as string;
		const key = req.query.key as string;

		if (orderId) {
			const response = await getOrderByRazorPayId({ razorPayOrderId: orderId });
			res.status(200).json(response);
			return;
		}
		if (!startTs || startTs.length != 13) {
			res.status(400).json({ err: invalidParameter("startTs") });
			return;
		}
		if (!endTs || endTs.length != 13) {
			res.status(400).json({ err: invalidParameter("endTs") });
			return;
		}
		const response = await getOrderListByUserId({
			userId,
			startTs: parseInt(startTs),
			endTs: parseInt(endTs),
			exclusiveStartKey: { userId, ts: parseInt(key) },
		});
		res.json(response);
		return;
	} catch (error) {
		next(error);
	}
};

const getOrderByRazorPayIdRouter = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const { orderId } = req.params;
		const response: Order = await getOrderByRazorPayId({ razorPayOrderId: orderId });
		res.status(200).json(response);
	} catch (error) {
		console.log("Error in getOrderByRazorPayIdRouter");
		next(error);
	}
};

const tryProcessOrderPaymentDetails = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const { orderId } = req.params;
		res.status(404);
		return;
	} catch (error) {
		console.log(error);
		next(error);
	}
};
// const addPaymentDetailsRouter = async (req: Request, res: Response, next: NextFunction) => {
//     const { id} = req.params;
//     const { paymentData } = req.body;
//     try {
//         const response = await addPaymentDetailsHandler({paymentEntity: paymentData})
//         console.log(response);
//         console.log("\n")
//         res.json(response)
//     } catch(error) {
//         next(error);
//     }
// }

const getOrderStateRouter = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const { orderId } = req.params;
		const response = await orderGetHandler(orderId);
		res.status(200).json(response);
	} catch (error) {
		logger.error(error);
		next(error);
	}
};

const updateOrderStatusRouter = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const { orderId } = req.params;
		const { op, path, value } = req.body;
		let realValue: boolean = true;
		if (!op) {
			res.status(400).json({ err: missingParameter("op") });
			return;
		}
		if (!path) {
			res.status(400).json({ err: missingParameter("path") });
			return;
		}
		if (!value) {
			res.status(400).json({ err: missingParameter("path") });
			return;
		}

		console.log("THE updateOrderStatusRouter was called with parameters: ", op, path, value);
		const patchHandler = orderPatchHandler({ op, path });
		const response: Order = await patchHandler({ orderId, status: value });
		res.status(200).json(response);
	} catch (error) {
		logger.error(error);
		next(error);
	}
};

router.post("/webhook", async (req: Request, res: Response, next: NextFunction) => {
	try {
		const body = req.body;
		const ret = await razorPayEventHandler({
			eventRawContent: req.body,
		});
		res.json(ret);
	} catch (error) {
		console.log(error);
		next(error);
	}
});

// router.post("/:id/payment", addPaymentDetailsRouter);
router.post("/", initializeOrderRouter);
router.get("/user/:userId", getOrderListByUserIdRouter);
router.get("/:orderId", getOrderByRazorPayIdRouter);
router.patch("/:orderId", updateOrderStatusRouter);
export default router;
