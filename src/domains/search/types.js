/**
 * @typedef {'event' | 'club' | 'reservation' | 'recruitment'} SearchEntityType
 */

/**
 * @typedef {'NAME_EXACT' | 'NAME_PREFIX' | 'TEAM_MATCH' | 'CLUB_MATCH' | 'CITY_MATCH'
 * | 'LOCATION_MATCH' | 'DESCRIPTION_MATCH' | 'ACTIVITY_MATCH' | 'GEO_NEARBY'} SearchMatchReason
 */

/**
 * @typedef {object} SearchResult
 * @property {SearchEntityType} entityType
 * @property {string} documentId
 * @property {number} score
 * @property {SearchMatchReason[]} matchReasons
 * @property {{title?: string, subtitle?: string}} highlights
 * @property {number | null} [distanceKm]
 * @property {any} payload
 */

/**
 * @typedef {object} SearchPagination
 * @property {number} page
 * @property {number} pageCount
 * @property {number} pageSize
 * @property {number} total
 */

/**
 * @typedef {object} SearchResponse
 * @property {SearchResult[]} data
 * @property {{
 *   pagination: SearchPagination,
 *   queryNormalized: string,
 *   elapsedMs: number,
 *   debug?: Record<string, any>
 * }} meta
 */

export {};
