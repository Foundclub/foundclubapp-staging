import { Dimensions, StyleSheet, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import FacilityForm from '../FacilityForm';

// 📐 VILLE-INSTALLATION (07/10/2026) — LA FEUILLE « TYPE D INSTALLATION » DE LA VILLE.
//
// Essai d Adel (2.6.70, iPhone) : le titre de la feuille passe SOUS la fleche de retour de
// l ecran, et le bas est coupe — la derniere ligne a moitie visible, sans defilement jusqu au
// bout.
//
// La mecanique (BottomModal, `piege-bottommodal-geometrie-feuille`) : SANS `snapPoints`, la
// feuille se taille sur son CONTENU (11 lignes de 52 pt + titre + marges ≈ 790 pt). C est plus
// que l ecran ne lui laisse, donc elle monte jusqu a son plafond, `topInset` = encoche + 20 pt —
// en plein dans la bande de 44 pt ou l ecran dessine sa fleche de retour (en-tete transparent).
// Et dans cette mise en page, la zone defilante est bornee a 70 % de l ECRAN dans un conteneur
// sans flex : ce n est pas elle qui epouse la feuille.
//
// Le remede est celui que le depot applique deja a une quarantaine de feuilles (D19,
// EventWizardLogistics) : declarer une hauteur. La feuille cesse alors de monter avec sa
// liste, et sa zone defilante prend toute la place, jusqu a la derniere ligne.
//
// ⚠️ Jest n a pas de moteur de mise en page : ce temoin lit les CONTRAINTES que l ecran pose
// sur la bibliotheque (comme BottomModal.debordement.test.js). Le pixel se voit sur iPhone.

const INSET_HAUT = 47;
const INSET_BAS = 34;
// La bande de l en-tete de la pile (react-navigation/stack, iPhone en portrait) : 44 pt sous
// l encoche. La fleche de retour y est centree.
const BANDE_EN_TETE = 44;

const i18nextTemoin = require('i18next');

const frTemoin = require('@/theme/strings/translations/fr');

(i18nextTemoin.default || i18nextTemoin).init({
  compatibilityJSON: 'v4',
  fallbackLng: 'fr',
  lng: 'fr',
  resources: { fr: { translation: frTemoin.default } },
});

/** @type {any} */
let mockRoute;

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), navigate: jest.fn() }),
  useRoute: () => mockRoute,
}));

jest.mock('react-i18next', () => ({
  initReactI18next: { init: () => {}, type: '3rdParty' },
  useTranslation: () => ({
    t: (/** @type {any[]} */ ...args) => jest.requireActual('i18next').t(...args),
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 34, left: 0, right: 0, top: 47,
  }),
}));

jest.mock('@sbaiahmed1/react-native-blur', () => ({ BlurView: () => null }));

jest.mock('@/context/StartupPhaseContext', () => ({
  STARTUP_PHASES: { SCREEN_LOCAL_PROMPTS: 'SCREEN_LOCAL_PROMPTS', STEADY_STATE: 'STEADY_STATE' },
  useStartupPhase: () => ({ phase: 'STEADY_STATE' }),
}));

// La feuille native est doublee par des vues qui CONSERVENT leurs proprietes : c est ce qu on lit.
jest.mock('@gorhom/bottom-sheet', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    BottomSheetBackdrop: () => null,
    BottomSheetModal: reactActuel.forwardRef(
      (/** @type {any} */ props, /** @type {any} */ ref) => {
        reactActuel.useImperativeHandle(ref, () => ({ dismiss: () => {}, present: () => {} }));
        return reactActuel.createElement(VueRN, { ...props, testID: 'feuille' }, props.children);
      },
    ),
    BottomSheetScrollView: (/** @type {any} */ props) => reactActuel.createElement(
      VueRN,
      { ...props, testID: 'zone-defilante' },
      props.children,
    ),
    BottomSheetView: (/** @type {any} */ props) => reactActuel.createElement(
      VueRN,
      { ...props, testID: 'zone-fixe' },
      props.children,
    ),
  };
});

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: {} }),
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
      Images: new Proxy({}, { get: () => 1 }),
      Spaces: espaces,
    }),
  };
});

