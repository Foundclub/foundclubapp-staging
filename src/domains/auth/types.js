/**
 * @typedef {object} User
 * @property {number} id
 * @property {string} [documentId]
 * @property {string} [firstname]
 * @property {string} [lastname]
 * @property {string} phoneNumber
 * @property {string} [email]
 * @property {Role} role
 * @property {Avatar} [avatar]
 * @property {string} [birthdate]
 * @property {string} [position]
 * @property {string} [weight]
 * @property {string} [height]
 * @property {{documentId: string, name: string}} [section]
 * @property {Club} [club]
 * @property {Team[]} [myTeams]
 * @property {Team[]} [trainedTeams]
 * @property {Team[]} [teamMembershipRequests]
 * @property {boolean} [isLookingForClub]
 * @property {string} [bestLevel]
 * @property {string} [category]
 * @property {string} [preferredSport]
 * @property {string} [sportsHistory]
 * @property {string | object} [address]
 * @property {object[]} [multisportClubs]
 * @property {object} [geohash]
 */

/**
 * @typedef {{url: string, id?:string, path?: string, uri?: string, mime?: string, filename?: string}} Avatar
 */

/**
 * @typedef {object} Role
 * @property {number} id
 * @property {'Entraineur' | 'Authenticated' | 'Joueur' | 'Dirigeant' | 'SuperAdmin'} name
 * @property {string} type
 * @property {string} documentId
 */

/**
 * @typedef {object} remoteMessageData
 * @property {string} type
 * @property {string} [teamId]
 * @property {string} [clubId]
 * @property {string} [eventId]
 * @property {string} [conversationId]
 */
