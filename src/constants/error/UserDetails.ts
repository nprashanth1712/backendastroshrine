import { Request, Response, NextFunction } from "express";
import { logInformation } from "../../services/logging/CloudWatchService";
import { HeaderTraceRequest } from "../../types/request-header/TraceHeader";



const validateUserInfo = (req: Request, res: Response, next: NextFunction) => {
    try {
        const userInfoHeader = req.headers["x-astroshrine-trace"];
        console.log("THe user details are ", userInfoHeader);


        const userInfoHeaderParsed: HeaderTraceRequest = JSON.parse(userInfoHeader as string);
        console.log(userInfoHeaderParsed)

        
        if (!userInfoHeaderParsed.userId || !userInfoHeaderParsed.userName) {
            return res.status(400).json({ error: "Invalid or missing userId/username" });
        }
        
        logInformation({
            logType: "info",
            title: userInfoHeaderParsed.userName + " sent a request " + req.baseUrl,
            information: {
                ...userInfoHeaderParsed,
                userId: `USERID = ` + userInfoHeaderParsed.userId,
                userName: `USERNAME = ` + userInfoHeaderParsed.userName,
                requestBody : req.body,
                call: req.method?.toUpperCase() + " " + req.baseUrl,
            } as HeaderTraceRequest,
        })
        next();
    } catch (error) {
        console.log("fucked")
        return res.status(400).json({ error: "Invalid X-Astroshrine-UserInfo format" });
    }
};

export default validateUserInfo;
