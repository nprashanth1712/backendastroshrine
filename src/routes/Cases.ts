import express, { NextFunction, Request, Response } from "express";
import { InitializeCaseRequest, UpdateCaseRequest } from "../types/case/Request";
import { handleInitializeCase } from "../services/cases/CasesService";
import { invalidParameter, missingParameter } from "../utils/ErrorUtils";
import getLogger from "../services/Logger";
import { getAllActiveSupportUserCases, getAllCasesByUserId, getCaseById, updateCaseStatusById } from "../data-access/CasesDao";
import { casePatchArrayHandler, casePatchHandler } from "../services/cases/CasePatchService";
import { SupportCase } from "../types/case/Case";

const router = express.Router();
router.use(express.json());

const getAllActiveSupportUserCasesRouter = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const supportUserId = req.query.supportUserId as string;
		if (!supportUserId) {
			throw {
				statusCode: 400,
				code: "InvalidParameter",
				message: missingParameter("supportUserId"),
			};
		}
		const cases: Array<SupportCase> = await getAllActiveSupportUserCases({
			supportUserId,
		}); // ONLY KEYS
		const parsedResponse = [];
		for await (const c of cases) {
			const currentCase = await getCaseById({ id: c.id });
			parsedResponse.push(currentCase);
		}
		return res.status(200).json(parsedResponse);
	} catch (error) {
		next(error);
	}
};

const initializeCaseRouter = async (req: InitializeCaseRequest, res: Response, next: NextFunction) => {
	try {
		const { userId, caseType, details } = req.body;
		if (!userId) {
			throw {
				statusCode: 400,
				code: "InvalidParameter",
				message: missingParameter("userId"),
			};
		}
		// if (!details) {
		//     res.status(400).json({ err: missingParameter("details") });
		//     return;
		// }
		if (!caseType) {
			throw {
				statusCode: 400,
				code: "InvalidParameter",
				message: missingParameter("caseType"),
			};
		}

		const currentCases = await getAllCasesByUserId({ userId, status: "OPEN" });
		if (currentCases && currentCases.length > 0)
			throw {
				statusCode: 400,
				code: "OpenCaseExists",
				message: "please close the current case before opening a new case.",
			};
		const response = await handleInitializeCase({ userId, caseType, details });
		res.status(201).json(response);
	} catch (error) {
		getLogger().error(error);
		next(error);
	}
};

const getCaseByIdRouter = async (req: Request, res: Response, next: NextFunction) => {
	const { id } = req.params;
	try {
		const response = await getCaseById({ id });
		res.status(200).json(response);
	} catch (error) {
		next(error);
	}
};

const updateCaseRouter = async (req: UpdateCaseRequest<any>, res: Response, next: NextFunction) => {
	try {
		const { id } = req.params;

		const patchArray = req.body;

		if (patchArray.length == 0) {
			throw {
				statusCode: 400,
				code: "InvalidParamter",
				message: "Patch values must be specified",
			};
		}
		const response = await casePatchArrayHandler({ id, patchArray });

		res.status(200).json(response);
	} catch (error) {
		next(error);
	}
};

const getCasesByUserIdRouter = async (req: Request, res: Response, next: NextFunction) => {
	const { userId } = req.params;
	const status = req.query.status as string;
	try {
		if (status && !["open", "closed"].includes(status.toLowerCase()))
			throw {
				statusCode: 400,
				code: "InvalidParameter",
				message: invalidParameter("status"),
			};

		const response = await getAllCasesByUserId({ userId, status });
		return res.status(200).json(response);
	} catch (error) {
		next(error);
	}
};

const closeAllCasesByUserId = async (req: Request, res: Response, next: NextFunction) => {
  const { userId } = req.params;
	const status = req.query.status as string;
	try {
		if (status && !["open", "closed"].includes(status.toLowerCase()))
			throw {
				statusCode: 400,
				code: "InvalidParameter",
				message: invalidParameter("status"),
			};

		const response = await getAllCasesByUserId({ userId, status });
    for await (const currentCase of response) {
      await updateCaseStatusById({id: currentCase.id, value: "CLOSED", resolution: "SYSTEM"})
    }
		return res.status(200).json(response);
	} catch (error) {
		next(error);
	}
}
router.get("/", getAllActiveSupportUserCasesRouter);
router.post("/", initializeCaseRouter);
router.get("/:id", getCaseByIdRouter);
router.patch("/:id", updateCaseRouter);
router.get("/user/:userId", getCasesByUserIdRouter);
router.delete("/user/:userId", closeAllCasesByUserId)
export default router;
