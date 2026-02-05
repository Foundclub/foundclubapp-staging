import React, { createContext, useContext, useReducer, useMemo } from 'react';

const AdWizardContext = createContext();

const initialState = {
  // Source
  team: null,           // Team object
  event: null,          // Event object (null = classic ad)
  
  // Team-related info (pre-filled from team, but editable)
  section: null,        // Section object { documentId, name } (Masculine, Féminine)
  category: null,       // Category object { documentId, name } (U20, Senior, etc.)
  minLevel: null,       // Level object { documentId, name } (Départemental, Régional, etc.)
  sport: null,          // Activity object { documentId, name } (Football, Basketball, etc.)
  address: null,        // Address object { label, city, geohash, context, ... }
  
  // Positions with quantities: [{ name: 'Gardien', quantity: 1 }, ...]
  positions: [],
  
  // Options
  validationMode: 'auto', // Only used when event != null
  description: '',
};

function adWizardReducer(state, action) {
  switch (action.type) {
    case 'SET_TEAM':
      // When team is set, also pre-fill section, category, level, sport from team data
      const team = action.payload;
      return { 
        ...state, 
        team,
        section: team?.section || null,
        category: team?.category || null,
        minLevel: team?.level || null,
        sport: team?.activities?.[0] || team?.sport || null,
        address: team?.address || team?.club?.address || null, // Pre-fill address from Team > Club
        positions: [], // Reset positions when team changes
      };
    case 'SET_EVENT':
      return { ...state, event: action.payload };
    case 'SET_ADDRESS': 
      return { ...state, address: action.payload };
    case 'SET_SECTION':
      return { ...state, section: action.payload };
    case 'SET_CATEGORY':
      return { ...state, category: action.payload };
    case 'SET_MIN_LEVEL':
      return { ...state, minLevel: action.payload };
    case 'SET_SPORT':
      return { ...state, sport: action.payload, positions: [] }; // Reset positions when sport changes
    case 'SET_POSITIONS':
      return { ...state, positions: action.payload };
    case 'TOGGLE_POSITION': {
      const posName = action.payload;
      const exists = state.positions.find(p => p.name === posName);
      if (exists) {
        // Remove position
        return { ...state, positions: state.positions.filter(p => p.name !== posName) };
      } else {
        // Add with quantity 1
        return { ...state, positions: [...state.positions, { name: posName, quantity: 1 }] };
      }
    }
    case 'SET_POSITION_QUANTITY': {
      const { name, quantity } = action.payload;
      return {
        ...state,
        positions: state.positions.map(p =>
          p.name === name ? { ...p, quantity: Math.max(1, Math.min(10, quantity)) } : p
        ),
      };
    }
    case 'SET_VALIDATION_MODE':
      return { ...state, validationMode: action.payload };
    case 'SET_DESCRIPTION':
      return { ...state, description: action.payload };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

export function AdWizardProvider({ children }) {
  const [state, dispatch] = useReducer(adWizardReducer, initialState);

  const value = useMemo(() => ({ state, dispatch }), [state]);

  return (
    <AdWizardContext.Provider value={value}>
      {children}
    </AdWizardContext.Provider>
  );
}

export function useAdWizard() {
  const context = useContext(AdWizardContext);
  if (!context) {
    throw new Error('useAdWizard must be used within an AdWizardProvider');
  }
  return context;
}
