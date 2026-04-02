import React, {
  createContext, useContext, useEffect, useMemo, useReducer,
} from 'react';

const AdWizardContext = createContext();
const AD_WIZARD_STORAGE_KEY = 'fc:web:ad-wizard';

const createInitialState = () => ({
  audienceType: 'player',

  // Source
  event: null, // Event object (null = classic ad)
  team: null, // Team object

  // Team-related info (pre-filled from team, but editable)
  address: null, // Address object { label, city, geohash, context, ... }
  category: null, // Category object { documentId, name } (U20, Senior, etc.)
  minLevel: null, // Level object { documentId, name } (Departemental, Regional, etc.)
  section: null, // Section object { documentId, name } (Masculine, Feminine)
  sport: null, // Activity object { documentId, name } (Football, Basketball, etc.)

  // Positions with quantities: [{ name: 'Gardien', quantity: 1 }, ...]
  positions: [],

  // Coach profile
  coachRole: '',
  coachRoleOther: '',
  coachExperienceLevel: '',
  engagementType: '',
  certificationsWanted: [],
  availabilityText: '',
  missions: '',
  coachQuantity: 1,

  // Options
  description: '',
  validationMode: 'auto', // Only used when event != null
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
    const raw = globalThis.sessionStorage.getItem(AD_WIZARD_STORAGE_KEY);
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

/**
 *
 * @param state
 * @param action
 */
function adWizardReducer(state, action) {
  switch (action.type) {
    case 'RESET':
      return createInitialState();
    case 'SET_ADDRESS':
      return { ...state, address: action.payload };
    case 'SET_AUDIENCE_TYPE':
      return {
        ...state,
        audienceType: action.payload === 'coach' ? 'coach' : 'player',
        coachRole: action.payload === 'coach' ? state.coachRole : '',
        coachRoleOther: action.payload === 'coach' ? state.coachRoleOther : '',
        coachExperienceLevel: action.payload === 'coach' ? state.coachExperienceLevel : '',
        coachQuantity: action.payload === 'coach' ? state.coachQuantity : 1,
        engagementType: action.payload === 'coach' ? state.engagementType : '',
        event: action.payload === 'coach' ? null : state.event,
        missions: action.payload === 'coach' ? state.missions : '',
        positions: action.payload === 'coach' ? [] : state.positions,
        validationMode: action.payload === 'coach' ? 'manual' : state.validationMode,
      };
    case 'SET_CATEGORY':
      return { ...state, category: action.payload };
    case 'SET_COACH_EXPERIENCE_LEVEL':
      return { ...state, coachExperienceLevel: action.payload };
    case 'SET_COACH_QUANTITY':
      return { ...state, coachQuantity: Math.max(1, Math.min(10, Number(action.payload || 1))) };
    case 'SET_COACH_ROLE':
      return { ...state, coachRole: action.payload };
    case 'SET_COACH_ROLE_OTHER':
      return { ...state, coachRoleOther: action.payload };
    case 'SET_CERTIFICATIONS_WANTED':
      return { ...state, certificationsWanted: Array.isArray(action.payload) ? action.payload : [] };
    case 'SET_DESCRIPTION':
      return { ...state, description: action.payload };
    case 'SET_ENGAGEMENT_TYPE':
      return { ...state, engagementType: action.payload };
    case 'SET_EVENT':
      return { ...state, audienceType: 'player', event: action.payload };
    case 'SET_AVAILABILITY_TEXT':
      return { ...state, availabilityText: action.payload };
    case 'SET_MIN_LEVEL':
      return { ...state, minLevel: action.payload };
    case 'SET_MISSIONS':
      return { ...state, missions: action.payload };
    case 'SET_POSITION_QUANTITY': {
      const { name, quantity } = action.payload;
      return {
        ...state,
        positions: state.positions.map((p) => (p.name === name ? { ...p, quantity: Math.max(1, Math.min(10, quantity)) } : p)),
      };
    }
    case 'SET_POSITIONS':
      return { ...state, positions: action.payload };
    case 'SET_SECTION':
      return { ...state, section: action.payload };
    case 'SET_SPORT':
      return { ...state, positions: [], sport: action.payload }; // Reset positions when sport changes
    case 'SET_TEAM': {
      // When team is set, also pre-fill section, category, level, sport from team data
      const team = action.payload;
      return {
        ...state,
        address: team?.address || team?.club?.address || null, // Pre-fill address from Team > Club
        category: team?.category || null,
        minLevel: team?.level || null,
        positions: [], // Reset positions when team changes
        section: team?.section || null,
        sport: team?.activities?.[0] || team?.sport || null,
        team,
      };
    }
    case 'SET_VALIDATION_MODE':
      return { ...state, validationMode: action.payload };
    case 'TOGGLE_POSITION': {
      const posName = action.payload;
      const exists = state.positions.find((p) => p.name === posName);
      if (exists) {
        // Remove position
        return { ...state, positions: state.positions.filter((p) => p.name !== posName) };
      }
      // Add with quantity 1
      return { ...state, positions: [...state.positions, { name: posName, quantity: 1 }] };
    }
    default:
      return state;
  }
}

/**
 *
 * @param root0
 * @param root0.children
 */
export function AdWizardProvider({ children }) {
  const [state, dispatch] = useReducer(adWizardReducer, undefined, loadPersistedState);

  useEffect(() => {
    if (!canUseWizardStorage()) return;

    try {
      globalThis.sessionStorage.setItem(
        AD_WIZARD_STORAGE_KEY,
        JSON.stringify(state),
      );
    } catch (_error) {
      // Ignore storage failures and keep the in-memory wizard state.
    }
  }, [state]);

  const value = useMemo(() => ({ dispatch, state }), [state]);

  return (
    <AdWizardContext.Provider value={value}>
      {children}
    </AdWizardContext.Provider>
  );
}

/**
 *
 */
export function useAdWizard() {
  const context = useContext(AdWizardContext);
  if (!context) {
    throw new Error('useAdWizard must be used within an AdWizardProvider');
  }
  return context;
}
