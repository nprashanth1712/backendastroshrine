import { invalidParameter } from "../../utils/ErrorUtils";
import { handleUpdateUserNotificationRead } from "./UserNotifications";



export const userNotificationPatchHandler = ({ op, path }: { op: string; path: string }) => {
    switch (op.toUpperCase()) {
        case "REPLACE":
            return userNotificationReplaceHandler({ path });
        default:
            throw {
                statusCode: 400,
                code: "INVALID_PARAM",
                message: invalidParameter(op),
            };
    }
};

const userNotificationReplaceHandler = ({ path }: { path: string }) => {
    switch (path.toUpperCase()) {
        case "READ":
            return handleUpdateUserNotificationRead;
        default:
            throw {
                statusCode: 400,
                code: "INVALID_PARAM",
                message: invalidParameter(path),
            };
    }
};

