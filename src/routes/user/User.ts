import express from "express";

// Supabase Migration: Using Supabase DAOs
import { UserDao } from "../../data-access-supabase/UserDao";

const router = express.Router();

import { NextFunction, Request, Response } from "express";
import { CurrentUserOrder, EndUser, EndUserApiResponse, UserProfile } from "../../types/user/models/User";
import { AddUserResponse, DeleteUserResponse, GetAllUserResponse, GetUserResponse } from "../../types/user/Response";
import { AddUserRequest, DeleteUserRequest, GetUserRequest } from "../../types/user/Request";
import UserProfileRouter from "./UserProfileRouter";
import UserOrdersRouter from "./UserOrdersRouter";
import UserKundliRouter from "./UserKundliRouter";
import UserNotificationRouter from "./UserNotifications";

import getLogger from "../../services/Logger";
import { userPatchHandler } from "../../services/user/UserDetails";
import { missingParameter } from "../../utils/ErrorUtils";
import { initializeSettingsPage } from "../../data-access/PagesDao";
import SettingsRouter from "../pages/UserSettings";

import sessionRouter from "../SessionRouter";

// Supabase DAO method bindings
const getAllUsers = UserDao.getAllUsers.bind(UserDao);
const addUser = UserDao.addUser.bind(UserDao);
const deleteUser = UserDao.deleteUser.bind(UserDao);
const getUserById = UserDao.getUserById.bind(UserDao);
const updateUserLastOnlineTs = UserDao.updateUserLastOnlineTs.bind(UserDao);
const initializeUser = UserDao.initializeUser.bind(UserDao);
const getUserByPhoneNumber = UserDao.getUserByPhoneNumber.bind(UserDao);
const getAllSupportUsers = UserDao.getAllSupportUsers.bind(UserDao);

const logger = getLogger();

router.use(express.json());

/**
 * get all users in the table
 * @date 3/23/2024 - 11:13:45 AM
 *
 * @async
 * @param {Request} req
 * @param {GetAllUserResponse} res
 * @returns {*}
 */
const getAllUsersRouter = async (req: Request, res: GetAllUserResponse, next: NextFunction) => {
	// #swagger.tags = ['User Control']
	// #swagger.summary = 'Get list of all users in database'
	/* #swagger.responses[200] = {
                in: "body",
                description: "list of user", 
                "type": "array",
                schema: [ {
                        "balance": 0,
                        "role": "ASTROLOGER",
                        "phoneNumber": "+911234567891",
                        "id": "userid",
                        "uid": 62,
                        "name": "John Doe"
                },
                {
                        "balance": 0,
                        "role": "USER",
                        "phoneNumber": "+911234567891",
                        "id": "userid2",
                        "uid": 62,
                        "name": "Dohn Joe"
                }
        ]

        } */
	try {
		console.time();
		const phoneNumber = req.query.phoneNumber as string;
		const isSupport = req.query.isSupport as string;

		if (phoneNumber) {
			const userExists = await getUserByPhoneNumber({ phoneNumber: "+" + phoneNumber.trim() });
			console.log("user exists", userExists);
			if (userExists?.id) {
				const user = await getUserById(userExists?.id);

				// USER RESPONSE 
				let userResponse: EndUserApiResponse = {
					...user,
					isSupport: user?.isSupport == "true" ? true : false
				}
				res.status(200).json(userResponse);
			} else {
				res.status(200).json({});
			}
		} else {
			if(isSupport && isSupport === 'true')
				res.status(200).json(await getAllSupportUsers());
			else 
				res.status(200).json(await getAllUsers());
			
		}
		console.timeEnd();
		return;
	} catch (error: any) {
		logger.error(error);
		next(error);
	}
};

/**
 * add a user to the table
 * @date 3/23/2024 - 11:13:55 AM
 *
 * @async
 * @param {AddUserRequest} req
 * @param {AddUserResponse} res
 * @returns {*}
 */
const addUserRouter = async (req: AddUserRequest, res: AddUserResponse, next: NextFunction) => {
	/* 
        #swagger.tags = ['User Control']
	#swagger.summary = 'Initialize a user'
        #swagger.parameters['body'] = 
	{
		in: "body",
		description: "Initialize a user to the database with the users information.",
		'@schema': 
                {
			"required": ["name"], 
		 	"properties" : 
                        {
				"name" : {
					"type" : "string",
					"description": "name of the user",
				},
			    
		        	
                        }
		}
	}; 
        #swagger.responses[201] = {
                "description": "Details of the new initialized user",
                "schema": {
                        "name": "username",
                        "phoneNumber": "+919999999999",
                        "role": "ASTROLOGER",
                        "id": "userid",
                        "uid": 69,
                        "balance": 0,
                        "callStatus": "online",
                }
        }

        */
	const user: EndUser = req.body;
	const { id } = req.params;

	try {
		console.log("Initializing user");
		// if (!user.name) {
		// 	res.status(400).json({ err: "Invalid user name." });
		// 	return;
		// }

		console.time();
		const newUser: EndUser = await initializeUser(id, user);
		console.timeEnd();
		
		let userResponse: EndUserApiResponse = {
			...newUser,
			isSupport: user?.isSupport == "true" ? true : false
		}
		res.status(201).json(userResponse);
	} catch (error: any) {
		logger.error(error);
		next(error);
	}
};

