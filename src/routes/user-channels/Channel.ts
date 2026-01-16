import express, { NextFunction, Request, Response } from "express";

import ChannelWaitlistRouter from "./ChannelWaitlistRouter";
import ChannelTempHostRouter from "./ChannelTempHostRouter";
import ChannelHostRouter from "./channelHostRouter";
import { invalidParameter, missingParameter } from "../../utils/ErrorUtils";
import { toString } from "../../utils/StringUtils";
import { publishMessage, publishPushNotification } from "../../services/Pusher";
import { Channel, ChannelType, TempHost } from "../../types/livestream/models/Livestream";
import {
	GetUserLiveStreamRequest,
	EnableChannel,
	StopLiveStreamRequest,
	UpdateChannelStatusRequest,
} from "../../types/livestream/request/Request";
import {
	GetChannelsResponse,
	GetUserLiveStreamResponse,
	EnableChannelResponse,
	StopLiveStreamResponse,
} from "../../types/livestream/response/Response";
import getLogger from "../../services/Logger";
import {
	disableHostChannel,
	enableHostChannel,
	getAllOnlineChannels,
	getHostChannel,
	getLatestOnlineHostChannel,
	getLatestOnlineHostChannelList,
} from "../../data-access-supabase/ChannelDao";
import { channelStatusPatchHandler } from "../../services/channel/ChannelTypeService";
import { getUserById, updateUserAvailability } from "../../data-access-supabase/UserDao";
import { handleSendGiftToChannel } from "../../services/GiftService";

import { callTerminatedHandler } from "../../services/channel/temp-host-service/TerminatedHandler";
import { handleEnableHostChannel } from "../../services/channel/ChannelStart";
import { handleDisableChannel } from "../../services/channel/ChannelEnd";
import { Astrologer } from "../../types/astrologer/Astrologer";
import { EndUser } from "../../types/user/models/User";
import { getAstrologerById } from "../../data-access-supabase/AstrologerDao";

const logger = getLogger();

const router = express.Router();
router.use(express.json());

router.get("/:channelType?", getAllOnlineChannelsController);
router.post("/:channelType", enableHostChannelController);
router.get("/:channelType/:channelId", getHostChannelController);
router.post("/:channelType/:channelId/event", sendChannelEventRouter);
router.patch("/:channelType/:channelId", patchChannelStatusHandler);
router.delete("/:channelType/:channelId", disableHostChannelController);
router.use("/:channelType/:channelId/waitlist/", ChannelWaitlistRouter);
router.use("/:channelType/:channelId/temp-host", ChannelTempHostRouter);
router.use("/:channelType/:channelId/host/", ChannelHostRouter);

/**
 * get list of all livestreams
 * @date 3/23/2024 - 10:58:55 AM
 *
 * @async
 * @param {Request} req
 * @param {GetLiveStreamsResponse} res
 * @returns {*}
 */
async function getAllOnlineChannelsController(req: Request, res: GetChannelsResponse, next: NextFunction) {
	// #swagger.tags = ['Channel']
	// #swagger.summary = 'Get list of all active channels'
	/* 
	#swagger.responses[200] = {
		"description" : "List of all the active channels and their details.",
		"schema": [ 
			{
				"createTs": 1711790359043,
				"channelStatus": "ACTIVE",
				"channelId": "01HPKHMV21AYACVMEBFNZ406Q3",
				"host": {
					"uid": 63,
					"role": "USER",
					"balance": 0,
					"name": "Vaibhav",
					"phoneNumber": "+917722846537",
					"id": "01HPKHMV21AYACVMEBFNZ406Q3"
				}
			}
		]
	}
	*/

	try {
		console.time();
		const { channelType }: { channelType?: ChannelType } = req.params;

		// if (!channelType) {
		// 	res.status(400).json({ err: missingParameter("channelType") });
		// 	return;
		// }

		const channelIndex: Array<Channel> = await getAllOnlineChannels();
		const channels: Array<Channel> = await Promise.all(
			channelIndex.map(async (value) => {
				const currentChannel = await getHostChannel(value);
				return currentChannel;
			})
		);

		console.timeEnd();
		console.log(channels);
		let channelsArray: Array<Channel> = [];
		if (channelType) {
			channelsArray = channels.filter(
				(value) => value.channelType?.toLowerCase() == channelType.toLowerCase()
			);
		} else {
			channelsArray = channels;
		}
		channelsArray.sort((x, y) => {
			return x.ranking - y.ranking;
		});

		res.json(channelsArray ?? []);
	} catch (error) {
		logger.error(error);
		next(error);
	}
}

