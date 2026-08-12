import { Alert } from 'react-native';
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
const mockUpdateAd = jest.fn();
const mockRepostAd = jest.fn();
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
    repostFriendlyMatchAd: (/** @type {any} */ a, /** @type {any} */ b) => mockRepostAd(a, b),
    respondToFriendlyMatchApplication: (/** @type {any} */ a, /** @type {any} */ b) => (
      mockRespond(a, b)
    ),
    updateFriendlyMatchAd: (/** @type {any} */ a, /** @type {any} */ b) => mockUpdateAd(a, b),
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

  /**
   * D92 — ce qu Adel a demande mot pour mot : « ca marque felicitations,
   * proposition envoyee, on appuie sur OK, et ca envoie automatiquement un
   * message dans le tchat avec la proposition de match ».
   * Le message, lui, est deja poste par le SERVEUR au moment du apply : appuyer
   * sur OK emmene le voir, ca ne l envoie pas depuis l app (un envoi cote app
   * partirait en double, ou pas du tout si le reseau lache).
   */
  it('temoin 3 — l envoi felicite, et OK ouvre LA conversation, pas la liste', async () => {
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
    mockApplyToFriendlyMatchAd.mockResolvedValue({
      chosenHosting: 'AWAY', documentId: 'app-1', status: 'pending',
    });

    const tree = await renderFor({
      documentId: 'u-candidat',
      role: { name: 'Entraineur' },
      trainedTeams: [MY_TEAM],
    });

    const alertSpy = jest.spyOn(Alert, 'alert');
    const sheet = findByProps(tree, (props) => typeof props?.onSubmitted === 'function');
    await act(async () => {
      await sheet.props.onSubmitted({ documentId: 'app-1', status: 'pending' });
    });

    // 1. On felicite AVANT de bouger : l envoi a reussi, ca se dit.
    expect(alertSpy).toHaveBeenCalled();
    const [title, message, buttons] = alertSpy.mock.calls[0];
    expect(String(title)).toContain('élicitations');
    expect(String(message)).toContain('discussion');

    // 2. Rien n a bouge tant qu il n a pas appuye.
    expect(navigation.navigate).not.toHaveBeenCalled();

    // 3. OK emmene dans LE fil, avec son identifiant — jamais la racine.
    await act(async () => { await buttons[0].onPress(); });
    expect(navigation.navigate).toHaveBeenCalledWith('Conversation', { chatId: CHAT_ID });
    expect(navigation.navigate).not.toHaveBeenCalledWith('Chat');
    alertSpy.mockRestore();
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

    const alertSpy = jest.spyOn(Alert, 'alert');
    const sheet = findByProps(tree, (props) => typeof props?.onSubmitted === 'function');
    await act(async () => {
      await sheet.props.onSubmitted({ documentId: 'app-1', status: 'pending' });
    });
    await act(async () => { await alertSpy.mock.calls[0][2][0].onPress(); });

    expect(mockGetFriendlyMatchAd).toHaveBeenCalledTimes(2);
    expect(navigation.navigate).toHaveBeenCalledWith('Conversation', { chatId: CHAT_ID });
    alertSpy.mockRestore();
  });

  /**
   * D92 — avant ce lot, ce cas offrait un bouton « Ouvrir la messagerie » qui
   * naviguait vers `RouteNames.Chat`, la RACINE de la messagerie : un ecran de
   * l onglet, injoignable depuis cette pile, et qui de toute facon ne disait pas
   * QUELLE conversation ouvrir. Adel l a constate : « le bouton ne s ouvre pas ».
   * Un bouton inerte est pire qu un bouton absent (lot R06) : on le retire.
   */
  it('fil introuvable : on felicite quand meme, SANS bouton inerte', async () => {
    mockGetFriendlyMatchAd.mockResolvedValue(AD_OPEN);

    const tree = await renderFor({
      documentId: 'u-candidat',
      role: { name: 'Entraineur' },
      trainedTeams: [MY_TEAM],
    });

    const alertSpy = jest.spyOn(Alert, 'alert');
    const sheet = findByProps(tree, (props) => typeof props?.onSubmitted === 'function');
    await act(async () => {
      await sheet.props.onSubmitted({ documentId: 'app-1', status: 'pending' });
    });

    // La proposition est partie : ca se dit, meme sans fil a ouvrir.
    expect(String(alertSpy.mock.calls[0][0])).toContain('élicitations');
    // Plus aucun bouton ne promet d ouvrir quoi que ce soit.
    const buttons = alertSpy.mock.calls[0][2] || [];
    expect(buttons.map((/** @type {any} */ button) => button.text))
      .not.toContain('Ouvrir la messagerie');

    await act(async () => { await buttons[0]?.onPress?.(); });
    // Pas de navigation muette : ni vers un fil sans identifiant, ni vers la racine.
    expect(navigation.navigate).not.toHaveBeenCalledWith('Conversation', expect.anything());
    expect(navigation.navigate).not.toHaveBeenCalledWith('Chat');
    alertSpy.mockRestore();
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

// Filet des 3 gestes ajoutes apres l'etat des lieux du 31/07 : sans eux,
// l'annonceur pouvait publier mais jamais annuler, jamais reposter, et jamais
// enregistrer ce qui avait ete convenu dans le fil. Trois culs-de-sac.
describe('FriendlyMatchAdDetails — ce que l annonceur peut faire de son annonce', () => {
  const AD_STAFF = {
    documentId: 'u-annonceur',
    role: { name: 'Entraineur' },
    trainedTeams: [{ documentId: 'team-annonceur', name: 'FC Annonceur U15' }],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetFriendlyMatchApplications.mockResolvedValue([]);
  });

  /**
   * Le premier bouton portant ce titre.
   * @param {any} tree
   * @param {string} title
   * @returns {any}
   */
  const findButton = (tree, title) => tree.root.findAll(
    (/** @type {any} */ node) => node.props?.title === title,
    { deep: true },
  )[0];

  it('annonce ouverte : « Annuler » la passe en cancelled, sans supprimer', async () => {
    mockGetFriendlyMatchAd.mockResolvedValue(AD_OPEN);
    mockUpdateAd.mockResolvedValue({ ...AD_OPEN, status: 'cancelled' });

    const tree = await renderFor(AD_STAFF);
    const cancelButton = findButton(tree, 'Annuler l’annonce');
    expect(cancelButton).toBeDefined();

    // La confirmation passe par Alert : on rejoue le bouton destructeur.
    const alertSpy = jest.spyOn(Alert, 'alert');
    await act(async () => { cancelButton.props.onPress(); });
    const destructive = alertSpy.mock.calls[0][2]
      .find((/** @type {any} */ action) => action.style === 'destructive');
    await act(async () => { await destructive.onPress(); });

    expect(mockUpdateAd).toHaveBeenCalledWith('ad-1', { status: 'cancelled' });
    alertSpy.mockRestore();
  });

  it('annonce expirée : le bouton de repostage apparaît, pas avant', async () => {
    mockGetFriendlyMatchAd.mockResolvedValue({ ...AD_OPEN, status: 'open' });
    const openTree = await renderFor(AD_STAFF);
    expect(findButton(openTree, 'Reposter avec de nouvelles dates')).toBeUndefined();

    mockGetFriendlyMatchAd.mockResolvedValue({ ...AD_OPEN, status: 'expired' });
    const expiredTree = await renderFor(AD_STAFF);
    expect(findButton(expiredTree, 'Reposter avec de nouvelles dates')).toBeDefined();
  });

  it('une annonce pourvue ne propose ni annulation ni repostage', async () => {
    mockGetFriendlyMatchAd.mockResolvedValue({ ...AD_OPEN, status: 'matched' });
    const tree = await renderFor(AD_STAFF);

    expect(findButton(tree, 'Annuler l’annonce')).toBeUndefined();
    expect(findButton(tree, 'Reposter avec de nouvelles dates')).toBeUndefined();
  });

  it('une proposition en attente permet de convenir des modalités (§4.4)', async () => {
    mockGetFriendlyMatchAd.mockResolvedValue(AD_OPEN);
    mockGetFriendlyMatchApplications.mockResolvedValue([{
      chat: { documentId: CHAT_ID },
      chosenHosting: 'AWAY',
      documentId: 'app-1',
      status: 'pending',
      team: { name: 'US Candidat U15' },
    }]);

    const tree = await renderFor(AD_STAFF);

    expect(findButton(tree, 'Convenir date, heure et lieu')).toBeDefined();
  });

  it('ce qui est convenu s affiche, et remplace le libellé de saisie', async () => {
    mockGetFriendlyMatchAd.mockResolvedValue(AD_OPEN);
    mockGetFriendlyMatchApplications.mockResolvedValue([{
      agreedTerms: { date: '2099-05-15T18:00:00.000Z', venue: 'Stade Nord' },
      chosenHosting: 'AWAY',
      documentId: 'app-1',
      status: 'pending',
      team: { name: 'US Candidat U15' },
    }]);

    const tree = await renderFor(AD_STAFF);
    const rendered = allText(tree);

    expect(rendered).toContain('Convenu :');
    expect(rendered).toContain('Stade Nord');
    expect(findButton(tree, 'Modifier ce qui est convenu')).toBeDefined();
  });
});

// D90 — le detail nomme TOUTES les categories et TOUS les niveaux vises.
// L annonce est le seul endroit ou une equipe verifie qu elle est concernee :
// n en afficher qu un ferait renoncer des equipes qui avaient le droit de venir.
describe('D90 — le detail nomme toutes les categories et tous les niveaux', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetFriendlyMatchApplications.mockResolvedValue([]);
  });

  const LECTEUR = { documentId: 'u-joueur', role: { name: 'Joueur' } };

  it('affiche les trois categories et les deux niveaux, pas seulement les premiers', async () => {
    mockGetFriendlyMatchAd.mockResolvedValue({
      ...AD_OPEN,
      categories: [{ name: 'U15' }, { name: 'U17' }, { name: 'U19' }],
      category: { name: 'U15' },
      levels: [{ name: 'Départemental 1' }, { name: 'Départemental 2' }],
    });

    const rendered = allText(await renderFor(LECTEUR));

    expect(rendered).toContain('U15, U17, U19');
    expect(rendered).toContain('Départemental 1, Départemental 2');
  });

  // 🔒 Le temoin de compatibilite : AD_OPEN est une annonce d AVANT D90 — elle
  // ne porte que `category`. Elle doit rester lisible telle quelle.
  it('nomme encore la categorie unique d une annonce publiee avant D90', async () => {
    mockGetFriendlyMatchAd.mockResolvedValue(AD_OPEN);

    const rendered = allText(await renderFor(LECTEUR));

    expect(rendered).toContain('U15');
  });
});
