/**
 * @typedef Store The global store.
 * @property {Auth} [auth] The authentication state.
 * @property {string} [fcmToken] - The Firebase Cloud Messaging token.
 * @property {string} [theme] - The current theme.
 * @property {{ totalViews: number, views: { route: string; index: number; }[] }} [onboardingViews]
 * @property {ClubFilters} [clubFilters] - The filters for the club.
 * @property {TeamFilters} [teamFilters] - The filters for teams.
 * @property {MercatoFilters} [mercatoFilters] - Recruitment marketplace filters.
 * @property {ReservationFilters} [reservationFilters] - Reservation filters.
 * @property {SquadFilters} [squadFilters] - League squad filters.
 * @property {EventFilters} [eventFilters] - The filters for events.
 * @property {AuthSession[]} [authSessions] - Stored sessions for account switch.
 * @property {boolean} [isAddingAccount] - Indicates add-account flow state.
 * @property {{ type?: string } | null} [pendingNotification] - Notification waiting for navigation readiness.
 */

/**
 * @typedef Auth
 * @property {string} idToken The firebase token.
 * @property {import('@react-native-firebase/auth')
 * .FirebaseAuthTypes.User} idUser user from firebase
 * @property {string} token The access token.
 */

/**
 * @typedef {'SET_AUTHENTICATION' | 'DELETE_AUTHENTICATION'
 * | 'SET_FCM_TOKEN' | 'SET_THEME' | 'SET_ONBOARDING_VIEWS'
 * | 'SET_CLUB_FILTERS' | 'SET_TEAM_FILTERS' | 'SET_MERCATO_FILTERS' | 'SET_RESERVATION_FILTERS'
 * | 'SET_EVENT_FILTERS' | 'SET_SQUAD_FILTERS' | 'SWITCH_ACCOUNT'
 * | 'PREPARE_ADD_ACCOUNT' | 'CANCEL_ADD_ACCOUNT' | 'UPDATE_USER_DATA' | 'SET_PENDING_NOTIFICATION'} AppContextTypes
 */

/**
 * @typedef {object} Action
 * @property {AppContextTypes} type The type of action to be performed.
 * @property {any} [payload] The data to be used in the action.
 */

/**
 * @callback AppReducer
 * @param {Store} state The current application state.
 * @param {Action} action The action to be performed.
 * @returns {Store} The new application state.
 */

/**
 * @callback AppContextDispatch
 * @param {Action} action The action to be performed.
 * @returns {void}
 */

/**
 * @typedef {object} ClubFilters
 * @property {string} name
 * @property {string} geohash
 * @property {string} activity
 * @property {{label: string, value: string}} city
 * @property {number} radius
 */

/**
 * @typedef {object} TeamFilters
 * @property {string} [name]
 * @property {string} [activities]
 * @property {string} [section]
 * @property {string[]} [category]
 * @property {string[]} [level]
 */

/**
 * @typedef {object} MercatoFilters
 * @property {string} [q]
 * @property {string | string[]} [activity]
 * @property {string[]} [activityIds]
 * @property {string[]} [activityNames]
 * @property {string | string[]} [position]
 * @property {string[]} [positions]
 * @property {string} [bestLevel]
 * @property {string | string[]} [category]
 * @property {string[]} [sectionIds]
 * @property {string} [preferredSport]
 * @property {{label: string, value: string | number | null}} [city]
 * @property {number | string} [radius]
 * @property {string} [geohash]
 * @property {boolean} [isActive]
 * @property {string} [type]
 * @property {string} [label]
 * @property {string} [alertDocumentId]
 */

/**
 * @typedef {object} ReservationFilters
 * @property {string} [q]
 * @property {string | string[]} [activity]
 * @property {{label: string, value: string | number | null}} [city]
 * @property {number | string} [radius]
 * @property {number | string} [maxPrice]
 * @property {string | null} [startTime]
 * @property {string} [startDateAfter]
 * @property {string} [activitySlug]
 */

/**
 * @typedef {object} SquadFilters
 * @property {{label?: string, value?: string} | null} [city]
 * @property {number | string | null} [radius]
 * @property {{label?: string, value?: string} | null} [sport]
 * @property {{label?: string, value?: string} | null} [section]
 * @property {{label?: string, value?: string} | null} [category]
 * @property {number | string | null} [division]
 */

/**
 * @typedef {object} AuthSession
 * @property {Auth} [auth]
 * @property {User} [user]
 * @property {string} [idToken]
 * @property {string} [token]
 */

/**
 * @typedef {object} EventFilters
 * @property {string} q
 * @property {string} activities
 * @property {string} category
 * @property {string} level
 * @property {string} sessionStatus
 * @property {string} type
 * @property {string} date
 * @property {{label: string, value: string}} team
 * @property {string[]} [teamIds]
 * @property {{label: string, value: string}} club
 * @property {{label: string, value: string}} city
 * @property {number} radius
 */
