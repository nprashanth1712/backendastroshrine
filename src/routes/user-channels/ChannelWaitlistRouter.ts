import express, { NextFunction, Request, Response } from "express";
import { getLatestOnlineHostChannel, updateWaitlist, getHostChannel } from "../../data-access-supabase/ChannelDao";
import { missingParameter, invalidParameter } from "../../utils/ErrorUtils";
import { publishMessage } from "../../services/Pusher";
import { Channel, ChannelType } from "../../types/livestream/models/Livestream";
import {
	GetWaitlistResponse,
	RemoveFromWaitlistResponse,
	UpdateWaitlistResponse,
} from "../../types/livestream/response/Response";
import { GetWaitlistRequest, RemoveFromWaitlistRequest, UpdateWaitlistRequest } from "../../types/livestream/request/Request";
import getLogger from "../../services/Logger";
import { handleAddUserToWaitlist, handleRemoveUserFromWaitlist } from "../../services/channel/ChannelWaitlistService";
import { getUserById } from "../../data-access-supabase/UserDao";
import { getAstrologerById, updateAstrologerPersonalWaitlist } from "../../data-access-supabase/AstrologerDao";
import { sendMessageToSQS } from "../../services/queue-service/SqsConsumer";
import { Astrologer, UserWaitlist } from "../../types/astrologer/Astrologer";
import { EndUser, JoinedChannel } from "../../types/user/models/User";
import { ProcessChannelApproxWaitTime } from "../../types/async-queue-service/QueueService";
const logger = getLogger();

const router = express.Router({ mergeParams: true });
router.use(express.json());

/**
 * get waitlist of a livestream
 * @date 3/23/2024 - 11:26:07 AM
 *
 * @async
 * @param {GetWaitlistRequest} req
 * @param {GetWaitlistResponse} res
 * @returns {*}
 */
const getChannelWaitlistRouter = async (req: GetWaitlistRequest, res: GetWaitlistResponse, next: NextFunction) => {
	// #swagger.tags = ['Channel']
	// #swagger.summary = 'Get waitlist of a channel'
	// #swagger.parameters['channelId'] = { description: "channelId of channel", required: true, type: 'string' }
	/*
	#swagger.responses[200] = {
		"description" : "Waitlist of the channel with channelId = params.channelId.",
		"schema": [
			{
					"uid": 63,
					"name": "Vaibhav",
					"type" : "CHAT",
					"id": "01HPKHMV21AYACVMEBFNZ406Q3"
			}
		]
	}*/

	try {
		const { channelType, channelId }: { channelType: ChannelType; channelId: string } = req.params;
		console.time();
		const channelIndex: Array<Channel> = (await getLatestOnlineHostChannel({
			channelId,
		})) as Array<Channel>;
		const channel: Channel = channelIndex.find(
			(value) => value?.channelType.toLowerCase() == channelType.toLowerCase()
		) as Channel;
		console.log(channel);
		if (!channelIndex || !channel?.channelId) {
			const hostData = await getAstrologerById(channelId);

			if (!hostData?.id) {
				throw {statusCode: 400, code: "AstrologerNotFound", message: "The astrologer was not found."};
			}
			console.log("The host is ", JSON.stringify(hostData, null, 2))
			const waitlistKey = channelType.toLowerCase() as keyof UserWaitlist;
			return res.status(200).json(hostData.waitlist[waitlistKey]);
		}
		const channelObj: Channel = await getHostChannel(channel);
		return res.status(200).json(channelObj.waitlist);
	} catch (error: any) {
		logger.error(error);
		next(error);
	}
};

/**
 * update waitlist of a livestream
 * @date 3/23/2024 - 11:26:17 AM
 *
 * @async
 * @param {UpdateWaitlistRequest} req
 * @param {UpdateWaitlistResponse} res
 * @returns {*}
 */
const updateWaitlistRouter = async (req: UpdateWaitlistRequest, res: UpdateWaitlistResponse, next: NextFunction) => {
	/*
	#swagger.tags = ['Channel']
	#swagger.summary = 'Update waitlist of a channel'
	
	#swagger.parameters['body'] = 
	{
		in: "body",
		description: "Update waitlist of a channel using new users information",
		'@schema': 
		{
			"required": ["id", "uid", "name"], 
		 	"properties" : 
			{
				"id" : {
					"type" : "string",
					"description": "identifier of the host",
				},
					"uid" : {
					"type": "number",
					"description": "identifier of the host for agora",
				},
					"name" : {
					"type": "string",
					"description": "name of the host",
				}
				
			}
		}
	}; 

	#swagger.responses[200] = {
		"description" : "Updated Waitlist of the channel with channelId = params.channelId.",
		"schema": [
			{
					"uid": 63,
					"name": "Vaibhav",
					"type" : "CHAT",
					"id": "01HPKHMV21AYACVMEBFNZ406Q3"
			}
		]
	}
	*/
	try {
		const { channelType, channelId }: { channelType: ChannelType; channelId: string } = req.params;
		const { id, uid, name, subType } = req.body;
		if (!id) {
			throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("id")};
			return;
		}

		if (!uid) {
			throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("uid")};
			return;
		}

		if (!name) {
			throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("name")};
			return;
		}
		if (channelType == "livestream" || channelType == "call") {
			if (!subType) {
				throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("subType")};
				return;
			}
		}

		const resp = await handleAddUserToWaitlist({
			channelId,
			channelType,
			waitlist: { id, uid, name, subType, channelType: channelType.toUpperCase() },
		});
		await publishMessage({
			uri: `public_${channelId}`,
			action: channelType.toUpperCase() + "_WAITLIST_ADD",
			message: resp,
		});
		res.json(resp);
	} catch (error: any) {
		logger.error(error);
		next(error);
	}
};

/**
 * remove user from waitlist
 * @date 3/23/2024 - 11:26:26 AM
 *
 * @async
 * @param {RemoveFromWaitlistRequest} req
 * @param {RemoveFromWaitlistResponse} res
 * @returns {*}
 */
const removeFromWaitlistRouter = async (req: RemoveFromWaitlistRequest, res: RemoveFromWaitlistResponse, next: NextFunction) => {
	// #swagger.tags = ['Channel']
	// #swagger.summary = 'Remove a user from waitlist of a channel'
	// #swagger.parameters['channelId'] = {description: "channelId of channel", required: true, type: "string"}
	// #swagger.parameters['waitlistId'] = {description: "waitlistId of the user", required: true, type: "string"}
	/*
	#swagger.responses[200] = {
		"description" : "Updated Waitlist of the channel with channelId = params.channelId.",
		"schema": [
			{
					"uid": 63,
					"name": "Vaibhav",
					"type" : "CHAT",
					"id": "01HPKHMV21AYACVMEBFNZ406Q3"
			}
		]
	}
	*/
	try {
		const { channelId, waitlistId, channelType } = req.params;
		console.time();

		const updatedData = await handleRemoveUserFromWaitlist({ channelId, channelType, waitlistId });
		res.json(updatedData);
	} catch (error: any) {
		logger.error(error);
		next(error);
	}
};

router.get("/", getChannelWaitlistRouter);
router.post("/", updateWaitlistRouter);
router.delete("/:waitlistId", removeFromWaitlistRouter);
export default router;
