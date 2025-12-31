import express, { Request, Response, NextFunction } from "express";
// Supabase Migration: Using Supabase DAOs
import { AstrologerDao } from "../../data-access-supabase/AstrologerDao";
import { UserDao } from "../../data-access-supabase/UserDao";
import { MetadataDao } from "../../data-access-supabase/MetadataDao";
import {
	Astrologer,
	AstrologerCurrentChannel,
	HostProfile,
	Media,
	PricingData,
	UserWaitlist,
} from "../../types/astrologer/Astrologer";
import { UpdateHostProfileDataRequest, UpdateUserProfilePicRequest, UploadHostMediaRequest } from "../../types/user/Request";
import { S3BucketKey, uploadHostmedia } from "../../services/host-services/HostMediaService";
import getLogger from "../../services/Logger";
import UserReviewRouter from "../reviews/ReviewRouter";
import { updateProfilePic } from "../../services/user/UserProfile";

import AstrologerOrderRouter from "./AstrologerOrder";
import AstrologerConnectionsRouter from "./ConnectionsRouter";
import AstrologerEarningsRouter from "./AstrologerEarnings";

import { invalidParameter, missingParameter } from "../../utils/ErrorUtils";
import { astrologerPatchHandler, handleUpdateAstrologerHash } from "../../services/astrologer/AstrologerDetails";
import { EndUser } from "../../types/user/models/User";
import { logInformation } from "../../services/logging/CloudWatchService";
import { homedir } from "node:os";
import SettingsRouter from "../pages/UserSettings";
import { AstrologerRequest } from "../../types/astrologer/Request";
import { generateAstrologerAboutMe } from "../../services/openai-service/ClientResponse";
import { SearchService } from "../../services/search/SearchService";
import AstrologerNotificationRouter from "./AstrologerNotifications";

// Supabase DAO method bindings
const getAllAstrologers = AstrologerDao.getAllAstrologers.bind(AstrologerDao);
const getAstrologerById = AstrologerDao.getAstrologerById.bind(AstrologerDao);
const getAstrologerByPhoneNumber = AstrologerDao.getAstrologerByPhoneNumber.bind(AstrologerDao);
const addAstrologer = AstrologerDao.addAstrologer.bind(AstrologerDao);
const updateAstrologerHostProfile = AstrologerDao.updateAstrologerHostProfile.bind(AstrologerDao);
const updateAstrologerName = AstrologerDao.updateAstrologerName.bind(AstrologerDao);
const getUserById = UserDao.getUserById.bind(UserDao);
const getUserByPhoneNumber = UserDao.getUserByPhoneNumber.bind(UserDao);
const updateUserName = UserDao.updateUserName.bind(UserDao);
const getMetadataListByTypeStatus = MetadataDao.getMetadataListByTypeStatus.bind(MetadataDao);
const logger = getLogger();
const router = express.Router({ mergeParams: true });

const cdnUrl = process.env.AWS_CDN_USERPROFILE_BUCKET_URL;

router.use(express.json());

const getAllAstrologersRouter = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const phoneNumber = req.query.phoneNumber as string;

		if (phoneNumber) {
			const astrologerExists = await getAstrologerByPhoneNumber({
				phoneNumber: "+" + phoneNumber.trim(),
			});
			console.log("astrologer eists", astrologerExists);
			if (astrologerExists?.id) {
				const astrologer = await getAstrologerById(astrologerExists?.id);
				res.status(200).json(astrologer);
			} else {
				res.status(200).json({});
			}
		} else {
			const response = await getAllAstrologers();
			res.status(200).json(response);
		}
		return;
	} catch (error) {
		next(error);
	}
};

