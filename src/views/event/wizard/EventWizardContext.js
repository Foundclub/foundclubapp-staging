import React, { createContext, useContext, useReducer, useMemo } from 'react';

const EventWizardContext = createContext();

const createDefaultTimeRange = () => {
  const now = new Date();
  const start = new Date(now);
  start.setHours(now.getHours() + 1, 0, 0, 0);
  const end = new Date(start);
  end.setHours(start.getHours() + 1, 30, 0, 0);
  return { end, start };
};

const createInitialState = () => {
  const { start, end } = createDefaultTimeRange();
  return {
    // Step 1: Type
    type: null,

    // Step 2: Team
    team: null,

    // Step 3: Invites
    invitedTeams: [],

    // Step 4: Logistics
    date: new Date(),
    startTime: start,
    endTime: end,
    isRecurrent: false,
    recurrenceFrequency: 'week',
    recurrenceInterval: 1,
    recurrenceDays: [],
    recurrenceStartDate: null,
    recurrenceEndDate: null,
    reservationMode: 'FULL_GROUP',
    pricePerPerson: null,
    // Step 5: Participants
    capacity: null,
    totalPlayers: null,
    // Step 6: Validation mode
    validationMode: 'auto',

    // Step 7+: Meta
    description: '',
    sessionStatus: 'open',

    // Step 9: Location
    location: null,
    facility: null,
  };
};

function eventWizardReducer(state, action) {
  switch (action.type) {
    case 'SET_TYPE':
      return { ...state, type: action.payload };
    case 'SET_TEAM':
      return { ...state, team: action.payload, invitedTeams: [] };
    case 'SET_INVITES':
      return { ...state, invitedTeams: action.payload };
    case 'SET_LOGISTICS':
      return { ...state, ...action.payload };
    case 'SET_PARTICIPANTS':
      return { ...state, ...action.payload };
    case 'SET_VALIDATION_MODE':
      return { ...state, validationMode: action.payload };
    case 'SET_LOCATION':
      return {
        ...state,
        location: action.payload.location,
        facility: action.payload.facility,
      };
    case 'SET_META':
      return { ...state, ...action.payload };
    case 'RESET':
      return createInitialState();
    default:
      return state;
  }
}

export function EventWizardProvider({ children }) {
  const [state, dispatch] = useReducer(eventWizardReducer, undefined, createInitialState);

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
