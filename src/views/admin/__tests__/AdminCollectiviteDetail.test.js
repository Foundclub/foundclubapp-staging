import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Alert, StyleSheet, Text, TextInput, TouchableOpacity,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { RouteNames } from '@/navigation/routeNames';

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
// VT18E (07/10) — la largeur de la fenêtre : un téléphone par défaut (celle du moteur de test,
// 750), un ordinateur pour la planche P2-fiche-ordi.
let mockLargeur = 750;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({
    fontScale: 1, height: 900, scale: 1, width: mockLargeur,
  }),
}));
const mockPost = jest.fn();
const mockPut = jest.fn();
const mockDelete = jest.fn();

// COLL-CONSOLE (02/10) — un écran entier monté avec react-query : sous charge (suite complète,
// PC occupé), le premier cas paie le chargement des modules et dépassait les 5 s par défaut.
jest.setTimeout(30000);

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
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
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
 * VT18E (07/10) — bornée en TEMPS, plus en tours : la recherche part 300 ms après la dernière
 * lettre (anti-rebond), ce que 80 tours ne couvrent pas sous charge.
 * @param {() => boolean} condition - Ce qu on attend.
 * @returns {Promise<void>}
 */
const attendre = async (condition) => {
  const fin = Date.now() + 5000;
  while (!condition() && Date.now() < fin) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await new Promise((suite) => { setTimeout(suite, 10); }); });
  }
};

const parTestID = (/** @type {any} */ noeud, /** @type {string} */ testID) => noeud.find(
  (/** @type {any} */ n) => n.props?.testID === testID,
);
const bouton = (/** @type {any} */ noeud, /** @type {string} */ titre) => noeud.find(
  // eslint-disable-next-line max-len
  (/** @type {any} */ n) => n.props?.testID === `bouton-${titre}` && typeof n.props?.onPress === 'function',
);

/**
 * Ouvre le menu « Plus d actions » d une ligne, puis choisit l une de ses actions.
 * @param {any} arbre - L écran.
 * @param {string} testID - Le bouton du menu.
 * @param {string} libelle - L action.
 * @returns {Promise<void>}
 */
const choisirAction = async (arbre, testID, libelle) => {
  const bouton3Points = arbre.root
    .findAll((n) => n.props?.testID === testID && typeof n.props?.onPress === 'function')[0];
  await act(async () => { bouton3Points.props.onPress(); });
  const menu = arbre.root.findAll((n) => n.props?.testID === `${testID}-menu`)[0];
  const action = menu.findAll((n) => typeof n.props?.onPress === 'function'
    // eslint-disable-next-line max-len
    && n.findAllByType(Text).some((texte) => aplatirTexte(texte.props.children).trim() === libelle))[0];
  await act(async () => { action.props.onPress(); });
};

/**
 * La fenêtre d un geste qui retire (« detacher » ou « retirer »), si elle est ouverte.
 * @param {any} arbre - L écran.
 * @param {string} geste - Le geste.
 * @returns {any} La fenêtre, ou undefined.
 */
