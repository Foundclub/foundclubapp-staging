/**
 * @typedef {'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'} LeagueDay
 */

/**
 * @typedef {'provisionary' | 'negotiating' | 'scheduled' | 'pending_validation' | 'disputed' | 'valid' | 'cancelled' | 'forfeit' | 'no_show'} LeagueMatchStatus
 */

/**
 * @typedef {'waiting_proposal' | 'waiting_venue' | 'confirmed_upcoming' | 'post_slot_resolution' | 'waiting_score' | 'pending_validation' | 'disputed' | 'valid' | 'cancelled' | 'forfeit' | 'no_show' | 'unknown'} LeagueMatchPhase
 */

/**
 * @typedef {object} LeagueSlot
 * @property {number | string} [id]
 * @property {string} [documentId]
 * @property {LeagueDay} [day]
 * @property {string} [startHour]
 * @property {string} [endHour]
 * @property {string} [start_hour]
 * @property {string} [end_hour]
 * @property {LeagueDay} [recurrence_day]
 * @property {string} [start_time]
 * @property {string} [date]
 * @property {number} [rsvp_count]
 * @property {User[]} [participants]
 */

/**
 * @typedef {object} LeagueMatchLocation
 * @property {string} [address]
 * @property {string} [city]
 * @property {string} [label]
 * @property {string} [proposed_end_time]
 * @property {boolean} [venueBooked]
 */

/**
 * @typedef {object} OpponentDetails
 * @property {string} [documentId]
 * @property {string} [name]
 * @property {{label?: string, name?: string} | string} [sport]
 * @property {{label?: string, name?: string} | string} [category]
 * @property {string | object} [home_base]
 * @property {string | object} [location]
 * @property {string} [city]
 * @property {number} [radius]
 * @property {number} [division]
 * @property {number} [division_points]
 * @property {number} [divisionPoints]
 * @property {number} [elo]
 * @property {number} [season_points]
 * @property {number} [seasonPoints]
 * @property {LeagueDay} [recurring_day]
 * @property {string} [recurring_start_hour]
 * @property {string} [recurring_end_hour]
 */

/**
 * @typedef {object} LeagueMatch
 * @property {number | string} [id]
 * @property {string} [documentId]
 * @property {LeagueMatchStatus} [status]
 * @property {LeagueMatchPhase} [phase]
 * @property {string} [date]
 * @property {string} [venue]
 * @property {string} [proposed_venue]
 * @property {string} [proposed_time]
 * @property {string} [address]
 * @property {LeagueMatchLocation} [location]
 * @property {LeagueSlot[]} [common_slots]
 * @property {LeagueDay} [recurring_day]
 * @property {string} [recurring_start_hour]
 * @property {string} [recurring_end_hour]
 * @property {Team} [team_a]
 * @property {Team} [team_b]
 * @property {Chat} [chat]
 * @property {number} [score_a]
 * @property {number} [score_b]
 * @property {{score_a?: number | string, score_b?: number | string}} [submitted_score_team_a]
 * @property {{score_a?: number | string, score_b?: number | string}} [submitted_score_team_b]
 * @property {User[]} [participations_a]
 * @property {User[]} [participations_b]
 * @property {'win' | 'loss' | 'draw' | 'pending'} [result]
 * @property {Team} [winner]
 * @property {boolean} [venueBooked]
 * @property {boolean} [venue_booked]
 * @property {object} [event]
 * @property {number} [rsvp_count]
 * @property {Record<string, number>} [player_goals]
 * @property {Record<string, any>} [automation_meta]
 * @property {Record<string, any>} [workflow]
 * @property {string | null} [proposalMessageId]
 * @property {string | null} [latestProposalMessageId]
 * @property {{messageId?: string | null, [key: string]: any}} [currentProposal]
 * @property {string | null} [actionState]
 * @property {string | null} [actionType]
 * @property {string} [createdAt]
 */

/**
 * @typedef {object} MatchRequest
 * @property {number | string} [id]
 * @property {string} [documentId]
 * @property {string} [createdAt]
 * @property {string | object} [location]
 * @property {number} [radius]
 * @property {string} [state]
 * @property {Record<string, any> | null} [softSuggestion]
 * @property {string | null} [serverNow]
 */

/**
 * @typedef {object} MatchmakingStatus
 * @property {'idle' | 'searching' | 'matched'} [state]
 * @property {'idle' | 'searching' | 'matched'} [status]
 * @property {MatchRequest | null} [request]
 * @property {LeagueMatch | null} [match]
 * @property {OpponentDetails | null} [opponentDetails]
 * @property {OpponentDetails | null} [opponent]
 * @property {object | null} [searchInsights]
 * @property {Record<string, any> | null} [softSuggestion]
 * @property {string | null} [serverNow]
 * @property {string | null} [legacyState]
 */

/**
 * @typedef {object} MatchHistoryEntry
 * @property {string} [id]
 * @property {string} [date]
 * @property {number} [score_a]
 * @property {number} [score_b]
 * @property {Team} [opponent]
 * @property {'win' | 'loss' | 'draw' | 'pending'} [result]
 * @property {LeagueMatchStatus} [status]
 * @property {number} [eloChange]
 */