jest.mock('@/services/facility/facilityQueries', () => ({
  useGetFacility: () => ({
    data: null, error: null, isLoading: false, refetch: jest.fn(),
  }),
}));
jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useCollectiviteInstallations: () => ({
    data: [], error: null, isLoading: false, refetch: jest.fn(),
  }),
  useSaveCollectiviteInstallation: () => ({ mutateAsync: jest.fn() }),
}));
jest.mock('@/services/facility/facilityService', () => ({
  createFacility: jest.fn(),
  updateFacility: jest.fn(),
}));
jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);
jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() { return null; });
jest.mock('@/components/atoms/button/Button', () => function ButtonMock() { return null; });
jest.mock('@/components/molecules/input/Input', () => function InputMock() { return null; });
jest.mock(
  '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput',
  () => function AdresseMock() { return null; },
);
jest.mock(
  '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet',
  () => function SubscriptionPaywallSheetMock() { return null; },
);
jest.mock('@/components/molecules/segmentedControl/SegmentedControl', () => function SegMock() {
  return null;
});

const aplatir = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
  return String(enfants);
};

/** @type {any[]} */
const arbres = [];
const ouvrirLaFeuilleType = async () => {
  mockRoute = { params: { collectiviteId: 'ville-marseille' } };
  /** @type {any} */
  let arbre;
  await act(async () => { arbre = renderer.create(<FacilityForm />); });
  arbres.push(arbre);
  const champType = arbre.root.findAll((/** @type {any} */ noeud) => typeof noeud.props?.onPress
    === 'function' && String(noeud.props?.accessibilityLabel || '').startsWith('Type'))[0];
  await act(async () => { champType.props.onPress(); });
  // La feuille dont le TITRE est « Type d installation ».
  const feuille = arbre.root
    .findAll((/** @type {any} */ noeud) => noeud.props?.testID === 'feuille')
    .find((/** @type {any} */ noeud) => noeud.findAllByType(Text)
      .some((/** @type {any} */ t) => aplatir(t.props.children).trim() === 'Type d’installation'));
  const zoneDefilante = feuille.findAll(
    (/** @type {any} */ noeud) => noeud.props?.testID === 'zone-defilante',
  )[0];
  return { feuille, zoneDefilante };
};

// Le premier temoin charge l ecran entier (une dizaine de secondes sur ce PC).
jest.setTimeout(30000);

afterEach(() => {
  act(() => { arbres.splice(0).forEach((arbre) => arbre.unmount()); });
});

describe('VILLE-INSTALLATION 2 — la feuille « Type d installation »', () => {
  it('elle a une hauteur DECLAREE : elle ne monte plus avec sa liste', async () => {
    const { feuille } = await ouvrirLaFeuilleType();

    expect(Array.isArray(feuille.props.snapPoints)).toBe(true);
    expect(feuille.props.enableDynamicSizing).toBe(false);
  });

  it('son bord haut reste SOUS la bande de l en-tete, donc sous la fleche de retour', async () => {
    const { feuille } = await ouvrirLaFeuilleType();
    const ecran = Dimensions.get('screen').height;
    const place = ecran - feuille.props.topInset;
    const hauteur = (parseFloat(String(feuille.props.snapPoints?.[0])) / 100) * place;

    expect(ecran - hauteur).toBeGreaterThan(INSET_HAUT + BANDE_EN_TETE);
  });

  it('sa liste defile jusqu au bout : la zone defilante epouse la feuille', async () => {
    const { zoneDefilante } = await ouvrirLaFeuilleType();
    const style = StyleSheet.flatten(zoneDefilante.props.style);

    expect(style.flex).toBe(1);
    expect(style.maxHeight).toBeUndefined();
    expect(StyleSheet.flatten(zoneDefilante.parent.props.style).flex).toBe(1);
    expect(StyleSheet.flatten(zoneDefilante.props.contentContainerStyle).paddingBottom)
      .toBeGreaterThanOrEqual(INSET_BAS);
  });
});
