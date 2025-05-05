/**
 * @typedef {object} FCEvent
 * @property {number} capacity - Maximum number of participants
 * @property {Club} [club] - Associated club
 * @property {string} [date] - ISO date string for the event
 * @property {string} [description] - Optional event description
 * @property {string} [documentId] - Event unique identifier
 * @property {{ lat: number, lng: number, label: string }} [location] - Event location
 * @property {'open' | 'closed' | 'cancelled'} sessionStatus - Current status of the event
 * @property {string} [team] - Associated team
 * @property {string} [type] - Event type
 * @property {'auto' | 'manual'} validationMode - How participation requests are validated
 */

/**
 * @typedef {object} FCEventType
 * @property {string} documentId - Type unique identifier
 * @property {string} name - Type display name
 */
