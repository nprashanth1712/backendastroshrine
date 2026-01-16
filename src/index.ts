import express from "express";
const app = express();
const PORT = 5050;



import { NextFunction, Request, Response } from "express";
import userRouter from "./routes/user/User";
import channelRouter from "./routes/ChannelRouter";
import livestreamRouter from "./routes/user-channels/Channel";
import agoraTokenRouter from "./routes/agoraToken";
import chatRouter from "./routes/chat/Chat";
import handleError from "./constants/error/ErrorHandler";
import contentRouter from "./routes/ContentTemplate";
import notificationRouter from "./routes/NotificationRouter";
import swaggerFile from "../swagger_output.json";
import orderRouter from "./routes/payment/OrdersRouter";
import swaggerUi, { serve } from "swagger-ui-express";
import giftRouter from "./routes/gifts/GIftRouter";
import SessionRouter from "./routes/SessionRouter";
import astrologerRouter from "./routes/user/Astrologer";
import astrologerViewRouter from "./routes/user/AstrologerView";
import metaDataRouter from "./routes/metadata/MetadataRouter";
import fcmNotificationRouter from "./routes/firebase/FcmCloudNotification";
import astrologerCacheRouter from "./routes/CacheRouter";
import casesRouter from "./routes/Cases";
import razorPayRouter from "./routes/razorpay/RazorpayRouter"
import userSupabaseRouter from "./routes/user/UserSupabase";

import fileUpload from "express-fileupload";
import dotenv from "dotenv";
import validateUserInfo from "./constants/error/UserDetails";
dotenv.config();



// app.use((req: Request, res: Response, next: NextFunction) => {
//     res.setHeader('Connection', 'keep-alive');
//     res.setHeader('Keep-Alive', 'timeout=30');
//     next();
// });
app.use("/doc", swaggerUi.serve, swaggerUi.setup(swaggerFile));



// app.use(validateUserInfo);
app.use(fileUpload());

app.use("/v1/user", userRouter);
app.use("/v1/user-supabase", userSupabaseRouter);  // Supabase-based user routes
app.use("/v1/msg-channel/", channelRouter);
app.use("/v1/channel", livestreamRouter);
app.use("/v1/token", agoraTokenRouter);
app.use("/v1/astrologer", astrologerRouter);
app.use("/v1/astrologer-view", astrologerViewRouter);
app.use("/v1/chat", chatRouter);

app.use("/v1/support-case", casesRouter)
// app.use('/v1/privatecall', privateCallRouter);
app.use("/v1/content", contentRouter);
app.use("/v1/notification", notificationRouter);
app.use("/v1/order", orderRouter);
app.use("/v1/gifts", giftRouter);
app.use("/v1/session", SessionRouter);
// app.use("/v1/fcm-admin", fcmNotificationRouter);
app.use("/v1/meta-data", metaDataRouter)
app.use("/v1/astrologer/cache", astrologerCacheRouter);
app.use("/v1/razorpay", razorPayRouter)



app.get("/virgo.jpg", (req: Request, res: Response, next: NextFunction) => {
    console.log("caught");
    next();
});

app.get("/billa", (req: Request, res: Response, next: NextFunction) => {
    res.status(200).json({ status: "running" });
});

app.get("/health-check", (req: Request, res: Response, next: NextFunction) => {
    return res.status(200).json({ status: "running" });
});

app.use(express.static("assets"));

app.get("/", async (req: Request, res: Response) => {
    // console.log(process.env.NODE_ENV);
    res.status(200).send();
});

app.use(handleError);



const server = app.listen(PORT, () => {
    console.log("Server running");
});

// server.keepAliveTimeout = 30 * 1000;
server.requestTimeout = 10000;
// server.headersTimeout = 35 * 1000;
