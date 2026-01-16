import express from "express";
import { NextFunction } from "express";
import {
	getLatestOnlineHostChannel,
	getHostChannel,
	updateTempHost,
	updateWaitlist,
} from "../../data-access-supabase/ChannelDao";
import { getUserById } from "../../data-access-supabase/UserDao";
import {
	handleAddToTempHost,
} from "../../services/channel/temp-host-service/AddTempHostHandler";
import { publishMessage } from "../../services/Pusher";
import { invalidParameter, missingParameter } from "../../utils/ErrorUtils";

const router = express.Router({ mergeParams: true });
import { ChannelType, TempHost, Waitlist } from "../../types/livestream/models/Livestream";
import { Channel } from "../../types/livestream/models/Livestream";
import {
	AddTempHostRequest,
	GetTempHostRequest,
	UpdateTempHostRequest,
} from "../../types/livestream/request/Request";
import {
	AddTempHostResponse,
	GetTempHostResponse,
	UpdateTempHostResponse,
} from "../../types/livestream/response/Response";
import getLogger from "../../services/Logger"
import { tempHostPatchHandler } from "../../services/channel/temp-host-service/BaseHandler";
import { channel } from "node:diagnostics_channel";
import { sendMessageToSQS } from "../../services/queue-service/SqsConsumer";
const logger = getLogger();

router.use(express.json());


router.get("/", getChannelTempHostController);
router.post("/", addChannelTempHostController);
router.patch("/:userId", updateChannelTempHostController);
/**
 * get temp host of a channel
 * @date 3/23/2024 - 11:19:24 AM
 *
 * @async
 * @param {GetTempHostRequest} req
 * @param {GetTempHostResponse} res
 * @returns {*}
 */
async function getChannelTempHostController(
	req: GetTempHostRequest,
	res: GetTempHostResponse,
	next:NextFunction
){
	// #swagger.tags = ['Channel']
	// #swagger.summary = 'Get temporary host of a Channel'
	// #swagger.parameters['channelId'] = {description: "channelId of channel", required: true, type: "string"}
	/*
	#swagger.responses[200] = {
		"description" : "Details of the temporary host",
		"schema": 
			{
				"name": "ishan",
				"uid": 10,
				"requestedTime": 1712727631201,
				"id": "01HV38AWF9SHJMV10292ZRSMSF",
				"callStatus": "online",
				"status": "REQUESTED"
			}
		
	}
	*/
	try {
		const {channelType, channelId} : {channelType ?: ChannelType, channelId : string} = req.params;
		
		if (!channelType) {
			throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("channelType")};
			return;
		}
		const channelIndex: Array<Channel> = await getLatestOnlineHostChannel({
			channelId,
		}) as Array<Channel>;
		if (!channelIndex) {
			throw {statusCode: 400, code: "ChannelNotFound", message: "Channel not found"};
			return;
		}
		const channel = channelIndex.find(value => value.channelType.toLowerCase() == channelType.toLowerCase())
		if (!channel) {
			throw {statusCode: 400, code: "ChannelNotFound", message: "Channel not found"};
			return;
		}
		const channelObj = await getHostChannel(channel);
		const tempHost: TempHost = channelObj.tempHost;
		res.json(tempHost);
	} catch (error: any) {
		logger.error(error);
		next(error)
	}
};

/**
 * add a temphost to the livestream
 * @date 3/23/2024 - 11:19:42 AM
 *
 * @async
 * @param {AddTempHostRequest} req
 * @param {AddTempHostResponse} res
 * @returns {*}
 */
