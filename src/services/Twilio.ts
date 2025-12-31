const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const service = process.env.TWILIO_SERVICE;
import initiateClient from "twilio";
const client = initiateClient(accountSid, authToken);

import getLogger from "./Logger";
const logger = getLogger();
import { Request } from "express";
import { ServiceContext } from "twilio/lib/rest/chat/v2/service";
import { VerificationInstance } from "twilio/lib/rest/verify/v2/service/verification";
import { VerificationCheckInstance } from "twilio/lib/rest/verify/v2/service/verificationCheck";
import { VerificationAttemptInstance } from "twilio/lib/rest/verify/v2/verificationAttempt";

export type ServiceContextWithStatus = ServiceContext & { status?: string };

/**
 * start login verification with twilio
 * @date 3/23/2024 - 11:29:01 AM
 *
 * @async
 * @param {*} req
 * @returns {Promise<VerificationInstance>}
 */
export const startVerification = async (
  req: any
): Promise<VerificationInstance> => {
  const { to } = req;

  if (service) {
    let verificationRequest: VerificationInstance = await client.verify.v2
      .services(service)
      .verifications.create({ to, channel: "sms" });

    logger.debug(verificationRequest);
    return verificationRequest;
  } else
    throw {
      name: "TWILLIO_SERVICE_ACCOUNT_NOT_SET",
      message: "TWILLIO_SERVICE_ACCOUNT_NOT_SET",
    };
};

/**
 * check verification code for twilio
 * @date 3/23/2024 - 11:29:18 AM
 *
 * @async
 * @param {Request} req
 * @returns {Promise<VerificationInstance>}
 */
export const checkVerificationCode = async (
  req: Request
): Promise<VerificationCheckInstance> => {
  const { code } = req.body;
  const { to } = req.params;
  if (service) {
    let verificationResult: VerificationCheckInstance = await client.verify.v2
      .services(service)
      .verificationChecks.create({ code, to });

    logger.debug(verificationResult);
    return verificationResult;
  } else
    throw {
      name: "TWILLIO_SERVICE_ACCOUNT_NOT_SET",
      message: "TWILLIO_SERVICE_ACCOUNT_NOT_SET",
    };
};

/**
 * cancel verification
 * @date 3/23/2024 - 11:29:26 AM
 *
 * @async
 * @param {*} req
 * @returns {Promise<VerificationInstance>}
 */
export const cancelVerification = async (
  req: any
): Promise<VerificationInstance> => {
  const { verificationId } = req;

  if (service) {
    let verificationCancelResult: VerificationInstance = await client.verify.v2
      .services(service)
      .verifications(verificationId)
      .update({ status: "canceled" });

    logger.debug(verificationCancelResult);

    return verificationCancelResult;
  } else {
    throw {
      name: "TWILLIO_SERVICE_ACCOUNT_NOT_SET",
      message: "TWILLIO_SERVICE_ACCOUNT_NOT_SET",
    };
  }
};

/**
 * @todo add description
 * @date 3/23/2024 - 11:29:39 AM
 *
 * @async
 * @param {*} req
 * @returns {Promise<ServiceContextWithStatus>}
 */
export const fetchVerificationAttempt = async (
  req: any
): Promise<VerificationAttemptInstance[]> => {
  const { to } = req;

  let verificationAttempts: VerificationAttemptInstance[] =
    await client.verify.v2.verificationAttempts.list(to);

  logger.debug(verificationAttempts);

  return verificationAttempts;
};
