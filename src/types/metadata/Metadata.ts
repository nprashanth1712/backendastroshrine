export type MetaDataType = "gift" | "advertisement" | "avatar";

export interface GiftMetaDataContent {
    createTs: number;
    imageUrl: string;
    amount: number;
    name: string;
}

export interface AvatarMetaDataContent {
    createTs: number;
    imageUrl: string;
    name: string;
}

export interface AdvertisementMetaDataContent {
    createTs: number;
    imageUrl: string;
    deepLink: string;
    title: string;
    subtitle?: string;
}

export interface MetaData {
    id: string;
    name: string;
    metadataType: MetaDataType;
    content:
        | GiftMetaDataContent
        | AdvertisementMetaDataContent
        | AvatarMetaDataContent;
    status: "ACTIVE" | "INACTIVE";
    createTs: number;
}
