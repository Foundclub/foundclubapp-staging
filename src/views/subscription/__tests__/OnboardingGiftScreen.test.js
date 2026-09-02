import renderer, { act } from 'react-test-renderer';

import { RouteNames } from '@/navigation/routeNames';

import OnboardingGiftScreen from '../OnboardingGiftScreen';

/**
 * LOT ESSAI (28/08) — E4 et E5 : LA PAGE CADEAU.
 *
 * Demande d'Adel, mot pour mot : « si le dirigeant ne s'est pas abonné, on lui
 * met une page félicitation, vous avez reçu un cadeau — un abonnement club
 * illimité — avec une description [...]. Et là un bouton, et rien d'autre :
 * "Débloquer mon offre", qui débloque l'abonnement illimité. Après, c'est la
 * suite logique comme d'habitude. »
 *
 * ⛔ CE QUE CE FICHIER VÉRIFIE AUSSI PAR L'ABSENCE : pas de « plus tard », pas
 * de croix, pas de second bouton. C'est une consigne explicite, et c'est le
 * genre de détail qu'un lot suivant rajoute « pour être gentil ».
 */

const mockReplace = jest.fn();
const mockNavigate = jest.fn();
const mockClaim = jest.fn();
const mockInvalidate = jest.fn();

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
  scheduleSubscriptionStateRefresh: (/** @type {any} */ ...args) => mockInvalidate(...args),
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

jest.mock('react-i18next', () => {
  const traductions = jest.requireActual('@/theme/strings/translations/fr').default;
  return {
    initReactI18next: { init: () => {}, type: '3rdParty' },
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {string} */ repli) => {
        const valeur = cle.split('.').reduce(
          (/** @type {any} */ noeud, /** @type {string} */ segment) => (
            noeud && typeof noeud === 'object' ? noeud[segment] : undefined
          ),
          traductions,
        );
        return typeof valeur === 'string' ? valeur : repli;
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
  mockClaim.mockResolvedValue({ granted: true, reason: 'granted' });
  mockAuth = {
    refetchUserData: jest.fn(),
    subscriptionAccessLevel: 'FREE',
    userData: { club: { documentId: 'club-1' }, documentId: 'user-1', role: { type: 'dirigeant' } },
  };
});

describe('ESSAI/E4 — la page cadeau dit ce qu\'Adel a demandé, et rien de plus', () => {
  test('le titre annonce le cadeau : un abonnement club illimité', () => {
    const texte = texteVisible(rendre());

    expect(texte).toContain('Félicitations');
    expect(texte).toContain('cadeau');
    expect(texte.toLowerCase()).toContain('illimité');
  });

  test('les 7 usages listés par Adel sont là, DANS SON ORDRE', () => {
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
        // L'ordre est une consigne, pas une préférence de mise en page.
        expect(position).toBeGreaterThan(positions[index - 1]);
      }
    });
  });

  test('UN SEUL bouton, et c\'est « Débloquer mon offre »', () => {
    const arbre = rendre();

    expect(boutons(arbre)).toHaveLength(1);
    expect(texteVisible(arbre)).toContain('Débloquer mon offre');
  });

  test('aucune porte de sortie : ni « plus tard », ni croix, ni « passer »', () => {
    const texte = texteVisible(rendre()).toLowerCase();

    expect(texte).not.toContain('plus tard');
    expect(texte).not.toContain('passer');
    expect(texte).not.toContain('continuer gratuitement');
    expect(texte).not.toContain('non merci');
  });
});

