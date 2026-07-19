import {
  createContext, useContext, useEffect, useMemo, useReducer,
} from 'react';

import safeJsonParse from '@/utils/safeJsonParse';

/**
 * Contexte du tunnel de création de club self-service (coach/dirigeant qui ne
 * trouve pas son club). Gabarit calqué sur TeamWizardContext : brouillon
 * persistant (web) + reducer par champ. Aucune donnée privilégiée
 * (clubVerified/clubPartner/maxTeams) — le serveur les force à false.
 */
const ClubWizardContext = createContext(/** @type {any} */ (null));
const CLUB_WIZARD_STORAGE_KEY = 'fc:web:club-wizard';

const createInitialState = () => ({
  activityDocumentIds: /** @type {string[]} */ ([]),
  addressOption: /** @type {any} */ (null),
  alsoDirector: false,
  email: '',
  name: '',
  phoneNumber: '',
});

const canUseWizardStorage = () => (
  typeof window !== 'undefined'
  && typeof window.sessionStorage !== 'undefined'
);

const normalizeStateShape = (state = {}) => {
  const initialState = createInitialState();
  return {
    ...initialState,
    ...state,
    activityDocumentIds: Array.isArray(state?.activityDocumentIds)
      ? state.activityDocumentIds
      : initialState.activityDocumentIds,
  };
};

const loadPersistedState = () => {
  const initialState = createInitialState();
  if (!canUseWizardStorage()) {
    return initialState;
  }
  try {
    const raw = window.sessionStorage.getItem(CLUB_WIZARD_STORAGE_KEY);
    if (!raw) return initialState;
    const parsed = safeJsonParse(raw, null);
    if (!parsed || typeof parsed !== 'object') {
      return initialState;
    }
    return normalizeStateShape(parsed);
  } catch (_error) {
    return initialState;
  }
};

/**
 * @param {ReturnType<typeof createInitialState>} state
 * @param {{ type: string; payload?: any }} action
 * @returns {ReturnType<typeof createInitialState>}
 */
function clubWizardReducer(state, action) {
  switch (action.type) {
    case 'RESET':
      return createInitialState();
    case 'SET_ACTIVITIES':
      return {
        ...state,
        activityDocumentIds: Array.isArray(action.payload) ? action.payload : [],
      };
    case 'SET_ADDRESS':
      return { ...state, addressOption: action.payload || null };
    case 'SET_ALSO_DIRECTOR':
      return { ...state, alsoDirector: action.payload === true };
    case 'SET_EMAIL':
      return { ...state, email: String(action.payload ?? '') };
    case 'SET_NAME':
      return { ...state, name: String(action.payload ?? '') };
    case 'SET_PHONE':
      return { ...state, phoneNumber: String(action.payload ?? '') };
    case 'TOGGLE_ACTIVITY': {
      const id = String(action.payload || '');
      if (!id) return state;
      const current = Array.isArray(state.activityDocumentIds) ? state.activityDocumentIds : [];
      const next = current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id];
      return { ...state, activityDocumentIds: next };
    }
    default:
      return state;
  }
}

/**
 * @param {{ children: import('react').ReactNode }} props
 * @returns {import('react').ReactElement}
 */
export function ClubWizardProvider({ children }) {
  const [state, dispatch] = useReducer(clubWizardReducer, undefined, loadPersistedState);

  useEffect(() => {
    if (!canUseWizardStorage()) return;
    try {
      window.sessionStorage.setItem(CLUB_WIZARD_STORAGE_KEY, JSON.stringify(state));
    } catch (_error) {
      // Persistance best-effort : un échec ne doit jamais casser le tunnel.
    }
  }, [state]);

  const value = useMemo(() => ({ dispatch, state }), [state]);

  return (
    <ClubWizardContext.Provider value={value}>
      {children}
    </ClubWizardContext.Provider>
  );
}

/**
 * @returns {{ state: ReturnType<typeof createInitialState>; dispatch: import('react').Dispatch<any> }}
 */
export function useClubWizard() {
  const context = useContext(ClubWizardContext);
  if (!context) {
    throw new Error('useClubWizard must be used within à ClubWizardProvider');
  }
  return context;
}

export { CLUB_WIZARD_STORAGE_KEY };
