import { ScrollView } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { colors as COULEURS } from '@/theme/colors';

import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import WebFloatingOverlay from '@/components/atoms/webFloatingOverlay/WebFloatingOverlay';

import MyLicenseDetail from '../MyLicenseDetail';

/**
 * S9-bis / defaut 1 — « MA COTISATION NE DEFILE PAS ».
 *
 * 🗣️ Adel, recette du 2026-08-25, capture a l appui : l ecran de detail marche
 * avec de vraies donnees, mais « la page est figee, le bouton du bas est coupe ».
 *
 * 🔬 LA CAUSE, MESUREE DANS LE CODE ET NON DEDUITE :
 * `ScreenContainer` range ses enfants dans `<View style={[Alignments.grow1]}>`
 * (`ScreenContainer.js:146`), et `Alignments.grow1` vaut `{ flexGrow: 1 }` —
 * `flexGrow` SEUL (`theme/alignements.js:110`). En Yoga, `flexShrink` vaut 0 par
 * defaut : aucun des trois freres de cet ecran (barre du haut · ScrollView ·
 * barre d action) ne peut donc RETRECIR. Le ScrollView, sans contrainte de
 * hauteur, prend la taille de son contenu :
 *   · sa zone visible = sa zone de contenu ⇒ IL N A RIEN A FAIRE DEFILER ;
 *   · et il pousse la barre d action hors de l ecran ⇒ bouton coupe.
 * Les deux symptomes d Adel viennent de la MEME ligne.
 *
 * ✅ CE QUI LE REPARE, ET POURQUOI C EST SUR : `flex: 1` sur le ScrollView vaut
 * `flexGrow:1 + flexShrink:1 + flexBasis:0%`. La zone defilante prend alors
 * EXACTEMENT la place qui reste entre les deux barres, et le contenu defile
 * dedans. L ancien `MyLicense.js` n avait qu UN enfant et ne montrait pas le
 * defaut : c est l arrivee de la barre d action qui l a revele.
 *
 * ⛔ CE TEMOIN N EST PAS UN TEST DE PEINTURE : il n observe ni couleur ni marge,
 * il observe la seule propriete SANS LAQUELLE L ECRAN EST INUTILISABLE.
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

// S9-bis — `MemberTopBar` reutilise desormais `HeaderBackButton`, le composant
// de retour des 65 autres ecrans. Il appelle `useNavigation()` en interne (pour
// pouvoir se passer d un `onPress`), ce qui exige un navigateur autour. C est le
// meme mock que les suites qui montent deja cet entete (AttendanceSheets,
// DetectionRotationBoard...).
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
 * Une cotisation LONGUE, avec assez de sections pour depasser un ecran :
 * echeancier de 4 lignes, 3 pieces, 2 paiements. C est le cas d Adel.
 * @returns {any} l affectation
 */
