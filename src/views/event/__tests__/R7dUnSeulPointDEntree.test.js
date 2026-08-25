import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import renderer, { act } from 'react-test-renderer';

import Button from '@/components/atoms/button/Button';

import EventParticipants from '../components/EventParticipants';

// ===========================================================================
// LOT R7-d (vague R, 2026-08-24) — UN SEUL POINT D ENTREE PAR JOUEUR.
//
// 🔴 LE DEFAUT, constate en recette le 24/08 puis lu dans le code :
//   chaque ligne de la liste des participants portait DEUX boutons cote a
//   cote, « Pointer l arrivée » et « Modifier ». Ils appellent
//   `openCoachLateModal(joueur, 'coach_mark' | 'coach_edit')` : le MEME modal,
//   au titre pres. Deux boutons, un seul geste — et aucun des deux ne dit
//   « il est arrivé à l heure », qui est pourtant le cas le plus frequent au
//   bord d un terrain.
//
// 🎯 CE QUE CE LOT FAIT (decision produit d Adel, R7-c + R7-d) :
//   l ETAT de la personne decide, et il n y a plus jamais deux boutons qui
//   font la meme chose.
//     · pas encore pointe → « À l'heure » (ecrit DIRECTEMENT, 0 minute de
//       retard) et « En retard » (ouvre le modal, qui sert a ca)
//     · deja pointe       → « Modifier », SEUL
//   C est mot pour mot la grammaire de l ecran d appel (AttendanceRow : « Là »
//   + l horloge quand ce n est pas pointe, « Corriger » quand ca l est).
//
// 🧨 POURQUOI CE FICHIER MOCKE `eventService` : « À l'heure » ecrit pour de
//   vrai, donc `EventParticipants` monte desormais
//   `useAttendanceCallMutations`. Le VRAI service descend jusqu a
//   `client.native.js`, qui jette AU CHARGEMENT quand `.env` est absent — et
//   `.env` est gitignore, donc absent de toute copie de travail. Sans ce mock,
//   la SUITE entiere ne demarre pas : « failed to run », 0 test execute.
// ===========================================================================

const mockMarkCoachArrival = jest.fn();

jest.mock('@/services/event/eventService', () => ({
  markCoachArrival: (/** @type {any} */ ...args) => mockMarkCoachArrival(...args),
  markCoachArrivalBulk: jest.fn(),
  resetCoachAttendance: jest.fn(),
  updateCoachLateMinutes: jest.fn(),
}));

// 🗺️ S3-bis — CONDITION DE DEMARRAGE (meme motif que les mocks ci-dessus).
// Depuis S3-bis, `EventParticipants` porte le bouton « Faire l'appel » et monte
// donc `useNavigation()`. Sans conteneur de navigation dans le harnais, le vrai
// module jette « useNavigation is not a function » et toute la suite tombe.
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));

jest.mock('@/services/license/licenseQueries', () => ({
  useLicenseAssignments: () => ({ data: undefined, isLoading: false }),
}));

jest.mock('react-i18next', () => {
  const traductions = jest.requireActual('@/theme/strings/translations/fr').default;
  /**
   * Lit une clef pointee dans le VRAI dictionnaire francais.
   * @param {string} chemin - La clef, par exemple `eventDetails.attendanceActions.onTime`.
   * @returns {any} - La valeur trouvee, ou `undefined`.
   */
  const lire = (chemin) => String(chemin)
    .split('.')
    .reduce(
      (noeud, clef) => (noeud === null || noeud === undefined ? undefined : noeud[clef]),
      traductions,
    );
  return {
    initReactI18next: { init: jest.fn(), type: '3rdParty' },
    useTranslation: () => ({
      t: (/** @type {string} */ clef, /** @type {any} */ valeurParDefaut) => {
        const valeur = lire(clef);
        if (typeof valeur === 'string') return valeur;
        return typeof valeurParDefaut === 'string' ? valeurParDefaut : clef;
      },
    }),
  };
});

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

const EVENEMENT_ID = 'evt-1';
const NOW_MS = Date.parse('2026-08-24T18:00:00.000Z');

