import '@/theme/strings';
import { TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import AdWizardCoachProfile from '../AdWizardCoachProfile';

// BH15 · P13-02 — taper « BMF, BPJEPS » lettre par lettre garde les virgules et les espaces.
jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next
));

const mockBrouillon = { state: /** @type {any} */ ({ certificationsWanted: [], coachQuantity: 1 }) };
jest.mock('../AdWizardContext', () => ({
  useAdWizard: () => ({
    dispatch: (/** @type {any} */ action) => {
      if (action.type === 'SET_CERTIFICATIONS_WANTED') {
        mockBrouillon.state = { ...mockBrouillon.state, certificationsWanted: action.payload };
      }
    },
    get state() { return mockBrouillon.state; },
  }),
}));

jest.mock('@/components/molecules/wizardStepLayout/WizardStepLayout', () => {
  // eslint-disable-next-line global-require
  const { View } = require('react-native');
  return { __esModule: true, default: (/** @type {any} */ p) => <View>{p.children}</View> };
});
jest.mock('@/components/molecules/autocompleteSelect/AutocompleteSelect', () => () => null);
jest.mock('@/components/molecules/inputStepper/InputStepper', () => () => null);
jest.mock('@/theme/themeContext', () => {
  const Alignments = jest.requireActual('@/theme/alignements').default;
  const genererStyle = jest.requireActual('@/theme/applicationStyle').default;
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = genererCouleurs();

  return {
    __esModule: true,
    default: () => ({
      Alignments,
      ApplicationStyle: genererStyle(Colors),
      Colors,
      Fonts: genererPolices(Colors),
      Spaces,
    }),
  };
});

it('garde le texte tapé et envoie la liste découpée', () => {
  /** @type {any} */
  let arbre;
  act(() => { arbre = renderer.create(<AdWizardCoachProfile navigation={{ navigate: jest.fn() }} />); });
  const texte = 'BMF, BPJEPS';
  for (let i = 1; i <= texte.length; i += 1) {
    const champ = arbre.root.findAllByType(TextInput).find((n) => /BMF/.test(String(n.props.placeholder)));
    act(() => { champ.props.onChangeText(`${champ.props.value}${texte[i - 1]}`); });
    act(() => { arbre.update(<AdWizardCoachProfile navigation={{ navigate: jest.fn() }} />); });
  }

  expect(arbre.root.findAllByType(TextInput).find((n) => /BMF/.test(String(n.props.placeholder))).props.value).toBe('BMF, BPJEPS');
  expect(mockBrouillon.state.certificationsWanted).toEqual(['BMF', 'BPJEPS']);
});
