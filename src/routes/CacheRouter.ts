import express from 'express'
import { NextFunction, Request, Response } from 'express';
import {publishMessage, publishPushNotification, pusher} from "../services/Pusher";
import { SearchService } from '../services/search/SearchService';


const router = express.Router();

router.use(express.json())

router.patch("/", async function (req: Request, res: Response, next: NextFunction) {
        // #swagger.tags = ['Pusher Control']
  try {
        await SearchService.cacheAllAstrologers();
        return res.status(200).json({"status": "success"})
  } catch(error) {
        next(error);
  }
});

export default router;
