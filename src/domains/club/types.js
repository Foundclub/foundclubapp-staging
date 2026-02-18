/**
 * Club type definition based on Strapi schema
 * @typedef {object} Club
 * @property {number} [id] - The unique identifier of the club
 * @property {string} [documentId] - The unique identifier of the club
 * @property {string} name - The name of the club (required, unique)
 * @property {{lat?: number, lng?: number, label?: string, properties?: {label?: string}}} [address] - The location of the club (required)
 * @property {string} [addressDetails] - The full address of the club (optional)
 * @property {Array<Activity>} [activites] - Activities associated with the club
 * @property {boolean} isCustomer - Indicates if the club is a customer (default: false, required)
 * @property {string} [phoneNumber] - The club's phone number (optional)
 * @property {string} [city] - The city where the club is located (optional)
 * @property {string} [email] - The club's email address (optional)
 * @property {'club' | 'multisport'} [_type] - Optional UI helper discriminator.
 * @property {number} [sectionsCount] - Optional number of sections for multisport cards.
 * @property {{ documentId?: string; name?: string; logo?: Avatar }[]} [sections] - Optional multisport sections.
 * @property {Array<Sponsor>} [sponsor] - Sponsors associated with the club (repeatable component)
 * @property {number} maxTeamNumber - Maximum number of teams allowed (required, default: 0)
 * @property {string} [geohash] - Geohash representation of the club's location (optional)
 * @property {User[]} [members] - Users associated with the club (optional)
 * @property {Team[]} [teams] - Teams associated with the club (optional)
 * @property {Avatar} [logo] - Club logo
 * @property {{ documentId?: string; name?: string }} [parentMultisport] - Parent multisport club reference
 */

/**
 * @typedef {object} Sponsor
 * @property {number | string} [id] - Sponsor internal id when present.
 * @property {string} [documentId] - Sponsor document id.
 * @property {string} title - The title of the sponsor (required)
 * @property {string} [link] - The link to the sponsor's website
 * @property {Avatar} [logo]
 */
