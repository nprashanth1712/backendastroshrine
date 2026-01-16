import express, { Request, Response, NextFunction } from "express";
import { razorpay } from "../../services/orders/RazorPayService";
import { Payments } from "razorpay/dist/types/payments";
import getLogger from "../../services/Logger";
const logger = getLogger();
const router = express.Router({ mergeParams: true });
router.use(express.json());



// WE DON"T NEED THIS PLEASE DONT LOOK AT THIS WE DONT NEED THIS 
const captureRazorpayPaymentRouter = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {orderId} = req.params;
        console.log("HERE")
        console.log(await  razorpay.orders.fetch(orderId))
        const razorPayPaymentInfoList = await razorpay.orders.fetchPayments(orderId);
        console.log("HERE1")
        const razorPayPaymentInfo: Payments.RazorpayPayment = razorPayPaymentInfoList.items.at(-1) as Payments.RazorpayPayment;
        console.log("razorrrr ", JSON.stringify(razorPayPaymentInfo))
        if (razorPayPaymentInfoList.items.length == 0 || !razorPayPaymentInfo?.captured) {
            return res.json(404).json({"err": "Razorpay payment not found or captured already"})
        }
        const response = razorpay.payments.capture(razorPayPaymentInfo.id, razorPayPaymentInfo.amount, razorPayPaymentInfo.currency);
        console.log("\n\nRazorpay response = ", JSON.stringify(response));
        return res.status(200).json(response)
    } catch(error) {
        console.log("error while capturing payment router")
        next(error);
    }
}

router.post("/:orderId/capture", captureRazorpayPaymentRouter);

export default router;
