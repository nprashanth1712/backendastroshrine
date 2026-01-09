import { Consumer } from "sqs-consumer";
import { DeleteMessageCommand, SendMessageCommand, SendMessageCommandOutput, SQSClient } from "@aws-sdk/client-sqs";
import AWS from "aws-sdk";
import { QueueMessageSQSRequest } from "../../types/async-queue-service/QueueService";

// SQS is optional - set SQS_QUEUE_URL in env to enable
const queueUrl = process.env.SQS_QUEUE_URL || "";
const sqsEnabled = !!queueUrl && !!process.env.AWS_ACCESS_KEY_ID;

const sqsClient = sqsEnabled ? new SQSClient({
	region: process.env.AWS_DEFAULT_REGION as string,
	credentials: {
		accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
		secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
	},
}) : null;

export const sendMessageToSQS = async ({ messageRequest }: { messageRequest: QueueMessageSQSRequest }) => {
	// If SQS is not configured, log and return gracefully (non-blocking)
	if (!sqsEnabled || !sqsClient) {
		console.log(`[SQS SKIP] SQS not configured, skipping: ${messageRequest.requestType}`);
		return { MessageId: 'skipped', skipped: true };
	}

	try {
		const params: SendMessageCommand = new SendMessageCommand({
			DelaySeconds: messageRequest.timeToDelay,
			// MessageGroupId: "GROUP1",
			// MessageDeduplicationId: 'MessageDup1',
			MessageAttributes: {
				Title: {
					DataType: "String",
					StringValue: "title",
				},
			},
			MessageBody: JSON.stringify(messageRequest),
			QueueUrl: queueUrl,
		});
		const response: SendMessageCommandOutput = await sqsClient.send(params);
		console.log(response);
		return response;
	} catch (error) {
		// Log error but don't throw - SQS failures shouldn't block main functionality
		console.error(`[SQS ERROR] Failed to send ${messageRequest.requestType}:`, error);
		return { MessageId: 'error', error: true };
	}
};

// const consumerClient = Consumer.create({
//     queueUrl,
//     handleMessage: async (message) => {
//         console.log("SQS MESSAGE", message);
//         const params: DeleteMessageCommand = new DeleteMessageCommand({
//             QueueUrl: queueUrl,
//             ReceiptHandle: message.ReceiptHandle
//         });
//         await sqsClient.send(params);
//     },
//     sqs: sqsClient,
//     visibilityTimeout: 20,

// })
// consumerClient.on('error', (err: any) => {
//     console.log("SQS ERROR", err);
// })
// consumerClient.on("processing_error", (err: any) => {
//     console.log("SQS processing error", err);
// })
// consumerClient.start();
// if doesn't get in 20 secs, return
