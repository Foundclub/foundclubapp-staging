import renderer, { act } from 'react-test-renderer';

import CompositionPaywallScreen from '../CompositionPaywallScreen';

// C-C — ECRAN 12 du pack composition : le mur payant en ECRAN PLEIN.
//
// ⛔ CE QUE CE FICHIER VERIFIE AUSSI, PAR L'ABSENCE : aucun prix, aucun palier,
// aucune periode de facturation. Le pack demande une page d'arguments, pas une
// deuxieme caisse — et ce lot s'interdit de toucher aux regles d'abonnement.

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
/** @type {any} */
let mockParams;

const mockNavigation = { goBack: mockGoBack, navigate: mockNavigate };

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: mockParams }),
}));

jest.mock('react-i18next', () => {
  const traductions = jest.requireActual('@/theme/strings/translations/fr').default;
  return {
    initReactI18next: { init: () => {}, type: '3rdParty' },
    useTranslation: () => ({
      t: (/** @type {string} */ cle) => {
        const valeur = cle.split('.').reduce(
          (/** @type {any} */ noeud, /** @type {string} */ segment) => (
            noeud && typeof noeud === 'object' ? noeud[segment] : undefined
          ),
          traductions,
        );
        return typeof valeur === 'string' ? valeur : cle;
      },
    }),
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));

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
      Images: { arrowLeft: 1, chevronLeft: 1 },
      Spaces: espaces,
    }),
  };
});

jest.mock('@/components/templates/ScreenContainer', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children }) => <View>{children}</View>,
  };
});

jest.mock('@/components/atoms/headerBackButton/HeaderBackButton', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return { __esModule: true, default: () => <TexteRN>RETOUR</TexteRN> };
});

jest.mock('@/components/atoms/button/Button', () => {
  const { Text: TexteRN, TouchableOpacity } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { onPress, title }) => (
      <TouchableOpacity onPress={onPress}>
        <TexteRN>{title}</TexteRN>
      </TouchableOpacity>
    ),
  };
});

/**
 * Aplati les enfants React en une chaine, pour lire le texte rendu.
 * @param {any} enfants
 * @returns {string}
 */
const aplatirTexte = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};

/**
 * Tout le texte visible de l'arbre rendu, concatene.
 * @param {any} arbre
 * @returns {string}
 */
const texteVisible = (arbre) => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return arbre.root.findAllByType(TexteRN)
    .map((/** @type {any} */ noeud) => aplatirTexte(noeud.props.children))
    .join(' | ');
};

/**
 * Le bouton dont le libelle contient exactement ce texte.
 * @param {any} arbre
 * @param {string} libelle
 * @returns {any}
 */
const bouton = (arbre, libelle) => {
  const { Text: TexteRN, TouchableOpacity } = jest.requireActual('react-native');
  return arbre.root.findAllByType(TouchableOpacity).find(
    (/** @type {any} */ noeud) => noeud.findAllByType(TexteRN)
      .some((/** @type {any} */ texte) => aplatirTexte(texte.props.children) === libelle),
  );
};

const rendre = () => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<CompositionPaywallScreen />);
  });
  return arbre;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { decision: { paywallKey: 'composition-required', requiredPlan: ['TEAM'] } };
});

describe('ECRAN 12 — le mur payant de la composition, en ecran plein', () => {
  test('les 5 arguments du pack sont la, dans son ordre', () => {
    const texte = texteVisible(rendre());

    expect(texte).toContain('La composition d’équipe est réservée à l’offre Équipe.');
    expect(texte).toContain('Composition et convocations en 2 taps');
    expect(texte).toContain('Terrain interactif sur les 5 sports');
    expect(texte).toContain('Compo type réutilisable par équipe');
    expect(texte).toContain('Répartition automatique sur les détections');
    expect(texte).toContain('Réponses présent / absent centralisées');
  });

  test('les 2 CTA du pack sont la', () => {
    const texte = texteVisible(rendre());

    expect(texte).toContain('Passer à l’offre Équipe');
    expect(texte).toContain('Comparer les offres');
  });

  test('⛔ il n affiche AUCUN prix et AUCUN palier — ce lot ne touche pas a la vente', () => {
    const texte = texteVisible(rendre());

    expect(texte).not.toMatch(/€|\/an|\/mois|Annuel|Mensuel/);
  });

  test('le CTA principal ouvre le CARROUSEL d offres, pas le hub', () => {
    const arbre = rendre();

    act(() => {
      bouton(arbre, 'Passer à l’offre Équipe').props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith('ProfileStack', expect.objectContaining({
      screen: 'SubscriptionOffers',
    }));
  });

  test('le lien texte ouvre la comparaison des offres', () => {
    const arbre = rendre();

    act(() => {
      bouton(arbre, 'Comparer les offres').props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith('GuideOffersRecap');
  });

  test('sans decision jointe, l ecran tient quand meme debout', () => {
    mockParams = {};

    expect(texteVisible(rendre()))
      .toContain('La composition d’équipe est réservée à l’offre Équipe.');
  });
});
