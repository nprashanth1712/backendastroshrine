import {
  AcquireResourceIdRequest,
  AcquireResourceIdResponse,
  ActiveRecordingResponse,
  StartRecordingRequest,
  StartRecordingResponse,
  StopRecordingRequest,
  StopRecordingResponse,
} from "../../types/recordings/Recording";

const APP_ID = process.env.AGORA_APP_ID;
const baseURL = `https://api.agora.io/`;
const cloudRecordingURL = `v1/apps/${APP_ID}/cloud_recording`;
const headerConfig = new Headers({
  Authorization:
    "Basic " +
    btoa("294c0bd192a0499f80caaf1a616aeb81:fa891796573d4f42ab5bc89a864117f5"),
  "Content-Type": "application/json",
});

export async function handleAcquireResourceIdReq(
  acquireReq: AcquireResourceIdRequest
): Promise<AcquireResourceIdResponse | null> {
  const url = `${baseURL}${cloudRecordingURL}/acquire`;
  const reqBody = JSON.stringify(acquireReq);
  console.log("raka ", reqBody);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: headerConfig,
      body: reqBody,
    });
    console.log("AcquireResourceId Response: ", response);
    return await response.json();
  } catch (error) {
    console.error("AcquireResourceIdError: ", error);
    return null;
  }
}

export async function handleStartRecordingReq(
  startReq: StartRecordingRequest,
  resourceId: string,
  modeType: string
): Promise<StartRecordingResponse | undefined> {
  const url = `${baseURL}${cloudRecordingURL}/resourceid/${resourceId}/mode/${modeType}/start`;
  let responseData: StartRecordingResponse | undefined;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: headerConfig,
      body: JSON.stringify(startReq),
    });
    responseData = await response.json();
    console.log("StartRecording Response: ", response);
  } catch (error) {
    console.error("StartRecordingError: ", error);
  }
  return responseData;
}

export async function handleGetRecordingStatusReq(
  resourceId: string,
  recordingId: string,
  mode: string
): Promise<ActiveRecordingResponse | null> {
  const url = `${baseURL}${cloudRecordingURL}/resourceid/${resourceId}/sid/${recordingId}/mode/${mode}/query`;
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: headerConfig,
    });
    console.log("GetRecordingStatus Response: ");
    return await response.json();
  } catch (error) {
    console.log("GetRecordingStatusError: ", error);
    return null;
  }
}

export async function handleStopRecordingReq(
  stopReq: StopRecordingRequest,
  resourceId: string,
  recordingId: string,
  modeType: string
): Promise<StopRecordingResponse | null> {
  const url = `${baseURL}${cloudRecordingURL}/resourceid/${resourceId}/sid/${recordingId}/mode/${modeType}/stop`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: headerConfig,
      body: JSON.stringify(stopReq),
    });

    console.log("StopRecording Response: ", response);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("StopRecordingError: ", error);
    return null;
  }
}
