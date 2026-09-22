import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import {
  buildParticipationsByStatus,
  buildTeamParticipationSections,
  getEventTrainerKeys,
} from '@/domains/event/eventParticipantSections';

import EventParticipants from '../components/EventParticipants';

// LOT MASQUE (22/09) — IDENTITES MASQUEES : LE TELEPHONE DISAIT « AUCUN
// PARTICIPANT » ALORS QUE DES GENS VIENNENT.
//
// 📸 LE DEFAUT (trouve par le lot ENCADRE) : quand l organisateur masque les
// identites, le serveur remplace chaque personne par un jeton anonyme SANS
// identifiant (`admin/src/utils/people-in-payload.ts`, `buildAnonymousUser` :
// `id` et `documentId` nuls). La fonction partagee range les gens par cle ;
// sans cle, tout le monde disparaissait ⇒ « Aucun participant confirme pour
// le moment. » et des tuiles 0 / 0 / 0, meme avec 3 presents.
//
// 🎯 Le serveur CONSERVE le nombre (un jeton par personne) : le telephone le
// relit. UN NOMBRE, JAMAIS UN NOM.
//
// 🪢 Comme ENCADRE, ce fichier branche la VRAIE fonction partagee sur le VRAI
// composant : c est la chaine entiere qui est prouvee. Harnais d AE02 / AD06 :
// vrai `fr.js` lu par `t`, vrai theme.

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
 * Un jeton anonyme, A LA FORME EXACTE de `buildAnonymousUser` cote serveur.
 * @param {string} liste - Le nom de la liste d origine (`participations`…).
 * @param {number} rang - Le rang dans cette liste, a partir de 1.
 * @returns {object} - Le jeton : aucun nom, aucun identifiant.
 */
const jeton = (liste, rang) => ({
  anonymousKey: `${liste}-${rang}`,
  avatar: null,
  documentId: null,
  firstname: null,
  id: null,
  isAnonymous: true,
  lastname: null,
});
const jetons = (/** @type {string} */ liste, /** @type {number} */ nombre) => Array.from(
  { length: nombre },
  (_, index) => jeton(liste, index + 1),
);

/**
 * L entrainement Senior tel qu un JOUEUR le recoit quand l organisateur masque
 * les identites : 15 joueurs, 2 encadrants, 3 presents, 1 absent — que des
 * jetons (`anonymizeEventParticipants`, `event-audience.ts`).
 * @param {object} [surcharges] - Les champs a remplacer.
 * @returns {any} - L evenement masque.
 */
const entrainementMasque = (surcharges = {}) => ({
  documentId: 'evt-senior',
  invitedTeams: [],
  missings: jetons('missings', 1),
  participantIdentitiesHidden: true,
  participations: jetons('participations', 3),
  team: {
    documentId: 'team-senior',
    name: 'Senior',
    players: jetons('team-players', 15),
    trainers: jetons('team-trainers', 2),
  },
  ...surcharges,
});

/**
 * Ce que `EventDetails.js` calcule pour un joueur (qui n organise pas).
 * @param {any} event - L evenement.
 * @returns {any} - Les props issues de la VRAIE fonction partagee.
 */
const calculer = (event) => {
  const trainerKeys = getEventTrainerKeys(event);
  return {
    ...buildTeamParticipationSections({
      canEdit: false,
      event,
      inactiveParticipations: [],
      pendingParticipations: [],
      t,
      trainerKeys,
    }),
    participationsByStatus: buildParticipationsByStatus({
      canEdit: false,
      event,
      pendingParticipations: [],
      trainerKeys,
    }),
  };
};

/**
 * Monte le VRAI composant, vu par un joueur.
 * @param {any} event - L evenement.
 * @returns {any} - L arbre rendu.
 */
