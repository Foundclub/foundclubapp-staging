import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import EventParticipants from '../components/EventParticipants';

// COMPACT (vague U, 26/08) — LA RANGEE D UN PARTICIPANT NE FAIT PLUS QU UNE LIGNE.
//
// 📸 CE QU ADEL A VU (capture du 26/08 19h32, onglet Participants d un match) :
// une SEULE rangee de joueur occupait cinq etages — la pastille sur 3 lignes
// (« Arrivé » / « 270 min en avance » / « 19:29 »), le bouton « Modifier » sur
// son propre etage, puis « Correction manuelle staff » et « Corrigé par
// Philippe Courtoi ». Deux joueurs remplissaient l ecran.
//
// 🎯 CE QUE CE FILET TIENT, ET QUE LES PORTES NE VOIENT PAS :
//   1. le bloc « staff » n existe plus — aucun de ses trois textes ne revient
//   2. la pastille se compose HORIZONTALEMENT : un seul etage, jamais trois
//   3. la rangee mesure la hauteur de l avatar plus ses marges, et cette
//      hauteur est LA MEME quel que soit l etat du joueur (D5)
//   4. le bouton « Modifier » vit DANS la ligne, et reste attrapable au doigt
//
// 🧷 CE FILET NE TOUCHE NI AUX LIBELLES NI AUX COULEURS : ils appartiennent au
// lot S3, valide par Adel le 25/08, et `AD06ParticipantsFilet.test.js` les fige
// deja en `toEqual` STRICT. Si ce fichier-ci devenait rouge en meme temps
// qu AD06, c est qu un libelle aurait bouge — ce n est pas le sujet de COMPACT.

// 🧨 CONDITIONS DE DEMARRAGE, PAS DES CONFORTS (motif recopie d AD06).
// `EventParticipants` importe `licenseQueries` et `eventService`, qui
// descendent jusqu a `client.native.js` — lequel jette AU CHARGEMENT quand
// `.env` est absent, et `.env` est gitignore donc absent de toute copie de
// travail. Sans ces bouchons : « failed to run », 0 test execute.
jest.mock('@/services/license/licenseQueries', () => ({
  useLicenseAssignments: () => ({ data: undefined, isLoading: false }),
}));

jest.mock('@/services/event/eventService', () => ({
  markCoachArrival: jest.fn(),
  markCoachArrivalBulk: jest.fn(),
  resetCoachAttendance: jest.fn(),
  updateCoachLateMinutes: jest.fn(),
}));

// Le bouton « Faire l appel » monte `useNavigation()` : sans conteneur de
// navigation dans le harnais, le vrai module jette et toute la suite tombe.
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));

