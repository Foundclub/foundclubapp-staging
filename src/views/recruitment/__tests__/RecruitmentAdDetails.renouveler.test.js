import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Alert } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { formatRecruitmentAdExpiryDate } from '@/utils/recruitmentAdRenewal';

import RecruitmentAdDetails from '../RecruitmentAdDetails';

// ANNONCE-RENOUVELER (decision d'Adel « renouveler A », 05/10).
//
// « Sur la fiche de SON annonce, l'auteur voit un bouton "Renouveler 30 jours" quand
// l'annonce expire dans 7 jours ou moins, ou a deja expire. Un appui => l'annonce repart
// pour 30 jours. »
//
// Avant ce lot, `renewRecruitmentAd` (services/recruitment/recruitmentService.js) n'etait
// appele NULLE PART : aucun bouton, et aucun ecran n'affichait l'echeance.
// Serveur : POST /recruitment-ads/:id/renew (admin recruitment-ad-custom.ts, `renew`) —
// l'AUTEUR seulement, +30 jours a partir de l'appui, rend { expirationDate, message, success }.
//
// La couture est le TEXTE VISIBLE et le libelle du bouton, comme dans
// RecruitmentAdDetails.gererAnnonce.test.js, dont ce fichier reprend les doublures.

jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next
));

const mockUseAuth = jest.fn();
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockUseAuth(),
}));

const mockNavigation = { goBack: jest.fn(), navigate: jest.fn(), setOptions: jest.fn() };
const mockRoute = { params: {} };
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 34, left: 0, right: 0, top: 59,
  }),
}));

jest.mock('@/components/templates/ScreenContainer', () => {
  // eslint-disable-next-line global-require
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ props) => <View>{props.children}</View>,
  };
});

jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  // eslint-disable-next-line global-require
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ props) => (props.isVisible ? (
      <View>
        {props.headerComponent || null}
        {props.children}
        {props.footerComponent || null}
      </View>
    ) : null),
  };
});

jest.mock('@/components/atoms/checkable/Checkable', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/molecules/clubLogoMark/ClubLogoMark', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('react-native-linear-gradient', () => {
  // eslint-disable-next-line global-require
  const { View } = require('react-native');
  return { __esModule: true, default: (/** @type {any} */ props) => <View>{props.children}</View> };
});

jest.mock('@/navigation/navigationAvailability', () => ({
  navigateToStackScreenOrScreen: jest.fn(),
}));
jest.mock('@/navigation/public/publicAuthNavigation', () => ({ openPublicAuthFlow: jest.fn() }));
jest.mock('@/utils/shareLinks', () => ({
  buildPublicWebUrl: (/** @type {any} */ { path }) => `https://site.test${path}`,
}));

// Doublure ENTIERE du service (piege L35 : le client HTTP refuse de se charger sans API_URL).
const mockGetRecruitmentAd = jest.fn();
const mockRenewRecruitmentAd = jest.fn();
jest.mock('@/services/recruitment/recruitmentService', () => ({
  applyToRecruitmentAd: jest.fn(),
  buildOwnApplicationStatusMap: () => ({}),
  deleteRecruitmentAd: jest.fn(),
  getMyApplications: jest.fn(async () => []),
  getRecruitmentAd: (/** @type {any} */ id) => mockGetRecruitmentAd(id),
  getRecruitmentApplications: jest.fn(async () => []),
  renewRecruitmentAd: (/** @type {any} */ id) => mockRenewRecruitmentAd(id),
  resolveRecruitmentAdApplicationState: () => ({
    linkedRecruitmentAdDocumentId: null,
    status: null,
  }),
  updateRecruitmentApplicationStatus: jest.fn(),
  withdrawRecruitmentApplication: jest.fn(),
}));
jest.mock('@/services/eventParticipation/eventParticipationService', () => ({
  acceptEventParticipation: jest.fn(),
  declineEventParticipation: jest.fn(),
  getEventParticipations: jest.fn(async () => ({ data: [] })),
}));
jest.mock('@/services/teamMembershipRequest/teamMembershipRequestService', () => ({
  inviteToTeam: jest.fn(),
  resolveTeamInvitationAvailability: () => ({ canInvite: false }),
}));

