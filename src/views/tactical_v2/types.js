/**
 * Tactical Module V2 - Type Definitions
 */

/**
 * @typedef {Object} TacticalPlayer
 * @property {string} id - Unique player identifier
 * @property {string} [documentId] - Strapi document ID
 * @property {string} firstname - First name
 * @property {string} lastname - Last name
 * @property {string|null} [avatar] - Avatar URL
 * @property {number|string} [number] - Jersey number
 * @property {boolean} [isManual] - Whether manually added
 */

/**
 * @typedef {Object} FieldPlayer
 * @property {string} id - Player ID
 * @property {number} x - Position X (0-100 percentage)
 * @property {number} y - Position Y (0-100 percentage)
 */

/**
 * @typedef {Object} TacticalComposition
 * @property {string} [sportContext]
 * @property {FieldPlayer[]} placements
 */

export {};
