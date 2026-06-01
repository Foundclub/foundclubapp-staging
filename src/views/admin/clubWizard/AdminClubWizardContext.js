// @ts-nocheck
/* eslint-disable jsdoc/require-description, jsdoc/require-returns */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from 'react';

import {
  buildClubFormInitialValues,
  normalizeText,
} from '@/services/admin/adminClubContentModel';

import safeJsonParse from '@/utils/safeJsonParse';

export const ADMIN_CLUB_WIZARD_TOTAL_STEPS = 8;

const ADMIN_CLUB_WIZARD_STORAGE_KEY = 'fc:web:admin-club-wizard';
const AdminClubWizardContext = createContext(/** @type {any} */ (null));

const createInitialState = () => ({
  activitiesSearch: '',
  ...buildClubFormInitialValues({}),
  addressOption: null,
  saveReason: '',
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
    activites: Array.isArray(state?.activites) ? state.activites : initialState.activites,
    sponsor: Array.isArray(state?.sponsor) ? state.sponsor : initialState.sponsor,
  };
};

const loadPersistedState = () => {
  const initialState = createInitialState();

  if (!canUseWizardStorage()) {
    return initialState;
  }

  try {
    const raw = window.sessionStorage.getItem(ADMIN_CLUB_WIZARD_STORAGE_KEY);
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

const normalizeComparableState = (state = {}) => {
  const nextState = normalizeStateShape(state);
  return {
    ...nextState,
    activitiesSearch: '',
    addressLabel: normalizeText(nextState.addressLabel),
    city: normalizeText(nextState.city),
    email: normalizeText(nextState.email),
    geohash: normalizeText(nextState.geohash),
    latitude: normalizeText(nextState.latitude),
    longitude: normalizeText(nextState.longitude),
    maxTeamNumber: normalizeText(nextState.maxTeamNumber),
    name: normalizeText(nextState.name),
    phoneNumber: normalizeText(nextState.phoneNumber),
    postcode: normalizeText(nextState.postcode),
    saveReason: normalizeText(nextState.saveReason),
    subscriptionValue: normalizeText(nextState.subscriptionValue),
  };
};

/**
 * @param {ReturnType<typeof createInitialState>} state
 * @param {{ type: string; payload?: any }} action
 * @returns {ReturnType<typeof createInitialState>}
 */
function adminClubWizardReducer(state, action) {
  switch (action.type) {
    case 'ADD_SPONSOR':
      return {
        ...state,
        sponsor: [
          ...(Array.isArray(state.sponsor) ? state.sponsor : []),
          {
            draftKey: `sponsor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            link: '',
            title: '',
          },
        ],
      };
    case 'REMOVE_SPONSOR':
      return {
        ...state,
        sponsor: (Array.isArray(state.sponsor) ? state.sponsor : []).filter(
          (_, index) => index !== action.payload,
        ),
      };
    case 'RESET':
      return createInitialState();
    case 'SET_FIELD':
      return {
        ...state,
        [action.payload?.field]: action.payload?.value,
      };
    case 'UPDATE_SPONSOR':
      return {
        ...state,
        sponsor: (Array.isArray(state.sponsor) ? state.sponsor : []).map((item, index) => (
          index === action.payload?.index
            ? {
              ...item,
              [action.payload?.field]: action.payload?.value,
            }
            : item
        )),
      };
    default:
      return state;
  }
}

export const isAdminClubWizardPristine = (state) => (
  JSON.stringify(normalizeComparableState(state))
  === JSON.stringify(normalizeComparableState(createInitialState()))
);

/**
 * @param {{ children: React.ReactNode }} props
 * @returns {import('react').ReactElement}
 */
export function AdminClubWizardProvider({ children }) {
  const [state, dispatch] = useReducer(adminClubWizardReducer, undefined, loadPersistedState);

  useEffect(() => {
    if (!canUseWizardStorage()) return;

    try {
      window.sessionStorage.setItem(
        ADMIN_CLUB_WIZARD_STORAGE_KEY,
        JSON.stringify(state),
      );
    } catch (_error) {
      // Ignore storage failures and keep the in-memory wizard state.
    }
  }, [state]);

  const setField = useCallback((field, value) => {
    dispatch({
      payload: { field, value },
      type: 'SET_FIELD',
    });
  }, []);

  const addSponsor = useCallback(() => {
    dispatch({ type: 'ADD_SPONSOR' });
  }, []);

  const removeSponsor = useCallback((index) => {
    dispatch({
      payload: index,
      type: 'REMOVE_SPONSOR',
    });
  }, []);

  const updateSponsor = useCallback((index, field, value) => {
    dispatch({
      payload: {
        field,
        index,
        value,
      },
      type: 'UPDATE_SPONSOR',
    });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const value = useMemo(() => ({
    addSponsor,
    dispatch,
    removeSponsor,
    reset,
    setField,
    state,
    updateSponsor,
  }), [
    addSponsor,
    removeSponsor,
    reset,
    setField,
    state,
    updateSponsor,
  ]);

  return (
    <AdminClubWizardContext.Provider value={value}>
      {children}
    </AdminClubWizardContext.Provider>
  );
}

/**
 *
 */
export function useAdminClubWizard() {
  const context = useContext(AdminClubWizardContext);
  if (!context) {
    throw new Error('useAdminClubWizard must be used within an AdminClubWizardProvider');
  }
  return context;
}
