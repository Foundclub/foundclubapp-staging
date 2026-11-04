import { AccessibilityInfo, StyleSheet, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import MarqueeText, { getActiveMarqueeCount } from '../MarqueeText';

// T3-CARTE-VILLE (04/11/2026, décision d'Adel « 26- A ») — le nom d'un événement de la Ville
// défile sur sa carte étroite ; si le téléphone demande moins d'animations, il reste immobile,
// coupé par « … ».

jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));

const NOM = 'Forum des associations de Montrivage';

const monter = async (reduire) => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(reduire);
  let arbre;
  await act(async () => {
    arbre = renderer.create(<MarqueeText text={NOM} />);
  });
  const mesurable = (type) => arbre.root.find(
    (n) => n.type === type && typeof n.props?.onLayout === 'function',
  );
  const enveloppe = mesurable('View');
  const sonde = mesurable('Text');
  await act(async () => {
    enveloppe.props.onLayout({ nativeEvent: { layout: { width: 46 } } });
    sonde.props.onLayout({ nativeEvent: { layout: { width: 210 } } });
  });
  return arbre;
};
const ligneTronquee = (arbre) => arbre.root.findAllByType(Text)
  .find((n) => n.props.ellipsizeMode === 'tail');

afterEach(() => jest.restoreAllMocks());

test('un nom plus large que sa carte défile', async () => {
  const arbre = await monter(false);

  expect(getActiveMarqueeCount()).toBe(1);
  expect(StyleSheet.flatten(ligneTronquee(arbre).props.style).opacity).toBe(0);
  act(() => arbre.unmount());
});

test('« réduire les animations » : aucune boucle, le nom coupé par « … » reste visible', async () => {
  const arbre = await monter(true);

  expect(getActiveMarqueeCount()).toBe(0);
  expect(StyleSheet.flatten(ligneTronquee(arbre).props.style)?.opacity).not.toBe(0);
  expect(ligneTronquee(arbre).props.numberOfLines).toBe(1);
  act(() => arbre.unmount());
});
