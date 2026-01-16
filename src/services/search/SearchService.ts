import { Request, Response, NextFunction, response } from "express";
// Supabase Migration: Using Supabase DAOs instead of DynamoDB
import { UserDao } from "../../data-access-supabase/UserDao";
import { AstrologerDao } from "../../data-access-supabase/AstrologerDao";
import { ChannelDao } from "../../data-access-supabase/ChannelDao";
import Fuse, { FuseResult } from "fuse.js";
import { getCacheByKey, getCacheList, setCacheData } from "../caching-service/CachingService";
import {
	Astrologer,
	AstrologerCurrentChannel,
	AstrologerGetByAvailable,
	AstrologerViewCache,
} from "../../types/astrologer/Astrologer";
import { KnownTypeNamesRule } from "graphql";
import { SearchTypes } from "../../types/search/Request";
import { parse } from "node:path";

// Adapter functions to match the old DynamoDB interface
const getAllUsers = UserDao.getAllUsers.bind(UserDao);
const getAllAstrologers = AstrologerDao.getAllAstrologers.bind(AstrologerDao);
const getAstrologerListByAvailable = AstrologerDao.getAstrologerListByAvailable.bind(AstrologerDao);
const getChannelByChannelStatusName = ChannelDao.getChannelByChannelStatusName.bind(ChannelDao);
const nextChannelToken = ChannelDao.nextChannelToken.bind(ChannelDao);

namespace SearchService {
	const relevanceScore = ({ textToSearch, query }: { textToSearch: Array<String>; query: string }) => {
		const fuse = new Fuse(textToSearch, {
			isCaseSensitive: false,
			includeScore: true,
			findAllMatches: true,
			includeMatches: true,
			threshold: 0.7,
			shouldSort: true,
		});

		const response = fuse.search(query);
		return response;
	};

	const searchNamePrefix = ({ sortedArr, namePrefix }: { sortedArr: Array<AstrologerViewCache>; namePrefix: string }) => {
		let low = 0;
		let high = sortedArr.length - 1;
		while (low <= high) {
			let mid = Math.floor((low + high) / 2);
			let guess = sortedArr[mid];
			console.log("the mid is ", guess);
			if (guess?.name?.toLowerCase().startsWith(namePrefix.toLowerCase())) {
				return mid;
			} else if (guess.name.toLowerCase() > namePrefix.toLowerCase()) {
				high = mid - 1;
			} else {
				low = mid + 1;
			}
		}
		return -1;
	};

	const getNamePrefixRange = async ({
		sortedArr,
		namePrefix,
	}: {
		sortedArr: Array<AstrologerViewCache>;
		namePrefix: string;
	}) => {
		sortedArr.sort((a, b) => (a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1));

		let namePrefixIndex = searchNamePrefix({ sortedArr, namePrefix });
		console.log("The name prefix index ", namePrefixIndex);
		if (namePrefixIndex == -1) return [];
		let indexStarts = namePrefixIndex;
		let indexEnds = namePrefixIndex;
		console.log("THE search name prefix is ", sortedArr[namePrefixIndex]);

		while (indexStarts > -1 && sortedArr[indexStarts].name.startsWith(namePrefix)) {
			indexStarts = indexStarts - 1;
		}
		while (indexEnds < sortedArr.length && sortedArr[indexEnds].name.startsWith(namePrefix)) {
			indexEnds = indexEnds + 1;
		}
		indexStarts = indexStarts == indexEnds ? indexStarts : indexStarts + 1;
		indexEnds = sortedArr.length < indexEnds ? indexEnds - 1 : indexEnds;
		console.log("THe index starts and ends ", indexStarts, indexEnds + 1);

		// TODO
		const responseArray = sortedArr.slice(indexStarts, indexEnds);
		console.log("THe array is ", responseArray);
		return responseArray;
	};

	export const cacheAllAstrologers = async () => {
		const hostList = await getAllAstrologers();
		let extractedArray: Array<AstrologerViewCache> = hostList.map((value) => ({
			id: value.id,
			ranking: value.ranking,
			name: value.name.toLowerCase(),
			orders: value.hostProfile?.orders,
			pricingData: value?.pricingData,
			hostProfile: {
				orders: value?.hostProfile?.orders,
				gender: value?.hostProfile?.gender,
				channelTimeSpent: value.hostProfile?.channelTimeSpent,
				experience: value?.hostProfile?.experience,
				expertise: value?.hostProfile?.expertise,
				languages: value?.hostProfile?.languages,
			},
		}));
		extractedArray.sort(function (a, b) {
			return a?.name.localeCompare(b?.name);
		});
		console.log("extractedArray: ", extractedArray);
		await setCacheData({ cacheKey: "AstrologerViewCache", data: extractedArray });
		return extractedArray;
	};

