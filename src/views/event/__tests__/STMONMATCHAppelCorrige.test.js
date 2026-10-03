/* eslint-disable max-len -- les libellés du design se lisent en entier. */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import Button from '@/components/atoms/button/Button';

import EventParticipants from '../components/EventParticipants';

// ST-MONMATCH (écran 2, état 3, design des statistiques validé le 02/10) — « CE QUE VOIT
// L'ENTRAÎNEUR » : l'appel se corrige dans Participants, D'UN GESTE.
//
// 🚪 Le défaut, mesuré le 03/10 (cartographie de `EventParticipants.js`) : un joueur pointé
// absent à l'appel n'avait AUCUN bouton dans la liste. « Modifier » ne s'offre qu'à qui est
// arrivé (`dejaPointe = Boolean(attendance?.arrivedAt)`), et une absence n'a pas d'heure
// d'arrivée. Le joueur restait donc bloqué, questionnaire fermé, jusqu'à ce que l'entraîneur
// retrouve l'écran d'appel — fermé lui-même 2 h après le match.
//
// ✅ Attendu : sur sa ligne, « Présent » (nommé « Passer Sami H présent » pour le lecteur
// d'écran), qui passe par la correction sans fenêtre du serveur (`patchLate`, retard 0) ;
// l'heure du pointage à côté de « Absent à l'appel » ; et, sur un match, la phrase qui dit
// que le questionnaire se rouvre.

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

// La doublure INTERPOLE les {{…}} du repli : les phrases se lisent comme à l'écran.
jest.mock('react-i18next', () => ({
  initReactI18next: { init: jest.fn(), type: '3rdParty' },
  useTranslation: () => ({
    t: (/** @type {string} */ key, /** @type {any} */ repli, /** @type {any} */ options) => (
      typeof repli === 'string'
        ? repli.replace(/\{\{(\w+)\}\}/g, (/** @type {string} */ tout, /** @type {string} */ nom) => (
          options && nom in options ? String(options[nom]) : tout
        ))
        : key
    ),
  }),
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

const PRESENT = {
  documentId: 'present', firstname: 'Kylian', id: 31, lastname: 'D',
};
const ABSENT_APPEL = {
  documentId: 'absent-appel', firstname: 'Sami', id: 34, lastname: 'H',
};
const ABSENT_DECLARE = {
  documentId: 'absent-declare', firstname: 'Lina', id: 35, lastname: 'B',
};

const DEBUT = Date.parse('2026-09-28T18:00:00.000Z');
const POINTE_A = '2026-09-28T18:55:00.000Z';
const TROIS_HEURES_APRES = DEBUT + 3 * 60 * 60 * 1000;

/**
 * La liste d un match d hier, vue par l entraineur : Sami a dit « present » puis a ete
 * pointe absent a l appel ; Lina avait dit « absente » et a ete pointee absente.
 * @param {object} [surcharges] - Les proprietes a changer.
 * @returns {object} Les proprietes.
 */
const proprietes = (surcharges = {}) => ({
  attendanceByUserId: {
    [ABSENT_APPEL.documentId]: {
      attendanceStatus: 'no_show',
      finalizedAt: POINTE_A,
      finalOperationalStatus: 'absent',
      rsvpStatus: 'participating',
      source: 'coach_manual',
    },
    [ABSENT_DECLARE.documentId]: {
      attendanceStatus: 'no_show',
      finalizedAt: POINTE_A,
      finalOperationalStatus: 'absent',
      rsvpStatus: 'missing',
      source: 'coach_manual',
    },
    [PRESENT.documentId]: {
      arrivedAt: '2026-09-28T17:55:00.000Z',
      attendanceStatus: 'arrived_on_time',
      finalOperationalStatus: 'present',
      rsvpStatus: 'participating',
    },
  },
  canEdit: true,
  event: { documentId: 'evt-1' },
  eventStartAt: new Date(DEBUT),
  handleExportParticipants: jest.fn(),
  handleRemindPlayers: jest.fn(),
  handleShare: jest.fn(),
  handleUpdateParticipation: jest.fn(),
  handleUserPress: jest.fn(),
  nowMs: TROIS_HEURES_APRES,
  onCoachEditLate: jest.fn(),
  onCoachMarkPresent: jest.fn(),
  participantsSummary: { missing: 1, notAnswered: 0, participating: 2 },
  participationsByStatus: {
    missing: [ABSENT_DECLARE],
    notAnswered: [],
    participating: [PRESENT, ABSENT_APPEL],
  },
  pendingParticipations: [],
  rouvreLeQuestionnaire: true,
  teamParticipationSections: [],
  ...surcharges,
});

/** @type {any[]} */
const montes = [];
afterEach(() => {
  montes.splice(0).forEach((arbre) => act(() => arbre.unmount()));
});

const monter = async (/** @type {any} */ props) => {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  /** @type {any} */
  let arbre = null;
  await act(async () => {
    arbre = renderer.create(createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(EventParticipants, props),
    ));
  });
  montes.push(arbre);
  return arbre;
};

const boutonsPresent = (/** @type {any} */ arbre) => arbre.root.findAllByType(Button)
  .filter((/** @type {any} */ bouton) => bouton.props.title === 'Présent');
const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ noeud) => noeud.props.children)
  .filter((/** @type {any} */ enfant) => typeof enfant === 'string');
