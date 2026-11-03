import { readFileSync } from 'fs';
import { resolve } from 'path';

import {
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

import Button from '@/components/atoms/button/Button';

import PiedFlottant from '../PiedFlottant';

// BOUTONS-FLOTTANTS (03/11, demande d'Adel) — plus de bloc de fond derrière les boutons flottants :
// chaque bouton porte son propre fond, opaque, dans sa forme arrondie.

jest.mock('@/theme/themeContext', () => {
  const couleurs = jest.requireActual('@/theme/colors').default();
  const boutons = jest.requireActual('@/theme/components/buttonStyle').default(couleurs);
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      ApplicationStyle: boutons,
      Colors: couleurs,
      Fonts: jest.requireActual('@/theme/fonts').default(couleurs),
      Images: {},
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});

const couleurs = jest.requireActual('@/theme/colors').default();

/**
 * Monte un élément.
 * @param {import('react').ReactElement} element - L'élément.
 * @returns {any} L'arbre.
 */
const rendre = (element) => {
  /** @type {any} */
  let arbre;
  act(() => { arbre = renderer.create(element); });
  return arbre;
};

const styleDuBouton = (/** @type {any} */ arbre) => StyleSheet.flatten(
  arbre.root.findByType(TouchableOpacity).props.style,
);
const styleDuLibelle = (/** @type {any} */ arbre) => StyleSheet.flatten(
  arbre.root.findByType(Text).props.style,
);

describe('BOUTONS-FLOTTANTS — chaque bouton porte son fond', () => {
  test.each(['Secondary', 'SecondaryLight', 'Danger'])('%s à contour : fond opaque', (variant) => {
    const arbre = rendre(
      <PiedFlottant>
        <Button title="Bloquer" variant={/** @type {any} */ (variant)} />
      </PiedFlottant>,
    );
    expect(styleDuBouton(arbre).backgroundColor).toBe(couleurs.primary900);
  });

  test('Primary plein : il garde sa couleur', () => {
    const arbre = rendre(<PiedFlottant><Button title="Contacter" /></PiedFlottant>);
    expect(styleDuBouton(arbre).backgroundColor).toBe(couleurs.primary500);
  });

  test('grisé : opaque, même si l’écran passe sa propre opacité, et libellé lisible', () => {
    const arbre = rendre(
      <PiedFlottant>
        <Button disabled style={{ opacity: 0.7 }} title="Demande en attente" />
      </PiedFlottant>,
    );
    expect(styleDuBouton(arbre)).toEqual(expect.objectContaining({
      backgroundColor: couleurs.primary800, opacity: 1,
    }));
    expect(styleDuLibelle(arbre).color).toBe(couleurs.neutral300);
  });

  test('hors d’un pied, ou pied dans le flux : le bouton ne change pas', () => {
    expect(styleDuBouton(rendre(<Button title="A" variant="Secondary" />)).backgroundColor)
      .toBe('transparent');
    expect(styleDuBouton(rendre(<Button disabled title="A" />)).opacity).toBe(0.5);
    expect(styleDuBouton(rendre(
      <PiedFlottant flottant={false}><Button title="A" variant="Secondary" /></PiedFlottant>,
    )).backgroundColor).toBe('transparent');
  });

  test('le pied laisse passer appuis et défilement entre ses boutons', () => {
    const arbre = rendre(<PiedFlottant testID="pied"><Button title="A" /></PiedFlottant>);
    const pied = arbre.root.findAllByType(View)
      .find((/** @type {any} */ v) => v.props.testID === 'pied');
    expect(pied.props.pointerEvents).toBe('box-none');
  });
});

// Le témoin de la cartographie : ces écrans passent par la pièce commune, sans bloc.
describe('BOUTONS-FLOTTANTS — les pieds de la cartographie', () => {
  test.each([
    'views/profile/UserDetails.js',
    'views/club/ClubDetails.js',
    'views/league/details/SquadDetailsScreen.js',
    'views/license/ClubLicenses.js',
    'views/tactical_v2/TacticalSelection.js',
    'views/onboarding/components/OnboardingStickyFooter.js',
  ])('%s', (fichier) => {
    expect(readFileSync(resolve(__dirname, '../../../..', fichier), 'utf8'))
      .toContain('<PiedFlottant');
  });
});