const fenetreGeste = (arbre, geste) => arbre.root.findAll((n) => (
  // eslint-disable-next-line max-len
  n.props?.testID === `admin-collectivite-fenetre-${geste}` && n.props?.accessibilityViewIsModal))[0];

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
  mockLargeur = 750;
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
  // eslint-disable-next-line max-len
  [mockGet, mockPost, mockPut, mockDelete, mockNavigate].forEach((doublure) => doublure.mockReset());
  mockPost.mockImplementation(repondrePost);
  mockDelete.mockResolvedValue({ data: { data: {} } });
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
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
      'Gymnase des Tilleuls', 'Gymnase · 3 équipes à la fois',
      'Stade municipal de Montrivage', 'Terrain · 2 équipes à la fois',
    ]);
    // eslint-disable-next-line max-len
    expect(textes(arbre.root)).toEqual(expect.arrayContaining(['Commune · INSEE 99001', 'Active', 'Couper']));
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
    // COLL-CONSOLE-BIS (03/10) — + la ville officielle, l INSEE (proximite) et le sport.
    expect(mockPost).toHaveBeenCalledWith(RECHERCHE_CLUB, {
      fields: ['documentId', 'name', 'addressDetails', 'cityName', 'inseeCom'],
      pageSize: 20,
      populate: { activites: { fields: ['name'] } },
      q: 'mont',
    }, { signal: expect.any(AbortSignal) });

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
      // eslint-disable-next-line max-len
      'Montrivage Basket est rattaché à la Ville de Montrivage et reçoit l’offre Club offerte. Ses dirigeants sont prévenus.',
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

  // eslint-disable-next-line max-len
  it('DÉTACHER : une fenêtre de l app (le club reste intact), puis DELETE …/clubs/:clubId', async () => {
    const arbre = await monter();
    // eslint-disable-next-line max-len
    await choisirAction(arbre, 'admin-collectivite-club-as-montrivage-actions', 'Détacher de la Ville');
    const fenetre = () => fenetreGeste(arbre, 'detacher');
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(textes(fenetre())).toEqual(expect.arrayContaining([
      'Détacher AS Montrivage ?',
      'AS Montrivage',
      // eslint-disable-next-line max-len
      'Le club reste intact : équipes, membres et événements. S’il recevait l’offre Club offerte par la Ville de Montrivage, elle lui est retirée.',
      'Détacher AS Montrivage',
      'Annuler',
    ]));
    expect(mockDelete).not.toHaveBeenCalled();

    mockDelete.mockImplementation(async () => {
      // eslint-disable-next-line max-len
      serveur.clubs = serveur.clubs.filter((/** @type {any} */ club) => club.documentId !== 'as-montrivage');
      return { data: { data: { attached: false, changed: true, offer: 'revoked' } } };
    });
    await act(async () => { bouton(fenetre(), 'Détacher AS Montrivage').props.onPress(); });
    const clubs = () => textes(parTestID(arbre.root, 'admin-collectivite-clubs'));
    await attendre(() => clubs().includes('Clubs rattachés : 1'));

    expect(mockDelete).toHaveBeenCalledWith(`${ROUTE}/clubs/as-montrivage`);
    expect(fenetre()).toBeUndefined();
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
    }, { signal: expect.any(AbortSignal) });
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

  // eslint-disable-next-line max-len
  it('RETIRER un gestionnaire : une fenêtre (le compte reste intact ; « seul gestionnaire »), puis DELETE', async () => {
    const arbre = await monter();
    await choisirAction(arbre, 'admin-collectivite-gestionnaire-karim-actions', 'Retirer');
    const fenetre = () => fenetreGeste(arbre, 'retirer');
    expect(textes(fenetre())).toEqual([
      'Retirer Karim Benali ?',
      // eslint-disable-next-line max-len
      'Son compte reste intact : il perd seulement l’accès à « Ma collectivité » de la Ville de Montrivage.',
      // eslint-disable-next-line max-len
      'C’est le seul gestionnaire. Sans gestionnaire, les demandes de créneau des clubs attendront sans réponse.',
      'Retirer Karim Benali',
      'Annuler',
    ]);
    mockDelete.mockImplementation(async () => {
      serveur.gestionnaires = [];
      return { data: { data: { changed: true, gestionnaire: false } } };
    });
    await act(async () => { bouton(fenetre(), 'Retirer Karim Benali').props.onPress(); });
    const gestionnaires = () => textes(parTestID(arbre.root, 'admin-collectivite-gestionnaires'));
    await attendre(() => gestionnaires().includes('Gestionnaires : 0'));

    expect(mockDelete).toHaveBeenCalledWith(`${ROUTE}/gestionnaires/karim`);
    expect(fenetre()).toBeUndefined();
    expect(gestionnaires()).toEqual(expect.arrayContaining([
      'Aucun gestionnaire.', 'Karim Benali ne gère plus la Ville de Montrivage.',
    ]));
  });

  it('« Annuler » ne détache ni ne retire rien ; la fenêtre se ferme', async () => {
    const arbre = await monter();
    // eslint-disable-next-line max-len
    await choisirAction(arbre, 'admin-collectivite-club-as-montrivage-actions', 'Détacher de la Ville');
    await act(async () => { bouton(fenetreGeste(arbre, 'detacher'), 'Annuler').props.onPress(); });
    expect(fenetreGeste(arbre, 'detacher')).toBeUndefined();
    await choisirAction(arbre, 'admin-collectivite-gestionnaire-karim-actions', 'Retirer');
    await act(async () => { bouton(fenetreGeste(arbre, 'retirer'), 'Annuler').props.onPress(); });
    expect(fenetreGeste(arbre, 'retirer')).toBeUndefined();
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

// COLL-CONSOLE (02/10) — planche P2-fiche (design HY521H1, page 2, écran 4).
describe('COLL-CONSOLE — la fiche d une collectivité (planche P2-fiche)', () => {
  const VERDICTS_COUPER = [
    { clubDocumentId: 'as-montrivage', name: 'AS Montrivage', offer: 'revoked' },
    { clubDocumentId: 'montrivage-fc', name: 'Montrivage FC', offer: 'none' },
  ];
  const VERDICTS_ACTIVER = [
    { clubDocumentId: 'as-montrivage', name: 'AS Montrivage', offer: 'granted' },
    { clubDocumentId: 'montrivage-fc', name: 'Montrivage FC', offer: 'already-paid' },
  ];
  const apercu = (clubs, isActive) => mockPut.mockImplementation(async (url, corps) => {
    // eslint-disable-next-line max-len
    if (url !== `${ROUTE}/active` || !('previewIsActive' in (corps?.data || {}))) throw new Error(`PUT ${url}`);
    return { data: { data: { clubs, isActive, preview: true } } };
  });
  // eslint-disable-next-line max-len
  const offre = (arbre, club) => textes(arbre.root.findAll((n) => n.props?.testID === `admin-collectivite-offre-${club}`)[0]);
  // eslint-disable-next-line max-len
  const bandeau = (arbre) => textes(arbre.root.findAll((n) => n.props?.testID === 'collectivite-bandeau-etat')[0]);

  // eslint-disable-next-line max-len
  it('F1 — en tête : le type, l INSEE ; le bandeau d une Ville ACTIVE dit qui reçoit l offre et qui paie lui-même', async () => {
    apercu(VERDICTS_COUPER, false);
    const arbre = await monter();
    // eslint-disable-next-line max-len
    await attendre(() => arbre.root.findAll((n) => n.props?.testID === 'admin-collectivite-offre-as-montrivage').length > 0);
    expect(mockPut).toHaveBeenCalledWith(`${ROUTE}/active`, { data: { previewIsActive: false } });
    expect(textes(arbre.root)).toContain('Commune · INSEE 99001');
    // COLL-CONSOLE-BIS (03/10) — une Ville active dit depuis quand (« — » : sans date au serveur).
    expect(bandeau(arbre)).toEqual([
      'Active',
      'Depuis le — · 1 club reçoit l’offre Club offerte. Montrivage FC paie lui-même.',
      'Couper',
    ]);
    expect(offre(arbre, 'as-montrivage')).toEqual(['Offerte par la Ville']);
    expect(offre(arbre, 'montrivage-fc')).toEqual(['Paie lui-même']);
  });

  // eslint-disable-next-line max-len
  it('F2 — une Ville INACTIVE : « L activer offrira l offre Club à 1 club. Montrivage FC paie déjà … » ; « À l activation »', async () => {
    serveur.isActive = false;
    apercu(VERDICTS_ACTIVER, true);
    const arbre = await monter();
    // eslint-disable-next-line max-len
    await attendre(() => arbre.root.findAll((n) => n.props?.testID === 'admin-collectivite-offre-as-montrivage').length > 0);
    expect(mockPut).toHaveBeenCalledWith(`${ROUTE}/active`, { data: { previewIsActive: true } });
    expect(bandeau(arbre)).toEqual([
      // eslint-disable-next-line max-len
      'Inactive', 'L’activer offrira l’offre Club à 1 club. Montrivage FC paie déjà : rien ne change pour lui.', 'Activer',
    ]);
    expect(offre(arbre, 'as-montrivage')).toEqual(['À l’activation']);
  });

  // eslint-disable-next-line max-len
  it('F3 — sans aperçu (serveur ancien, panne) : aucune pastille inventée, une phrase vraie sans nombre', async () => {
    mockPut.mockRejectedValue({ response: { data: { error: { status: 400 } }, status: 400 } });
    const arbre = await monter();
    await attendre(() => mockPut.mock.calls.length > 0);
    await attendre(() => false);
    // eslint-disable-next-line max-len
    expect(arbre.root.findAll((n) => String(n.props?.testID || '').startsWith('admin-collectivite-offre-'))).toHaveLength(0);
    // eslint-disable-next-line max-len
    expect(bandeau(arbre)[1]).toBe('Depuis le — · Ses clubs rattachés reçoivent l’offre Club offerte, sauf ceux qui paient déjà.');
  });

  // eslint-disable-next-line max-len
  it('F4 — aucun club : la fiche le dit et invite à chercher ; rien n est demandé au serveur', async () => {
    serveur.clubs = [];
    serveur.isActive = false;
    const arbre = await monter();
    expect(textes(parTestID(arbre.root, 'admin-collectivite-clubs'))).toContain(
      'Aucun club rattaché. Cherche les clubs de la commune par leur nom.',
    );
    expect(bandeau(arbre)[1]).toBe(
      // eslint-disable-next-line max-len
      'Aucun club n’est rattaché : chaque club que tu rattacheras recevra l’offre Club offerte, une fois la Ville activée.',
    );
    expect(mockPut).not.toHaveBeenCalled();
  });

  // eslint-disable-next-line max-len
  it('F5 — « Plus d actions » : « Voir la fiche du club » ouvre sa fiche de la console ; « Détacher » est en rouge', async () => {
    const arbre = await monter();
    const actions = arbre.root.findAll((n) => (
      // eslint-disable-next-line max-len
      n.props?.testID === 'admin-collectivite-club-as-montrivage-actions' && typeof n.props?.onPress === 'function'))[0];
    expect(actions.props.accessibilityLabel).toBe('Plus d’actions : AS Montrivage');
    expect(actions.props.accessibilityState).toEqual({ expanded: false });
    // eslint-disable-next-line max-len
    await choisirAction(arbre, 'admin-collectivite-club-as-montrivage-actions', 'Voir la fiche du club');
    // eslint-disable-next-line max-len
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.AdminClubDetail, { clubId: 'as-montrivage' });
  });

  // 🐞 COLL-FIX2 (03/10), tournée T10 (T10_C16_2) : le menu « … » s'ouvrait DANS la ligne, dans la
  // colonne du bouton, et écrasait le nom (« AS Montriv / age »). Il se déplie SOUS la ligne,
  // sur toute sa largeur, comme le disait déjà la planche P2-fiche.
  // eslint-disable-next-line max-len
  it('F5b — le menu « … » se déplie SOUS la ligne, jamais dedans : le nom garde toute sa colonne', async () => {
    const arbre = await monter();
    const ligne = (testID) => arbre.root
      .findAll((n) => n.props?.testID === testID && n.props?.style)[0];
    const sesMenus = (noeud) => noeud
      .findAll((n) => String(n.props?.testID || '').endsWith('-actions-menu'));
    const ouvrir = async (testID) => {
      const bouton3Points = arbre.root
        .findAll((n) => n.props?.testID === testID && typeof n.props?.onPress === 'function')[0];
      await act(async () => { bouton3Points.props.onPress(); });
    };

    const verifier = async (cle) => {
      await ouvrir(`admin-collectivite-${cle}-actions`);
      const laLigne = ligne(`admin-collectivite-${cle}`);
      // Rien dans la ligne : le nom garde sa colonne…
      expect(sesMenus(laLigne)).toHaveLength(0);
      // … et le menu suit la ligne, dans le même bloc.
      expect(sesMenus(laLigne.parent)).not.toHaveLength(0);
    };
    await verifier('club-as-montrivage');
    await verifier('gestionnaire-karim');
  });

  // eslint-disable-next-line max-len
  it('F6 — la recherche dit la VILLE de chaque club ; « Aucun résultat » dit la suite', async () => {
    serveur.clubsTrouves = [{
      // eslint-disable-next-line max-len
      documentId: 'recette-fc', label: 'Recette Stripe FC', raw: { addressDetails: '10 Rue de Rivoli, 75001 Paris' }, subtitle: null,
    }];
    const arbre = await monter();
    await chercher(arbre, 'admin-collectivite-recherche-club', 'recette');
    expect(textes(parTestID(arbre.root, 'admin-collectivite-recherche-club-resultat-recette-fc')))
      .toEqual(expect.arrayContaining(['Recette Stripe FC', '75001 Paris']));

    serveur.clubsTrouves = [];
    // eslint-disable-next-line max-len
    const champ = arbre.root.findAllByType(TextInput).find((n) => n.props.testID === 'admin-collectivite-recherche-club');
    await act(async () => { champ.props.onChangeText('judo'); });
    // eslint-disable-next-line max-len
    const message = 'Aucun résultat. Vérifie l’orthographe. Un club absent de FoundClub se crée d’abord dans la console, rubrique « Clubs ».';
    // eslint-disable-next-line max-len
    await attendre(() => textes(parTestID(arbre.root, 'admin-collectivite-clubs')).includes(message));
    expect(textes(parTestID(arbre.root, 'admin-collectivite-clubs'))).toContain(message);
  });

  // eslint-disable-next-line max-len
  it('F7 — les demandes de clubs de CETTE Ville ont leur porte, vers l écran des demandes', async () => {
    mockGet.mockImplementation(async (route) => {
      if (route === '/superadmin/collectivite-invitations') {
        return {
          data: {
            data: [
              {
                collectivite: { documentId: 'ville-montrivage' },
                documentId: 'd1',
                kind: 'attach_request',
                status: 'registered',
              },
              {
                collectivite: { documentId: 'autre-ville' },
                documentId: 'd2',
                kind: 'attach_request',
                status: 'registered',
              },
            ],
          },
        };
      }
      return { data: { data: [] } };
    });
    const arbre = await monter();
    await attendre(() => textes(arbre.root).includes('1 demande de club pour cette collectivité'));
    // eslint-disable-next-line max-len
    await act(async () => { bouton(arbre.root, '1 demande de club pour cette collectivité').props.onPress(); });
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.AdminCollectiviteInvitations, {
      collectiviteId: 'ville-montrivage', onglet: 'rattachements',
    });
  });
});