/**
 * start a new livestream
 * @date 3/23/2024 - 10:59:10 AM
 *
 * @async
 * @param {EnableChannel} req
 * @param {EnableChannelResponse} res
 * @returns {*}
 */
async function enableHostChannelController(req: EnableChannel, res: EnableChannelResponse, next: NextFunction) {
	/*
	#swagger.tags = ['Channel']
	#swagger.summary = 'Start a new channel with particular channelType'
	
	#swagger.parameters['body'] = 
	{
		in: "body",
		description: "Initialize channel with: \n
		channelId = hostId\n - host 	   = details of host starting the channel\n - if any channel exists\n - delete the current channel and initialize a new",
		'@schema': {
			"required": ["channelId", "host"], 
		 	"properties" : {
				"channelId" : {
				"type": "string",
				"description" : "identifier to uniquely determine single livestream"
				},
				"host":{
					"type" : "object",
					"properties": {
							"id" : {
								"type" : "string",
								"description": "identifier of the host",
							},
							"uid" : {
								"type": "number",
								"description": "identifier of the host for agora"
							},
							"name" : {
								"type": "string",
								"description": "name of the host",
							}
						
					}
				}
				
			}
		}
	}; 
	#swagger.responses[201] = {
		"description" : "Details of the newly created channel.",
		"schema": 
			{
				"createTs": 1711790359043,
				"channelStatus": "ACTIVE",
				"channelId": "01HPKHMV21AYACVMEBFNZ406Q3",
				"host": {
					"uid": 63,
					"role": "USER",
					"balance": 0,
					"name": "Vaibhav",
					"phoneNumber": "+917722846537",
					"id": "01HPKHMV21AYACVMEBFNZ406Q3"
				}
			}
		
	}
	*/

	const { channelId, host, deviceId } = req.body;
	const { channelType }: { channelType?: ChannelType } = req.params;
	try {
		console.time();
		console.log(channelId, host);
		if (!channelId) {
			throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("channelId")};
			return;
		}
		if (!channelType) {
			throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("channelType")};
			return;
		}
		if (!host) {
			throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("host")};
			return;
		}

		if (!host?.id) {
			throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("host.id")};
			return;
		}

		if (!host?.uid) {
			throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("host.uid")};
			return;
		}

		if (!host?.name) {
			throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("host.name")};
			return;
		}
		if (!deviceId) {
			throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("deviceId")};
			return;
		}
		const channel: Channel = await handleEnableHostChannel({
			host,
			channelId: host.id,
			deviceId,
			channelType: channelType ? channelType : "NONE",
		});
		publishMessage({
			uri: `public_${host.id}`,
			action: (channelType ? channelType.toUpperCase() : "CHANNEL") + "_STARTED",
			message: channel,
		});
		console.timeEnd();
		res.status(201).json(channel);
		// publishPushNotification({name : channel.channelId});
	} catch (error) {
		logger.error(error);
		next(error);
	}
}