	// export const handleChannelStatusForSearch = async ({hostList, channelStatus} : {hostList: Array<AstrologerViewCache>, channelStatus: string}) => {
	// 	const statusChannelAstrologers =
	// 	let astrologerReturnList: Array<AstrologerViewCache> = [];
	// 	for(const astrologer of hostList) {

	// 	}
	// }

	export const searchDBHostData = async ({
		query,
		isOnline,
		channelType,
	}: {
		query: string;
		isOnline: "true" | "false" | string;
		channelType?: string;
	}) => {
		try {
			let hostList: Array<AstrologerViewCache> = [];

			const cacheData = (await getCacheByKey({
				cacheKey: "AstrologerViewCache",
			})) as Array<AstrologerViewCache>;
			console.log("CacheData is ", cacheData);
			hostList = cacheData ?? [];
			if (hostList.length < 1) {
				hostList = await cacheAllAstrologers();
			}

			let astrologerActive = await searchAstrologerByNameStatus({
				hostList,
				query,
				isOnline: isOnline!,
				channelType,
			});
			return astrologerActive;
		} catch (error) {
			console.error(error);
			throw { statusCode: 400, code: "UnableToSearch", message: "Could not find the query" };
		}
	};

	const searchAstrologerByNameStatus = async ({
		hostList,
		query,
		isOnline,
		channelType,
	}: {
		hostList: Array<AstrologerViewCache>;
		query: string;
		isOnline: "true" | "false" | string;
		channelType?: string;
	}) => {
		let returnValue: Array<AstrologerViewCache> = [];
		console.timeEnd("timelol ");

		let namePrefixed = await getNamePrefixRange({ sortedArr: hostList, namePrefix: query });
		let names = query ? namePrefixed : hostList;
		console.log("The channel status and name is ", isOnline, names);

		if (!isOnline) {
			isOnline = "true";
		}
		let astrologerList =
			isOnline?.toLowerCase() == "true"
				? await getAstrologerListByAvailable(1)
				: await getAstrologerListByAvailable(0);

		let astrologerNamesToReturn: Array<AstrologerViewCache> = [];

		// Get Astrologers in cache from the list above
		for (const astrologer of astrologerList) {
			const thisAstrologerInCache = names.find((value) => value.id == astrologer.id);
			if (thisAstrologerInCache) astrologerNamesToReturn.push(astrologer); // I'm using any here
		}

		// if the channelType filter exists, only get the "enabled" ones
		if (channelType) {
			if (["livestream", "call", "chat"].includes(channelType.toLowerCase())) {
				const ckeyType = channelType.toLowerCase() as keyof AstrologerCurrentChannel;

				astrologerNamesToReturn = astrologerNamesToReturn.filter(
					(value) => value?.currentChannel?.[ckeyType].enabled
				);
			} else {
				throw {
					code: 400,
					statusCode: "InvalidChannelType",
					message: "The channel type is invalid",
				};
			}
		}
		// for await (const astrologer of names) {
		// 	const channelData = await getChannelByChannelStatusName({
		// 		channelStatus,
		// 		channelName: astrologer.name,
		// 		channelType,
		// 	});
		// 	console.log("The astros channel is ", astrologer?.name, ": ", channelData);
		// 	if (channelData[0]?.channelId) {
		// 		returnValue.push(astrologer);
		// 	}
		// }
		// returnValue = names;
		console.log("THE NAMES IS ", astrologerNamesToReturn);

		return astrologerNamesToReturn;
	};

