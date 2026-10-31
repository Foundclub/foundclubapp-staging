import renderer, { act } from 'react-test-renderer';

import {
  chercherUnSport,
  choisirLeSport,
  lignesDeSport,
  POPULAIRES_EN_TETE,
  SPORTS_A09,
} from '../../../testSupport/temoinChoixDuSport';
import EventFilters from '../EventFilters';

// A09 — la base de sports que rend la doublure : Football seul par défaut (ce que les tests
// d'avant attendent), la petite base du témoin A09 dans son bloc.
const SPORTS_PAR_DEFAUT = [{ documentId: 'a-1', name: 'Football' }];
let mockSports = SPORTS_PAR_DEFAUT;

// D82 (E6) — LE FILET DE L'ECRAN PLEIN `EventFilters`.
//
// Ce fichier n'avait AUCUN test avant ce lot. Ces lignes DECRIVENT le
// comportement constate le 2026-08-12, elles ne le redefinissent pas.
//
// Ce qu'elles figent, c'est ce qui compte quand on change l'habillage : la
// LISTE DES CRITERES que l'ecran propose, et le PAYLOAD exact qu'il depose
// dans `eventFilters` en appuyant sur « Appliquer les filtres ». La feuille
// qui le remplace devra deposer les memes clefs — c'est ce filet qui dira si
// un critere s'est perdu en route.

jest.setTimeout(30000);

jest.mock('@/components/templates/ScreenContainer', () => {
  // eslint-disable-next-line global-require
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children }) => <View>{children}</View>,
  };
});

jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  // eslint-disable-next-line global-require
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children, isVisible }) => (
      isVisible ? <View>{children}</View> : null
    ),
  };
});

jest.mock('@/components/atoms/button/Button', () => {
  // eslint-disable-next-line global-require
  const { Text, TouchableOpacity } = require('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { onPress, title }) => (
      <TouchableOpacity onPress={onPress}><Text>{title}</Text></TouchableOpacity>
    ),
  };
});

jest.mock('@/components/molecules/input/Input', () => {
  // eslint-disable-next-line global-require
  const { View } = require('react-native');
  return {
    __esModule: true,
    // eslint-disable-next-line react/jsx-props-no-spreading -- fabrique de test
    default: (/** @type {any} */ props) => <View testID="saisie" {...props} />,
  };
});

jest.mock('@/components/molecules/autocompleteSelect/AutocompleteSelect', () => {
  // eslint-disable-next-line global-require
  const { View } = require('react-native');
  return {
    __esModule: true,
    // eslint-disable-next-line react/jsx-props-no-spreading -- fabrique de test
    default: (/** @type {any} */ props) => <View testID="select" {...props} />,
  };
});

jest.mock('@/components/organisms/autocompleteAddressInput/autocompleteAddressInput', () => {
  // eslint-disable-next-line global-require
  const { View } = require('react-native');
  return {
    __esModule: true,
    // eslint-disable-next-line react/jsx-props-no-spreading -- fabrique de test
    default: (/** @type {any} */ props) => <View testID="adresse" {...props} />,
  };
});

jest.mock('@react-native-community/slider', () => {
  // eslint-disable-next-line global-require
  const { View } = require('react-native');
  return {
    __esModule: true,
    // eslint-disable-next-line react/jsx-props-no-spreading -- fabrique de test
    default: (/** @type {any} */ props) => <View testID="rayon" {...props} />,
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));

// Le `t` marche sur le VRAI dictionnaire : les libelles compares plus bas sont
// ceux que l'utilisateur lit, pas des clefs techniques.
jest.mock('react-i18next', () => {
  const fr = jest.requireActual('@/theme/strings/translations/fr').default;
  return {
    // `@/theme/strings` branche i18next avec ce greffon : le retirer ferait
    // mourir la suite sur « undefined module », loin du sujet.
    initReactI18next: { init: () => {}, type: '3rdParty' },
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {string} */ repli, /** @type {any} */ options) => {
        const valeur = String(cle).split('.').reduce(
          (/** @type {any} */ noeud, /** @type {string} */ morceau) => (
            noeud === undefined || noeud === null ? undefined : noeud[morceau]
          ),
          fr,
        );
        const texte = typeof valeur === 'string' ? valeur : (repli || cle);
        // PAR-L10 — comme i18next, `{{x}}` prend la valeur passée en troisième argument.
        if (typeof texte !== 'string' || !options) return texte;
        return texte.replace(/\{\{(\w+)\}\}/g, (tout, nom) => (
          options[nom] === undefined ? tout : String(options[nom])
        ));
      },
    }),
  };
});

