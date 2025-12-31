export interface PaymentDetails {
    id: string,
    method?: string,
    status?: string,
}


export interface Order {
    userId: string,
    razorPayOrderId: string,
    createTs: number,
    status: string,
    amount: number,
    paymentDetails: Array<PaymentDetails>
}



