import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ChoiceChipGroup from '@/components/molecules/choiceChipGroup/ChoiceChipGroup';

import FriendlyMatchFiltersSheet from '../FriendlyMatchFiltersSheet';

// AMICAUX-CORRECTIFS 72 et 83 (13/10) — LES PASTILLES DES MATCHS AMICAUX COUPEES SUR ANDROID.
//
// Constats des captures (Android 16) : dans les filtres de la liste, « 30 jours » et « 3 mois »
// devenaient « 30 » et « 3 » (72) ; dans « Proposer un match », les pastilles cochees
// « Valbrune U13 » et « Je me deplace » devenaient « Valbrune » et « Je me » (83).
// C est le defaut deja connu des pastilles en GRAS (memoire piege-android16-gras-dernier-mot-
// perdu) : un texte gras de plusieurs mots, dans une boite qui epouse sa largeur mesuree, perd
// son dernier mot. La parade prouvee a l ecran (FINITIONS19) : `texteInsecable`, les espaces
// deviennent insecables et le texte se comporte comme un mot seul.
//
// ⚠️ Un temoin ne voit pas la mise en page : il fige la STRUCTURE qui l evite — aucun espace
// ordinaire dans le texte d une pastille. Le libelle lu par le lecteur d ecran, lui, garde ses
// espaces ordinaires.

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const couleurs = genererCouleurs();
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      ApplicationStyle: genererStyles(couleurs),
      Colors: couleurs,
      Fonts: genererPolices(couleurs),
      Images: {},
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));
jest.mock('@/services/category/categoryQueries', () => ({
  useGetCategories: () => ({ data: [{ documentId: 'cat-u13', name: 'U13 Mixte' }] }),
}));
jest.mock('@/services/level/levelQueries', () => ({ useGetLevels: () => ({ data: [] }) }));
jest.mock('@/components/atoms/SvgIcon/SvgIcon', () => ({ SvgIcon: () => null }));

const ESPACE_INSECABLE = String.fromCharCode(160);

/**
 * Le texte de chaque pastille (le `Text` d un bouton), tel qu il est dessine.
 * @param {any} arbre
 * @returns {string[]}
 */
const textesDesPastilles = (arbre) => arbre.root.findAllByType(TouchableOpacity)
  .flatMap((pastille) => pastille.findAllByType(Text))
  .map((noeud) => noeud.props.children)
  .filter((valeur) => typeof valeur === 'string');

const monter = (/** @type {any} */ element) => {
  /** @type {any} */
  let arbre;
  act(() => { arbre = renderer.create(element); });
  return arbre;
};

describe('AMIC-72 — les filtres de la liste des amicaux', () => {
  const filtres = () => monter(
    <FriendlyMatchFiltersSheet
      filters={undefined}
      onApply={jest.fn()}
      onClose={jest.fn()}
      visible
    />,
  );

  test('72 — « 30 jours » et « 3 mois » sont dessines en un seul mot', () => {
    const textes = textesDesPastilles(filtres());
    expect(textes).toContain(`30${ESPACE_INSECABLE}jours`);
    expect(textes).toContain(`3${ESPACE_INSECABLE}mois`);
  });

  test('72 — AUCUNE pastille de la feuille ne garde un espace ordinaire', () => {
    const avecUnEspace = textesDesPastilles(filtres()).filter((texte) => texte.includes(' '));
    expect(avecUnEspace).toEqual([]);
  });
});

describe('AMIC-83 — les pastilles des feuilles et de l assistant (ChoiceChipGroup)', () => {
  const groupe = () => monter(
    <ChoiceChipGroup
      onSelect={jest.fn()}
      options={[
        { label: 'Valbrune U13', value: 'team-vb' },
        { label: 'Je me déplace', value: 'AWAY' },
      ]}
      selectedValue="AWAY"
      title="Qui reçoit"
    />,
  );

  test('83 — une pastille cochee de plusieurs mots est dessinee en un seul mot', () => {
    const textes = textesDesPastilles(groupe());
    expect(textes).toContain(`Valbrune${ESPACE_INSECABLE}U13`);
    expect(textes).toContain(`Je${ESPACE_INSECABLE}me${ESPACE_INSECABLE}déplace`);
  });

  test('PROTEGE — le lecteur d ecran lit toujours le libelle avec ses espaces ordinaires', () => {
    const libelles = groupe().root.findAllByType(TouchableOpacity)
      .map((/** @type {any} */ pastille) => pastille.props.accessibilityLabel);
    expect(libelles).toContain('Qui reçoit : Je me déplace');
  });
});
