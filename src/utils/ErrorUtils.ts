const missingParameter = (field: string): string => {
    return `Invalid requests. Missing required field(s): ${field}`;
};

const invalidParameter = (fieldValue: string): string => {
    return `Invalid requests. Invalid value passed. ${fieldValue}`;
};

const invalidOperation = (message: string): string => {
    return `Invalid operation. ${message}`;
};

const unknownError = (message: string) => {
    return `Internal Server Error. ${message}`
}

export { missingParameter, invalidParameter, invalidOperation, unknownError };
