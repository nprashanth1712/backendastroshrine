import express, { Request, Response, NextFunction } from "express";
import getLogger from "../../services/Logger";
import { invalidParameter, missingParameter } from "../../utils/ErrorUtils";
import {
  getAstroOrderByIdTs,
  getAstroOrderListByIdTs,
} from "../../data-access/AstrologerOrderDao";
import { AstrologerEarningListData, AstrologerEarnings } from "../../types/astrologer/earnings/Earnings";
import { EarningPatchRequest } from "../../types/astrologer/earnings/Request";
import { getAstrologerEarningsById, updateAstrologerEarningsData } from "../../data-access/AstrologerEarningsDao";

const logger = getLogger();
const router = express.Router({ mergeParams: true });

const cdnUrl = process.env.AWS_CDN_USERPROFILE_BUCKET_URL;

router.use(express.json());

const getAstrologerEarningsByIdRouter = async (req: Request, res: Response, next: NextFunction) => {
	try {
        const {id} = req.params;
        let response = await getAstrologerEarningsById({astrologerId: id});
        if (!response?.daily) {
            response = {astrologerId: id, lastUpdated: Date.now(), daily: [], weekly: [], monthly: []} as AstrologerEarnings
        }
		res.status(200).json(response);
	} catch(error) {
		next(error);
	}
}

const updateAstrologerEarningsByIdRouter = async (req: EarningPatchRequest, res: Response, next: NextFunction) => {
    try {
        const {id} = req.params;
        const {op, path, value} = req.body;
        const updatedEarningsList = await updateAstrologerEarningsData({astrologerId: id, intervalType: path, intervalData: value});
        return res.status(200).json(updatedEarningsList);
    } catch(error) {
        console.log("error in updateAstrologerEarningsByIdRouter");
        next(error);
    }
}

router.get("/", getAstrologerEarningsByIdRouter);
router.patch("/", updateAstrologerEarningsByIdRouter);
router.get("/", getAstrologerEarningsByIdRouter);
export default router;