const openAITestRouter = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const data = req.body;
		const respone = await generateAstrologerAboutMe({ astrologerDetails: data as any });
		return res.status(200).json(respone);
	} catch (error) {
		next(error);
	}
};
const addAstrologerRouter = async (req: AstrologerRequest.AddAstrologer, res: Response, next: NextFunction) => {
	try {
		let body = req.body;

		// CHECK OPTINAL ARGUMENTS
		if (!Array.isArray(body?.expertise)) {
			body.expertise = [];
		}
		if (!Array.isArray(body?.languages)) {
			body.languages = [];
		}
		if (typeof body?.experience != "number") {
			body.experience = 0;
		}
		if (!body?.aboutMe) {
			body.aboutMe = "";
		}

		const currentAstrologer: Astrologer = await getAstrologerByPhoneNumber({ phoneNumber: body.phoneNumber });
		if (currentAstrologer?.id) {
			throw {
				statusCode: 400,
				code: "AstrologerExists",
				message: "The astrologer with the phone number already exists.",
			};
		}

		let userData = await getUserByPhoneNumber({ phoneNumber: body.phoneNumber });
		if (!userData?.id) {
			console.log("User not found for initializing astrologer");
			throw { statusCode: 404, code: "UserNotFound", message: "User Not Found for the Astrologer" };
		}
		userData = await getUserById(userData.id);
		const astrologer = await addAstrologer({ userData, astrologerDetails: body });

		await handleUpdateAstrologerHash({ id: astrologer.id });
		SearchService.cacheAllAstrologers();

		res.status(200).json(astrologer);
	} catch (error) {
		next(error);
	}
};
const getAstrologerByIdRouter = async (req: Request, res: Response, next: NextFunction) => {
	// #swagger.tags = ['Host Profile Control']

	try {
		const { id } = req.params;
		const astroDetails = await getAstrologerById(id);

		if (astroDetails?.hostProfile?.media) {
			for (const media of astroDetails.hostProfile.media) {
				media.path =
					process.env.AWS_S3_URL?.replace(
						"{{}}",
						process.env.AWS_S3_BUCKET_NAME_USER_PUBLIC!
					) +
					"/" +
					media.path;
			}
		}
		return res.status(200).json(astroDetails);
	} catch (error) {
		logger.error(error);
		next(error);
	}
};

const getAstrologerPricingDataRouter = async (req: Request, res: Response, next: NextFunction) => {
	const { id, channelType } = req.params;
	try {
		const astroDetails = await getAstrologerById(id);
		if (!astroDetails?.id) {
			throw {
				statusCode: 400,
				code: "AstrologerExists",
				message: "The astrologer with the phone number already exists.",
			};
			return;
		}
		const pricingData = astroDetails.pricingData;
		if (channelType) {
			if (!["livestream", "call", "chat"].includes(channelType.toLowerCase())) {
				throw {
					statusCode: 400,
					code: "InvalidParameter",
					message: "The channel type is invalid.",
				};
			}
			const channelKey = channelType.toLowerCase() as keyof PricingData;
			return pricingData[channelKey];
		}
		return pricingData;
	} catch (error) {
		console.log("error in getAstrologerPricingData", error);
		next(error);
	}
};

const getAstrologerWaitlistRouter = async (req: Request, res: Response, next: NextFunction) => {
	const { id, channelType } = req.params;
	try {
		const astroDetails = await getAstrologerById(id);
		console.log(astroDetails);
		if (!astroDetails?.id) {
			throw {
				statusCode: 400,
				code: "AstrologerExists",
				message: "The astrologer with the phone number already exists.",
			};
			return;
		}
		const waitlist = astroDetails.waitlist;
		if (channelType) {
			if (!["livestream", "call", "chat"].includes(channelType.toLowerCase())) {
				throw {
					statusCode: 400,
					code: "InvalidParameter",
					message: "The channel type is invalid.",
				};
				return;
			}
			const channelKey = channelType.toLowerCase() as keyof UserWaitlist;
			return waitlist[channelKey];
		}
		return waitlist;
	} catch (error) {
		console.log("error in getAstrologerPricingData", error);
		next(error);
	}
};

