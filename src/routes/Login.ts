import express from "express";
import getLogger from "../services/Logger";
const logger = getLogger();

import { getUserById, getUserByPhoneNumber } from "../data-access/UserDao";
import {
	startVerification,
	checkVerificationCode,
	cancelVerification,
	fetchVerificationAttempt,
} from "../services/Twilio";
import { NextFunction, Request, Response } from "express";
import { VerificationInstance } from "twilio/lib/rest/verify/v2/service/verification";
import { VerificationCheckInstance } from "twilio/lib/rest/verify/v2/service/verificationCheck";
import { VerificationAttemptInstance } from "twilio/lib/rest/verify/v2/verificationAttempt";
import { EndUser } from "../types/user/models/User";
const router = express.Router();
router.use(express.json());


/**
 * start twilio login verification
 * @date 3/23/2024 - 11:09:30 AM
 *
 * @async
 * @param {Request} req
 * @param {Response} res
 * @returns {unknown}
 */
const startVerificationRouter = async (req: Request, res: Response, next: NextFunction) => {
	// #swagger.tags = ['Signup OTP control using twilio']
	// #swagger.summary = 'Start twilio login verification'
	// #swagger.parameters['to'] = {"required": "true", "type" : "string", "description": "Phone Number for signup"}
	let verificationRequest: VerificationInstance;
	try {
		const to = req.params.to;
		verificationRequest = await startVerification({ to });
		return res.status(200).json(verificationRequest);
	} catch (e ) {
		logger.error(e);
		next(e);
	}
};


/**
 * check verification code for login
 * @date 3/23/2024 - 11:10:04 AM
 *
 * @async
 * @param {Request} req
 * @param {Response} res
 * @returns {unknown}
 */
const checkVerificationCodeRouter = async (req: Request, res: Response, next: NextFunction) => {
	// #swagger.tags = ['Signup OTP control using twilio']
	// #swagger.summary = 'Check verification code for login'
	// #swagger.parameters['to'] = {"required": "true", "type" : "string", "description": "Phone Number for signup"}

	try {
		const verificationResponse: VerificationCheckInstance =
			await checkVerificationCode(req);
		const loginResp : {verification: VerificationCheckInstance, user?: EndUser} = { verification: verificationResponse};

		if (verificationResponse.status == "approved") {
			const user: EndUser = await getUserByPhoneNumber({
				phoneNumber: req.params.to,
			});
			if (user?.id) 
				loginResp.user = await getUserById(user.id);
		}
		return res.status(200).json(loginResp);
	} catch (e) {
		logger.error(e);
		next(e)

	}
};


/**
 * @todo add description
 * @date 3/23/2024 - 11:10:19 AM
 *
 * @async
 * @param {Request} req
 * @param {Response} res
 * @returns {unknown}
 */
const cancelVerificationRouter = async (req: Request, res: Response, next: NextFunction) => {
	// #swagger.tags = ['Signup OTP control using twilio']
	// #swagger.summary = 'Cancel verification'
	// #swagger.parameters['verificationId'] = {"required": "true", "type" : "string", "description": "verificationId fetched through twilio"}

	let cancelVerificationResponse: VerificationInstance;
	try {
		const verificationId = req.params.verificationId;
		cancelVerificationResponse = await cancelVerification({
			verificationId,
		});
		return res.status(200).json(cancelVerificationResponse);
	} catch (e ) {
		logger.error(e);
		next(e)
	}
};


/**
 * @todo add description
 * @date 3/23/2024 - 11:10:34 AM
 *
 * @async
 * @param {Request} req
 * @param {Response} res
 * @returns {unknown}
 */
const fetchVerificationAttemptRouter = async (req: Request, res: Response, next:NextFunction) => {
	// #swagger.tags = ['Signup OTP control using twilio']
	// #swagger.summary = 'Attempt login verification'
	// #swagger.parameters['to'] = {"required": "true", "type" : "string", "description": "Phone Number for signup"}

	let verificationAttempt: VerificationAttemptInstance[];
	try {
		const to = req.params.to;
		console.log(req.params);
		verificationAttempt = await fetchVerificationAttempt({ to });
		return res.status(200).json(verificationAttempt);
	} catch (e) {
		logger.error(e);
		next(e);
	}
};

router.get("/:to", startVerificationRouter);
router.post("/:to", checkVerificationCodeRouter);
router.delete("/verifications/:verificationId", cancelVerificationRouter);
router.get("/verifications/:to", fetchVerificationAttemptRouter);
export default router;