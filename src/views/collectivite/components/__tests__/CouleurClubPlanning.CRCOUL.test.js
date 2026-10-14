import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { TouchableOpacity } from 'react-native';

import CouleurClubPlanning from '../CouleurClubPlanning';
import { FACILITY_PLANNING_PALETTE } from '@/utils/facilityPlanningColor';

let mockClubs;
let mockMutation;
jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useCollectiviteClubs: () => mockClubs,
  useSetClubPlanningColor: () => mockMutation,
}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({
  t: (key, fallback, values = {}) => {
    const replacements = typeof fallback === 'object' ? fallback : values;
    const fr = jest.requireActual('@/theme/strings/translations/fr').default;
    const template = key.split('.').reduce((x, part) => x?.[part], fr) || fallback;
    return template.replace(/{{(\w+)}}/g, (_, part) => replacements[part] ?? '');
  },
}) }));
jest.mock('@/theme/themeContext', () => ({ __esModule: true, default: () => ({
  Colors: jest.requireActual('@/theme/colors').default(),
  Fonts: jest.requireActual('@/theme/fonts').default(jest.requireActual('@/theme/colors').default()),
}) }));
jest.mock('@/components/molecules/bottomModal/BottomModal', () => function Modal({ children, isVisible }) {
  return isVisible ? children : null;
});
jest.mock('@/components/atoms/button/Button', () => {
  const { TouchableOpacity, Text } = jest.requireActual('react-native');
  return function Button(props) {
    return <TouchableOpacity {...props}><Text>{props.title}</Text></TouchableOpacity>;
  };
});

const club = { documentId: 'a', name: 'AS A', planningColor: null };
const purple = FACILITY_PLANNING_PALETTE[5];
const other = { documentId: 'b', name: 'US B', planningColor: purple };
let tree;
const press = async (id) => act(async () => {
  const target = tree.root.findAllByProps({ testID: id })[0];
  const button = target.props.onPress ? target : target.findAll((x) => x.props.onPress)[0];
  await button.props.onPress();
});
beforeEach(() => {
  mockClubs = { data: [club, other], isLoading: false, isError: false, refetch: jest.fn() };
  mockMutation = { isPending: false, mutateAsync: jest.fn().mockResolvedValue({ data: { planningColor: null } }) };
});
afterEach(() => { act(() => tree?.unmount()); });
const mount = async (value = club) => act(async () => {
  tree = renderer.create(<CouleurClubPlanning club={value} collectiviteId="ville" />);
});

it('11 choix nommes, radio et hauteur >= 44 ; automatique sauve en un appui', async () => {
  await mount();
  await press('club-couleur-changer');
  const radios = tree.root.findAllByType(TouchableOpacity).filter((x) => x.props.accessibilityRole === 'radio');
  expect(radios).toHaveLength(11);
  expect(radios[0].props.accessibilityState.checked).toBe(true);
  radios.forEach((x) => {
    expect(x.props.accessibilityLabel).toBeTruthy();
    expect(x.props.style.minHeight).toBeGreaterThanOrEqual(44);
  });
  await press('club-couleur-auto');
  expect(mockMutation.mutateAsync).toHaveBeenCalledWith({ collectiviteId: 'ville', clubId: 'a', planningColor: null });
});
it('une couleur prise nomme le club, attend la confirmation, puis sauvegarde', async () => {
  await mount();
  await press('club-couleur-changer');
  await press('club-couleur-9D4DFF');
  expect(mockMutation.mutateAsync).not.toHaveBeenCalled();
  expect(JSON.stringify(tree.toJSON())).toContain('US B');
  await press('club-couleur-confirmer');
  expect(mockMutation.mutateAsync).toHaveBeenCalledWith({ collectiviteId: 'ville', clubId: 'a', planningColor: purple });
});
it('refus serveur visible, feuille conservee et nouvel essai possible', async () => {
  mockMutation.mutateAsync.mockRejectedValue(new Error('Refus de recette'));
  await mount();
  await press('club-couleur-changer');
  await press('club-couleur-auto');
  expect(tree.root.findAllByProps({ testID: 'club-couleur-erreur' }).length).toBeGreaterThan(0);
  expect(tree.root.findAllByType(TouchableOpacity).filter((x) => x.props.accessibilityRole === 'radio')).toHaveLength(11);
});
it('ancien serveur : affiche automatique et n offre pas une route absente', async () => {
  await mount({ documentId: 'a', name: 'AS A' });
  expect(JSON.stringify(tree.toJSON())).toContain('automatique');
  expect(tree.root.findAllByProps({ testID: 'club-couleur-changer' })).toHaveLength(0);
});