const updateAstrologerHostProfileRouter = async (req: UpdateHostProfileDataRequest, res: Response, next: NextFunction) => {
	/* 
   #swagger.tags = ['Host Profile Control']
#swagger.summary = 'Update hosts profile'

#swagger.parameters['id'] = {
   "required": "true",
   "type": "string", 
   "description": "id of the user"
}
   #swagger.parameters['body'] = 
{
   in: "body",
   description: "Update profile information.",
   '@schema': 
           {
       "required": ["name", "profile"], 
        "properties" : 
                   {
           "name" : {
               "type" : "string",
               "description": "name of the host",
           },
                           "aboutMe" : {
               "type" : "string",
               "description": "aboutMe section of the host",
           },
                           "expertise" : {
               "type" : "string",
               "description": "expertises of the host ( as an array of expertises )",
           },
                           "experience" : {
               "type" : "number",
               "description": "years of experience of the host",
           },
           },
               
       }
   }
}; 

    #swagger.responses[201] = {
           "description": "Details of the host",
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
		const { id } = req.params;
		const { name, profile } = req.body;
		if (!name) {
			throw { statusCode: 400, code: "InvalidParameter", message: invalidParameter("name") };
			return;
		}
		if (typeof profile?.experience != "number") {
			throw {
				statusCode: 400,
				code: "InvalidParameter",
				message: invalidParameter("profile.experience"),
			};
			return;
		}
		if (!profile?.aboutMe) {
			throw { statusCode: 400, code: "InvalidParameter", message: invalidParameter("profile.aboutMe") };
			return;
		}
		if (!profile?.expertise) {
			throw { statusCode: 400, code: "InvalidParameter", message: invalidParameter("profile.expertise") };
			return;
		}
		const astrologerDetails: Astrologer = await getAstrologerById(id);
		const hostProfile: HostProfile = {
			...astrologerDetails.hostProfile,
			...profile,
		};
		if (!astrologerDetails) {
			throw {
				statusCode: 400,
				code: "AstrologerNotFound",
				message: invalidParameter("The astrologer was not found!"),
			};
			return;
		}
		await updateAstrologerHostProfile({
			id,
			name,
			hostProfile: hostProfile,
		});
		await handleUpdateAstrologerHash({ id });

		res.status(200).send({ name, profile });
	} catch (error) {
		next(error);
	}
};

const uploadHostProfilePicRouter = async (req: UpdateUserProfilePicRequest, res: Response, next: NextFunction) => {
	try {
		const { id } = req.params;
		console.time();
		let { name, hostProfile } = await getAstrologerById(id);

		if (req.body && req.body.avatar) {
			let avatarMetadataList = await getMetadataListByTypeStatus({
				metadataType: "avatar",
				status: "ACTIVE",
			});

			// replace imageUrl with actual s3 url for response 
			for (const metadata of avatarMetadataList!) {
				if (metadata?.content.imageUrl)
					metadata.content.imageUrl =
						process.env.AWS_S3_URL?.replace(
							"{{}}",
							process.env.AWS_S3_BUCKET_NAME_METADATA_PUBLIC!
						) +
						"/" +
						metadata.content.imageUrl;
			}
			let avatar = avatarMetadataList.filter(
				(data) => data.metadataType === "avatar" && data.name === req.body.avatar
			);
			console.log("got these avatars for this name: ", JSON.stringify(avatar));
			if (avatar.length) {
				const image = avatar[0].content.imageUrl;
				hostProfile = await updateAstrologerHostProfile({
					id,
					name,
					hostProfile: { ...hostProfile, profilePic: image },
				});
			} else {
				throw {
					name: "INVALID_PARAM",
					message: `Unable to update profile pic for user_id ${id}.`,
				};
			}
		} else if (req.files && req.files.file) {
			const file = req.files.file;
			let profilePic = await updateProfilePic({ id, file: { data: file.data }, role: "ASTROLOGER" });
			profilePic = cdnUrl + profilePic;
			hostProfile = { ...hostProfile, profilePic };
			hostProfile = await updateAstrologerHostProfile({ id, name, hostProfile });
		} else {
			throw { name: "INVALID_PARAM", message: `Unable to update profile pic for hostId ${id}.` };
		}
		console.timeEnd();
		res.status(200).json(hostProfile);
	} catch (error: any) {
		logger.error(error);
		next(error);
	}
};

const updateAstrologerDetails = async (req: Request, res: Response, next: NextFunction) => {
	const { id } = req.params;
	try {
		const { op, path, value } = req.body;
		if (!op) {
			throw { statusCode: 400, code: "InvalidParameter", message: missingParameter("op") };
			return;
		}
		if (!path) {
			throw { statusCode: 400, code: "InvalidParameter", message: missingParameter("path") };
			return;
		}
		if (!value) {
			throw { statusCode: 400, code: "InvalidParameter", message: missingParameter("value") };
			return;
		}
		const patchHandler = astrologerPatchHandler({ op, path });
		const response = await patchHandler({ id, value });
		res.status(200).json(response);
	} catch (error) {
		next(error);
	}
};

const addAstrologerMediaRouter = async (req: UploadHostMediaRequest, res: Response, next: NextFunction) => {
	/* 
   #swagger.tags = ['Host Profile Control']
#swagger.summary = 'Upload hosts media'

#swagger.parameters['id'] = {
   "required": "true",
   "type": "string", 
   "description": "id of the user"
}
   #swagger.consumes = ['multipart/form-data']
   #swagger.parameters['file'] = {
           in: "formData",
           type: "file",
           required: true,
           description: "media"
   }

   */
	try {
		const { id } = req.params;
		const astrologerData = await getAstrologerById(id);
		if (!astrologerData?.id) {
			throw {
				statusCode: 404,
				code: "AstrologerNotFound",
				message: "The astrologer does not exist",
			};
		}
		if (astrologerData?.hostProfile?.media?.length >= 12) {
			throw {
				statusCode: 400,
				code: "MediaLengthMax",
				message: "The astrologer cannot post more medias",
			};
		}
		if (req.files && req.files.file) {
			const file = req.files.file;
			console.log(file);
			const s3Key = await uploadHostmedia({
				hostId: id,
				file: { data: file.data },
				name: file.name,
			});
			astrologerData?.hostProfile?.media?.push({ path: s3Key });
			await updateAstrologerHostProfile({
				id,
				name: astrologerData?.name,
				hostProfile: astrologerData.hostProfile,
			});
			res.status(200).json({ s3Key: s3Key });
		} else {
			throw {
				name: "INVALID_PARAM",
				message: `Unable to update media for host ${id}.`,
			};
		}
	} catch (error) {
		logger.error(error);
		next(error);
	}
};