const cotisationLongue = () => ({
  amountDueCents: 20000,
  amountPaidCents: 6667,
  amountRemainingCents: 13333,
  campaign: {
    club: { name: 'SMUC' },
    documentId: 'camp-1',
    documentRequests: [
      { documentId: 'r1', name: 'Certificat medical', required: true },
      { documentId: 'r2', name: 'Autorisation parentale', required: true },
      { documentId: 'r3', name: 'Photo d identite', required: false },
    ],
    name: 'Licence senior',
    // 💳 Le club encaisse en ligne : c est CE cas qui fait apparaitre la barre
    // d action, donc c est CE cas qui revele le defaut.
    paymentModes: { cash: true, helloasso: true },
    seasonLabel: '2026-2027',
    status: 'active',
  },
  club: { name: 'SMUC' },
  currency: 'EUR',
  documentId: 'assign-1',
  documentSubmissions: [],
  installments: [
    {
      amountDueCents: 6667,
      documentId: 'i1',
      dueDate: '2026-09-15',
      installmentOrder: 1,
      status: 'paid',
    },
    {
      amountDueCents: 6667,
      documentId: 'i2',
      dueDate: '2026-11-15',
      installmentOrder: 2,
      status: 'pending',
    },
    {
      amountDueCents: 6666,
      documentId: 'i3',
      dueDate: '2027-01-15',
      installmentOrder: 3,
      status: 'not_due',
    },
  ],
  payments: [
    {
      amountCents: 6667,
      documentId: 'p1',
      method: 'bank_transfer',
      status: 'confirmed',
      validatedAt: '2026-09-15',
    },
  ],
  receipts: [],
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
 * Monte le detail sur une cotisation longue.
 * @returns {void}
 */
const monter = () => {
  mockMesCotisations = {
    data: [cotisationLongue()], isError: false, isLoading: false, refetch: jest.fn(),
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
 * Met un style a plat, qu il soit un objet ou un tableau imbrique.
 * @param {any} style le style rendu
 * @returns {any} un objet unique
 */
const aplatir = (style) => (Array.isArray(style)
  ? style.filter(Boolean).reduce((acc, item) => ({ ...acc, ...aplatir(item) }), {})
  : (style || {}));

describe('S9-bis / defaut 1 — le detail doit defiler', () => {
  it('le contenu vit dans un conteneur DEFILANT', () => {
    monter();
    expect(arbre.root.findAllByType(ScrollView).length).toBe(1);
  });

  it('🔴 LE TEMOIN QUI COMPTE — la zone defilante est BORNEE en hauteur', () => {
    monter();
    const zone = arbre.root.findByType(ScrollView);
    const style = aplatir(zone.props.style);

    // ⚠️ EN REACT NATIVE, `flex: 1` RESTE UN RACCOURCI DANS L OBJET JS : c est
    // Yoga qui le developpe en `flexGrow:1 + flexShrink:1 + flexBasis:0` au
    // moment de la mise en page. On observe donc la forme ECRITE, pas la forme
    // developpee — les deux sont acceptees, aucune ne l etait avant le correctif.
    const borneParLeRaccourci = style.flex === 1;
    const borneParLeTriplet = style.flexGrow === 1
      && style.flexShrink === 1
      && style.flexBasis === 0;

    // ⛔ Sans cette borne, le ScrollView prend la hauteur de son CONTENU : sa
    // zone visible egale sa zone de contenu, donc il n a rien a faire defiler,
    // et il pousse la barre d action hors de l ecran. C est l ecran fige d Adel.
    expect(borneParLeRaccourci || borneParLeTriplet).toBe(true);
    // 🔒 Et personne ne doit re-figer la hauteur en repassant `flexShrink: 0`.
    expect(style.flexShrink).not.toBe(0);
  });

  it('le bouton flottant vit HORS de la zone defilante', () => {
    // 🔁 S9-ter a remplace le bandeau-frere par un CALQUE flottant (« un seul beau
    // bouton », Adel 25/08). Ce que S9-bis doit encore garantir a change de nature :
    // le calque ne doit pas etre DANS le ScrollView, sinon il defilerait avec le
    // contenu et cesserait de flotter — un « bouton flottant » qui disparait au
    // premier glissement est pire qu une barre fixe.
    // ⛔ L ancienne version de ce temoin cherchait un noeud a `borderTopWidth: 1` :
    // depuis le retrait du bandeau, ce selecteur attrape le PIED DE LA CARTE DE
    // MONTANT. Il passait donc au vert sans plus rien prouver.
    monter();
    const zone = arbre.root.findByType(ScrollView);
    expect(zone.findAllByType(WebFloatingOverlay).length).toBe(0);
    expect(arbre.root.findAllByType(WebFloatingOverlay).length).toBe(1);
  });

  it('le contenu garde un degagement bas sous son dernier bloc', () => {
    monter();
    const zone = arbre.root.findByType(ScrollView);
    const contenu = aplatir(zone.props.contentContainerStyle);
    // Depuis S9-ter le degagement doit couvrir le CALQUE, pas une simple marge.
    expect(contenu.paddingBottom).toBeGreaterThanOrEqual(88);
  });
});

describe('S9-bis / defaut 2 — les assets sont ceux de la maison', () => {
  it('🔴 la fleche retour est le composant STANDARD, pas un bouton fabrique', () => {
    // 🗣️ Adel : « les assets ne sont pas ceux du design system, tout comme les
    // fleches retours ». Mesure : `HeaderBackButton` est utilise par 65 ecrans.
    // ⛔ Ce temoin interdit d en refabriquer un 66e a la main.
    monter();
    expect(arbre.root.findAllByType(HeaderBackButton).length).toBe(1);
  });

  it('aucun glyphe MUET : chaque nom demande existe vraiment', () => {
    // 🧨 LE DEFAUT QUE CELA ATTRAPE : `GlyphIcon` rend `null` sans jeter sur un
    // nom inconnu (contrat voulu, `GlyphIcon.js:26`). Une faute de frappe donne
    // donc une icone INVISIBLE, et rien ne la signale — ni la porte lint, ni le
    // type-check. On monte donc chaque nom demande par l ecran et on verifie
    // qu il dessine quelque chose.
    monter();
    const noms = [...new Set(
      arbre.root.findAllByType(GlyphIcon).map((/** @type {any} */ n) => n.props.name),
    )];
    expect(noms.length).toBeGreaterThan(0);

    const muets = noms.filter((nom) => {
      /** @type {any} */
      let seul;
      act(() => {
        seul = renderer.create(<GlyphIcon color={COULEURS.neutral00} name={nom} size={20} />);
      });
      const rendu = seul.toJSON();
      act(() => seul.unmount());
      return rendu === null;
    });

    expect(muets).toEqual([]);
  });
});
