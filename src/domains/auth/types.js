/**
 * @typedef {object} TeamMembershipRequest
 * @property {string} [documentId]
 * @property {'pending' | 'accepted' | 'rejected' | string} [state]
 * @property {Team} [team]
 * @property {User} [user]
 */

/**
 * @typedef {object} ClubMembershipRequest
 * @property {string} [documentId]
 * @property {'pending' | 'accepted' | 'rejected' | string} [state]
 * @property {Club} [club]
 * @property {User} [user]
 */

/**
 * @typedef {object} User
 * @property {number} id
 * @property {string} [documentId]
 * @property {string} [firstname]
 * @property {string} [lastname]
 * @property {string} [firstName]
 * @property {string} [lastName]
 * @property {string} [username]
 * @property {string} phoneNumber
 * @property {string} [phone]
 * @property {string} [email]
 * @property {Role} role
 * @property {Avatar} [avatar]
 * @property {string} [birthdate]
 * @property {string} [position]
 * @property {string} [weight]
 * @property {string} [height]
 * @property {{documentId: string, name: string}} [section]
 * @property {Club} [club]
 * @property {Team} [team]
 * @property {Team[]} [myTeams]
 * @property {Team[]} [trainedTeams]
 * @property {Club[]} [clubs]
 * @property {{ club?: Club }[]} [clubAffiliations]
 * @property {TeamMembershipRequest[]} [teamMembershipRequests]
 * @property {ClubMembershipRequest[]} [clubMembershipRequests]
 * @property {boolean} [isLookingForClub]
 * @property {string} [bestLevel]
 * @property {string} [category]
 * @property {string} [preferredSport]
 * @property {string} [sportsHistory]
 * @property {string | object} [address]
 * @property {{lat?: number, lng?: number, label?: string, city?: string, radius?: number, address?: string, value?: string}} [location]
 * @property {{ documentId?: string; name?: string; logo?: Avatar }[]} [multisportClubs]
 * @property {boolean} [parentalDeclarationAccepted]
 * @property {string} [parentalDeclarationAcceptedAt]
 * @property {string} [parentalDeclarantUserDocumentId]
 * @property {string} [geohash]
 * @property {boolean} [isCaptain]
 */

/**
 * @typedef {{
 *   url?: string;
 *   id?: number | string;
 *   documentId?: string;
 *   path?: string;
 *   uri?: string;
 *   mime?: string;
 *   filename?: string;
 *   width?: number;
 *   height?: number;
 *   size?: number;
 * }} Avatar
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
