/**
 * @typedef {object} FCEventForm
 * @property {number} [capacity] - Maximum number of participants
 * @property {string} [date] - date string for the event
 * @property {string} [time] - time string for the event
 * @property {string} [description] - Optional event description
 * @property {string} [documentId] - Event unique identifier
 * @property {{
 * value?: string, label?: string, lat?: number, lng?: number
 * }} [location] - Event location
 * @property {'open' | 'closed' | 'cancelled'} [sessionStatus] - Current status of the event
 * @property {string} [team] - Associated team
 * @property {string} [type] - Event type
 * @property {'auto' | 'manual'} [validationMode] - How participation requests are validated
 * @property {boolean} [isRecurrent]
 * @property {string} [recurrenceDay]
 * @property {string} [recurrenceEndDate]
 * @property {string} [recurrenceFrequency]
 * @property {string} [recurrenceStartDate]
 * @property {'future' | 'all'} [recurrenceMode] - Recurrence update mode
 * @property {boolean} [isFeatured] - Is featured event
 * @property {'none' | 'pending' | 'approved' | 'rejected'} [featuredRequestStatus] - Featured request status
 * @property {{documentId?: string, name?: string, planningColor?: string, color?: string}} [facility] - Event facility
 * @property {string[]} [myTeams] - User's teams filter
 * @property {string[]} [teamIds] - Team IDs filter
 * @property {any} [composition] - Tactical composition payload
 * @property {Array<{position: string, quantity: number}>} [detectionSlots] - Optional detection slots
 */

/**
 * @typedef {object} FCEventType
 * @property {string} documentId - Type unique identifier
 * @property {string} name - Type display name
 */

/**
 * @typedef {object} FCEvent
 * @property {number} capacity - Maximum number of participants
 * @property {string} [date] - ISO date string for the event
 * @property {string} [description] - Optional event description
 * @property {string} [documentId] - Event unique identifier
 * @property {{ lat: number, lng: number, label: string }} [location] - Event location
 * @property {string} [locationDetails] - Event location full address
 * @property {'open' | 'closed' | 'cancelled'} sessionStatus - Current status of the event
 * @property {Team} [team] - Associated team
 * @property {FCEventType} [type] - Event type
 * @property {'auto' | 'manual'} validationMode - How participation requests are validated
 * @property {User[]} participations - List of participants
 * @property {User[]} missings - List of participants who said no
 * @property {string} [recurrenceGroupId] - Recurrence group ID for recurring events
 * @property {any} [composition] - Tactical composition data
 * @property {boolean} [isFeatured] - Is featured event
 * @property {'none' | 'pending' | 'approved' | 'rejected'} [featuredRequestStatus] - Featured request status
 * @property {string} [startTime] - Event start time
 * @property {string} [endTime] - Event end time
 * @property {{ documentId?: string; name?: string; maxSlots?: number; planningColor?: string; color?: string }} [facility] - Selected facility
 * @property {Team[]} [invitedTeams] - Invited opponent teams
 * @property {any[]} [recruitmentAds] - Recruitment ads linked to this event
 * @property {any} [reservation] - Reservation object if applicable
 */

/**
 * @typedef {object} EventLocation
 * @property {number} lat
 * @property {number} lng
 * @property {string} label
 */

export {};
