import { ScrollView } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import Button from '@/components/atoms/button/Button';
import WebFloatingOverlay from '@/components/atoms/webFloatingOverlay/WebFloatingOverlay';

import MyLicenseDetail from '../MyLicenseDetail';

/**
 * S9-ter — UN SEUL BOUTON, ET IL FLOTTE.
 *
 * 🗣️ Adel, recette du 2026-08-25 (capture du detail) : la barre du bas fait
 * « trop de blocs separes ». « Vaut mieux avoir UN SEUL beau bouton FLOTTANT —
 * et le bouton "Quelqu un paie pour moi", enleve-le. »
 *
 * 🔬 CE QU IL Y AVAIT AVANT : un BANDEAU pleine largeur (fond `primary800`,
 * filet superieur, padding 12/16/24) portant JUSQU A DEUX boutons empiles. Sur
 * un ecran qui empile deja carte de montant + echeancier + dossier + paiements,
 * ce bandeau ajoutait un 5e bloc de fond qui tranchait.
 *
 * ⚖️ CE QUE CE TEMOIN VERROUILLE — et pourquoi chaque point compte :
 *   1. UN SEUL bouton d action visible a l ecran. Deux, c est deja « plusieurs
 *      blocs » ;
 *   2. il FLOTTE (calque `position: absolute` au-dessus du contenu defilant),
 *      il n est plus un frere qui prend sa propre bande ;
 *   3. ⛔ ET LE CONTREPOIDS, SANS LEQUEL LE POINT 2 EST UN DEFAUT : un calque
 *      RECOUVRE. Le contenu defilant doit donc reserver assez de degagement bas
 *      pour que le dernier bloc passe SOUS le bouton sans etre masque. C est ce
 *      que la barre-frere garantissait gratuitement ; en flottant, il faut
 *      l ecrire — et donc le mesurer ;
 *   4. « Quelqu un paie pour moi » n est PLUS un bouton d ecran. La
 *      fonctionnalite survit (menu ⋯), c est le BOUTON qu Adel a demande de
 *      retirer.
 */

/** @type {any} */
let mockMesCotisations;
const mockMutationFigee = { isPending: false, mutate: jest.fn(), mutateAsync: jest.fn() };

jest.mock('@/services/license/licenseQueries', () => ({
  createLicenseCheckout: jest.fn(),
  declareExternalLicensePayment: jest.fn(),
  generateLicenseReceipt: jest.fn(),
  submitLicenseDocument: jest.fn(),
  useLicenseMutation: () => mockMutationFigee,
  useMyLicenseAssignment: () => ({
    data: null, isError: false, isLoading: false, refetch: jest.fn(),
  }),
  useMyLicenses: () => mockMesCotisations,
}));

const mockNavigationContexte = { goBack: jest.fn(), navigate: jest.fn() };
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigationContexte,
}));

// S9-ter — le bouton flottant lit le retrait bas systeme. Meme mock que les
// suites qui montent deja un calque (ClubDetails.AB05, ClubDetails.V01...).
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));

jest.mock('@/theme/themeContext', () => {
  const couleurs = jest.requireActual('@/theme/colors').default();
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(couleurs),
      Colors: couleurs,
      Fonts: jest.requireActual('@/theme/fonts').default(couleurs),
      Images: {},
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});

jest.mock('@/components/templates/ScreenContainer', () => function ScreenMock(
  /** @type {any} */ { children },
) {
  return children;
});

// ⚠️ MESURE : la feuille du menu ⋯ n est PAS montee tant qu on n a pas appuye
// dessus (`{menuVisible ? <BottomModal…`). Un temoin qui cherche « paie pour
// moi » dans l arbre au repos passerait donc au vert POUR LA MAUVAISE RAISON —
// il verrait une absence, pas un retrait. Le temoin OUVRE donc le menu.
jest.mock('@/components/molecules/bottomModal/BottomModal', () => function ModalMock(
  /** @type {any} */ { children },
) {
  return children;
});

