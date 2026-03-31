import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from 'react';

/**
 * @typedef {{ documentId?: string, name?: string, logo?: { url?: string }, _type?: string, sectionsCount?: number, sections?: Array<{ documentId?: string, name?: string }> }} HistoryWizardClub
 */
/**
 * @typedef {{ documentId?: string, name?: string }} HistoryWizardOption
 */
/**
 * @typedef {{
 *  documentId?: string,
 *  categories?: HistoryWizardOption[] | null,
 *  category?: HistoryWizardOption | null,
 *  club?: HistoryWizardClub | null,
 *  multisport_club?: HistoryWizardClub | null,
 *  customClubName?: string,
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
 *  categories: HistoryWizardOption[],
 *  level: HistoryWizardOption | null,
 *  startYear: number,
 *  endYear: number,
 *  isCurrentlyActive: boolean,
 *  editingEntry: HistoryWizardEditingEntry | null,
 *  returnRoute: string | null,
 * }} HistoryWizardState
 */
/** @typedef {{ type: string, payload?: any }} HistoryWizardAction */
/**
 * @typedef {{ state: HistoryWizardState, dispatch: (action: HistoryWizardAction) => void }} HistoryWizardContextValue
 */

const createInitialState = () => {
  const currentYear = new Date().getFullYear();

  /** @type {HistoryWizardState} */
  return {
    categories: [],
    club: null,
    customClubName: '',
    editingEntry: null,
    endYear: currentYear,
    isCurrentlyActive: false,
    level: null,
    multisportClub: null,
    returnRoute: null,
    startYear: currentYear,
    useCustomClub: false,
  };
};

const HISTORY_WIZARD_STORAGE_KEY = 'fc:web:history-wizard';

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
    const raw = globalThis.sessionStorage.getItem(HISTORY_WIZARD_STORAGE_KEY);
    if (!raw) return initialState;

    const parsed = JSON.parse(raw);
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

const normalizeCategories = (payload) => {
  if (Array.isArray(payload)) {
    return payload.filter(Boolean);
  }

  if (payload) {
    return [payload];
  }

  return [];
};

/**
 * @param {HistoryWizardState} state
 * @param {HistoryWizardAction} action
 * @returns {HistoryWizardState}
 */
function historyWizardReducer(state, action) {
  switch (action.type) {
    case 'CLEAR_CLUB_SELECTION':
      return {
        ...state,
        club: null,
        customClubName: '',
        multisportClub: null,
        useCustomClub: false,
      };
    case 'RESET':
      return createInitialState();
    case 'SET_CATEGORIES':
      return { ...state, categories: normalizeCategories(action.payload) };
    case 'SET_CATEGORY':
      return { ...state, categories: normalizeCategories(action.payload) };
    case 'SET_CLUB':
      return {
        ...state,
        club: action.payload || null,
        customClubName: '',
        multisportClub: null,
        useCustomClub: false,
      };
    case 'SET_CURRENTLY_ACTIVE':
      return { ...state, isCurrentlyActive: action.payload };
    case 'SET_CUSTOM_CLUB':
      return {
        ...state,
        club: null,
        customClubName: action.payload,
        multisportClub: null,
        useCustomClub: true,
      };
    case 'SET_EDITING_ENTRY':
      if (action.payload) {
        const editingCategories = Array.isArray(action.payload.categories)
          ? action.payload.categories.filter(Boolean)
          : normalizeCategories(action.payload.category);
        const currentYear = new Date().getFullYear();

        return {
          ...state,
          categories: editingCategories,
          club: action.payload.club || null,
          customClubName: action.payload.customClubName || '',
          editingEntry: action.payload,
          endYear: action.payload.endYear || currentYear,
          isCurrentlyActive: action.payload.isCurrentlyActive || false,
          level: action.payload.level || null,
          multisportClub: action.payload.multisport_club || null,
          returnRoute: null,
          startYear: action.payload.startYear || currentYear,
          useCustomClub: !action.payload.club && !!action.payload.customClubName,
        };
      }
      return createInitialState();
    case 'SET_END_YEAR':
      return { ...state, endYear: action.payload };
    case 'SET_LEVEL':
      return { ...state, level: action.payload };
    case 'SET_MULTISPORT_CLUB':
      return {
        ...state,
        club: null,
        customClubName: '',
        multisportClub: action.payload || null,
        useCustomClub: false,
      };
    case 'SET_RETURN_ROUTE':
      return { ...state, returnRoute: action.payload };
    case 'SET_START_YEAR':
      return {
        ...state,
        endYear: state.isCurrentlyActive ? state.endYear : Math.max(Number(state.endYear || 0), Number(action.payload || 0)),
        startYear: action.payload,
      };
    case 'TOGGLE_CATEGORY': {
      if (!action.payload?.documentId) return state;
      const exists = state.categories.some(
        (category) => category?.documentId === action.payload.documentId,
      );

      return {
        ...state,
        categories: exists
          ? state.categories.filter((category) => category?.documentId !== action.payload.documentId)
          : [...state.categories, action.payload],
      };
    }
    default:
      return state;
  }
}

const HistoryWizardContext = createContext(/** @type {HistoryWizardContextValue | null} */ (null));

/**
 * @param {{ children: React.ReactNode }} props
 */
export function HistoryWizardProvider({ children }) {
  const [state, dispatch] = useReducer(historyWizardReducer, undefined, loadPersistedState);

  useEffect(() => {
    if (!canUseWizardStorage()) return;

    try {
      globalThis.sessionStorage.setItem(
        HISTORY_WIZARD_STORAGE_KEY,
        JSON.stringify(state),
      );
    } catch (_error) {
      // Ignore storage failures and keep the in-memory wizard state.
    }
  }, [state]);

  const value = useMemo(() => ({ dispatch, state }), [dispatch, state]);

  return (
    <HistoryWizardContext.Provider value={value}>
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
