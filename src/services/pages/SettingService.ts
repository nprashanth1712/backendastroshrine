import {
	getUserSettingsDataByUserId,
	updateSettingsChannelById,
	updateSettingsLanguageById,
} from "../../data-access/PagesDao";
import { Settings, SettingsChannel } from "../../types/pages/Settings";
import { invalidParameter } from "../../utils/ErrorUtils";

type SettingsHandlerFunction = (args: {
	userId: string;
	value: any;
}) => Promise<any>;

const monoChannelHandler = (path: string): SettingsHandlerFunction => {
	return async function ({
		userId,
		value,
	}: {
		userId: string;
		value: boolean;
	}) {
		return await settingsChannelHandler({ userId, path, value });
	};
};

export const settingsUpdateHandler = ({
	op,
	path,
}: {
	op: string;
	path: string;
}) => {
	switch (op.toUpperCase()) {
		case "REPLACE":
			return replaceHandler({ path });
		default:
			throw {
				statusCode: 400,
				code: "INVALID_PARAM",
				message: invalidParameter(op),
			};
	}
};

const replaceHandler = ({ path }: { path: string }) => {
	switch (path.toUpperCase()) {
		case "LIVESTREAM":
		case "CHAT":
		case "CALL": {
			return monoChannelHandler(path.toUpperCase());
		}
		case "LANGUAGE":
			return settingsLanguageHandler;
		default:
			throw {
				statusCode: 400,
				code: "INVALID_PARAM",
				message: invalidParameter(path),
			};
	}
};

const settingsChannelHandler = async ({
	userId,
	path,
	value,
}: {
	userId: string;
	path: string;
	value: boolean;
}) => {
	const settingsData: Settings = (await getUserSettingsDataByUserId({
		id: userId,
	})) as Settings;
	const channel = settingsData.channel;

	switch (path.toUpperCase()) {
		case "LIVESTREAM": {
			channel.livestreamActive = value;
			break;
		}
		case "CHAT": {
			channel.chatActive = value;
			break;
		}
		case "CALL": {
			channel.callActive = value;
			break;
		}
		default: {
			throw {
				statusCode: 400,
				code: "INVALID_PARAMETER",
				message: "Path Not Valid",
			};
		}
	}
	const updatedData = await updateSettingsChannelById({
		userId,
		channel: channel,
	});
	return updatedData;
};

const settingsLanguageHandler = async ({
	userId,
	value,
}: {
	userId: string;
	value: string;
}) => {
	const supportedLanguages = ["HINDI", "ENGLISH"];
	if (!supportedLanguages.includes(value.toUpperCase())) {
		throw {
			statusCode: 400,
			code: "INVALID_LANGUAGE",
			message: "Language Not Supported",
		};
	}
	const updatedData = await updateSettingsLanguageById({
		userId,
		language: value,
	});

	return updatedData;
};