const P_A_POINTER = {
  documentId: 'p-a-pointer', firstname: 'Lena', id: 'p-a-pointer', lastname: 'Test',
};
const P_DEJA_POINTE = {
  documentId: 'p-deja', firstname: 'Alex', id: 'p-deja', lastname: 'Test',
};

const onCoachEditLate = jest.fn();
const onCoachMarkArrival = jest.fn();

const PROPS_BASE = {
  attendanceByUserId: {},
  canApprovePendingRequests: true,
  canEdit: true,
  event: { documentId: EVENEMENT_ID },
  eventStartAt: null,
  externalParticipationSection: null,
  handleExportParticipants: jest.fn(),
  handleRemindPlayers: jest.fn(),
  handleShare: jest.fn(),
  handleUpdateParticipation: jest.fn(),
  handleUserPress: jest.fn(),
  nowMs: NOW_MS,
  onCoachEditLate,
  onCoachMarkArrival,
  participantsSummary: undefined,
  participationsByStatus: undefined,
  pendingParticipations: [],
  teamParticipationSections: [],
};

/**
 * Monte le VRAI composant dans son fournisseur de requetes.
 * @param {object} [surcharges] - Les props a remplacer.
 * @returns {any} - L arbre rendu.
 */
const monter = (surcharges = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <QueryClientProvider client={queryClient}>
        {/* eslint-disable-next-line react/jsx-props-no-spreading -- l ecran a 19 props */}
        <EventParticipants {...PROPS_BASE} {...surcharges} />
      </QueryClientProvider>,
    );
  });
  return arbre;
};

/**
 * Une section d equipe minimale.
 * @param {object} [surcharges] - Les champs a remplacer.
 * @returns {object} - La section.
 */
const section = (surcharges = {}) => ({
  key: 'eq-1',
  missing: [],
  notAnswered: [],
  participating: [],
  teamName: 'U15 Feminines',
  ...surcharges,
});

/**
 * Les libelles des boutons d action de la ligne.
 * @param {any} arbre - L arbre rendu.
 * @returns {string[]} - Les titres, dans l ordre de l arbre.
 */
const titresDesBoutons = (arbre) => arbre.root
  .findAllByType(Button)
  .map((/** @type {any} */ noeud) => noeud.props.title)
  .filter(Boolean);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('R7-d — un seul point d entree par joueur', () => {
  test('deja pointe : « Modifier » SEUL, aucun bouton de pointage a cote', () => {
    const arbre = monter({
      attendanceByUserId: {
        'p-deja': { arrivedAt: '2026-08-24T17:58:00.000Z', lateMinutes: 0 },
      },
      teamParticipationSections: [section({ participating: [P_DEJA_POINTE] })],
    });

    const titres = titresDesBoutons(arbre);

    expect(titres).toContain('Modifier');
    expect(titres).not.toContain("À l'heure");
    expect(titres).not.toContain('En retard');
  });

  test('« Modifier » ouvre la CORRECTION, pas le pointage', () => {
    const arbre = monter({
      attendanceByUserId: {
        'p-deja': { arrivedAt: '2026-08-24T17:58:00.000Z', lateMinutes: 0 },
      },
      teamParticipationSections: [section({ participating: [P_DEJA_POINTE] })],
    });

    const bouton = arbre.root
      .findAllByType(Button)
      .find((/** @type {any} */ noeud) => noeud.props.title === 'Modifier');

    act(() => { bouton.props.onPress(); });

    expect(onCoachEditLate).toHaveBeenCalledWith(P_DEJA_POINTE);
    expect(mockMarkCoachArrival).not.toHaveBeenCalled();
  });

  test('🔒 sans droit de gestion, AUCUN bouton d action n apparait', () => {
    const arbre = monter({
      canEdit: false,
      teamParticipationSections: [section({ participating: [P_A_POINTER] })],
    });

    const titres = titresDesBoutons(arbre);

    expect(titres).not.toContain("À l'heure");
    expect(titres).not.toContain('En retard');
    expect(titres).not.toContain('Modifier');
  });
});
