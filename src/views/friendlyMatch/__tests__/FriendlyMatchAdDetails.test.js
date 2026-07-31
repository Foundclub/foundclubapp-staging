import renderer, { act } from 'react-test-renderer';

import FriendlyMatchAdDetails from '../FriendlyMatchAdDetails';

// Filet du lot L5 (spec docs/SPEC_ONGLET_MATCHS_AMICAUX_2026_07_31.md §4.3-4.5).
//
// Ce qu il verrouille, et pourquoi c est ici plutot que sur un emulateur :
//   1. l ecran se lit DIFFEREMMENT des deux cotes (annonceur / candidat) ;
//   2. candidater EMMENE dans la conversation — le « fini quand » du lot ;
//   3. l identifiant du fil vient de la RELECTURE de l annonce, jamais de la
//      reponse du POST : le serveur cree bien le fil mais rend la candidature
//      sans le populer (friendly-match-workflow.ts:285). C est precisement le
//      genre de detail qu un aller-retour sur emulateur ne prouve pas.

const mockUseAuth = jest.fn();
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockUseAuth(),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 34, left: 0, right: 0, top: 59,
  }),
}));

// Le conteneur d'ecran n'est pas l'objet de ce test, et il traine derriere lui
// quatre paquets publies en ESM pur (@react-navigation/elements et /stack,
// react-native-reanimated, @sbaiahmed1/react-native-blur), aucun n'etant dans
// transformIgnorePatterns. Le remplacer par une View garde le filet centre sur
// ce qu'on veut prouver : qui voit quoi, et ou mene une candidature.
jest.mock('@/components/templates/ScreenContainer', () => {
  // eslint-disable-next-line global-require
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ props) => <View>{props.children}</View>,
  };
});

// Le service reel est charge plus bas par requireActual (pour ses deux fonctions
// pures) : sans ce mock, il ouvre le client HTTP, qui exige API_URL et leve au
// chargement du module. Aucun appel reseau n'est fait par ce test.
jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    delete: jest.fn(), get: jest.fn(), post: jest.fn(), put: jest.fn(),
  },
}));

const mockGetFriendlyMatchAd = jest.fn();
const mockGetFriendlyMatchApplications = jest.fn();
const mockApplyToFriendlyMatchAd = jest.fn();
const mockRespond = jest.fn();
jest.mock('@/services/friendlyMatch/friendlyMatchService', () => {
  const actual = jest.requireActual('@/services/friendlyMatch/friendlyMatchService');
  return {
    // On garde les VRAIS findMyApplicationOnAd / getFriendlyMatchChatId : ce sont
    // eux qui relient la candidature a son fil, donc eux qu on veut eprouver.
    applyToFriendlyMatchAd: (/** @type {any} */ a, /** @type {any} */ b) => (
      mockApplyToFriendlyMatchAd(a, b)
    ),
    findMyApplicationOnAd: actual.findMyApplicationOnAd,
    getFriendlyMatchAd: (/** @type {any} */ id) => mockGetFriendlyMatchAd(id),
    getFriendlyMatchApplications: (/** @type {any} */ id) => mockGetFriendlyMatchApplications(id),
    getFriendlyMatchChatId: actual.getFriendlyMatchChatId,
    respondToFriendlyMatchApplication: (/** @type {any} */ a, /** @type {any} */ b) => (
      mockRespond(a, b)
    ),
    withdrawFriendlyMatchApplication: jest.fn(),
  };
});

jest.mock('@/navigation/public/publicAuthNavigation', () => ({ openPublicAuthFlow: jest.fn() }));

