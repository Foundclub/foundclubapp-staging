import {
  createNavigatorFactory,
  NavigationContainer,
  useNavigationBuilder,
} from '@react-navigation/native';
import { StackRouter } from '@react-navigation/routers';
import { createElement } from 'react';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

// Filet D24 (defaut ⑤ de la recette du 2026-08-07) — OU L'ON ATTERRIT APRES
// AVOIR PUBLIE UNE ANNONCE, et ce qui reste sous les pieds.
//
// 🧨 Pourquoi ce filet est un filet de NAVIGATION et pas un espion sur
// `navigation.replace` : le tunnel amical est une pile IMBRIQUEE, et le detail
// de l'annonce n'appartient PAS a cette pile — il vit dans PrivateNavigator.
// L'action remonte donc d'un niveau avant d'etre traitee, et c'est ce
// bouillonnement, invisible dans le code de l'ecran, qui decide du resultat.
// Un `expect(replace).toHaveBeenCalledWith(...)` aurait ete vert des deux cotes
// du lot, y compris avec le defaut.
//
// Les deux piles sont MINIMALES : le VRAI routeur de `@react-navigation`, le
// VRAI bouillonnement, et zero dependance native (ni `@react-navigation/stack`,
// ni gesture-handler, ni screens). On mesure la mecanique, pas le dessin.
//
// ⚠️ Ce que ce fichier ne prouve pas : que l'ecran de detail charge son annonce.
// Il prouve OU l'on arrive et CE QUI RESTE derriere.

/**
 * Une pile minimale batie sur le routeur reel. Elle rend TOUS ses ecrans, comme
 * une vraie pile : c'est ce qui garde une sous-pile montee — et donc son etat
 * interne LISIBLE — quand elle passe au second plan. L'ecran visible est le
 * dernier.
 */
function PileMinimale(/** @type {any} */ props) {
  const { descriptors, NavigationContent, state } = useNavigationBuilder(StackRouter, props);
  return createElement(
    NavigationContent,
    null,
    state.routes.map((/** @type {any} */ route) => descriptors[route.key].render()),
  );
}

const creerPile = createNavigatorFactory(PileMinimale);

const Racine = creerPile();
const Pile = creerPile();

/** La navigation vue par le recapitulatif — celle qui publie. */
/** @type {any} */
let navigationDuRecap = null;

/**
 * Un ecran temoin : il affiche son nom, et le recapitulatif retient sa
 * navigation pour qu'on puisse rejouer la publication.
 * @param {string} nom Le nom de la route.
 * @returns {any} Le composant d'ecran.
 */
const Ecran = (nom) => function EcranTemoin(/** @type {any} */ { navigation }) {
  if (nom === 'FriendlyMatchWizardRecap') navigationDuRecap = navigation;
  return createElement(Text, null, nom);
};

/**
 * Le tunnel amical : ses 7 etapes sont ici reduites a la premiere et a la
 * derniere — seules celles-la comptent pour l'atterrissage.
 * @returns {any} La pile du tunnel.
 */
function TunnelAmical() {
  return createElement(
    Pile.Navigator,
    { id: undefined, initialRouteName: 'FriendlyMatchWizardTeam' },
    createElement(Pile.Screen, {
      component: Ecran('FriendlyMatchWizardTeam'),
      key: 'team',
      name: 'FriendlyMatchWizardTeam',
    }),
    createElement(Pile.Screen, {
      component: Ecran('FriendlyMatchWizardRecap'),
      key: 'recap',
      name: 'FriendlyMatchWizardRecap',
    }),
  );
}

/**
 * Le tunnel Evenement : son ecran d'accueil, et l'etape 1 qui porte la porte.
 * @returns {any} La pile du tunnel Evenement.
 */
function PileEvenement() {
  return createElement(
    Pile.Navigator,
    { id: undefined, initialRouteName: 'EventDetails' },
    createElement(Pile.Screen, {
      component: Ecran('EventDetails'),
      key: 'details',
      name: 'EventDetails',
    }),
    createElement(Pile.Screen, {
      component: Ecran('EventWizardType'),
      key: 'type',
      name: 'EventWizardType',
    }),
  );
}

/** @type {any} */
let conteneur = null;
/** @type {any} */
let arbre = null;

const monter = () => {
  navigationDuRecap = null;
  act(() => {
    arbre = renderer.create(createElement(
      NavigationContainer,
      { ref: (/** @type {any} */ reference) => { if (reference) conteneur = reference; } },
      createElement(
        Racine.Navigator,
        { id: undefined, initialRouteName: 'HomeTab' },
        createElement(Racine.Screen, {
          component: Ecran('HomeTab'),
          key: 'home',
          name: 'HomeTab',
        }),
        createElement(Racine.Screen, {
          component: PileEvenement,
          key: 'event',
          name: 'EventStack',
        }),
        createElement(Racine.Screen, {
          component: TunnelAmical,
          key: 'wizard',
          name: 'FriendlyMatchWizardStack',
        }),
        createElement(Racine.Screen, {
          component: Ecran('FriendlyMatchAdDetails'),
          key: 'ad',
          name: 'FriendlyMatchAdDetails',
        }),
      ),
    ));
  });
};

