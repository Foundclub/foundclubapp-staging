import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import EventChildRegistration from '../components/EventChildRegistration';

// 👪 PAR-L11b (13/10) — « INSCRIRE MES ENFANTS » (PAR-012, D4 B d Adel du 12/10), A L ECRAN.
// Le parcours de la planche 9 du design parent : le bouton, la feuille « Qui inscris-tu ? »
// a choix MULTIPLE (les enfants qu on ne peut pas cocher sont montres avec leur raison), le
// recapitulatif, puis le resultat ENFANT PAR ENFANT ; et chez l organisateur, « Anissa,
// 9 ans » et « Parent : Maryline Monroe ».
// ⏳ Dates relatives a aujourd hui (garde-fou `temoins:horloge`).

const mockChildren = { current: [] };
const mockMine = { current: [] };
const mockRows = { current: [] };
const mockRegister = jest.fn();
const mockDecide = jest.fn();
const mockNavigate = jest.fn();

jest.mock('@/services/eventChildResponse/eventChildResponseQueries', () => ({
  useAnswerForChild: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useChildEventResponsesForOrganizer: () => ({ data: [] }),
  useMyChildEventResponses: () => ({
    data: [{
      answer: null, blockedCode: null, canAnswer: true, child: { documentId: 'romain', firstname: 'Romain' }, team: { documentId: 'u11', name: 'U11 Filles' },
    }],
  }),
}));

jest.mock('@/services/declaredChild/declaredChildQueries', () => ({
  useGetMyDeclaredChildren: () => ({ data: mockChildren.current }),
}));
jest.mock('@/services/eventChildRegistration/eventChildRegistrationQueries', () => ({
  // PAR-L11c (14/10) : le bloc sait annuler (temoin : EventChildRegistration.PARL11C.test.js).
  useCancelChildRegistration: () => ({ isPending: false, mutate: jest.fn() }),
  useDecideChildRegistration: () => ({ isPending: false, mutateAsync: mockDecide }),
  useEventChildRegistrations: () => ({ data: mockRows.current }),
  useMyChildRegistrations: () => ({ data: mockMine.current }),
  useRegisterChildren: () => ({ isPending: false, mutateAsync: mockRegister }),
}));
// Les VRAIS textes : `jest.setup.js` demarre i18next en francais sur la vraie `fr.js` ;
// `useTranslation` y est branche ici (interpolation et pluriel compris).
jest.mock('react-i18next', () => {
  const i18next = jest.requireActual('i18next');
  return {
    initReactI18next: { init: jest.fn(), type: '3rdParty' },
    useTranslation: () => ({ t: (key, options) => i18next.t(key, options) }),
  };
});
// Le VRAI theme : un jeton mal nomme casse ce temoin.
jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const generateApplicationStyle = jest.requireActual('@/theme/applicationStyle').default;
  const Alignments = jest.requireActual('@/theme/alignements').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = generateColors();
  return {
    __esModule: true,
    default: () => ({
      Alignments,
      ApplicationStyle: generateApplicationStyle(Colors),
      Colors,
      Fonts: generateFonts(Colors),
      Images: new Proxy({}, { get: () => 1 }),
      scheme: 'dark',
      Spaces,
    }),
  };
});
// La vraie case charge `react-native-bouncy-checkbox` (ESM pur, hors Babel) : meme doublure
// que les temoins d AutocompleteSelect, une case pressable qui montre son texte.
jest.mock('@/components/atoms/checkable/Checkable', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function CheckableDouble(/** @type {any} */ props) {
    return react.createElement(
      rn.TouchableOpacity,
      {
        accessibilityState: { checked: props.isChecked },
        onPress: () => props.setIsChecked(!props.isChecked),
      },
      react.createElement(rn.Text, null, props.text),
    );
  };
});
jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function BottomModalDouble(/** @type {any} */ props) {
    if (!props.isVisible) return null;
    return react.createElement(
      rn.View,
      null,
      props.headerComponent,
      props.children,
      props.footerComponent,
    );
  };
});

