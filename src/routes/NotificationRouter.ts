import express, { NextFunction, Request, Response } from "express";
import { missingParameter } from "../utils/ErrorUtils";
import { initializeMail } from "../services/notifications/TriggerZohoNotifications";
const router = express.Router();
router.use(express.json());

const initializeNotificationRouter = async (req: Request, res: Response, next: NextFunction) => {
     /* 
        #swagger.tags = ['Notification Control']
	#swagger.summary = 'Send a mail to an email'
	
        #swagger.parameters['body'] = 
	{
		in: "body",
		description: "Send the mailData to the email.",
		'@schema': 
                {
			"required": ["email", "mailData"], 
		 	"properties" : 
                        {
				"email" : {
					"type" : "string",
					"description": "email of the user",
				},
			        "mailData" : {
					"type": "string",
					"description": "mail data to send to the particular email"
				},
		        	
            }
		}
	}; 

        */
    const {email, mailData} = req.body;
    if(!req.files || !req.files.file) {
        throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("The file could not be uploaded")};
        return;
    }
    const attachments = req.files;
    try {
        await initializeMail({ email, mailData, attachments});
        res.status(200).send();
        return;
    } catch(error) {
        res.status(400);
        next(error)
    }
}

router.post("/mail", initializeNotificationRouter);

export default router;