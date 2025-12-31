import express, { Request, Response, NextFunction, response } from "express";
import { addNewReview, getAllHostReviews, replyReview } from "../../data-access/ReviewsDao";
import getLogger from "../../services/Logger";
import { ReplyReviewMessageData } from "../../types/reviews/Request";

import ReviewReplyRouter from "./ReviewReplyRouter";
import { invalidParameter, missingParameter } from "../../utils/ErrorUtils";
import { getUserById } from "../../data-access/UserDao";
import { Review, ReviewView } from "../../types/reviews/Reviews";
import { InitializeNotificationRequest } from "../../types/async-queue-service/NotificationTypes";
import { sendMessageToSQS } from "../../services/queue-service/SqsConsumer";

const logger = getLogger();
const router = express.Router({ mergeParams: true });
router.use(express.json());

// this should be only used by the host
const getAllHostReviewsRouter = async (req: Request, res: Response, next: NextFunction) => {
	// #swagger.tags = ['User Review Control']
	// #swagger.summary = 'Get all reviews from startTs to endTs '
	/*#swagger.description = 'Require hostId, startTs, endTs and key\n '
	
	#swagger.parameters['startTs'] = {
        "in": "query",
		"required": "true",
		"type": "string", 
		"description": "starting ts to get reviews from"
	}
	#swagger.parameters['hostId'] = {
		"required": "true",
		"type": "string", 
		"description": "id of the host"
	}
	#swagger.parameters['endTs'] = {
        "in": "query",
		"required": "true",
		"type": "string", 
		"description": "end timestamp till where to get reviews"
	}
        #swagger.parameters['key'] = {
        "in": "query",
		"required": "true",
		"type": "string", 
		"description": "the key from which to get the left reviews from, used for pagination"
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
		const { id } = req.params;
		const startTs = req.query.startTs as string;
		const endTs = req.query.endTs as string;
		const key = req.query.key as string;

		if (!startTs && startTs?.length != 13) {
			throw {statusCode: 400, code: "InvalidParameter", message: invalidParameter("startTs")};
			return;
		}
		if (!endTs && endTs?.length != 13) {
			throw {statusCode: 400, code: "InvalidParameter", message: invalidParameter("endTs")};
			return;
		}
		const exclusiveStartKey = {
			hostId: id,
			tsUserId: key,
		};
		if (key && key.length != 13) {
			throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("key")};
			return;
		}
		const data: Array<Review> = await getAllHostReviews({ hostId: id, startTs, endTs, exclusiveStartKey });

		// const itemsPerPage = 10;
		// let pageExist = parseInt(page)? parseInt(page): 0;
		// const items = data.slice(itemsPerPage*pageExist, itemsPerPage*pageExist + itemsPerPage) ;
		const returnData: Array<ReviewView> = data.map((value: Review) => ({
			hostId: value.hostId,
			comment: value.comment,
			rating: value.rating,
			reply: value.reply,
			userName: value.userName,
			ts: parseInt(value.tsUserId.split("#")[0]),
			userId: value.tsUserId.split("#")[1],
		}));
		return res.status(200).json(returnData);
	} catch (e) {
		logger.error(e);
		next(e);
	}
};

// used only by the user
const addReviewRouter = async (req: Request, res: Response, next: NextFunction) => {
	// #swagger.tags = ['User Review Control']
	// #swagger.summary = 'Add a review for a host'
	/*#swagger.description = 'Require userId, and amount\n '
	#swagger.parameters['hostId'] = {
		"required": "true",
		"type": "string", 
		"description": "id of the host"
	}
		#swagger.parameters['body'] = 
	{
		in: "body",
		description: "userId and amount.",
		'@schema': 
		{
			"required": ["userId", "userName", "rating", "message"], 
		 	"properties" : 
			{
				"message" : {
					"type" : "string",
					"description": "comment",
				},
                "userId" : {
					"type" : "string",
					"description": "userId of the user",
				},
                "userName" : {
					"type" : "string",
					"description": "userName of the user",
				},
                "rating" : {
					"type" : "number",
					"description": "rating to give to the host",
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
	}
	*/
	try {
		const { id } = req.params;
		const { userName, userId, rating, message } = req.body;

		if (!userId) {
			throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("userId")};
			return;
		}
		if (!userName) {
			throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("userName")};
			return;
		}
		if (!rating) {
			throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("rating")};
			return;
		}
		const resData = await addNewReview({ userId, userName, hostId: id, rating, message: message ? message : "" });

		const responseReturn: ReviewView = {
			hostId: resData.hostId,
			comment: resData.comment,
			rating: resData.rating,
			name: resData.userName,
			ts: parseInt(resData.tsUserId.split("#")[0]),
			userId: resData.tsUserId.split("#")[1],
			reply: "",
		};
		await sendMessageToSQS({
			messageRequest: {
				requestType: "initializeNotification",
				timeToDelay: 0,
				data: {
					subType: "astrologerreviewnotification",
					notificationData: {
						hostId: id,
						userId,
						userName,
						hostName: "",
						ts: parseInt(resData.tsUserId.split("#")[0]),
						message: message ?? "",
						isReply: false,
					},
				} as InitializeNotificationRequest,
			},
		});
		return res.status(200).json(responseReturn);
	} catch (e) {
		logger.error(e);
		next(e);
	}
};

router.get("/", getAllHostReviewsRouter);
router.post("/", addReviewRouter);
router.use("/reply", ReviewReplyRouter);
export default router;
