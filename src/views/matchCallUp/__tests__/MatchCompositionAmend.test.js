import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import MatchCompositionAmend from '../MatchCompositionAmend';

// C-B — ECRAN 8 du pack composition : « Modifier une compo publiee ».
//
// 🔒 LE TEMOIN QUI COMPTE est ici : republier n'efface AUCUNE reponse deja
// donnee. Il est verifie SUR LA CHARGE REELLEMENT ENVOYEE au serveur — pas sur
// une intention, sur les octets qui partent.

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockPublish = jest.fn();
const mockSaveDraft = jest.fn();
/** @type {any} */
let mockRouteParams = {};
/** @type {any} */
let mockComposition;

// 🧨 L'objet `navigation` est FIGE : le recreer a chaque rendu relance les
// effets qui en dependent et Jest part en boucle infinie, sans message utile.
const mockNavigation = { goBack: mockGoBack, navigate: mockNavigate };

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: mockRouteParams }),
}));

jest.mock('react-i18next', () => {
  const traductions = jest.requireActual('@/theme/strings/translations/fr').default;
  return {
    initReactI18next: { init: () => {}, type: '3rdParty' },
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ options) => {
        const lire = (/** @type {string} */ chemin) => chemin.split('.').reduce(
          (/** @type {any} */ noeud, /** @type {string} */ segment) => (
            noeud && typeof noeud === 'object' ? noeud[segment] : undefined
          ),
          traductions,
        );
        const compte = options?.count;
        let valeur = lire(cle);
        if (typeof valeur !== 'string' && compte !== undefined) {
          valeur = lire(`${cle}${compte === 1 ? '_one' : '_other'}`);
        }
        if (typeof valeur !== 'string') return cle;
        return valeur.replace(/{{(\w+)}}/g, (_correspondance, nom) => (
          options && options[nom] !== undefined ? String(options[nom]) : ''
        ));
      },
    }),
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));

jest.mock('@/services/event/eventQueries', () => ({
  useGetEventTeamComposition: () => ({ data: mockComposition, isFetching: false }),
}));

jest.mock('@/services/event/eventService', () => ({
  publishEventConvocation: (/** @type {any} */ ...args) => mockPublish(...args),
  saveEventCompositionDraft: (/** @type {any} */ ...args) => mockSaveDraft(...args),
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
      Images: { arrowLeft: 1, check: 1, chevronLeft: 1 },
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

jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { name }) => <TexteRN>{`AVATAR:${name}`}</TexteRN>,
  };
});

jest.mock('@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { isVisible }) => (
      isVisible ? <TexteRN>MUR PAYANT</TexteRN> : null
    ),
  };
});

jest.mock('@/components/atoms/button/Button', () => {
  const { Text: TexteRN, TouchableOpacity } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { disabled, onPress, title }) => (
      <TouchableOpacity accessibilityState={{ disabled: Boolean(disabled) }} onPress={onPress}>
        <TexteRN>{title}</TexteRN>
      </TouchableOpacity>
    ),
  };
});

/** 2 titulaires, 1 remplacant. p1 s'est desiste, p3 est disponible. */
const PACK_PUBLIE = {
  manualPlayers: [],
  reservePlayerIds: ['p3'],
  requireResponse: true,
  snapshotPlayers: [
    {
      documentId: 'p1', firstname: 'Karim', lastname: 'Sylla', number: 9,
    },
    {
      documentId: 'p2', firstname: 'Yanis', lastname: 'Bertrand', number: 4,
    },
    {
      documentId: 'p3', firstname: 'Malik', lastname: 'Cisse', number: 7,
    },
  ],
  sportContext: 'football',
  teams: [{
    id: 'team_1',
    placements: [
      { playerId: 'p1', positionX: 50, positionY: 90 },
      { playerId: 'p2', positionX: 50, positionY: 60 },
    ],
  }],
  version: 1,
  visibility: 'team',
};

const REPONSES = {
  byPlayerId: { p1: 'absent', p2: 'present', p3: 'pending' },
  counts: { absent: 1, pending: 1, present: 1 },
};

/** @type {any[]} */
const arbresMontes = [];

/**
 * Monte l'ecran.
 * @param {any} [parametres]
 * @returns {Promise<any>}
 */
const rendre = async (parametres = {}) => {
  mockRouteParams = {
    eventId: 'evt_1',
    eventLabel: 'Match',
    sport: 'football',
    teamId: 'team_1',
    teamName: 'Senior 1',
    ...parametres,
  };
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<MatchCompositionAmend />);
  });
  arbresMontes.push(arbre);
  return arbre;
};

/**
 * Le texte d'un noeud, quelle que soit sa profondeur.
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
const texteVisible = (arbre) => arbre.root
  .findAllByType(Text)
  .map((/** @type {any} */ noeud) => aplatirTexte(noeud.props.children))
  .join(' | ');

/**
 * Appuie sur l'element le plus profond dont le texte contient ce libelle.
 * @param {any} arbre
 * @param {string} libelle
 * @returns {Promise<void>}
 */
