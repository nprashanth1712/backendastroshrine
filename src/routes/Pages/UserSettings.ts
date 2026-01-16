import express, { NextFunction } from "express";
import getLogger from "../../services/Logger";
import { Request, Response } from "express";
import { getUserSettingsDataByUserId } from "../../data-access/PagesDao";
import { missingParameter } from "../../utils/ErrorUtils";
import { Settings } from "../../types/pages/Settings";
import { settingsUpdateHandler } from "../../services/pages/SettingService";

const logger = getLogger();

const router = express.Router({ mergeParams: true });
router.use(express.json());

const initializeSettings = async (req: Request, res: Response, next: NextFunction) => {
    
    try {
        const { id } = req.params;

        const settingsData = await getUserSettingsDataByUserId( {  id } );
        res.status(200).json(settingsData)
    } catch(error) {
        next(error);
    }
}



const updateSettingsPageRouter = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const {id} = req.params;
		const {op, path, value} = req.body;
        let realValue: boolean = true;;
		if (!op) {
			throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("op")};
			return;
		}
		if (!path) {
			throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("path")};
			return;
		}
		if (!value) {
			realValue = false;
		}
        const settingsHandler = settingsUpdateHandler({op, path: path.toUpperCase()});
        const updatedData = await settingsHandler({userId: id, value})
		res.status(200).json(updatedData);
	} catch(error) {
		logger.error(error);
		next(error);
	}
}
router.get("/", initializeSettings)
router.patch("/", updateSettingsPageRouter)

export default router;

