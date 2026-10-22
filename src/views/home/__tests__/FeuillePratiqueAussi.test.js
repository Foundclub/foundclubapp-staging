import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import FeuillePratiqueAussi from '../FeuillePratiqueAussi';

/**
 * PAR-L12 (13/10, design parent E27, décision D6 A d'Adel du 12/10) — LA FEUILLE « TU PRATIQUES
 * AUSSI UN SPORT ? ». Le premier appui d'un compte Parent sur « Basculer en mode joueur » l'ouvre :
 * son compte passe de Parent à Joueur (la MÊME mise à jour que le choix du rôle,
 * `UserRole.js` : `updateMe({ role })`), il GARDE ses enfants, et il reste en mode parent — la
 * bascule apparaît sur la position « Parent ». Un échec ne change rien et le dit.
 */

jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));

const mockAuth = { refetchUserData: jest.fn(), setDisplayMode: jest.fn() };
jest.mock('@/domains/auth/useAuth', () => ({ __esModule: true, default: () => mockAuth }));

jest.mock('@/services/auth/authQueries', () => ({
  useGetRoles: () => ({
    data: [
      { documentId: 'r-auth', name: 'Authenticated', type: 'authenticated' },
      { documentId: 'r-parent', name: 'Parent', type: 'parent' },
      { documentId: 'r-joueur', name: 'Joueur', type: 'joueur' },
    ],
  }),
}));
jest.mock('@/services/auth/authService', () => ({ updateMe: jest.fn() }));

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const alignements = jest.requireActual('@/theme/alignements').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();
  const theme = {
    Alignments: alignements,
    ApplicationStyle: genererStyles(couleurs),
    Colors: couleurs,
    Fonts: genererPolices(couleurs),
    Images: {},
    Spaces: espaces,
  };
  return { __esModule: true, default: () => theme };
});

jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children, footerComponent, isVisible }) => (isVisible ? (
      <View>
        {children}
        {footerComponent}
      </View>
    ) : null),
  };
});

jest.mock('@/components/atoms/button/Button', () => {
  const { Text: TexteRN, TouchableOpacity } = jest.requireActual('react-native');
  return {
    __esModule: true,
    // `Button` ne transmet pas `testID` : la doublure non plus. On trouve un bouton à son libellé.
    default: (/** @type {any} */ { disabled, onPress, title }) => (
      <TouchableOpacity accessibilityRole="button" disabled={disabled} onPress={onPress}>
        <TexteRN>{title}</TexteRN>
      </TouchableOpacity>
    ),
  };
});

const { updateMe } = jest.requireMock('@/services/auth/authService');

/** @type {renderer.ReactTestRenderer[]} */
const arbres = [];
afterEach(() => {
  arbres.splice(0).forEach((arbre) => act(() => { arbre.unmount(); }));
  jest.clearAllMocks();
});

/**
 * Monte la feuille ouverte.
 * @param {string[]} prenoms - Les prénoms des enfants.
 * @returns {{ arbre: any, onClose: jest.Mock, onDone: jest.Mock }} - Le rendu et ses rappels.
 */
const monter = (prenoms) => {
  const onClose = jest.fn();
  const onDone = jest.fn();
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>
        <FeuillePratiqueAussi isVisible onClose={onClose} onDone={onDone} prenoms={prenoms} />
      </QueryClientProvider>,
    );
  });
  arbres.push(arbre);
  return { arbre, onClose, onDone };
};

const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ noeud) => [].concat(noeud.props.children).join(''));

const appuyer = async (/** @type {any} */ arbre, /** @type {string} */ libelle) => {
  const cible = arbre.root.find((/** @type {any} */ noeud) => typeof noeud.type === 'string'
    && noeud.props.accessibilityRole === 'button'
    && noeud.findAllByType(Text).some((/** @type {any} */ texte) => (
      [].concat(texte.props.children).join('') === libelle
    )));
  await act(async () => { cible.props.onClick(); });
};

test('elle dit ce qui change et ce qui reste, enfants nommés (E27)', () => {
  const { arbre } = monter(['Anissa', 'Martin']);

  expect(textes(arbre)).toEqual(expect.arrayContaining([
    'Tu pratiques aussi un sport ?',
    'Ton compte passe de Parent à Joueur.',
    'Tu gardes Anissa et Martin, leurs fiches et leurs demandes.',
    'Tu peux rejoindre une équipe et participer à des événements.',
    'En haut de l’accueil, tu passes de « Joueur » à « Parent » d’un geste.',
    'Oui, je pratique aussi',
    'Pas maintenant',
  ]));
});

test('« Oui » : le compte passe en Joueur, RESTE en mode parent, puis est relu', async () => {
  updateMe.mockResolvedValue({ data: {} });
  const ordre = [];
  mockAuth.setDisplayMode.mockImplementation((mode) => ordre.push(`mode:${mode}`));
  mockAuth.refetchUserData.mockImplementation(() => { ordre.push('relu'); });
  const { arbre, onDone } = monter(['Anissa']);

  await appuyer(arbre, 'Oui, je pratique aussi');

  expect(updateMe).toHaveBeenCalledTimes(1);
  expect(updateMe.mock.calls[0][0]).toEqual({ role: 'r-joueur' });
  expect(ordre).toEqual(['mode:parent', 'relu']);
  expect(onDone).toHaveBeenCalledTimes(1);
});

test('le serveur refuse : rien ne change, et elle le dit', async () => {
  updateMe.mockRejectedValue(new Error('403'));
  const { arbre, onDone } = monter(['Anissa']);

  await appuyer(arbre, 'Oui, je pratique aussi');

  expect(textes(arbre)).toContain('Ton compte n’a pas pu changer. Réessaie.');
  expect(mockAuth.setDisplayMode).not.toHaveBeenCalled();
  expect(onDone).not.toHaveBeenCalled();
});