jest.mock('react-native-blob-util', () => ({
  __esModule: true,
  default: { config: jest.fn(), fs: { dirs: { CacheDir: '/cache' }, stat: jest.fn() } },
}));

jest.mock('@/platform/links', () => ({ __esModule: true, default: { openUrl: jest.fn() } }));
jest.mock('@/platform/media', () => ({ __esModule: true, default: { pickDocument: jest.fn() } }));
jest.mock('@/platform/media/downloadRemoteFile', () => ({
  __esModule: true,
  downloadRemoteFile: jest.fn(),
}));
jest.mock('@/platform/share', () => ({ __esModule: true, default: { share: jest.fn() } }));
jest.mock('@/utils/mediaUrl', () => ({
  resolveMediaUrl: (/** @type {any} */ url) => (url ? `https://api.test${url}` : ''),
}));

/**
 * Une cotisation partiellement payee.
 * @param {any} paymentModes les moyens actives par le club
 * @returns {any} l affectation
 */
const cotisation = (paymentModes) => ({
  amountDueCents: 20000,
  amountPaidCents: 6667,
  amountRemainingCents: 13333,
  campaign: {
    club: { name: 'SMUC' },
    documentId: 'camp-1',
    documentRequests: [],
    name: 'Licence senior',
    paymentModes,
    seasonLabel: '2026-2027',
    status: 'active',
  },
  club: { name: 'SMUC' },
  currency: 'EUR',
  documentId: 'assign-1',
  documentSubmissions: [],
  installments: [],
  payments: [],
  receipts: [],
  // 🔗 Le lien du tiers payeur EXISTE : c est ce qui rend le point 4 mesurable.
  securePaymentToken: 'jeton-de-test',
  status: 'partial',
});

/** @type {any} */
let arbre = null;

afterEach(() => {
  if (arbre) {
    act(() => arbre.unmount());
    arbre = null;
  }
  jest.clearAllMocks();
});

/**
 * Monte le detail.
 * @param {any} paymentModes les moyens actives par le club
 * @returns {void}
 */
const monter = (paymentModes) => {
  mockMesCotisations = {
    data: [cotisation(paymentModes)], isError: false, isLoading: false, refetch: jest.fn(),
  };
  act(() => {
    arbre = renderer.create(
      <MyLicenseDetail
        navigation={{ canGoBack: () => true, goBack: jest.fn(), navigate: jest.fn() }}
        route={{ params: { assignmentId: 'assign-1' } }}
      />,
    );
  });
};

/**
 * Met un style a plat, qu il soit objet ou tableau imbrique.
 * @param {any} style le style rendu
 * @returns {any} un objet unique
 */
const aplatir = (style) => (Array.isArray(style)
  ? style.filter(Boolean).reduce((acc, item) => ({ ...acc, ...aplatir(item) }), {})
  : (style || {}));

/**
 * Les boutons d ECRAN : ceux qui vivent dans le calque flottant. Les entrees du
 * menu ⋯ n en font pas partie — c est toute la difference que ce temoin mesure.
 * @returns {any[]} les boutons du calque
 */
const boutonsFlottants = () => arbre.root
  .findAllByType(WebFloatingOverlay)
  .flatMap((/** @type {any} */ calque) => calque.findAllByType(Button));

