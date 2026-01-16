import express, { Request, Response, NextFunction } from "express";
import getLogger from "../../../services/Logger";
import { AgentChatDao } from "../../../data-access/AgentChatDao";

const logger = getLogger();

const router = express.Router({ mergeParams: true });
router.use(express.json());


const getAgentUserChatByUserIdRouter = async (req: Request, res: Response, next: NextFunction) => {
    
    try {
        const userId = req.params.userId;
        const response = await AgentChatDao.getAgentUserChatListByUserId({userId});
        let parsedResponse = [] 
        for(const data of (response as any)['History']) {
            if (data.role == "user") {
                parsedResponse.push({userId: userId, message: data.blocks[0].text})
            }
            else if (data.role == "assistant") {
                parsedResponse.push({userId: "assistant", message: data.blocks[0].text})
            }
        }
        return res.status(200).json({messages: parsedResponse});
    } catch(error) {
        next(error);
    }

}


const sendMessageToAssistantRouter = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {userId, message} = req.body;
        console.log("THE user id is ", userId)
        if (!userId) {
            throw {statusCode: 400, code: "InvalidParam", message: "userId not provided in the params"}
        }
        if (!message) {
            throw {statusCode: 400, code: "InvalidParam", message: "message not provided in the params"}
        }
        const agentUrl = process.env.AGENT_API_URL as string;
        console.log(agentUrl + "/chat/")
        const response = await fetch(agentUrl + "/chat/", {
            method: "POST",
            body: JSON.stringify({
                userId, 
                message
            })
        })
        const responseData = await response.json();
        res.status(200).json({message: responseData.message})
    } catch(error) {
        next(error);
    }
}
router.get("/:userId", getAgentUserChatByUserIdRouter);
router.post("/", sendMessageToAssistantRouter);
export default router;