/* eslint-disable max-len */
import '@/theme/strings';

import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import TournamentTeamSheet from '../TournamentTeamSheet';

// T-PARCOURS-1 (17/11/2026, R10, Adel D206) — la feuille « Créer une équipe » du site. Tournée de la recette 41
// (site375-p1-10) : rien ne disait la suite au futur capitaine. Une ligne « Ensuite : invite 4 joueurs, chacun
// paie 20 € », le prix et le nombre lus sur le tournoi ; rien pour un tournoi gratuit.
// E6 : la feuille n'avait aucun témoin ; le premier test décrit ce qui ne change pas.

jest.mock('@/components/atoms/button/Button', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function ButtonMock(/** @type {any} */ props) {
    return react.createElement(rn.Text, { onPress: props.onPress }, `[${props.title}]`);
  };
});
jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function ModalMock(/** @type {any} */ { children, footerComponent, headerComponent }) {
    return react.createElement(rn.View, null, headerComponent, children, footerComponent);
  };
});
jest.mock('@/theme/themeContext', () => {
  const couleurs = jest.requireActual('@/theme/colors').default();
  return {
    __esModule: true,
    default: () => ({
      Colors: couleurs,
      Fonts: jest.requireActual('@/theme/fonts').default(couleurs),
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});

/**
 * Les textes visibles de la feuille.
 * @param {any} props - Les propriétés de la feuille.
 * @returns {string[]} Les textes.
 */
const textesDe = (props) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <TournamentTeamSheet
        entryFeeCents={props.entryFeeCents}
        mode="name"
        onChoose={jest.fn()}
        onClose={jest.fn()}
        onCreate={jest.fn()}
        paidMembersToValidate={props.paidMembersToValidate}
      />,
    );
  });
  const textes = arbre.root.findAllByType(Text)
    .map((/** @type {any} */ n) => [].concat(n.props.children).filter((c) => typeof c === 'string').join(''))
    .filter(Boolean);
  act(() => arbre.unmount());
  return textes;
};

describe('T-PARCOURS-1 — R10, la feuille « Créer une équipe »', () => {
  test('🔒 (E6) le titre, la phrase du capitaine et les deux boutons, inchangés', () => {
    const textes = textesDe({});
    expect(textes).toContain('Créer une équipe');
    expect(textes).toContain('Cette équipe n’existera que pour ce tournoi. Tu en deviendras automatiquement le capitaine.');
    expect(textes).toContain('[Créer mon équipe]');
    expect(textes).toContain('[Annuler]');
  });

  // T-SANS-PLAFOND (18/11, Adel D239) : plus de nombre maximum ; on invite de quoi
  // atteindre le seuil de payés (5 par défaut).
  test('🔴 validé à 5 payés : « Ensuite : invite 4 joueurs, chacun paie 20 €. »', () => {
    expect(textesDe({ entryFeeCents: 2000, paidMembersToValidate: 5 }))
      .toContain('Ensuite : invite 4 joueurs, chacun paie 20 €.');
  });

  test('🔴 un seul coéquipier : le singulier', () => {
    expect(textesDe({ entryFeeCents: 1500, paidMembersToValidate: 2 }))
      .toContain('Ensuite : invite 1 joueur, chacun paie 15 €.');
  });

  test('🔴 D239, seuil absent = 5 par défaut : plus « invite tes joueurs »', () => {
    expect(textesDe({ entryFeeCents: 2000 }))
      .toContain('Ensuite : invite 4 joueurs, chacun paie 20 €.');
  });

  test('🔒 tournoi gratuit : aucune ligne « Ensuite »', () => {
    const textes = textesDe({ entryFeeCents: 0, paidMembersToValidate: 5 });
    expect(textes.some((texte) => texte.startsWith('Ensuite'))).toBe(false);
  });
});
