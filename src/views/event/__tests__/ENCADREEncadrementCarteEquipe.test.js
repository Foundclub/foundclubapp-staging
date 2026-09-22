import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import {
  buildTeamParticipationSections,
  getEventTrainerKeys,
} from '@/domains/event/eventParticipantSections';

import EventParticipants from '../components/EventParticipants';

// LOT ENCADRE (22/09) — DECISION D ADEL « PARTWEB-1 → B » : LES ENTRAINEURS
// APPARAISSENT DANS UN GROUPE « ENCADREMENT » DE CHAQUE CARTE D EQUIPE.
//
// 📸 LE TROU : depuis COACH1 (21/09), un entraineur repond Present / Absent,
// et sa reponse ne se voyait nulle part sur un entrainement.
//
// 🪢 CE FICHIER BRANCHE LA VRAIE FONCTION PARTAGEE sur le VRAI composant : les
// sections ne sont pas ecrites a la main, elles sortent de
// `buildTeamParticipationSections`, exactement comme dans `EventDetails.js`.
// C est ce qui prouve la chaine entiere — le calcul ET son affichage.
//
// 🔒 CE QUI NE DOIT PAS BOUGER (decisions d Adel du 21/09) : les 3 tuiles, la
// barre « N reponses sur M » et le bouton « Relancer » restent ceux des
// JOUEURS (2-A, relance A).
//
// 🔬 Le harnais est celui d AE02 / AD06 : vrai `fr.js` lu par `t`, vrai theme.

// Conditions de demarrage : memes doublures qu AE02 (voir ses commentaires).
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

const NOW_MS = Date.parse('2026-09-22T16:00:00.000Z');
const t = (/** @type {string} */ _clef, /** @type {string} */ repli) => repli;

/**
 * Fabrique un joueur minimal.
 * @param {number} n - Le numero du joueur.
 * @returns {object} - Le joueur.
 */
const joueur = (n) => ({ documentId: `joueur-${n}`, firstname: `Prenom${n}`, lastname: `Nom${n}` });
const quinzeJoueurs = Array.from({ length: 15 }, (_, index) => joueur(index + 1));
const COACH = { documentId: 'coach-1', firstname: 'Coach', lastname: 'Senior' };
const ADJOINT = { documentId: 'coach-2', firstname: 'Adjoint', lastname: 'Senior' };

/**
 * L entrainement Senior d Adel : 15 joueurs, deux encadrants.
 * @param {object} [surcharges] - Les champs a remplacer.
 * @returns {any} - L evenement.
 */
const entrainementSenior = (surcharges = {}) => ({
  documentId: 'evt-senior',
  invitedTeams: [],
  missings: [],
  participations: [],
  team: {
    documentId: 'team-senior',
    name: 'Senior',
    players: quinzeJoueurs,
    trainers: [COACH, ADJOINT],
  },
  ...surcharges,
});

/**
 * Monte le VRAI composant avec les sections de la VRAIE fonction partagee.
 * @param {any} event - L evenement.
 * @returns {any} - L arbre rendu.
 */
const monter = (event) => {
  const {
    externalParticipationSection,
    participantsSummary,
    teamParticipationSections,
  } = buildTeamParticipationSections({
    canEdit: true,
    event,
    inactiveParticipations: [],
    pendingParticipations: [],
    t,
    trainerKeys: getEventTrainerKeys(event),
  });
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <QueryClientProvider client={queryClient}>
        <EventParticipants
          attendanceByUserId={{}}
          canApprovePendingRequests
          canEdit
          event={event}
          eventStartAt={null}
          externalParticipationSection={externalParticipationSection}
          handleExportParticipants={jest.fn()}
          handleRemindPlayers={jest.fn()}
          handleShare={jest.fn()}
          handleUpdateParticipation={jest.fn()}
          handleUserPress={jest.fn()}
          nowMs={NOW_MS}
          onCoachEditLate={jest.fn()}
          participantsSummary={participantsSummary}
          participationsByStatus={undefined}
          pendingParticipations={[]}
          teamParticipationSections={teamParticipationSections}
        />
      </QueryClientProvider>,
    );
  });
  return arbre;
};

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
   * @returns {void}
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

/**
 * Le texte d un noeud designe par son `testID` (le premier trouve).
 * @param {any} arbre - L arbre rendu.
 * @param {string} testID - L identifiant.
 * @returns {string} - Son texte.
 */
const texteDuTestID = (arbre, testID) => texteDe(
  arbre.root.findAll((/** @type {any} */ noeud) => noeud.props?.testID === testID)[0],
);

