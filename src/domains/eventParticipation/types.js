/**
 * Event participation type definition based on Strapi schema
 * @typedef {object} EventParticipation
 * @property {string} [documentId] - The unique identifier of the event participation request
 * @property {'pending' | 'accepted' | 'declined'} participationStatus - The request status
 * @property {string} [reason] - Optional reason for the participation request
 * @property {string} [position] - Optional position snapshot
 * @property {{documentId?: string, position?: string, quantity?: number} | null} [recruitmentAd] - Linked recruitment slot
 * @property {{displayName?: string, firstname?: string, lastname?: string, phoneNumber?: string, avatar?: any} | null} [requester] - Enriched requester identity
 * @property {FCEvent} event - The event being requested to join
 * @property {User} user - The user requesting to join the event
 */
