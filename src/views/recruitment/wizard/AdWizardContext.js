import React, {
  createContext, useContext, useMemo, useReducer,
} from 'react';

const AdWizardContext = createContext();

const initialState = {
  // Source
  event: null, // Event object (null = classic ad)
  team: null, // Team object

  // Team-related info (pre-filled from team, but editable)
  address: null, // Address object { label, city, geohash, context, ... }
  category: null, // Category object { documentId, name } (U20, Senior, etc.)
  minLevel: null, // Level object { documentId, name } (Départemental, Régional, etc.)
  section: null, // Section object { documentId, name } (Masculine, Féminine)
  sport: null, // Activity object { documentId, name } (Football, Basketball, etc.)

  // Positions with quantities: [{ name: 'Gardien', quantity: 1 }, ...]
  positions: [],

  // Options
  description: '',
  validationMode: 'auto', // Only used when event != null
};

/**
 *
 * @param state
 * @param action
 */
function adWizardReducer(state, action) {
  switch (action.type) {
    case 'RESET':
      return initialState;
    case 'SET_ADDRESS':
      return { ...state, address: action.payload };
    case 'SET_CATEGORY':
      return { ...state, category: action.payload };
    case 'SET_DESCRIPTION':
      return { ...state, description: action.payload };
    case 'SET_EVENT':
      return { ...state, event: action.payload };
    case 'SET_MIN_LEVEL':
      return { ...state, minLevel: action.payload };
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
    case 'SET_TEAM':
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
  const [state, dispatch] = useReducer(adWizardReducer, initialState);

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
