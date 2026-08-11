import { Alert, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { updateClub } from '@/services/club/clubService';
import { updateMultisportClub } from '@/services/multisportClub/multisportClubService';

import AddSponsor from '../AddSponsor';

// D51 (E6) : AddSponsor.js n'avait AUCUN test alors qu'il porte deux choses
// qu'une refonte visuelle ne doit jamais deplacer : le NETTOYAGE de la charge
// envoyee au serveur (4 champs retires sous peine de « Document not found »
// cote Strapi) et l'aiguillage club / structure multisport.
//
// Ce fichier fige ce comportement AVANT la refonte D51 (ecran 08 du pack) et
// doit passer, INCHANGE sur sa partie reseau, avant et apres.
//
// Il est pilote par le TEXTE VISIBLE et par ce qui part sur le reseau, jamais
// par la forme de l'arbre : la zone logo peut passer d'un apercu pleine largeur
// a un carre pointille de 104 pt sans qu'une ligne d'ici ne bouge.

/** @type {any[]} */
const mockButtonProps = [];
/** @type {any[]} */
const mockInputProps = [];
/** @type {any[]} */
const mockAvatarProps = [];
/** @type {any[]} */
const mockScreenProps = [];

/** @type {any} */
let mockNavigation;
/** @type {any} */
let mockClubQuery;
/** @type {any} */
let mockMultisportQuery;

// Doublure de `t` branchee sur la VRAIE fr.js, et c'est deliberé : un faux `t`
// qui rend toujours son repli ne voit jamais le fichier de traduction, alors
// que l'ecran reel, lui, prend fr.js quand la cle existe. Ce piege a ete paye
// sur l'ecran 04 du meme lot — des tests verts sur une copy que personne
// n'affichait. Ici, ce que le test lit est ce que l'utilisateur lit.
jest.mock('react-i18next', () => {
  const traductions = jest.requireActual('@/theme/strings/translations/fr').default;

  return {
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
        const valeur = String(cle).split('.').reduce(
          (/** @type {any} */ noeud, /** @type {string} */ segment) => (
            noeud === null || noeud === undefined ? undefined : noeud[segment]
          ),
          traductions,
        );

        if (typeof valeur === 'string') return valeur;
        return typeof repli === 'string' ? repli : cle;
      },
    }),
  };
});

// Le VRAI theme, sans le contexte React qui le porte : un mock en Proxy rend
// les echecs Jest illisibles (constat du lot paywall, 2026-08-02), et un objet
// invente masquerait un jeton absent.
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
      Images: { camera: 1, pin: 1 },
      Spaces: espaces,
    }),
  };
});

// Le vrai Joi, sans passer par `@/theme/strings` : ce module tire toute la
// chaine i18n, dont ce test n'a aucun besoin. La VALIDATION, elle, doit rester
// authentique — c'est elle qui decide si le bouton part ou non.
jest.mock('@/theme/strings', () => ({ Joi: jest.requireActual('joi') }));

// Doublure fidele de react-query : la mutation appelle vraiment sa mutationFn
// puis onSuccess / onError, sinon « ce qui part sur le reseau » ne partirait
// jamais et le test ne mesurerait rien.
jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => ({
    isPending: false,
    mutate: (/** @type {any} */ variables) => Promise.resolve()
      .then(() => options.mutationFn(variables))
      .then((/** @type {any} */ data) => options.onSuccess?.(data, variables))
      .catch((/** @type {any} */ error) => options.onError?.(error, variables)),
  }),
  useQuery: () => mockMultisportQuery,
}));

jest.mock('@/services/club/clubQueries', () => ({
  useGetClub: () => mockClubQuery,
}));

jest.mock('@/services/club/clubService', () => ({ updateClub: jest.fn() }));

jest.mock('@/services/multisportClub/multisportClubService', () => ({
  getMultisportClubById: jest.fn(),
  updateMultisportClub: jest.fn(),
}));

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock(/** @type {any} */ props) {
    mockScreenProps.push(props);
    return props.children;
  },
);