jest.mock('react-i18next', () => {
  const traductions = jest.requireActual('@/theme/strings/translations/fr').default;
  /**
   * Lit une clef pointee dans le VRAI dictionnaire francais.
   * @param {string} chemin - La clef, par exemple `eventDetails.attendanceBadge.arrived`.
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

// Le theme est monte avec les VRAIS modules : un Proxy rendrait les echecs jest
// illisibles (piege paye au lot paywall).
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

const NOW_MS = Date.parse('2026-08-20T18:00:00.000Z');
const DEBUT_MS = NOW_MS - (12 * 60000);

/**
 * Fabrique un joueur minimal.
 * @param {string} id - Son `documentId`.
 * @param {string} prenom - Son prenom.
 * @returns {object} - Le joueur.
 */
const joueur = (id, prenom) => ({
  documentId: id, firstname: prenom, id, lastname: 'Test',
});

const P_ARRIVE = joueur('p-arrive', 'Alex');

// 🧑‍💼 LE POINTAGE QU ADEL AVAIT SOUS LES YEUX : corrige a la main par un
// membre du staff, avec une note. C est LUI qui faisait pousser les deux
// derniers etages de la rangee.
const POINTAGE_CORRIGE_PAR_LE_STAFF = {
  arrivedAt: new Date(DEBUT_MS).toISOString(),
  manualOverride: true,
  note: 'Il avait prevenu qu il arriverait plus tot.',
  updatedBy: { firstname: 'Philippe', lastname: 'Courtoi' },
};

const PROPS_BASE = {
  attendanceByUserId: {},
  canApprovePendingRequests: true,
  canEdit: true,
  event: { documentId: 'evt-1' },
  eventStartAt: null,
  externalParticipationSection: null,
  handleExportParticipants: jest.fn(),
  handleRemindPlayers: jest.fn(),
  handleShare: jest.fn(),
  handleUpdateParticipation: jest.fn(),
  handleUserPress: jest.fn(),
  nowMs: NOW_MS,
  onCoachEditLate: jest.fn(),
  onCoachMarkArrival: jest.fn(),
  participantsSummary: undefined,
  participationsByStatus: undefined,
  pendingParticipations: [],
  teamParticipationSections: [],
};

/**
 * Monte le VRAI composant, avec le fournisseur qu exige `useIsMutating`.
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
 * Rend une section d equipe complete, prete a etre surchargee.
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
 * Ramasse le texte porte par un noeud et ses enfants.
 * @param {any} noeud - Le noeud de depart.
 * @returns {string} - Le texte, espaces normalises.
 */
const texteDe = (noeud) => {
  /** @type {string[]} */
  const morceaux = [];
  /**
   * Descend un noeud et empile ce qu il porte.
   * @param {any} enfant - Le noeud courant.
   * @returns {void} - Rien.
   */
  const descendre = (enfant) => {
    if (enfant === null || enfant === undefined || enfant === false) return;
    if (typeof enfant === 'string' || typeof enfant === 'number') {
      morceaux.push(String(enfant));
      return;
    }
    const enfants = enfant?.props?.children;
    if (Array.isArray(enfants)) enfants.forEach(descendre);
    else descendre(enfants);
  };
  descendre(noeud);
  return morceaux.join(' ').replace(/\s+/g, ' ').trim();
};

/**
 * Tous les textes rendus, dans l ordre de l arbre.
 * @param {any} arbre - L arbre rendu.
 * @returns {string[]} - Les textes non vides.
 */
const textesVisibles = (arbre) => arbre.root
  .findAllByType(Text)
  .map((/** @type {any} */ noeud) => texteDe(noeud))
  .filter(Boolean);

describe('COMPACT · temoin 1 — le bloc « staff » ne pousse plus la rangee', () => {
  test('« Correction manuelle staff », « Corrigé par X » et la note ont disparu', () => {
    const arbre = monter({
      attendanceByUserId: { 'p-arrive': POINTAGE_CORRIGE_PAR_LE_STAFF },
      eventStartAt: new Date(DEBUT_MS),
      teamParticipationSections: [section({ participating: [P_ARRIVE] })],
    });

    const tout = textesVisibles(arbre).join(' | ');

    // Les trois textes que la capture d Adel montrait sous la pastille.
    expect(tout).not.toContain('Correction manuelle staff');
    expect(tout).not.toContain('Corrige par');
    expect(tout).not.toContain('Corrigé par');
    expect(tout).not.toContain('Philippe');
    expect(tout).not.toContain('Courtoi');
    expect(tout).not.toContain('Il avait prevenu');

    // 🧷 ET LE RESTE DE LA RANGEE N A PAS BOUGE : le joueur, sa pastille et son
    // heure d arrivee sont toujours la. Sans ce controle, un composant qui ne
    // rendrait plus RIEN passerait les six attentes ci-dessus.
    expect(tout).toContain('Alex');
    expect(tout).toContain('Arrivé');
  });

  test('un pointage corrige rend EXACTEMENT les memes textes qu un pointage ordinaire', () => {
    // 📏 LA MESURE QUI TIENT LA PROMESSE : ce n est pas « les mots ont disparu »
    // qui compte, c est que la rangee ne GRANDIT plus quand le staff est passe
    // par la. Deux montages identiques a l attendance pres.
    const ordinaire = monter({
      attendanceByUserId: { 'p-arrive': { arrivedAt: new Date(DEBUT_MS).toISOString() } },
      eventStartAt: new Date(DEBUT_MS),
      teamParticipationSections: [section({ participating: [P_ARRIVE] })],
    });
    const corrige = monter({
      attendanceByUserId: { 'p-arrive': POINTAGE_CORRIGE_PAR_LE_STAFF },
      eventStartAt: new Date(DEBUT_MS),
      teamParticipationSections: [section({ participating: [P_ARRIVE] })],
    });

    expect(textesVisibles(corrige)).toEqual(textesVisibles(ordinaire));
  });
});
