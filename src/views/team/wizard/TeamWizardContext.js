import {
  createContext, useContext, useEffect, useMemo, useReducer,
} from 'react';

import safeJsonParse from '@/utils/safeJsonParse';

const TeamWizardContext = createContext(/** @type {any} */ (null));
const TEAM_WIZARD_STORAGE_KEY = 'fc:web:team-wizard';

const createInitialState = () => ({
  activities: '',
  category: '',
  clubId: '',
  description: '',
  level: '',
  name: '',
  preselectedTrainerId: '',
  section: '',
  trainers: /** @type {string[]} */ ([]),
});

const canUseWizardStorage = () => (
  typeof globalThis !== 'undefined'
  && typeof globalThis.sessionStorage !== 'undefined'
);

const loadPersistedState = () => {
  const initialState = createInitialState();

  if (!canUseWizardStorage()) {
    return initialState;
  }

  try {
    const raw = globalThis.sessionStorage.getItem(TEAM_WIZARD_STORAGE_KEY);
    if (!raw) return initialState;

    const parsed = safeJsonParse(raw, null);
    if (!parsed || typeof parsed !== 'object') {
      return initialState;
    }

    return {
      ...initialState,
      ...parsed,
    };
  } catch (_error) {
    return initialState;
  }
};

/**
 * @param {ReturnType<typeof createInitialState>} state
 * @param {{ type: string; payload?: any }} action
 * @returns {ReturnType<typeof createInitialState>}
 */
function teamWizardReducer(state, action) {
  switch (action.type) {
    case 'INIT_FROM_PARAMS': {
      const nextClubId = action.payload?.clubId || state.clubId || '';
      const nextPreselectedTrainerId = action.payload?.preselectedTrainerId || state.preselectedTrainerId || '';
      const nextTrainers = Array.isArray(state.trainers) ? [...state.trainers] : [];

      if (nextPreselectedTrainerId && !nextTrainers.includes(nextPreselectedTrainerId)) {
        nextTrainers.push(nextPreselectedTrainerId);
      }

      return {
        ...state,
        clubId: nextClubId,
        preselectedTrainerId: nextPreselectedTrainerId,
        trainers: nextTrainers,
      };
    }
    case 'RESET':
      return createInitialState();
    case 'SET_ACTIVITY':
      return { ...state, activities: String(action.payload || '') };
    case 'SET_CATEGORY':
      return { ...state, category: String(action.payload || '') };
    case 'SET_DESCRIPTION':
      return { ...state, description: String(action.payload || '') };
    case 'SET_LEVEL':
      return { ...state, level: String(action.payload || '') };
    case 'SET_NAME':
      return { ...state, name: String(action.payload || '') };
    case 'SET_SECTION':
      return { ...state, section: String(action.payload || '') };
    case 'SET_TRAINERS':
      return { ...state, trainers: Array.isArray(action.payload) ? action.payload : [] };
    default:
      return state;
  }
}

/**
 * @param {{ children: React.ReactNode }} props
 * @returns {import('react').ReactElement}
 */
export function TeamWizardProvider({ children }) {
  const [state, dispatch] = useReducer(teamWizardReducer, undefined, loadPersistedState);

  useEffect(() => {
    if (!canUseWizardStorage()) return;

    try {
      globalThis.sessionStorage.setItem(
        TEAM_WIZARD_STORAGE_KEY,
        JSON.stringify(state),
      );
    } catch (_error) {
      // Ignore storage failures and keep the in-memory wizard state.
    }
  }, [state]);

  const value = useMemo(() => ({ dispatch, state }), [state]);

  return (
    <TeamWizardContext.Provider value={value}>
      {children}
    </TeamWizardContext.Provider>
  );
}

/**
 *
 */
export function useTeamWizard() {
  const context = useContext(TeamWizardContext);
  if (!context) {
    throw new Error('useTeamWizard must be used within à TeamWizardProvider');
  }
  return context;
}
