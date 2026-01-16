const Statuses: readonly string[] = Object.freeze(['REQUESTED', 'ACCEPTED', 'REJECTED', 'TERMINATED_BY_CLIENT', 'TERMINATED_BY_ASTROLOGER', 'TERMINATED_BY_SYSTEM']);

type  ValidStatusTransitions = {
    [key: string]: string[];
}

const ValidStatusTransitions: ValidStatusTransitions = Object.freeze({
    'REQUESTED': ['ACCEPTED', 'REJECTED'],
    'ACCEPTED': ['TERMINATED_BY_CLIENT', 'TERMINATED_BY_ASTROLOGER', 'TERMINATED_BY_SYSTEM']
});

export { Statuses, ValidStatusTransitions };