async function sendChannelEventRouter(req: Request, res: Response, next: NextFunction) {
	/*
	#swagger.tags = ['Channel']
	#swagger.summary = 'Send an event to a channel/livestream joined -> Gift or Message'
	
	#swagger.parameters['body'] = 
	{
		in: "body",
		description: "Send only message if sending a message or send giftId if sending a gift",
		'@schema': {
			"required": ["userId"], 
		 	"properties" : {
				"userId" : {
				"type": "string",
				"description" : "Identifier of the user sending the event"
				},
				"giftId" : {
				"type": "string",
				"description" : "identifier of the gift"
				},
				"message" : {
				"type": "string",
				"description" : "The message to send to the livestream"
				},
				
			}
		}
	}; 
	#swagger.responses[200] = {
		"description" : "Success response.",
		"schema": 
			{
		"event" : "MessageOrGiftData"
		}
		
	}
	*/
	try {
		const { channelId, channelType } = req.params;
		const { userId, giftId, message } = req.body;

		if (!channelId) {
			throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("channelId")};
			return;
		}
		if (!channelType) {
			throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("channelType")};
			return;
		}

		if (!userId) {
			throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("userId")};
			return;
		}

		const isAstrologer = channelId == userId; 

		let senderData: Astrologer | EndUser;
		if (isAstrologer) {
			if (giftId) {
				throw {statusCode: 400, code: "CannotSendGift", message: "Astrologer could not sent the gift to themself."}
			}
			senderData = await getAstrologerById(userId);
		} else {
			senderData = await getUserById(userId);
		}
		let returnData;
		if (giftId) {
			returnData = await handleSendGiftToChannel({
				userId,
				hostId: channelId,
				giftId,
			});
			await publishMessage({
				uri: `public_${channelId}`,
				action: "LIVEGIFT",
				message: {
					userId: userId,
					data: giftId,
					ts: Date.now(),
					name: senderData.name,
				},
			});
		} else if (message) {
			returnData = message;
			await publishMessage({
				uri: `public_${channelId}`,
				action: "LIVEMESSAGE",
				message: {
					userId: userId,
					data: message,
					ts: Date.now(),
					name: senderData.name,
				},
			});
		} else {
			return res.status(400).json({ err: "Invalid params: Please provide message or giftId" });
		}

		res.status(200).json({ event: returnData });
	} catch (error) {
		logger.error(error);
		next(error);
	}
}
async function patchChannelStatusHandler(req: UpdateChannelStatusRequest, res: Response, next: NextFunction) {
	/*
	#swagger.tags = ['Channel']
	#swagger.summary = 'Update a channel type status '
	#swagger.parameters['channelId'] = { description: "channelId of channel", required: true, type: 'string' }
	#swagger.parameters['channelType'] = { description: "Type of the channel", required: true, type: 'string' }

	#swagger.parameters['body'] = 
	{
		in: "body",
		description: "Update using path as status",
		'@schema': {
			"required": ["op", "path", "value"], 
		 	"properties" : {
				"op" : {
				"type": "string",
				"description" : "operation in the patch ie REPLACE"
				},
				"path" : {
				"type": "string",
				"description" : "path ie status"
				},
				"value" : {
				"type": "string",
				"description" : "value for status"
				},
				}
				
			}
		}
	}; 
	#swagger.responses[200] = {
		"description" : "Details of the newly patched data.",
		"schema": 
			{
				"createTs": 1711790359043,
				"channelStatus": "ACTIVE",
				"channelId": "01HPKHMV21AYACVMEBFNZ406Q3",
				"host": {
					"uid": 63,
					"role": "USER",
					"balance": 0,
					"name": "Vaibhav",
					"phoneNumber": "+917722846537",
					"id": "01HPKHMV21AYACVMEBFNZ406Q3"
				}
			}
		
	}
	*/
	try {
		const { channelType, channelId }: { channelType: ChannelType; channelId: string } = req.params;
		const patchReq = req.body;

		if (!patchReq.op) {
			throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("op")};
			return;
		}

		if (!patchReq.path) {
			throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("path")};
			return;
		}

		const { op, path, value }: { op: string; path: string; value: any } = patchReq;
		const fullPath = channelType + "/" + path;
		const channelStatusHandler = channelStatusPatchHandler({
			op,
			path: fullPath,
		});
		const resp = await channelStatusHandler(channelId, value);
		// await publishMessage({
		// 	uri: `public_${channelId}`,
		// 	action: channelType.toUpperCase() + (value ? "_STARTED": "_ENDED"),
		// 	message: path.toUpperCase(),
		// });
		res.json(resp);
	} catch (error) {
		console.log(error);
		next(error);
	}
}
/**
 * get a particular livestream data
 * @date 3/23/2024 - 10:59:21 AM
 *
 * @async
 * @param {GetUserLiveStreamRequest} req
 * @param {GetUserLiveStreamResponse} res
 * @returns {*}
 */