/**
 * La pastille de reponse d une personne (« Présent », « Absent »…).
 * @param {any} arbre - L arbre rendu.
 * @param {string} documentId - La personne.
 * @returns {string} - Le texte de sa pastille.
 */
const pastilleDe = (arbre, documentId) => texteDuTestID(arbre, `COMPACT-pastille-${documentId}`);

describe('ENCADRE — l Encadrement de chaque carte d equipe, sur le telephone', () => {
  test('ENCADRE écran/1 — coach Present : sous « Encadrement », apres les joueurs', () => {
    const arbre = monter(entrainementSenior({
      missings: [joueur(2)],
      participations: [COACH, joueur(1)],
    }));
    const textes = textesVisibles(arbre);

    const encadrement = textes.indexOf('Staff');
    expect(encadrement).toBeGreaterThan(-1);
    // Apres les trois groupes des joueurs : le dernier joueur « Sans réponse » est au-dessus.
    expect(encadrement).toBeGreaterThan(textes.lastIndexOf('Prenom15 Nom15'));
    expect(textes.indexOf('Coach Senior')).toBeGreaterThan(encadrement);
    expect(textes.indexOf('Adjoint Senior')).toBeGreaterThan(encadrement);
    expect(pastilleDe(arbre, 'coach-1')).toBe('Présent');
    expect(pastilleDe(arbre, 'coach-2')).toBe('Sans réponse');
    // Une seule RANGEE par encadrant : il n est dans aucune liste de joueurs.
    // (On compte les rangees, pas les textes : `MarqueeText` rend chaque nom
    // deux fois, une copie sert a mesurer.)
    const rangeesDuCoach = arbre.root.findAll(
      (/** @type {any} */ noeud) => typeof noeud.type === 'string'
        && noeud.props?.testID === 'COMPACT-rangee-coach-1',
    );
    expect(rangeesDuCoach).toHaveLength(1);
  });

  test('ENCADRE écran/2 — tuiles et « N réponses sur M » : les JOUEURS seuls (2-A)', () => {
    const arbre = monter(entrainementSenior({
      missings: [ADJOINT, joueur(2)],
      participations: [COACH, joueur(1)],
    }));

    expect(texteDuTestID(arbre, 'AD06-tuile-participating')).toBe('1 Présent·e·s');
    expect(texteDuTestID(arbre, 'AD06-tuile-missing')).toBe('1 Absent·e·s');
    expect(texteDuTestID(arbre, 'AD06-tuile-notAnswered')).toBe('13 Sans réponse');
    expect(texteDuTestID(arbre, 'AD06-barre-legende')).toBe('2 réponses sur 15');
    expect(pastilleDe(arbre, 'coach-2')).toBe('Absent');
  });

  test('ENCADRE écran/3 — joueurs tous repondus, coach non : AUCUN « Relancer »', () => {
    const arbre = monter(entrainementSenior({ participations: quinzeJoueurs }));
    const textes = textesVisibles(arbre);

    expect(textes).not.toContain('Relancer');
    expect(textes).toContain('Tout le monde a répondu.');
    expect(pastilleDe(arbre, 'coach-1')).toBe('Sans réponse');
  });

  test('ENCADRE écran/4 — identites masquees : ni « Encadrement », ni un nom', () => {
    const arbre = monter(entrainementSenior({
      participantIdentitiesHidden: true,
      participations: [COACH, joueur(1)],
    }));
    const textes = textesVisibles(arbre);

    expect(textes).not.toContain('Staff');
    expect(textes).not.toContain('Coach Senior');
    expect(textes).not.toContain('Prenom1 Nom1');
  });

  test('ENCADRE écran/5 — pastille « Présents » : coach present garde ; « Absents » : non', () => {
    const arbre = monter(entrainementSenior({
      missings: [ADJOINT],
      participations: [COACH, joueur(1)],
    }));
    const appuyer = (/** @type {string} */ testID) => act(() => {
      arbre.root.findAll((/** @type {any} */ noeud) => noeud.props?.testID === testID
        && typeof noeud.props?.onPress === 'function')[0].props.onPress();
    });

    appuyer('P2-pastille-participating');
    let textes = textesVisibles(arbre);
    expect(textes).toContain('Coach Senior');
    expect(textes).not.toContain('Adjoint Senior');

    appuyer('P2-pastille-missing');
    textes = textesVisibles(arbre);
    expect(textes).not.toContain('Coach Senior');
    expect(textes).toContain('Adjoint Senior');
  });
});
