export interface PlaceOfBirth {
    displayValue: string, 
    geoLocation: {
        lat: number,
        long: number,
    }
}

export interface KundliProfile {
    userId: string,
    createTs: number,
    name: string,
    dateTimeOfBirth :  number,
    gender : string,
    placeOfBirth : PlaceOfBirth
}

export type UpdateKundliDataType = 'name' | 'dateTimeOfBirth' | 'gender' | 'placeOfBirth';
export type UpdateKundliDataPayloadType = string | number | PlaceOfBirth;
