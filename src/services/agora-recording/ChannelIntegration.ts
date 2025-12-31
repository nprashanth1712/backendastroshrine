import { RtcTokenBuilder, RtcRole } from "agora-token";
import { storageConfig } from "../../constants/Config";
import { Channel, TempHost } from "../../types/livestream/models/Livestream";
import {
  AcquireResourceIdResponse,
  StartRecordingRequest,
  StartRecordingResponse,
  StopRecordingRequest,
  StopRecordingResponse,
} from "../../types/recordings/Recording";
import {
  handleAcquireResourceIdReq,
  handleStartRecordingReq,
  handleStopRecordingReq,
} from "./Utils";
import { getSpecificUserOrderByUserIdTs } from "../../data-access/UserOrdersDao";
import { removeSpecialCharacters } from "../../utils/StringUtils";

export { initiateRecording, stopRecording };

const initiateRecording = async ({
  channelId,
  tempHost,
  hostUid,
}: {
  channelId: string;
  tempHost: TempHost & { uid: number };
  hostUid: string;
}) => {
  console.log("temphoe ", tempHost);
  const acquireResourceIdResponse: AcquireResourceIdResponse | null =
    await handleAcquireResourceIdReq({
      cname: channelId,
      uid: tempHost?.uid?.toString(),
      clientRequest: {
        scene: 0,
        resourceExpiredHour: 24,
      },
    });
  if (!acquireResourceIdResponse) {
    throw {
      statusCode: 500,
      code: "FailedToAcquireResourceID",
      message: "The acquireResourceId gives no resource id",
      errorObj: {
        userId: tempHost.id,
      },
    };
  }
  console.log("TH: ", tempHost);
  const { resourceId } = acquireResourceIdResponse;
  console.log("ResId: ", resourceId);

  // get the expire time
  type stringOrNum = string | number;
  let expireTime: stringOrNum = 3600;
  // calculate privilege expire time
  const currentTimeTemp = Math.floor(Date.now() / 1000);
  const privilegeExpireTime = currentTimeTemp + (expireTime as number);
  const token = RtcTokenBuilder.buildTokenWithUid(
    process.env.AGORA_APP_ID + "",
    process.env.AGORA_APP_CERT + "",
    channelId,
    tempHost.uid,
    RtcRole.PUBLISHER,
    privilegeExpireTime,
    privilegeExpireTime
  );
  console.log(
    "temphost recording: ",
    tempHost?.id,
    tempHost?.channelType,
    channelId,
    tempHost?.startTime?.toString()
  );

  ///// Start Recording Call: /////
  const tempHostIdWithRemovedSpecialCharacters = removeSpecialCharacters(
    tempHost?.id
  );
  const channelIdWithRemovedSpecialCharacters =
    removeSpecialCharacters(channelId);

  const startRecReq: StartRecordingRequest = {
    cname: channelId,
    uid: tempHost.uid?.toString(),
    clientRequest: {
      token: token,
      recordingConfig: {
        channelType: 1,
        maxIdleTime: 30,
        streamTypes: 0,
        subscribeAudioUids: [tempHost.uid?.toString(), hostUid?.toString()],
        // subscribeAudioUids: ["#allstream#"],
        subscribeUidGroup: 0,
        streamMode: "original",
      },
      recordingFileConfig: {
        AVFileType: ["mp4"],
      },
      storageConfig: {
        ...storageConfig,
        fileNamePrefix: [
          tempHostIdWithRemovedSpecialCharacters,
          tempHost?.channelType,
          channelIdWithRemovedSpecialCharacters,
          tempHost?.startTime?.toString(),
        ],
      },
    },
  } as StartRecordingRequest;

  const startRecordingResponse: StartRecordingResponse | undefined =
    await handleStartRecordingReq(startRecReq, resourceId, "mix");

  if (!startRecordingResponse) {
    throw {
      statusCode: 500,
      code: "FailedToStartRecording",
      message: "Start recording process failed",
      errorObj: {
        userId: tempHost.id,
        resourceId: resourceId,
      },
    };
  }
  return startRecordingResponse;
};

const stopRecording = async ({ channel }: { channel: Channel }) => {
  // GET ORDER DATA OF RECORDING CHANNEL
  const fetchedUserOrderData = await getSpecificUserOrderByUserIdTs({
    userId: channel.tempHost.id,
    ts: channel.tempHost.startTime as number,
  });

  // THE ORDER WAS NOT FOUND
  if (!fetchedUserOrderData) {
    throw {
      statusCode: 404,
      code: "UserOrderNotFound",
      message: "The user order coud not be found ",
    };
  }

  const stopRecordingData: StopRecordingRequest = {
    cname: channel.channelId,
    uid: channel.tempHost.uid?.toString(),
    clientRequest: {
      asyncStop: false,
    },
  };

  if (!fetchedUserOrderData?.resourceId || !fetchedUserOrderData?.recordingId) {
    console.error(
      "The recordingId or resourceId was not found in the user order table."
    );
    return;
  }

  const stopRecordingResponse: StopRecordingResponse | null =
    await handleStopRecordingReq(
      stopRecordingData,
      fetchedUserOrderData?.resourceId,
      fetchedUserOrderData?.recordingId,
      "mix"
    );
  if (!stopRecordingResponse) {
    console.error("The stop recording didn't return a response");
  }
  return;
};
