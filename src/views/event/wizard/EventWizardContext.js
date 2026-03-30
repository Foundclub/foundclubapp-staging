import {
  createContext, useContext, useEffect, useMemo, useReducer,
} from 'react';

const EventWizardContext = createContext();
const EVENT_WIZARD_STORAGE_KEY = 'fc:web:event-wizard';

const createDefaultTimeRange = () => {
  const now = new Date();
  const start = new Date(now);
  start.setHours(now.getHours() + 1, 0, 0, 0);
  const end = new Date(start);
  end.setHours(start.getHours() + 1, 0, 0, 0);
  return { end, start };
};

const createInitialState = () => {
  const { end, start } = createDefaultTimeRange();
  return {
    // Step 1: Type
    type: null,

    // Step 2: Team
    team: null,

    // Step 3: Invites
    invitedTeams: [],

    // Step 4: Logistics
    date: new Date(),
    endTime: end,
    isRecurrent: false,
    pricePerPerson: null,
    recurrenceDays: [],
    recurrenceEndDate: null,
    recurrenceFrequency: 'week',
    recurrenceInterval: 1,
    recurrenceStartDate: null,
    reservationMode: 'FULL_GROUP',
    startTime: start,
    // Step 5: Participants
    capacity: null,
    detectionSlots: [],
    totalPlayers: null,
    // Step 6: Validation mode
    validationMode: 'auto',

    // Step 7+: Meta
    description: '',
    sessionStatus: 'open',

    // Step 9: Location
    facility: null,
    location: null,
  };
};

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
    const raw = globalThis.sessionStorage.getItem(EVENT_WIZARD_STORAGE_KEY);
    if (!raw) return initialState;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return initialState;

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
function eventWizardReducer(state, action) {
  switch (action.type) {
    case 'RESET':
      return createInitialState();
    case 'SET_DETECTION_SLOTS':
      return { ...state, detectionSlots: action.payload };
    case 'SET_INVITES':
      return { ...state, invitedTeams: action.payload };
    case 'SET_LOCATION':
      return {
        ...state,
        facility: action.payload.facility,
        location: action.payload.location,
      };
    case 'SET_LOGISTICS':
      return {
        ...state,
        ...action.payload,
        detectionSlots: action.payload?.isRecurrent ? [] : state.detectionSlots,
      };
    case 'SET_META':
      return { ...state, ...action.payload };
    case 'SET_PARTICIPANTS':
      return { ...state, ...action.payload };
    case 'SET_TEAM':
      return {
        ...state,
        detectionSlots: [],
        invitedTeams: [],
        team: action.payload,
      };
    case 'SET_TYPE':
      return { ...state, detectionSlots: [], type: action.payload };
    case 'SET_VALIDATION_MODE':
      return { ...state, validationMode: action.payload };
    default:
      return state;
  }
}

/**
 *
 * @param root0
 * @param root0.children
 */
export function EventWizardProvider({ children }) {
  const [state, dispatch] = useReducer(eventWizardReducer, undefined, loadPersistedState);

  useEffect(() => {
    if (!canUseWizardStorage()) return;

    try {
      globalThis.sessionStorage.setItem(
        EVENT_WIZARD_STORAGE_KEY,
        JSON.stringify(state),
      );
    } catch (_error) {
      // Ignore storage failures and keep the in-memory wizard state.
    }
  }, [state]);

  const value = useMemo(() => ({ dispatch, state }), [state]);

  return (
    <EventWizardContext.Provider value={value}>
      {children}
    </EventWizardContext.Provider>
  );
}

/**
 *
 */
export function useEventWizard() {
  const context = useContext(EventWizardContext);
  if (!context) {
    throw new Error('useEventWizard must be used within an EventWizardProvider');
  }
  return context;
}
