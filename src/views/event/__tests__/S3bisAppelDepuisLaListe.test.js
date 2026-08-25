import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import renderer, { act } from 'react-test-renderer';

import Button from '@/components/atoms/button/Button';

import EventParticipants from '../components/EventParticipants';

// ===========================================================================
// LOT S3-bis (vague S, 2026-08-25) — L APPEL SE FAIT SUR L ECRAN D APPEL.
//
// 🎯 LE RETOUR DE RECETTE D ADEL sur la 2.6.27, apres avoir valide les
// pastilles de S3 : « la vue du joueur est bien ; pour l entraineur par contre
// il faut cacher les boutons "a l heure" et "en retard", et sur la liste des
// participants, en haut, mettre un bouton "Faire l appel" qui envoie a
// l endroit pour faire l appel ».
//
// 🧭 CE QUE CA CORRIGE : la liste des participants est un ecran de
// LECTURE — qui vient, qui manque, qui est arrive. Pointer, c est un geste
// suivi, ligne apres ligne, et il a son ecran. Deux boutons par rangee
// melangeaient les deux, et faisaient de chaque rangee une micro-decision.
// Un seul bouton en haut mene la ou tout se fait.
//
// ⛔ LES PASTILLES DE S3 NE BOUGENT PAS : seuls les boutons d ACTION
// disparaissent. Le temoin (e) le prouve, parce qu une refonte de boutons qui
// emporterait les pastilles au passage serait invisible autrement.
// ===========================================================================

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

jest.mock('@/services/event/eventService', () => ({
  markCoachArrival: jest.fn(),
  markCoachArrivalBulk: jest.fn(),
  resetCoachAttendance: jest.fn(),
  updateCoachLateMinutes: jest.fn(),
}));

jest.mock('@/services/license/licenseQueries', () => ({
  useLicenseAssignments: () => ({ data: undefined, isLoading: false }),
}));

