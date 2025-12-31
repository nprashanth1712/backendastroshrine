import { NextFunction, Request, Response } from "express";
import { UpdateUserProfileDataRequest, UpdateUserProfilePicRequest, UploadHostMediaRequest } from "../../types/user/Request";

import express from "express";
import { getUserById, updateUserName, updateUserProfile } from "../../data-access/UserDao";
import { updateProfilePic } from "../../services/user/UserProfile";
import getLogger from "../../services/Logger";
import { EndUser, UserProfile } from "../../types/user/models/User";
import { getFilesList, uploadHostmedia } from "../../services/host-services/HostMediaService";
import { getAstrologerById, updateAstrologerHostProfile } from "../../data-access/AstrologerDao";
import { getMetadataListByTypeStatus } from "../../data-access/MetadataDao";
import { AvatarMetaDataContent } from "../../types/metadata/Metadata";
import { invalidParameter } from "../../utils/ErrorUtils";
const logger = getLogger();
const router = express.Router({ mergeParams: true });

const userProfilePicS3 = process.env.AWS_S3_BUCKET_NAME_USER_PUBLIC;

router.use(express.json());

/**
 * Description placeholder
 *
 * @async
 * @param {UpdateUserProfilePicRequest} req
 * @param {Response} res
 * @param {NextFunction} next
 * @returns {*}
 */
const uploadProfilePic = async (req: UpdateUserProfilePicRequest, res: Response, next: NextFunction) => {
	/* 
        #swagger.tags = ['User Profile Control']
	#swagger.summary = 'Upload users profile pic'
	
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
                description: "profile pic"
        }

        */
	try {
		const { id } = req.params;
		console.log("the avatar: ", req.body.avatar);
		console.time();
		let { profile } = await getUserById(id);
		if (req.body && req.body.avatar) {
			let avatarMetadataList = await getMetadataListByTypeStatus({
				metadataType: "avatar",
				status: "ACTIVE",
			});

			// update the link for return
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
				profile = await updateUserProfile({
					id,
					profile: { ...profile, profilePic: image },
				});
			} else {
				throw {
					name: "INVALID_PARAM",
					message: `Unable to update profile pic for user_id ${id}.`,
				};
			}
		} else if (req.files && req.files.file) {
			const file = req.files.file;
			let profilePic = await updateProfilePic({
				id,
				file: { data: file.data },
				role: "USER",
			});
			profilePic = process.env.AWS_S3_URL?.replace("{{}}", userProfilePicS3!) + "/" + profilePic;
			console.log("this is profilpic:  ", profilePic);
			profile = { ...profile, profilePic };
			profile = await updateUserProfile({ id, profile });
		} else {
			throw {
				name: "INVALID_PARAM",
				message: `Unable to update profile pic for user_id ${id}.`,
			};
		}
		console.timeEnd();
		res.status(200).json(profile);
	} catch (error: any) {
		logger.error(error);
		next(error);
	}
};

const updateProfileData = async (req: UpdateUserProfileDataRequest, res: Response, next: NextFunction) => {
	/* 
        #swagger.tags = ['User Profile Control']
	#swagger.summary = 'Update users profile'
	
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
					"description": "name of the user",
				},
			        "profile" : {
					"type": "object",
					"properties": {
                                        "dateTimeOfBirth" : {
					        "type" : "number",
					        "description": "date of time of the user",
				        },
                                        "placeOfBirth" : {
					        "type" : "string",
					        "description": "place of birth of the user",
				        },
                                        "email" : {
					        "type" : "string",
					        "description": "email of the user",
				        },
                                        "gender" : {
					        "type" : "string",
					        "description": "gender of the user",
				        },
                                }
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
	try {
		const { id } = req.params;
		const { name, profile } = req.body;
		if (!name) {
			throw { statusCode: 400, code: "InvalidParameter", message: invalidParameter("name") };
			return;
		}
		if (!profile?.dateTimeOfBirth) {
			throw {
				statusCode: 400,
				code: "InvalidParameter",
				message: invalidParameter("profile.dateTimeOfBirth"),
			};
			return;
		}
		if (!profile?.email) {
			throw { statusCode: 400, code: "InvalidParameter", message: invalidParameter("profile.email") };
			return;
		}
		if (!profile?.gender) {
			throw { statusCode: 400, code: "InvalidParameter", message: invalidParameter("profile.gender") };
			return;
		}
		if (!profile?.placeOfBirth) {
			throw {
				statusCode: 400,
				code: "InvalidParameter",
				message: invalidParameter("profile.placeOfBirth"),
			};
			return;
		}
		const updatedName: EndUser = await updateUserName({ id, name });
		const updatedUserProfile: UserProfile = profile;
		updatedUserProfile.profilePic = updatedName?.profile?.profilePic;
		const userProfile = await updateUserProfile({
			id,
			profile: updatedUserProfile,
		});
		res.status(200).json(userProfile);
	} catch (error: any) {
		logger.error(error);
		next(error);
	}
};

router.post("/profile-pic", uploadProfilePic);
router.post("/profile-data", updateProfileData);
// router.post("/profile-data/host", updateHostProfileRouter)
// router.post("/media", addUserMediaRouter)
export default router;
