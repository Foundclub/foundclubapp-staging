import { Image, Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import UserHistorySection from '../UserHistorySection';

// D54 (E6) — `UserHistorySection.js` fait 402 lignes, sert TROIS ecrans
// (`UserDetails`, `SelfProfilePlayerCoach` via lui, et l'onboarding
// `UserSportHistory`) et n'avait AUCUN test. On en pose un avant d'y toucher.
//
// Ce que le pack demande : « une seule grammaire d'ajout (carte pointillee
// cyan EN PIED DE LISTE) ; le bouton rond « + » disparait ».
//
// 🪤 LE PIEGE, ET IL EST MESURE : la carte pointillee n'existait QUE dans
// l'etat vide (`sortedHistories.length === 0`). Des qu'on avait une seule
// experience, le bouton rond etait le SEUL moyen d'en ajouter une autre.
// Le retirer sans porter la carte pointillee en pied de liste n'aurait pas
// supprime un doublon : ca aurait supprime la FONCTION.
//
// Les deux temoins vont donc ensemble, et le second est l'anti-regression :
//   1. plus aucun bouton rond « + » ;
//   2. « Ajouter une experience » reste atteignable AVEC des experiences.

/** @type {any} */
let mockHistories;
const mockDelete = jest.fn();

jest.mock('react-i18next', () => {
  const traductions = jest.requireActual('@/theme/strings/translations/fr').default;
  return {
    initReactI18next: { init: () => {}, type: '3rdParty' },
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ options) => {
        const valeur = String(cle || '').split('.').reduce(
          (/** @type {any} */ noeud, /** @type {string} */ segment) => (
            noeud && typeof noeud === 'object' ? noeud[segment] : undefined
          ),
          traductions,
        );
        const brut = typeof valeur === 'string'
          ? valeur
          : (typeof repli === 'string' ? repli : cle);
        // `profile.history.count` porte un `{{count}}` : on l'interpole comme
        // i18next le ferait, sinon le texte rendu ne ressemble a rien.
        return brut.replace(
          /\{\{(\w+)\}\}/g,
          (/** @type {string} */ _entier, /** @type {string} */ cleOption) => (
            String(options?.[cleOption] ?? '')
          ),
        );
      },
    }),
  };
});

jest.mock('@/services/userHistory/userHistoryQueries', () => ({
  useDeleteHistory: () => ({ isPending: false, mutate: mockDelete }),
  useGetMyHistories: () => ({ data: mockHistories, isLoading: false }),
  useGetUserHistories: () => ({ data: mockHistories, isLoading: false }),
}));

jest.mock('@/components/molecules/clubLogoMark/ClubLogoMark', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { club }) => <TexteRN>{`BLASON:${club?.name || ''}`}</TexteRN>,
  };
});

// Le VRAI theme, sans le contexte React qui le porte. Seul `Images` est un
// stub, et il l'est NOMMEMENT : c'est ce qui rend le bouton rond identifiable
// sans lire la forme de l'arbre.
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
      Images: { plus: 'IMAGE_PLUS', trash: 'IMAGE_CORBEILLE' },
      Spaces: espaces,
    }),
  };
});

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
 * Le pressable qui porte ce texte, s'il existe.
 * @param {any} arbre
 * @param {string} texte
 * @returns {any}
 */
const pressablePortant = (arbre, texte) => arbre.root
  .findAllByType(TouchableOpacity)
  .find((/** @type {any} */ noeud) => noeud
    .findAllByType(Text)
    .some((/** @type {any} */ enfant) => aplatirTexte(enfant.props.children).includes(texte)));

/**
 * Les boutons ronds « + » encore rendus.
 * @param {any} arbre
 * @returns {any[]}
 */
const boutonsRondsPlus = (arbre) => arbre.root
  .findAllByType(Image)
  .filter((/** @type {any} */ noeud) => noeud.props.source === 'IMAGE_PLUS');

/**
 * @param {any} [props]
 * @returns {Promise<any>}
 */
const rendre = async (props = {}) => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <UserHistorySection isOwnProfile {...props} />,
    );
  });
  return arbre;
};

/** Une experience deja saisie : le cas ou le bouton rond etait seul. */
const uneExperience = [{
  category: { name: 'Senior' },
  club: { name: 'Stade Marseillais UC' },
  documentId: 'exp-1',
  endYear: 2023,
  level: { name: 'Regional 1' },
  startYear: 2015,
}];

beforeEach(() => {
  jest.clearAllMocks();
  mockHistories = [];
});

describe('D54 · le bouton rond « + » disparait', () => {
  it('n\'en rend AUCUN quand la liste est vide', async () => {
    mockHistories = [];

    const arbre = await rendre();

    expect(boutonsRondsPlus(arbre)).toHaveLength(0);
  });

  it('n\'en rend AUCUN non plus quand la liste porte des experiences', async () => {
    mockHistories = uneExperience;

    const arbre = await rendre();

    expect(boutonsRondsPlus(arbre)).toHaveLength(0);
  });
});

describe('D54 · l\'anti-regression : ajouter reste possible AVEC des experiences', () => {
  it('propose « Ajouter une experience » meme quand la liste n\'est pas vide', async () => {
    mockHistories = uneExperience;

    const arbre = await rendre();

    expect(pressablePortant(arbre, 'Ajouter une expérience')).toBeDefined();
  });

  it('et ce bouton appelle bien `onAddPress`', async () => {
    mockHistories = uneExperience;
    const onAddPress = jest.fn();

    const arbre = await rendre({ onAddPress });
    await act(async () => {
      pressablePortant(arbre, 'Ajouter une expérience').props.onPress();
    });

    expect(onAddPress).toHaveBeenCalled();
  });

  it('garde la carte pointillee de l\'etat vide, inchangee', async () => {
    mockHistories = [];

    const arbre = await rendre();

    expect(pressablePortant(arbre, 'Ajouter une expérience')).toBeDefined();
  });
});

describe('D54 · le garde-fou : rien de tout ca sur le profil de quelqu\'un d\'autre', () => {
  it('n\'offre AUCUN ajout quand ce n\'est pas mon profil', async () => {
    mockHistories = uneExperience;

    const arbre = await rendre({ isOwnProfile: false, userId: 'autre-1' });

    expect(pressablePortant(arbre, 'Ajouter une expérience')).toBeUndefined();
    expect(boutonsRondsPlus(arbre)).toHaveLength(0);
  });
});
