import React, { createContext, useContext, useReducer } from 'react';

const initialState = {
  club: null,
  customClubName: '',
  useCustomClub: false,
  category: null,
  level: null,
  startYear: new Date().getFullYear(),
  endYear: new Date().getFullYear(),
  isCurrentlyActive: false,
  editingEntry: null,
};

function historyWizardReducer(state, action) {
  switch (action.type) {
    case 'SET_CLUB':
      return { ...state, club: action.payload, useCustomClub: false, customClubName: '' };
    case 'SET_CUSTOM_CLUB':
      return { ...state, customClubName: action.payload, useCustomClub: true, club: null };
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
          customClubName: action.payload.customClubName || '',
          useCustomClub: !action.payload.club && !!action.payload.customClubName,
          category: action.payload.category || null,
          level: action.payload.level || null,
          startYear: action.payload.startYear || new Date().getFullYear(),
          endYear: action.payload.endYear || new Date().getFullYear(),
          isCurrentlyActive: action.payload.isCurrentlyActive || false,
        };
      }
      return initialState;
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

const HistoryWizardContext = createContext(null);

export function HistoryWizardProvider({ children }) {
  const [state, dispatch] = useReducer(historyWizardReducer, initialState);

  return (
    <HistoryWizardContext.Provider value={{ state, dispatch }}>
      {children}
    </HistoryWizardContext.Provider>
  );
}

export function useHistoryWizard() {
  const context = useContext(HistoryWizardContext);
  if (!context) {
    throw new Error('useHistoryWizard must be used within HistoryWizardProvider');
  }
  return context;
}
