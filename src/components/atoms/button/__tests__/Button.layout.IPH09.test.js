import { createElement } from 'react';
import {
  ActivityIndicator, Image, PixelRatio, Platform, StyleSheet, Text, TouchableOpacity,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

import RequestFeedItem from '@/components/molecules/requestFeedItem/RequestFeedItem';

import Button from '../Button';

// Le vrai Button et le vrai thème : Jest vérifie le contrat envoyé au natif,
// pas les pixels de TextKit. La capture iPhone reste une recette séparée.
jest.mock('@/theme/themeContext', () => {
  const colors = jest.requireActual('@/theme/colors').default();
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(colors),
      Colors: colors,
      Fonts: jest.requireActual('@/theme/fonts').default(colors),
      Images: { check: 1, close: 2 },
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});

// La photo n'intervient pas dans la mise en page du bouton ; Button reste réel.
jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => 'ProfileAvatar');
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key, fallback) => fallback || key }),
}));

const originalPlatform = Platform.OS;
afterEach(() => {
  Platform.OS = originalPlatform;
  jest.restoreAllMocks();
});

const mount = (/** @type {any} */ props) => {
  /** @type {any} */
  let tree;
  act(() => {
    tree = renderer.create(createElement(Button, { onPress: jest.fn(), ...props }));
  });
  const touchable = tree.root.findByType(TouchableOpacity);
  return { root: tree.root, touchable, tree };
};