async function addChannelTempHostController(
	req: AddTempHostRequest,
	res: AddTempHostResponse,
	next:NextFunction
){
	// #swagger.tags = ['Channel']
	// #swagger.summary = 'Add a temphost to a channel'
	// #swagger.parameters['channelId'] = {description: "channelId of channel\n - users callStatus cannot be ONCALL\n - users callStatus should be ONLINE", required: true, type: "string"}
	/*
	#swagger.parameters['body'] = {
		in: 'body', 
		description: "Details of the temporary host", 
		required: true, 
		"@schema": 
		{
			"properties": 
			{
				"id": {
					"type": "string", 
					"description": "identifier of the temporary host"
				},
				"uid": {
					"type" : "number",
					"description": "agora identifer of the temporary host"
				},
				"name" : {
					"type" : "string",
					"description" : "name of the temporary host",
				}
			}
		}
	}

	#swagger.responses[200] = {
		"description" : "Details of the temporary host",
		"schema": 
			{
				"name": "ishan",
				"uid": 10,
				"requestedTime": 1712727631201,
				"id": "01HV38AWF9SHJMV10292ZRSMSF",
				"callStatus": "online",
				"status": "REQUESTED"
			}
		
	}
	*/	try {
		const {channelType, channelId} : {channelType : ChannelType, channelId : string} = req.params;
		
		if (!channelType) {
			throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("channelType")};
			return;
		}


		const tempHost: TempHost & {uid: number} = req.body;
		tempHost.subType = tempHost.subType ? tempHost.subType : "NA";
		tempHost.channelType = channelType;


		if (!tempHost.id) {
			throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("id")};
		}

		if (!tempHost.uid) {
			throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("uid")};
		}

		if (!tempHost.name) {
			throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("name")};
		}


		console.time();
		const resp = await handleAddToTempHost({channelId, channelType, tempHost});
		console.timeEnd();
		res.json(resp);

		
		let pusherDataToSend: any = {...tempHost, status: "REQUESTED", channelId, channelType};
		
		await publishMessage({
			uri: `global_${channelId}`, //  update uri for unqiue => user id only 
			action: channelType.toUpperCase() + "_TEMPHOST_ADD",
			message: pusherDataToSend,
		});
		await publishMessage({
			uri: `global_${tempHost.id}`, //  update uri for unqiue => user id only 
			action: channelType.toUpperCase() + "_TEMPHOST_ADD",
			message: pusherDataToSend,
		});
		await publishMessage({
			uri: `public_${channelId}`, //  update uri for unqiue => user id only 
			action: channelType.toUpperCase() + "_TEMPHOST_ADD",
			message: pusherDataToSend,
		})
	} catch (error: any) {
		logger.error(error);
		next(error)
	}
};

/**
 * update temp host details
 * @date 3/23/2024 - 11:19:58 AM
 *
 * @async
 * @param {UpdateTempHostRequest} req
 * @param {UpdateTempHostResponse} res
 * @returns {*}
 */
async function updateChannelTempHostController(
	req: UpdateTempHostRequest,
	res: UpdateTempHostResponse,
	next: NextFunction
){ 
	
/*
	#swagger.tags = ['Channel']
	#swagger.summary = 'Update temporary hosts status in a channel'
	#swagger.parameters['channelId'] = {description: "channelId of channel", required: true, type: "string"}
	/*
	#swagger.parameters['body'] = 
	{
		in: "body",
		description: "patch request operation values.",
		'@schema': 
		{
			"required": ["op", "path", "value"], 
		 	"properties" : 
			{
				"op" : {
					"type" : "string",
					"description": "operation for patch request: {REPLACE, ADD}",
				},
				"path" : {
					"type": "string",
					"description": "value to change {status} "
				},
				"value" : {
					"type": "string",
					"description": "status value\n[ACCEPTED, REJECTED, TERMINATED_BY_(ASTROLOGER, USER, SYSTEM)]",
				}
				
			}
		}
	};  

	#swagger.responses[200] = {
		"description" : "Details of the temporary host",
		"schema": 
			{
				"name": "ishan",
				"uid": 10,
				"requestedTime": 1712727631201,
				"id": "01HV38AWF9SHJMV10292ZRSMSF",
				"callStatus": "online",
				"status": "REJECTED"
			}
		
	}
	*/
		try {
		const {channelType, channelId, userId} : {channelType : ChannelType, channelId : string, userId: string} = req.params;
		const patchReq = req.body;
	
		if (!patchReq.op) {
			throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("op")};
			return;
		}

		if (!patchReq.path) {
			throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("path")};
			return;
		}
		if (!patchReq.value) {
			throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("value")};
			return;
		}

		const { op, path, value } = patchReq;

		console.time();
		const patchHandler = tempHostPatchHandler({ op: op.toUpperCase(), path: path.toUpperCase() });
		const resp = await patchHandler({ channelId, status: value, userId, channelType});
		resp.status = value;

		console.timeEnd();
		
		publishMessage({
			uri: `global_${resp.id}`,
			action: channelType.toUpperCase() + "_TEMPHOST_UPDATE",
			message: resp,
		});
		publishMessage({
			uri: `global_${channelId}`,
			action: channelType.toUpperCase() + "_TEMPHOST_UPDATE",
			message: resp,
		});
		publishMessage({
			uri: `public_${channelId}`,
			action: channelType.toUpperCase() + "_TEMPHOST_UPDATE",
			message: resp,
		});
		res.json(resp);
		return;
	} catch (error: any) {
		logger.error(error)
		next(error)
	}
};

export default router;