// Le bouton est rendu comme un vrai element pressable portant son libelle :
// c'est ce qui permet d'appuyer « sur le texte », que le libelle soit porte par
// un Button aujourd'hui ou par un TouchableOpacity apres la refonte.
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');

  return function ButtonMock(/** @type {any} */ props) {
    mockButtonProps.push(props);
    return reactActuel.createElement(
      PressableRN,
      { disabled: props.disabled || props.isLoading, onPress: props.onPress },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});

jest.mock('@/components/molecules/input/Input', () => function InputMock(/** @type {any} */ props) {
  mockInputProps.push(props);
  return null;
});

jest.mock(
  '@/components/molecules/selectAvatar/SelectAvatar',
  () => function SelectAvatarMock(/** @type {any} */ props) {
    mockAvatarProps.push(props);
    return null;
  },
);

jest.mock(
  '@/views/club/components/ClubStateView',
  () => {
    const reactActuel = jest.requireActual('react');
    const { Text: TexteRN, View: VueRN } = jest.requireActual('react-native');

    return function ClubStateViewMock(/** @type {any} */ { description, title }) {
      return reactActuel.createElement(
        VueRN,
        null,
        reactActuel.createElement(TexteRN, null, title),
        reactActuel.createElement(TexteRN, null, description),
      );
    };
  },
);

const LOGO = { height: 100, uri: 'file://logo.png', width: 200 };

// Un club tel qu'il revient VRAIMENT de l'API : peuple de relations que la
// mise a jour ne sait pas renvoyer telles quelles.
const CLUB_PEUPLE = {
  admins: [{ id: 7 }],
  documentId: 'club-1',
  name: 'SMUC',
  parentMultisport: { id: 3 },
  sections: [{ id: 1 }],
  sponsor: [{ title: 'Elseve' }],
  user: { id: 42 },
};

/**
 * Aplati les enfants React en une chaine, pour lire le texte rendu.
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
 * Aplati un style RN (tableau imbrique, valeurs fausses) en un seul objet.
 * @param {any} style
 * @returns {any}
 */
const aplatirStyle = (style) => {
  if (Array.isArray(style)) return Object.assign({}, ...style.map(aplatirStyle));
  if (!style || typeof style !== 'object') return {};
  return style;
};

/**
 * Texte visible sous un noeud de l'arbre rendu.
 * @param {any} noeud
 * @returns {string}
 */
const texteDe = (noeud) => noeud
  .findAllByType(Text)
  .map((/** @type {any} */ texte) => aplatirTexte(texte.props.children))
  .join(' ');

/**
 * Appuie sur l'element pressable qui porte ce libelle.
 * @param {any} arbre
 * @param {string} libelle
 * @returns {Promise<void>}
 */
const appuyerSur = async (arbre, libelle) => {
  const candidats = arbre.root
    .findAll((/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function')
    .filter((/** @type {any} */ noeud) => texteDe(noeud).includes(libelle));

  if (candidats.length === 0) {
    throw new Error(`Aucun element pressable ne porte le libelle « ${libelle} »`);
  }

  const cible = candidats.find((/** @type {any} */ noeud) => texteDe(noeud).trim() === libelle)
    || candidats[candidats.length - 1];

  await act(async () => {
    cible.props.onPress();
  });
};

/**
 * Dernieres props recues par une doublure.
 * @param {any[]} journal
 * @returns {any}
 */
const dernieresProps = (journal) => journal[journal.length - 1];

/**
 * Monte l'ecran.
 * @param {{ params?: any }} [options]
 * @returns {Promise<any>}
 */
const monterEcran = async (options = {}) => {
  const route = { params: options.params || { clubId: 'club-1' } };

  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<AddSponsor navigation={mockNavigation} route={route} />);
  });
  return arbre;
};

/**
 * Choisit un logo.
 * @param {any} [logo]
 * @returns {Promise<void>}
 */
const choisirLogo = async (logo = LOGO) => {
  const zone = dernieresProps(mockAvatarProps);
  await act(async () => {
    zone.onAvatarSelected(logo);
  });
};

/**
 * Saisit le nom du partenaire (premier champ texte de l'ecran).
 * @param {string} valeur
 * @returns {Promise<void>}
 */
