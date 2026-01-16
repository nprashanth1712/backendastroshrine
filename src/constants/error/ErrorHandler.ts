import { ErrorCodeKeys, ErrorCodes } from "./ErrorCodes";
import { NextFunction, Request, Response } from "express";
import getLogger from "../../services/Logger";
import { logInformation } from "../../services/logging/CloudWatchService";
const logger = getLogger();
 
interface HttpException extends Error {
    statusCode: number;
    code: string;
    message: string;
    type?: string;
}
 
const getCallerFunctionName = (error: Error): string => {
    const stack = error.stack?.split("\n") || [];
 
    if (stack.length > 1) {
        const callerLine = stack[1].trim();
        const match = callerLine.match(/at (\w+)/);
        return match ? match[1] : "anonymous";
    }
    return "unknown";
};
 
type ErrorWrapper = HttpException & { errorObj: any };



const handleError = (
    error: ErrorWrapper,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    console.error("ERROR\n");
 
 
    console.error(
        `Function that probably called the error: ${getCallerFunctionName(
            error
        )}`
    );
    console.error("Error details:", JSON.stringify(error));
 
    if (error.statusCode === 400 && error.type === "entity.parse.failed") {
        return res.status(400).send({
            err: "Entity parse failed, please recheck request body",
        });
    }
    let errMsg = error.message
    if (
        ErrorCodeKeys[error.statusCode?.toString()]?.includes(error.name) ||
        ErrorCodeKeys[error.statusCode?.toString()]?.includes(error.code)
    ) {
       
        if (error.code == "ConditionalCheckFailedException") {
            return res.status(error.statusCode).send({
                err: `${
                    ErrorCodes[error.statusCode.toString()][error.code] ||
                    error.message
                }`,
            });
            return;
        }
 
        let errFn = ErrorCodes[error.statusCode.toString()][error.code];
 
        if (typeof errFn === "function") errMsg = errFn(error.errorObj);
        else
            errMsg = error.message
                ? error.message
                : `${
                      ErrorCodes[error.statusCode.toString()][error.code] ||
                      error.message
                  }`;
    } else {
        logger.error(error);
    }
    res.status(error.statusCode || 500).send({ err: errMsg });
    return;
};
export default handleError;