/**
 * Tactical Module V2 - Type Definitions
 */

/**
 * @typedef {object} TacticalPlayer
 * @property {string} [id] - Unique player identifier
 * @property {string} [documentId] - Strapi document ID
 * @property {string} [firstname] - First name
 * @property {string} [lastname] - Last name
 * @property {string|{url?: string; formats?: { thumbnail?: { url?: string } }}|null} [avatar] - Avatar data
 * @property {number|string} [number] - Jersey number
 * @property {boolean} [isManual] - Whether manually added
 * @property {string|null} [appliedPosition] - Poste postulé (détection)
 * @property {string} [position] - Poste de profil du joueur
 */

/**
 * @typedef {object} FieldPlayer
 * @property {string} [id] - Player ID
 * @property {string} [documentId] - Strapi document ID
 * @property {string} [firstname] - First name
 * @property {string} [lastname] - Last name
 * @property {string|{url?: string; formats?: { thumbnail?: { url?: string } }}|null} [avatar] - Avatar data
 * @property {number|string} [number] - Jersey number
 * @property {boolean} [isManual] - Whether manually added
 * @property {number} x - Position X (0-100 percentage)
 * @property {number} y - Position Y (0-100 percentage)
 */

/**
 * @typedef {object} TacticalComposition
 * @property {string} [sportContext]
 * @property {FieldPlayer[]} placements
 */

export {};
