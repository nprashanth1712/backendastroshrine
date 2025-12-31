import express, { Request, Response, NextFunction } from "express";
import { getAstrologerViewData } from "../../data-access/AstrologerViewDao";
import getLogger from "../../services/Logger";
import SearchRouter from "../search/SearchRouter";
import SettingsRouter from "../Pages/UserSettings";
import { updateAstrologerDataHash } from "../../data-access/AstrologerDao";
import { handleUpdateAstrologerHash } from "../../services/astrologer/AstrologerDetails";
import { AstrologerViewCache } from "../../types/astrologer/Astrologer";
import UserReviewRouter from "../Reviews/ReviewRouter";

const logger = getLogger();
const router = express.Router({ mergeParams: true });

router.use(express.json());

const getAstrologerViewDataById = async (req: Request, res: Response, next: NextFunction) => {
	// #swagger.tags = ['Host Profile Control']
	// #swagger.tags = ['Host Profile Control']

    try {
        const { id } = req.params;
        const astroDetails: AstrologerViewCache = await getAstrologerViewData(id);
		const hashContextHeader = req.headers['X-ASTRO-CONTEXT'.toLowerCase()];
		if (hashContextHeader && hashContextHeader == astroDetails.dataHash) {
			return res
				.status(200)
				.json({
					id: astroDetails.id,
					currentChannel: astroDetails.currentChannel,
					channelTimeSpent: astroDetails.hostProfile?.channelTimeSpent,
				});
		} 
		for (const media of astroDetails!.hostProfile?.media!) {
			media.path = process.env.AWS_S3_URL?.replace("{{}}", process.env.AWS_S3_BUCKET_NAME_USER_PUBLIC!) + '/' + media.path;
		}

		return res.status(200).json(astroDetails);
    } catch (error) {
        logger.error(error);
        next(error);
    }
};

const getAstrologerViewDataByIdHash = async (req: Request, res: Response, next: NextFunction) => {
	// #swagger.tags = ['Host Profile Control']

	try {
		const { id, hash } = req.params;
		const astroDetails = await getAstrologerViewData(id);
		if (hash == astroDetails.dataHash) {
			console.log("has equal ");
			return res
				.status(200)
				.json({
					id: astroDetails.id,
					currentChannel: astroDetails.currentChannel,
					channelTimeSpent: astroDetails.hostProfile?.channelTimeSpent,
				});
		}
		res.status(200).json(astroDetails);
	} catch (error) {
		logger.error(error);
		next(error);
	}
};

router.use("/search", SearchRouter)
router.get("/:id", getAstrologerViewDataById);
router.use("/:id/settings/", SettingsRouter);
router.use("/:id/profile/review/", UserReviewRouter);

export default router;
