import { Image, Platform, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import CollectiviteActualiteForm from '../CollectiviteActualiteForm';

// 📰 COLL-C4A3 (03/10/2026) — PLANCHE 18 : publier une actualité, les trois manques de la T9
// (design validé HY521H1 page 3 : « P3b-actu-tel » écran 1 et « P3b-actu-ordi »).
//
// Ce que ce témoin fige (ROUGE avant le lot) :
//   1. le pied dit « rattachés » : « Reçue par les membres des 3 clubs rattachés. » ;
//   2. une CROIX ferme l'écran (« Annuler »), à la place de la flèche : on annule une saisie, on
//      ne revient pas d'une page ;
//   3. sur ordinateur (le site), « ou glissez un fichier ici » à côté de Photo et Document, et un
//      fichier lâché sur l'écran part EXACTEMENT comme un fichier choisi (même envoi, même
//      message d'échec, au plus 6 pièces) ; le téléphone n'a ni la phrase ni l'écoute.
//      L'écoute du navigateur elle-même (preventDefault, texte ignoré, survol compté) a son
//      témoin : src/platform/media/__tests__/depotDeFichiers.test.js. Ici, elle est doublée :
//      une vue de test n'est pas un élément du navigateur.
//
// ⚠️ La pièce « Document » du téléphone est corrigée par COLL-FIX2 : ce témoin ne la refait pas.

let mockParams = /** @type {any} */ ({});
let mockOrdinateur = false;
const mockSetOptions = jest.fn();
const mockGoBack = jest.fn();
const mockUpload = jest.fn();
/** @type {any} */
let mockEcoute = null;

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    goBack: mockGoBack, navigate: jest.fn(), replace: jest.fn(), setOptions: mockSetOptions,
  }),
  useRoute: () => ({ params: mockParams }),
}));

jest.mock('react-i18next', () => {
  const catalogue = jest.requireActual('@/theme/strings/translations/fr').default;
  return {
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ options) => {
        const valeur = String(cle || '')
          .split('.')
          .reduce((noeud, segment) => (noeud == null ? undefined : noeud[segment]), catalogue);
        let texte = cle;
        if (typeof valeur === 'string') texte = valeur;
        else if (typeof repli === 'string') texte = repli;
        return texte.replace(/\{\{(\w+)\}\}/g, (_tout, nom) => String(options?.[nom] ?? ''));
      },
    }),
  };
});

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
      Images: { arrowLeft: 'image-fleche', close: 'image-croix', plus: 'image-plus' },
      Spaces: espaces,
    }),
  };
});

jest.mock('@/services/collectivite/collectiviteActualiteQueries', () => ({
  useActualiteMutations: () => ({
    modifier: { isPending: false, mutateAsync: jest.fn() },
    publier: { isPending: false, mutateAsync: jest.fn() },
  }),
  useActualiteRecipients: (/** @type {any} */ _id, /** @type {any} */ cible) => ({
    data: { audience: cible.audience, clubsCount: cible.audience === 'installation' ? 1 : 3 },
  }),
  useCollectiviteActualites: () => ({ data: [], isLoading: false }),
}));
jest.mock('@/services/collectivite/collectiviteActualiteService', () => ({
  uploadActualiteFile: (/** @type {any} */ fichier) => mockUpload(fichier),
}));
jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useCollectiviteInstallations: () => ({
    data: [{ documentId: 'dojo', name: 'Dojo municipal' }],
  }),
  useMyCollectivites: () => ({
    data: [{ documentId: 'ville-de-recette', name: 'Ville de Montrivage' }],
  }),
}));
jest.mock('@/platform/media', () => ({
  __esModule: true,
  default: { capturePhoto: jest.fn(), pickDocument: jest.fn(), pickImage: jest.fn() },
}));
jest.mock('@/responsive', () => ({ useIsDesktop: () => mockOrdinateur }));
jest.mock('@/platform/media/depotDeFichiers', () => ({
  ecouterLeDepot: (/** @type {any} */ element, /** @type {any} */ rappels) => {
    mockEcoute = { element, rappels };
    return () => {};
  },
}));
jest.mock('@/components/molecules/input/Input', () => {
  const { TextInput: Champ } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ {
      label, onChangeText, testID, value,
    }) => (
      <Champ accessibilityLabel={label} onChangeText={onChangeText} testID={testID} value={value} />
    ),
  };
});
jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);
jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() { return null; });
jest.mock(
  '@/components/molecules/bottomModal/BottomModal',
  () => function BottomModalMock({ children, isVisible }) { return isVisible ? children : null; },
);
jest.mock(
  '@/components/organisms/chatAttachmentSheet/ChatAttachmentSheet',
  () => function FeuilleMock() { return null; },
);

const VILLE = { collectiviteId: 'ville-de-recette' };
const PDF = {
  id: 41, mime: 'application/pdf', name: 'dossier-subvention.pdf', url: '/uploads/d.pdf',
};

const aplatirTexte = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};
const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ n) => aplatirTexte(n.props.children).trim());
const parTestID = (/** @type {any} */ arbre, /** @type {string} */ testID) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props?.testID === testID && typeof n.type !== 'string',
)[0];

/**
 * Monte l'écran.
 * @returns {Promise<any>} L'arbre.
 */
const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<CollectiviteActualiteForm />);
  });
  return arbre;
};

const OS_D_ORIGINE = Platform.OS;

