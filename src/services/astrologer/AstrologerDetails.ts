import { ErrorReply } from "redis";
// Supabase Migration: Using Supabase DAOs instead of DynamoDB
import { AstrologerDao } from "../../data-access-supabase/AstrologerDao";
import { AstrologerCurrentChannel } from "../../types/astrologer/Astrologer";
import { invalidParameter } from "../../utils/ErrorUtils";
import { createHash } from "node:crypto";
import { Review } from "../../types/reviews/Reviews";

// Adapter functions to match the old DynamoDB interface
const getAstrologerById = AstrologerDao.getAstrologerById.bind(AstrologerDao);
const updateAstrologerCurrentChannel = AstrologerDao.updateAstrologerCurrentChannel.bind(AstrologerDao);
const updateAstrologerDataHash = AstrologerDao.updateAstrologerDataHash.bind(AstrologerDao);
const updateAstrologerHostProfile = AstrologerDao.updateAstrologerHostProfile.bind(AstrologerDao);

export const astrologerPatchHandler = ({
	op,
	path,
}: {
	op: string;
	path: string;
})  => {
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
	console.log("THE PATH IS ", path.toUpperCase())
	switch (path.toUpperCase()) {
		case "CURRENTCHANNEL":
			return updateAstrologerCurrentChannelHandler;
		case "HOSTPROFILE/REVIEWS": 
			return updateAstrologerTopReviewsHandler;
		default:
			throw {
				statusCode: 400,
				code: "INVALID_PARAM",
				message: invalidParameter(path),
			};
	}
};

const updateAstrologerTopReviewsHandler = async ({id, value}: {id: string, value: Array<Review>}) => {
    try {
        if (value.length > 5) {
            throw {
				statusCode: 400,
				code: "INVALID_PARAM",
				message: invalidParameter('topReviews: Required Length - 5'),
			};
        };
        const astrologer = await getAstrologerById(id);
        if (!astrologer.id) {
            throw {
				statusCode: 400,
				code: "AstrologerNotExists",
				message: "The astrologer does not exist",
			};
        }
		astrologer.hostProfile.topReviews = value;
        const response = await updateAstrologerHostProfile({id: astrologer.id, name: astrologer.name, hostProfile: astrologer.hostProfile});
        return response;
    } catch(error) {
        console.log("error in updateAstrologerCurrentChannelHandler ", error);
        throw error;
    }
}  

const updateAstrologerCurrentChannelHandler = async ({id, value}: {id: string, value: AstrologerCurrentChannel}) => {
    try {
        if (!value?.livestream) {
            throw {
				statusCode: 400,
				code: "INVALID_PARAM",
				message: invalidParameter('value.livestream'),
			};
        };
        if (!value?.chat) {
            throw {
				statusCode: 400,
				code: "INVALID_PARAM",
				message: invalidParameter('value.chat'),
			};
        };
        if (!value?.call) {
            throw {
				statusCode: 400,
				code: "INVALID_PARAM",
				message: invalidParameter('value.call'),
			};
        };
        const astrologer = await getAstrologerById(id);
        if (!astrologer.id) {
            throw {
				statusCode: 400,
				code: "AstrologerNotExists",
				message: "The astrologer does not exist",
			};
        }
        const response = await updateAstrologerCurrentChannel({id, currentChannel: value});
        return response;
    } catch(error) {
        console.log("error in updateAstrologerCurrentChannelHandler ", error);
        throw error;
    }
}

export const generateAstrologerHash = async ({id} : {id: string}) => {
	const astrologer = await getAstrologerById(id);

	const dataToUse = {
		name: astrologer.name,
		experience: astrologer?.hostProfile?.experience,
		expertise: astrologer?.hostProfile?.expertise,
		aboutMe: astrologer?.hostProfile?.aboutMe,
		languages: astrologer?.hostProfile?.languages,
		media: astrologer?.hostProfile?.media,
		reviews: astrologer?.hostProfile?.topReviews,
	};
	const hash = createHash('sha256').update(JSON.stringify(dataToUse)).digest('hex')
	return hash;
}
export const handleUpdateAstrologerHash = async ({id}: {id: string}) => {
	
	const hash = await generateAstrologerHash({id});
	console.log("hash is ", hash);
	const response = await updateAstrologerDataHash({id, dataHash: hash})
	return response;
}
