import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import Button from '@/components/atoms/button/Button';

import EventParticipants from '../components/EventParticipants';

// LOT POINTAGE (decisions d Adel du 29/09) — LA LISTE DES PARTICIPANTS SUIT LES
// DEUX OPTIONS, ET DIT LE VERDICT D APRES LE MATCH.
//
// 1. « Les participants repondent » decochee : plus de bouton « Relancer ».
// 2. « Suivre les arrivees » decochee : plus de bouton « Faire l appel ».
// 3. Le verdict vient du serveur (`finalOperationalStatus`) :
//    - `not_reported` (rien repondu, rien constate) -> « Pas renseigne » ;
//    - `present` sans pointage, evenement fini -> « Present », plus jamais
//      « A pointer +180 min » ;
//    - `no_show` n est plus qu une absence CONSTATEE A L APPEL -> « Absent a
//      l appel », plus « Non pointe ».
// Ecrits ROUGES contre app `8d017cd6`. Harnais repris de AC07BoutonRelanceGrise.

jest.mock('@/services/license/licenseQueries', () => ({
  useLicenseAssignments: () => ({ data: undefined, isLoading: false }),
}));

jest.mock('@/services/event/eventService', () => ({
  markCoachArrival: jest.fn(),
  markCoachArrivalBulk: jest.fn(),
  resetCoachAttendance: jest.fn(),
  updateCoachLateMinutes: jest.fn(),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));

jest.mock('react-i18next', () => ({
  initReactI18next: { init: jest.fn(), type: '3rdParty' },
  useTranslation: () => ({ t: (/** @type {string} */ key) => key }),
}));

jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const generateApplicationStyle = jest.requireActual('@/theme/applicationStyle').default;
  const Alignments = jest.requireActual('@/theme/alignements').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = generateColors();
  return {
    __esModule: true,
    default: () => ({
      Alignments,
      ApplicationStyle: generateApplicationStyle(Colors),
      Colors,
      Fonts: generateFonts(Colors),
      Images: new Proxy({}, { get: () => 1 }),
      scheme: 'dark',
      Spaces,
    }),
  };
});

const MUET = {
  documentId: 'muet', firstname: 'Enzo', id: 32, lastname: 'M',
};
const PRESENT = {
  documentId: 'present', firstname: 'Kylian', id: 31, lastname: 'D',
};
const ABSENT_APPEL = {
  documentId: 'absent-appel', firstname: 'Sami', id: 34, lastname: 'H',
};

const DEBUT = Date.parse('2026-09-28T18:00:00.000Z');
const TROIS_HEURES_APRES = DEBUT + 3 * 60 * 60 * 1000;

/**
 * Les proprietes de la liste d un match d hier, vu par l entraineur.
 * @param {object} [evenement] - Les options de l evenement.
 * @returns {object} Les proprietes.
 */
const proprietes = (evenement = {}) => ({
  attendanceByUserId: {
    [ABSENT_APPEL.documentId]: {
      attendanceStatus: 'no_show',
      finalOperationalStatus: 'absent',
      rsvpStatus: 'participating',
      source: 'coach_manual',
    },
    [MUET.documentId]: {
      attendanceStatus: 'not_marked',
      finalOperationalStatus: 'not_reported',
      rsvpStatus: 'not_answered',
    },
    [PRESENT.documentId]: {
      attendanceStatus: 'not_marked',
      finalOperationalStatus: 'present',
      rsvpStatus: 'participating',
    },
  },
  canEdit: true,
  event: { documentId: 'evt-1', ...evenement },
  eventStartAt: new Date(DEBUT),
  handleExportParticipants: jest.fn(),
  handleRemindPlayers: jest.fn(),
  handleShare: jest.fn(),
  handleUpdateParticipation: jest.fn(),
  handleUserPress: jest.fn(),
  nowMs: TROIS_HEURES_APRES,
  onCoachEditLate: jest.fn(),
  onCoachMarkArrival: jest.fn(),
  participantsSummary: { missing: 0, notAnswered: 1, participating: 2 },
  participationsByStatus: {
    missing: [],
    notAnswered: [MUET],
    participating: [PRESENT, ABSENT_APPEL],
  },
  pendingParticipations: [],
  teamParticipationSections: [],
});

const monter = async (props) => {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  let arbre = null;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={queryClient}>
        {/* eslint-disable-next-line react/jsx-props-no-spreading -- l ecran a 19 props */}
        <EventParticipants {...props} />
      </QueryClientProvider>,
    );
  });
  return arbre;
};

const titres = (arbre) => arbre.root.findAllByType(Button).map((bouton) => bouton.props.title);
const textes = (arbre) => arbre.root.findAllByType(Text)
  .map((noeud) => noeud.props.children)
  .filter((enfant) => typeof enfant === 'string');

test('POINTAGE-L1 — options cochees : « Relancer » et « Faire l appel » sont la', async () => {
  const arbre = await monter(proprietes());

  expect(titres(arbre)).toContain('eventDetails.actions.remind');
  expect(titres(arbre)).toContain('eventDetails.nextAction.action');
});

test('POINTAGE-L2 — 🚨 reponses decochees : plus de « Relancer »', async () => {
  const arbre = await monter(proprietes({ rsvpEnabled: false }));

  expect(titres(arbre)).not.toContain('eventDetails.actions.remind');
  expect(titres(arbre)).toContain('eventDetails.nextAction.action');
});

test('POINTAGE-L3 — 🚨 arrivees decochees : plus de « Faire l appel »', async () => {
  const arbre = await monter(proprietes({ arrivalTrackingEnabled: false }));

  expect(titres(arbre)).not.toContain('eventDetails.nextAction.action');
  expect(titres(arbre)).toContain('eventDetails.actions.remind');
});

test('POINTAGE-L4 — 🚨 apres le match, la pastille dit le verdict', async () => {
  const arbre = await monter(proprietes());
  const lus = textes(arbre);

  expect(lus).toContain('eventDetails.attendanceBadge.notReported');
  expect(lus).toContain('eventDetails.attendanceBadge.absentAtCall');
  expect(lus).toContain('eventDetails.present');
  expect(lus).not.toContain('eventDetails.attendanceBadge.toMark');
  expect(lus).not.toContain('eventDetails.attendanceBadge.notMarked');
});
