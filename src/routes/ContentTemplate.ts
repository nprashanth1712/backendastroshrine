import express, { NextFunction, Request, Response } from "express";
import { UpdateUserProfilePicRequest } from "../types/user/Request";
import { UploadSampleRequest, UploadTemplateRequest } from "../types/template/Request";
import { getPresignedUrl, uploadContentTemplate, uploadTemplateSample } from "../services/content-template/TemplateService";
import { missingParameter } from "../utils/ErrorUtils";
import getLogger from "../services/Logger";
import { Readable } from "stream";
const logger = getLogger();
const router = express.Router({ mergeParams: true });

router.use(express.json())

const uploadContentRouter = async(req: UploadTemplateRequest, res: Response, next: NextFunction) => {
    try {

        const { channelType, name, format } = req.body;
        console.time();
        console.log("request ")

        if(!req.files || !req.files.file) {
            res.status(400).json({ err: missingParameter("The file could not be uploaded") });
			return;
        }
        if (!channelType) {
            res.status(400).json({ err: missingParameter("channelType") });
			return;
        }
        if (!name) {
            res.status(400).json({ err: missingParameter("name") });
			return;
        }
        if (!format) {
            res.status(400).json({ err: missingParameter("format") });
			return;
        }
        const file = req.files.file;
        const contentData = await uploadContentTemplate({ name, channelType, file: { data: file.data }, format });
        res.status(201).json({contentData});
        console.timeEnd()
    } catch (error) {
        logger.error(error);
        next(error)
    }
}


const getUploadRouterTemplate = async(req: Request, res: Response, next: NextFunction) => {
    const id: string = req.query.id as string;
    console.log("filekey is " + id);
    try {
        const response = await getPresignedUrl({id});
        res.redirect(response);
    } catch(error: any) {
        logger.error(error);
        next(error)
    }
}

// const getSamplesRouter = async(req: Request, res: Response, next: NextFunction) => {
//     const id: string = req.query.id as string;
//     console.log("template id is " + id);
//     try {
//         const response = await retrieveTemplateSamples( { id });
//         res.json(response);
//     } catch(err) {
//         logger.error(err);
//         next(err);
//     }
// }

const uploadTemplateSampleRouter = async(req: UploadSampleRequest, res: Response, next: NextFunction) => {
    const { id } = req.body;
    
    if(!req.files || !req.files.file) {
        res.status(400).json({ err: missingParameter("The file could not be uploaded") });
        return;
    }

    if (!id) {
        res.status(400).json({ err: missingParameter("id") });
        return;
    }
    try {
        const file = req.files.file;
        const response = await uploadTemplateSample({id,  file: { data: file.data }})
        res.status(200).json(response)
    } catch(error) {
        logger.error(error);
        next(error);
    }
}

/*
const testFunction = async (req: Request, res: Response, next: NextFunction) => {
    const id = req.query.id as string; 
    try {
        const fileStream = await (await retrieveContentFile({ id })).Body?.transformToByteArray();
        res.attachment('filename.jpg');
        if (fileStream) {
            const test = Readable.from(fileStream)  
            // (await retrieveContentFIle({id})).Body?.transformToWebStream();
            // 
            console.log(test);
            test.pipe(res);
        } 
    } catch(error) {
        logger.error(error);
        next(error);
    }
}
*/

const getSignedUrlRouter = async (req: Request, res: Response, next: NextFunction) => {
    const id = req.query.id as string;
    try {
        const response = await getPresignedUrl({id});
        res.redirect(response);
    } catch(error: any) {
        logger.error(error);
        next(error)
    }
}

router.post('/', uploadContentRouter)
router.get("/", getUploadRouterTemplate);
router.post("/sample", uploadTemplateSampleRouter);
router.get("/test", getSignedUrlRouter);
export default router;