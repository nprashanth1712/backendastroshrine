import { getGiftById, initializeGift } from "../data-access/GiftsDao";
import { getUserById, updateUserBalance } from "../data-access/UserDao";
import { initializeUserOrder } from "../data-access/UserOrdersDao";
import { Gift } from "../types/gifts/Gifts";
import { PutObjectCommand, s3Client } from "./AWSS3";
import { ulid } from "ulid";
import { logInformation } from "./logging/CloudWatchService";
import { initializeAstrologerAndUserOrder } from "../data-access/multiple-access/AstrologerUserOrderDao";
import { getAstrologerById } from "../data-access/AstrologerDao";
import { UserOrder } from "../types/order/UserOrder";
import { GiftMetaDataContent, MetaData } from "../types/metadata/Metadata";

export const handleSendGiftToChannel = async ({ userId, hostId, giftId }: { userId: string; hostId: string; giftId: string }) => {
	const currentTime = Date.now();
	const userData = await getUserById(userId);

	const giftData: MetaData = await getGiftById({ giftId });

	if (!giftData?.id) {
		throw {
			statusCode: 404,
			code: "GiftNotFound",
			message: "The specified gift does not exist",
		};
	}

	let giftContent;
	if (giftData?.metadataType === "gift") giftContent = giftData?.content as GiftMetaDataContent;

	if (!giftContent?.name) {
		throw {
			statusCode: 404,
			code: "GiftNotFound",
			message: "The specified gift does not exist",
		};
	}
	if (userData?.currentUserOrder?.channelId) {
		throw {
			statusCode: 404,
			code: "UserIsBusy",
			message: "The user is busy in another channel",
		};
	}
	let { balance } = userData;
	if (balance < giftContent.amount) {
		throw {
			statusCode: 400,
			code: "CannotSentGift",
			message: "Cannot send gift, not enough balance.",
		};
	}
	const hostData = await getAstrologerById(hostId);
	if (!hostData) {
		throw {
			statusCode: 404,
			code: "AstrologerNotFound",
			message: "The astrologer does not exist",
		};
	}
	const orderData = {
		userId,
		timestamp: currentTime,
		hostId,
		amount: giftContent.amount,
		userName: userData?.name,
		hostName: hostData?.name,
		orderType: "GiftSent",
		subOrderType: giftId,
	};
	const userOrder: UserOrder = await initializeAstrologerAndUserOrder(orderData);

	logInformation({
		logType: "info",
		title: "User sent gift to host",
		information: {
			userId: userId,
			channelId: hostId,
			amount: giftContent.amount,
			timestamp: currentTime,
		},
	});

	return userOrder;
};

export const addGift = async ({ giftName, giftAmount, file }: { giftName: string; giftAmount: string; file: any }) => {
	const giftId = ulid();
	const imageUrl = await uploadGiftImageS3({ id: giftId, file: file });
	const uploadedGiftData = await initializeGift({ id: giftId, name: giftName, amount: parseInt(giftAmount), imageUrl });
	return uploadedGiftData;
};

export const uploadGiftImageS3 = async ({ id, file }: { id: string; file: any }) => {
	const fileTypeExtension = file.mimetype.split("/")[1];
	const fileKey = `${id}.${fileTypeExtension}`;
	const bucketParams = {
		Bucket: process.env.AWS_S3_BUCKET_GIFT_MEDIA,
		Key: fileKey,
		Body: file.data,
	};
	try {
		const s3Response = await s3Client.send(new PutObjectCommand(bucketParams));
		return fileKey;
	} catch (err) {
		console.log("Error uploading gift image", err);
		throw {
			statusCode: 500,
			code: "FILE_UPLOAD_FAILED",
			message: "Error to upload gift image for gift id :" + id + ". err: " + JSON.stringify(err),
		};
	}
};