const JOUR = 24 * 3600 * 1000;
const evenement = (typeName, extra = {}) => ({
  club: { name: 'FC Test' },
  date: new Date(Date.now() + 7 * JOUR).toISOString(),
  documentId: 'evt-1',
  eventFormat: 'single',
  isActive: true,
  sessionStatus: 'open',
  type: { name: typeName },
  ...extra,
});
const DETECTION = evenement("Détection / Séance d'essai");

/** @type {any} */
let arbre = null;
const render = (element) => {
  act(() => { arbre = renderer.create(element); });
  return { rerender: (suivant) => act(() => arbre.update(suivant)) };
};
const texteDe = (node) => [].concat(node.props.children)
  .filter((part) => typeof part === 'string' || typeof part === 'number')
  .join('');
const textes = () => arbre.root.findAll((node) => node.type === Text).map(texteDe);
const queryByText = (attendu) => {
  const trouve = textes().find((texte) => (
    attendu instanceof RegExp ? attendu.test(texte) : texte === attendu
  ));
  return trouve === undefined ? null : trouve;
};
const getByText = (attendu) => {
  const trouve = queryByText(attendu);
  if (trouve === null) {
    throw new Error(`texte absent : ${attendu}\nA l ecran : ${textes().join(' | ')}`);
  }
  return trouve;
};
// Le premier element pressable qui CONTIENT ce texte (le Text, puis ses parents).
const pressable = (attendu) => {
  getByText(attendu);
  let courant = arbre.root.findAll((node) => node.type === Text)
    .find((node) => texteDe(node) === attendu);
  while (courant && typeof courant.props?.onPress !== 'function') courant = courant.parent;
  if (!courant) throw new Error(`rien a presser pour : ${attendu}`);
  return courant;
};
const press = (attendu) => {
  const cible = pressable(attendu);
  if (cible.props.disabled) return;
  act(() => { cible.props.onPress(); });
};
beforeEach(() => {
  mockChildren.current = [
    { age: 9, documentId: 'anissa', firstname: 'Anissa' },
    { age: 7, documentId: 'martin', firstname: 'Martin' },
    { age: 14, documentId: 'lina', firstname: 'Lina' },
  ];
  mockMine.current = [];
  mockRows.current = [];
  mockRegister.mockReset();
  mockDecide.mockReset();
  mockNavigate.mockReset();
});

test('REC17-003 integration : reponse membre de Romain et demande de Greg separees', () => {
  mockChildren.current = [
    {
      age: 11, documentId: 'romain', firstname: 'Romain', team: { documentId: 'u11' },
    },
    {
      age: 12, documentId: 'greg', firstname: 'Greg', team: { documentId: 'basket' },
    },
  ];
  mockMine.current = [{ child: { documentId: 'greg', firstname: 'Greg' }, documentId: 'reg-greg', status: 'pending' }];
  render(<EventChildRegistration event={{ ...DETECTION, team: { documentId: 'u11' } }} />);
  expect(getByText('Réponse pour Romain')).toBeTruthy();
  expect(getByText('Présent')).toBeTruthy();
  expect(getByText('Absent')).toBeTruthy();
  expect(getByText("Greg — en attente de l'organisateur")).toBeTruthy();
  press('Inscrire mes enfants');
  expect(getByText('Déjà membre de cette équipe : utilise la réponse au nom de cet enfant.')).toBeTruthy();
  expect(getByText("Demande déjà envoyée, en attente de l'organisateur.")).toBeTruthy();
  expect(pressable('Continuer (0)').props.disabled).toBe(true);
  expect(mockRegister).not.toHaveBeenCalled();
});

test('REC17-003 integration : enfant seul membre, pas de demande de reinscription', () => {
  mockChildren.current = [{
    age: 11, documentId: 'romain', firstname: 'Romain', team: { documentId: 'u11' },
  }];
  render(<EventChildRegistration event={{ ...DETECTION, sessionStatus: 'closed', team: { documentId: 'u11' } }} />);
  expect(getByText('Réponse pour Romain')).toBeTruthy();
  expect(queryByText('Inscrire mes enfants')).toBeNull();
  expect(mockRegister).not.toHaveBeenCalled();
});