let mockRouteParams = /** @type {any} */ ({});
jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: mockRouteParams }),
}));

const mockGeohash = jest.fn(
  (/** @type {number} */ lat, /** @type {number} */ lon, /** @type {number} */ rayon) => (
    `gh(${String(lat)},${String(lon)},${String(rayon)})`
  ),
);

jest.mock('@/domains/places/usePlaces', () => ({
  __esModule: true,
  default: () => ({ getGeohashForPointAndRadius: mockGeohash }),
}));

const mockDispatch = jest.fn();
let mockEventFilters = /** @type {any} */ ({});
const mockUseGetTeams = jest.fn();

jest.mock('@/store/appContext', () => ({
  useAppContext: () => [{ eventFilters: mockEventFilters }, mockDispatch],
}));

jest.mock('@/services/activity/activityQueries', () => ({
  useGetActivities: () => ({ data: mockSports }),
}));
jest.mock('@/services/category/categoryQueries', () => ({
  useGetCategories: () => ({ data: [{ documentId: 'c-1', name: 'U13' }] }),
}));
jest.mock('@/services/level/levelQueries', () => ({
  useGetLevels: () => ({ data: [{ documentId: 'n-1', name: 'Régional 1' }] }),
}));
jest.mock('@/services/event/eventQueries', () => ({
  useGetEventTypes: () => ({ data: [{ documentId: 't-1', name: 'Match' }] }),
}));
jest.mock('@/services/club/clubQueries', () => ({
  useGetClubs: () => ({ data: { pages: [{ data: [{ documentId: 'cl-1', name: 'OM' }] }] } }),
}));
jest.mock('@/services/team/teamQueries', () => ({
  useGetTeams: (/** @type {any[]} */ ...args) => {
    mockUseGetTeams(...args);
    return { data: { pages: [{ data: [{ documentId: 'eq-1', name: 'U13 A' }] }] } };
  },
}));
jest.mock('@/services/searchAlert/searchAlertService', () => ({
  createSearchAlert: jest.fn(),
  getPreviewCount: jest.fn(() => Promise.resolve({ count: 0 })),
  getSearchAlerts: jest.fn(() => Promise.resolve({ data: [] })),
  updateSearchAlert: jest.fn(),
}));

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const alignements = jest.requireActual('@/theme/alignements').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();

  return {
    __esModule: true,
    default: () => ({
      Alignments: alignements,
      Colors: couleurs,
      Fonts: genererPolices(couleurs),
      Spaces: espaces,
    }),
  };
});

/**
 * Ramasse toutes les chaines d'un arbre rendu, en descendant ses enfants.
 * @param {any} node Le noeud.
 * @returns {string[]} Les chaines qu'il porte.
 */
const collecterTexte = (node) => {
  if (node === null || node === undefined) return [];
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(collecterTexte);
  return collecterTexte(node.children);
};

const texteVisible = (/** @type {any} */ tree) => collecterTexte(tree.toJSON()).join(' | ');

/**
 * Le texte porte par un ELEMENT React pas encore rendu (l'en-tete de
 * navigation en est un : `headerRight` rend a la demande).
 * @param {any} element L'element.
 * @returns {string} Son texte.
 */
const texteDeLElement = (element) => {
  if (element === null || element === undefined || typeof element === 'boolean') return '';
  if (typeof element === 'string' || typeof element === 'number') return String(element);
  if (Array.isArray(element)) return element.map(texteDeLElement).join(' ');
  return texteDeLElement(element.props?.children);
};

