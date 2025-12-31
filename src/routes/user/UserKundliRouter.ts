import express, { NextFunction, Request, Response } from "express";
import getLogger from "../../services/Logger";
import { invalidParameter, missingParameter } from "../../utils/ErrorUtils";
import {
	addUserKundliProfileById,
	getUserKundliProfileByUserIdTs,
	getUserKundliProfileListByUserId,
	updateUserKundliProfileDataByUserIdTs,
} from "../../data-access/UserKundliProfile";
import { KundliProfile } from "../../types/user/models/KundliProfile";

const logger = getLogger();
const router = express.Router({ mergeParams: true });

router.use(express.json())


const getUserKundliProfileListByUserIdRouter = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	try {
		const { id } = req.params;
		if (!id) {
            throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("id")};
			return;
		}
		const response = await getUserKundliProfileListByUserId({ userId: id });
		res.status(200).json(response);
	} catch (error) {
		logger.error(error);
		next(error);
	}
};

const getUserKundliProfileByUserIdTsRouter = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	try {
		const { id, createTs } = req.params;
		if (!id) {
            throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("id")};
			return;
		}
		if (
			!createTs ||
			isNaN(parseInt(createTs)) ||
			parseInt(createTs).toString().length != 13
		) {
            throw {statusCode: 400, code: "InvalidParameter", message: invalidParameter("createTs")};
			return;
		}
		const response = await getUserKundliProfileByUserIdTs({
			userId: id,
			createTs: parseInt(createTs),
		});
		res.status(200).json(response);
	} catch (error) {
		logger.error(error);
		next(error);
	}
};

const addUserKundliProfileByIdRouter = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	try {
		const { id } = req.params;
		const { gender, placeOfBirth, dateTimeOfBirth, name } =
			req.body as KundliProfile;
		if (!id) {
            throw {statusCode: 400, code: "InvalidParameter", message: invalidParameter("id")};
			return;
		}
		if (!gender) {
            throw {statusCode: 400, code: "InvalidParameter", message: invalidParameter("gender")};
			return;
		}
		if (!placeOfBirth) {
			throw {statusCode: 400, code: "InvalidParameter", message: invalidParameter("placeOfBirth")};

			return;
		}
		if (!placeOfBirth?.displayValue) {
			throw {statusCode: 400, code: "InvalidParameter", message: invalidParameter("placeOfBirth.displayValue")};

			return;
		}
		if (typeof placeOfBirth?.geoLocation?.lat != "number") {
			throw {statusCode: 400, code: "InvalidParameter", message: invalidParameter("placeOfBirth.geoLocation.lat")};

			return;
		}
		if (typeof placeOfBirth?.geoLocation?.long != "number") {
			throw {statusCode: 400, code: "InvalidParameter", message: invalidParameter("placeOfBirth.geoLocation.long")};

			return;
		}
		if (!dateTimeOfBirth) {
			throw {statusCode: 400, code: "InvalidParameter", message: invalidParameter("dateTimeOfBirth")};

			return;
		}

		if (!name) {
			throw {statusCode: 400, code: "InvalidParameter", message: invalidParameter("name")};

			return;
		}
		const payload = {
			placeOfBirth,
			dateTimeOfBirth,
			userId: id,
			name,
			gender,
		};

		const userKundliData = await addUserKundliProfileById({ ...payload });
		res.status(200).json(userKundliData);
	} catch (error) {
		logger.error(error);
		next(error);
	}
};

const updateUserKundliProfileDataByUserIdTsRouter = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	try {
		const { id, createTs } = req.params;
		const { op, path, value } = req.body;
		if (!id) {
			res.status(400).json({ "err: ": invalidParameter("id") });
			return;
		}
		if (
			!createTs ||
			isNaN(parseInt(createTs)) ||
			parseInt(createTs).toString().length != 13
		) {
			throw {statusCode: 400, code: "InvalidParameter", message: invalidParameter("createTs")};
			return;
		}
		if (!op) {
			throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("op")};

			return;
		}
		if (!path) {
			throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("path")};
			return;
		}
		if (!value) {
			throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("value")};
			return;
		}
		if (
			!["dateTimeOfBirth", "name", "gender", "placeOfBirth"].includes(
				path
			)
		) {
			throw {statusCode: 400, code: "InvalidParameter", message: `${invalidParameter("op")}, validParameters: [
					"dateTimeOfBirth, gender, placeOfBirth, name",
				],`};

			res.status(400).json({
				err: invalidParameter("path"),
				validParameters: [
					"dateTimeOfBirth, gender, placeOfBirth, name",
				],
			});
			return;
		}
		const updatedUserKudliProfile =
			await updateUserKundliProfileDataByUserIdTs({
				userId: id,
				createTs: parseInt(createTs),
				dataToUpdate: path,
				dataPayload: value,
			});
		return updatedUserKudliProfile;
	} catch (error) {
		logger.error(error);
		next(error);
	}
};

router.get("/", getUserKundliProfileListByUserIdRouter);
router.post('/', addUserKundliProfileByIdRouter);
router.get('/:createTs', getUserKundliProfileByUserIdTsRouter);
router.patch('/:createTs', updateUserKundliProfileDataByUserIdTsRouter);
export default router;
