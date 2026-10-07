import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text, TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import CollectiviteTargetSearch from '../components/CollectiviteTargetSearch';

// 🔎 VT18E (07/10/2026), point 1 — LA RECHERCHE DE LA CONSOLE PART UNE FOIS, QUAND ON A FINI DE
// TAPER. Tournée T18 (relais du 07/10, 14:50) : « Recette Stripe » tapé lettre à lettre a envoyé
// SEPT recherches de clubs (« Re », « Rec », « Rece »… « Recette Stripe »), servies en parallèle
// en 3,7 à 17,3 s ; « Recette Mairie », NEUF recherches de comptes. Ce témoin exige (ROUGE avant
// le lot) :
//   - UN SEUL envoi, avec le texte complet, une fois la frappe arrêtée (anti-rebond) ;
//   - l envoi porte un signal d annulation : une recherche dépassée est coupée, pas attendue ;
//   - un club se cherche à partir de TROIS lettres (deux lettres ne sont servies par aucun index
//     trigramme : 488 ms au banc de 223 118 clubs, contre ~2 ms dès la troisième) ; un compte,
//     toujours à partir de deux.

const mockPost = jest.fn();

jest.setTimeout(30000);

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    delete: jest.fn(),
    get: jest.fn(),
    post: (/** @type {any[]} */ ...args) => mockPost(...args),
    put: jest.fn(),
  },
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {any[]} */ ...args) => jest.requireActual('i18next').t(...args),
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
      Images: {},
      Spaces: espaces,
    }),
  };
});
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      { disabled: props.disabled, onPress: props.onPress, testID: `bouton-${props.title}` },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});

const RECHERCHE_CLUB = '/superadmin/relations/api%3A%3Aclub.club/search';
const RECHERCHE_COMPTE = '/superadmin/relations/plugin%3A%3Ausers-permissions.user/search';

/**
 * Monte la recherche seule.
 * @param {'club' | 'user'} kind - Ce qu on cherche.
 * @returns {Promise<any>} L arbre.
 */
const monter = async (kind) => {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0, retry: false } } });
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>
        <CollectiviteTargetSearch
          deja={new Set()}
          dejaTexte="Déjà rattaché"
          enCours={false}
          kind={kind}
          libelleAction="Rattacher"
          onChoisir={jest.fn()}
          placeholder="Rattacher un club : son nom"
          testID="recherche"
        />
      </QueryClientProvider>,
    );
  });
  return arbre;
};

/**
 * Tape un texte lettre à lettre, sans pause entre les lettres.
 * @param {any} arbre - L arbre.
 * @param {string} texte - Le texte complet.
 * @returns {Promise<void>}
 */
const taperLettreALettre = async (arbre, texte) => {
  const champ = arbre.root.findAllByType(TextInput)[0];
  for (let fin = 1; fin <= texte.length; fin += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { champ.props.onChangeText(texte.slice(0, fin)); });
  }
};

/** Laisse passer la frappe arrêtée (en TEMPS, borné), puis la réponse. */
const laisserFiler = async () => {
  await act(async () => { await new Promise((fin) => { setTimeout(fin, 700); }); });
  for (let i = 0; i < 10; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await new Promise((fin) => { setImmediate(fin); }); });
  }
};

const envoisVers = (/** @type {string} */ route) => mockPost.mock.calls
  .filter((/** @type {any[]} */ appel) => appel[0] === route);

beforeEach(() => {
  mockPost.mockReset();
  mockPost.mockResolvedValue({ data: { data: [] } });
});

describe('VT18E — la recherche de la console part une fois', () => {
  it('« Recette Stripe » tapé lettre à lettre : UN envoi, avec le texte complet', async () => {
    const arbre = await monter('club');
    await taperLettreALettre(arbre, 'Recette Stripe');
    await laisserFiler();

    const envois = envoisVers(RECHERCHE_CLUB);
    expect(envois.map((/** @type {any[]} */ appel) => appel[1].q)).toEqual(['Recette Stripe']);
  });

  it('l envoi porte un signal d annulation', async () => {
    const arbre = await monter('user');
    await taperLettreALettre(arbre, 'Recette Mairie');
    await laisserFiler();

    const envois = envoisVers(RECHERCHE_COMPTE);
    expect(envois).toHaveLength(1);
    expect(envois[0][2]?.signal).toBeInstanceOf(AbortSignal);
  });

  it('un club se cherche dès trois lettres ; un compte, dès deux', async () => {
    const club = await monter('club');
    await taperLettreALettre(club, 'Re');
    await laisserFiler();
    expect(envoisVers(RECHERCHE_CLUB)).toHaveLength(0);
    const textes = club.root.findAllByType(Text).map((/** @type {any} */ n) => n.props.children);
    expect(textes).toEqual([]);

    const compte = await monter('user');
    await taperLettreALettre(compte, 'Ma');
    await laisserFiler();
    expect(envoisVers(RECHERCHE_COMPTE).map((/** @type {any[]} */ appel) => appel[1].q))
      .toEqual(['Ma']);
  });
});
