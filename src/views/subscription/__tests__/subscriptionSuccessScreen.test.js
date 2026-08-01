import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { RouteNames } from '@/navigation/routeNames';

import SubscriptionSuccess from '../SubscriptionSuccess';

// L11 (E6) : l'ecran de succes n'avait aucun test de RENDU — le seul fichier
// existant (subscriptionStateRefresh.test.js) ne verifie que le calendrier de
// rafraichissement L08. Ces tests caracterisent d'abord le comportement livre
// (handoff 6a), puis verrouillent la liste de deblocages et les premiers pas.

const mockTrackFunnelEvent = jest.fn();
const mockInvalidate = jest.fn();
const mockScheduleRefresh = jest.fn();

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ id: 'query-client-test' }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ key, /** @type {any} */ fallback) => (
      typeof fallback === 'string' ? fallback : key
    ),
  }),
}));

jest.mock('@/services/subscription/subscriptionService', () => ({
  trackSubscriptionFunnelEvent: (/** @type {any} */ ...args) => mockTrackFunnelEvent(...args),
}));

jest.mock('@/domains/subscription/subscriptionRefresh', () => ({
  invalidateSubscriptionState: (/** @type {any} */ ...args) => mockInvalidate(...args),
  scheduleSubscriptionStateRefresh: (/** @type {any} */ ...args) => mockScheduleRefresh(...args),
}));

jest.mock('@/theme/themeContext', () => {
  const styleLeaf = {};
  const makeRamp = () => new Proxy({}, { get: () => styleLeaf });
  return {
    __esModule: true,
    default: () => ({
      Alignments: makeRamp(),
      Colors: new Proxy({}, { get: (_target, key) => `couleur-${String(key)}` }),
      Fonts: makeRamp(),
      Spaces: new Proxy({}, { get: () => makeRamp() }),
    }),
  };
});

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) {
    return children;
  },
);

const mockButtonHandlers = new Map();
jest.mock('@/components/atoms/button/Button', () => function ButtonMock({ onPress, title }) {
  mockButtonHandlers.set(title, onPress);
  return null;
});

const navigation = {
  goBack: jest.fn(),
  navigate: jest.fn(),
  reset: jest.fn(),
};

/**
 * Monte l'ecran avec les params de navigation donnes.
 * @param {Record<string, unknown>} [params]
 * @returns {Promise<import('react-test-renderer').ReactTestRenderer>}
 */
const renderScreen = async (params = {}) => {
  /** @type {any} */
  let tree;
  await act(async () => {
    tree = renderer.create(
      <SubscriptionSuccess
        navigation={/** @type {any} */ (navigation)}
        route={/** @type {any} */ ({ params })}
      />,
    );
  });
  return tree;
};

/**
 * Serialise l'arbre rendu pour verifier la presence (ou l'absence) d'un texte.
 * @param {import('react-test-renderer').ReactTestRenderer} tree
 * @returns {string}
 */
const renderedText = (tree) => JSON.stringify(tree.toJSON());

beforeEach(() => {
  jest.clearAllMocks();
  mockButtonHandlers.clear();
});

describe('SubscriptionSuccess — comportement livre (handoff 6a)', () => {
  it('affiche le label d offre et remercie', async () => {
    const tree = await renderScreen({ offerLabel: 'Équipe · 2 équipes' });
    const text = renderedText(tree);
    expect(text).toContain('Équipe · 2 équipes');
    expect(text).toContain("C'est débloqué !");
  });

  it('pose le jalon funnel et le calendrier de relance au montage', async () => {
    await renderScreen({});
    expect(mockTrackFunnelEvent).toHaveBeenCalledWith('success_screen_viewed', { source: 'back' });
    expect(mockScheduleRefresh).toHaveBeenCalledTimes(1);
  });

  it('« Reprendre » invalide l abonnement puis revient en arriere (mode back)', async () => {
    await renderScreen({ resumeCtaLabel: 'Reprendre' });
    await act(async () => {
      mockButtonHandlers.get('Reprendre')();
    });
    expect(mockInvalidate).toHaveBeenCalled();
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
    expect(mockTrackFunnelEvent).toHaveBeenCalledWith('success_resume_clicked', { source: 'back' });
  });

  it('« C est parti ! » repart sur l accueil (mode home)', async () => {
    await renderScreen({ resumeCtaLabel: "C'est parti !", resumeMode: 'home' });
    await act(async () => {
      mockButtonHandlers.get("C'est parti !")();
    });
    expect(navigation.reset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: RouteNames.HomeTab }],
    });
    expect(navigation.goBack).not.toHaveBeenCalled();
  });

  it('« Retour à l accueil » invalide puis reset vers l accueil', async () => {
    const tree = await renderScreen({});
    const touchables = tree.root.findAllByType(TouchableOpacity);
    expect(touchables.length).toBeGreaterThanOrEqual(1);
    await act(async () => {
      touchables[0].props.onPress();
    });
    expect(mockInvalidate).toHaveBeenCalled();
    expect(navigation.reset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: RouteNames.HomeTab }],
    });
  });

  it('la ligne de renouvellement porte la date et ouvre Mon abonnement', async () => {
    const tree = await renderScreen({ renewalDateLabel: '10 juillet 2027' });
    expect(renderedText(tree)).toContain('Renouvellement le 10 juillet 2027');
    const linkNode = tree.root
      .findAllByType(Text)
      .find((node) => typeof node.props.onPress === 'function');
    expect(linkNode).toBeTruthy();
    await act(async () => {
      linkNode.props.onPress();
    });
    expect(navigation.navigate).toHaveBeenCalledWith(RouteNames.ProfileStack, {
      screen: RouteNames.SubscriptionOverview,
    });
  });
});

