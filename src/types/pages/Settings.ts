export interface SettingsChannel {
    livestreamActive: boolean,
    chatActive: boolean,
    callActive: boolean,
}


export interface Settings {
    userId: string,
    channel: SettingsChannel,
    appLanguage: string,
    lastUpdated: number,
}