/** La pile racine, lisible : « Conteneur>EcranCourant » pour les sous-piles. */
const pileRacine = () => conteneur.getRootState().routes.map((/** @type {any} */ route) => {
  if (!route.state) return route.name;
  const enfant = route.state.routes[route.state.index ?? route.state.routes.length - 1];
  return `${route.name}>${enfant.name}`;
});

/** Le nom de l'ecran au sommet — le dernier rendu, comme dans une vraie pile. */
const ecranAffiche = () => {
  /** @type {string[]} */
  const noms = [];
  const parcourir = (/** @type {any} */ noeud) => {
    if (typeof noeud === 'string') {
      noms.push(noeud);
      return;
    }
    if (Array.isArray(noeud)) {
      noeud.forEach(parcourir);
      return;
    }
    if (noeud?.children) noeud.children.forEach(parcourir);
  };
  parcourir(arbre.toJSON());
  return noms[noms.length - 1];
};

/**
 * Rejoue ce que fait le recapitulatif quand la publication a reussi.
 * @param {string} [entryOrigin] Le tunnel qui a ouvert la porte, s'il y en a un.
 * @returns {void}
 */
const publier = (entryOrigin = '') => {
  act(() => {
    if (entryOrigin) navigationDuRecap.popTo(entryOrigin);
    navigationDuRecap.replace('FriendlyMatchAdDetails', { adId: 'ad-1' });
  });
};

afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
});

describe('D24 ⑤ — apres publication : le detail, et AUCUN tunnel derriere', () => {
  // CHEMIN 1 — la porte D09 : on sort du tunnel Evenement (etape 1) pour entrer
  // dans le tunnel amical. Les DEUX tunnels doivent disparaitre.
  it('entre par la porte du tunnel Evenement, il ne reste ni l un ni l autre', () => {
    monter();
    act(() => conteneur.navigate('EventStack', { screen: 'EventWizardType' }));
    act(() => conteneur.navigate('FriendlyMatchWizardStack', {
      params: { entryOrigin: 'EventStack' },
      screen: 'FriendlyMatchWizardTeam',
    }));
    act(() => conteneur.navigate('FriendlyMatchWizardStack', {
      screen: 'FriendlyMatchWizardRecap',
    }));
    expect(pileRacine()).toEqual([
      'HomeTab', 'EventStack>EventWizardType', 'FriendlyMatchWizardStack>FriendlyMatchWizardRecap',
    ]);

    publier('EventStack');

    expect(ecranAffiche()).toBe('FriendlyMatchAdDetails');
    expect(pileRacine()).toEqual(['HomeTab', 'FriendlyMatchAdDetails']);
  });

  // CE QUE LE DEFAUT FAISAIT, fige pour qu'il ne revienne pas : sans l'origine,
  // le detail s'affichait bien — mais `EventStack` restait dessous, ARRETE SUR
  // L'ETAPE 1 DU TUNNEL. Le premier « Retour » y retombait.
  it('sans l origine, le tunnel Evenement resterait dessous — c est le defaut ⑤', () => {
    monter();
    act(() => conteneur.navigate('EventStack', { screen: 'EventWizardType' }));
    act(() => conteneur.navigate('FriendlyMatchWizardStack', {
      screen: 'FriendlyMatchWizardRecap',
    }));

    publier();

    expect(ecranAffiche()).toBe('FriendlyMatchAdDetails');
    expect(pileRacine()).toEqual(['HomeTab', 'EventStack>EventWizardType', 'FriendlyMatchAdDetails']);
  });

  // CHEMIN 2 — l'entree directe depuis League. Aucune origine : le seul tunnel
  // a effacer est l'amical, et `replace` s'en charge en remontant d'un niveau.
  it('entre directement depuis League, on atterrit sur le detail, pile propre', () => {
    monter();
    act(() => conteneur.navigate('FriendlyMatchWizardStack'));
    act(() => conteneur.navigate('FriendlyMatchWizardStack', {
      screen: 'FriendlyMatchWizardRecap',
    }));

    publier();

    expect(ecranAffiche()).toBe('FriendlyMatchAdDetails');
    expect(pileRacine()).toEqual(['HomeTab', 'FriendlyMatchAdDetails']);
  });

  // Le detail vit dans le navigateur RACINE, pas dans le tunnel : c'est ce qui
  // fait que `replace` emporte le conteneur entier au lieu du seul recap. Si un
  // jour on ajoutait le detail A la pile du tunnel, ce test rougirait — et il
  // FAUT qu'il rougisse, parce que le tunnel resterait alors sous les pieds.
  it('le detail remplace le CONTENEUR du tunnel, pas la seule derniere etape', () => {
    monter();
    act(() => conteneur.navigate('FriendlyMatchWizardStack', {
      screen: 'FriendlyMatchWizardRecap',
    }));

    publier();

    expect(pileRacine()).not.toContain('FriendlyMatchWizardStack>FriendlyMatchWizardTeam');
    expect(conteneur.getRootState().routes).toHaveLength(2);
  });
});