// COLL-CONSOLE (02/10) — planche P2-fenetres (design HY521H1, page 2, écran 5).
describe('COLL-CONSOLE — les fenêtres de la fiche (planche P2-fenetres)', () => {
  // eslint-disable-next-line max-len
  it('G1 — Détacher un club qui recevait l offre de la Ville : la fenêtre dit précisément ce qu il perd', async () => {
    mockPut.mockImplementation(async () => ({
      data: {
        data: {
          clubs: [
            { clubDocumentId: 'as-montrivage', name: 'AS Montrivage', offer: 'revoked' },
            { clubDocumentId: 'montrivage-fc', name: 'Montrivage FC', offer: 'none' },
          ],
          isActive: false,
          preview: true,
        },
      },
    }));
    const arbre = await monter();
    // eslint-disable-next-line max-len
    await attendre(() => arbre.root.findAll((n) => n.props?.testID === 'admin-collectivite-offre-as-montrivage').length > 0);
    // eslint-disable-next-line max-len
    await choisirAction(arbre, 'admin-collectivite-club-as-montrivage-actions', 'Détacher de la Ville');
    expect(textes(fenetreGeste(arbre, 'detacher'))).toEqual(expect.arrayContaining([
      'Offerte par la Ville',
      // eslint-disable-next-line max-len
      'Le club reste intact : équipes, membres et événements. Il recevait l’offre Club offerte par la Ville de Montrivage : elle lui est retirée.',
    ]));
    await act(async () => { bouton(fenetreGeste(arbre, 'detacher'), 'Annuler').props.onPress(); });
    // eslint-disable-next-line max-len
    await choisirAction(arbre, 'admin-collectivite-club-montrivage-fc-actions', 'Détacher de la Ville');
    expect(textes(fenetreGeste(arbre, 'detacher'))).toEqual(expect.arrayContaining([
      // eslint-disable-next-line max-len
      'Le club reste intact : équipes, membres et événements. Il ne recevait pas l’offre de la Ville de Montrivage : rien ne change pour son abonnement.',
    ]));
  });

  // eslint-disable-next-line max-len
  it('G2 — un refus du serveur s écrit DANS la fenêtre, qui reste ouverte ; « Réessayer » relance', async () => {
    let essais = 0;
    mockDelete.mockImplementation(async () => {
      essais += 1;
      if (essais === 1) {
        // eslint-disable-next-line no-throw-literal, max-len
        throw { response: { data: { error: { details: { code: 'COLLECTIVITE_NOT_FOUND' }, status: 404 } }, status: 404 } };
      }
      serveur.clubs = serveur.clubs.filter((club) => club.documentId !== 'as-montrivage');
      return { data: { data: { attached: false, changed: true, offer: 'revoked' } } };
    });
    const arbre = await monter();
    // eslint-disable-next-line max-len
    await choisirAction(arbre, 'admin-collectivite-club-as-montrivage-actions', 'Détacher de la Ville');
    // eslint-disable-next-line max-len
    await act(async () => { bouton(fenetreGeste(arbre, 'detacher'), 'Détacher AS Montrivage').props.onPress(); });
    await attendre(() => textes(fenetreGeste(arbre, 'detacher')).includes('Réessayer'));
    expect(textes(fenetreGeste(arbre, 'detacher'))).toContain(
      'Cette collectivité est introuvable : elle a peut-être été supprimée.',
    );
    // eslint-disable-next-line max-len
    await act(async () => { bouton(fenetreGeste(arbre, 'detacher'), 'Réessayer').props.onPress(); });
    await attendre(() => !fenetreGeste(arbre, 'detacher'));
    expect(essais).toBe(2);
  });

  it('G3 — deux gestionnaires : pas d avertissement « seul gestionnaire »', async () => {
    serveur.gestionnaires = [...serveur.gestionnaires, {
      documentId: 'hugo', email: 'hugo@example.invalid', firstname: 'Hugo', lastname: 'Lemaire',
    }];
    const arbre = await monter();
    await choisirAction(arbre, 'admin-collectivite-gestionnaire-karim-actions', 'Retirer');
    // eslint-disable-next-line max-len
    expect(arbre.root.findAll((n) => n.props?.testID === 'admin-collectivite-seul-gestionnaire')).toHaveLength(0);
  });
});

