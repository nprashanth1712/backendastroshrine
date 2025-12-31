import { invalidParameter } from "../../utils/ErrorUtils";
import { handleUpdateUserNotificationRead } from "../user-notifications/UserNotifications";



export const astrologerNotificationPatchHandler = ({ op, path }: { op: string; path: string }) => {
    switch (op.toUpperCase()) {
        case "REPLACE":
            return astrologerNotificationReplaceHandler({ path });
        default:
            throw {
                statusCode: 400,
                code: "INVALID_PARAM",
                message: invalidParameter(op),
            };
    }
};

const astrologerNotificationReplaceHandler = ({ path }: { path: string }) => {
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

