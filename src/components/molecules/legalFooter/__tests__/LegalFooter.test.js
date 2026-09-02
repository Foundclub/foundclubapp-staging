import { Linking, Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import LegalFooter from '../LegalFooter';

// HYGIENE points 1 (B4) et 2 (R3), 02/09/2026.
//
// E6 : ce composant n'avait AUCUN test alors qu'il est monte sur les CINQ
// surfaces d'achat de l'app. Ce fichier caracterise d'abord ce qu'il faisait
// (la mention legale, le lien de restauration, la restauration elle-meme), puis
// verrouille les deux exigences des magasins :
//   · B4 / Apple 3.1.2 : des liens CGU et confidentialite FONCTIONNELS, dans le
//     binaire, la ou on vend.
//   · R3 / Apple : « Restaurer mes achats » visible sur l'ecran d'abonnement.
// Le prop `restore={false}` masquait le lien aux 2 endroits qu'Apple regarde.

const mockRestoreAllSubscriptionPurchases = jest.fn();
const mockInvalidateQueries = jest.fn();

let mockRestoreIsPending = false;

jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => ({
    isPending: mockRestoreIsPending,
    mutateAsync: (/** @type {any} */ input) => options.mutationFn(input),
  }),
  useQueryClient: () => ({
    invalidateQueries: (/** @type {any} */ ...args) => mockInvalidateQueries(...args),
  }),
}));

jest.mock('@/domains/subscription/subscriptionPurchaseRail', () => ({
  restoreAllSubscriptionPurchases: (/** @type {any} */ ...args) => (
    mockRestoreAllSubscriptionPurchases(...args)
  ),
}));

jest.mock('@/domains/subscription/subscriptionBilling', () => ({
  getSubscriptionBillingErrorMessage: () => 'message-erreur-abonnement',
}));

jest.mock('@/theme/themeContext', () => ({
  __esModule: true,
  default: () => ({
    Fonts: {
      neutral300: {}, neutral400: {}, p4: {}, textCenter: {},
    },
    Spaces: {
      paddingHorizontal: { 8: {}, 16: {} },
      paddingTop: { 8: {} },
      paddingVertical: { 8: {} },
    },
  }),
}));

/**
 * @param {any} node
 * @param {string[]} acc
 * @returns {string[]}
 */
const collectTexts = (node, acc = []) => {
  if (node === null || node === undefined || node === false) return acc;
  if (typeof node === 'string') {
    acc.push(node);
    return acc;
  }
  if (Array.isArray(node)) {
    node.forEach((child) => collectTexts(child, acc));
    return acc;
  }
  collectTexts(node.children, acc);
  return acc;
};

/** @param {any} props */
const render = (props) => {
  /** @type {any} */
  let tree;
  act(() => {
    // eslint-disable-next-line react/jsx-props-no-spreading -- fabrique de test
    tree = renderer.create(<LegalFooter {...props} />);
  });
  return tree;
};

/**
 * @param {any} tree
 * @param {string} label
 * @returns {any}
 */
const findPressableByLabel = (tree, label) => tree.root
  .findAllByType(TouchableOpacity)
  .find((/** @type {any} */ node) => node
    .findAllByType(Text)
    .flatMap((/** @type {any} */ textNode) => collectTexts(textNode.props.children))
    .join(' ')
    .includes(label));

beforeEach(() => {
  jest.clearAllMocks();
  mockRestoreIsPending = false;
  mockRestoreAllSubscriptionPurchases.mockResolvedValue(undefined);
  mockInvalidateQueries.mockResolvedValue(undefined);
});

describe('LegalFooter — ce qu il faisait deja (caracterisation)', () => {
  it('affiche la mention legale partagee', () => {
    const tree = render({});

    const texts = tree.root.findAllByType(Text)
      .flatMap((/** @type {any} */ node) => collectTexts(node.props.children));

    expect(texts).toContain('Prix TTC. Renouvellement automatique, résiliable à tout moment.');
  });

  it('restaure les achats et rafraichit le contexte abonnement', async () => {
    const tree = render({});

    await act(async () => {
      findPressableByLabel(tree, 'Restaurer mes achats').props.onPress();
    });

    expect(mockRestoreAllSubscriptionPurchases).toHaveBeenCalledTimes(1);
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['app-bootstrap'] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['get-me'] });
  });

  it('annonce la restauration en cours pendant l appel', () => {
    mockRestoreIsPending = true;

    const tree = render({});

    const texts = tree.root.findAllByType(Text)
      .flatMap((/** @type {any} */ node) => collectTexts(node.props.children));

    expect(texts).toContain('Restauration en cours…');
  });
});

describe('LegalFooter — le prop restore reste un vrai interrupteur', () => {
  // SubscriptionOverview porte SON PROPRE bouton de restauration : le masquage
  // y est volontaire. R3 se corrige donc chez les DEUX appelants qui n'en ont
  // pas (SubscriptionOffers, SubscriptionPaywallSheet), pas ici.
  it('masque le lien de restauration quand restore vaut false', () => {
    const tree = render({ restore: false });

    expect(findPressableByLabel(tree, 'Restaurer mes achats')).toBeUndefined();
  });
});

describe('B4 — les liens legaux sont dans le binaire, la ou on vend', () => {
  it('ouvre les CGU', async () => {
    const tree = render({});

    await act(async () => {
      findPressableByLabel(tree, 'Conditions générales').props.onPress();
    });

    expect(Linking.openURL).toHaveBeenCalledWith('https://foundclubpro.com/cgu.html');
  });

  it('ouvre la politique de confidentialite', async () => {
    const tree = render({});

    await act(async () => {
      findPressableByLabel(tree, 'Confidentialité').props.onPress();
    });

    expect(Linking.openURL).toHaveBeenCalledWith('https://foundclubpro.com/cgu.html');
  });

  it('garde les liens legaux meme quand restore vaut false', () => {
    const tree = render({ restore: false });

    expect(findPressableByLabel(tree, 'Conditions générales')).toBeDefined();
    expect(findPressableByLabel(tree, 'Confidentialité')).toBeDefined();
  });
});