// ♿ VT18E (07/10/2026), point 4 — tournée T18 (capture S10a) : « Détacher de la Ville » absent de
// l arbre d accessibilité au relevé, trouvé seulement au toucher. Chaque action d un menu « … »
// porte désormais son rôle ET son libellé (le texte enfant ne suffit pas à nommer le bouton pour
// un lecteur d écran ni pour l arbre d accessibilité Android). ROUGE avant le lot.
describe('VT18E — le menu « … » d une ligne, vu par l accessibilité', () => {
  /**
   * Ouvre un menu « … » et rend [rôle, libellé] de chacune de ses actions.
   * @param {any} arbre - L écran.
   * @param {string} testID - Le bouton du menu.
   * @returns {Promise<Array<[string, string]>>} Les actions.
   */
  const actionsDuMenu = async (arbre, testID) => {
    const bouton3Points = arbre.root
      .findAll((n) => n.props?.testID === testID && typeof n.props?.onPress === 'function')[0];
    await act(async () => { bouton3Points.props.onPress(); });
    const menu = arbre.root.findAll((n) => n.props?.testID === `${testID}-menu`)[0];
    return menu.findAllByType(TouchableOpacity)
      .map((n) => [n.props.accessibilityRole, n.props.accessibilityLabel]);
  };

  it('chaque action du menu d un club et d un gestionnaire a son rôle et son libellé', async () => {
    const arbre = await monter();
    expect(await actionsDuMenu(arbre, 'admin-collectivite-club-as-montrivage-actions')).toEqual([
      ['button', 'Voir la fiche du club'],
      ['button', 'Détacher de la Ville'],
    ]);
    expect(await actionsDuMenu(arbre, 'admin-collectivite-gestionnaire-karim-actions')).toEqual([
      ['button', 'Retirer'],
    ]);
  });
});

