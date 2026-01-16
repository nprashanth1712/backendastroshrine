import { Waitlist } from "../livestream/models/Livestream";
import { Review } from "../reviews/Reviews";



export type PricingData = {
    livestream: {
        rate: number, offer: number
    },
    chat: {
        rate: number, offer: number
    },
    call: {
        rate: number, offer: number
    }
}

export type AstrologerCurrentChannel = {
    livestream: {
        enabled: boolean,
        approxTime?: number
    },
    chat: {
        enabled: boolean,
        approxTime?: number
    },
    call: {
        enabled: boolean,
        approxTime?: number
    } 
}

export type ChannelTimeSpent = {
    chat: number,
    livestream: number, 
    call: number;
};

export interface UserWaitlist {
        chat: Array<Waitlist>,
        call: Array<Waitlist>,
        livestream: Array<Waitlist>
    
}

// export type AstrologerViewCache = {
//     id: string,
//     name: string, 
//     experience: number,
//     expertise: Array<string>,
//     languages: Array<string>,
// }



export type AstrologerViewCache = {
    id: string,
    name: string, 
    pricingData: PricingData,
    dataHash?: string;
    ranking: number,
    currentChannel?: AstrologerCurrentChannel,
    hostProfile: {
        channelTimeSpent: ChannelTimeSpent,
        experience: number,
        gender: string,
        orders: number,
        followers?: number,
        aboutMe? : string,
        expertise: Array<string>,
        topReviews?: Array<Review>,
        media?: Array<Media>,
        languages: Array<string>,
    }
}

export type AstrologerGetByAvailable = {
    id: string,
    available: number,
    currentChannel: AstrologerCurrentChannel,
    ranking: number,
}

export interface AstrologerCurrentOffer {   
    id: string,
    expiryTs: number,
}
export type Astrologer = {
    id: string,
    name: string,
    phoneNumber: string,
    available: number, 
    pricingData: PricingData,
    lastOnlineTs: number, 
    waitlist: UserWaitlist,
    currentOffer: AstrologerCurrentOffer,
    currentChannel: AstrologerCurrentChannel,
    hostProfile: HostProfile,
    dataHash?: string,
    ranking: number
};


export type Media = {
    path: string
}

export interface HostProfileSearchView {
    profilePic: string
    languages: Array<string>,
    channelTimeSpent: ChannelTimeSpent,
    experience: number, 
    orders: number,
    expertise: Array<string>,
}

export interface HostProfile {
    aboutMe: string, 
    profilePic: string
    followers: number,
    languages: Array<string>,
    channelTimeSpent: ChannelTimeSpent,
    experience: number,
    topReviews?: Array<Review>,
    media: Array<Media>,
    gender: string,
    earnings: number, 
    orders: number,
    expertise: Array<string>,
}