describe('IPH09 — une boîte stable pour les libellés avec icône', () => {
  test.each([
    ['Refuser', 'close', 'Secondary', 148],
    ['Accepter', 'check', 'Primary', 148],
    ['Voir la proposition et toutes les réponses', 'check', 'Secondary', 112],
  ])(
    '%s : la largeur contrainte réserve une place au texte et à l icône',
    (title, icon, variant, width) => {
      const { root, touchable, tree } = mount({
        icon, isOption: true, style: { width }, title, variant,
      });
      const label = root.findByType(Text);
      const row = StyleSheet.flatten(label.parent.props.style);
      const labelStyle = StyleSheet.flatten(label.props.style);
      const iconStyle = StyleSheet.flatten(root.findByType(Image).props.style);

      // Le texte ne dépend plus de sa seule mesure intrinsèque arrondie ;
      // il peut aussi céder de la largeur, sans pousser l'icône hors du bouton.
      expect(labelStyle).toMatchObject({ flexGrow: 1, flexShrink: 1, textAlign: 'center' });
      expect(labelStyle.flex).toBeUndefined();
      expect(labelStyle.flexBasis).toBeUndefined();
      // L'interligne fixe ne doit pas survivre au rétrécissement natif de la
      // police sur iOS : TextKit doit pouvoir adapter les deux dimensions.
      expect(labelStyle.lineHeight).toBeUndefined();
      expect(row).toMatchObject({ alignItems: 'center', justifyContent: 'center' });
      expect(iconStyle).toMatchObject({ height: 20, width: 20 });
      expect(StyleSheet.flatten(touchable.props.style)).toMatchObject({ height: 44, width });
      expect(label.props).toMatchObject({
        adjustsFontSizeToFit: true, minimumFontScale: 0.7, numberOfLines: 1,
      });
      act(() => tree.unmount());
    },
  );

  test.each(['sm', 'small'])('%s conserve la taille compacte et le texte à 14pt', (size) => {
    const { root, touchable, tree } = mount({ icon: 'check', size, title: 'Valider' });
    expect(StyleSheet.flatten(touchable.props.style))
      .toMatchObject({ height: 39, paddingHorizontal: 12 });
    expect(StyleSheet.flatten(root.findByType(Text).props.style).fontSize).toBe(14);
    act(() => tree.unmount());
  });

  test('iOS : la hauteur de ligne avec icône suit les métriques de la police', () => {
    const { root, tree } = mount({ icon: 'check', isOption: true, title: 'Accepter' });
    expect(StyleSheet.flatten(root.findByType(Text).props.style).lineHeight).toBeUndefined();
    act(() => tree.unmount());
  });

  test('sans icône : le remplissage FINITIONS et le style de l appelant restent acquis', () => {
    const { root, tree } = mount({ textStyle: { textAlign: 'left' }, title: 'Voir le profil' });
    expect(StyleSheet.flatten(root.findByType(Text).props.style))
      .toMatchObject({ flexGrow: 1, textAlign: 'left' });
    expect(root.findAllByType(Image)).toHaveLength(0);
    act(() => tree.unmount());
  });

  test.each([1, 1.3, 2])('échelle %s : le contrat conserve la police native autorisée', (scale) => {
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(scale);
    const { root, tree } = mount({ icon: 'check', isOption: true, title: 'Accepter' });
    const label = root.findByType(Text);
    expect(label.props.allowFontScaling).not.toBe(false);
    expect(label.props.maxFontSizeMultiplier).toBeUndefined();
    expect(StyleSheet.flatten(label.props.style).fontSize).toBe(16);
    act(() => tree.unmount());
  });

  test.each(['android', 'web'])('%s : groupe avec icône et interligne conservés', (platform) => {
    Platform.OS = /** @type {any} */ (platform);
    const { root, tree } = mount({ icon: 'check', title: 'Accepter' });
    const label = StyleSheet.flatten(root.findByType(Text).props.style);
    expect(label).toMatchObject({ flexShrink: 1, fontSize: 16, lineHeight: 23 });
    expect(label.flexGrow).toBeUndefined();
    expect(StyleSheet.flatten(root.findByType(Text).parent.props.style).justifyContent)
      .toBe('center');
    act(() => tree.unmount());
  });

  test('icône avant et style explicite de texte restent prioritaires', () => {
    const { root, tree } = mount({
      icon: 'check',
      iconPosition: 'before',
      textStyle: { lineHeight: 26, textAlign: 'left' },
      title: 'Valider',
    });
    const label = root.findByType(Text);
    expect(StyleSheet.flatten(label.parent.props.style).flexDirection).toBe('row-reverse');
    expect(StyleSheet.flatten(label.props.style))
      .toMatchObject({ lineHeight: 26, textAlign: 'left' });
    act(() => tree.unmount());
  });

  test('la vraie carte d adhésion rend ses trois boutons et transmet leurs actions', () => {
    /** @type {any} */
    const item = {
      actions: { primary: 'accept', secondary: 'reject' },
      id: 'fabricated-membership',
      meta: { requesterId: 'fabricated-user', requesterName: 'Test' },
      subtitle: 'Test souhaite rejoindre Senior.',
      title: 'Demande d adhésion équipe',
      type: 'team',
    };
    const primary = jest.fn();
    const secondary = jest.fn();
    const profile = jest.fn();
    /** @type {any} */
    let tree;
    act(() => {
      tree = renderer.create(createElement(RequestFeedItem, {
        item, onPrimaryPress: primary, onRequesterPress: profile, onSecondaryPress: secondary,
      }));
    });
    const buttons = tree.root.findAllByType(Button);
    expect(buttons.map((button) => button.props.title))
      .toEqual(['Voir le profil', 'Refuser', 'Accepter']);
    buttons.forEach((button) => {
      const label = button.findByType(Text);
      expect(StyleSheet.flatten(label.props.style).flexGrow).toBe(1);
      act(() => button.findByType(TouchableOpacity).props.onPress());
    });
    [profile, secondary, primary]
      .forEach((callback) => expect(callback).toHaveBeenCalledWith(item));
    act(() => {
      tree.update(createElement(RequestFeedItem, { isBusy: true, item }));
    });
    tree.root.findAllByType(Button).forEach((button) => {
      expect(button.findByType(TouchableOpacity).props.disabled).toBe(true);
    });
    act(() => tree.unmount());
  });

  test.each([false, true])('chargement : keepTitle=%s protège le bouton', (keepTitle) => {
    const { root, touchable, tree } = mount({
      icon: 'check', isLoading: true, keepTitleWhileLoading: keepTitle, title: 'Enregistrement…',
    });
    expect(touchable.props.disabled).toBe(true);
    expect(root.findAllByType(ActivityIndicator)).toHaveLength(1);
    expect(root.findAllByType(Text)).toHaveLength(keepTitle ? 1 : 0);
    expect(root.findAllByType(Image)).toHaveLength(keepTitle ? 1 : 0);
    act(() => tree.unmount());
  });

  test('icône seule : la cible tactile de 44pt reste identique', () => {
    const { root, touchable, tree } = mount({ icon: 'close', isOption: true });
    expect(root.findAllByType(Text)).toHaveLength(0);
    expect(StyleSheet.flatten(touchable.props.style)).toMatchObject({ height: 44, width: 44 });
    act(() => tree.unmount());
  });
});
