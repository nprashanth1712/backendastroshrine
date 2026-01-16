export interface SupportCase {
    id: string,
    userId: string,
    supportUserId: string,
    createTs: number,
    status: "OPEN" | "CLOSED",
    caseType: string,
    details?: string,
    hidden: boolean,
    commentResolution?: string,
}