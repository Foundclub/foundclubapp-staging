/* eslint-disable max-len -- les libellés du design se lisent en entier. */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import fabriquerLesCouleurs from '@/theme/colors';

import EventParticipants from '../components/EventParticipants';

// FINITIONS11-STATS · point 3 (écran 2, état 3, planche « Absent à l'appel — téléphone ») —
// CE QUE VOIT L'ENTRAÎNEUR dans Participants, après l'appel :
//   · l'absent pointé est rangé sous « Absent·e·s · N » (il restait sous « Présent·e·s », rangé
//     par sa réponse d'avant) ;
//   · sa pastille est ORANGE (l'appel peut se tromper), et non rouge ;
//   · l'heure du pointage s'écrit « sam. 18:55 » (le jour, puis l'heure).
// Les tuiles et les filtres lisent les mêmes listes : ils comptent l'absent pointé comme absent.

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

const COULEURS = fabriquerLesCouleurs();

const KYLIAN = {
  documentId: 'present', firstname: 'Kylian', id: 31, lastname: 'D',
};
const HUGO = {
  documentId: 'absent-appel', firstname: 'Hugo', id: 34, lastname: 'L',
};
const LINA = {
  documentId: 'absent-declare', firstname: 'Lina', id: 35, lastname: 'B',
};
const NOE = {
  documentId: 'sans-reponse-pointe', firstname: 'Noé', id: 36, lastname: 'R',
};

// Samedi 5 septembre 2026, pointé à 16:55 UTC.
const POINTE_A = '2026-09-05T16:55:00.000Z';
const DEBUT = Date.parse('2026-09-05T16:00:00.000Z');

const absentALAppel = (/** @type {string} */ rsvpStatus) => ({
  attendanceStatus: 'no_show',
  finalizedAt: POINTE_A,
  finalOperationalStatus: 'absent',
  rsvpStatus,
  source: 'coach_manual',
});

const PRESENCES = {
  [HUGO.documentId]: absentALAppel('participating'),
  [KYLIAN.documentId]: {
    arrivedAt: '2026-09-05T15:55:00.000Z',
    attendanceStatus: 'arrived_on_time',
    finalOperationalStatus: 'present',
    rsvpStatus: 'participating',
  },
  [LINA.documentId]: {
    finalOperationalStatus: 'absent',
    rsvpStatus: 'missing',
  },
  [NOE.documentId]: absentALAppel('not_answered'),
};

const proprietes = (/** @type {any} */ surcharges = {}) => ({
  attendanceByUserId: PRESENCES,
  canEdit: true,
  event: { documentId: 'evt-1' },
  eventStartAt: new Date(DEBUT),
  handleExportParticipants: jest.fn(),
  handleRemindPlayers: jest.fn(),
  handleShare: jest.fn(),
  handleUpdateParticipation: jest.fn(),
  handleUserPress: jest.fn(),
  nowMs: DEBUT + 3 * 60 * 60 * 1000,
  onCoachEditLate: jest.fn(),
  onCoachMarkPresent: jest.fn(),
  participantsSummary: { participatingCount: 2 },
  participationsByStatus: {
    missing: [LINA],
    notAnswered: [NOE],
    participating: [KYLIAN, HUGO],
  },
  pendingParticipations: [],
  rouvreLeQuestionnaire: true,
  teamParticipationSections: [],
  ...surcharges,
});

const SECTION_U15 = {
  allowCoachActions: true,
  historical: {},
  isHome: true,
  key: 'team-u15',
  missing: [LINA],
  notAnswered: [NOE],
  participating: [KYLIAN, HUGO],
  pending: [],
  staff: {},
  teamName: 'U15',
};

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

const TITRE = 'eventDetails.participationStatus.';

/**
 * Les titres de groupe et les rangées, dans l'ordre de l'écran.
 * @param {any} arbre - Le rendu.
 * @returns {string[]} « titre:… » ou « rangee:<documentId> ».
 */
const ordreBrut = (/** @type {any} */ arbre) => arbre.root.findAll((/** @type {any} */ noeud) => (
  (noeud.type === Text && typeof noeud.props.children === 'string' && noeud.props.children.startsWith(TITRE))
  || (typeof noeud.props?.testID === 'string' && noeud.props.testID.startsWith('COMPACT-rangee-') && typeof noeud.type === 'string')
)).map((/** @type {any} */ noeud) => (noeud.type === Text
  ? `titre:${noeud.props.children.slice(TITRE.length)}`
  : `rangee:${noeud.props.testID.slice('COMPACT-rangee-'.length)}`));
// Les tuiles et les pastilles de filtre portent aussi ces titres : la liste commence au titre
// du premier groupe qui a une rangée.
const ordre = (/** @type {any} */ arbre) => {
  const liste = ordreBrut(arbre);
  return liste.slice(liste.findIndex((element) => element.startsWith('rangee:')) - 1);
};

const pastilleDe = (/** @type {any} */ arbre, /** @type {string} */ documentId) => {
  const rangee = arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === `COMPACT-rangee-${documentId}`)[0];
  return rangee.findAllByType(Text).find((/** @type {any} */ n) => n.props.children === 'Absent à l’appel');
};

