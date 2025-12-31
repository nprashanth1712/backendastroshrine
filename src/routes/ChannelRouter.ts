import express from 'express'
import { NextFunction, Request, Response } from 'express';
import {publishMessage, publishPushNotification, pusher} from "../services/Pusher";

import Pusher from 'pusher-js';

const pusher_js = new Pusher('d5bf2e679e39c077979f', {
        cluster: "ap2",
        channelAuthorization: {       
        transport: "ajax",
        endpoint: "http://127.0.0.1:5050/v1/msg-channel/pusher/auth" ,
        headers: {
                'Content-Type': 'application/json',
            }
        }
})

const router = express.Router();

router.use(express.json())

router.post("/pusher/auth", function (req: Request, res: Response, next: NextFunction) {
        // #swagger.tags = ['Pusher Control']
  try {
        const socketId = req.body.socket_id;
        const channel = req.body.channel_name;
        const presenceData = {
        user_id: "unique_user_id",
        user_info: { name: "Mr Channels", twitter_id: "@pusher" },
        };
  // This authenticates every user. Don't do this in production!
        const authResponse = pusher.authorizeChannel(socketId, channel, presenceData);
        res.send(authResponse);
  } catch(error) {
        next(error);
  }
});


router.get('/pusher/auth', async (req: Request, res: Response, next: NextFunction) => {
        // #swagger.tags = ['Pusher Control']
        try {
                let start =  console.time();
                pusher_js.connection.bind( 'error', function( err: any ) {
                        if( err.data.code === 4004 ) {
                        console.log('Over limit!');
                        }
                })
                console.log("socket_id" + pusher_js.connection.socket_id)
                console.timeEnd();
                res.status(200).send(pusher_js.connection.socket_id);
        } catch (error) {
                console.error(error)
		next(error);
        }
})

router.post("/pusher/subscribe", async (req: Request, res: Response, next: NextFunction) => {
        // #swagger.tags = ['Pusher Control']
        const body = req.body;
        try  {
                const channel = await pusher_js.subscribe(req.body.channel_name);
                console.log(channel);
                res.status(200).json()
        } catch(error) {
                console.log(error);
                next(error);
        }
})


// router.get("/pusher/dosomething", async(req: Request, res: Response, next: NextFunction) => {
//         try {
//                 await publishMessage({uri: "01J6VDPDEGZN7DED7TAWFQ3NWK", action: "DOIT", message:"HELLO"})
//                 res.status(200).json();
//         } catch(error) {
//                 console.log(error);
//                 next(error);
//         }
// })
export default router;