// 🖥️ VT18E (07/10/2026), ajout T18 (d) — tournée T18 (SITE_S13) : sur le site, la fiche d'une
// collectivité tenait en UNE colonne pleine largeur, « Activer » en bouton géant. La planche
// P2-fiche-ordi : 1 200 px au plus, deux colonnes — à gauche l'en-tête, le bandeau d'état
// (« Activer » à côté de sa phrase), les clubs, les installations ; à droite les gestionnaires.
// Le téléphone ne change pas. ROUGE avant le lot.
describe('VT18E — la fiche sur ordinateur (planche P2-fiche-ordi)', () => {
  const style = (/** @type {any} */ noeud) => StyleSheet.flatten(noeud.props.style) || {};
  const hote = (/** @type {any} */ arbre, /** @type {string} */ testID) => arbre.root
    .findAll((n) => n.props?.testID === testID && typeof n.type === 'string')[0];

  it('ordinateur : deux colonnes, gestionnaires à droite, « Activer » à côté', async () => {
    mockLargeur = 1280;
    const arbre = await monter();
    const colonnes = hote(arbre, 'admin-collectivite-colonnes');
    expect(colonnes).toBeDefined();
    expect(style(colonnes))
      .toEqual(expect.objectContaining({ flexDirection: 'row', maxWidth: 1200 }));
    const principale = parTestID(arbre.root, 'admin-collectivite-colonne-principale');
    const laterale = parTestID(arbre.root, 'admin-collectivite-colonne-laterale');
    const dans = (/** @type {any} */ colonne, /** @type {string} */ testID) => colonne
      .findAll((n) => n.props?.testID === testID).length > 0;
    const aGauche = [
      'collectivite-bandeau-etat', 'admin-collectivite-clubs', 'admin-collectivite-installations',
    ];
    expect(aGauche.map((testID) => dans(principale, testID))).toEqual([true, true, true]);
    expect(dans(laterale, 'admin-collectivite-gestionnaires')).toBe(true);
    expect(dans(principale, 'admin-collectivite-gestionnaires')).toBe(false);
    expect(style(hote(arbre, 'collectivite-bandeau-etat')).flexDirection).toBe('row');
  });

  it('téléphone : une colonne, comme avant ; le bandeau empile son bouton', async () => {
    const arbre = await monter();
    expect(hote(arbre, 'admin-collectivite-colonnes')).toBeUndefined();
    expect(style(hote(arbre, 'collectivite-bandeau-etat')).flexDirection).not.toBe('row');
  });
});
