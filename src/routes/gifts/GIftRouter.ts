import express, { NextFunction, Request, Response } from "express";

import getLogger from "../../services/Logger";
// Supabase Migration: Using Supabase DAOs
import { GiftDao } from "../../data-access-supabase/GiftDao";
import { addGift, uploadGiftImageS3 } from "../../services/GiftService";
import { missingParameter } from "../../utils/ErrorUtils";

// Use Supabase DAO methods
const getAllActiveGifts = GiftDao.getAllActiveGifts.bind(GiftDao);
const updateGiftStatusById = GiftDao.updateGiftStatusById.bind(GiftDao);

const logger = getLogger();
const router = express.Router({ mergeParams: true });
router.use(express.json());


const getAllActiveGiftsRouter = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const response = await getAllActiveGifts();
		res.status(200).json(response);
	} catch(error) {
		logger.error(error);
		next(error);
	}
};

const addNewGiftRouter = async (req: Request, res: Response, next: NextFunction) => {
	 try {
			const {giftAmount, giftName} = req.body;
			if(req.files && req.files.file){
					const file = req.files.file;
					console.log(file);
					const resp = await addGift({giftAmount, giftName, file})
					res.status(200).json(resp);
			}else {
					throw {name : 'INVALID_PARAM', message: `Unable to add gift.`}
			}
	} catch(error) {
			logger.error(error);
			next(error)
	}
}

const updateGiftStatusRouter = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const {giftId} = req.params;
		const {op, path, value} = req.body;
		if (!op) {
			throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("op")};
		}
		if (!path) {
			throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("path")};
		}
		if (!value) {
			throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("value")};;
		}
		const resp = updateGiftStatusById({giftId: giftId, status: value});
		res.status(200).json(resp);
	} catch(error) {
		logger.error(error);
		next(error);
	}
}

router.get("/", getAllActiveGiftsRouter);
router.post("/", addNewGiftRouter);
router.patch("/:giftId", updateGiftStatusRouter)

export default router;



