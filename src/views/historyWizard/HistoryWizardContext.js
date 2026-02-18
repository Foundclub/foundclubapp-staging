import React, { createContext, useContext, useReducer } from 'react';

/**
 * @typedef {{ documentId?: string, name?: string, logo?: { url?: string }, _type?: string, sectionsCount?: number, sections?: Array<{ documentId?: string, name?: string }> }} HistoryWizardClub
 */
/**
 * @typedef {{ documentId?: string, name?: string }} HistoryWizardOption
 */
/**
 * @typedef {{
 *  documentId?: string,
 *  club?: HistoryWizardClub | null,
 *  multisport_club?: HistoryWizardClub | null,
 *  customClubName?: string,
 *  category?: HistoryWizardOption | null,
 *  level?: HistoryWizardOption | null,
 *  startYear?: number,
 *  endYear?: number,
 *  isCurrentlyActive?: boolean,
 * }} HistoryWizardEditingEntry
 */
/**
 * @typedef {{
 *  club: HistoryWizardClub | null,
 *  multisportClub: HistoryWizardClub | null,
 *  customClubName: string,
 *  useCustomClub: boolean,
 *  category: HistoryWizardOption | null,
 *  level: HistoryWizardOption | null,
 *  startYear: number,
 *  endYear: number,
 *  isCurrentlyActive: boolean,
 *  editingEntry: HistoryWizardEditingEntry | null,
 *  returnRoute: string | null,
 * }} HistoryWizardState
 */
/**
 * @typedef {{
 *  type:
 *    | 'SET_RETURN_ROUTE'
 *    | 'SET_CLUB'
 *    | 'SET_MULTISPORT_CLUB'
 *    | 'SET_CUSTOM_CLUB'
 *    | 'SET_CATEGORY'
 *    | 'SET_LEVEL'
 *    | 'SET_START_YEAR'
 *    | 'SET_END_YEAR'
 *    | 'SET_CURRENTLY_ACTIVE'
 *    | 'SET_EDITING_ENTRY'
 *    | 'RESET',
 *  payload?: any,
 * }} HistoryWizardAction
 */
/**
 * @typedef {{ state: HistoryWizardState, dispatch: (action: HistoryWizardAction) => void }} HistoryWizardContextValue
 */

/** @type {HistoryWizardState} */
const initialState = {
  club: null,
  multisportClub: null,
  customClubName: '',
  useCustomClub: false,
  category: null,
  level: null,
  startYear: new Date().getFullYear(),
  endYear: new Date().getFullYear(),
  isCurrentlyActive: false,
  editingEntry: null,
  returnRoute: null,
};

/**
 * @param {HistoryWizardState} state
 * @param {HistoryWizardAction} action
 * @returns {HistoryWizardState}
 */
function historyWizardReducer(state, action) {
  switch (action.type) {
    case 'SET_RETURN_ROUTE':
      return { ...state, returnRoute: action.payload };
    case 'SET_CLUB':
      return { ...state, club: action.payload, multisportClub: null, useCustomClub: false, customClubName: '' };
    case 'SET_MULTISPORT_CLUB':
      return { ...state, multisportClub: action.payload, club: null, useCustomClub: false, customClubName: '' };
    case 'SET_CUSTOM_CLUB':
      return { ...state, customClubName: action.payload, useCustomClub: true, club: null, multisportClub: null };
    case 'SET_CATEGORY':
      return { ...state, category: action.payload };
    case 'SET_LEVEL':
      return { ...state, level: action.payload };
    case 'SET_START_YEAR':
      return { ...state, startYear: action.payload };
    case 'SET_END_YEAR':
      return { ...state, endYear: action.payload };
    case 'SET_CURRENTLY_ACTIVE':
      return { ...state, isCurrentlyActive: action.payload };
    case 'SET_EDITING_ENTRY':
      if (action.payload) {
        return {
          ...state,
          editingEntry: action.payload,
          club: action.payload.club || null,
          multisportClub: action.payload.multisport_club || null,
          customClubName: action.payload.customClubName || '',
          useCustomClub: !action.payload.club && !!action.payload.customClubName,
          category: action.payload.category || null,
          level: action.payload.level || null,
          startYear: action.payload.startYear || new Date().getFullYear(),
          endYear: action.payload.endYear || new Date().getFullYear(),
          isCurrentlyActive: action.payload.isCurrentlyActive || false,
          returnRoute: null, // Reset return route when editing
        };
      }
      return initialState;
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

const HistoryWizardContext = createContext(/** @type {HistoryWizardContextValue | null} */ (null));

/**
 * @param {{ children: React.ReactNode }} props
 */
export function HistoryWizardProvider({ children }) {
  const [state, dispatch] = useReducer(historyWizardReducer, initialState);

  return (
    <HistoryWizardContext.Provider value={{ state, dispatch }}>
      {children}
    </HistoryWizardContext.Provider>
  );
}

/**
 * @returns {HistoryWizardContextValue}
 */
export function useHistoryWizard() {
  const context = useContext(HistoryWizardContext);
  if (!context) {
    throw new Error('useHistoryWizard must be used within HistoryWizardProvider');
  }
  return context;
}