const appuyerSur = async (arbre, libelle) => {
  const cible = arbre.root
    .findAll((/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function'
      && aplatirTexte(noeud.props.children).includes(libelle))
    .pop();
  await act(async () => { cible.props.onPress(); });
};

beforeEach(() => {
  mockNavigate.mockClear();
  mockGoBack.mockClear();
  mockPublish.mockReset();
  mockPublish.mockResolvedValue({});
  mockSaveDraft.mockReset();
  mockSaveDraft.mockResolvedValue({});
  mockComposition = {
    published: PACK_PUBLIE,
    responses: REPONSES,
    team: { documentId: 'team_1', name: 'Senior 1' },
  };
});

// 🧨 On DEMONTE entre deux tests : un arbre orphelin garde ses effets vivants et
// fait sortir jest en 1 alors que tous les tests sont verts (piege D68).
afterEach(async () => {
  await act(async () => {
    arbresMontes.splice(0).forEach((arbre) => arbre.unmount());
  });
});

describe('C-B ecran 8 — le desistement, et ce qui change', () => {
  test('🥇 l encart « Desistement » nomme le titulaire qui s est declare absent', async () => {
    const texte = texteVisible(await rendre());

    expect(texte).toContain('DÉSISTEMENT');
    expect(texte).toContain('Karim Sylla');
  });

  test('🥇 « Ce qui change » montre QUI SORT et QUI ENTRE, avec leurs 2 pastilles', async () => {
    const texte = texteVisible(await rendre());

    expect(texte).toContain('Ce qui change'.toUpperCase());
    expect(texte).toContain('sort');
    expect(texte).toContain('entre');
    expect(texte).toContain('Titulaire → absent');
    expect(texte).toContain('Banc → titulaire');
    // Le remplacant propose est bien le joueur du banc.
    expect(texte).toContain('Malik Cisse');
  });

  test('la chip porte la version SUIVANTE — republier incremente', async () => {
    expect(texteVisible(await rendre())).toContain('Version 2');
  });

  test('la carte « Renvoyer » PROMET que les reponses sont conservees', async () => {
    const texte = texteVisible(await rendre());

    expect(texte).toContain('gardent leur réponse');
    expect(texte).toContain('Senior 1');
  });

  test('les 2 CTA du pack sont la', async () => {
    const texte = texteVisible(await rendre());

    expect(texte).toContain('Annuler');
    expect(texte).toContain('Republier');
  });
});

describe('🔒 C-B ecran 8 — REPUBLIER N EFFACE AUCUNE REPONSE', () => {
  test('🥇 LE TEMOIN D ARRET : la charge envoyee ne porte AUCUN champ de reponse', async () => {
    await appuyerSur(await rendre(), 'Republier');

    expect(mockSaveDraft).toHaveBeenCalledTimes(1);
    const envoye = JSON.stringify(mockSaveDraft.mock.calls[0][1]);
    ['present', 'absent', 'pending', 'byPlayerId', 'participations', 'missings']
      .forEach((mot) => expect(envoye).not.toContain(mot));
  });

  test('🔒 le joueur qui SORT quitte le terrain, celui qui ENTRE prend SA position', async () => {
    await appuyerSur(await rendre(), 'Republier');

    const { draft } = mockSaveDraft.mock.calls[0][1];
    expect(draft.teams[0].placements).toEqual(expect.arrayContaining([
      expect.objectContaining({ playerId: 'p3', positionX: 50, positionY: 90 }),
    ]));
    expect(JSON.stringify(draft.teams[0].placements)).not.toContain('p1');
  });

  test('🧨 enregistrer PUIS publier — le serveur publie ce qu il a en brouillon', async () => {
    await appuyerSur(await rendre(), 'Republier');

    expect(mockSaveDraft).toHaveBeenCalledWith('evt_1', expect.objectContaining({ teamId: 'team_1' }));
    expect(mockPublish).toHaveBeenCalledWith('evt_1', { teamId: 'team_1' });
    expect(mockSaveDraft.mock.invocationCallOrder[0])
      .toBeLessThan(mockPublish.mock.invocationCallOrder[0]);
  });

  test('⛔ un echec d enregistrement ne publie RIEN', async () => {
    mockSaveDraft.mockRejectedValue(new Error('refus'));

    await appuyerSur(await rendre(), 'Republier');

    expect(mockPublish).not.toHaveBeenCalled();
  });
});

describe('C-B ecran 8 — ce qu il refuse de faire', () => {
  test('⛔ sans desistement, l ecran le DIT et ne propose aucun echange', async () => {
    mockComposition = {
      ...mockComposition,
      responses: { byPlayerId: { p1: 'present', p2: 'present' }, counts: {} },
    };
    const arbre = await rendre();
    const texte = texteVisible(arbre);

    expect(texte).toContain('Personne ne s’est désisté.');
    expect(texte).not.toContain('sort');

    await appuyerSur(arbre, 'Republier');
    expect(mockSaveDraft).not.toHaveBeenCalled();
  });

  test('⛔ desistement SANS remplacant disponible : on le dit, on ne publie pas', async () => {
    mockComposition = {
      ...mockComposition,
      responses: { byPlayerId: { p1: 'absent', p3: 'absent' }, counts: {} },
    };
    const arbre = await rendre();

    expect(texteVisible(arbre)).toContain('Aucun remplaçant disponible');

    await appuyerSur(arbre, 'Republier');
    expect(mockSaveDraft).not.toHaveBeenCalled();
  });

  test('« Annuler » ne publie rien et rend la main', async () => {
    await appuyerSur(await rendre(), 'Annuler');

    expect(mockSaveDraft).not.toHaveBeenCalled();
    expect(mockPublish).not.toHaveBeenCalled();
    expect(mockGoBack).toHaveBeenCalled();
  });
});
