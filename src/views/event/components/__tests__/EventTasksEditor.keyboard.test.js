import { Platform, TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import BottomModalTextInput from '@/components/atoms/bottomModalTextInput/BottomModalTextInput';
import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import InputStepper from '@/components/molecules/inputStepper/InputStepper';
import SegmentedControl from '@/components/molecules/segmentedControl/SegmentedControl';

import EventTasksEditor from '../EventTasksEditor';

// E6 : cette feuille n'avait pas de temoin propre. Saisie, compteur, validation,
// annulation et brouillon sont caracterises avant de changer les champs.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key, fallback) => fallback || key }),
}));
jest.mock('i18next', () => ({ t: (key, fallback) => fallback || key }));
jest.mock('@/theme/themeContext', () => {
  const Colors = jest.requireActual('@/theme/colors').default();
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(Colors),
      Colors,
      Fonts: jest.requireActual('@/theme/fonts').default(Colors),
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});
jest.mock('@/components/molecules/bottomModal/BottomModal', () => ({
  __esModule: true,
  default: ({ children }) => children,
}));
jest.mock('@/components/atoms/button/Button', () => ({
  __esModule: true, default: () => null,
}));
jest.mock('@/components/molecules/inputStepper/InputStepper', () => ({
  __esModule: true, default: () => null,
}));
jest.mock('@/components/molecules/segmentedControl/SegmentedControl', () => ({
  __esModule: true, default: () => null,
}));
jest.mock('@/components/atoms/bottomModalTextInput/BottomModalTextInput', () => {
  const React = jest.requireActual('react');
  const { TextInput: NativeInput } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: React.forwardRef((props, ref) => React.createElement(NativeInput, { ...props, ref })),
  };
});

const ouvrir = (value = []) => {
  const onChange = jest.fn();
  let arbre;
  act(() => { arbre = renderer.create(<EventTasksEditor onChange={onChange} value={value} />); });
  act(() => arbre.root.findByType(Button).props.onPress());
  return { arbre, onChange };
};
const autre = (arbre) => act(() => arbre.root.findAllByType(SegmentedControl)[0]
  .props.onChange('other'));
const saisir = (arbre, placeholder, value) => act(() => arbre.root.findAllByType(TextInput)
  .find((input) => input.props.placeholder === placeholder).props.onChangeText(value));
const bouton = (arbre, title) => arbre.root.findAllByType(Button)
  .filter((entry) => entry.props.title === title).pop();

describe('Nouvelle tache — contrat de saisie', () => {
  it('conserve le titre manuel, le compteur, la description et les taches precedentes', () => {
    const precedente = { title: 'Transport', type: 'transport' };
    const { arbre, onChange } = ouvrir([precedente]);
    autre(arbre);
    saisir(arbre, 'Nom du type', 'Accueil');
    expect(arbre.root.findAllByType(TextInput)[1].props.value).toBe('Accueil');
    saisir(arbre, 'Titre', 'Accueil des parents');
    saisir(arbre, 'Nom du type', 'Buvette');
    saisir(arbre, 'Description', '  A partir de 18 h  ');
    act(() => arbre.root.findByType(InputStepper).props.onIncrement());
    act(() => arbre.root.findAllByType(SegmentedControl)[1].props.onChange('MANUAL'));
    act(() => bouton(arbre, 'Ajouter').props.onPress());
    expect(onChange).toHaveBeenCalledWith([precedente, expect.objectContaining({
      customLabel: 'Buvette',
      description: 'A partir de 18 h',
      isActive: true,
      requiredCount: 2,
      title: 'Accueil des parents',
      type: 'other',
      validationMode: 'MANUAL',
    })]);
    expect(arbre.root.findAllByType(BottomModal)).toHaveLength(0);
  });

  it('annuler ne cree rien et la prochaine ouverture repart du brouillon initial', () => {
    const { arbre, onChange } = ouvrir();
    autre(arbre);
    saisir(arbre, 'Nom du type', 'Brouillon');
    act(() => bouton(arbre, 'Annuler').props.onPress());
    expect(onChange).not.toHaveBeenCalled();
    act(() => bouton(arbre, 'Ajouter').props.onPress());
    expect(arbre.root.findAllByType(TextInput)).toHaveLength(2);
    expect(arbre.root.findAllByType(TextInput)[0].props.value).toBe('Accompagnateur');
    expect(arbre.root.findAllByType(TextInput)[1].props.value).toBe('');
  });

  it('les trois champs demandent le champ compatible avec une feuille', () => {
    const { arbre } = ouvrir();
    autre(arbre);
    expect(arbre.root.findAllByType(BottomModalTextInput)).toHaveLength(3);
    expect(arbre.root.findByType(BottomModal).props.androidKeyboardBehavior).toBe('extend');
  });

  it.each(['android', 'ios', 'web'])('%s : seul Android change de zone defilante', (os) => {
    const previousOS = Platform.OS;
    Platform.OS = os;
    try {
      const { arbre } = ouvrir();
      expect(arbre.root.findByType(BottomModal).props.scrollable ?? true).toBe(os === 'android');
    } finally {
      Platform.OS = previousOS;
    }
  });
});