const addUserBulk = async (req: AddUserRequest, res: AddUserResponse, next: NextFunction) => {
	/* 
        #swagger.tags = ['User Control']
	#swagger.summary = 'Signup/Add a new user'
        #swagger.parameters['body'] = 
	{
		in: "body",
		description: "Add a new user to the database with the users information.",
		'@schema': 
                {
			"required": ["name", "phoneNumber", "role"], 
		 	"properties" : 
                        {
				"name" : {
					"type" : "string",
					"description": "name of the user",
				},
			        "phoneNumber" : {
					"type": "number",
					"description": "Phone number of the user"
				},
				"role" : {
		        		"type": "string",
	        		        "description": "Role of the user - { ASTROLOGER or USER } ",
				},
		        	
                        }
		}
	}; 
        #swagger.responses[201] = {
                "description": "Details of the new initialized user",
                "schema": {
                        "name": "username",
                        "phoneNumber": "+919999999999",
                        "role": "ASTROLOGER",
                        "id": "userid",
                        "uid": 69,
                        "balance": 0,
                        "callStatus": "online",
                }
        }

        */

	try {
		console.time();
		var nameList = [
			"Time",
			"Past",
			"Future",
			"Dev",
			"Fly",
			"Flying",
			"Soar",
			"Soaring",
			"Power",
			"Falling",
			"Fall",
			"Jump",
			"Cliff",
			"Mountain",
			"Rend",
			"Red",
			"Blue",
			"Green",
			"Yellow",
			"Gold",
			"Demon",
			"Demonic",
			"Panda",
			"Cat",
			"Kitty",
			"Kitten",
			"Zero",
			"Memory",
			"Trooper",
			"XX",
			"Bandit",
			"Fear",
			"Light",
			"Glow",
			"Tread",
			"Deep",
			"Deeper",
			"Deepest",
			"Mine",
			"Your",
			"Worst",
			"Enemy",
			"Hostile",
			"Force",
			"Video",
			"Game",
			"Donkey",
			"Mule",
			"Colt",
			"Cult",
			"Cultist",
			"Magnum",
			"Gun",
			"Assault",
			"Recon",
			"Trap",
			"Trapper",
			"Redeem",
			"Code",
			"Script",
			"Writer",
			"Near",
			"Close",
			"Open",
			"Cube",
			"Circle",
			"Geo",
			"Genome",
			"Germ",
			"Spaz",
			"Shot",
			"Echo",
			"Beta",
			"Alpha",
			"Gamma",
			"Omega",
			"Seal",
			"Squid",
			"Money",
			"Cash",
			"Lord",
			"King",
			"Duke",
			"Rest",
			"Fire",
			"Flame",
			"Morrow",
			"Break",
			"Breaker",
			"Numb",
			"Ice",
			"Cold",
			"Rotten",
			"Sick",
			"Sickly",
			"Janitor",
			"Camel",
			"Rooster",
			"Sand",
			"Desert",
			"Dessert",
			"Hurdle",
			"Racer",
			"Eraser",
			"Erase",
			"Big",
			"Small",
			"Short",
			"Tall",
			"Sith",
			"Bounty",
			"Hunter",
			"Cracked",
			"Broken",
			"Sad",
			"Happy",
			"Joy",
			"Joyful",
			"Crimson",
			"Destiny",
			"Deceit",
			"Lies",
			"Lie",
			"Honest",
			"Destined",
			"Bloxxer",
			"Hawk",
			"Eagle",
			"Hawker",
			"Walker",
			"Zombie",
			"Sarge",
			"Capt",
			"Captain",
			"Punch",
			"One",
			"Two",
			"Uno",
			"Slice",
			"Slash",
			"Melt",
			"Melted",
			"Melting",
			"Fell",
			"Wolf",
			"Hound",
			"Legacy",
			"Sharp",
			"Dead",
			"Mew",
			"Chuckle",
			"Bubba",
			"Bubble",
			"Sandwich",
			"Smasher",
			"Extreme",
			"Multi",
			"Universe",
			"Ultimate",
			"Death",
			"Ready",
			"Monkey",
			"Elevator",
			"Wrench",
			"Grease",
			"Head",
			"Theme",
			"Grand",
			"Cool",
			"Kid",
			"Boy",
			"Girl",
			"Vortex",
			"Paradox",
		];
		for (let i = 0; i < 1000; i++) {
			const newUser: EndUser = await addUser({
				id: "1234",
				name: "test_" + nameList[Math.ceil(Math.random() * 100 * 1.74)],
				phoneNumber: Array.from({ length: 10 }, (_, n) => Math.ceil(Math.random() * 9)).join(""),
				balance: 0,
				available: 0,
				lastOnlineTs: Date.now(),
				profile: {} as UserProfile,
				availableOffers: [],
				rejectedSessionList: [],
				joinedChannels: [],
				isSupport: "false",
				currentUserOrder: {} as CurrentUserOrder,
			});
		}

		console.timeEnd();
		res.status(201).json();
	} catch (error: any) {
		logger.error(error);
		next(error);
	}
};

