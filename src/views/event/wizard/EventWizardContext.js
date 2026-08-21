import {
  createContext, useContext, useEffect, useMemo, useReducer,
} from 'react';

import safeJsonParse from '@/utils/safeJsonParse';

import { getDefaultSessionStatusForEventType } from './eventWizardDetectionUtils';

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
const isMatchTypeName = (typeName = '') => normalizeTypeLabel(typeName).includes('match');

const createInitialState = () => {
  const { end, start } = createDefaultTimeRange();
  return {
    // Step 1: Type
    type: null,

    // Step 2: Team
    club: null,
    team: null,
    tournamentActivity: null,
    tournamentCategory: null,
    tournamentScopeMode: 'team',
    tournamentSection: null,

    // Step 3: Invites
    externalClubFilters: {
      activity: '',
      city: { label: '', value: '' },
      geohash: [],
      radius: 20,
    },
    invitedTeams: [],
    teamAudiences: [],

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
    // AC04 — `null` veut dire « l'organisateur n'a pas encore tranche », et
    // c'est ce qui laisse `getDefaultCapacityModeForEventType` decider. Sans ce
    // troisieme etat, un match ne pourrait pas s'ouvrir sur « Illimite » sans
    // ecraser un « Capacite fixe » choisi a la main.
    capacityMode: null,
    detectionSlots: [],
    externalParticipantLimit: null,
    // AC04 — LES CONVOQUES D'UN MATCH, coches a l'etape Participants.
    // ⛔ Ils ne partent PAS dans la charge de creation : une convocation se pose
    // SUR un evenement, et l'evenement n'existe pas encore. Le Recap les rejoue
    // apres coup (`saveEventCompositionDraft`).
    matchCallUpPlayerIds: [],
    totalPlayers: null,
    // Step 6: Validation mode
    externalParticipantValidationMode: 'manual',
    validationMode: 'auto',

    // Step 7+: Meta
    description: '',
    // Y02 : l'adversaire d'un match, saisi a l'etape « Contre qui ? ».
    // Il vit avec les metas parce que `SET_META` est deja le reducteur des
    // champs libres — aucune nouvelle action a inventer.
    eventTasks: [],
    // AC04 — le club trouve par la recherche, quand l'adversaire EST dans
    // FoundClub. ⛔ Il ne part pas au serveur : `event` ne porte que
    // `opponentName` (schema Strapi). Il sert a re-montrer le club choisi quand
    // on revient sur l'etape, et il prepare l'ecusson (voir la migration nommee
    // dans le compte rendu du lot).
    opponentClubId: null,
    opponentName: '',
    participantIdentityVisibility: 'VISIBLE',
    // 🔒 AA10 ③ — UN BROUILLON D'EVENEMENT NAIT PRIVE. Le type n'est pas encore
    // choisi a cet instant : on part donc du cote qui n'expose personne, et
    // c'est `SET_TYPE` qui rouvre ensuite les deux types qui en ont besoin
    // (detection, tournoi — voir `getDefaultSessionStatusForEventType`).
    sessionStatus: 'closed',
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
    case 'SET_MATCH_CALL_UP':
      return {
        ...state,
        matchCallUpPlayerIds: Array.isArray(action.payload) ? action.payload : [],
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
        // AC04 — changer d'equipe change l'effectif : garder des identifiants
        // de joueurs d'une AUTRE equipe fabriquerait une convocation fantome.
        matchCallUpPlayerIds: [],
        team: action.payload,
      };
    case 'SET_TEAM_AUDIENCES':
      return { ...state, teamAudiences: action.payload };
    case 'SET_TOURNAMENT_CONTEXT':
      return {
        ...state,
        club: action.payload?.club || null,
        detectionSlots: [],
        invitedTeams: [],
        matchCallUpPlayerIds: [],
        team: action.payload?.team || null,
        tournamentActivity: action.payload?.tournamentActivity || null,
        tournamentCategory: action.payload?.tournamentCategory || null,
        tournamentScopeMode: action.payload?.tournamentScopeMode || 'team',
        tournamentSection: action.payload?.tournamentSection || null,
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
      const isMatch = isMatchTypeName(action.payload?.name);
      // 🔒 AA10 ③ — la visibilite de depart suit le TYPE, et elle ne se
      // recalcule que si le type a REELLEMENT change. Sans ce garde-fou,
      // repasser par l'etape 1 sans rien y changer — ce que fait le Recap avec
      // son lien « modifier » — effacerait un « Public » choisi a la main.
      // Meme regle que `opponentName` juste en dessous.
      const hasTypeChanged = String(action.payload?.documentId || '')
        !== String(state?.type?.documentId || '');
      const nextState = {
        ...state,
        // AC04 — le mode de capacite se REDEMANDE quand le type change
        // vraiment : c'est le type qui porte le defaut. Un type inchange (le
        // lien « modifier » du Recap) ne touche a rien, meme regle que
        // `sessionStatus` juste en dessous.
        capacityMode: hasTypeChanged ? null : state.capacityMode,
        detectionSlots: [],
        // AC04 : meme raison que `opponentName` — une convocation n'a de sens
        // que sur un match.
        matchCallUpPlayerIds: isMatch ? state.matchCallUpPlayerIds : [],
        opponentClubId: isMatch ? state.opponentClubId : null,
        // Y02 : changer de type pour autre chose qu'un match efface l'adversaire.
        // Sinon un adversaire saisi puis abandonne (« finalement c'est un
        // entrainement ») resterait accroche a l'evenement sans qu'aucun ecran
        // ne le montre plus.
        opponentName: isMatch ? state.opponentName : '',
        sessionStatus: hasTypeChanged
          ? getDefaultSessionStatusForEventType(action.payload?.name)
          : state.sessionStatus,
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
          tournamentScopeMode: state.tournamentScopeMode || 'team',
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
      if (action.payload && typeof action.payload === 'object' && !Array.isArray(action.payload)) {
        return { ...state, ...action.payload };
      }
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
