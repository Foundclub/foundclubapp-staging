import fs from 'fs';
import path from 'path';

import renderer, { act } from 'react-test-renderer';

import traductionsFr from '@/theme/strings/translations/fr';

import { RouteNames } from '@/navigation/routeNames';

import OnboardingGiftScreen from '../OnboardingGiftScreen';

/**
 * LOT CADEAU-2 (28/08) — LA PAGE CADEAU DIT SA DUREE, SA GRATUITE ET SA FIN.
 *
 * 🔴 CE QUE LA RECETTE D'ADEL A TROUVE, et c'est le defaut le plus grave de
 * l'ecran : il annonçait « un abonnement club illimite » SANS AUCUNE BORNE.
 * Quelqu'un pouvait legitimement croire qu'il venait de recevoir un abonnement
 * definitif. Ce n'est pas une question d'esthetique, c'est une promesse
 * trompeuse.
 *
 * ⚠️ LE POINT QUE CE FICHIER PROTEGE VRAIMENT : la duree n'est PAS un texte,
 * c'est une CONSTANTE (`ONBOARDING_GIFT_DURATION_DAYS`). Le temoin
 * « l'ecran suit la constante » la remplace par 30 et exige que l'ecran
 * affiche 30 — un nombre recopie dans une phrase resterait a 7 et le trahirait
 * immediatement.
 */

// La duree que l'ecran doit lire. Le prefixe `mock` est impose par Jest : lui
// seul autorise une fabrique de `jest.mock` a citer une variable exterieure.
let mockDureeCadeau = 7;

jest.mock('@/domains/subscription/onboardingGift', () => ({
  get ONBOARDING_GIFT_DURATION_DAYS() {
    return mockDureeCadeau;
  },
}));

const mockReplace = jest.fn();
const mockNavigate = jest.fn();
const mockClaim = jest.fn();

/** @type {any} */
let mockAuth;

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockAuth,
}));

jest.mock('@/services/subscription/subscriptionService', () => ({
  claimOnboardingGift: (/** @type {any} */ ...args) => mockClaim(...args),
}));

jest.mock('@/domains/subscription/subscriptionRefresh', () => ({
  scheduleSubscriptionStateRefresh: jest.fn(),
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

// ⚠️ CE MOCK-CI INTERPOLE, contrairement a celui de `OnboardingGiftScreen.test.js`.
// Sans lui, `{{count}}` resterait ecrit tel quel et aucun temoin de duree ne
// mesurerait quoi que ce soit. Le pluriel francais d'i18next v4 se resume a
// `_one` pour 1, `_other` sinon.
jest.mock('react-i18next', () => {
  const traductions = jest.requireActual('@/theme/strings/translations/fr').default;

  /**
   * La valeur brute d'une cle pointee, ou `undefined`.
   * @param {string} cle - La cle, segments separes par des points.
   * @returns {any} - La valeur trouvee.
   */
  const resoudre = (cle) => cle.split('.').reduce(
    (/** @type {any} */ noeud, /** @type {string} */ segment) => (
      noeud && typeof noeud === 'object' ? noeud[segment] : undefined
    ),
    traductions,
  );

  return {
    initReactI18next: { init: () => {}, type: '3rdParty' },
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any[]} */ ...reste) => {
        const options = reste.find((valeur) => valeur && typeof valeur === 'object') || {};
        const repli = reste.find((valeur) => typeof valeur === 'string');
        const compte = options.count;
        const cleFinale = compte === undefined ? cle : `${cle}_${compte === 1 ? 'one' : 'other'}`;
        const trouvee = resoudre(cleFinale);
        const brut = typeof trouvee === 'string' ? trouvee : repli;
        return String(brut === undefined ? cle : brut)
          .replace(/\{\{count\}\}/g, String(compte));
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
      Images: { check: 1 },
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
 * @param {any} enfants - Les enfants.
 * @returns {string} - Le texte.
 */
const aplatirTexte = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};

/**
 * Tout le texte visible de l'arbre rendu, concatene.
 * @param {any} arbre - L'arbre rendu.
 * @returns {string} - Le texte.
 */
const texteVisible = (arbre) => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return arbre.root.findAllByType(TexteRN)
    .map((/** @type {any} */ noeud) => aplatirTexte(noeud.props.children))
    .join(' | ');
};

/**
 * Tous les boutons rendus.
 * @param {any} arbre - L'arbre rendu.
 * @returns {any[]} - Les boutons.
 */
const boutons = (arbre) => {
  const { TouchableOpacity } = jest.requireActual('react-native');
  return arbre.root.findAllByType(TouchableOpacity);
};

const rendre = () => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <OnboardingGiftScreen
        navigation={{ navigate: mockNavigate, replace: mockReplace }}
        route={{ params: { resumeRouteName: RouteNames.Welcome } }}
      />,
    );
  });
  return arbre;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockDureeCadeau = 7;
  mockClaim.mockResolvedValue({ granted: true, reason: 'granted' });
  mockAuth = {
    refetchUserData: jest.fn(),
    subscriptionAccessLevel: 'FREE',
    userData: { club: { documentId: 'club-1' }, documentId: 'user-1', role: { type: 'dirigeant' } },
  };
});

