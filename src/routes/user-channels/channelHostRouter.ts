import express from "express";
import { NextFunction } from "express";
import getLogger from "../../services/Logger";
import { UpdateHostRequest } from "../../types/livestream/request/Request";
import { UpdateTempHostResponse } from "../../types/livestream/response/Response";
import { missingParameter } from "../../utils/ErrorUtils";
import { ChannelType} from "../../types/livestream/models/Livestream";
import { hostPatchHandler } from "../../services/channel/ChannelHostService";
import { publishMessage } from "../../services/Pusher";

const logger = getLogger();

const router = express.Router({ mergeParams: true });

router.use(express.json());

router.patch("/", updateChannelHostController);

async function updateChannelHostController(req: UpdateHostRequest, res: UpdateTempHostResponse, next: NextFunction) {
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
		if (!patchReq.value) {
			throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("value")};
			return;
		}

		const { op, path, value } = patchReq;

		console.time();
		const patchHandler = hostPatchHandler({
			op: op.toUpperCase(),
			path: path.toUpperCase(),
		});
		const resp = await patchHandler({
			channelId,
			uid: parseInt(value),
			channelType,
		});

		console.timeEnd();
		await publishMessage({
			uri: `global_${resp.id}`,
			action: channelType.toUpperCase() + "_HOST_UPDATE",
			message: resp,
		});
		await publishMessage({
			uri: `global_${channelId}`,
			action: channelType.toUpperCase() + "_HOST_UPDATE",
			message: resp,
		});
		await publishMessage({
			uri: `public_${channelId}`,
			action: channelType.toUpperCase() + "_HOST_UPDATE",
			message: resp,
		});
		res.status(200).json(resp);
		return;
	} catch (error: any) {
		logger.error(error);
		next(error);
	}
}

export default router;