/**
 * Les selecteurs rendus, sans doublon : `findAll` remonte a la fois l'element
 * composite et son hote, ce qui compterait chaque rangee deux fois.
 * @param {any} tree L'arbre rendu.
 * @returns {any[]} Les selecteurs.
 */
const selecteurs = (tree) => tree.root.findAll(
  (/** @type {any} */ node) => node.props?.testID === 'select',
  { deep: false },
);

/**
 * Recolle en une seule chaine le texte d'un noeud et de ses descendants.
 * @param {any} node Le noeud.
 * @returns {string} Son texte.
 */
const texteDuNoeud = (node) => {
  if (typeof node === 'string') return node;
  if (!node || !Array.isArray(node.children)) return '';
  return node.children.map(texteDuNoeud).join('');
};

/**
 * Appuie sur le premier element pressable dont le texte est exactement ce
 * libelle, et jette si aucun ne porte ce mot.
 * @param {any} tree L'arbre rendu.
 * @param {string} libelle Le texte du bouton.
 * @returns {Promise<void>} Rien.
 */
const appuyerSur = async (tree, libelle) => {
  const cibles = tree.root.findAll(
    (/** @type {any} */ node) => (
      typeof node.props?.onPress === 'function' && texteDuNoeud(node).trim() === libelle
    ),
    { deep: true },
  );
  if (cibles.length === 0) throw new Error(`Aucun bouton « ${libelle} »`);
  await act(async () => {
    cibles[0].props.onPress();
  });
};

/**
 * Le selecteur qui porte ce libelle, ou qu'il soit dans l'arbre.
 * @param {any} tree L'arbre rendu.
 * @param {string} label Le libelle porte par le selecteur.
 * @returns {any} Le selecteur.
 */
const selecteur = (tree, label) => tree.root.findAll(
  (/** @type {any} */ node) => node.props?.testID === 'select' && node.props?.label === label,
  { deep: true },
)[0];

/**
 * Monte l'ecran plein des filtres d'evenement avec une navigation espionnee.
 * @returns {Promise<any>} L'arbre rendu.
 */
const rendre = async () => {
  const navigation = /** @type {any} */ ({ goBack: jest.fn(), setOptions: jest.fn() });
  /** @type {any} */
  let tree;
  await act(async () => {
    tree = renderer.create(<EventFilters navigation={navigation} />);
  });
  return tree;
};

const MARSEILLE = { label: 'Marseille', value: '5.3698|43.2965' };

beforeEach(() => {
  mockGeohash.mockClear();
  mockDispatch.mockClear();
  mockEventFilters = {};
});

describe('EventFilters (ecran plein) — les criteres qu il propose, au 2026-08-12', () => {
  it('LE TEMOIN : 8 criteres, et les deux boutons de l ancien pack', async () => {
    const tree = await rendre();
    const texte = texteVisible(tree);

    // 5 criteres portes par un selecteur, dans l'ordre de l'ecran. A09 (30/09) : le 6e, le
    // Sport, est passe au choix commun a toute la recherche (populaires, puis la recherche).
    expect(selecteurs(tree).map((/** @type {any} */ node) => node.props.label)).toEqual([
      'Catégorie', 'Club', 'Équipe', 'Niveau', "Type d'événement",
    ]);
    expect(texte).toContain('Sport');
    expect(lignesDeSport(tree)[0]).toBe('Tous les sports');

    // Le 7e et le 8e : la ville (champ d'adresse) et son rayon (curseur a part).
    expect(tree.root.findAll(
      (/** @type {any} */ node) => node.props?.testID === 'adresse',
      { deep: false },
    )).toHaveLength(1);
    expect(texte).toContain('Dans un rayon autour de : 20km');

    // La rampe du rayon est PROPRE A CE MARCHE : la recopier d'un autre
    // ecran changerait un filtre sans que personne le voie.
    const curseur = tree.root.findAll(
      (/** @type {any} */ node) => node.props?.testID === 'rayon',
      { deep: false },
    )[0];
    expect(curseur.props.minimumValue).toBe(5);
    expect(curseur.props.maximumValue).toBe(50);
    expect(curseur.props.step).toBe(2);

    expect(texte).toContain('Effacer les filtres');
    expect(texte).toContain('Appliquer les filtres');
  });

  it('l etoile « Creer alerte » est posee dans l en-tete de navigation', async () => {
    const setOptions = jest.fn();
    await act(async () => {
      renderer.create(
        <EventFilters navigation={/** @type {any} */ ({ goBack: jest.fn(), setOptions })} />,
      );
    });

    const entetes = setOptions.mock.calls.filter((appel) => appel[0]?.headerRight);
    expect(entetes.length).toBeGreaterThan(0);
    expect(texteDeLElement(entetes[entetes.length - 1][0].headerRight()))
      .toContain('Créer alerte');
  });
});

