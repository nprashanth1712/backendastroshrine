import { NextFunction, Request, Response } from "express";

import express from "express";

import getLogger from "../../services/Logger";
import {
	getHostOrderListByTs,
	getHostAndUserOrderListByTs,
	initializeUserOrder,
	getUserOrderListByTs,
	getSpecificUserOrderByUserIdTs,
	updateUserOrderTentativeTs,
	updateUserOrderEndTs,
} from "../../data-access/UserOrdersDao";
import { invalidParameter, missingParameter } from "../../utils/ErrorUtils";
import { UserOrder } from "../../types/order/UserOrder";
import { getUserById } from "../../data-access/UserDao";
import { userOrderPatchHandler } from "../../services/user-order/UserOrderPatchHandler";
import { Route53RecoveryControlConfig } from "aws-sdk";

const logger = getLogger();
const router = express.Router({ mergeParams: true });

// only for testing purpose
const addUserOrderRouter = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	 /* 
        #swagger.tags = ['User Order Control']
	#swagger.summary = 'ONLY FOR TESTING PURPOSE, initialize a new order'
	
	#swagger.parameters['id'] = {
		"required": "true",
		"type": "string", 
		"description": "id of the user"
	}
	#swagger.parameters['hostId'] = {
		"required": "true",
		"type": "string", 
		"description": "id of the host"
	}
        #swagger.parameters['body'] = 
	{
		in: "body",
		description: "Add a new order to the database for the user.",
		'@schema': 
                {
			"required": ["orderType", "subOrderType"], 
		 	"properties" : 
                        {
				"orderType" : {
					"type" : "string",
					"description": "orders type",
				},
			        "subOrderType" : {
					"type": "string",
					"description": "orders sub type"
				},
		        	
            }
		}
	}; 

        */
	const { id, hostId } = req.params;
	const { orderType, subOrderType } = req.body;
	if(!orderType){
		throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("orderType")};
		return;
	}
	if(!subOrderType){
		throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("subOrderType")};
		return;
	}
	try {
		const userData = await getUserById(id);
		if (!userData?.id) {
			throw {statusCode: 400, code: "UserNotFound", message: "User Not Found"};
			return;
		}
		const hostData = await getUserById(hostId);
		if (!hostData?.id) {
			throw {statusCode: 400, code: "AstrologerNotFound", message: "The astrologer was not found"};
			return;
		}
		const resp = await initializeUserOrder({
			userId: id,
			userName: userData?.name, 
			hostId,
			hostName: hostData?.name,
			orderType,
			subOrderType,
		});
		res.status(200).json(resp);
	} catch (error: any) {
		logger.error(error);
		next(error);
	}
};

const getHostAndUserOrderByTsRouter = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	 // #swagger.tags = ['User Order Control']
	// #swagger.summary = 'Retrieve a users order information by a host by timestamp'
	
         /*
		 
	#swagger.parameters['startTs'] = {
        "in": "query",
		"required": "true",
		"type": "string", 
		"description": "starting ts to get order from"
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
		"description": "end timestamp till where to get order"
	}
        #swagger.parameters['key'] = {
        "in": "query",
		"required": "true",
		"type": "string", 
		"description": "the key from which to get the left orders from, used for pagination"
	}
         #swagger.responses[200] = {
                "description": "Details of the user order",
                "schema": [
    {
        "ts": 1733301543243,
        "hostId": "01J6VDPDEGZN7DED7TAWFQ3NWK",
        "orderType": "CONSULTATION",
        "hostIdTs": "01J6VDPDEGZN7DED7TAWFQ3NWK#1733301543243",
        "userId": "01JDVMQ65RZWCR4ZWCFTT46VWC",
        "subOrderType": "livestream",
        "status": "Initialized",
        "amount": 400
    },]
        }
*/
	try {
		const { hostId, id } = req.params;
		const startTs = req.query.startTs as string;
		const endTs = req.query.endTs as string;
		//const page = req.query.page as string;
		const key = req.query.key as string;

		if(!startTs || startTs.length != 13 || isNaN(parseInt(startTs))) {
			throw {statusCode: 400, code: "InvalidParameter", message: invalidParameter("startTs")};
			return;
		} 

		if(!endTs || endTs.length != 13 || isNaN(parseInt(endTs))) {
			throw {statusCode: 400, code: "InvalidParameter", message: invalidParameter("endTs")};
			return;
		} 
		// if(isNaN(parseInt(page))) {
		// 	res.status(400).json({err: invalidParameter('page')});
		// 	return;
		// } 
		const resp = await getHostAndUserOrderListByTs({
			userId: id, 
			hostId,
			startTs: parseInt(startTs),
			endTs: parseInt(endTs),
			key,
		});

		// resp.sort((a, b) => {
		// 	return a.ts - b.ts;
		// });

		// const itemsPerPage = 4;
        // const items = resp.slice(itemsPerPage*parseInt(page), itemsPerPage*parseInt(page) + itemsPerPage) ;

		res.status(200).json(resp);
	} catch (error) {
		logger.error(error);
		next(error);
	}
};

