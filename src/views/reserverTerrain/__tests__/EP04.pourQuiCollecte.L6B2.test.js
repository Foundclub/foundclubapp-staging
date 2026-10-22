import renderer, { act } from 'react-test-renderer';

import ReserverRecapitulatif from '@/views/reserverTerrain/ReserverRecapitulatif';

import { RouteNames } from '@/navigation/routeNames';

import { lisibles, parRepere, pressable } from '@/testSupport/temoinComplexe';
import { complexePublic, maReservation, recapitulatif } from '@/testSupport/temoinReserver';

// RESA-L6B-2 (20/10/2026) — E-P04, ce que le serveur RESA-L3 ouvre (planche EP04 états 2 et 3 ;
// plan E-P04 blocs 2 et 4 ; A-P04, A-P07, RC-P05, Q3, AT-03 B) :
//   · « Pour qui ? » — seulement pour un encadrant MAJEUR d'au moins une équipe : « Pour moi » /
//     « Pour mon équipe », la liste de ses équipes, et le bandeau d'AT-03 B (« l'âge minimum du
//     complexe ne vaut que pour toi ; les 14 joueurs de l'équipe sont ajoutés ») que le serveur
//     confirme (récapitulatif `dryRun` avec `team`) ;
//   · la collecte — « Réserver seulement quand assez de joueurs ont répondu présent » : le nombre
//     requis (toi compris), la date limite bornée par le complexe (le serveur rend la plus
//     tardive),
//     « le créneau reste libre » (A-P08), et « Lancer la collecte ».
// Le serveur juge tout (RG-SECU) : l'app n'envoie que `team`, `quorum`, `collectDeadline` en plus.

// Un écran entier monté : sous charge (suite complète, PC occupé), le premier cas paie le
// chargement des modules et dépassait les 5 s par défaut (motif de COLL-CONSOLE, 02/10).
jest.setTimeout(30000);

const mockNavigate = jest.fn();
const mockReplace = jest.fn();
const mockGoBack = jest.fn();
let mockParams = /** @type {any} */ ({});
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack, navigate: mockNavigate, replace: mockReplace }),
  useRoute: () => ({ params: mockParams }),
}));

const mockReserver = jest.fn();
const mockApercu = jest.fn();
jest.mock('@/services/complexe/complexeJoueurQueries', () => ({
  useApercuDeReservation: () => ({ isPending: false, mutateAsync: mockApercu }),
  useComplexePublic: () => ({
    data: jest.requireActual('@/testSupport/temoinReserver').complexePublic(),
  }),
  useReserverUnCreneau: () => ({ isPending: false, mutateAsync: mockReserver }),
}));

const EQUIPE_U15 = {
  club: { documentId: 'club-usv', name: 'US Valbrune' },
  documentId: 'team-u15',
  name: 'U15 Valbrune',
};
let mockUtilisateur = /** @type {any} */ ({});
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: mockUtilisateur }),
}));

jest.mock('@/responsive', () => ({ useIsDesktop: () => false }));
jest.mock(
  '@/components/templates/ScreenContainer',
  () => function FauxConteneur(/** @type {any} */ { children }) {
    return children;
  },
);
jest.mock(
  'react-i18next',
  () => jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next,
);
jest.mock('@/theme/themeContext', () => (
  jest.requireActual('@/testSupport/temoinComplexe').themeDeTemoin()
));

// Une partie l'an prochain : les échéances proposées restent à venir, quel que soit le jour.
const PARTIE = {
  date: '2027-03-11',
  endsAt: '2027-03-11T18:00:00.000Z',
  from: '18:00',
  startsAt: '2027-03-11T17:00:00.000Z',
  to: '19:00',
};
const PLUS_TARD = '2027-03-10T17:00:00.000Z';

/**
 * Monte l'écran, et laisse passer une lecture éventuelle.
 * @returns {Promise<any>} L'arbre.
 */
const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<ReserverRecapitulatif />);
  });
  await act(async () => {
    await Promise.resolve();
  });
  return arbre;
};

