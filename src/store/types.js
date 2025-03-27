/**
 * @typedef Store The global store.
 * @property {Auth} auth The authentication state.
 * @property {string} [fcmToken] - The Firebase Cloud Messaging token.
 * @property {string} [theme] - The current theme.
 */

/**
 * @typedef Auth
 * @property {string} accessToken The access token.
 * @property {string} refreshToken The refresh token.
 */

/**
 * @typedef {'SET_AUTHENTICATION' | 'DELETE_AUTHENTICATION'
 * | 'SET_FCM_TOKEN' | 'SET_THEME'} AppContextTypes
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
