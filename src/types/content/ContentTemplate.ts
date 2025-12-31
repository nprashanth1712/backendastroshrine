export interface ContentTemplateInput {
    id: string, 
    templateData: {
        name: string, 
        channelType: string, 
        s3Url: string, 
        format: string,
        createTs: number,
        samples: number
    }
}