describe('S9-ter — la barre du bas devient UN bouton flottant', () => {
  it('🔴 club qui encaisse : UN SEUL bouton a l ecran, et c est « Payer »', () => {
    monter({ cash: true, helloasso: true });
    const boutons = boutonsFlottants();

    expect(boutons.length).toBe(1);
    expect(String(boutons[0].props.title)).toContain('Payer');
    expect(String(boutons[0].props.title)).toContain('133,33');
  });

  it('🔴 club qui n encaisse pas : le flottant devient « J ai payé hors app »', () => {
    monter({ cash: true });
    const boutons = boutonsFlottants();

    expect(boutons.length).toBe(1);
    expect(String(boutons[0].props.title)).toContain('hors app');
  });

  it('🔴 le bouton FLOTTE : un calque, plus un bandeau frere', () => {
    monter({ cash: true, helloasso: true });
    const calques = arbre.root.findAllByType(WebFloatingOverlay);
    expect(calques.length).toBe(1);
    expect(aplatir(calques[0].props.style).position).toBe('absolute');
  });

  it('⛔ LE CONTREPOIDS : le contenu defilant degage assez pour ne rien masquer', () => {
    // Un calque RECOUVRE. Sans ce degagement, le dernier bloc de la page passe
    // sous le bouton et devient illisible — on aurait echange un defaut de
    // presentation contre un defaut d usage.
    monter({ cash: true, helloasso: true });
    const contenu = aplatir(arbre.root.findByType(ScrollView).props.contentContainerStyle);
    // 52 px de bouton + son retrait bas : en dessous, le calque mord le contenu.
    expect(contenu.paddingBottom).toBeGreaterThanOrEqual(88);
  });

  it('🔴 « Quelqu un paie pour moi » n est PLUS un bouton d ecran', () => {
    // 🗣️ « le bouton "Quelqu un paie pour moi", enleve-le ». La fonctionnalite,
    // elle, ne disparait pas : elle vit dans le menu ⋯ — ce que verifie le test
    // suivant. C est un retrait de BOUTON, pas de fonction.
    monter({ cash: true });
    const titres = boutonsFlottants().map((/** @type {any} */ b) => String(b.props.title || ''));
    expect(titres.some((t) => t.toLowerCase().includes('paie pour moi'))).toBe(false);
  });

  /**
   * Ouvre le menu ⋯ et rend tout le texte de l ecran, a plat.
   * @returns {string} le rendu
   */
  const ouvrirLeMenu = () => {
    const trois = arbre.root.findAll((/** @type {any} */ n) => (
      n.props?.accessibilityLabel === 'Plus d options' && typeof n.props?.onPress === 'function'
    ))[0];
    expect(trois).toBeTruthy();
    act(() => trois.props.onPress());
    return JSON.stringify(arbre.toJSON());
  };

  it('la fonctionnalite SURVIT : le tiers payeur est atteignable par le menu ⋯', () => {
    // 💰 Il y a de l argent derriere : Adel a demande de retirer LE BOUTON, pas la
    // fonction. Le temoin OUVRE le menu et verifie que l entree y est vraiment.
    monter({ cash: true, helloasso: true });
    expect(ouvrirLeMenu()).toContain('paie pour moi');
  });

  it('le tiers payeur est GENERALISE : plus reserve aux clubs qui encaissent', () => {
    // 🔓 Avant S9-ter, l entree de menu etait conditionnee a `canPayOnline`. Elle
    // apparait desormais des que le lien existe — les deux cas sont couverts.
    monter({ cash: true });
    expect(ouvrirLeMenu()).toContain('paie pour moi');
  });

  it('l action secondaire descend au menu quand « Payer » est le flottant', () => {
    monter({ cash: true, helloasso: true });
    expect(ouvrirLeMenu()).toContain('hors app');
  });

  it('rien a payer : AUCUN bouton flottant — jamais un bouton muet', () => {
    mockMesCotisations = {
      data: [{ ...cotisation({ helloasso: true }), amountRemainingCents: 0, status: 'paid' }],
      isError: false,
      isLoading: false,
      refetch: jest.fn(),
    };
    act(() => {
      arbre = renderer.create(
        <MyLicenseDetail
          navigation={{ canGoBack: () => true, goBack: jest.fn(), navigate: jest.fn() }}
          route={{ params: { assignmentId: 'assign-1' } }}
        />,
      );
    });
    expect(arbre.root.findAllByType(WebFloatingOverlay).length).toBe(0);
  });
});
