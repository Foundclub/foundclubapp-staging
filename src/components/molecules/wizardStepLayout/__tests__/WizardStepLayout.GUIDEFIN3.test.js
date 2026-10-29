import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import WizardStepLayout from '../WizardStepLayout';

// GUIDE-FINITIONS-3, R2-2 du rejeu 2 (A04-A10) : la bulle du guide couvrait le
// titre et la consigne de chaque écran du tunnel équipe (« Sélectionne au moins
// un·e entraîneur·e », Suivant grisé sans explication, A09). Le gabarit garde
// une place SOUS la consigne pendant une étape `bubbleSlot`, jamais hors du guide.

let mockTour = {};
jest.mock('@/context/useTour', () => ({ useTour: () => mockTour }));

/** @type {any[]} */
const propsDuBouton = [];
/** @type {any[]} */
const propsDuConteneur = [];

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    // Le gabarit appelle `t` de deux facons : avec un repli en chaine
    // (`t('common.back', 'Retour')`) et avec un objet portant `defaultValue`
    // (le compteur d'etape). Les deux rendent le repli, jamais la cle.
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
      if (typeof repli === 'string') return repli;
      if (repli && typeof repli.defaultValue === 'string') return repli.defaultValue;
      return cle;
    },
  }),
}));

// Le retrait bas est PILOTABLE (D53) : le plancher systeme ne se prouve qu'en
// faisant varier l'encoche. 34 est la valeur historique du fichier — tous les
// tests ecrits avant D53 la retrouvent telle quelle. Le prefixe `mock` est
// impose par Jest : lui seul autorise une fabrique a citer une variable
// declaree en dehors d'elle.
const mockRetraitBas = 34;

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: mockRetraitBas, left: 0, right: 0, top: 59,
  }),
}));

// Le VRAI theme, sans le contexte React qui le porte : un mock en Proxy rend les
// echecs Jest illisibles (constat du lot paywall, 2026-08-02) et un objet
// invente masquerait un jeton absent — or ce lot ajoute justement des jetons.
// `Images` est le seul element stube, pour ne pas dependre de la resolution des
// fichiers d'assets.
jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const alignements = jest.requireActual('@/theme/alignements').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();

  return {
    __esModule: true,
    default: () => ({
      Alignments: alignements,
      ApplicationStyle: genererStyles(couleurs),
      Colors: couleurs,
      Fonts: genererPolices(couleurs),
      Images: { arrowLeft: 1, close: 2 },
      Spaces: espaces,
    }),
  };
});

// Passe-plat : ScreenContainer a son propre filet
// (`templates/__tests__/ScreenContainer.tour.test.js`) et tirerait ici quatre
// dependances hors sujet (tour guide, degrade, en-tete de navigation, dock).
// Ses props sont enregistrees parce que le couplage des deux fichiers, lui, est
// un invariant : ce gabarit gere son propre retrait bas.
jest.mock('@/components/templates/ScreenContainer', () => function ScreenContainerMock(
  /** @type {any} */ props,
) {
  propsDuConteneur.push(props);
  return props.children;
});

// Le bouton est rendu comme un vrai element pressable portant son `title` :
// c'est ce qui permet d'appuyer « sur le texte », que le libelle soit porte par
// un Button (aujourd'hui) ou par autre chose (apres une refonte).
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');

  return function ButtonMock(/** @type {any} */ props) {
    propsDuBouton.push(props);
    return reactActuel.createElement(
      PressableRN,
      {
        accessibilityRole: 'button',
        disabled: Boolean(props.disabled || props.isLoading),
        onPress: props.onPress,
      },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});

const rendre = (/** @type {any} */ props) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(createElement(WizardStepLayout, {
      subtitle: 'Sélectionne au moins un·e entraîneur·e pour encadrer cette équipe.',
      title: 'Coachs / Profs',
      ...props,
    }));
  });
  return arbre;
};

const place = (arbre) => arbre.root.findAll((noeud) => noeud.props.testID === 'tour.bubbleSlot'
  && typeof noeud.type === 'string');

describe('R2-2 — place de la bulle sous la consigne du tunnel', () => {
  it('étape du tunnel en cours : la place est rendue, après la consigne', () => {
    mockTour = {
      currentStep: { bubbleSlot: true, id: 'tw7' }, isGuide: true, tourStatus: 'active',
    };
    const arbre = rendre({});
    expect(place(arbre)).toHaveLength(1);
    const json = JSON.stringify(arbre.toJSON());
    expect(json.indexOf('tour.bubbleSlot')).toBeGreaterThan(json.indexOf('Sélectionne au moins'));
  });

  it('hors du guide, ou guide en pause : aucune place (témoin)', () => {
    mockTour = { currentStep: null, isGuide: false, tourStatus: null };
    expect(place(rendre({}))).toHaveLength(0);
    mockTour = {
      currentStep: { bubbleSlot: true, id: 'tw7' }, isGuide: true, tourStatus: 'paused',
    };
    expect(place(rendre({}))).toHaveLength(0);
  });
});
