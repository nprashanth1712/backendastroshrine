import express, { Request, Response, NextFunction } from "express";
import getLogger from "../../services/Logger";
import { invalidParameter, missingParameter } from "../../utils/ErrorUtils";
import { getAstroOrderByIdTs, getAstroOrderListByIdTs } from "../../data-access/AstrologerOrderDao";

const logger = getLogger();
const router = express.Router({ mergeParams: true });

const cdnUrl = process.env.AWS_CDN_USERPROFILE_BUCKET_URL;

router.use(express.json());


const getAstrologerOrderByTsRouter = async (req: Request, res: Response, next: NextFunction) => {
	try {
        const {id} = req.params;
        const startTs = req.query.startTs as string;
        const endTs = req.query.endTs as string;

		
        if(!startTs || startTs.length != 13 || isNaN(parseInt(startTs))) {
			throw {statusCode: 400, code: "InvalidParameter", message: invalidParameter("startTs")};
			return;
		} 

		if(!endTs || endTs.length != 13 || isNaN(parseInt(endTs))) {
			throw {statusCode: 400, code: "InvalidParameter", message: invalidParameter("endTs")};
			return;
		} 
		const response = await getAstroOrderListByIdTs({astrologerId: id, startTs: parseInt(startTs), endTs: parseInt(endTs)});
		console.log(response);
		res.status(200).json(response);
	} catch(error) {
		next(error);
	}
}

router.get("/", getAstrologerOrderByTsRouter);

export default router;