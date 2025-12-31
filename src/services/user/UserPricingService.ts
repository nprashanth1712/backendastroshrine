// Supabase Migration: Using Supabase DAOs instead of DynamoDB
import { AstrologerDao } from "../../data-access-supabase/AstrologerDao";
import { UserDao } from "../../data-access-supabase/UserDao";

// Adapter functions to match the old DynamoDB interface
const getAstrologerById = AstrologerDao.getAstrologerById.bind(AstrologerDao);
const updateAstrologerPricingData = AstrologerDao.updateAstrologerPricingData.bind(AstrologerDao);
const getUserById = UserDao.getUserById.bind(UserDao);
const updateUserBalance = UserDao.updateUserBalance.bind(UserDao);

// export const userStatusPatchHandler = ({
//     op,
//     path,
// }: {
//     op: string;
//     path: string;
// }) => {
//     switch (op) {
//         default:
//         case "REPLACE":
//             return userStatusReplaceHandler({ path });

//             throw {
//                 statusCode: 400,
//                 code: "INVALID_PARAM",
//                 message: invalidParameter(op),
//             };
//     }
// };
// const userStatusReplaceHandler = ({ path }: { path: string }) => {
//     switch (path) {
//         case "livestream/rate": {
//             return handleChannelRate.bind(null, "livestream");
//         }
//         case "chat/rate": {
//             return handleChannelRate.bind(null, "chat");
//         }
//         case "call/rate": {
//             return handleChannelRate.bind(null, "call");
//         }
//         case "livestream/offer": {
//             return handleChannelOffer.bind(null, "livestream");
//         }
//         case "chat/offer": {
//             return handleChannelOffer.bind(null, "chat");
//         }
//         case "call/offer": {
//             return handleChannelOffer.bind(null, "call");
//         }
//         default:
//             throw {
//                 statusCode: 400,
//                 code: "INVALID_PARAM",
//                 message: invalidParameter(path),
//             };
//     }
// };

const handleChannelRate = async (
    channelType: string,
    userId: string,
    value: number
) => {
    let astrologerDetails = await getAstrologerById(userId);
    let updatedCurrentStatus = astrologerDetails.pricingData;
    switch(channelType.toLowerCase()) {
        case "livestream": {
            updatedCurrentStatus.livestream.rate = value;
            break;
        };
        case "chat": {
            updatedCurrentStatus.chat.rate = value;
            break;
        };
        case "call": {
            updatedCurrentStatus.call.rate = value;
            break;
        };
        default: {
            throw {
                statusCode: 400,
                code: "UnableToParseUserStatuses",
                message: "Unable to parse user's pricing status",
            };
        }
    }
    const response = await updateAstrologerPricingData(
        { id: userId, pricingData: updatedCurrentStatus });
    return response; 
}

const handleChannelOffer = async (
    channelType: string,
    userId: string,
    value: number
) => {
    let astrologerDetails = await getAstrologerById(userId);
    let updatedCurrentStatus = astrologerDetails.pricingData;
    switch(channelType.toLowerCase()) {
        case "livestream": {
            updatedCurrentStatus.livestream.offer = value;
            break;
        };
        case "chat": {
            updatedCurrentStatus.chat.offer = value;
            break;
        };
        case "call": {
            updatedCurrentStatus.call.offer = value;
            break;
        };
        default: {
            throw {
                statusCode: 400,
                code: "UnableToParseUserStatuses",
                message: "Unable to parse user's pricing status",
            };
        }
    }
    const response = await updateAstrologerPricingData(
        { id: userId, pricingData: updatedCurrentStatus });
    return response; 
}

export {
    handleChannelOffer,
    handleChannelRate
}