jest.mock('@/theme/colors', () => ({ withAlpha: (/** @type {any} */ color) => color }));
jest.mock('@/theme/themeContext', () => {
  /**
   * Echelle de style tolerante.
   * @returns {any}
   */
  const anyScale = () => new Proxy({}, {
    get: (/** @type {any} */ _target, /** @type {any} */ key) => (
      typeof key === 'symbol' ? undefined : anyScale()
    ),
  });

  return {
    __esModule: true,
    default: () => ({
      Alignments: anyScale(),
      ApplicationStyle: anyScale(),
      Colors: new Proxy({}, {
        get: (/** @type {any} */ _t, /** @type {any} */ key) => String(key),
      }),
      Fonts: anyScale(),
      Images: anyScale(),
      Spaces: anyScale(),
    }),
  };
});

const DAY = 24 * 60 * 60 * 1000;
const inDays = (/** @type {number} */ days) => new Date(Date.now() + days * DAY).toISOString();
const dateOf = (/** @type {string} */ iso) => formatRecruitmentAdExpiryDate(new Date(iso));

const CLUB = { documentId: 'club-mfc', name: 'Montrivage FC' };
const TEAM = { club: CLUB, documentId: 'team-u15', name: 'U15' };

const AD = {
  applications: [],
  author: { documentId: 'u-auteur', id: 7 },
  createdAt: '2026-09-01T10:00:00.000Z',
  description: 'L equipe cherche un defenseur central pour la saison.',
  documentId: 'ad-u15',
  expirationDate: inDays(3),
  isActive: true,
  team: TEAM,
  title: 'Defenseur central',
};

// Les comptes, tels que `sanitizeUser` les rend (`id` a null).
const AUTEUR = {
  documentId: 'u-auteur', id: null, myTeams: [], role: { name: 'Entraineur' }, trainedTeams: [TEAM],
};
const CO_ENTRAINEUR = {
  documentId: 'u-coach', id: null, myTeams: [], role: { name: 'Entraineur' }, trainedTeams: [TEAM],
};
const DIRIGEANT_DU_CLUB = {
  club: CLUB,
  documentId: 'u-dirigeant',
  id: null,
  myTeams: [],
  role: { name: 'Dirigeant' },
  trainedTeams: [],
};
const TIERS = {
  documentId: 'u-tiers', id: null, myTeams: [], role: { name: 'Joueur' }, trainedTeams: [],
};

const RENOUVELER = 'Renouveler 30 jours';

/** @type {any[]} */
let montes = [];

/**
 * Rend la fiche d'annonce pour un compte donne.
 * @param {any} userData Le compte connecte.
 * @param {any} [ad] L'annonce.
 * @returns {Promise<{ tree: any, queryClient: QueryClient }>} L'arbre et son cache.
 */
const renderFor = async (userData, ad = AD) => {
  mockUseAuth.mockReturnValue({ userData });
  mockRoute.params = { ad, adId: ad.documentId };
  mockGetRecruitmentAd.mockResolvedValue(ad);
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  let tree;
  await act(async () => {
    tree = renderer.create(
      <QueryClientProvider client={queryClient}>
        <RecruitmentAdDetails />
      </QueryClientProvider>,
    );
  });
  montes.push(tree);
  return { queryClient, tree };
};

/**
 * Tous les textes rendus, aplatis.
 * @param {any} node Un noeud du JSON rendu.
 * @returns {string[]} Les textes.
 */
const collectText = (node) => {
  if (node === null || node === undefined) return [];
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(collectText);
  return collectText(node.children);
};

/**
 * Le texte visible, en une chaine cherchable.
 * @param {any} tree L'arbre rendu.
 * @returns {string} Le texte.
 */
const allText = (tree) => collectText(tree.toJSON()).join(' | ');

/**
 * Le bouton qui porte ce libelle (le `title` de `Button`).
 * @param {any} tree L'arbre rendu.
 * @param {string} title Le libelle.
 * @returns {any} Le noeud, ou undefined.
 */
