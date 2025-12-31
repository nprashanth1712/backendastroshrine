import express, { Request, Response, NextFunction } from "express";

import getLogger from "../../services/Logger";
import { getLatestUserChats } from "../../services/chat/ChatService";
const logger = getLogger();


const router = express.Router({ mergeParams: true });
router.use(express.json());


/*
	session: {
		chat: {
			id: [{messages}],

		}
		call: {
		}
	}
*/
const getLatestUserMessageRouter = async (req: Request, res: Response, next: NextFunction) => {
    // #swagger.tags = ['Chat Control']
	// #swagger.summary = 'Get session details like chatlist and call data'
	/*#swagger.description = 'Gets latest unreceived messages from chat which are active'
	
	#swagger.responses[200] = {
		"description" : "List of chats and call data",
		schema: {
    "session": {
        "chat": [
            {
                "message": "ishan",
                "userTs": "1735035199487#01JEAYQ4N490XPAP4YB9QKHQQ4",
                "id": "01JFW1XFQ515YCKAQ8GR3C0ARS",
                "sentTs": 1111111111111,
                "type": "text"
            }
        ],
        "call": []
    }
}
	}
	*/ 
    try {
        const { userId } = req.params;
        const chatArrayList = await getLatestUserChats({userId});
		const parsedData = {
			session: {
				chat: chatArrayList,
				call: []
			}
		}
		res.status(200).json(parsedData);
    } catch(error) {
		logger.error(error);
		next(error);
	}
};


router.get("/session", getLatestUserMessageRouter);
export default router;