const monter = (event) => {
  const {
    externalParticipationSection,
    participantsSummary,
    participationsByStatus,
    teamParticipationSections,
  } = calculer(event);
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
          canApprovePendingRequests={false}
          canEdit={false}
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
          participationsByStatus={participationsByStatus}
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

describe('MASQUE — identites masquees : un NOMBRE, jamais un nom', () => {
  test('MASQUE/1 — 3 presents masques : le telephone dit 3, pas « Aucun participant »', () => {
    const arbre = monter(entrainementMasque());
    const textes = textesVisibles(arbre);

    expect(textes).toContain('3 participants');
    expect(textes).not.toContain('Aucun participant confirme pour le moment.');
    expect(textes).toContain('Les identités des participants sont masquees par l organisateur.');
  });

  test('MASQUE/2 — tuiles et « N reponses sur M » : relus sur les listes recues', () => {
    const arbre = monter(entrainementMasque());

    expect(texteDuTestID(arbre, 'AD06-tuile-participating')).toBe('3 Présent·e·s');
    expect(texteDuTestID(arbre, 'AD06-tuile-missing')).toBe('1 Absent·e·s');
    // ponytail: 15 jetons de joueurs - 3 presents - 1 absent. Un encadrant
    // present est compte parmi les presents (le serveur ne le distingue pas).
    expect(texteDuTestID(arbre, 'AD06-tuile-notAnswered')).toBe('11 Sans réponse');
    expect(texteDuTestID(arbre, 'AD06-barre-legende')).toBe('4 réponses sur 15');
  });

  test('MASQUE/3 — pas un nom, pas une cle, pas une liste a fouiller', () => {
    const arbre = monter(entrainementMasque());
    const ecran = textesVisibles(arbre).join(' | ');

    expect(ecran).not.toMatch(/null|undefined|participations-|missings-|team-players-|team-trainers-/);
    expect(ecran).not.toContain('Staff');
    // Ni pastilles de filtre, ni barre de recherche : il n y a rien a fouiller.
    expect(arbre.root.findAll((/** @type {any} */ noeud) => String(noeud.props?.testID || '')
      .startsWith('P2-pastille-'))).toHaveLength(0);
    expect(arbre.root.findAll((/** @type {any} */ noeud) => String(noeud.props?.testID || '')
      .startsWith('COMPACT-rangee-'))).toHaveLength(0);
  });

  test('MASQUE/4 — le calcul partage : des nombres, et toutes les listes de noms VIDES', () => {
    const {
      externalParticipationSection,
      participantsSummary,
      teamParticipationSections,
    } = calculer(entrainementMasque({ capacity: 20 }));

    expect(participantsSummary.participatingCount).toBe(3);
    expect(participantsSummary.capacity).toBe(20);
    expect(participantsSummary.anonymousCounts).toEqual({
      missing: 1,
      notAnswered: 11,
      participating: 3,
    });
    expect(externalParticipationSection).toBeNull();
    const [senior] = teamParticipationSections;
    expect(senior.participating).toEqual([]);
    expect(senior.missing).toEqual([]);
    expect(senior.notAnswered).toEqual([]);
    expect(senior.staff).toEqual({ missing: [], notAnswered: [], participating: [] });
  });

  test('MASQUE/5 — identites VISIBLES : rien ne change (pas de compte anonyme)', () => {
    const joueur = (/** @type {number} */ n) => ({
      documentId: `joueur-${n}`,
      firstname: `Prenom${n}`,
      lastname: `Nom${n}`,
    });
    const { participantsSummary } = calculer({
      documentId: 'evt-senior',
      invitedTeams: [],
      missings: [joueur(2)],
      participations: [joueur(1)],
      team: {
        documentId: 'team-senior',
        name: 'Senior',
        players: [joueur(1), joueur(2), joueur(3)],
        trainers: [],
      },
    });

    expect(participantsSummary).toEqual({ capacity: 0, participatingCount: 1 });
    expect(participantsSummary.anonymousCounts).toBeUndefined();
  });
});