describe('EventFilters (ecran plein) — ce qui part a la recherche', () => {
  it('LE TEMOIN : le payload sans ville porte les 8 criteres + teamIds', async () => {
    const tree = await rendre();

    await appuyerSur(tree, 'Appliquer les filtres');

    expect(mockDispatch).toHaveBeenCalledTimes(1);
    const { payload, type } = mockDispatch.mock.calls[0][0];
    expect(type).toBe('SET_EVENT_FILTERS');
    expect(Object.keys(payload).sort()).toEqual([
      'activity', 'category', 'city', 'club', 'level', 'radius', 'team', 'teamIds', 'type',
    ]);
    expect(payload.radius).toBe(20);
    expect(payload.teamIds).toBeNull();
  });

  it('LE TEMOIN : avec une ville, il ajoute geohash, lat et lon', async () => {
    mockEventFilters = { city: MARSEILLE, radius: 25 };
    const tree = await rendre();

    await appuyerSur(tree, 'Appliquer les filtres');

    const { payload } = mockDispatch.mock.calls[0][0];
    expect(Object.keys(payload).sort()).toEqual([
      'activity', 'category', 'city', 'club', 'geohash', 'lat', 'level',
      'lon', 'radius', 'team', 'teamIds', 'type',
    ]);
    expect(payload.city).toEqual(MARSEILLE);
    expect(payload.radius).toBe(25);
    expect(payload.lat).toBeCloseTo(43.2965);
    expect(payload.lon).toBeCloseTo(5.3698);
    expect(payload.geohash).toBe('gh(43.2965,5.3698,25)');
  });

  it('une equipe choisie voyage DEUX fois : `team` et `teamIds`', async () => {
    const tree = await rendre();

    await act(async () => {
      selecteur(tree, 'Club').props.setValue({ label: 'OM', value: 'cl-1' });
    });
    await act(async () => {
      selecteur(tree, 'Équipe').props.setValue({ label: 'U13 A', value: 'eq-1' });
    });
    await appuyerSur(tree, 'Appliquer les filtres');

    const { payload } = mockDispatch.mock.calls[0][0];
    expect(payload.team).toEqual({ label: 'U13 A', value: 'eq-1' });
    expect(payload.teamIds).toEqual(['eq-1']);
  });

  it('les criteres a choix multiple partent en TABLEAU de documentId', async () => {
    const tree = await rendre();

    await act(async () => {
      selecteur(tree, 'Catégorie').props.setValue([{ value: 'c-1' }]);
    });
    await act(async () => {
      selecteur(tree, 'Niveau').props.setValue([{ value: 'n-1' }]);
    });
    await act(async () => {
      selecteur(tree, "Type d'événement").props.setValue([{ value: 't-1' }]);
    });
    // A09 — le sport se coche par sa LIGNE dans le choix commun.
    await choisirLeSport(tree, 'Football');
    await appuyerSur(tree, 'Appliquer les filtres');

    const { payload } = mockDispatch.mock.calls[0][0];
    expect(payload.category).toEqual(['c-1']);
    expect(payload.level).toEqual(['n-1']);
    expect(payload.type).toEqual(['t-1']);
    expect(payload.activity).toEqual(['a-1']);
  });

  it('« Effacer les filtres » vide TOUT', async () => {
    mockEventFilters = { category: ['c-1'], city: MARSEILLE, q: 'tournoi' };
    const tree = await rendre();

    await appuyerSur(tree, 'Effacer les filtres');

    expect(mockDispatch).toHaveBeenCalledWith({ payload: {}, type: 'SET_EVENT_FILTERS' });
  });

  it('LE DEFAUT CONSTATE : le texte de la barre de recherche (`q`) est DETRUIT', async () => {
    // L'ecran plein reconstruit le payload a partir du seul formulaire : la
    // clef `q`, rangee dans la MEME poche par la barre de recherche, disparait
    // a chaque validation. Ligne ecrite pour CONSTATER, pas pour approuver.
    mockEventFilters = { city: MARSEILLE, q: 'tournoi' };
    const tree = await rendre();

    await appuyerSur(tree, 'Appliquer les filtres');

    expect(mockDispatch.mock.calls[0][0].payload.q).toBeUndefined();
  });

  it('DEFAUT CORRIGE (BUGHUNT P8-14) : le sport applique revient a la reouverture', async () => {
    // L'ecran ECRIVAIT `activity` mais RELISAIT `eventFilters.activities` (au
    // pluriel) : le sport choisi n'etait jamais reaffiche. Il se relit sous son nom.
    mockEventFilters = { activity: ['a-1'] };
    const tree = await rendre();

    // (A09 : le sport se lit dans le choix commun — Football, choisi, passe en tête.)
    expect(lignesDeSport(tree)[0]).toBe('Football');
  });

  // 🐞 BUGHUNT P8-14 (BH06) — le défaut ci-dessus, corrigé : le sport appliqué revient, et
  // « Appliquer » sans rien toucher le garde au lieu de l'effacer.
  it('P8-14 — rouvrir puis appliquer garde le sport choisi', async () => {
    mockEventFilters = { activity: ['a-1'] };
    const tree = await rendre();

    await appuyerSur(tree, 'Appliquer les filtres');

    expect(mockDispatch.mock.calls[0][0].payload.activity).toEqual(['a-1']);
  });

  // 🐞 BUGHUNT P8-15 (BH06) — un club DÉJÀ appliqué : la liste des équipes doit se charger.
  it('P8-15 — club déjà appliqué : les équipes de ce club sont demandées', async () => {
    mockEventFilters = { club: { label: 'FC Test', value: 'club-1' } };
    await rendre();

    expect(mockUseGetTeams).toHaveBeenLastCalledWith({ clubId: 'club-1' }, { enabled: true });
  });
});

