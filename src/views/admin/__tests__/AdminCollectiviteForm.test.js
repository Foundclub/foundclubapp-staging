import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Alert, Text, TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { RouteNames } from '@/navigation/routeNames';

import AdminCollectiviteForm from '../AdminCollectiviteForm';

// 🏛️ D61 (29/09) — ÉCRAN 3 : créer une collectivité depuis la console super-admin.
//
// Ce que ce témoin fige (ROUGE avant l écran 3 : le module n existait pas) :
//   - AIDE (D59) : choisir le type pose son début officiel dans le champ (« Ville de »,
//     « Département de »…) sans écraser un nom déjà tapé, et montre un exemple ;
//   - CONTRÔLE : un nom hors forme officielle, un code INSEE faux, ni INSEE ni SIREN → rien
//     ne part, chaque faute est dite ;
//   - CRÉER : POST /superadmin/collectivites { data } avec les seuls champs remplis, puis
//     le détail de la collectivité créée REMPLACE le formulaire ;
//   - un refus du serveur (409 : code déjà pris) s affiche, on reste sur le formulaire.

const mockPost = jest.fn();
const mockReplace = jest.fn();
// TEXTES-COLLECTIVITES (01/10) — la navigation doublee joue « retirer l ecran » comme React
// Navigation : chaque ecouteur `beforeRemove` est appele, et l ecran ne part (`mockSortie`)
// que si personne n a appele `preventDefault`. `dispatch` rejoue une sortie retenue.
/** @type {Array<(evenement: any) => void>} */
const mockEcouteurs = [];
const mockSortie = jest.fn();
const mockRetirer = (/** @type {any} */ action) => {
  const evenement = {
    data: { action },
    defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true; },
  };
  mockEcouteurs.forEach((ecouteur) => ecouteur(evenement));
  if (!evenement.defaultPrevented) mockSortie(action);
};
const mockNavigation = {
  addListener: (/** @type {string} */ nom, /** @type {any} */ ecouteur) => {
    if (nom === 'beforeRemove') mockEcouteurs.push(ecouteur);
    return () => {
      const i = mockEcouteurs.indexOf(ecouteur);
      if (i >= 0) mockEcouteurs.splice(i, 1);
    };
  },
  dispatch: (/** @type {any} */ action) => mockSortie(action),
  goBack: () => mockRetirer({ type: 'GO_BACK' }),
  navigate: jest.fn(),
  replace: (/** @type {any[]} */ ...args) => {
    mockRetirer({ type: 'REPLACE' });
    mockReplace(...args);
  },
};

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    delete: jest.fn(),
    get: jest.fn(),
    post: (...args) => mockPost(...args),
    put: jest.fn(),
  },
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
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

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);
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

/**
 * Aplati les enfants React en une chaine.
 * @param {any} enfants
 * @returns {string}
 */
const aplatirTexte = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};

const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ n) => aplatirTexte(n.props.children).trim());

/**
 * Laisse tourner react-query jusqu a ce que la condition tienne (borne).
 * @param {() => boolean} condition - Ce qu on attend.
 * @returns {Promise<void>}
 */
const attendre = async (condition) => {
  for (let i = 0; i < 80 && !condition(); i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await new Promise((fin) => { setImmediate(fin); }); });
  }
};

const monter = async () => {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={client}><AdminCollectiviteForm /></QueryClientProvider>,
    );
  });
  return arbre;
};

// eslint-disable-next-line max-len
const champ = (/** @type {any} */ arbre, /** @type {string} */ cle) => arbre.root.findAllByType(TextInput)
  .find((/** @type {any} */ n) => n.props.testID === `admin-collectivite-form-${cle}`);
// eslint-disable-next-line max-len
const taper = async (/** @type {any} */ arbre, /** @type {string} */ cle, /** @type {string} */ texte) => {
  await act(async () => { champ(arbre, cle).props.onChangeText(texte); });
};
const choisir = async (/** @type {any} */ arbre, /** @type {string} */ type) => {
  const puce = arbre.root.find((/** @type {any} */ n) => (
    // eslint-disable-next-line max-len
    n.props?.testID === `admin-collectivite-form-type-${type}` && typeof n.props?.onPress === 'function'));
  await act(async () => { puce.props.onPress(); });
};
const creer = async (/** @type {any} */ arbre) => {
  const bouton = arbre.root.find((/** @type {any} */ n) => (
    n.props?.testID === 'bouton-Créer' && typeof n.props?.onPress === 'function'));
  await act(async () => { bouton.props.onPress(); });
};

