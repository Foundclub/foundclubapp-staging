/**
 * Level type definition based on Strapi schema
 * @typedef {object} Level
 * @property {number} id
 * @property {string} documentId - The unique identifier of the level
 * @property {string} name - The name of the level
 * @property {number | null} [rank] - Son rang (NIVEAUX-PAR-SPORT) : classe = passe d'abord
 * @property {{ documentId: string, name?: string }[]} [activities] - Sports relies ; aucun = tous
 */
