import express, { Request, Response, NextFunction } from "express";
import getLogger from "../../services/Logger";
import { SearchHelpers, SearchService } from "../../services/search/SearchService";
import { missingParameter } from "../../utils/ErrorUtils";
import { SearchTypes } from "../../types/search/Request";
const logger = getLogger();
const router = express.Router({ mergeParams: true });
router.use(express.json());

const searchAstrologerRouter = async (req: SearchTypes.SearchRequest, res: Response, next: NextFunction) => {
	try {

		const { channelType } = req.params; 
		const { query, isOnline, sortCategory, sortOrder, expertise, language, gender, topAstrologer } = req.query;

		// if (!query) {
		// 	throw { statusCode: 400, code: "InvalidParameter", message: missingParameter("query") };
		// }

		const astrologerList = await SearchService.searchDBHostData({
			channelType,
			query: query as string,
			isOnline: isOnline?.toLowerCase()!,
		});

		const sortData = {
			sortCategory, sortOrder,
		};


		const filterData = {
			expertise: SearchHelpers.parseFilterOptions({arrayAsString: expertise!})!, 
			language: SearchHelpers.parseFilterOptions({arrayAsString: language!})!,
			gender: SearchHelpers.parseFilterOptions({arrayAsString: gender!})!, 
			topAstrologer: SearchHelpers.parseFilterOptions({arrayAsString: topAstrologer!})!
		}

		console.log("response is ", astrologerList)
		const detailedResponse = SearchHelpers.applySearchFilters({astrologerList, sortData, filterData})


		return res.status(200).json(detailedResponse);
	} catch (error) {
		logger.error(error);
		next(error);
	}
};

router.get("/", searchAstrologerRouter);
router.get("/channelType/:channelType", searchAstrologerRouter);

export default router;
