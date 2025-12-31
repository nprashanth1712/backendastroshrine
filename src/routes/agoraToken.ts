import express from "express";
import cors from "cors";

import dotenv from "dotenv";
dotenv.config();

import { RtcTokenBuilder, RtcRole } from "agora-token";
import { Request, Response } from "express";

const router = express.Router();

const APP_ID : string | undefined = process.env.AGORA_APP_ID;
const APP_CERTIFICATE : string | undefined = process.env.AGORA_APP_CERT;

router.use(express.json());

type stringOrNum = string | number;

const nocache = (_: Request, resp: Response, next: () => void) => {
	resp.header(
		"Cache-Control",
		"private, no-cache, no-store, must-revalidate"
	);
	resp.header("Expires", "-1");
	resp.header("Pragma", "no-cache");
	next();
};


/**
 * generate an rtc token for agora api
 * @date 3/23/2024 - 10:52:22 AM
 *
 * @param {Request} req
 * @param {Response} resp
 * @returns {*}
 */
const generateRTCToken = (req: Request, resp: Response) => {
	// #swagger.tags = ['Agora Control']
	// #swagger.summary = 'Generate RTC token for client'

	resp.header("Access-Control-Allow-Origin", "*");
	// get channel name
	const channelName = req.params.channel as string;
	if (!channelName) {
		return resp.status(400).json({ error: "channel is required" });
	}
	// get uid
	let uid : string = req.params.uid;
	if (!uid || uid === "") {
		return resp.status(400).json({ error: "uid is required" });
	}
	// get role
	let role;
	if (req.params.role === "publisher") {
		role = RtcRole.PUBLISHER;
	} else if (req.params.role === "audience") {
		role = RtcRole.SUBSCRIBER;
	} else {
		return resp.status(400).json({ error: "role is incorrect" });
	}
	// get the expire time
	let expireTime: stringOrNum = req.query.expiry as string;
	if (!expireTime || expireTime === "") {
		expireTime = 3600;
	} else {
		expireTime = parseInt(expireTime as string, 10);
	}
	// calculate privilege expire time
	const currentTime = Math.floor(Date.now() / 1000);
	const privilegeExpireTime = currentTime + (expireTime as number);
	// build the token
	let token;
	if(APP_ID && APP_CERTIFICATE){
		if (req.params.tokentype === "userAccount") {
			token = RtcTokenBuilder.buildTokenWithUserAccount(
				APP_ID,
				APP_CERTIFICATE,
				channelName,
				uid,
				role,
				privilegeExpireTime,
				privilegeExpireTime
			);
		} else if (req.params.tokentype === "uid") {
			token = RtcTokenBuilder.buildTokenWithUid(
				APP_ID,
				APP_CERTIFICATE,
				channelName,
				uid,
				role,
				privilegeExpireTime,
				privilegeExpireTime
			);
		} else {
			return resp.status(400).json({ error: "token type is invalid" });
		}
	} else	{
		return resp.status(500).json({ error: "Unable to find APP_ID and APP_VERTIFICATE" });
	}
	// return the token
	return resp.json({ rtcToken: token });
};


router.get("/rtc/:channel/:role/:tokentype/:uid", generateRTCToken);

export default router;