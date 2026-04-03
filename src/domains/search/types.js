/**
 * @typedef {'event' | 'club' | 'profile' | 'reservation' | 'recruitment'} SearchEntityType
 */

/**
 * @typedef {'NAME_EXACT' | 'NAME_PREFIX' | 'TEAM_MATCH' | 'CLUB_MATCH' | 'CITY_MATCH'
 * | 'LOCATION_MATCH' | 'LOCATION_FUZZY' | 'DESCRIPTION_MATCH' | 'ACTIVITY_MATCH'
 * | 'GEO_NEARBY' | 'NAME_FUZZY'} SearchMatchReason
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
 *   debug?: Record<string, any>,
 *   maxRenderableResults?: number,
 *   queryBounds?: { north: number, south: number, east: number, west: number },
 *   queryMode?: 'map' | 'list',
 *   totalInBounds?: number,
 *   truncated?: boolean
 * }} meta
 */

export {};