const jourEtHeure = (/** @type {string} */ iso) => {
  const date = new Date(iso);
  return `${date.toLocaleDateString('fr-FR', { weekday: 'short' })} ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
};

const couleurDe = (/** @type {any} */ noeud) => [].concat(noeud.props.style)
  .flat(Infinity)
  .reduce((/** @type {any} */ acc, /** @type {any} */ s) => ({ ...acc, ...(s || {}) }), {}).color;

describe('FINITIONS11 · point 3 — l absent pointé à l appel, chez l entraîneur', () => {
  test('1 · 🔴 liste sans équipes : Hugo (il avait dit « présent ») et Noé (sans réponse) sont rangés sous « Absent·e·s · 3 »', async () => {
    const arbre = await monter(proprietes());

    expect(ordre(arbre)).toEqual([
      'titre:participating',
      'rangee:present',
      'titre:missing · 3',
      'rangee:absent-declare',
      'rangee:absent-appel',
      'rangee:sans-reponse-pointe',
    ]);
  });

  test('2 · 🔴 carte d équipe : le même rangement, et les tuiles comptent l absent pointé comme absent', async () => {
    const arbre = await monter(proprietes({ participationsByStatus: undefined, teamParticipationSections: [SECTION_U15] }));

    expect(ordre(arbre)).toEqual([
      'titre:participating',
      'rangee:present',
      'titre:missing · 3',
      'rangee:absent-declare',
      'rangee:absent-appel',
      'rangee:sans-reponse-pointe',
    ]);
    const tuile = (/** @type {string} */ id) => arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === id)[0]
      .findAllByType(Text).map((/** @type {any} */ n) => n.props.children);
    expect(tuile('AD06-tuile-participating')).toContain('1');
    expect(tuile('AD06-tuile-missing')).toContain('3');
  });

  test('3 · 🔴 la pastille « Absent à l’appel » est ORANGE (warning400), plus rouge', async () => {
    const arbre = await monter(proprietes());
    const pastille = pastilleDe(arbre, HUGO.documentId);

    expect(couleurDe(pastille)).toBe(COULEURS.warning400);
    expect(couleurDe(pastille)).not.toBe(COULEURS.error500);
  });

  test('4 · 🔴 l heure du pointage : « sam. 18:55 » (le jour, puis l heure)', async () => {
    const arbre = await monter(proprietes());
    const rangee = arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === `COMPACT-rangee-${HUGO.documentId}`)[0];
    const lus = rangee.findAllByType(Text).map((/** @type {any} */ n) => n.props.children);

    expect(jourEtHeure(POINTE_A)).toMatch(/^sam\. \d{2}:\d{2}$/);
    expect(lus).toContain(jourEtHeure(POINTE_A));
  });

  // FINITIONS13-STATS · point 6 (T12, photo F11S_3) — « Hugo L… », « Absent … », et l heure
  // invisible : le nom, la pastille et le bouton « Présent » se partageaient UNE ligne. La planche
  // (« Absent à l'appel », état 3) n a pas de pastille : le nom en entier, et dessous, en une
  // seconde ligne, « Absent à l'appel · sam. 18:55 ».
  test('6 · 🔴 FIN13 — plus de pastille : « Absent à l’appel » et l heure se lisent SOUS le nom', async () => {
    const arbre = await monter(proprietes());
    const parId = (/** @type {string} */ id) => arbre.root
      .findAll((/** @type {any} */ n) => n.props?.testID === id);

    expect(parId(`COMPACT-pastille-${HUGO.documentId}`)).toHaveLength(0);
    const identite = parId(`FIN13-identite-${HUGO.documentId}`)[0];
    expect(identite).toBeDefined();
    const lus = identite.findAllByType(Text).map((/** @type {any} */ n) => n.props.children);
    expect(lus).toEqual(expect.arrayContaining(['Absent à l’appel', jourEtHeure(POINTE_A)]));
    // La seconde ligne vit DANS la colonne du nom, et vient APRES lui : l heure ferme la colonne.
    // ⚠️ Comparer des valeurs simples : un echec qui afficherait deux noeuds du rendu sature la
    // memoire de jest.
    const seconde = parId(`FIN13-ligne-absent-${HUGO.documentId}`)[0];
    expect(identite.findAll((/** @type {any} */ n) => n === seconde).length).toBe(1);
    expect(lus[lus.length - 1]).toBe(jourEtHeure(POINTE_A));
  });

  test('7 · 🔒 FIN13 — les autres rangées gardent leur pastille', async () => {
    const arbre = await monter(proprietes());

    expect(arbre.root.findAll((/** @type {any} */ n) => (
      typeof n.props?.testID === 'string' && n.props.testID.startsWith('COMPACT-pastille-')
    )).length).toBeGreaterThan(0);
  });

  // 🐞 BUGHUNT P7-06 (BH06) — la section « Participants externes » ne passait pas par le rangement.
  test('8 · 🔴 P7-06 — participants externes : Hugo pointé absent quitte « Présent·e·s »', async () => {
    const arbre = await monter(proprietes({
      externalParticipationSection: {
        ...SECTION_U15,
        isExternal: true,
        key: 'external-participants',
        teamName: 'Participants externes',
      },
      participationsByStatus: undefined,
    }));

    expect(ordre(arbre)).toEqual([
      'titre:participating',
      'rangee:present',
      'titre:missing · 3',
      'rangee:absent-declare',
      'rangee:absent-appel',
      'rangee:sans-reponse-pointe',
    ]);
  });

  test('5 · 🔒 personne pointé absent : les groupes gardent leur titre d avant (pas de « · N » sur un groupe vide)', async () => {
    const arbre = await monter(proprietes({
      attendanceByUserId: { [KYLIAN.documentId]: PRESENCES[KYLIAN.documentId] },
      participationsByStatus: { missing: [], notAnswered: [], participating: [KYLIAN, HUGO] },
    }));

    expect(ordre(arbre)).toEqual([
      'titre:participating',
      'rangee:present',
      'rangee:absent-appel',
      'titre:missing',
    ]);
  });
});
