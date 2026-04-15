import {
  createContext, useContext, useEffect, useMemo, useReducer,
} from 'react';

import safeJsonParse from '@/utils/safeJsonParse';

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

const normalizeTypeLabel = (value = '') => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

const isStageTypeName = (typeName = '') => normalizeTypeLabel(typeName).includes('stage');
const isTournamentTypeName = (typeName = '') => normalizeTypeLabel(typeName).includes('tournoi');

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
    isMultiDayTournament: false,
    isRecurrent: false,
    pricePerPerson: null,
    recurrenceDays: [],
    recurrenceEndDate: null,
    recurrenceFrequency: 'week',
    recurrenceInterval: 1,
    recurrenceStartDate: null,
    reservationMode: 'FULL_GROUP',
    stageDefaultEndTime: end,
    stageDefaultStartTime: start,
    stageEndDate: start,
    stageSchedule: [],
    stageStartDate: start,
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
    tournamentAllowCrossClubPlayers: false,
    tournamentAllowCustomTeams: true,
    tournamentBestThirdPlacesCount: 0,
    tournamentFormatMode: 'groups_only',
    tournamentGroupCount: 2,
    tournamentKnockoutSize: 8,
    tournamentMatchGenerationMode: 'auto',
    tournamentMaxRosterSize: null,
    tournamentMaxTeams: null,
    tournamentMinRosterSize: null,
    tournamentPointsDraw: 1,
    tournamentPointsForfeit: 0,
    tournamentPointsLoss: 0,
    tournamentPointsWin: 3,
    tournamentQualifiedPerGroup: 2,
    tournamentRegistrationMode: 'manual',
    tournamentRulesText: '',
    tournamentSeedingMode: 'random',
    tournamentThirdPlaceMatch: false,

    // Step 9: Location
    facility: null,
    location: null,
  };
};

const canUseWizardStorage = () => (
  typeof window !== 'undefined'
  && typeof window.sessionStorage !== 'undefined'
);

const loadPersistedState = () => {
  const initialState = createInitialState();

  if (!canUseWizardStorage()) {
    return initialState;
  }

  try {
    const raw = window.sessionStorage.getItem(EVENT_WIZARD_STORAGE_KEY);
    if (!raw) return initialState;

    const parsed = safeJsonParse(raw, null);
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
    case 'SET_STAGE_PROGRAM':
      return {
        ...state,
        ...action.payload,
      };
    case 'SET_TEAM':
      return {
        ...state,
        detectionSlots: [],
        invitedTeams: [],
        team: action.payload,
      };
    case 'SET_TOURNAMENT_SETTINGS':
      return {
        ...state,
        ...action.payload,
      };
    case 'SET_TOURNAMENT_STRUCTURE':
      return {
        ...state,
        ...action.payload,
      };
    case 'SET_TYPE': {
      const isStage = isStageTypeName(action.payload?.name);
      const isTournament = isTournamentTypeName(action.payload?.name);
      const nextState = {
        ...state,
        detectionSlots: [],
        type: action.payload,
      };

      if (!isStage) {
        const normalizedState = {
          ...nextState,
          isMultiDayTournament: false,
          stageSchedule: [],
        };

        if (!isTournament) {
          return normalizedState;
        }

        return {
          ...normalizedState,
          invitedTeams: [],
          isRecurrent: false,
          recurrenceDays: [],
          recurrenceEndDate: null,
          recurrenceFrequency: 'week',
          recurrenceInterval: 1,
          recurrenceStartDate: null,
          tournamentBestThirdPlacesCount: state.tournamentBestThirdPlacesCount ?? 0,
          tournamentFormatMode: state.tournamentFormatMode || 'groups_only',
          tournamentGroupCount: state.tournamentGroupCount || 2,
          tournamentKnockoutSize: state.tournamentKnockoutSize || 8,
          tournamentMatchGenerationMode: state.tournamentMatchGenerationMode || 'auto',
          tournamentPointsDraw: state.tournamentPointsDraw ?? 1,
          tournamentPointsForfeit: state.tournamentPointsForfeit ?? 0,
          tournamentPointsLoss: state.tournamentPointsLoss ?? 0,
          tournamentPointsWin: state.tournamentPointsWin ?? 3,
          tournamentQualifiedPerGroup: state.tournamentQualifiedPerGroup || 2,
          tournamentSeedingMode: state.tournamentSeedingMode || 'random',
          tournamentThirdPlaceMatch: state.tournamentThirdPlaceMatch === true,
        };
      }

      return {
        ...nextState,
        isMultiDayTournament: false,
        isRecurrent: false,
        recurrenceDays: [],
        recurrenceEndDate: null,
        recurrenceFrequency: 'week',
        recurrenceInterval: 1,
        recurrenceStartDate: null,
        stageDefaultEndTime: state.stageDefaultEndTime || state.endTime,
        stageDefaultStartTime: state.stageDefaultStartTime || state.startTime,
        stageEndDate: state.stageEndDate || state.date,
        stageSchedule: Array.isArray(state.stageSchedule) ? state.stageSchedule : [],
        stageStartDate: state.stageStartDate || state.date,
      };
    }
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
      window.sessionStorage.setItem(
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