describe('CADEAU-2/G1 — la duree se lit sur l\'ecran, et elle vient de la constante', () => {
  test('la duree du cadeau est affichee', () => {
    expect(texteVisible(rendre())).toContain('7 jours offerts');
  });

  test('la duree se lit AVANT la liste des usages', () => {
    const texte = texteVisible(rendre());

    expect(texte.indexOf('7 jours offerts')).toBeGreaterThanOrEqual(0);
    expect(texte.indexOf('7 jours offerts'))
      .toBeLessThan(texte.indexOf('Mettre à jour les infos de votre club'));
  });

  test('l\'ecran SUIT la constante : a 30 jours, il affiche 30', () => {
    mockDureeCadeau = 30;
    const texte = texteVisible(rendre());

    expect(texte).toContain('30 jours offerts');
    expect(texte).not.toContain('7 jours');
  });

  test('a 1 jour, le singulier est correct', () => {
    mockDureeCadeau = 1;

    expect(texteVisible(rendre())).toContain('1 jour offert');
  });
});

describe('CADEAU-2/G1-G2 — aucun nombre de jours n\'est ecrit en dur', () => {
  const racineSources = path.resolve(__dirname, '..', '..', '..');

  test('l\'ecran cadeau ne contient aucun nombre de jours', () => {
    const source = fs.readFileSync(
      path.resolve(racineSources, 'views/subscription/OnboardingGiftScreen.js'),
      'utf8',
    );

    expect(source).not.toMatch(/\d+\s*jours?/i);
  });

  test('les libelles du cadeau ne contiennent aucun nombre de jours', () => {
    const libelles = JSON.stringify(traductionsFr.profile.subscription.gift);

    expect(libelles).not.toMatch(/\d+\s*jours?/i);
    expect(libelles).toContain('{{count}}');
  });
});

describe('CADEAU-2/G2-G3 — la gratuite, l\'absence de carte, et ce qui se passe apres', () => {
  test('« gratuit » est affiche', () => {
    expect(texteVisible(rendre()).toLowerCase()).toContain('gratuit');
  });

  test('« sans carte bancaire » est affiche', () => {
    expect(texteVisible(rendre()).toLowerCase()).toContain('carte bancaire');
  });

  test('la fin du cadeau est dite : les equipes creees restent', () => {
    const texte = texteVisible(rendre()).toLowerCase();

    expect(texte).toContain('à la fin du cadeau');
    expect(texte).toContain('restent');
  });
});

describe('CADEAU-2/G7 — ce qui ne change pas', () => {
  test('UN SEUL bouton dans tout l\'ecran, et c\'est « Débloquer mon offre »', () => {
    const arbre = rendre();

    expect(boutons(arbre)).toHaveLength(1);
    expect(texteVisible(arbre)).toContain('Débloquer mon offre');
  });

  test('les 7 usages d\'Adel sont TOUS la, dans SON ordre', () => {
    const texte = texteVisible(rendre());
    const usages = [
      'infos de votre club',
      'équipes',
      'membres',
      'campagnes de cotisations',
      'événements',
      'matchs',
      'licenciés',
    ];

    const positions = usages.map((usage) => texte.indexOf(usage));
    positions.forEach((position, index) => {
      expect(position).toBeGreaterThanOrEqual(0);
      if (index > 0) {
        expect(position).toBeGreaterThan(positions[index - 1]);
      }
    });
  });

  test('le titre et le cadeau annonce ne bougent pas', () => {
    const texte = texteVisible(rendre());

    expect(texte).toContain('Félicitations');
    expect(texte.toLowerCase()).toContain('illimité');
  });
});
