import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { getSubscriptionUnlockedCapabilities } from '@/domains/subscription/subscriptionDecision';

import { RouteNames } from '@/navigation/routeNames';

import SubscriptionSuccess from '../SubscriptionSuccess';

// L11 (E6) : l'ecran de succes n'avait aucun test de RENDU — le seul fichier
// existant (subscriptionStateRefresh.test.js) ne verifie que le calendrier de
// rafraichissement L08. Ces tests caracterisent d'abord le comportement livre
// (handoff 6a), puis verrouillent la liste de deblocages et les premiers pas.
//
// Tour 7a (mise en page compacte) : les premiers pas sont passes de boutons
// empiles a une grille 2x2 de cartes. Ils ne sont donc plus atteignables par le
// mock de <Button> mais par leur libelle d'accessibilite — meme handler, meme
// navigation, meme jalon funnel : c'est exactement ce que ces tests verifient.

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

// Tour 7a : la carte verre pose un degrade, comme les cartes club
// (ClubCard.test.js:18 — meme mock, meme raison : le module natif n'existe pas
// sous Jest).
jest.mock('react-native-linear-gradient', () => 'LinearGradient');

jest.mock('@/theme/themeContext', () => {
  const styleLeaf = {};
  const makeRamp = () => new Proxy({}, { get: () => styleLeaf });
  return {
    __esModule: true,
    default: () => ({
      Alignments: makeRamp(),
      Colors: new Proxy({}, { get: (_target, key) => `couleur-${String(key)}` }),
      Fonts: makeRamp(),
      // Tour 7a : les cartes de premiers pas portent une icone de la banque du
      // theme (`Images`), comme les cartes de l'accueil. Sans cette entree le
      // mock rendait `Images` indefini et le rendu levait une TypeError.
      Images: new Proxy({}, { get: (_target, key) => `image-${String(key)}` }),
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

/**
 * Retrouve une zone tactile par son libelle d'accessibilite. Depuis le tour 7a,
 * les premiers pas sont des cartes et non plus des <Button> : c'est le libelle
 * qui les nomme, pour un lecteur d'ecran comme pour ce test.
 * @param {import('react-test-renderer').ReactTestRenderer} tree
 * @param {string} label
 * @returns {any}
 */
const findTouchableByLabel = (tree, label) => tree.root
  .findAllByType(TouchableOpacity)
  .find((node) => node.props.accessibilityLabel === label);

/**
 * Cellules de la grille des capacites debloquees (une par identifiant rendu par
 * getSubscriptionUnlockedCapabilities).
 * @param {import('react-test-renderer').ReactTestRenderer} tree
 * @returns {any[]}
 */
const unlockCells = (tree) => tree.root.findAll(
  // `typeof node.type === 'string'` : les noeuds hotes seulement. Sans ce
  // filtre, chaque cellule est comptee deux fois (le composant View ET la vue
  // native qu'il rend).
  (node) => typeof node.type === 'string'
    && StyleSheet.flatten(node.props.style)?.width === '50%',
);

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
    // Tour 7a : selection par libelle, l'index 0 designant desormais la
    // premiere carte de premiers pas.
    const homeLink = findTouchableByLabel(tree, "Retour à l'accueil");
    expect(homeLink).toBeTruthy();
    await act(async () => {
      homeLink.props.onPress();
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

/* L40 partie B — quelqu'un remplit un formulaire, bute sur un mur payant, va au
   catalogue, achete… et atterrit sur l'ACCUEIL. Son brouillon est garde (L10-C),
   pas son chemin. On ne pouvait pas se contenter de basculer sur 'back' : sous
   cet ecran, dans la pile, il y a le CATALOGUE — « revenir » rouvrirait une page
   de vente a quelqu'un qui vient de payer. Il faut se souvenir de l'ecran
   d'ORIGINE, celui d'AVANT le catalogue, et il voyage en PARAMETRE. */
describe('SubscriptionSuccess — L40, on revient la ou on etait', () => {
  it('mode `route` : « Reprendre » ramene a l origine, pas a l accueil', async () => {
    await renderScreen({
      resumeMode: 'route',
      resumeRouteName: RouteNames.EventStack,
      resumeRouteParams: { screen: RouteNames.EventWizardType },
    });
    await act(async () => {
      mockButtonHandlers.get('Reprendre')();
    });

    expect(navigation.navigate).toHaveBeenCalledWith(RouteNames.EventStack, {
      screen: RouteNames.EventWizardType,
    });
    expect(navigation.reset).not.toHaveBeenCalled();
    // Le catalogue est juste dessous : y « revenir » serait rouvrir des offres
    // a quelqu'un qui vient de payer.
    expect(navigation.goBack).not.toHaveBeenCalled();
  });

  it('une origine SANS params est visee telle quelle', async () => {
    await renderScreen({ resumeMode: 'route', resumeRouteName: RouteNames.TeamStack });
    await act(async () => {
      mockButtonHandlers.get('Reprendre')();
    });

    expect(navigation.navigate).toHaveBeenCalledWith(RouteNames.TeamStack, undefined);
  });

  it('REPLI — un nom d origine inconnu retombe sur l accueil, jamais un bouton mort', async () => {
    await renderScreen({ resumeMode: 'route', resumeRouteName: 'EcranQuiNExistePas' });
    await act(async () => {
      mockButtonHandlers.get('Reprendre')();
    });

    expect(navigation.reset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: RouteNames.HomeTab }],
    });
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it('REPLI — mode `route` sans aucune origine retombe sur l accueil', async () => {
    await renderScreen({ resumeMode: 'route' });
    await act(async () => {
      mockButtonHandlers.get('Reprendre')();
    });

    expect(navigation.reset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: RouteNames.HomeTab }],
    });
  });

  it('PIEGE R06 — un nom de FEUILLE ne peut pas etre vise d ici : repli accueil', async () => {
    // Cet ecran est pousse sur le navigateur RACINE. Un nom qui ne vit que dans
    // un sous-navigateur (`EventDetails` est dans EventStack) y echoue EN
    // SILENCE — c'est deja ecrit dans le fichier a propos du recrutement. Un
    // bouton qui ne fait rien est pire qu'un bouton qui ramene a l'accueil.
    await renderScreen({ resumeMode: 'route', resumeRouteName: RouteNames.EventDetails });
    await act(async () => {
      mockButtonHandlers.get('Reprendre')();
    });

    expect(navigation.reset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: RouteNames.HomeTab }],
    });
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it('TEMOIN — le mode `home` n est pas touche par le nouveau mode', async () => {
    await renderScreen({
      resumeCtaLabel: "C'est parti !",
      resumeMode: 'home',
      // Une origine trainante ne doit pas detourner un mode explicite.
      resumeRouteName: RouteNames.TeamStack,
    });
    await act(async () => {
      mockButtonHandlers.get("C'est parti !")();
    });

    expect(navigation.reset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: RouteNames.HomeTab }],
    });
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it('TEMOIN — le mode `back` reste le defaut de la feuille payante', async () => {
    // La feuille etait posee SUR l'ecran : « revenir » y retombe pile.
    await renderScreen({ resumeCtaLabel: 'Reprendre' });
    await act(async () => {
      mockButtonHandlers.get('Reprendre')();
    });

    expect(navigation.goBack).toHaveBeenCalledTimes(1);
    expect(navigation.reset).not.toHaveBeenCalled();
  });
});

// La liste vient de getSubscriptionUnlockedCapabilities, miroir de la matrice
// serveur (subscription-permission.ts:43-80) : ces tests verrouillent qu'on
// n'affiche jamais une capacite que l'offre achetee ne debloque pas.
describe('SubscriptionSuccess — L11, ce que l achat debloque et les premiers pas', () => {
  // Tour 7a : les libelles attendus sont ceux de la grille COURTE
  // (`unlocksShort.*`). Le sens ne change pas, la place tenue si.
  it('achat Équipe : le socle Équipe, jamais les capacites Club', async () => {
    const tree = await renderScreen({ offerScope: 'TEAM' });
    const text = renderedText(tree);
    expect(text).toContain('Ton offre débloque :');
    expect(text).toContain('Événements illimités');
    expect(text).toContain('Annonces illimitées');
    expect(text).toContain('Compo & convocations');
    expect(text).toContain('Équipes supplémentaires');
    expect(text).not.toContain('Installations');
    expect(text).not.toContain('Sponsors');
    expect(text).not.toContain('Cotisations');
    expect(text).not.toContain('Rôles du club');
    expect(findTouchableByLabel(tree, 'Gérer mon club')).toBeUndefined();
  });

  it('achat Club : les capacites Club s ajoutent au socle', async () => {
    const tree = await renderScreen({ clubDocumentId: 'club-doc-1', offerScope: 'CLUB' });
    const text = renderedText(tree);
    expect(text).toContain('Toutes les équipes du club');
    expect(text).toContain('Événements illimités');
    expect(text).toContain('Installations');
    expect(text).toContain('Sponsors');
    expect(text).toContain('Cotisations');
    expect(text).toContain('Rôles du club');
  });

  it('portee inconnue (achat Stripe web) : le socle commun, sans carte club', async () => {
    const tree = await renderScreen({ offerLabel: 'FoundClub' });
    const text = renderedText(tree);
    expect(text).toContain('Événements illimités');
    expect(text).not.toContain('Installations');
    expect(findTouchableByLabel(tree, 'Gérer mon club')).toBeUndefined();
  });

  it('« Publier un événement ou un match » ouvre l onglet Planning et invalide l abonnement', async () => {
    const tree = await renderScreen({ offerScope: 'TEAM' });
    await act(async () => {
      findTouchableByLabel(tree, 'Publier un événement ou un match').props.onPress();
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
    const tree = await renderScreen({ offerScope: 'TEAM' });
    await act(async () => {
      findTouchableByLabel(tree, 'Préparer ma compo').props.onPress();
    });
    expect(navigation.navigate).toHaveBeenCalledWith(RouteNames.HomeTab, {
      screen: RouteNames.MyTeamList,
    });
  });

  it('« Publier une annonce de recrutement » passe par les TROIS niveaux (R06)', async () => {
    const tree = await renderScreen({ offerScope: 'TEAM' });
    await act(async () => {
      findTouchableByLabel(tree, 'Publier une annonce de recrutement').props.onPress();
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
    const tree = await renderScreen({ clubDocumentId: 'club-doc-1', offerScope: 'CLUB' });
    await act(async () => {
      findTouchableByLabel(tree, 'Gérer mon club').props.onPress();
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

  it('achat Club sans club connu : pas de carte « Gérer mon club », pas de mensonge', async () => {
    const tree = await renderScreen({ offerScope: 'CLUB' });
    expect(findTouchableByLabel(tree, 'Gérer mon club')).toBeUndefined();
  });
});

// Tour 7a — la mise en page compacte. Ces tests ne decrivent pas un gout : ils
// verrouillent les deux choses qu'une remise en page peut casser en silence,
// une capacite qui disparait et un premier pas qui perd son jalon.
describe('SubscriptionSuccess — tour 7a, grille 2 colonnes et premiers pas', () => {
  it.each([
    ['TEAM', 'club-doc-1'],
    ['CLUB', 'club-doc-1'],
    ['', ''],
  ])('portee %s : une cellule par capacite, avec libelle', async (offerScope, clubId) => {
    const expectedCapabilities = getSubscriptionUnlockedCapabilities(offerScope);
    const tree = await renderScreen({ clubDocumentId: clubId, offerScope });

    const cells = unlockCells(tree);
    // 2 colonnes : chaque cellule occupe la moitie de la largeur de la carte.
    expect(cells).toHaveLength(expectedCapabilities.length);

    // Aucun identifiant ne sort sans texte : chaque cellule porte un libelle
    // non vide, et ce libelle n'est jamais l'identifiant brut.
    const labels = cells.map((cell) => {
      const texts = cell.findAllByType(Text);
      return String(texts[texts.length - 1].props.children || '');
    });
    expect(labels.filter(Boolean)).toHaveLength(expectedCapabilities.length);
    expectedCapabilities.forEach((capabilityId) => {
      expect(labels).not.toContain(capabilityId);
    });
  });

  it('une capacite sans libelle court retombe sur le libelle long (`teams`)', async () => {
    // `teams` n'existe QUE dans l'offre Équipe et n'a pas de version courte :
    // c'est le temoin que le repli fonctionne au lieu de laisser un trou.
    expect(getSubscriptionUnlockedCapabilities('TEAM')).toContain('teams');
    const tree = await renderScreen({ offerScope: 'TEAM' });
    expect(renderedText(tree)).toContain('Équipes supplémentaires');
  });

  it('les 4 premiers pas gardent leur handler et leur jalon funnel', async () => {
    const expectedSources = [
      ['Publier un événement ou un match', 'first-action:events'],
      ['Préparer ma compo', 'first-action:composition'],
      ['Publier une annonce de recrutement', 'first-action:recruitment'],
      ['Gérer mon club', 'first-action:club'],
    ];

    const tree = await renderScreen({ clubDocumentId: 'club-doc-1', offerScope: 'CLUB' });
    expect(tree.root.findAllByType(TouchableOpacity)).toHaveLength(
      // 4 cartes de premiers pas + le lien « Retour à l'accueil ».
      expectedSources.length + 1,
    );

    /* eslint-disable no-restricted-syntax, no-await-in-loop */
    for (const [label, source] of expectedSources) {
      const card = findTouchableByLabel(tree, label);
      expect(card).toBeTruthy();
      await act(async () => {
        card.props.onPress();
      });
      expect(mockTrackFunnelEvent).toHaveBeenCalledWith('success_resume_clicked', { source });
      expect(mockInvalidate).toHaveBeenCalled();
    }
    /* eslint-enable no-restricted-syntax, no-await-in-loop */

    expect(navigation.navigate).toHaveBeenCalledTimes(expectedSources.length);
  });
});

/* ABOFIX2 / T3 — NE PAS PROMETTRE CE QUI N ARRIVERA PAS.

   Mesure de recette du 2026-09-04 : sur un changement d offre vers une offre
   EGALE OU MOINS CHERE, Apple n encaisse rien. Il enregistre une « preference
   de renouvellement » (RevenueCat a note « Changed their renewal preference to
   Club M - Annuel », AUCUN achat) et le changement ne prend effet qu a
   l echeance. L ecran celebrait quand meme « C'est débloqué ! » et listait ce
   que l offre « débloque » — au present.

   Le drapeau arrive en PARAMETRE (`takesEffectAtRenewal`), pose par
   SubscriptionOffers quand le rail rend un changement sans transaction
   encaissee. Cet ecran ne devine rien : il dit ce qu on lui dit. */
describe('SubscriptionSuccess — ABOFIX2/T3, un changement differe ne se celebre pas', () => {
  it('changement DIFFERE : aucune promesse de deblocage immediat', async () => {
    const tree = await renderScreen({
      offerLabel: 'Club M · Annuel',
      offerScope: 'CLUB',
      takesEffectAtRenewal: true,
    });
    const text = renderedText(tree);

    // Les trois mensonges du 04/09, un par un.
    expect(text).not.toContain("C'est débloqué !");
    expect(text).not.toContain('dès maintenant');
    expect(text).not.toContain('Ton offre débloque :');

    // Ce qui est vrai, a la place.
    expect(text).toContain('prochaine échéance');
    expect(text).toContain('Club M · Annuel');
  });

  it('changement DIFFERE : la liste des capacites reste, au FUTUR', async () => {
    // La personne doit toujours voir ce que son nouveau plan lui apportera —
    // on ne lui cache pas l offre, on corrige le TEMPS du verbe.
    const tree = await renderScreen({ offerScope: 'CLUB', takesEffectAtRenewal: true });
    const text = renderedText(tree);

    expect(text).toContain('Installations');
    expect(text).toContain('Sponsors');
    expect(unlockCells(tree)).toHaveLength(
      getSubscriptionUnlockedCapabilities('CLUB').length,
    );
  });

  it('TEMOIN — un achat IMMEDIAT garde exactement sa celebration', async () => {
    // Le garde-fou du lot : la correction ne doit toucher QUE le cas differe.
    const tree = await renderScreen({ offerLabel: 'Équipe · 2 équipes', offerScope: 'TEAM' });
    const text = renderedText(tree);

    expect(text).toContain("C'est débloqué !");
    expect(text).toContain('dès maintenant');
    expect(text).toContain('Ton offre débloque :');
    expect(text).not.toContain('prochaine échéance');
  });

  it('TEMOIN — `takesEffectAtRenewal` absent ou faux = achat immediat', async () => {
    const tree = await renderScreen({ offerScope: 'TEAM', takesEffectAtRenewal: false });
    expect(renderedText(tree)).toContain("C'est débloqué !");
  });
});
