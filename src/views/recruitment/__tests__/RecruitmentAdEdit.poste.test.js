// Le VRAI i18next : les messages viennent de `fr.js`.
import '@/theme/strings';

import { Alert, TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import RecruitmentAdEdit from '../RecruitmentAdEdit';

// RECRUTER-TUNNEL (audit V1, point H2) — L'ECRAN FRERE DU RECAPITULATIF.
//
// E6 : cet ecran (618 lignes) n'avait AUCUN test. Les trois premiers temoins
// decrivent ses regles d'enregistrement ; le quatrieme est ecrit ROUGE.
//
// 🧨 CE QUE CE FILET A TROUVE EN PASSANT, et c'est pire que H2 : ecrits pour
// decrire l'existant, les trois premiers etaient ROUGES eux aussi. « Enregistrer
// les modifications » ne faisait RIEN — ni envoi, ni alerte — pour toute annonce
// sans certification : le schema Joi refusait le `certificationsWanted: ''` que
// l'ecran fabrique lui-meme (sonde du 2026-09-30 : « is not allowed to be empty »).
// Corrige dans le schema ; ces trois temoins le gardent.
//
// Pourquoi il est dans ce lot : H2 laisse enfin partir une annonce SANS poste
// pour un sport qui ne se joue pas par postes (arts martiaux...). « Modifier »
// exigeait alors un poste que l'annonce n'a jamais eu : son auteur ne pouvait
// plus rien enregistrer — ni la description, ni la quantite — sans en inventer un.
//
// Pilote par ce qui part au serveur (`updateRecruitmentAd`) et par ce que
// l'ecran refuse (`Alert.alert`) — jamais par la forme de l'arbre.

// Le premier montage charge tout l'ecran et ses dependances : ~20 s mesurees.
jest.setTimeout(60000);

const mockMiseAJour = jest.fn();
const mockClientRequete = { invalidateQueries: jest.fn() };
// Enveloppes FIGEES au niveau module : une doublure qui les reconstruit a chaque
// appel relance l'effet `reset(...)` de l'ecran en boucle (piege R03, TeamEdit).
const mockLectureAnnonce = Object.freeze({
  data: undefined, error: null, isLoading: false, refetch: jest.fn(),
});
const mockListeVide = Object.freeze({ data: Object.freeze([]) });

jest.mock('@tanstack/react-query', () => ({
  useMutation: () => ({
    isPending: false,
    mutate: (/** @type {any} */ donnees) => mockMiseAJour(donnees),
  }),
  useQuery: () => mockLectureAnnonce,
  useQueryClient: () => mockClientRequete,
}));

// ⛔ Jamais `requireActual` sur un service : le client HTTP refuse de se charger
// sans `API_URL` et fait tomber la suite AVANT le premier rendu.
jest.mock('@/services/recruitment/recruitmentService', () => ({
  getRecruitmentAd: jest.fn(),
  updateRecruitmentAd: jest.fn(),
}));
jest.mock('@/services/category/categoryQueries', () => ({ useGetCategories: () => mockListeVide }));
jest.mock('@/services/level/levelQueries', () => ({ useGetLevels: () => mockListeVide }));
jest.mock('@/services/section/sectionQueries', () => ({ useGetSections: () => mockListeVide }));

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

jest.mock('@/components/templates/ScreenContainer', () => {
  // eslint-disable-next-line global-require
  const { View } = require('react-native');
  return { __esModule: true, default: (/** @type {any} */ { children }) => <View>{children}</View> };
});

// La doublure de `Button` rend un VRAI pressable portant son titre : on appuie
// sur « Enregistrer les modifications » comme un utilisateur.
jest.mock('@/components/atoms/button/Button', () => {
  // eslint-disable-next-line global-require
  const { Text, TouchableOpacity } = require('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { onPress, title }) => (
      <TouchableOpacity accessibilityRole="button" onPress={onPress}>
        <Text>{title}</Text>
      </TouchableOpacity>
    ),
  };
});

// Un champ est un `TextInput` nomme par son intitule.
jest.mock('@/components/molecules/input/Input', () => {
  // eslint-disable-next-line global-require
  const { TextInput: Champ } = require('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { label, onChangeText, value }) => (
      <Champ accessibilityLabel={label} onChangeText={onChangeText} value={value} />
    ),
  };
});
jest.mock('@/components/molecules/autocompleteSelect/AutocompleteSelect', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/molecules/inputStepper/InputStepper', () => ({
  __esModule: true,
  default: () => null,
}));

// Une vraie annonce porte toujours categorie, niveau et section : sans eux, le
// schema Joi de l'ecran refuse le formulaire EN SILENCE (ni envoi, ni alerte).
const PROFIL_SPORTIF = Object.freeze({
  category: Object.freeze({ documentId: 'cat-1', name: 'U17' }),
  level: Object.freeze({ documentId: 'niv-1', name: 'Régional' }),
  section: Object.freeze({ documentId: 'sec-1', name: 'Masculine' }),
});

