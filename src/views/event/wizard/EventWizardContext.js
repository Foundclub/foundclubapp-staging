
import React, { createContext, useContext, useReducer, useMemo } from 'react';

const EventWizardContext = createContext();

const initialState = {
  // Step 1: Type
  type: null, // Event Type Object or ID

  // Step 2: Team (Organizer)
  team: null, // Team Object or ID

  // Step 3: Invites
  invitedTeams: [], // Array of IDs

  // Step 4: Logistics
  date: new Date(),
  startTime: null,
  endTime: null,
  isRecurrent: false,
  recurrenceFrequency: 'week',
  recurrenceEndDate: null,
  
  // Step 5: Location
  location: null, // { lat, lng, label }
  facility: null, // Facility ID

  // Meta
  description: '',
  capacity: null,
  pricePerPerson: null,
  totalPlayers: null,
};

function eventWizardReducer(state, action) {
  switch (action.type) {
    case 'SET_TYPE':
      return { ...state, type: action.payload };
    case 'SET_TEAM':
      return { ...state, team: action.payload, invitedTeams: [] }; // Reset invites if team changes
    case 'SET_INVITES':
      return { ...state, invitedTeams: action.payload };
    case 'SET_LOGISTICS':
      return { ...state, ...action.payload };
    case 'SET_LOCATION':
      return { ...state, location: action.payload.location, facility: action.payload.facility };
    case 'SET_META':
      return { ...state, ...action.payload };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

export function EventWizardProvider({ children }) {
  const [state, dispatch] = useReducer(eventWizardReducer, initialState);

  const value = useMemo(() => ({ state, dispatch }), [state]);

  return (
    <EventWizardContext.Provider value={value}>
      {children}
    </EventWizardContext.Provider>
  );
}

export function useEventWizard() {
  const context = useContext(EventWizardContext);
  if (!context) {
    throw new Error('useEventWizard must be used within an EventWizardProvider');
  }
  return context;
}