const findButton = (tree, title) => tree.root.findAll(
  (/** @type {any} */ node) => typeof node.type !== 'string' && node.props?.title === title,
  { deep: true },
)[0];

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(async () => {
  await act(async () => {
    montes.forEach((tree) => tree.unmount());
  });
  montes = [];
  jest.restoreAllMocks();
});

describe('ANNONCE-RENOUVELER 2 — QUAND l auteur voit « Renouveler 30 jours »', () => {
  it('echeance dans 3 jours : la ligne « Expire le … » sous le titre, et le bouton', async () => {
    const { tree } = await renderFor(AUTEUR);

    expect(allText(tree)).toContain(`Expire le ${dateOf(AD.expirationDate)}`);
    expect(findButton(tree, RENOUVELER)).toBeDefined();
  });

  it('expiree depuis 2 jours : « Expirée depuis le … », et le bouton', async () => {
    const expiree = { ...AD, expirationDate: inDays(-2) };
    const { tree } = await renderFor(AUTEUR, expiree);

    expect(allText(tree)).toContain(`Expirée depuis le ${dateOf(expiree.expirationDate)}`);
    expect(allText(tree)).not.toContain('Expire le ');
    expect(findButton(tree, RENOUVELER)).toBeDefined();
  });

  it('echeance dans 20 jours : la ligne dit l echeance, mais PAS de bouton', async () => {
    const loin = { ...AD, expirationDate: inDays(20) };
    const { tree } = await renderFor(AUTEUR, loin);

    expect(allText(tree)).toContain(`Expire le ${dateOf(loin.expirationDate)}`);
    expect(findButton(tree, RENOUVELER)).toBeUndefined();
  });

  it('sans echeance (ancienne annonce) : ni ligne ni bouton', async () => {
    const { tree } = await renderFor(AUTEUR, { ...AD, expirationDate: null });

    expect(allText(tree)).not.toMatch(/Expir/);
    expect(findButton(tree, RENOUVELER)).toBeUndefined();
  });

  it('le CO-ENTRAINEUR a les outils du club, ni ligne ni bouton (refus serveur)', async () => {
    const { tree } = await renderFor(CO_ENTRAINEUR, { ...AD, expirationDate: inDays(-2) });

    expect(findButton(tree, 'Modifier')).toBeDefined();
    expect(allText(tree)).not.toMatch(/Expir/);
    expect(findButton(tree, RENOUVELER)).toBeUndefined();
  });

  it('le DIRIGEANT du club non plus', async () => {
    const { tree } = await renderFor(DIRIGEANT_DU_CLUB, { ...AD, expirationDate: inDays(1) });

    expect(findButton(tree, 'Modifier')).toBeDefined();
    expect(findButton(tree, RENOUVELER)).toBeUndefined();
  });

  it('un TIERS ne voit ni la ligne ni le bouton', async () => {
    const { tree } = await renderFor(TIERS, { ...AD, expirationDate: inDays(1) });

    expect(allText(tree)).not.toMatch(/Expir/);
    expect(findButton(tree, RENOUVELER)).toBeUndefined();
  });

  it('une annonce SANS auteur (avant ANNONCE-AUTEUR) : personne ne voit le bouton', async () => {
    const { tree } = await renderFor(AUTEUR, { ...AD, author: null, expirationDate: inDays(-40) });

    expect(findButton(tree, RENOUVELER)).toBeUndefined();
  });
});

/**
 * Une promesse qu'on tient a la main, pour regarder l'ecran PENDANT l'appel.
 * @returns {{ promise: Promise<any>, resolve: (value: any) => void }} La promesse et sa cle.
 */
const deferred = () => {
  /**
   * Tient la promesse.
   * @type {(value: any) => void}
   */
  let resolve = () => {};
  const promise = new Promise((res) => { resolve = res; });
  return { promise, resolve };
};

/**
 * Appuie sur « Renouveler 30 jours » et laisse les promesses se poser. react-query livre ses
 * changements d'etat par `setTimeout(cb, 0)` (jest.setup.js) : un tour de minuterie apres
 * l'appui, et l'ecran a recu « en cours ».
 * @param {any} tree L'arbre rendu.
 * @returns {Promise<void>}
 */