jest.mock('@/theme/colors', () => ({ withAlpha: (/** @type {any} */ color) => color }));
jest.mock('@/theme/themeContext', () => {
  /**
   * Echelle de style tolerante : un enfant qui demande une valeur inattendue ne
   * doit pas faire tomber le filet.
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
      Colors: {
        error500: 'rouge',
        neutral00: 'encre-claire',
        neutral100: 'neutre-100',
        neutral200: 'neutre-200',
        neutral300: 'neutre-300',
        neutral400: 'neutre-400',
        neutral900: 'encre-sombre',
        primary500: 'couleur-primaire',
        primary900: 'couleur-fond',
        success500: 'vert',
        warning500: 'orange',
      },
      Fonts: anyScale(),
      Images: anyScale(),
      Spaces: anyScale(),
    }),
  };
});

const CHAT_ID = 'chat-42';

const AD_OPEN = {
  applications: [],
  candidateDates: [{ date: '2099-05-15', end: '20:00', start: '18:00' }],
  category: { name: 'U15' },
  description: 'On cherche un match de préparation.',
  documentId: 'ad-1',
  hostingPreference: 'HOST',
  status: 'open',
  team: {
    club: { name: 'Club Annonceur' },
    documentId: 'team-annonceur',
    name: 'FC Annonceur U15',
  },
  travelRadiusKm: 30,
};

const MY_TEAM = { documentId: 'team-candidat', name: 'US Candidat U15' };

const navigation = { navigate: jest.fn(), replace: jest.fn() };

/**
 * Rend l ecran pour un utilisateur donne.
 * @param {any} userData
 * @returns {Promise<any>}
 */
const renderFor = async (userData) => {
  mockUseAuth.mockReturnValue({ userData });
  let tree;
  await act(async () => {
    tree = renderer.create(
      <FriendlyMatchAdDetails navigation={navigation} route={{ params: { adId: 'ad-1' } }} />,
    );
  });
  return tree;
};

/**
 * Tous les textes rendus, aplatis.
 * @param {any} node
 * @returns {string[]}
 */
const collectText = (node) => {
  if (node === null || node === undefined) return [];
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(collectText);
  return collectText(node.children);
};

/**
 * Le texte visible du rendu, en une chaine cherchable.
 * @param {any} tree
 * @returns {string}
 */
const allText = (tree) => collectText(tree.toJSON()).join(' | ');

/**
 * Le premier noeud dont la prop correspond, en profondeur.
 * @param {any} tree
 * @param {(props: any) => boolean} predicate
 * @returns {any}
 */
const findByProps = (tree, predicate) => tree.root.findAll(
  (/** @type {any} */ node) => typeof node.type !== 'string' && predicate(node.props),
  { deep: true },
)[0];

describe('FriendlyMatchAdDetails — les deux lectures du meme ecran', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetFriendlyMatchAd.mockResolvedValue(AD_OPEN);
    mockGetFriendlyMatchApplications.mockResolvedValue([]);
  });

  it('montre l annonce a une equipe TIERS, avec le bouton pour repondre', async () => {
    const tree = await renderFor({
      documentId: 'u-candidat',
      role: { name: 'Entraineur' },
      trainedTeams: [MY_TEAM],
    });
    const rendered = allText(tree);

    expect(rendered).toContain('FC Annonceur U15');
    expect(rendered).toContain('Il reçoit');
    expect(rendered).toContain('On cherche un match de préparation.');
    expect(rendered).toContain('Proposer un match');
    // Les candidatures des AUTRES ne le regardent pas : la route serveur les lui
    // refuserait (assertManagesAdSide), on ne la sollicite meme pas.
    expect(mockGetFriendlyMatchApplications).not.toHaveBeenCalled();
  });

  it('montre les propositions recues au STAFF DE L ANNONCE, pas le bouton de reponse', async () => {
    mockGetFriendlyMatchApplications.mockResolvedValue([{
      chat: { documentId: CHAT_ID },
      chosenHosting: 'AWAY',
      documentId: 'app-1',
      status: 'pending',
      team: { club: { name: 'Club Candidat' }, name: 'US Candidat U15' },
    }]);

    const tree = await renderFor({
      documentId: 'u-annonceur',
      role: { name: 'Entraineur' },
      trainedTeams: [{ documentId: 'team-annonceur', name: 'FC Annonceur U15' }],
    });
    const rendered = allText(tree);

    expect(mockGetFriendlyMatchApplications).toHaveBeenCalledWith('ad-1');
    expect(rendered).toContain('1 proposition à traiter');
    expect(rendered).toContain('US Candidat U15');
    expect(rendered).toContain('Elle se déplace chez toi');
    expect(rendered).toContain('Accepter ce match');
    expect(rendered).not.toContain('Proposer un match');
  });

  it('dit a un JOUEUR que repondre est reserve au staff, au lieu d un bouton mort', async () => {
    const tree = await renderFor({ documentId: 'u-joueur', role: { name: 'Joueur' } });

    expect(allText(tree))
      .toContain('Seuls un entraîneur ou un dirigeant peuvent proposer un match.');
  });

  it('annonce fermee : plus aucun bouton pour repondre', async () => {
    mockGetFriendlyMatchAd.mockResolvedValue({ ...AD_OPEN, status: 'matched' });
    const tree = await renderFor({
      documentId: 'u-candidat',
      role: { name: 'Entraineur' },
      trainedTeams: [MY_TEAM],
    });
    const rendered = allText(tree);

    expect(rendered).toContain('Cette annonce a trouvé son adversaire.');
    expect(rendered).not.toContain('Proposer un match');
  });
});