beforeEach(() => {
  mockParams = { ...VILLE };
  mockOrdinateur = false;
  mockEcoute = null;
  Platform.OS = OS_D_ORIGINE;
  [mockSetOptions, mockGoBack, mockUpload].forEach((fn) => fn.mockReset());
});

afterAll(() => {
  Platform.OS = OS_D_ORIGINE;
});

describe('COLL-C4A3 — planche 18 : le pied dit « rattachés »', () => {
  it('tous les membres : « Reçue par les membres des 3 clubs rattachés. »', async () => {
    const arbre = await monter();
    expect(aplatirTexte(parTestID(arbre, 'actualite-form-destinataires').props.children))
      .toMatch(/^Reçue par les membres des 3 clubs rattachés\. Une notification part/);
  });

  it('les clubs d’une installation, un seul : « d’1 club rattaché. »', async () => {
    const arbre = await monter();
    const appuyer = (/** @type {string} */ testID) => parTestID(arbre, testID).props.onPress();
    await act(async () => { appuyer('actualite-form-pour-installation'); });
    await act(async () => { appuyer('actualite-form-installation-dojo'); });
    expect(aplatirTexte(parTestID(arbre, 'actualite-form-destinataires').props.children))
      .toMatch(/^Reçue par les membres d’1 club rattaché\. /);
  });
});

describe('COLL-C4A3 — planche 18 : une croix ferme l’écran', () => {
  it('l’en-tête prend une croix « Annuler », qui revient en arrière', async () => {
    await monter();
    const options = mockSetOptions.mock.calls.map(([o]) => o).find((o) => o?.headerLeft);
    expect(options).toBeTruthy();
    /** @type {any} */
    let bouton;
    act(() => { bouton = renderer.create(options.headerLeft()); });
    const image = bouton.root.findByType(Image);
    expect(image.props.source).toBe('image-croix');
    const touche = bouton.root.findAll(
      (/** @type {any} */ n) => typeof n.props?.onPress === 'function'
        && typeof n.type !== 'string',
    )[0];
    expect(touche.props.accessibilityLabel).toBe('Annuler');
    act(() => { touche.props.onPress(); });
    expect(mockGoBack).toHaveBeenCalledTimes(1);
    act(() => { bouton.unmount(); });
  });
});

describe('COLL-C4A3 — planche 18 : sur ordinateur, on glisse un fichier', () => {
  it('site sur ordinateur : la phrase et l’écoute ; téléphone : ni l’une ni l’autre', async () => {
    mockOrdinateur = true;
    Platform.OS = 'web';
    expect(textes(await monter())).toContain('ou glissez un fichier ici');
    expect(mockEcoute?.element).toBeTruthy();
    mockEcoute = null;
    Platform.OS = 'android';
    mockOrdinateur = false;
    expect(textes(await monter())).not.toContain('ou glissez un fichier ici');
    expect(mockEcoute).toBeNull();
  });

  it('un fichier survolé allume la zone ; lâché, il part comme un fichier choisi', async () => {
    mockOrdinateur = true;
    Platform.OS = 'web';
    const fichier = new File(['%PDF'], 'dossier-subvention.pdf', { type: 'application/pdf' });
    mockUpload.mockResolvedValue(PDF);
    const arbre = await monter();
    const zone = () => parTestID(arbre, 'actualite-form-depot');
    // L'écran écoute SA zone (le formulaire ET l'aperçu), celle qui porte la ref.
    expect(mockEcoute.element).toBe(zone().instance);

    await act(async () => { mockEcoute.rappels.onSurvol(true); });
    expect(zone().props.style)
      .toEqual(expect.arrayContaining([expect.objectContaining({ borderStyle: 'dashed' })]));

    await act(async () => {
      mockEcoute.rappels.onSurvol(false);
      await mockEcoute.rappels.onFichiers([fichier]);
    });
    expect(zone().props.style)
      .not.toEqual(expect.arrayContaining([expect.objectContaining({ borderStyle: 'dashed' })]));
    expect(mockUpload).toHaveBeenCalledWith(fichier);
    expect(textes(arbre))
      .toEqual(expect.arrayContaining(['dossier-subvention.pdf', 'Document joint']));
  });

  it('plusieurs fichiers : un par un, sans dépasser 6 pièces jointes', async () => {
    mockOrdinateur = true;
    Platform.OS = 'web';
    let numero = 0;
    mockUpload.mockImplementation(async () => {
      numero += 1;
      return { ...PDF, id: numero, name: `piece-${numero}.pdf` };
    });
    await monter();
    const huit = Array.from({ length: 8 }, (_v, i) => new File(['x'], `f${i}.pdf`));
    await act(async () => { await mockEcoute.rappels.onFichiers(huit); });
    expect(mockUpload).toHaveBeenCalledTimes(6);
    expect(mockUpload.mock.calls.map(([f]) => f.name))
      .toEqual(['f0.pdf', 'f1.pdf', 'f2.pdf', 'f3.pdf', 'f4.pdf', 'f5.pdf']);
  });

  it('un envoi raté dit la même phrase qu’un fichier choisi', async () => {
    mockOrdinateur = true;
    Platform.OS = 'web';
    mockUpload.mockRejectedValue(new Error('HTTP 413'));
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const arbre = await monter();
    await act(async () => { await mockEcoute.rappels.onFichiers([new File(['x'], 'gros.pdf')]); });
    expect(textes(arbre)).toContain('La pièce jointe n’a pas pu être envoyée. Réessayez.');
  });
});