test('« Pas maintenant » referme, sans rien envoyer', async () => {
  const { arbre, onClose } = monter([]);

  await appuyer(arbre, 'Pas maintenant');

  expect(onClose).toHaveBeenCalledTimes(1);
  expect(updateMe).not.toHaveBeenCalled();
  expect(textes(arbre)).toContain('Tu gardes tes enfants, leurs fiches et leurs demandes.');
});

// RESA-INSCRIPTION (19/10/2026) — LA MÊME FEUILLE, POUR UN COMPTE NÉ « POUR UN COMPLEXE » : il n'a
// aucun rôle sportif (rôle provisoire). « Voir l'app en joueur », sur l'accueil de son complexe,
// l'ouvre au lieu d'un accueil de joueur sans rôle : il devient Joueur par la MÊME mise à jour, il
// GARDE son complexe (relation `gestionnaires`, rien à voir avec le rôle), et il n'y a pas de mode
// parent à poser. Le parcours d'inscription du joueur (nom, date de naissance) suit, à l'accueil.
describe('RESA-INSCRIPTION — la variante « complexe » (compte sans rôle sportif)', () => {
  const monterComplexe = () => {
    const onClose = jest.fn();
    const onDone = jest.fn();
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    /** @type {any} */
    let arbre;
    act(() => {
      arbre = renderer.create(
        <QueryClientProvider client={client}>
          <FeuillePratiqueAussi isVisible onClose={onClose} onDone={onDone} pourLeComplexe />
        </QueryClientProvider>,
      );
    });
    arbres.push(arbre);
    return { arbre, onClose, onDone };
  };

  test('elle dit ce qui change et ce qui reste : le complexe, pas d’enfants', () => {
    const { arbre } = monterComplexe();
    const lus = textes(arbre);

    expect(lus).toEqual(expect.arrayContaining([
      'Tu pratiques aussi un sport ?',
      'Ton compte devient Joueur.',
      'Tu gardes ton complexe et tes droits de gestionnaire.',
      'Tu peux rejoindre une équipe et participer à des événements.',
      'Le bouton en haut de l’accueil te fait passer du mode complexe au mode joueur, et retour.',
      'Oui, je pratique aussi',
      'Pas maintenant',
    ]));
    expect(lus).not.toContain('Ton compte passe de Parent à Joueur.');
    expect(lus).not.toContain('Tu gardes tes enfants, leurs fiches et leurs demandes.');
  });

  test('« Oui » : le compte passe en Joueur, sans mode parent, puis est relu', async () => {
    updateMe.mockResolvedValue({ data: {} });
    const { arbre, onDone } = monterComplexe();

    await appuyer(arbre, 'Oui, je pratique aussi');

    expect(updateMe.mock.calls[0][0]).toEqual({ role: 'r-joueur' });
    expect(mockAuth.setDisplayMode).not.toHaveBeenCalled();
    expect(mockAuth.refetchUserData).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

// RESA-BASCULE (20/10/2026, planche RB-3 état 2b, T1 A) — LA MÊME FEUILLE, POUR UN PARENT QUI GÈRE
// UN COMPLEXE : la feuille de PAR-L12, plus la ligne du complexe de RESA-INSCRIPTION (rien n'est
// perdu, ni l'enfant, ni le complexe). « Oui » le fait Joueur et l'accueil passe en JOUEUR (2c,
// « c'est ce que le bouton promettait », maquette parent E27) : le mode parent n'est PAS posé. Les
// parents sans complexe gardent la feuille d'avant (écart PAR-L12 relayé, hors de ce lot).
describe('RESA-BASCULE — la variante du parent gérant (gereUnComplexe)', () => {
  const monterGerant = () => {
    const onDone = jest.fn();
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    /** @type {any} */
    let arbre;
    act(() => {
      arbre = renderer.create(
        <QueryClientProvider client={client}>
          <FeuillePratiqueAussi
            gereUnComplexe
            isVisible
            onClose={jest.fn()}
            onDone={onDone}
            prenoms={['Léa']}
          />
        </QueryClientProvider>,
      );
    });
    arbres.push(arbre);
    return { arbre, onDone };
  };

  test('2b · ses lignes, dans l ordre de la planche : l enfant, PUIS le complexe', () => {
    const { arbre } = monterGerant();
    expect(textes(arbre).slice(0, 6)).toEqual([
      'Tu pratiques aussi un sport ?',
      'Ton compte passe de Parent à Joueur.',
      'Tu gardes Léa, sa fiche et ses demandes.',
      'Tu gardes ton complexe et tes droits de gestionnaire.',
      'Tu peux rejoindre une équipe et participer à des événements.',
      'En haut de l’accueil, tu passes de « Joueur » à « Parent » d’un geste.',
    ]);
  });

  test('T1 A · « Oui » : compte Joueur, accueil JOUEUR, puis le compte est relu', async () => {
    updateMe.mockResolvedValue({ data: {} });
    const ordre = [];
    mockAuth.setDisplayMode.mockImplementation((mode) => ordre.push(`mode:${mode}`));
    mockAuth.refetchUserData.mockImplementation(() => { ordre.push('relu'); });
    const { arbre, onDone } = monterGerant();

    await appuyer(arbre, 'Oui, je pratique aussi');

    expect(updateMe.mock.calls[0][0]).toEqual({ role: 'r-joueur' });
    expect(ordre).toEqual(['mode:null', 'relu']);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
