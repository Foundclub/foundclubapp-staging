/* eslint-disable import/first, max-len -- doubles repris tels quels de STMATCHEditeurRelance. */
// BH05 — memes doubles que STMATCHEditeurRelance.test.js : l'editeur charge l'app entiere.
const mockRemind = jest.fn();
const mockSaveDraft = jest.fn();
const mockSubmit = jest.fn();
const mockSaveResult = jest.fn();
const mockSubmitLeague = jest.fn();
const mockStatsQuery = {
  data: /** @type {any} */ (null), error: /** @type {any} */ (null), isFetching: false, isLoading: false, refetch: jest.fn(),
};
const mockDesktop = false;

jest.mock('react-i18next', () => {
  const remplir = (/** @type {string} */ modele, /** @type {any} */ valeurs) => modele.replace(
    /\{\{(\w+)\}\}/g,
    (/** @type {string} */ tout, /** @type {string} */ nom) => (
      valeurs && nom in valeurs ? String(valeurs[nom]) : tout
    ),
  );
  return {
    initReactI18next: { init: jest.fn(), type: '3rdParty' },
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ options) => {
        if (typeof repli === 'string') return remplir(repli, options);
        if (repli && repli.defaultValue_one) {
          return remplir(Number(repli.count) <= 1 ? repli.defaultValue_one : repli.defaultValue_other, repli);
        }
        return cle;
      },
    }),
  };
});
jest.mock('i18next', () => ({
  __esModule: true,
  default: { language: 'fr', t: (/** @type {string} */ _cle, /** @type {any} */ repli) => (typeof repli === 'string' ? repli : _cle) },
}));
jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const Alignments = jest.requireActual('@/theme/alignements').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = generateColors();
  return {
    __esModule: true,
    default: () => ({
      Alignments,
      ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(Colors),
      Colors,
      Fonts: generateFonts(Colors),
      Images: new Proxy({}, { get: () => 1 }),
      scheme: 'dark',
      Spaces,
    }),
  };
});
jest.mock('@/services/matchStats/matchStatsQueries', () => ({
  useGetEventMatchStats: () => mockStatsQuery,
  // L'écran ne lit que la requête de SA source (événement ou ligue) : la même doublure sert.
  useGetLeagueMatchStats: () => mockStatsQuery,
}));
jest.mock('@/services/matchStats/matchStatsService', () => ({
  remindEventMatchResponses: (/** @type {any[]} */ ...args) => mockRemind(...args),
  saveEventMatchResult: (/** @type {any[]} */ ...args) => mockSaveResult(...args),
  saveEventMatchStatsDraft: (/** @type {any[]} */ ...args) => mockSaveDraft(...args),
  saveLeagueMatchStatsDraft: jest.fn(),
  submitEventMatchStats: (/** @type {any[]} */ ...args) => mockSubmit(...args),
  submitLeagueMatchStats: (/** @type {any[]} */ ...args) => mockSubmitLeague(...args),
}));
jest.mock('@/domains/refresh/afterAction', () => ({ invalidateAfterAction: jest.fn() }));
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: { documentId: 'coach-1', firstname: 'Karim' } }),
}));
jest.mock('@/responsive', () => ({
  ...jest.requireActual('@/responsive'),
  useIsDesktop: () => mockDesktop,
}));
jest.mock('@/navigation/useBottomDockLayout', () => ({ __esModule: true, default: () => ({ sceneBottomInset: 0 }) }));
jest.mock('@/components/templates/ScreenContainer', () => {
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: (/** @type {any} */ { children }) => jest.requireActual('react').createElement(View, null, children) };
});
jest.mock('@/components/atoms/headerBackButton/HeaderBackButton', () => {
  const { Text: Texte } = jest.requireActual('react-native');
  return { __esModule: true, default: () => jest.requireActual('react').createElement(Texte, null, 'RETOUR') };
});
jest.mock('@/components/molecules/memberAvatar/MemberAvatar', () => {
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: () => jest.requireActual('react').createElement(View) };
});
jest.mock('@/components/atoms/button/Button', () => {
  const rn = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ props) => jest.requireActual('react').createElement(
      rn.TouchableOpacity,
      { accessibilityRole: 'button', disabled: Boolean(props.disabled), onPress: props.onPress },
      jest.requireActual('react').createElement(rn.Text, null, props.title || ''),
    ),
  };
});
// Le sélecteur segmenté tire `gesture-handler` : sa doublure garde ses libellés et son
// `onChange` (motif de `PlayerMatchResponseScreen.STREPONSE.test.js`).
jest.mock('@/components/molecules/segmentedControl/SegmentedControl', () => {
  const { Pressable: Appui, Text: Texte, View: Vue } = jest.requireActual('react-native');
  const { createElement: creer } = jest.requireActual('react');
  return {
    __esModule: true,
    default: (/** @type {any} */ { onChange, options }) => creer(
      Vue,
      { testID: 'feuille-onglets' },
      options.map((/** @type {any} */ option) => creer(
        Appui,
        { key: option.value, onPress: () => onChange(option.value) },
        creer(Texte, null, option.label),
      )),
    ),
  };
});
// La feuille du bas tire `@gorhom/bottom-sheet` : sa doublure rend l'en-tête, le corps et
// le pied quand elle est ouverte, rien sinon.
jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  const { View: Vue } = jest.requireActual('react-native');
  const { createElement: creer } = jest.requireActual('react');
  return {
    __esModule: true,
    default: (/** @type {any} */ props) => (props.isVisible
      ? creer(Vue, null, props.headerComponent || null, props.children, props.footerComponent || null)
      : null),
  };
});
// Le squelette passe par `masked-view`, que jest ne transforme pas.
jest.mock('@/components/atoms/skeletonLoader/SkeletonLoader', () => {
  const { View: Vue } = jest.requireActual('react-native');
  return { __esModule: true, default: (/** @type {any} */ { children }) => jest.requireActual('react').createElement(Vue, { testID: 'squelette' }, children) };
});
jest.mock('@/components/atoms/glyphIcon/GlyphIcon', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/atoms/SvgIcon/SvgIcon', () => ({ __esModule: true, default: () => null, SvgIcon: () => null }));

import { serializeCoachReview } from '../MatchStatsEditor';
// BH05 · P10-19 — l'avis du coach sur un joueur ajoute a la main doit porter
// son nom : sans `manualPlayerName` ni `userDocumentId`, le serveur le jette.
describe('BH05 — P10-19 avis du coach sur un joueur manuel', () => {
  test('le nom du joueur manuel part avec l avis', () => {
    const avis = serializeCoachReview({
      comment: 'Bon match', key: 'Yanis Ben', label: 'Yanis Ben', rating: 4, userDocumentId: null,
    });
    expect(avis?.manualPlayerName).toBe('Yanis Ben');
  });

  test('un joueur avec compte garde son identifiant, sans nom manuel', () => {
    const avis = serializeCoachReview({
      comment: '', key: 'u1', label: 'Jean', rating: 3, userDocumentId: 'u1',
    });
    expect(avis?.userDocumentId).toBe('u1');
    expect(avis?.manualPlayerName).toBeUndefined();
  });
});