describe('A09 — le sport : populaires en haut, recherche dans TOUS les sports', () => {
  beforeEach(() => { mockSports = SPORTS_A09; });
  afterEach(() => { mockSports = SPORTS_PAR_DEFAUT; });

  it('populaires en tête (ordre d Adel), recherche sans accent, et le choix part', async () => {
    const tree = await rendre();

    // Décision d'Adel : football, basketball, handball, rugby, volleyball — Tennis attend.
    expect(lignesDeSport(tree)).toEqual(POPULAIRES_EN_TETE);
    // « Une recherche à la main dans TOUS les sports », accents compris.
    await chercherUnSport(tree, 'equit');
    expect(lignesDeSport(tree)).toEqual(['Équitation']);

    await choisirLeSport(tree, 'Équitation');
    await appuyerSur(tree, 'Appliquer les filtres');
    expect(mockDispatch.mock.calls[0][0].payload.activity).toEqual(['a-equit']);
  });
});

// PAR-L10 (12/10) — l'appelant frère de `useAlerteRecherche` : l'écran plein lisait lui
// aussi `err.response.data.error.message`, que le client HTTP ne rend jamais (il rejette
// la charge Strapi déballée, `client.native.js:91-97`). Chaque refus devenait « Erreur
// lors de la sauvegarde ».
describe('PAR-L10 — l écran plein dit pourquoi l alerte n a pas été enregistrée', () => {
  // eslint-disable-next-line global-require
  const { Alert } = require('react-native');

  const {
    createSearchAlert,
    getPreviewCount,
    // eslint-disable-next-line global-require
  } = require('@/services/searchAlert/searchAlertService');

  /**
   * Ouvre la fenêtre « Créer une alerte » par l'étoile, nomme l'alerte et l'enregistre,
   * contre ce refus.
   * @param {any} refus Ce que le client HTTP rejette.
   * @returns {Promise<any[]>} Les arguments du message affiché.
   */
  const enregistrerContre = async (refus) => {
    const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const journal = jest.spyOn(console, 'error').mockImplementation(() => {});
    createSearchAlert.mockRejectedValueOnce(refus);
    // Le compteur « Pour le moment, N événements » passe par un pluriel que la
    // doublure de `t` ne sait pas rendre : sans compteur, la fenêtre reste lisible.
    getPreviewCount.mockRejectedValueOnce(new Error('compteur hors sujet'));
    mockEventFilters = { city: MARSEILLE, radius: 25 };
    const setOptions = jest.fn();
    /** @type {any} */
    let tree;
    await act(async () => {
      tree = renderer.create(
        <EventFilters navigation={/** @type {any} */ ({ goBack: jest.fn(), setOptions })} />,
      );
    });
    const entetes = setOptions.mock.calls.filter((appel) => appel[0]?.headerRight);
    const etoile = entetes[entetes.length - 1][0].headerRight();
    await act(async () => { await etoile.props.children.props.onPress(); });
    const saisie = tree.root.findAll(
      (/** @type {any} */ n) => n.props?.testID === 'saisie' && n.props?.onChangeText,
    )[0];
    await act(async () => { saisie.props.onChangeText('Matchs Marseille'); });
    await appuyerSur(tree, 'Enregistrer'); // PETITSBUGS-2 (28/10) : common.save, accepté par le chef
    await act(async () => { await Promise.resolve(); });
    const appels = alerte.mock.calls;
    alerte.mockRestore();
    journal.mockRestore();
    expect(createSearchAlert).toHaveBeenCalled();
    return appels[appels.length - 1];
  };

  it('limite de 10 alertes (400) : la phrase lisible, plus « Erreur lors… »', async () => {
    const [titre, corps] = await enregistrerContre({
      details: {},
      message: 'Limite de 10 alertes atteinte. Supprimez une alerte existante.',
      name: 'BadRequestError',
      status: 400,
    });

    expect(titre).toBe('Erreur');
    expect(corps).toBe('Tu as déjà 10 alertes : supprimes-en une dans Mes alertes.');
  });

  it('un refus de droit (403) : « Ton compte ne peut pas encore créer d alerte. »', async () => {
    const [, corps] = await enregistrerContre({
      details: {}, message: 'Forbidden', name: 'ForbiddenError', status: 403,
    });

    expect(corps).toBe('Ton compte ne peut pas encore créer d\'alerte.');
  });
});