const ANNONCE_GARDIEN = Object.freeze({
  ...PROFIL_SPORTIF,
  audienceType: 'player',
  description: 'On cherche un gardien.',
  documentId: 'annonce-gardien',
  position: 'Gardien',
  quantity: 1,
  team: Object.freeze({ name: 'U17' }),
});

// Ce que le tunnel publie desormais pour un sport sans postes : aucun poste.
const ANNONCE_ARTS_MARTIAUX = Object.freeze({
  ...PROFIL_SPORTIF,
  audienceType: 'player',
  description: '',
  documentId: 'annonce-arts-martiaux',
  position: null,
  quantity: 1,
  sport: 'Arts martiaux',
  team: Object.freeze({ name: 'U13' }),
});

const ANNONCE_ENTRAINEUR = Object.freeze({
  ...PROFIL_SPORTIF,
  audienceType: 'coach',
  coachExperienceLevel: 'confirme',
  coachRole: 'entraineur_adjoint',
  description: '',
  documentId: 'annonce-coach',
  engagementType: 'benevole',
  position: null,
  quantity: 1,
  team: Object.freeze({ name: 'U13' }),
});

/** @type {any} */
let arbre = null;
/** @type {jest.SpyInstance} */
let alerte;

beforeEach(() => {
  jest.clearAllMocks();
  alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
  alerte.mockRestore();
});

/**
 * Ouvre « Modifier l'annonce » sur une annonce deja chargee.
 * @param {any} annonce L'annonce passee par la fiche.
 * @returns {Promise<void>} Rien.
 */
const ouvrir = async (annonce) => {
  await act(async () => {
    arbre = renderer.create(
      <RecruitmentAdEdit
        navigation={{ goBack: jest.fn() }}
        route={{ params: { ad: annonce } }}
      />,
    );
  });
};

/**
 * Tape dans un champ nomme.
 * @param {string} intitule L'intitule du champ.
 * @param {string} texte Ce qu'on tape.
 * @returns {Promise<void>} Rien.
 */
const taper = async (intitule, texte) => {
  const [champ] = arbre.root.findAll(
    (/** @type {any} */ noeud) => noeud.type === TextInput && noeud.props.accessibilityLabel === intitule,
  );
  await act(async () => {
    champ.props.onChangeText(texte);
  });
};

/**
 * Appuie sur « Enregistrer les modifications », puis laisse la validation
 * (asynchrone) aboutir. Attente BORNEE par une condition : 20 tours au plus.
 * @returns {Promise<void>} Rien.
 */
const enregistrer = async () => {
  const [bouton] = arbre.root.findAll(
    (/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function'
      && noeud.props.accessibilityRole === 'button',
  );
  await act(async () => {
    bouton.props.onPress();
  });
  for (let tour = 0; tour < 20; tour += 1) {
    if (mockMiseAJour.mock.calls.length > 0 || alerte.mock.calls.length > 0) break;
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await new Promise((resolve) => { setTimeout(resolve, 0); });
    });
  }
};

describe('RecruitmentAdEdit — ses regles d enregistrement (E6)', () => {
  it('une annonce joueur avec son poste s enregistre, poste compris', async () => {
    await ouvrir(ANNONCE_GARDIEN);
    await enregistrer();

    expect(alerte).not.toHaveBeenCalled();
    expect(mockMiseAJour).toHaveBeenCalledTimes(1);
    expect(mockMiseAJour.mock.calls[0][0]).toEqual(expect.objectContaining({
      coachRole: null,
      position: 'Gardien',
      quantity: 1,
    }));
  });

  it('on ne peut pas EFFACER le poste d une annonce qui en a un', async () => {
    await ouvrir(ANNONCE_GARDIEN);
    await taper('Poste', '   ');
    await enregistrer();

    expect(mockMiseAJour).not.toHaveBeenCalled();
    expect(alerte).toHaveBeenCalledWith('Erreur', 'Le poste est requis.');
  });

  it('une annonce entraineur n envoie jamais de poste', async () => {
    await ouvrir(ANNONCE_ENTRAINEUR);
    await enregistrer();

    expect(alerte).not.toHaveBeenCalled();
    expect(mockMiseAJour.mock.calls[0][0]).toEqual(expect.objectContaining({
      coachRole: 'entraineur_adjoint',
      position: null,
    }));
  });
});

describe('RECRUTER-TUNNEL H2 — une annonce publiee SANS poste reste modifiable', () => {
  it('LE TEMOIN ROUGE : l auteur enregistre sa description sans inventer de poste', async () => {
    await ouvrir(ANNONCE_ARTS_MARTIAUX);
    await taper('Description', 'Cours le mardi soir, tous grades.');
    await enregistrer();

    expect(alerte).not.toHaveBeenCalledWith('Erreur', 'Le poste est requis.');
    expect(mockMiseAJour).toHaveBeenCalledTimes(1);
    expect(mockMiseAJour.mock.calls[0][0]).toEqual(expect.objectContaining({
      description: 'Cours le mardi soir, tous grades.',
      position: '',
    }));
  });
});