/**
 * delete a user from the table
 * @date 3/23/2024 - 11:14:06 AM
 *
 * @async
 * @param {DeleteUserRequest} req
 * @param {DeleteUserResponse} res
 * @returns {*}
 */
const deleteUserRouter = async (req: DeleteUserRequest, res: DeleteUserResponse, next: NextFunction) => {
	// #swagger.tags = ['User Control']
	// #swagger.summary = 'Delete a user from database'

	const { id } = req.params;
	try {
		const deletedMember: EndUser = await deleteUser(id);

		let userResponse: EndUserApiResponse = {
			...deletedMember,
			isSupport: deletedMember?.isSupport == "true" ? true : false
		}

		res.json(userResponse);
	} catch (error: any) {
		logger.error(error);
		next(error);
	}
};

const updateUserDetailsRouter = async (req: Request, res: Response, next: NextFunction) => {
	/* 
        #swagger.tags = ['User Control']
	#swagger.summary = 'Update users call status'
        #swagger.parameters['body'] = 
	{
		in: "body",
		description: "Update users  call status if ONLIVESTREAM / ONCALL / ONCHAT or ONLINE.",
		'@schema': 
                {
			"required": ["op", "path", "value"], 
		 	"properties" : 
                        {
				"name" : {
					"op" : "string",
					"description": "operation -> REPLACE",
				},
			        "path" : {
					"type": "string",
					"description": "path of the value to change ie status"
				},
				"value" : {
		        		"type": "string",
	        		        "description": "the new status ie ONLINE",
				},
		        	
                        }
		}
	}; 
        #swagger.responses[201] = {
                "description": "Details of the user",
                "schema": {
                        "name": "username",
                        "phoneNumber": "+919999999999",
                        "role": "ASTROLOGER",
                        "id": "userid",
                        "uid": 69,
                        "balance": 0,
                        "callStatus": "online",
                }
        }

        */
	const { id } = req.params;
	const { op, path, value } = req.body;
	if (!op) {
		throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("op")};
		return;
	}
	if (!path) {
		throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("path")};
		return;
	}

	try {
		const userHandler = userPatchHandler({ op, path });
		const updatedUser = await userHandler({id, value});

		let userResponse: EndUserApiResponse = {
			...updatedUser,
			isSupport: updatedUser?.isSupport == "true" ? true : false
		}
		res.json(userResponse);
	} catch (error) {
		logger.error(error);
		next(error);
	}
};
/**
 * retrieve a user's information by id
 * @date 3/23/2024 - 11:14:14 AM
 *
 * @async
 * @param {GetUserRequest} req
 * @param {GetUserResponse} res
 * @returns {*}
 */
const getUserByIdRouter = async (req: GetUserRequest, res: GetUserResponse, next: NextFunction) => {
	// #swagger.tags = ['User Control']
	// #swagger.summary = 'Retrieve a user's information by userId'
	/*
         #swagger.responses[200] = {
                "description": "Details of the user",
                "schema": {
                        "name": "username",
                        "phoneNumber": "+919999999999",
                        "role": "ASTROLOGER",
                        "id": "userid",
                        "uid": 69,
                        "balance": 0,
                        "callStatus": "online"
                }
        }
*/
	const id = req.params.id;
	const { dynamic } = req.query;

	try {
		const user: EndUser = await getUserById(id);


		if (!user?.id) {
			throw {
				statusCode: 404, code: "UserNotFound", message: "The user does not exist"
			}
		}
		if (dynamic && dynamic!.toString().toLowerCase() == "true") {
			const dynamicData = {
				id: user.id,
				available: user.available,
				lastOnlineTs: user.lastOnlineTs,
				joinedChannels: user.joinedChannels,
				currentUserOrder: user.currentUserOrder,
			};
			return res.status(200).json(dynamicData);
		}

		let userResponse: EndUserApiResponse = {
			...user,
			isSupport: user?.isSupport == "true" ? true : false
		}
		return res.status(200).json(userResponse);
	} catch (error: any) {
		logger.error(error);
		next(error);
	}
};

router.use("/:id/settings/", SettingsRouter);
router.use("/:id/order/", UserOrdersRouter);
router.use("/:id/notification", UserNotificationRouter);
// router.use("/:id/profile/review/", UserReviewRouter);
router.use("/:id/profile/", UserProfileRouter);
// router.use("/:id/connections/", ConnectionsRouter);
router.use("/:id/kundli/", UserKundliRouter);
router.use("/:id/session/", sessionRouter);

router.get("/", getAllUsersRouter);
router.put("/:id", addUserRouter);
router.post("/bulk", addUserBulk);
router.delete("/:id", deleteUserRouter);
router.get("/:id", getUserByIdRouter);
router.patch("/:id", updateUserDetailsRouter);

export default router;
