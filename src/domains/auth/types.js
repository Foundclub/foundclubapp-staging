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
 */

/**
 * @typedef {{url: string, id?:string} & import("react-native-image-crop-picker").Image} Avatar
 */

/**
 * @typedef {object} Role
 * @property {'Entraineur' | 'Authenticated' | 'Joueur' | 'Dirigeant'} name
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
