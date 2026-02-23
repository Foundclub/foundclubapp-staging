/**
 * @typedef {object} TeamAddress
 * @property {number} [lat]
 * @property {number} [lng]
 * @property {string} [label]
 * @property {string} [city]
 * @property {number} [radius]
 * @property {string} [address]
 * @property {string} [value]
 * @property {{label?: string}} [properties]
 */

/**
 * @typedef {object} ExternalStandingRow
 * @property {number | string} [rank]
 * @property {string} [teamId]
 * @property {string} [teamName]
 * @property {number | string} [points]
 * @property {number | string} [played]
 * @property {number | string} [goalFor]
 * @property {number | string} [goalAgainst]
 * @property {number | string} [goalDiff]
 */

/**
 * @typedef {object} ExternalCalendarMatch
 * @property {number | string} [round]
 * @property {boolean} [played]
 * @property {string} [date]
 * @property {string} [homeTeamId]
 * @property {string} [homeTeam]
 * @property {string} [awayTeamId]
 * @property {string} [awayTeam]
 * @property {number | string} [homeScore]
 * @property {number | string} [awayScore]
 */

/**
 * @typedef {object} Team
 * @property {string} [documentId] - The unique identifier for the team
 * @property {number | string} [id] - Numeric fallback identifier
 * @property {string} name - The name of the team
 * @property {string} [initials] - Optional initials
 * @property {User[]} [players] - The list of members in the team
 * @property {User[]} [trainers] - The list of trainers of the team
 * @property {User[]} [roster] - League roster
 * @property {User[]} [members] - Team members
 * @property {string} [clubId] - The ID of the club the team belongs to
 * @property {Club} [club] - The name of the club the team belongs to
 * @property {Array<Activity>} [activities] - Activities of the team
 * @property {Section} [section] - The section of the team
 * @property {Category} [category] - The category of the team
 * @property {Level} [level] - The level of the team
 * @property {string} [description] - The description of the team
 * @property {string} [sport] - Team sport for league flows
 * @property {number} [division] - League division
 * @property {number} [elo] - League elo rating
 * @property {number} [wins] - League wins
 * @property {number} [draws] - League draws
 * @property {number} [losses] - League losses
 * @property {number} [streak] - Current streak
 * @property {number} [radius] - Search radius preference
 * @property {boolean} [isLeague]
 * @property {string} [city] - Team city
 * @property {TeamAddress} [address]
 * @property {string | object} [home_base] - League home base payload
 * @property {string | object} [geohash] - Geohash payload
 * @property {string} [state] - Business state
 * @property {LeagueSlot[]} [slots] - Team recurring slots
 * @property {ExternalStandingRow[]} [externalStandingData] - Parsed standings
 * @property {ExternalCalendarMatch[]} [externalCalendarData] - Parsed calendar
 * @property {'fff' | 'ffbb'} [externalProvider] - External competition provider
 * @property {'not_configured' | 'configured' | 'syncing' | 'synced' | 'error'} [externalSyncStatus]
 * @property {string} [externalSyncError]
 * @property {string} [externalSyncUpdatedAt]
 * @property {string} [externalDataLastUpdate]
 * @property {string} [externalTeamId]
 * @property {string} [externalTeamName] - Team alias used in external sources
 * @property {Avatar} [crest] - League crest
 * @property {Avatar} [logo] - Team logo
 * @property {User} [captain] - Team captain
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
