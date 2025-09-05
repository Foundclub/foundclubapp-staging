/**
 * @typedef {object} Team
 * @property {string} [documentId] - The unique identifier for the team
 * @property {string} name - The name of the team
 * @property {User[]} [players] - The list of members in the team
 * @property {User[]} [trainers] - The list of trainers of the team
 * @property {string} [clubId] - The ID of the club the team belongs to
 * @property {Club} [club] - The name of the club the team belongs to
 * @property {Array<Activity>} [activities] - Activities of the team
 * @property {Section} [section] - The section of the team
 * @property {Category} [category] - The category of the team
 * @property {Level} [level] - The level of the team
 * @property {string} [description] - The description of the team
 */

/**
 * @typedef {object} TeamPayload
 *  @property {string} [documentId] - The unique identifier for the team
 * @property {string} name - The name of the team
 * @property {string[]} [players] - The list of members in the team
 * @property {string[]} [trainers] - The list of trainers of the team
 * @property {string} [club] - The name of the club the team belongs to
 * @property {Array<string>} [activities] - Activities of the team
 * @property {string} [section] - The section of the team
 * @property {string} [category] - The category of the team
 * @property {string} [level] - The level of the team
 * @property {string} [description] - The description of the team
 */