// La liste vient de getSubscriptionUnlockedCapabilities, miroir de la matrice
// serveur (subscription-permission.ts:43-80) : ces tests verrouillent qu'on
// n'affiche jamais une capacite que l'offre achetee ne debloque pas.
describe('SubscriptionSuccess — L11, ce que l achat debloque et les premiers pas', () => {
  it('achat Équipe : le socle Équipe, jamais les capacites Club', async () => {
    const tree = await renderScreen({ offerScope: 'TEAM' });
    const text = renderedText(tree);
    expect(text).toContain('Ton offre débloque :');
    expect(text).toContain('Événements et matchs illimités');
    expect(text).toContain('Annonces de recrutement illimitées');
    expect(text).toContain('Composition et convocations');
    expect(text).toContain('Équipes supplémentaires');
    expect(text).not.toContain('Installations du club');
    expect(text).not.toContain('Sponsors du club');
    expect(text).not.toContain('Campagnes de cotisations');
    expect(text).not.toContain('Gestion des entraîneurs et dirigeants');
    expect(mockButtonHandlers.has('Gérer mon club')).toBe(false);
  });

  it('achat Club : les capacites Club s ajoutent au socle', async () => {
    const tree = await renderScreen({ clubDocumentId: 'club-doc-1', offerScope: 'CLUB' });
    const text = renderedText(tree);
    expect(text).toContain('Toutes les équipes du club couvertes');
    expect(text).toContain('Événements et matchs illimités');
    expect(text).toContain('Installations du club');
    expect(text).toContain('Sponsors du club');
    expect(text).toContain('Campagnes de cotisations');
    expect(text).toContain('Gestion des entraîneurs et dirigeants');
  });

  it('portee inconnue (achat Stripe web) : le socle commun, sans bouton club', async () => {
    const tree = await renderScreen({ offerLabel: 'FoundClub' });
    const text = renderedText(tree);
    expect(text).toContain('Événements et matchs illimités');
    expect(text).not.toContain('Installations du club');
    expect(mockButtonHandlers.has('Gérer mon club')).toBe(false);
  });

  it('« Publier un événement ou un match » ouvre l onglet Planning et invalide l abonnement', async () => {
    await renderScreen({ offerScope: 'TEAM' });
    await act(async () => {
      mockButtonHandlers.get('Publier un événement ou un match')();
    });
    expect(mockInvalidate).toHaveBeenCalled();
    expect(navigation.navigate).toHaveBeenCalledWith(RouteNames.HomeTab, {
      screen: RouteNames.MyEventList,
    });
    expect(mockTrackFunnelEvent).toHaveBeenCalledWith('success_resume_clicked', {
      source: 'first-action:events',
    });
  });

  it('« Préparer ma compo » ouvre l onglet Équipes', async () => {
    await renderScreen({ offerScope: 'TEAM' });
    await act(async () => {
      mockButtonHandlers.get('Préparer ma compo')();
    });
    expect(navigation.navigate).toHaveBeenCalledWith(RouteNames.HomeTab, {
      screen: RouteNames.MyTeamList,
    });
  });

  it('« Publier une annonce de recrutement » passe par les TROIS niveaux (R06)', async () => {
    await renderScreen({ offerScope: 'TEAM' });
    await act(async () => {
      mockButtonHandlers.get('Publier une annonce de recrutement')();
    });
    expect(navigation.navigate).toHaveBeenCalledWith(RouteNames.HomeTab, {
      params: {
        params: { activeType: 'recruitment' },
        screen: RouteNames.SearchHub,
      },
      screen: RouteNames.Search,
    });
  });

  it('« Gérer mon club » ouvre la fiche du club COUVERT par l achat', async () => {
    await renderScreen({ clubDocumentId: 'club-doc-1', offerScope: 'CLUB' });
    await act(async () => {
      mockButtonHandlers.get('Gérer mon club')();
    });
    expect(mockInvalidate).toHaveBeenCalled();
    expect(navigation.navigate).toHaveBeenCalledWith(RouteNames.ClubStack, {
      params: { clubId: 'club-doc-1' },
      screen: RouteNames.Club,
    });
    expect(mockTrackFunnelEvent).toHaveBeenCalledWith('success_resume_clicked', {
      source: 'first-action:club',
    });
  });

  it('achat Club sans club connu : pas de bouton « Gérer mon club », pas de mensonge', async () => {
    await renderScreen({ offerScope: 'CLUB' });
    expect(mockButtonHandlers.has('Gérer mon club')).toBe(false);
  });
});
