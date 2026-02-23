import React, {
  createContext, useContext, useMemo, useReducer,
} from 'react';

const TeamWizardContext = createContext(/** @type {any} */ (null));

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
  const [state, dispatch] = useReducer(teamWizardReducer, undefined, createInitialState);
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
    throw new Error('useTeamWizard must be used within a TeamWizardProvider');
  }
  return context;
}
