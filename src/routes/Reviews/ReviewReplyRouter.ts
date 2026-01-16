import express, { Request, Response, NextFunction } from "express";
import { addNewReview, getAllHostReviews, getReview, replyReview } from "../../data-access/ReviewsDao";
import getLogger from "../../services/Logger";
import { ReplyReviewMessageData } from "../../types/reviews/Request";
import { missingParameter } from "../../utils/ErrorUtils";
import { sendMessageToSQS } from "../../services/queue-service/SqsConsumer";
import { InitializeNotificationRequest, UserNotificationNameSpace } from "../../types/async-queue-service/NotificationTypes";
import { Review, ReviewView } from "../../types/reviews/Reviews";

const logger = getLogger();
const router = express.Router({ mergeParams: true });
router.use(express.json());

const getReplyRouter = async (req: Request, res: Response, next: NextFunction) => {
	// #swagger.tags = ['User Review Control']
	// #swagger.summary = 'Get reply for a review'
	/*#swagger.description = 'Require userId, and hostId and ts\n '
	
	#swagger.parameters['userId'] = {
		"required": "true",
		"type": "string", 
		"description": "id of the user that reviewed"
	}
	#swagger.parameters['hostId'] = {
		"required": "true",
		"type": "string", 
		"description": "id of the host"
	}
	#swagger.parameters['ts'] = {
		"required": "true",
		"type": "number", 
		"description": "the timestamp of the review."
	}
	#swagger.responses[200] = {
		"description" : "Review data ",
		schema: {
            "userName": "isan",
            "comment": "hi there",
            "reply": "",
            "hostId": "01J6VDPDEGZN7DED7TAWFQ3NWK",
            "rating": 3,
            "tsUserId": "1731059521080#01HV9QW1W342YY2T6C4N7NVSRM"
        }
	}
	*/
	try {
		const { id, userId, ts } = req.params;
		const resData = await getReview({ hostId: id, tsUserId: ts.toString() + "#" + userId });
		return res.status(200).json(resData);
	} catch (e) {
		logger.error(e);
		next(e);
	}
};

const replyReviewRouter = async (req: ReplyReviewMessageData, res: Response, next: NextFunction) => {
	// #swagger.tags = ['User Review Control']
	// #swagger.summary = 'Start an order for userId for amount'
	/*#swagger.description = 'Require userId, and amount\n '
	#swagger.parameters['userId'] = {
		"required": "true",
		"type": "string", 
		"description": "id of the user that reviewed"
	}
	#swagger.parameters['hostId'] = {
		"required": "true",
		"type": "string", 
		"description": "id of the host"
	}
	#swagger.parameters['ts'] = {
		"required": "true",
		"type": "number", 
		"description": "the timestamp of the review."
	}
		#swagger.parameters['body'] = 
	{
		in: "body",
		description: "userId and amount.",
		'@schema': 
		{
			"required": ["message"], 
		 	"properties" : 
			{
				"message" : {
					"type" : "string",
					"description": "userId of the user",
				},
			}
		}
	};  
	#swagger.responses[200] = {
		"description" : "Review data ",
		schema: {
            "userName": "isan",
            "comment": "hi there",
            "reply": "",
            "hostId": "01J6VDPDEGZN7DED7TAWFQ3NWK",
            "rating": 3,
            "tsUserId": "1731059521080#01HV9QW1W342YY2T6C4N7NVSRM"
        }
	}
	*/
	try {
		const { id, userId, ts } = req.params;
		const { message } = req.body;
		if (!message) {
			throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("message")};
			return;
		}
		console.log("TSUSERID ", ts + '#' + userId)
		await replyReview({ hostId: id, tsUserId: ts + "#" + userId, reply: message });
		
		await sendMessageToSQS({
			messageRequest: {
				requestType: "initializeNotification",
				timeToDelay: 0,
				data: {
					subType: "astrologerreviewnotification",
					notificationData: {
						hostId: id,
						userId,
						userName: "",
						hostName: "",
						ts: parseInt(ts),
						message: message ?? "",
						isReply: true,
					},
				} as InitializeNotificationRequest,
			},
		});

		const resData = await getReview({hostId: id, tsUserId: ts + "#" + userId});
		const responseReturn: ReviewView = {
            hostId: resData.hostId,
            comment: resData.comment,
            rating: resData.rating,
            name: resData.userName,
            ts: parseInt(resData.tsUserId.split('#')[0]),
            userId: resData.tsUserId.split('#')[1],
            reply: resData.reply, 
        }
		return res.status(200).json(responseReturn);
	} catch (e) {
		logger.error(e);
		next(e);
	}
};

router.get("/:userId/:ts", getReplyRouter);
router.post("/:userId/:ts", replyReviewRouter);

export default router;
