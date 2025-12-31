import  PushNotifications from '@pusher/push-notifications-server';
import Pusher from "pusher";

const beamsClient = new PushNotifications({
  instanceId: "2bb80332-dad4-4489-b304-5373e9a8897d",
  secretKey: "805004EC811D95FEEB75C7BFB96B5CA5C5F718BE2BA3463873E2F18D27453EDE",
});

export const publishPushNotification = async ({ name }: { name: string }): Promise<void> => {
  const publishResp = await beamsClient.publishToInterests([name], {
    fcm: {
      notification: {
        title: 'Livestream Started',
        body: `The livestream has started`
      }
    }
  });
  console.log(JSON.stringify(publishResp));
};

export const pusher = new Pusher({
  appId: "1740351",
  key: "d5bf2e679e39c077979f",
  secret: "a7b5f7260057a35fc7f3",
  cluster: "ap2",
  useTLS: true
});

export const publishMessage = async ({ uri, action, message }: { uri: string; action: string; message: any }): Promise<void> => {
  console.log(`Pusher
  channel : ${uri},
  event : ${action}
  message : ${JSON.stringify(message)}
  `);
  await pusher.trigger(uri, action, message);
};