jest.mock('react-i18next', () => {
  const traductions = jest.requireActual('@/theme/strings/translations/fr').default;
  /**
   * Lit une clef pointee dans le VRAI dictionnaire francais.
   * @param {string} chemin - La clef.
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

const COULEURS = jest.requireActual('@/theme/colors').default();

const EVENEMENT_ID = 'evt-1';
const NOW_MS = Date.parse('2026-08-25T18:00:00.000Z');
const DEBUT_MS = NOW_MS - (12 * 60000);

const FAIRE_L_APPEL = 'Faire l’appel';

const joueur = (id, prenom) => ({
  documentId: id, firstname: prenom, id, lastname: 'Test',
});

const P_A_POINTER = joueur('p-a-pointer', 'Lena');
const P_DEJA_POINTE = joueur('p-deja', 'Alex');

const PROPS_BASE = {
  attendanceByUserId: {},
  canApprovePendingRequests: true,
  canEdit: true,
  event: { documentId: EVENEMENT_ID },
  eventStartAt: new Date(DEBUT_MS),
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
 * Les libelles de TOUS les boutons rendus.
 * @param {any} arbre - L arbre rendu.
 * @returns {string[]} - Les titres.
 */
const titresDesBoutons = (arbre) => arbre.root
  .findAllByType(Button)
  .map((/** @type {any} */ noeud) => noeud.props.title)
  .filter(Boolean);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('S3-bis — l appel se fait sur l ecran d appel, pas dans la liste', () => {
  test('l encadrant ne voit PLUS « À l\'heure » ni « En retard » sur les rangees', () => {
    const arbre = monter({
      teamParticipationSections: [section({ participating: [P_A_POINTER] })],
    });

    const titres = titresDesBoutons(arbre);

    expect(titres).not.toContain("À l'heure");
    expect(titres).not.toContain('En retard');
  });

  test('un bouton « Faire l’appel » apparait, et il MENE a l ecran d appel', () => {
    const arbre = monter({
      teamParticipationSections: [section({ participating: [P_A_POINTER] })],
    });

    const bouton = arbre.root
      .findAllByType(Button)
      .find((/** @type {any} */ noeud) => noeud.props.title === FAIRE_L_APPEL);

    expect(bouton).toBeTruthy();

    act(() => { bouton.props.onPress(); });

    // 🧭 La MEME destination que la carte de l Apercu, avec le meme
    // parametre : l ecran d appel est deja la, on y mene, on ne le refait pas.
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate.mock.calls[0][1]).toEqual({ eventId: EVENEMENT_ID });
  });

  test('🔒 le bouton est AVANT la liste, pas noye dedans', () => {
    const arbre = monter({
      teamParticipationSections: [section({ participating: [P_A_POINTER] })],
    });

    const titres = titresDesBoutons(arbre);

    // Le premier bouton rendu de l ecran : « en haut », comme demande.
    expect(titres[0]).toBe(FAIRE_L_APPEL);
  });

  test('🔒 la vue JOUEUR ne change pas : aucun bouton d appel, aucune action', () => {
    const arbre = monter({
      canEdit: false,
      teamParticipationSections: [section({ participating: [P_A_POINTER] })],
    });

    const titres = titresDesBoutons(arbre);

    expect(titres).not.toContain(FAIRE_L_APPEL);
    expect(titres).not.toContain("À l'heure");
    expect(titres).not.toContain('En retard');
    expect(titres).not.toContain('Modifier');
  });

  test('🔒 « Modifier » reste sur quelqu un de DEJA pointe', () => {
    // ⚠️ Adel a nomme deux boutons, pas trois. « Modifier » corrige une
    // erreur de saisie sans quitter la liste : le retirer serait une decision
    // qu il n a pas prise. Ce temoin fige ce choix pour qu il se voie.
    const arbre = monter({
      attendanceByUserId: {
        'p-deja': { arrivedAt: new Date(DEBUT_MS).toISOString(), lateMinutes: 0 },
      },
      teamParticipationSections: [section({ participating: [P_DEJA_POINTE] })],
    });

    expect(titresDesBoutons(arbre)).toContain('Modifier');
  });

  test('🔒 les pastilles de S3 sont INTACTES', () => {
    // 🕒 Coup d envoi DANS UNE HEURE : sans lui, celui qui n a pas ete
    // pointe tomberait sur « À pointer » (le retard vivant) au lieu de
    // « Prévu à l’heure » — ce sont deux sorties differentes de S3.
    const DEBUT_FUTUR_MS = NOW_MS + (60 * 60000);
    const arbre = monter({
      attendanceByUserId: {
        'p-deja': { arrivedAt: new Date(DEBUT_FUTUR_MS - (7 * 60000)).toISOString() },
      },
      eventStartAt: new Date(DEBUT_FUTUR_MS),
      teamParticipationSections: [section({ participating: [P_A_POINTER, P_DEJA_POINTE] })],
    });

    const pastilles = arbre.root
      .findAllByType(require('react-native').Text)
      .map((/** @type {any} */ noeud) => ({
        centre: (Array.isArray(noeud.props.style)
          ? noeud.props.style.flat(Infinity)
          : [noeud.props.style]
        ).filter(Boolean).find((/** @type {any} */ s) => s && s.textAlign === 'center'),
        noeud,
      }))
      .filter((/** @type {any} */ e) => Boolean(e.centre && e.centre.color))
      .map((/** @type {any} */ e) => ({
        couleur: e.centre.color,
        texte: String(e.noeud.props.children),
      }));

    const textes = pastilles.map((/** @type {any} */ p) => p.texte);
    expect(textes).toContain('Prévu à l’heure');
    expect(textes).toContain('7 min en avance');
    expect(pastilles.find((/** @type {any} */ p) => p.texte === 'Prévu à l’heure').couleur)
      .toBe(COULEURS.primary500);
  });
});
