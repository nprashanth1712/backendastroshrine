import express, { NextFunction, Request, Response } from "express";

import getLogger from "../../services/Logger";
// Supabase Migration: Using Supabase DAOs
import { MetadataDao } from "../../data-access-supabase/MetadataDao";
import { MetaDataType } from "../../types/metadata/Metadata";
import { invalidParameter, missingParameter } from "../../utils/ErrorUtils";
import { AddMetaDataRequest } from "../../types/metadata/Request";
import { ulid } from "ulid";

// Use Supabase DAO methods
const getMetadataListByStatus = MetadataDao.getMetadataListByStatus.bind(MetadataDao);
const getMetadataListByTypeStatus = MetadataDao.getMetadataListByTypeStatus.bind(MetadataDao);

const logger = getLogger();
const router = express.Router({ mergeParams: true });
router.use(express.json());

const getMetadataListByStatusRouter = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const metadataList = await getMetadataListByStatus({ status: "ACTIVE" });
		for (const metadata of metadataList!) {
			if (metadata?.content.imageUrl)
				metadata.content.imageUrl =
					process.env.AWS_S3_URL?.replace(
						"{{}}",
						process.env.AWS_S3_BUCKET_NAME_METADATA_PUBLIC!
					) +
					"/" +
					metadata.content.imageUrl;
		}
		return res.status(200).json(metadataList);
	} catch (error) {
		next(error);
	}
};
const getMetadataListByTypeRouter = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const metadataType = req.params.type as MetaDataType;
		const metadataList = await getMetadataListByTypeStatus({ metadataType: metadataType, status: "ACTIVE" });

        for (const metadata of metadataList!) {
			if (metadata?.content.imageUrl)
				metadata.content.imageUrl =
					process.env.AWS_S3_URL?.replace(
						"{{}}",
						process.env.AWS_S3_BUCKET_NAME_METADATA_PUBLIC!
					) +
					"/" +
					metadata.content.imageUrl;
		}
		res.status(200).json(metadataList);
	} catch (error) {
		logger.error(error);
		next(error);
	}
};

const addNewMetaData = async (req: AddMetaDataRequest, res: Response, next: NextFunction) => {
	try {
		const rawMetaData = req.body.metaData;
		const metaData = typeof rawMetaData === "string" ? JSON.parse(rawMetaData) : rawMetaData;

		const metadataType = req.params.type as MetaDataType;

		console.log(metaData);
		if (!metaData.name) {
			throw { statusCode: 400, code: "InvalidParameter", message: missingParameter("name") };
			return;
		}

		if (!metaData.content) {
			throw { statusCode: 400, code: "InvalidParameter", message: missingParameter("content") };
			return;
		}

		if (!metadataType || !["gift", "advertisement", "avatar"].includes(metadataType)) {
			throw { statusCode: 400, code: "InvalidParameter", message: invalidParameter("metadataType") };
			return;
		}

		const MetaDataId = ulid();

		if (req.files && req.files.file) {
			const file = req.files.file;
			console.log("FILEEEE:", file);
			const s3Key = await uploadMetaDataMedia({
				id: MetaDataId,
				file: { data: file.data },
				name: metaData.name + file.name.slice(file.name.indexOf("."), file.name.length),
			});

			metaData.content.imageUrl = s3Key;
		} else {
			throw {
				name: "UPLOAD_ERROR",
				message: `Unable to add MetaData`,
			};
		}

		const response = await addMetaData({
			id: MetaDataId,
			name: metaData.name,
			content: metaData.content,
			metadataType: metadataType,
		});

		res.status(200).json(response);
	} catch (error) {
		logger.error(error);
		next(error);
	}
};

router.get("/", getMetadataListByStatusRouter);
router.get("/:type", getMetadataListByTypeRouter);
router.post("/:type", addNewMetaData);
export default router;