describe('FriendlyMatchAdDetails — candidater ouvre la conversation (§4.3)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetFriendlyMatchApplications.mockResolvedValue([]);
  });

  it('emmene dans le fil, avec l identifiant repris de l annonce RELUE', async () => {
    // 1er appel : l annonce vierge. 2e appel : la relecture, qui porte enfin le fil.
    mockGetFriendlyMatchAd
      .mockResolvedValueOnce(AD_OPEN)
      .mockResolvedValueOnce({
        ...AD_OPEN,
        applications: [{
          chat: { documentId: CHAT_ID },
          chosenHosting: 'AWAY',
          documentId: 'app-1',
          status: 'pending',
          team: MY_TEAM,
        }],
      });
    // Ce que rend VRAIMENT le POST : aucune relation `chat` populee.
    mockApplyToFriendlyMatchAd.mockResolvedValue({
      chosenHosting: 'AWAY', documentId: 'app-1', status: 'pending',
    });

    const tree = await renderFor({
      documentId: 'u-candidat',
      role: { name: 'Entraineur' },
      trainedTeams: [MY_TEAM],
    });

    const sheet = findByProps(tree, (props) => typeof props?.onSubmitted === 'function');
    await act(async () => {
      await sheet.props.onSubmitted({ documentId: 'app-1', status: 'pending' });
    });

    expect(mockGetFriendlyMatchAd).toHaveBeenCalledTimes(2);
    expect(navigation.navigate).toHaveBeenCalledWith('Conversation', { chatId: CHAT_ID });
  });

  it('fil introuvable : on renvoie vers la messagerie, jamais dans le vide', async () => {
    mockGetFriendlyMatchAd.mockResolvedValue(AD_OPEN);

    const tree = await renderFor({
      documentId: 'u-candidat',
      role: { name: 'Entraineur' },
      trainedTeams: [MY_TEAM],
    });

    const sheet = findByProps(tree, (props) => typeof props?.onSubmitted === 'function');
    await act(async () => {
      await sheet.props.onSubmitted({ documentId: 'app-1', status: 'pending' });
    });

    // Pas de navigation muette vers un ecran sans identifiant.
    expect(navigation.navigate).not.toHaveBeenCalledWith('Conversation', { chatId: '' });
    expect(navigation.navigate).not.toHaveBeenCalledWith('Conversation', expect.anything());
  });

  it('une equipe qui a deja candidate voit sa proposition et le lien vers le fil', async () => {
    mockGetFriendlyMatchAd.mockResolvedValue({
      ...AD_OPEN,
      applications: [{
        chat: { documentId: CHAT_ID },
        chosenHosting: 'AWAY',
        documentId: 'app-1',
        status: 'pending',
        team: MY_TEAM,
      }],
    });

    const tree = await renderFor({
      documentId: 'u-candidat',
      role: { name: 'Entraineur' },
      trainedTeams: [MY_TEAM],
    });
    const rendered = allText(tree);

    expect(rendered).toContain('Ta proposition');
    expect(rendered).toContain('Ouvrir la discussion');
    expect(rendered).toContain('Retirer ma proposition');
    expect(rendered).not.toContain('Proposer un match');
  });
});