const removeAstrologerMediaByFileKeyRouter = async (req: Request, res: Response, next: NextFunction) => {
	const { id, key } = req.params;
	try {
		const astrologerData = await getAstrologerById(id);
		if (!astrologerData?.id) {
			throw {
				statusCode: 404,
				code: "AstrologerNotFound",
				message: "The astrologer does not exist",
			};
		}
		if (
			typeof astrologerData?.hostProfile?.media == "undefined" ||
			astrologerData?.hostProfile?.media?.length == 2
		) {
			throw { statusCode: 400, code: "MediaIsEmpty", message: "The media is empty" };
		}

		let modifiedHostProfile: HostProfile = astrologerData.hostProfile;
		let mediaList: Array<Media> = modifiedHostProfile.media.filter((value) => value.path.toLowerCase() != key);

		modifiedHostProfile = { ...modifiedHostProfile, media: mediaList };

		const updatedHostProfile = await updateAstrologerHostProfile({
			id,
			hostProfile: modifiedHostProfile,
			name: astrologerData?.name,
		});
		return res.status(200).json(updatedHostProfile);
	} catch (error) {
		console.error("[-] Error while updating host profile media");
		next(error);
	}
};

router.post("/testlol", openAITestRouter);
router.get("/", getAllAstrologersRouter);
router.post("/", addAstrologerRouter);
router.get("/:id", getAstrologerByIdRouter);

router.use("/:id/earnings", AstrologerEarningsRouter);
router.patch("/:id", updateAstrologerDetails);

router.use("/:id/notification", AstrologerNotificationRouter);

router.use("/:id/settings/", SettingsRouter);
router.use("/:id/order/", AstrologerOrderRouter);
router.use("/:id/profile/review/", UserReviewRouter);
router.use("/:id/connections/", AstrologerConnectionsRouter);

router.get(":/id/rate/:channelType?", getAstrologerPricingDataRouter);
router.get("/:id/waitlist/:channelType?", getAstrologerWaitlistRouter);

router.post("/:id/profile/profile-pic", uploadHostProfilePicRouter);
router.post("/:id/profile/profile-data", updateAstrologerHostProfileRouter);

router.post("/:id/profile/media", addAstrologerMediaRouter);
router.delete("/:id/profile/media/:key", removeAstrologerMediaByFileKeyRouter);

export default router;