/**
 * Le bouton dont le titre est EXACTEMENT celui-ci (RESA-L6B-2 : « Réserver seulement quand assez
 * de joueurs ont répondu présent » contient aussi « Réserver »).
 * @param {any} arbre - L'arbre.
 * @param {string} titre - Le titre.
 * @returns {any} Le bouton ; lève une erreur s'il n'existe pas.
 */
const bouton = (arbre, titre) => {
  const trouves = arbre.root.findAll((/** @type {any} */ noeud) => (
    noeud.props?.title === titre && typeof noeud.props?.onPress === 'function'
  ));
  if (!trouves.length) throw new Error(`Aucun bouton « ${titre} »`);
  return trouves[0];
};

/**
 * Appuie sur un nœud.
 * @param {any} noeud - Le nœud.
 * @returns {Promise<void>} Fini.
 */
const toucher = async (noeud) => {
  await act(async () => {
    noeud.props.onPress();
  });
  await act(async () => {
    await Promise.resolve();
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUtilisateur = {
    birthdate: '1985-04-02', documentId: 'u-coach', trainedTeams: [EQUIPE_U15],
  };
  mockParams = {
    apercu: recapitulatif(PARTIE),
    date: PARTIE.date,
    from: PARTIE.from,
    slug: 'le-five-de-montrivage',
    terrainId: 't-1',
  };
  mockReserver.mockResolvedValue(maReservation(PARTIE));
  mockApercu.mockImplementation(async (/** @type {any} */ demande) => recapitulatif({
    ...PARTIE,
    ...(demande.team ? { equipe: { membres: 14, name: 'U15 Valbrune' } } : {}),
    ...(demande.quorum ? {
      collecte: {
        collectDeadline: demande.collectDeadline,
        latestDeadline: PLUS_TARD,
        quorum: demande.quorum,
      },
      willBe: 'en_collecte',
    } : {}),
  }));
});

describe('E-P04 — « Pour qui ? » (A-P04, AT-03 B)', () => {
  it('un encadrant majeur : « Pour moi » choisi d’emblée, « Pour mon équipe » à côté', async () => {
    const arbre = await monter();
    expect(lisibles(arbre))
      .toEqual(expect.arrayContaining(['Pour qui ?', 'Pour moi', 'Pour mon équipe']));
    expect(parRepere(arbre, 'reserver-pour-moi').props.accessibilityState)
      .toEqual({ checked: true });
    expect(lisibles(arbre)).not.toContain('U15 Valbrune');
  });

  it('pas d’équipe encadrée, ou un encadrant mineur : le bloc n’existe pas', async () => {
    mockUtilisateur = { birthdate: '1985-04-02', documentId: 'u-1' };
    expect(lisibles(await monter())).not.toContain('Pour qui ?');
    mockUtilisateur = { birthdate: '2010-04-02', documentId: 'u-2', trainedTeams: [EQUIPE_U15] };
    expect(lisibles(await monter())).not.toContain('Pour qui ?');
  });

  it('« Pour mon équipe » : choisir, le serveur confirme, le bandeau AT-03 B', async () => {
    const arbre = await monter();
    await toucher(parRepere(arbre, 'reserver-pour-equipe'));
    expect(lisibles(arbre)).toEqual(expect.arrayContaining(['U15 Valbrune', 'US Valbrune']));
    await toucher(parRepere(arbre, 'reserver-equipe-team-u15'));
    expect(mockApercu).toHaveBeenCalledWith(expect.objectContaining({
      date: PARTIE.date, from: PARTIE.from, team: 'team-u15', terrain: 't-1',
    }));
    expect(lisibles(arbre)).toContain(
      'Tu encadres U15 Valbrune : l’âge minimum du complexe (16 ans) ne vaut que pour toi. '
        + 'Les 14 joueurs de l’équipe sont ajoutés.',
    );
    await toucher(bouton(arbre, 'Réserver'));
    expect(mockReserver).toHaveBeenCalledWith(expect.objectContaining({ team: 'team-u15' }));
    expect(mockReplace).toHaveBeenCalledWith(RouteNames.ReserverResultat, expect.objectContaining({
      equipe: { membres: 14, name: 'U15 Valbrune' },
    }));
  });

  it('équipe refusée : sa phrase, rien ne part sans équipe admise', async () => {
    mockApercu.mockRejectedValueOnce({
      details: { code: 'COMPLEXE_RESERVATION_EQUIPE' },
      message: 'Tu n’encadres pas cette équipe.',
      status: 403,
    });
    const arbre = await monter();
    await toucher(parRepere(arbre, 'reserver-pour-equipe'));
    await toucher(parRepere(arbre, 'reserver-equipe-team-u15'));
    expect(lisibles(arbre)).toContain('Tu n’encadres pas cette équipe.');
    expect(bouton(arbre, 'Réserver').props.disabled).toBe(true);
    await toucher(parRepere(arbre, 'reserver-pour-moi'));
    expect(bouton(arbre, 'Réserver').props.disabled).toBeFalsy();
  });
});

describe('E-P04 — la collecte (A-P07, RC-P05, Q3)', () => {
  it('décochée : la case et ce qu’elle fait', async () => {
    const arbre = await monter();
    const caseCollecte = parRepere(arbre, 'reserver-collecte');
    expect(caseCollecte.props.accessibilityState)
      .toEqual(expect.objectContaining({ checked: false }));
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Réserver seulement quand assez de joueurs ont répondu présent',
      'Le créneau n’est réservé qu’une fois le nombre atteint.',
    ]));
  });

  it('cochée : le nombre requis, la date limite, « le créneau reste libre »', async () => {
    const arbre = await monter();
    await toucher(parRepere(arbre, 'reserver-collecte'));
    expect(mockApercu).toHaveBeenCalledWith(expect.objectContaining({
      collectDeadline: expect.any(String), quorum: 10,
    }));
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Nombre requis (toi compris)',
      'Date limite',
      'Mercredi 10/03, 18 h',
      'Mardi 09/03, 18 h',
      'Au plus tard 24 h avant le créneau : la règle du complexe.',
      'En attendant, le créneau reste libre : quelqu’un peut le réserver avant toi.',
      'Lancer la collecte',
    ]));
    expect(parRepere(arbre, `reserver-echeance-${PLUS_TARD}`).props.choisie).toBe(true);
  });

  it('« Lancer la collecte » : nombre requis et date limite partent, puis E-P05', async () => {
    const arbre = await monter();
    await toucher(parRepere(arbre, 'reserver-collecte'));
    await toucher(pressable(arbre, 'Un joueur requis de moins'));
    await toucher(parRepere(arbre, 'reserver-echeance-2027-03-09T17:00:00.000Z'));
    await toucher(bouton(arbre, 'Lancer la collecte'));
    expect(mockReserver).toHaveBeenCalledWith(expect.objectContaining({
      collectDeadline: '2027-03-09T17:00:00.000Z', players: 10, quorum: 9,
    }));
    expect(mockReplace).toHaveBeenCalledWith(RouteNames.ReserverResultat, expect.objectContaining({
      collecte: { collectDeadline: '2027-03-09T17:00:00.000Z', quorum: 9 },
    }));
  });

  it('trop près du créneau : la phrase du serveur, la case se décoche', async () => {
    mockApercu.mockRejectedValueOnce({
      details: { code: 'COMPLEXE_RESERVATION_INVALID' },
      message: 'La date limite de la collecte est déjà passée.',
      status: 400,
    });
    const arbre = await monter();
    await toucher(parRepere(arbre, 'reserver-collecte'));
    expect(lisibles(arbre)).toContain('La date limite de la collecte est déjà passée.');
    expect(parRepere(arbre, 'reserver-collecte').props.accessibilityState)
      .toEqual(expect.objectContaining({ checked: false }));
    expect(lisibles(arbre)).toContain('Réserver');
  });
});

it('le complexe public sert l’âge minimum du bandeau (témoin de la doublure)', () => {
  expect(complexePublic().rules.minAge).toBe(16);
});
