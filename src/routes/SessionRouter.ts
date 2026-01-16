import express, { Request, Response, NextFunction } from "express";
import getLogger from "../services/Logger";
import { GetUserSessionResponse } from "../types/session/Response";
import {
    deactivateUserSessionRequest,
    getUserSessionRequest,
} from "../types/session/Request";
import { invalidParameter, missingParameter } from "../utils/ErrorUtils";
import {
    createUserSession,
    generateRTCToken,
    getActiveUserSessionList,
    getUserSessionByUserIdDeviceId,
} from "../data-access/SessionDao";
import { nextUID } from "../data-access/UserDao";
import { UserSession } from "../types/session/Session";

const logger = getLogger();

const router = express.Router({ mergeParams: true });
router.use(express.json());


const getUserSessionListRouter = async(
    req: Request, 
    res: Response, 
    next: NextFunction
) => {
    const userId = req.params.id;
    try {
        const sessionList = await getActiveUserSessionList({userId});
        console.log("The session list", sessionList)
        res.status(200).json(sessionList);
    } catch(error) {
        console.log("The sesision data was called")
        next(error);
    }

}

const getUserSessionDataByUserIdDeviceIdRouter =  async(
    req: Request, 
    res: Response, 
    next: NextFunction
) => {
    const userId = req.params.id;
    const deviceId = req.params.deviceId;
    try {
        const sessionList = await getUserSessionByUserIdDeviceId({userId, deviceId});
        res.status(200).json(sessionList);
    } catch(error) {
        console.log("The sesision data was called")
        next(error);
    }

}
const generateUserSession = async (
    req: getUserSessionRequest,
    res: GetUserSessionResponse,
    next: NextFunction
) => {
    try {
        console.time();
        const { role, expiry, tokentype, deviceId} = req.body;
        const userId = req.params.id;

        if (!role || !tokentype) {
            throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("role or tokenType")};

            return;
        }
        if (!deviceId) {
            throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("deviceId")};

            return;
        }
        if (!userId) {
			throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("userId")};
            return;
        }

        let userSession: UserSession = await getUserSessionByUserIdDeviceId({userId, deviceId});

        if (!userSession?.uid) {
            userSession = await createUserSession({ userId, deviceId, uid: (await nextUID()).Attributes?.nextUID})
        }
        
        const token = await generateRTCToken({
            channelName: "*",
            uid: userSession.uid,
            role,
            expiry,
            tokentype,
        });
       
        res.status(200).json({ ...userSession, token: token.rtcToken });
        console.timeEnd();
    } catch (error) {
        logger.error(error);
        next(error);
    }
};

// const deacticvateUserSession = async (
//     req: deactivateUserSessionRequest,
//     res: GetUserSessionResponse,
//     next: NextFunction
// ) => {
//     try {
//         const userId = req.params.id;
//         const sessionId = req.body.sessionId;
//         const response = await inactiveAllUserSession({ userId });
//         res.status(200).json(response);
//     } catch (error) {
//         logger.error(error);
//         next(error);
//     }
// };

router.get("/user/:id", getUserSessionListRouter);
router.get("/user/:id/:deviceId", getUserSessionDataByUserIdDeviceIdRouter)
router.post("/user/:id", generateUserSession);

export default router;