const pressRenew = async (tree) => {
  await act(async () => {
    findButton(tree, RENOUVELER).props.onPress();
    await new Promise((resolve) => { setTimeout(resolve, 0); });
  });
};

describe('ANNONCE-RENOUVELER 3 — l appui sur « Renouveler 30 jours »', () => {
  it('appelle la route de CETTE annonce ; le bouton se fige pendant l appel', async () => {
    const appel = deferred();
    mockRenewRecruitmentAd.mockReturnValue(appel.promise);
    const { tree } = await renderFor(AUTEUR);

    await pressRenew(tree);

    expect(mockRenewRecruitmentAd).toHaveBeenCalledTimes(1);
    expect(mockRenewRecruitmentAd).toHaveBeenCalledWith('ad-u15');
    expect(findButton(tree, RENOUVELER).props.isLoading).toBe(true);

    await pressRenew(tree);
    expect(mockRenewRecruitmentAd).toHaveBeenCalledTimes(1);

    await act(async () => { appel.resolve({ expirationDate: inDays(30), success: true }); });
  });

  it('succes : « Annonce prolongée jusqu au … », fiche relue, listes invalidées', async () => {
    const nouvelle = inDays(30);
    mockRenewRecruitmentAd.mockImplementation(async () => {
      // Ce que le serveur rendra a la relecture : l'echeance neuve.
      mockGetRecruitmentAd.mockResolvedValue({ ...AD, expirationDate: nouvelle });
      return {
        expirationDate: nouvelle,
        message: 'Annonce renouvelee pour 30 jours',
        success: true,
      };
    });
    const { queryClient, tree } = await renderFor(AUTEUR);
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    const lecturesAvant = mockGetRecruitmentAd.mock.calls.length;

    await pressRenew(tree);

    expect(Alert.alert).toHaveBeenCalledWith(
      'Annonce renouvelée',
      `Annonce prolongée jusqu’au ${dateOf(nouvelle)}.`,
    );
    // La fiche est relue, et « Mes annonces » / la recherche le seront a leur tour.
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['recruitmentAd', 'ad-u15'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['recruitmentAds'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['myRecruitmentAds'] });
    expect(mockGetRecruitmentAd.mock.calls.length).toBeGreaterThan(lecturesAvant);
    // L'echeance neuve est a l'ecran, et le bouton s'en va (30 jours > 7).
    expect(allText(tree)).toContain(`Expire le ${dateOf(nouvelle)}`);
    expect(findButton(tree, RENOUVELER)).toBeUndefined();
  });

  it('echec 403 : un message clair, la fiche intacte, le bouton de nouveau actif', async () => {
    const refus = Object.assign(new Error('Request failed with status code 403'), {
      response: { data: { error: { message: 'You can only renew your own ads' } }, status: 403 },
    });
    mockRenewRecruitmentAd.mockRejectedValue(refus);
    const { tree } = await renderFor(AUTEUR);

    await pressRenew(tree);

    expect(Alert.alert).toHaveBeenCalledWith(
      'Renouvellement impossible',
      'Seul l’auteur de l’annonce peut la renouveler.',
    );
    expect(allText(tree)).toContain(`Expire le ${dateOf(AD.expirationDate)}`);
    expect(findButton(tree, RENOUVELER).props.isLoading).toBe(false);
  });

  it('echec reseau : un message clair, et on peut reessayer', async () => {
    mockRenewRecruitmentAd.mockRejectedValueOnce(new Error('Network Error'));
    const { tree } = await renderFor(AUTEUR);

    await pressRenew(tree);

    expect(Alert.alert).toHaveBeenCalledWith(
      'Renouvellement impossible',
      'Impossible de prolonger l’annonce pour le moment. Vérifie ta connexion et réessaie.',
    );
    expect(findButton(tree, RENOUVELER).props.isLoading).toBe(false);

    mockRenewRecruitmentAd.mockResolvedValueOnce({ expirationDate: inDays(30), success: true });
    await pressRenew(tree);
    expect(mockRenewRecruitmentAd).toHaveBeenCalledTimes(2);
  });
});
