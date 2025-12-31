import { Request } from "express";

namespace SearchTypes {
	export interface SearchRequest extends Request {
		params: {
			channelType?: "livestream" | "chat" | "call",
		}
		query: {
            query: string,
            isOnline?: "true" | "false",
			sortCategory?: "ranking" | "experience" | "orders" | "price",
			sortOrder?: "asc" | "desc";
			expertise?: string;
			language?: string;
			gender?: string;
			topAstrologer?: string;
		};
	}

	export interface AstrologerSearchRequestSortOptions {
		sortCategory?: "ranking" | "experience" | "orders" | "price";
		sortOrder?: "asc" | "desc";
	}
	export interface AstrologerSearchRequestFilterOptions {
		expertise?: Array<string>;
		language?: Array<string>;
		gender?: Array<string>;
		topAstrologer?: Array<string>;
	}
}

export {
    SearchTypes
}