// CORR-MESSAGERIE p67 (31/10, décision d'Adel « A ») — créer une alerte : la ville grise
// « Marseille » avait l'air déjà choisie ; sans ville, « Créer l'alerte » ne disait rien sur le
// site (Alert.alert de react-native-web est muet).
describe('CORR-MESSAGERIE p67 — le chemin de création d une alerte', () => {
  afterEach(() => { mockRouteParams = {}; });

  const monterEnCreation = async () => {
    mockRouteParams = { createAlertMode: true };
    mockEventFilters = {};
    /** @type {any} */
    let tree;
    await act(async () => {
      tree = renderer.create(
        <EventFilters navigation={/** @type {any} */ ({ goBack: jest.fn(), setOptions: jest.fn() })} />,
      );
    });
    return tree;
  };

  it('la ville vide invite à choisir, elle ne montre pas « Marseille » comme un choix', async () => {
    const tree = await monterEnCreation();
    const champsVille = tree.root.findAll(
      (/** @type {any} */ n) => typeof n.props?.setAddress === 'function',
    );
    expect(champsVille.length).toBeGreaterThan(0);
    expect(champsVille[0].props.placeholder).toBe('Choisir une ville (ex. : Marseille)');
  });

  it('sans ville, « Créer l alerte » le dit DANS la page', async () => {
    const tree = await monterEnCreation();
    await appuyerSur(tree, "Créer l'alerte");
    expect(texteVisible(tree)).toContain('La ville et le rayon sont obligatoires pour créer une alerte');
  });
});
