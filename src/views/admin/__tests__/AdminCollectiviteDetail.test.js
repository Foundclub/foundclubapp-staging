import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Alert, Text, TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { ADMIN_COLLECTIVITE_DETAIL_POPULATE } from '@/services/collectivite/collectiviteService';

import AdminCollectiviteDetail from '../AdminCollectiviteDetail';

// 🏛️ D61 (29/09) — ÉCRAN 2 : le détail d une collectivité dans la console super-admin.
//
// Ce que ce témoin fige (ROUGE avant l écran 2 : le module n existait pas) — un témoin par
// geste, chacun sur la route du lot 1a (`/superadmin/collectivites/:id/...`) :
//   - RATTACHER un club trouvé par recherche : POST …/clubs/:clubId, puis relecture ; le
//     compte rendu dit ce que devient l offre (posée, déjà payée, collectivité inactive) ;
//     un club déjà pris ailleurs (409) : le refus s affiche ;
//   - DÉTACHER avec confirmation (le club reste intact) : DELETE …/clubs/:clubId ;
//   - AJOUTER un gestionnaire trouvé par recherche : POST …/gestionnaires/:userId ;
//   - RETIRER avec confirmation : DELETE …/gestionnaires/:userId ;
//   - les installations, en lecture ; « Annuler » ne touche à rien.
// Le client HTTP est doublé ; le VRAI i18next (fr.js) écrit les phrases.

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPut = jest.fn();
const mockDelete = jest.fn();

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    delete: (...args) => mockDelete(...args),
    get: (...args) => mockGet(...args),
    post: (...args) => mockPost(...args),
    put: (...args) => mockPut(...args),
  },
}));

/** @type {any} */
let mockParams = { collectiviteId: 'ville-montrivage' };
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
  useRoute: () => ({ params: mockParams }),
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
jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() { return null; });
jest.mock(
  '@/components/molecules/clubLogoMark/ClubLogoMark',
  () => function ClubLogoMarkMock() { return null; },
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

const EXPLORATEUR = '/superadmin/content/api%3A%3Acollectivite.collectivite/list';
const RECHERCHE_CLUB = '/superadmin/relations/api%3A%3Aclub.club/search';
const RECHERCHE_COMPTE = '/superadmin/relations/plugin%3A%3Ausers-permissions.user/search';
const ROUTE = '/superadmin/collectivites/ville-montrivage';

/** @type {any} */
let serveur;
/** @type {any} */
let alerte;

const ligneServeur = () => ({
  clubs: serveur.clubs,
  codeInsee: '99001',
  documentId: 'ville-montrivage',
  gestionnaires: serveur.gestionnaires,
  installations: [
    {
      documentId: 'stade', maxSlots: 2, name: 'Stade municipal de Montrivage', type: 'Terrain',
    },
    {
      documentId: 'gymnase', maxSlots: 3, name: 'Gymnase des Tilleuls', type: 'Gymnase',
    },
  ],
  isActive: serveur.isActive,
  name: 'Ville de Montrivage',
  siren: null,
  type: 'commune',
});

/**
 * Le serveur doublé : l explorateur rend la collectivité telle qu elle est, la recherche
 * rend ce qu on lui a posé.
 * @param {string} route - L adresse.
 * @returns {Promise<any>} La réponse.
 */
const repondrePost = async (route) => {
  if (route === EXPLORATEUR) return { data: { data: [ligneServeur()], meta: {} } };
  if (route === RECHERCHE_CLUB) return { data: { data: serveur.clubsTrouves } };
  if (route === RECHERCHE_COMPTE) return { data: { data: serveur.comptesTrouves } };
  if (serveur.postPersonnalise) return serveur.postPersonnalise(route);
  return { data: { data: {} } };
};

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

const textes = (/** @type {any} */ noeud) => noeud.findAllByType(Text)
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

const parTestID = (/** @type {any} */ noeud, /** @type {string} */ testID) => noeud.find(
  (/** @type {any} */ n) => n.props?.testID === testID,
);
const bouton = (/** @type {any} */ noeud, /** @type {string} */ titre) => noeud.find(
  // eslint-disable-next-line max-len
  (/** @type {any} */ n) => n.props?.testID === `bouton-${titre}` && typeof n.props?.onPress === 'function',
);

const monter = async () => {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { gcTime: 0, retry: false } },
  });
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>
        <AdminCollectiviteDetail />
      </QueryClientProvider>,
    );
  });
  await attendre(() => textes(arbre.root).includes('Ville de Montrivage'));
  return arbre;
};

