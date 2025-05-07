/**
 * Event participation type definition based on Strapi schema
 * @typedef {object} EventParticipation
 * @property {string} [documentId] - The unique identifier of the event participation request
 * @property {'pending' | 'accepted' | 'declined'} participationStatus - The request status
 * @property {string} [reason] - Optional reason for the participation request
 * @property {FCEvent} event - The event being requested to join
 * @property {User} user - The user requesting to join the event
 */