beforeEach(() => {
  mockPost.mockReset();
  mockReplace.mockReset();
  mockSortie.mockReset();
  // Les arbres des tests precedents ne sont pas demontes : leurs ecouteurs partent ici.
  mockEcouteurs.length = 0;
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('D61 — écran 3 : créer une collectivité', () => {
  // eslint-disable-next-line max-len
  it('AIDE : le début officiel est posé selon le type, avec un exemple ; un nom tapé est gardé', async () => {
    const arbre = await monter();
    expect(champ(arbre, 'name').props.value).toBe('Ville de ');
    expect(textes(arbre)).toContain(
      // eslint-disable-next-line max-len
      'Forme officielle, par exemple « Ville de Montrivage » ou « Ville d’Aix ». C’est ce nom qu’affiche le bandeau « Offert par… » des clubs.',
    );

    await choisir(arbre, 'departement');
    expect(champ(arbre, 'name').props.value).toBe('Département de ');
    expect(textes(arbre)).toContain(
      // eslint-disable-next-line max-len
      'Forme officielle, par exemple « Département du Var ». C’est ce nom qu’affiche le bandeau « Offert par… » des clubs.',
    );

    await choisir(arbre, 'intercommunalite');
    expect(champ(arbre, 'name').props.value).toBe('Communauté de communes ');

    await taper(arbre, 'name', 'Métropole Aix-Marseille-Provence');
    await choisir(arbre, 'region');
    expect(champ(arbre, 'name').props.value).toBe('Métropole Aix-Marseille-Provence');
  });

  // eslint-disable-next-line max-len
  it('CONTRÔLE : nom hors forme officielle, ni INSEE ni SIREN → rien ne part, chaque faute est dite', async () => {
    const arbre = await monter();
    await taper(arbre, 'name', 'Montrivage');
    await creer(arbre);
    expect(mockPost).not.toHaveBeenCalled();
    expect(textes(arbre)).toEqual(expect.arrayContaining([
      // eslint-disable-next-line max-len
      'Le nom doit suivre la forme officielle, par exemple « Ville de Montrivage » ou « Ville d’Aix » : c’est lui qu’affiche le bandeau « Offert par… ».',
      'Un code INSEE ou un SIREN est obligatoire.',
    ]));

    await taper(arbre, 'name', 'Ville de Montrivage');
    await taper(arbre, 'codeInsee', '9901');
    await creer(arbre);
    expect(mockPost).not.toHaveBeenCalled();
    expect(textes(arbre)).toContain('Code INSEE : 5 caractères (2A ou 2B en Corse).');
  });

  // eslint-disable-next-line max-len
  it('CRÉER : POST /superadmin/collectivites { data }, puis le détail remplace le formulaire', async () => {
    mockPost.mockResolvedValue({
      data: {
        data: {
          // eslint-disable-next-line max-len
          codeInsee: '99001', documentId: 'nouvelle-ville', name: 'Ville de Montrivage', type: 'commune',
        },
      },
    });
    const arbre = await monter();
    await taper(arbre, 'name', ' Ville de Montrivage ');
    await taper(arbre, 'codeInsee', '99001');
    await taper(arbre, 'email', 'sports@montrivage.example.invalid');
    await creer(arbre);
    await attendre(() => mockReplace.mock.calls.length > 0);

    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledWith('/superadmin/collectivites', {
      data: {
        codeInsee: '99001',
        email: 'sports@montrivage.example.invalid',
        name: 'Ville de Montrivage',
        type: 'commune',
      },
    });
    expect(mockReplace).toHaveBeenCalledWith(RouteNames.AdminCollectiviteDetail, {
      collectiviteId: 'nouvelle-ville',
    });
  });

  it('un code déjà pris (409) : le refus s affiche, on reste sur le formulaire', async () => {
    mockPost.mockRejectedValue({
      response: {
        data: { error: { details: { code: 'COLLECTIVITE_ALREADY_EXISTS' }, status: 409 } },
        status: 409,
      },
    });
    const arbre = await monter();
    await choisir(arbre, 'region');
    await taper(arbre, 'name', 'Région Sud');
    await taper(arbre, 'siren', '200 053 403');
    await creer(arbre);
    const refus = 'Une collectivité porte déjà ce code INSEE ou ce SIREN.';
    await attendre(() => textes(arbre).includes(refus));

    expect(mockPost).toHaveBeenCalledWith('/superadmin/collectivites', {
      data: { name: 'Région Sud', siren: '200053403', type: 'region' },
    });
    expect(textes(arbre)).toContain(refus);
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// TEXTES-COLLECTIVITES (lot 1, 01/10/2026) — le formulaire n avait pas de bouton « Annuler »,
// et « retour » effaçait une saisie remplie sans rien demander (vu le 01/10, capture A2c).
// ---------------------------------------------------------------------------
describe('TEXTES-COLLECTIVITES — « Annuler », et « retour » qui demande avant de perdre', () => {
  const annuler = async (/** @type {any} */ arbre) => {
    const bouton = arbre.root.find((/** @type {any} */ n) => (
      n.props?.testID === 'bouton-Annuler' && typeof n.props?.onPress === 'function'));
    await act(async () => { bouton.props.onPress(); });
  };
  const fenetre = () => /** @type {any} */ (Alert.alert).mock.calls.at(-1);

  // eslint-disable-next-line max-len
  it('formulaire intact (seul le début officiel « Ville de ») : « Annuler » sort, sans question', async () => {
    const arbre = await monter();
    await annuler(arbre);
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(mockSortie).toHaveBeenCalledTimes(1);
  });

  // eslint-disable-next-line max-len
  it('saisie commencée : « Annuler » DEMANDE ; « Rester » garde la saisie, « Quitter » sort', async () => {
    const arbre = await monter();
    await taper(arbre, 'codeInsee', '13055');
    await annuler(arbre);

    expect(mockSortie).not.toHaveBeenCalled();
    const [titre, message, boutons] = fenetre();
    expect(titre).toBe('Quitter sans créer la collectivité ?');
    expect(message).toBe('Ce que tu as saisi sera perdu.');
    expect(boutons.map((/** @type {any} */ b) => b.text)).toEqual(['Rester', 'Quitter']);
    expect(boutons[0].style).toBe('cancel');

    await act(async () => { boutons[0].onPress?.(); });
    expect(mockSortie).not.toHaveBeenCalled();
    expect(champ(arbre, 'codeInsee').props.value).toBe('13055');

    await act(async () => { boutons[1].onPress(); });
    expect(mockSortie).toHaveBeenCalledTimes(1);
  });

  it('saisie commencée : le « retour » du téléphone (beforeRemove) DEMANDE aussi', async () => {
    const arbre = await monter();
    await taper(arbre, 'name', 'Ville de Valfleuri');
    await act(async () => { mockNavigation.goBack(); });

    expect(mockSortie).not.toHaveBeenCalled();
    expect(fenetre()[0]).toBe('Quitter sans créer la collectivité ?');
    await act(async () => { fenetre()[2][1].onPress(); });
    expect(mockSortie).toHaveBeenCalledWith({ type: 'GO_BACK' });
  });

  it('collectivité CRÉÉE : le détail remplace le formulaire sans question', async () => {
    // eslint-disable-next-line max-len
    mockPost.mockResolvedValue({ data: { data: { documentId: 'valfleuri', name: 'Ville de Valfleuri' } } });
    const arbre = await monter();
    await taper(arbre, 'name', 'Ville de Valfleuri');
    await taper(arbre, 'codeInsee', '13999');
    await creer(arbre);
    await attendre(() => mockReplace.mock.calls.length > 0);

    expect(Alert.alert).not.toHaveBeenCalled();
    expect(mockSortie).toHaveBeenCalledWith({ type: 'REPLACE' });
  });
});