/**
 * Tape dans un champ de recherche puis attend ses résultats.
 * @param {any} arbre - L écran.
 * @param {string} testID - Le champ.
 * @param {string} texte - Ce qu on tape.
 * @returns {Promise<void>}
 */
const chercher = async (arbre, testID, texte) => {
  // eslint-disable-next-line max-len
  const champ = arbre.root.findAllByType(TextInput).find((/** @type {any} */ n) => n.props.testID === testID);
  await act(async () => { champ.props.onChangeText(texte); });
  await attendre(() => arbre.root.findAll(
    (/** @type {any} */ n) => String(n.props?.testID || '').startsWith(`${testID}-resultat-`),
  ).length > 0);
};

beforeEach(() => {
  mockParams = { collectiviteId: 'ville-montrivage' };
  serveur = {
    clubs: [
      { documentId: 'montrivage-fc', logo: null, name: 'Montrivage FC' },
      { documentId: 'as-montrivage', logo: { url: '/as.png' }, name: 'AS Montrivage' },
    ],
    clubsTrouves: [],
    comptesTrouves: [],
    gestionnaires: [{
      documentId: 'karim', email: 'karim@example.invalid', firstname: 'Karim', lastname: 'Benali',
    }],
    isActive: true,
    postPersonnalise: null,
  };
  alerte = null;
  [mockGet, mockPost, mockPut, mockDelete].forEach((doublure) => doublure.mockReset());
  mockPost.mockImplementation(repondrePost);
  mockDelete.mockResolvedValue({ data: { data: {} } });
  jest.spyOn(Alert, 'alert').mockImplementation((titre, message, boutons) => {
    alerte = { boutons, message, titre };
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('D61 — écran 2 : le détail d une collectivité', () => {
  it('lit la collectivité par l explorateur : clubs, gestionnaires, installations', async () => {
    const arbre = await monter();
    expect(mockPost).toHaveBeenCalledWith(EXPLORATEUR, expect.objectContaining({
      filters: { documentId: { $eq: 'ville-montrivage' } },
      populate: ADMIN_COLLECTIVITE_DETAIL_POPULATE,
    }));
    // eslint-disable-next-line max-len
    expect(textes(parTestID(arbre.root, 'admin-collectivite-clubs'))).toEqual(expect.arrayContaining([
      'Clubs rattachés : 2', 'AS Montrivage', 'Montrivage FC',
    ]));
    // eslint-disable-next-line max-len
    expect(textes(parTestID(arbre.root, 'admin-collectivite-gestionnaires'))).toEqual(expect.arrayContaining([
      'Gestionnaires : 1', 'Karim Benali', 'karim@example.invalid',
    ]));
    expect(textes(parTestID(arbre.root, 'admin-collectivite-installations'))).toEqual([
      'Installations : 2',
      'Gymnase des Tilleuls', 'Gymnase · capacité : 3',
      'Stade municipal de Montrivage', 'Terrain · capacité : 2',
    ]);
    expect(textes(arbre.root)).toEqual(expect.arrayContaining(['Commune', 'Active', 'Couper']));
  });

  // eslint-disable-next-line max-len
  it('RATTACHER : recherche, POST …/clubs/:clubId, relecture ; le compte rendu dit l offre', async () => {
    serveur.clubsTrouves = [
      { documentId: 'basket', label: 'Montrivage Basket', subtitle: null },
      { documentId: 'as-montrivage', label: 'AS Montrivage', subtitle: null },
    ];
    serveur.postPersonnalise = async (/** @type {string} */ route) => {
      if (route !== `${ROUTE}/clubs/basket`) throw new Error(`route inattendue ${route}`);
      // eslint-disable-next-line max-len
      serveur.clubs = [...serveur.clubs, { documentId: 'basket', logo: null, name: 'Montrivage Basket' }];
      return {
        data: {
          data: {
            attached: true, changed: true, clubDocumentId: 'basket', offer: 'granted',
          },
        },
      };
    };
    const arbre = await monter();
    await chercher(arbre, 'admin-collectivite-recherche-club', 'mont');
    // eslint-disable-next-line max-len
    expect(mockPost).toHaveBeenCalledWith(RECHERCHE_CLUB, { fields: ['documentId', 'name'], pageSize: 10, q: 'mont' });

    // Un club déjà rattaché ici ne se rattache pas deux fois.
    // eslint-disable-next-line max-len
    const dejaLa = parTestID(arbre.root, 'admin-collectivite-recherche-club-resultat-as-montrivage');
    expect(bouton(dejaLa, 'Déjà rattaché').props.disabled).toBe(true);

    const ligne = parTestID(arbre.root, 'admin-collectivite-recherche-club-resultat-basket');
    await act(async () => { bouton(ligne, 'Rattacher').props.onPress(); });
    const clubs = () => textes(parTestID(arbre.root, 'admin-collectivite-clubs'));
    await attendre(() => clubs().includes('Clubs rattachés : 3'));

    expect(mockPost).toHaveBeenCalledWith(`${ROUTE}/clubs/basket`);
    expect(clubs()).toEqual(expect.arrayContaining([
      'Clubs rattachés : 3',
      'Montrivage Basket',
      'Montrivage Basket est rattaché à la Ville de Montrivage et reçoit l’offre Club offerte.',
    ]));
  });

  // eslint-disable-next-line max-len
  it('RATTACHER : un club qui paie déjà, une collectivité inactive, un club pris ailleurs (409)', async () => {
    serveur.clubsTrouves = [{ documentId: 'basket', label: 'Montrivage Basket', subtitle: null }];
    const reponses = [
      { data: { data: { offer: 'already-paid' } } },
      { data: { data: { offer: 'collectivite-inactive' } } },
    ];
    serveur.postPersonnalise = async () => {
      const reponse = reponses.shift();
      if (reponse) return reponse;
      const refus = {
        response: {
          data: { error: { details: { code: 'COLLECTIVITE_CLUB_ALREADY_ATTACHED' }, status: 409 } },
          status: 409,
        },
      };
      throw refus;
    };
    const arbre = await monter();
    const clubs = () => textes(parTestID(arbre.root, 'admin-collectivite-clubs'));
    const rattacherBasket = async () => {
      await chercher(arbre, 'admin-collectivite-recherche-club', 'basket');
      const ligne = parTestID(arbre.root, 'admin-collectivite-recherche-club-resultat-basket');
      await act(async () => { bouton(ligne, 'Rattacher').props.onPress(); });
    };

    await rattacherBasket();
    // eslint-disable-next-line max-len
    const paieDeja = 'Montrivage Basket est rattaché à la Ville de Montrivage ; il paie déjà son abonnement, rien ne change pour lui.';
    await attendre(() => clubs().includes(paieDeja));
    expect(clubs()).toContain(paieDeja);

    await rattacherBasket();
    // eslint-disable-next-line max-len
    const inactive = 'Montrivage Basket est rattaché à la Ville de Montrivage. Elle est inactive : l’offre Club sera posée à son activation.';
    await attendre(() => clubs().includes(inactive));
    expect(clubs()).toContain(inactive);

    await rattacherBasket();
    const refus = 'Ce club est déjà rattaché à une autre collectivité : détache-le d’abord.';
    await attendre(() => clubs().includes(refus));
    expect(clubs()).toContain(refus);
  });

  it('DÉTACHER : confirmation (le club reste intact), puis DELETE …/clubs/:clubId', async () => {
    const arbre = await monter();
    const ligne = parTestID(arbre.root, 'admin-collectivite-club-as-montrivage');
    await act(async () => { bouton(ligne, 'Détacher').props.onPress(); });
    expect(alerte.titre).toBe('Détacher AS Montrivage ?');
    expect(alerte.message).toBe(
      // eslint-disable-next-line max-len
      'Le club reste intact : équipes, membres et événements. S’il recevait l’offre Club offerte par la Ville de Montrivage, elle lui est retirée.',
    );
    expect(mockDelete).not.toHaveBeenCalled();

    mockDelete.mockImplementation(async () => {
      // eslint-disable-next-line max-len
      serveur.clubs = serveur.clubs.filter((/** @type {any} */ club) => club.documentId !== 'as-montrivage');
      return { data: { data: { attached: false, changed: true, offer: 'revoked' } } };
    });
    // eslint-disable-next-line max-len
    await act(async () => { alerte.boutons.find((/** @type {any} */ b) => b.style === 'destructive').onPress(); });
    const clubs = () => textes(parTestID(arbre.root, 'admin-collectivite-clubs'));
    await attendre(() => clubs().includes('Clubs rattachés : 1'));

    expect(mockDelete).toHaveBeenCalledWith(`${ROUTE}/clubs/as-montrivage`);
    expect(clubs()).toContain('AS Montrivage est détaché.');
    expect(clubs()).not.toContain('AS Montrivage');
  });

  // eslint-disable-next-line max-len
  it('AJOUTER un gestionnaire : recherche par nom ou e-mail, POST …/gestionnaires/:userId', async () => {
    serveur.comptesTrouves = [
      { documentId: 'hugo', label: 'Hugo Lemaire', subtitle: 'hugo@example.invalid' },
      { documentId: 'karim', label: 'Karim Benali', subtitle: 'karim@example.invalid' },
    ];
    serveur.postPersonnalise = async (/** @type {string} */ route) => {
      if (route !== `${ROUTE}/gestionnaires/hugo`) throw new Error(`route inattendue ${route}`);
      serveur.gestionnaires = [...serveur.gestionnaires, {
        documentId: 'hugo', email: 'hugo@example.invalid', firstname: 'Hugo', lastname: 'Lemaire',
      }];
      return { data: { data: { changed: true, gestionnaire: true, userDocumentId: 'hugo' } } };
    };
    const arbre = await monter();
    await chercher(arbre, 'admin-collectivite-recherche-compte', 'lemaire');
    expect(mockPost).toHaveBeenCalledWith(RECHERCHE_COMPTE, {
      fields: ['documentId', 'firstname', 'lastname', 'email'], pageSize: 10, q: 'lemaire',
    });
    const dejaLa = parTestID(arbre.root, 'admin-collectivite-recherche-compte-resultat-karim');
    expect(bouton(dejaLa, 'Déjà gestionnaire').props.disabled).toBe(true);

    const ligne = parTestID(arbre.root, 'admin-collectivite-recherche-compte-resultat-hugo');
    expect(textes(ligne)).toEqual(expect.arrayContaining(['Hugo Lemaire', 'hugo@example.invalid']));
    await act(async () => { bouton(ligne, 'Ajouter').props.onPress(); });
    const gestionnaires = () => textes(parTestID(arbre.root, 'admin-collectivite-gestionnaires'));
    await attendre(() => gestionnaires().includes('Gestionnaires : 2'));

    expect(mockPost).toHaveBeenCalledWith(`${ROUTE}/gestionnaires/hugo`);
    expect(gestionnaires()).toContain('Hugo Lemaire gère désormais la Ville de Montrivage.');
  });

  it('RETIRER un gestionnaire : confirmation (le compte reste intact), puis DELETE', async () => {
    const arbre = await monter();
    const ligne = parTestID(arbre.root, 'admin-collectivite-gestionnaire-karim');
    await act(async () => { bouton(ligne, 'Retirer').props.onPress(); });
    expect(alerte.titre).toBe('Retirer Karim Benali ?');
    expect(alerte.message).toBe(
      // eslint-disable-next-line max-len
      'Son compte reste intact : il perd seulement l’accès à « Ma collectivité » de la Ville de Montrivage.',
    );
    mockDelete.mockImplementation(async () => {
      serveur.gestionnaires = [];
      return { data: { data: { changed: true, gestionnaire: false } } };
    });
    // eslint-disable-next-line max-len
    await act(async () => { alerte.boutons.find((/** @type {any} */ b) => b.style === 'destructive').onPress(); });
    const gestionnaires = () => textes(parTestID(arbre.root, 'admin-collectivite-gestionnaires'));
    await attendre(() => gestionnaires().includes('Gestionnaires : 0'));

    expect(mockDelete).toHaveBeenCalledWith(`${ROUTE}/gestionnaires/karim`);
    expect(gestionnaires()).toEqual(expect.arrayContaining([
      'Aucun gestionnaire.', 'Karim Benali ne gère plus la Ville de Montrivage.',
    ]));
  });

  it('« Annuler » ne détache ni ne retire rien', async () => {
    const arbre = await monter();
    await act(async () => {
      // eslint-disable-next-line max-len
      bouton(parTestID(arbre.root, 'admin-collectivite-club-as-montrivage'), 'Détacher').props.onPress();
    });
    // eslint-disable-next-line max-len
    await act(async () => { alerte.boutons.find((/** @type {any} */ b) => b.style === 'cancel').onPress?.(); });
    await act(async () => {
      // eslint-disable-next-line max-len
      bouton(parTestID(arbre.root, 'admin-collectivite-gestionnaire-karim'), 'Retirer').props.onPress();
    });
    // eslint-disable-next-line max-len
    await act(async () => { alerte.boutons.find((/** @type {any} */ b) => b.style === 'cancel').onPress?.(); });
    await attendre(() => false);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('une collectivité absente : l écran le dit', async () => {
    mockPost.mockResolvedValue({ data: { data: [], meta: {} } });
    const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0, retry: false } } });
    /** @type {any} */
    let arbre;
    await act(async () => {
      arbre = renderer.create(
        <QueryClientProvider client={client}><AdminCollectiviteDetail /></QueryClientProvider>,
      );
    });
    const lus = () => textes(arbre.root);
    // eslint-disable-next-line max-len
    await attendre(() => lus().includes('Cette collectivité est introuvable : elle a peut-être été supprimée.'));
    expect(lus()).toContain('Cette collectivité est introuvable : elle a peut-être été supprimée.');
  });
});

// COLL-CONSOLE (02/10) — planche P2-creer, état 7 : la fiche REMPLACE le formulaire de création
// et dit les trois gestes qui restent, dans l ordre ; ouverte autrement, elle ne le dit pas.
describe('COLL-CONSOLE — la fiche ouverte juste après la création', () => {
  // eslint-disable-next-line max-len
  it('« … est créée, inactive. Ensuite : rattache ses clubs, nomme un gestionnaire, puis active-la. »', async () => {
    mockParams = { collectiviteId: 'ville-montrivage', justCreated: true };
    const arbre = await monter();
    expect(textes(parTestID(arbre.root, 'admin-collectivite-creee'))).toEqual([
      'Ville de Montrivage est créée, inactive.',
      'Ensuite : rattache ses clubs, nomme un gestionnaire, puis active-la.',
    ]);
  });

  it('ouverte depuis la liste : pas de bandeau', async () => {
    const arbre = await monter();
    // eslint-disable-next-line max-len
    expect(arbre.root.findAll((n) => n.props?.testID === 'admin-collectivite-creee')).toHaveLength(0);
  });
});