	const fuzzySearch = ({ hostList, query }: { hostList: Array<AstrologerViewCache>; query: string }) => {
		console.time("notishan :");
		let returnValue: any = [];
		for (const host of hostList) {
			let listDataToSearch: Array<String> = [];
			if (host?.name) listDataToSearch.push(host.name);
			if (host.hostProfile?.expertise && host.hostProfile?.expertise?.length != 0) {
				host.hostProfile?.expertise?.forEach((data) => {
					if (data) listDataToSearch.push(data);
				});
			}
			if (host.hostProfile?.languages) {
				host?.hostProfile?.languages.forEach((value) => {
					if (value) listDataToSearch.push(value);
				});
			}
			listDataToSearch.push(host?.hostProfile?.experience?.toString() + " years");

			const data = relevanceScore({ textToSearch: listDataToSearch, query })[0];

			if ((data?.score as number) < 0.5) {
				returnValue.push({
					id: host?.id,
					name: host.name,
					hostProfile: {
						expertise: host?.hostProfile?.expertise ?? [],
						experience: host?.hostProfile?.experience,
						languages: host?.hostProfile?.languages ?? [],
					},
					score: data?.score,
				});
			}
		}
		console.timeEnd("notishan :");

		console.log("THE RETURN VALUE IS ", returnValue);
		return returnValue;
	};
}

namespace SearchHelpers {
	export const parseFilterOptions = ({ arrayAsString }: { arrayAsString: string }) => {
		try {
			let parsedData = arrayAsString.split(",");
			let trimmedArray = parsedData.map((value) => value.trim());
			console.log("the parsed string ", trimmedArray);

			return trimmedArray;
		} catch (error) {
			return null;
		}
	};
	export const applySearchFilters = ({
		astrologerList,
		sortData,
		filterData,
	}: {
		astrologerList: Array<AstrologerViewCache>;
		sortData: SearchTypes.AstrologerSearchRequestSortOptions;
		filterData: SearchTypes.AstrologerSearchRequestFilterOptions;
	}) => {
		let responseList: Array<AstrologerViewCache> = astrologerList;

		// GENDER

		if (filterData?.gender && filterData?.gender.length > 0) {
			const genderArrayLowercased = filterData!.gender!.map((v) => v.toLowerCase());
			responseList = responseList?.filter((value) =>
				genderArrayLowercased.includes(value?.hostProfile?.gender.toLowerCase())
			);
		}

		// SKILL/EXPERTISE

		if (filterData?.expertise && filterData?.expertise.length > 0) {
			const expertiseArrayLowercased = filterData!.expertise!.map((v) => v.toLowerCase());
			responseList = responseList?.filter((value) =>
				expertiseArrayLowercased?.some((element) => {
					const hostProfileExpertiseLowercased = value?.hostProfile?.expertise.map((v) =>
						v.toLowerCase()
					);
					return hostProfileExpertiseLowercased.includes(element);
				})
			);
		}

		// LANGUAGE

		if (filterData?.language && filterData?.language.length > 0) {
			const languageArrayLowercased = filterData!.language!.map((v) => v.toLowerCase());
			responseList = responseList?.filter((value) =>
				languageArrayLowercased?.some((element) => {
					const hostProfileLanguageLowercased = value?.hostProfile?.languages.map((v) =>
						v.toLowerCase()
					);
					return hostProfileLanguageLowercased.includes(element);
				})
			);
		}

		let defaultSortOrder = "asc";
		if (sortData?.sortOrder && ["asc", "desc"].includes(sortData?.sortOrder))
			defaultSortOrder = sortData.sortOrder;

		switch (sortData?.sortCategory?.toLowerCase()) {
			case "experience": {
				if (defaultSortOrder == "asc") {
					responseList.sort(
						(a, b) => a?.hostProfile?.experience - b?.hostProfile?.experience
					);
				} else {
					responseList.sort(
						(a, b) => b?.hostProfile?.experience - a?.hostProfile?.experience
					);
				}
				break;
			}

			//TODO The number of orders in the table, it is calculated in the daily job, but need to put it in the cache somehow
			case "orders": {
				if (defaultSortOrder == "asc") {
					responseList.sort((a, b)=> a?.hostProfile?.orders - b?.hostProfile.orders)
				} else {
					responseList.sort((a, b) => b?.hostProfile?.orders - a?.hostProfile?.orders)
				}
				break;
			}
			case "price": {
				if (defaultSortOrder == "asc") {
					responseList.sort(
						(a, b) =>
							a?.pricingData?.livestream?.rate -
							b?.pricingData?.livestream?.rate
					);
				} else {
					responseList.sort(
						(a, b) =>
							b?.pricingData?.livestream?.rate -
							a?.pricingData?.livestream?.rate
					);
				}
				break;
			}
			case "ranking": {
				if (defaultSortOrder == "asc") {
					responseList.sort((a, b) => a?.ranking - b?.ranking);
				} else {
					responseList.sort((a, b) => b?.ranking - a?.ranking);
				}
				break;
			}
		}

		return responseList;
	};
}

export { SearchService, SearchHelpers };
