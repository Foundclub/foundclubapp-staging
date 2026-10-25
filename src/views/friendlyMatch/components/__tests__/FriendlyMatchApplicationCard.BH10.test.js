import renderer, { act } from 'react-test-renderer';

import { Alert } from 'react-native';

import FriendlyMatchApplicationCard from '../FriendlyMatchApplicationCard';

// 📱 CLAVIER-AMICAUX-IOS — « Ce qui est convenu » (carte d'une proposition, côté annonceur) : la
// jumelle de « Proposer un match », une `<Modal transparent>` posée en bas de l'écran ; le champ
// « Où (facultatif) » est son dernier champ, au-dessus de « Enregistrer ce qui est convenu », et
// rien n'y évite le clavier.
//
// - iPhone : une `<Modal>` n'évite RIEN, le clavier se pose par-dessus le champ et le bouton —
//   même famille que la convocation, où Adel a vu le bouton caché (TestFlight 2.6.75). Charges
//   réelles d'iOS (`keyboardWillShow` / `keyboardWillHide`, hauteur barre d'accueil COMPRISE),
//   géométrie du banc CLAVIER-MODALES : iPhone 15 (852 pt, clavier 336, barre 34), iPhone SE
//   (667, 260, 0).
// - Android 15/16 : la fenêtre n'est PAS translucide, Android la remonte lui-même — MESURÉ sur
//   sa JUMELLE « Proposer un match » (même `<Modal>`, même voile ; séance émulateur, Pixel 9,
//   Android 16, 14/10 00:47) : bouton du bas 2127 px
//   clavier fermé, 1370 px clavier ouvert (haut du clavier 1541), 2127 refermé. Un retrait de
//   plus la remonterait deux fois : GARDE, aucun retrait.

jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next
));

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    delete: jest.fn(), get: jest.fn(), post: jest.fn(), put: jest.fn(),
  },
}));

/** @type {{ bottom: number, left: number, right: number, top: number }} */
const mockInsets = {
  bottom: 34, left: 0, right: 0, top: 59,
};
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockInsets,
}));

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
      Images: {},
      Spaces: espaces,
    }),
  };
});

jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      { disabled: props.disabled, onPress: props.onPress, testID: `bouton-${props.title}` },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});

jest.mock('@/components/atoms/SvgIcon/SvgIcon', () => ({ SvgIcon: () => null }));
// La roue d'heure ouvre sa propre fenêtre native : hors sujet ici (aucun clavier).
jest.mock('@/components/molecules/timePickerInput/TimePickerInput', () => () => null);

jest.mock('../FriendlyMatchTermsSheet', () => () => null);

// BH10 P10-25 : « N autres propositions seront refusees » ne compte que celles
// encore EN ATTENTE, pas celles deja refusees ou retirees.
test('P10-25 : aucune autre proposition en attente, aucun avertissement', async () => {
  const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  let tree;
  await act(async () => {
    tree = renderer.create(
      <FriendlyMatchApplicationCard
        ad={{ applicationsCount: 4, documentId: 'annonce-1', pendingApplicationsCount: 1 }}
        application={{ documentId: 'proposition-1', status: 'pending', team: { name: 'US Test' } }}
        onOpenConversation={() => {}}
        onResponded={() => {}}
      />,
    );
  });
  await act(async () => {
    tree.root.findByProps({ testID: 'bouton-Accepter ce match' }).props.onPress();
  });
  expect(alerte).toHaveBeenCalledTimes(1);
  expect(alerte.mock.calls[0][1]).not.toMatch(/autres? propositions?/);
});

// C07 / Q4-07 — le jour choisi (`chosenDate`, minuit UTC) se lit comme un JOUR :
// outre-mer, le relire en heure locale affichait la veille.
test('Q4-07 : le jour choisi par le candidat reste ce jour-la', async () => {
  let tree;
  await act(async () => {
    tree = renderer.create(
      <FriendlyMatchApplicationCard
        ad={{ documentId: 'annonce-1' }}
        application={{
          chosenDate: '2099-05-12T00:00:00.000Z',
          documentId: 'proposition-2',
          status: 'pending',
          team: { name: 'US Test' },
        }}
        onOpenConversation={() => {}}
        onResponded={() => {}}
      />,
    );
  });
  const textes = tree.root.findAll((/** @type {any} */ n) => typeof n.props?.children === 'string')
    .map((/** @type {any} */ n) => n.props.children).join(' ');
  expect(textes).toMatch(/12 mai/);
  expect(textes).not.toMatch(/11 mai/);
});
