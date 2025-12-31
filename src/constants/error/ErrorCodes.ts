type ErrorCodes = {
  [key: string]: {
    [key: string]: string | ((errorObj: any) => string);
  };
};

type ErrorCodeKeys = {
  [key: string]: Array<string>;
};
type ErrorObj = {
  userId: string;
  resourceId?: string;
  recordingId?: string;
};

const ErrorCodes: ErrorCodes = Object.freeze({
  "400": {
    INVALID_PARAM: "Invalid Param passed!",
    INVALID_OPERATION: "INVALID_OPERATION",
    ConditionalCheckFailedException:
      "Unable to send message: Similar message exists.",
    UnableToParseChannelStatuses: "Cannot parse channel's status",
    UserIsNotInChannel: "User is not joined in any of the channels currently.",
    UserIsBusy: "The user is already busy in another channel",
    UnableToJoinChannel:
      "The deviceId is already assigned, please join with the same device to continue the session.",
    ErrorInB64Conversion: "Error in base64 conversion",
    InvalidValueType: "Invalid value type",
    OpenCaseExists: "User already has an open case."
  },
  "401": {
    MessageTooLarge: "The message is too large",
    NotEnoughBalance: "User Does not have enough balance! Please recharge.",
  },
  "403": {
    TempHostNotExist: "The temphost does not exist in the channel",
  },
  "404": {
    NotificationNotFound: "The Notification was not found in the data!",
    MessageNotFound: "The specified message was not found!",
    UserNotFound: "User not found!",
    AstrologerNotFound: "Astrologer not found!",
    ChannelNotOnline: "The specified channel is currently not online",
    ChannelNotFound: "The specified channel is not active",
    UserOffline: "The user is currently offline",
  },
  "423": {
    ChannelRestricted: "The channel is currently offline",
    ServiceCurrentlyLocked: "Service currently locked",
    UserAlreadyExist: "The user already exists in the waitlist",
  },
  "424": {
    UserLowOnBalance: "Your balance is too low to join the channel",
  },
  "500": {
    FailedToAcquireResourceID: (errorObj: ErrorObj) =>
      `Failed to get resource id for userId: ${errorObj.userId}`,
    FailedToStartRecording: (errorObj: ErrorObj) =>
      `Failed to start recording for userId: ${errorObj.userId}, resourceId: ${errorObj.resourceId}`,
    FailedToStopRecording: (errorObj: ErrorObj) =>
      `Failed to stop recording for userId: ${errorObj.userId}, resourceId: ${errorObj.resourceId}, recordingId: ${errorObj.recordingId}`,
  },
});

const ErrorCodeKeys: ErrorCodeKeys = Object.keys(ErrorCodes).reduce(
  (obj: ErrorCodeKeys, k: string) => {
    obj[k] = Object.keys(ErrorCodes[k]);
    return obj;
  },
  {}
);

export { ErrorCodes, ErrorCodeKeys };