const saisirNom = async (valeur) => {
  const champ = mockInputProps.find((/** @type {any} */ props) => props.name !== 'link')
    || mockInputProps[0];
  await act(async () => {
    champ.onChangeText(valeur);
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockButtonProps.length = 0;
  mockInputProps.length = 0;
  mockAvatarProps.length = 0;
  mockScreenProps.length = 0;

  mockNavigation = { goBack: jest.fn(), navigate: jest.fn() };
  mockClubQuery = {
    data: CLUB_PEUPLE,
    error: null,
    isLoading: false,
    refetch: jest.fn(),
  };
  mockMultisportQuery = {
    data: null,
    error: null,
    isLoading: false,
    refetch: jest.fn(),
  };

  /** @type {any} */ (updateClub).mockResolvedValue({ documentId: 'club-1' });
  /** @type {any} */ (updateMultisportClub).mockResolvedValue({ documentId: 'cm-1' });
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  /** @type {any} */ (Alert.alert).mockRestore?.();
});

describe('AddSponsor — garde-fous de contexte', () => {
  it('sans club ni structure multisport, l ecran ne propose pas le formulaire', async () => {
    const arbre = await monterEcran({ params: {} });

    expect(texteDe(arbre.root)).toContain('Contexte introuvable');
  });

  it('un parametre de route non resolu (« :clubId ») compte comme absent', async () => {
    const arbre = await monterEcran({ params: { clubId: ':clubId' } });

    expect(texteDe(arbre.root)).toContain('Contexte introuvable');
  });

  it('pendant le chargement du club, l ecran le dit', async () => {
    mockClubQuery = {
      data: null, error: null, isLoading: true, refetch: jest.fn(),
    };
    const arbre = await monterEcran();

    expect(texteDe(arbre.root)).toContain('Chargement du contexte');
  });

  it('si le club ne se charge pas, l ecran propose de reessayer', async () => {
    mockClubQuery = {
      data: null, error: new Error('reseau coupe'), isLoading: false, refetch: jest.fn(),
    };
    const arbre = await monterEcran();

    expect(texteDe(arbre.root)).toContain('Ajout indisponible');
  });

  it('si le club est introuvable, l ecran le distingue d une panne', async () => {
    mockClubQuery = {
      data: null, error: null, isLoading: false, refetch: jest.fn(),
    };
    const arbre = await monterEcran();

    expect(texteDe(arbre.root)).toContain('Club introuvable');
  });
});

describe('AddSponsor — ce qui part sur le reseau', () => {
  it('sans logo, rien ne part : le partenaire ne peut pas etre anonyme', async () => {
    const arbre = await monterEcran();
    await saisirNom('Nike');

    await appuyerSur(arbre, 'Ajouter');

    expect(updateClub).not.toHaveBeenCalled();
  });

  it('avec un logo et un nom, le partenaire est AJOUTE aux existants', async () => {
    const arbre = await monterEcran();
    await saisirNom('Nike');
    await choisirLogo();

    await appuyerSur(arbre, 'Ajouter');

    const charge = /** @type {any} */ (updateClub).mock.calls[0][0];
    expect(charge.sponsor).toHaveLength(2);
    expect(charge.sponsor[0]).toEqual({ title: 'Elseve' });
    expect(charge.sponsor[1]).toMatchObject({ logo: LOGO, title: 'Nike' });
  });

  // Ces 4 champs font echouer Strapi avec « Document not found » s'ils partent
  // peuples. Leur retrait n'est pas une optimisation, c'est la condition pour
  // que l'enregistrement fonctionne.
  it('la charge est nettoyee des 4 relations que Strapi refuse', async () => {
    const arbre = await monterEcran();
    await saisirNom('Nike');
    await choisirLogo();

    await appuyerSur(arbre, 'Ajouter');

    const charge = /** @type {any} */ (updateClub).mock.calls[0][0];
    expect(charge).not.toHaveProperty('parentMultisport');
    expect(charge).not.toHaveProperty('sections');
    expect(charge).not.toHaveProperty('admins');
    expect(charge).not.toHaveProperty('user');
    expect(charge.documentId).toBe('club-1');
  });

  it('apres l enregistrement, on revient a l ecran precedent', async () => {
    const arbre = await monterEcran();
    await saisirNom('Nike');
    await choisirLogo();

    await appuyerSur(arbre, 'Ajouter');

    expect(mockNavigation.goBack).toHaveBeenCalled();
  });

  it('si l enregistrement echoue, une alerte le dit et on ne repart pas', async () => {
    /** @type {any} */ (updateClub).mockRejectedValue(new Error('500'));
    const arbre = await monterEcran();
    await saisirNom('Nike');
    await choisirLogo();

    await appuyerSur(arbre, 'Ajouter');

    expect(Alert.alert).toHaveBeenCalled();
    expect(mockNavigation.goBack).not.toHaveBeenCalled();
  });
});

describe('AddSponsor — refonte D51 ecran 08', () => {
  // Un dirigeant qui ajoute un logo ne sait pas ou il va apparaitre. Sans cette
  // ligne, il decouvre le resultat apres coup, sur une carte equipe.
  it('l ecran dit OU le partenaire va apparaitre', async () => {
    const arbre = await monterEcran();
    const texte = texteDe(arbre.root);

    expect(texte).toContain('cartes équipe');
    expect(texte).toContain('annonces');
    expect(texte).toContain('page du club');
  });

  it('le bouton dit ce qu il ajoute, pas seulement « Ajouter »', async () => {
    const arbre = await monterEcran();

    expect(texteDe(arbre.root)).toContain('Ajouter le partenaire');
  });
});

describe('AddSponsor — aiguillage club / structure multisport', () => {
  it('sans clubId mais avec un cmId, c est la structure multisport qui est mise a jour', async () => {
    mockClubQuery = {
      data: null, error: null, isLoading: false, refetch: jest.fn(),
    };
    mockMultisportQuery = {
      data: { documentId: 'cm-1', name: 'SMUC omnisport', sponsor: [] },
      error: null,
      isLoading: false,
      refetch: jest.fn(),
    };

    const arbre = await monterEcran({ params: { cmId: 'cm-1' } });
    await saisirNom('Nike');
    await choisirLogo();

    await appuyerSur(arbre, 'Ajouter');

    expect(updateClub).not.toHaveBeenCalled();
    expect(updateMultisportClub).toHaveBeenCalledWith('cm-1', expect.anything());
  });
});

// D63 : Adel a compare l'ecran 04 du meme pack a sa maquette et a vu un ecart
// de FORME que toutes les portes de D51 avaient laisse passer. Les 3 autres
// ecrans du lot portaient le meme genre d'ecart, celui-ci compris.
describe('AddSponsor — D63 : l ecart entre la maquette et l ecran', () => {
  it('le contenu ne colle plus aux deux bords de l ecran', async () => {
    // Aucune marge laterale nulle part : ni sur le conteneur d ecran, ni sur
    // le defilement. Les champs ET le bouton touchaient les bords.
    await monterEcran();

    const marges = mockScreenProps
      .map((/** @type {any} */ props) => aplatirStyle(props.contentContainerStyle))
      .map((/** @type {any} */ style) => style.paddingHorizontal)
      .filter((/** @type {any} */ marge) => typeof marge === 'number' && marge > 0);

    expect(marges.length).toBeGreaterThan(0);
  });

  it('« Annuler » accompagne le bouton d ajout, comme sur la maquette', async () => {
    // La maquette pose « Annuler » en texte sous le CTA de chacun de ses
    // formulaires. Sans lui, le seul retour en arriere est la fleche de
    // l en-tete — et l ecran ne le dit pas.
    const arbre = await monterEcran();

    expect(texteDe(arbre.root)).toContain('Annuler');
  });

  it('« Annuler » revient a l ecran precedent sans rien envoyer', async () => {
    const arbre = await monterEcran();

    await appuyerSur(arbre, 'Annuler');

    expect(mockNavigation.goBack).toHaveBeenCalled();
    expect(updateClub).not.toHaveBeenCalled();
  });
});
