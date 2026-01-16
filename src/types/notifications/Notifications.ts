
export interface Device {
    userId: string,
    role: string,
    deviceId: string, 
}

export type DeviceList = Array<Device>;
export interface NotificationViewData {
    title: string,
    subtitle: string,
    body: string,
    pictureUrl: string,
}

export type NotificationData = any;