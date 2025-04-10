/**
 * @typedef Store The global store.
 * @property {Auth} [auth] The authentication state.
 * @property {string} [fcmToken] - The Firebase Cloud Messaging token.
 * @property {string} [theme] - The current theme.
 * @property {string[]} [onboardingViews] - The list of onboarding views to show.
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
 * | 'SET_FCM_TOKEN' | 'SET_THEME' | 'SET_ONBOARDING_VIEWS'} AppContextTypes
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