describe('ESSAI/E5 — après l\'appui, la suite logique et rien d\'autre', () => {
  test('le bouton réclame le cadeau puis reprend le parcours', async () => {
    const arbre = rendre();

    await act(async () => {
      boutons(arbre)[0].props.onPress();
    });

    expect(mockClaim).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith(RouteNames.Welcome, undefined);
  });

  test('même si le serveur refuse, le dirigeant AVANCE : jamais de cul-de-sac', async () => {
    mockClaim.mockResolvedValue({ granted: false, reason: 'already-claimed' });
    const arbre = rendre();

    await act(async () => {
      boutons(arbre)[0].props.onPress();
    });

    expect(mockReplace).toHaveBeenCalledWith(RouteNames.Welcome, undefined);
  });

  test('même si l\'appel échoue, le dirigeant AVANCE', async () => {
    mockClaim.mockRejectedValue(new Error('reseau coupe'));
    const arbre = rendre();

    await act(async () => {
      boutons(arbre)[0].props.onPress();
    });

    expect(mockReplace).toHaveBeenCalledWith(RouteNames.Welcome, undefined);
  });

  test('deux appuis rapides ne réclament qu\'une fois', async () => {
    const arbre = rendre();

    await act(async () => {
      boutons(arbre)[0].props.onPress();
      boutons(arbre)[0].props.onPress();
    });

    expect(mockClaim).toHaveBeenCalledTimes(1);
  });
});

describe('ESSAI/E1 — qui voit cette page, et qui ne la voit pas', () => {
  test('un dirigeant DÉJÀ abonné ne la voit pas : il passe directement à la suite', () => {
    mockAuth.subscriptionAccessLevel = 'CLUB';
    const arbre = rendre();

    expect(texteVisible(arbre)).toBe('');
    expect(mockReplace).toHaveBeenCalledWith(RouteNames.Welcome, undefined);
  });

  test('un entraîneur ne la voit pas : le cadeau est un abonnement CLUB', () => {
    mockAuth.userData.role = { type: 'entraineur' };
    const arbre = rendre();

    expect(texteVisible(arbre)).toBe('');
    expect(mockReplace).toHaveBeenCalledWith(RouteNames.Welcome, undefined);
  });

  test('un dirigeant sans club ne la voit pas : rien à quoi rattacher le cadeau', () => {
    mockAuth.userData.club = null;
    const arbre = rendre();

    expect(texteVisible(arbre)).toBe('');
    expect(mockReplace).toHaveBeenCalledWith(RouteNames.Welcome, undefined);
  });

  test('le club du bootstrap suffit, même si le profil ne le porte pas encore', () => {
    // Les deux sources dérivent du MÊME `user.club` côté serveur : lire les deux
    // ne peut pas diverger de ce que fera `claimOnboardingGift`.
    mockAuth.userData.club = null;
    mockAuth.clubVerificationSummary = { clubDocumentId: 'club-1' };
    const arbre = rendre();

    expect(texteVisible(arbre)).toContain('Félicitations');
  });
});

describe('ABO-FIX/G2 — un cadeau qui echoue ne disparait plus en silence', () => {
  /**
   * Le `catch` de cet ecran etait VIDE, et c'est ce vide qui a cache une panne
   * de production 5 jours durant : le serveur repondait 200 sur un refus, la
   * reponse etait jetee, ZERO cadeau accorde et pas une trace nulle part.
   * Ces deux temoins tiennent le nouveau contrat SANS toucher a l'ancien :
   * le dirigeant avance toujours, et il n'y a toujours qu'un seul bouton.
   * @returns {any} L'espion pose sur Alert.alert.
   */
  const espionnerAlerte = () => {
    const { Alert } = jest.requireActual('react-native');
    return jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  };

  test('une anomalie serveur est DITE au dirigeant — et il avance quand meme', async () => {
    const alerte = espionnerAlerte();
    // Le 422 du serveur : l'intercepteur du client rend le corps tel quel.
    mockClaim.mockRejectedValue({ granted: false, reason: 'club-missing' });
    const arbre = rendre();

    await act(async () => {
      boutons(arbre)[0].props.onPress();
    });

    expect(alerte).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith(RouteNames.Welcome, undefined);
    // La consigne d'Adel tient : toujours UN seul bouton, aucune sortie ajoutee.
    expect(boutons(arbre)).toHaveLength(1);
    alerte.mockRestore();
  });

  test('un refus LEGITIME reste silencieux : deja recu n est pas une panne', async () => {
    const alerte = espionnerAlerte();
    mockClaim.mockRejectedValue({ granted: false, reason: 'already-claimed' });
    const arbre = rendre();

    await act(async () => {
      boutons(arbre)[0].props.onPress();
    });

    expect(alerte).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith(RouteNames.Welcome, undefined);
    alerte.mockRestore();
  });
});
