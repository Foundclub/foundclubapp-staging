/**
 * Club type definition based on Strapi schema
 * @typedef {object} Club
 * @property {number} [id] - The unique identifier of the club
 * @property {string} [documentId] - The unique identifier of the club
 * @property {string} name - The name of the club (required, unique)
 * @property {{lat: number, lng: number}} [address] - The location of the club (required)
 * @property {Array<Activity>} [activites] - Activities associated with the club
 * @property {boolean} isCustomer - Indicates if the club is a customer (default: false, required)
 * @property {string} [phoneNumber] - The club's phone number (optional)
 * @property {string} [city] - The city where the club is located (optional)
 * @property {string} [email] - The club's email address (optional)
 * @property {Array<Sponsor>} [sponsor] - Sponsors associated with the club (repeatable component)
 * @property {number} maxTeamNumber - Maximum number of teams allowed (required, default: 0)
 * @property {string} [geohash] - Geohash representation of the club's location (optional)
 * @property {User[]} [members] - Users associated with the club (optional)
 * @property {string[]} [teams] - Users associated with the club (optional)
 */

/**
 * @typedef {object} Sponsor
 * @property {string} title - The title of the sponsor (required)
 * @property {string} [link] - The link to the sponsor's website
 * @property {Avatar} [logo]
 */