async function getHostChannelController(req: GetUserLiveStreamRequest, res: GetUserLiveStreamResponse, next: NextFunction) {
	// #swagger.tags = ['Channel']
	// #swagger.summary = 'Get latest active users channel'
	// #swagger.parameters['channelId'] = { description: "channelId of channel", required: true, type: 'string' }
	/*
	#swagger.responses[200] = {
		"description" : "Details of the livestream with channelId = params.channelId.",
		"schema": 
			{
				"createTs": 1711790359043,
				"channelStatus": "ACTIVE",
				"channelId": "01HPKHMV21AYACVMEBFNZ406Q3",
				"host": {
					"uid": 63,
					"role": "USER",
					"balance": 0,
					"name": "Vaibhav",
					"phoneNumber": "+917722846537",
					"id": "01HPKHMV21AYACVMEBFNZ406Q3"
				}
			}
	}
	*/
	try {
		const { channelId, channelType }: { channelType?: ChannelType; channelId: string } = req.params;

		if (!channelId) {
			throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("channelId")};
			return;
		}
		if (!channelType) {
			throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("channelType")};
			return;
		}
		console.time();
		const channelIndex: Array<Channel> = (await getLatestOnlineHostChannel({
			channelId,
		})) as Array<Channel>;

		const channels: Array<Channel> = await Promise.all(
			channelIndex.map(async (value) => {
				const currentChannel = await getHostChannel(value);
				return currentChannel;
			})
		);
		console.timeEnd();
		res.json(channels.find((value) => value.channelType.toLowerCase() == channelType.toLowerCase()) ?? []);
	} catch (error) {
		logger.error(error);
		next(error);
	}
}

/**
 * stop an active livestream
 * @date 3/23/2024 - 10:59:33 AM
 *
 * @async
 * @param {StopLiveStreamRequest} req
 * @param {StopLiveStreamResponse} res
 * @returns {*}
 */
async function disableHostChannelController(req: StopLiveStreamRequest, res: StopLiveStreamResponse, next: NextFunction) {
	// #swagger.tags = ['Channel']
	// #swagger.summary = 'Stop an active channel'
	// #swagger.parameters['channelId'] = { description: "channelId of channel", required: true, type: 'string' }
	/*
	#swagger.responses[200] = {
		"description" : "Details of the channel thats stopped.",
		"schema": 
			{
				"createTs": 1711790359043,
				"channelStatus": "TERMINATED_BY_USER",
				"channelId": "01HPKHMV21AYACVMEBFNZ406Q3",
				"host": {
					"uid": 63,
					"role": "USER",
					"balance": 0,
					"name": "Vaibhav",
					"phoneNumber": "+917722846537",
					"id": "01HPKHMV21AYACVMEBFNZ406Q3"
				}
			}
		
	}
	*/

	try {
		const { channelId, channelType }: { channelType?: ChannelType; channelId: string } = req.params;

		if (!channelId) {
			throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("channelId")};
			return;
		}
		if (!channelType) {
			throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("channelType")};
			return;
		}
		console.time();

		await handleDisableChannel({channelId, channelType});

		res.status(204).json({status: "SUCCESS"});
	} catch (error: any) {
		logger.error(error);
		next(error);
	}
}

export default router;
