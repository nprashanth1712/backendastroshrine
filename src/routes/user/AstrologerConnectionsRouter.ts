import express, { NextFunction, Request, Response } from "express";
import { getHostFollowerList, getUserFollowingList, addHostFollower, getHostAndUserFollowData, removeHostFollower } from "../../data-access/FollowersDao";
import getLogger from "../../services/Logger";
import { userConnectionHandler } from "../../services/user-connections/ConnectionService";
import { invalidParameter, missingParameter } from "../../utils/ErrorUtils";
import { getUserById } from "../../data-access/UserDao";
import { getAstrologerById, updateAstrologerHostProfile } from "../../data-access/AstrologerDao";
import { Astrologer } from "../../types/astrologer/Astrologer";
import { Followers } from "../../types/followers/Followers";
const logger = getLogger();
const router = express.Router({ mergeParams: true });


const getHostUserFollowDataRouter = async (req: Request, res: Response, next: NextFunction) => {
      // #swagger.tags = ['User Connections Control']
	// #swagger.summary = 'Get host and user following data'
    
        /*
        #swagger.parameters['id'] = {
		"required": "true",
		"type": "string", 
		"description": "id of the host"
	} 
         #swagger.parameters['userId'] = {
		"required": "true",
		"type": "string", 
		"description": "id of the user"
	} 
        
        #swagger.responses[200] = {
                in: "body",
                description: "following data", 
                "type": "object",
                schema: {
                    "hostId" : "",
                    "userId": "",
                    "lastUpdated": 1111111111111,
                    "lastCreated": 1111111111111,
                    "status" : "ACTIVE"
                }

        } */
    try {
        const {id, userId} = req.params; 
        if (!userId) {
			throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("userId")};
            return; 
        }
        if (!id) {
			throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("Id")};
            return; 
        };
        const response = await getHostAndUserFollowData({hostId: id, userId});
        res.status(200).json(response);
    } catch(error) {
        logger.error(error);
        next(error);
    }
}

const addHostConnectionRouter = async (req: Request, res: Response, next: NextFunction) => {
      /* 
        #swagger.tags = ['User Connections Control']
	#swagger.summary = 'Add a follower of a host'
     #swagger.parameters['id'] = {
		"required": "true",
		"type": "string", 
		"description": "id of the host"
	} 
        #swagger.parameters['body'] = 
	{
		in: "body",
		description: "Add follower of a host with this userId.",
		'@schema': 
                {
			"required": ["userId"], 
		 	"properties" : 
                        {
				"userId" : {
					"type" : "string",
					"description": "id of the user",
}
}}
	}; 
         #swagger.responses[200] = {
                in: "body",
                description: "following data", 
                "type": "object",
                schema: {
                    "hostId" : "",
                    "userId": "",
                    "lastUpdated": 1111111111111,
                    "lastCreated": 1111111111111,
                    "status" : "ACTIVE"
                }

        } 

        */
    try {
        const { id } = req.params;
        const { userId } = req.body;
        if (!userId) {
			throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("userId")};
            return; 
        }
        let followingData: Followers = await getHostAndUserFollowData({hostId: id, userId});
        if (!followingData) {
            followingData = await addHostFollower({hostId: id, userId});
        } else  {
			throw {statusCode: 400, code: "AlreadyFollowing", message: "Already following"};
            return; 
        }
        const hostData: Astrologer = await getAstrologerById(id);
        await updateAstrologerHostProfile({id, name: hostData.name, hostProfile: {...hostData.hostProfile, followers: hostData.hostProfile.followers+1}})
        res.status(200).json(followingData)
    } catch(error) {
        logger.error(error);
        next(error);
    }
}


const getHostFollowerListRouter = async (req: Request, res: Response, next: NextFunction) => {
     // #swagger.tags = ['User Connections Control']
	// #swagger.summary = 'Get list of all hosts followers'
    
        /*
        #swagger.parameters['id'] = {
		"required": "true",
		"type": "string", 
		"description": "id of the host"
	} 
        
        #swagger.responses[200] = {
                in: "body",
                description: "following data", 
                "type": "array",
                schema: [{
                    "hostId" : "",
                    "userId": "",
                    "lastUpdated": 1111111111111,
                    "lastCreated": 1111111111111,
                    "status" : "ACTIVE"
}]

        } */
    try {
        const { id } = req.params;
        if (!id) {
			throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("id")};
            return;
        }
        const followerList = await getHostFollowerList({hostId: id})
        res.status(200).json(followerList);
    } catch(error) {
        logger.error(error);
        next(error);
    }
}

const getUserFollowingListRouter = async (req: Request, res: Response, next: NextFunction) => {
     // #swagger.tags = ['User Connections Control']
	// #swagger.summary = 'Get list of all users following'
    
        /*
        #swagger.parameters['id'] = {
		"required": "true",
		"type": "string", 
		"description": "id of the user"
	} 
        
        #swagger.responses[200] = {
                in: "body",
                description: "following data", 
                "type": "array",
                schema: [{
                    "hostId" : "",
                    "userId": "",
                    "lastUpdated": 1111111111111,
                    "lastCreated": 1111111111111,
                    "status" : "ACTIVE"
}]

        } */
    try {
        const { id } = req.params;
        if (!id) {
			throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("id")};
            return;
        }
        const followerList = await getUserFollowingList({userId: id})
        res.status(200).json(followerList);
    } catch(error) {
        logger.error(error);
        next(error);
    }
}

// TEST
const removeHostFollowerRouter = async(req: Request, res: Response, next: NextFunction) => {
    try {
        const {id, userId} = req.params;
        if (!id) {
			throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("id")};
            return;
        }
        if (!userId) {
			throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("userId")};
            return;
        }

        const astrologerData: Astrologer = await getAstrologerById(id);

        astrologerData.hostProfile.followers -= 1;
        const updatedData = await removeHostFollower({hostId: id, userId, hostProfile: astrologerData.hostProfile});
        res.status(200).json(updatedData);        
    } catch(error) {
        logger.error(error);
        next(error);
    }
}
router.post("/", addHostConnectionRouter)
router.get("/followers", getHostFollowerListRouter)
router.get("/followers/:userId", getHostUserFollowDataRouter)
router.delete("/followers/:userId", removeHostFollowerRouter)
// router.delete("/:id/followers/:userId", removeHostFollowerRouter)
router.get("/following", getUserFollowingListRouter)

export default router;