const heureLocale = (/** @type {string} */ iso) => new Date(iso)
  .toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

test('ST-MONMATCH appel/1 — 🚪 l absent à l appel a « Présent » sur sa ligne, nommé pour le lecteur d écran', async () => {
  const arbre = await monter(proprietes());
  const boutons = boutonsPresent(arbre);

  // Sami (il avait dit « présent ») ET Lina (elle avait dit « absente ») : les deux pointés absents.
  expect(boutons).toHaveLength(2);
  expect(boutons.map((bouton) => bouton.props.accessibilityLabel).sort())
    .toEqual(['Passer Lina B présent', 'Passer Sami H présent']);
});

test('ST-MONMATCH appel/2 — un geste : « Présent » corrige CE joueur', async () => {
  const props = proprietes();
  const arbre = await monter(props);
  const bouton = boutonsPresent(arbre)
    .find((/** @type {any} */ b) => b.props.accessibilityLabel === 'Passer Sami H présent');

  act(() => { bouton.props.onPress(); });

  expect(props.onCoachMarkPresent).toHaveBeenCalledTimes(1);
  expect(props.onCoachMarkPresent).toHaveBeenCalledWith(expect.objectContaining({ documentId: ABSENT_APPEL.documentId }));
});

test('ST-MONMATCH appel/3 — l heure du pointage se lit à côté de « Absent à l appel »', async () => {
  const lus = textes(await monter(proprietes()));

  expect(lus.filter((texte) => texte === 'Absent à l’appel')).toHaveLength(2);
  expect(lus).toContain(heureLocale(POINTE_A));
});

test('ST-MONMATCH appel/4 — sur un match, la phrase dit que le questionnaire se rouvre', async () => {
  const avec = textes(await monter(proprietes()));
  expect(avec).toContain('Passer un joueur présent rouvre son questionnaire de match.');

  const unSeul = textes(await monter(proprietes({
    attendanceByUserId: { [ABSENT_APPEL.documentId]: proprietes().attendanceByUserId[ABSENT_APPEL.documentId] },
    participationsByStatus: { missing: [], notAnswered: [], participating: [ABSENT_APPEL] },
  })));
  expect(unSeul).toContain('Passer Sami présent rouvre son questionnaire de match.');

  const entrainement = textes(await monter(proprietes({ rouvreLeQuestionnaire: false })));
  expect(entrainement.some((texte) => texte.includes('questionnaire'))).toBe(false);
});

test('ST-MONMATCH appel/5 — 🔒 PROTÉGÉ : rien pour qui ne gère pas, rien pour un joueur arrivé', async () => {
  const lecteur = await monter(proprietes({ canEdit: false, onCoachMarkPresent: undefined }));
  expect(boutonsPresent(lecteur)).toHaveLength(0);
  expect(textes(lecteur).some((texte) => texte.includes('questionnaire'))).toBe(false);

  const sansGeste = await monter(proprietes({ onCoachMarkPresent: undefined }));
  expect(boutonsPresent(sansGeste)).toHaveLength(0);

  const arbre = await monter(proprietes());
  const nommes = boutonsPresent(arbre).map((bouton) => bouton.props.accessibilityLabel);
  expect(nommes).not.toContain('Passer Kylian D présent');
});
