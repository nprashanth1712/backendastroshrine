export type AcquireResourceIdRequest = {
  cname: string;
  uid: string;
  clientRequest?: AquireClientRequest;
};
export type AquireClientRequest = {
  scene: number;
  resourceExpiredHour: number;
  startParamater?: ClientRequest;
  excludeResourceIds?: string[];
};
export type AcquireResourceIdResponse = {
  cname: string;
  uid: string;
  resourceId: string;
};

export type StartRecordingRequest = {
  cname: string;
  uid: string;
  clientRequest?: ClientRequest;
};
export type StartRecordingResponse = {
  cname: string;
  uid: string;
  resourceId: string;
  sid: string;
  timeStamp?: string;
};

export type ActiveRecordingResponse = {
  resourceId?: string;
  sid?: string;
  serverResponse?: ServerResponse;
  cname?: string;
  uid?: string;
  timeStamp?: string;
};

export type ServerResponse = {
  extensionServiceState?: ExtensionServiceState;
  uploadingStatusResponse?: string;
  fileListMode?: string;
  fileList?: any;
  status?: number;
};
export type ExtensionServiceState = {
  payLoadStop?: PayLoadStop;
  serviceName?: string;
};
export type PayLoadStop = {
  uploadingStatus?: string;
  fileList?: any[];
  onHold?: boolean;
  state?: string;
};

export type StopRecordingRequest = {
  cname: string;
  uid: string;
  clientRequest: StopClientRequest;
};

export type StopClientRequest = {
  asyncStop: boolean;
};

export type StopRecordingResponse = {
  resourceId: "string";
  sid: "string";
  serverResponse: ServerResponse;
  cname: "string";
  uid: "string";
};

export type ClientRequest = {
  token: string;
  recordingConfig: RecordingConfig;
  storageConfig: StorageConfig;
  recordingFileConfig?: RecordingFileConfig;
  snapshotConfig?: SnapshotConfig;
  extensionServiceConfig?: ExtensionServiceConfig;
  appsCollection?: AppsCollection;
  transcodeOptions?: TranscodeOptions;
};

export type StorageConfig = {
  vendor: number;
  region: number;
  bucket: string;
  accessKey: string;
  secretKey: string;
  fileNamePrefix?: string[];
  // extensionParams?: ExtensionParams;
};

type RecordingConfig = {
  channelType: number;
  decryptionMode?: number;
  secret?: string;
  salt?: string;
  maxIdleTime?: number;
  streamTypes?: number;
  videoStreamType?: number;
  subscribeAudioUids?: string[];
  unsubscribeAudioUids?: string[];
  subscribeVideoUids?: string[];
  unsubscribeVideoUids?: string[];
  subscribeUidGroup?: number;
  streamMode?: string;
  audioProfile?: number;
  transcodingConfig?: TranscodingConfig;
};

export type RecordingFileConfig = {
  AVFileType: string[];
};
export type SnapshotConfig = {
  captureInterval: number;
  fileType: string[];
};
export type ExtensionServiceConfig = {
  errorHandlePolicy: string;
  extensionService: any;
};
export type AppsCollection = {
  combinationPolicy?: string;
};
export type TranscodeOptions = any;

type TranscodingConfig = {
  width?: number;
  height?: number;
  fps?: number;
  bitrate?: number;
  maxResolutionUid?: string;
  mixedVideoLayout?: number;
  backgroundColor?: string;
  backgroundImage?: string;
  defaultUserBackgroundImage?: string;
  //   layoutConfig?: LayoutConfig[];
  //   backgroundConfig?: BackgroundConfig[];
};