const getUserOrderListByTsRouter = async (req: Request, res: Response, next: NextFunction) => {

	 // #swagger.tags = ['User Order Control']
	// #swagger.summary = 'Retrieve a users order information by timestamp'
	
         /*
		 
	#swagger.parameters['startTs'] = {
        "in": "query",
		"required": "true",
		"type": "string", 
		"description": "starting ts to get order from"
	}
	#swagger.parameters['endTs'] = {
        "in": "query",
		"required": "true",
		"type": "string", 
		"description": "end timestamp till where to get order"
	}
        #swagger.parameters['key'] = {
        "in": "query",
		"required": "true",
		"type": "string", 
		"description": "the key from which to get the left orders from, used for pagination"
	}
         #swagger.responses[200] = {
                "description": "Details of the user order",
                "schema": [
    {
        "ts": 1733301543243,
        "hostId": "01J6VDPDEGZN7DED7TAWFQ3NWK",
        "orderType": "CONSULTATION",
        "hostIdTs": "01J6VDPDEGZN7DED7TAWFQ3NWK#1733301543243",
        "userId": "01JDVMQ65RZWCR4ZWCFTT46VWC",
        "subOrderType": "livestream",
        "status": "Initialized",
        "amount": 400
    },]
        }
	*/

	console.log("Hi!!")
	const { id } = req.params;
	const startTs = req.query.startTs as string;
	const endTs = req.query.endTs as string;
	const key = req.query.key as string;
	
	// if(!startTs || startTs.length != 13 || isNaN(parseInt(startTs))) {
	// 	res.status(400).json({err: invalidParameter('startTs')});
	// 	return;
	// } 

	// if(!endTs || endTs.length != 13 || isNaN(parseInt(endTs))) {
	// 	res.status(400).json({err: invalidParameter('endTs')});
	// 	return;
	// } 
	try {
		const userDetails = await getUserById(id); 
		let resp: Array<UserOrder>;
		if (userDetails.balance == 0) {
			resp = await getHostOrderListByTs({hostId: id, endTs, startTs: startTs, key})
		} else  {
			resp = await getUserOrderListByTs({userId: id, startTs, endTs, key});
		}
		res.status(200).json(resp);
	} catch(error) {
		
		console.log("Consultation History Response: " + error)
		next(error);
	}
}


const getSpecificUserOrderByUserIdTsRouter = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const {id, timestamp} = req.params;
		if (!timestamp || timestamp.length != 13 || isNaN(parseInt(timestamp))) {
			throw {statusCode: 400, code: "InvalidParameter", message: invalidParameter("timestamp")};
			return;
		}
		const response = await getSpecificUserOrderByUserIdTs({userId: id, ts: parseInt(timestamp)});
		res.json(response);
	} catch(error) {
		logger.error(error);
		next(error);
	}
}

// use for updating tentative and end ts AND userOrder recordingAvailable through daemon only
// assuming if you update tentativeTs, temphost data will also be updated
const updateUserOrderTimestampData = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const {id, timestamp} = req.params;
		if (!timestamp || timestamp.length != 13 || isNaN(parseInt(timestamp))) {
			throw {statusCode: 400, code: "InvalidParameter", message: invalidParameter("timestamp")};
			return;
		}
		const {op, path, value} = req.body;
		
		if (!op) {
			throw {statusCode: 400, code: "InvalidParameter", message: invalidParameter("op")};
            return; 
        }
        if (!path) {
			throw {statusCode: 400, code: "InvalidParameter", message: invalidParameter("path")};
            return; 
        }
     
		const patchHandler = userOrderPatchHandler({op, path});

		const userOrderData =  await patchHandler({userId: id, ts: parseInt(timestamp), value})
		res.status(200).json(userOrderData);
	} catch(error) {
		logger.error(error)
		next(error);

	}
}
router.get("/", getUserOrderListByTsRouter);
router.get("/host/:hostId", getHostAndUserOrderByTsRouter);
router.post("/:hostId", addUserOrderRouter);
router.get('/:timestamp', getSpecificUserOrderByUserIdTsRouter);
router.patch("/:timestamp", updateUserOrderTimestampData);
export default router;
