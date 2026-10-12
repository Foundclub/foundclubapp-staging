import { Image, Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { uploadActualiteFile } from '@/services/collectivite/collectiviteActualiteService';

import CollectiviteActualiteForm from '../CollectiviteActualiteForm';

// ⏱️ VILLE-T18D (07/10/2026) — T18 point 2 (G71) : la photo a mis 10,8 s à partir, et l'écran
// ne le disait que par un petit rond à la place du « + ». Le bouton « Publier » restait grisé
// sans raison lisible.
//
// Ce que ce témoin fige (ROUGE avant le lot) :
//   - pendant l'envoi d'une photo : sa vignette (le fichier du téléphone), « Envoi de la photo…
//     n % », et pourquoi « Publier » attend ; une fois tout envoyé : « Photo reçue, le serveur la
//     prépare… » ;
//   - un document : « Envoi du document… n % » ;
//   - à la fin, la ligne d'envoi part et la pièce jointe paraît.
// Harnais repris de COLL-FIX-PLANNING.pieceJointe (les mêmes doublures).

const mockPickDocument = jest.fn();
const mockPickImage = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn() }),
  useRoute: () => ({ params: { collectiviteId: 'ville-de-recette' } }),
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
      Images: {},
      Spaces: espaces,
    }),
  };
});
jest.mock('@/services/collectivite/collectiviteActualiteQueries', () => ({
  useActualiteMutations: () => ({
    modifier: { isPending: false, mutateAsync: jest.fn() },
    publier: { isPending: false, mutateAsync: jest.fn() },
    retirer: { isPending: false, mutateAsync: jest.fn() },
  }),
  useActualiteRecipients: () => ({ data: { clubsCount: 3 } }),
  useCollectiviteActualites: () => ({ data: [], error: null, isLoading: false }),
}));
jest.mock('@/services/collectivite/collectiviteActualiteService', () => ({
  uploadActualiteFile: jest.fn(),
}));
jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useCollectiviteClubs: () => ({ data: [] }),
  useCollectiviteInstallations: () => ({ data: [] }),
  useMyCollectivites: () => ({
    data: [{ documentId: 'ville-de-recette', name: 'Ville de Montrivage' }],
  }),
}));
jest.mock('@/platform/media', () => ({
  __esModule: true,
  default: {
    capturePhoto: jest.fn(),
    pickDocument: (/** @type {any} */ options) => mockPickDocument(options),
    pickImage: (/** @type {any} */ options) => mockPickImage(options),
  },
}));
jest.mock('@/responsive', () => ({ useIsDesktop: () => false }));
jest.mock('@/components/molecules/input/Input', () => function InputMock() { return null; });
jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);
jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() { return null; });
jest.mock(
  '@/components/molecules/bottomModal/BottomModal',
  () => function BottomModalMock({ children }) { return children; },
);
jest.mock(
  '@/components/organisms/chatAttachmentSheet/ChatAttachmentSheet',
  () => function FeuilleMock({ actions, onActionPress }) {
    const { Text: Libelle, TouchableOpacity: Appui } = jest.requireActual('react-native');
    return actions.map((/** @type {any} */ action) => (
      <Appui
        key={action.key}
        onPress={() => onActionPress(action.key)}
        testID={`feuille-${action.key}`}
      >
        <Libelle>{action.label}</Libelle>
      </Appui>
    ));
  },
);

const PHOTO_CHOISIE = {
  assets: [{
    fileName: '113.png', fileSize: 534000, type: 'image/png', uri: 'file:///cache/113.png',
  }],
};
const DOCUMENT_CHOISI = {
  name: 'reglement-interieur.pdf', type: 'application/pdf', uri: 'file:///cache/reglement.pdf',
};
const ATTENTE = 'Vous pourrez publier dès la fin de l’envoi.';

const aplatir = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
  return String(enfants);
};
const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ n) => aplatir(n.props.children).trim());
const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<CollectiviteActualiteForm />);
  });
  return arbre;
};
/**
 * Un envoi que le témoin tient en main : il dit la progression, puis le termine.
 * @returns {{ finir: (fichier: any) => Promise<void>, progresser: (f: number) => Promise<void> }}
 */
const envoiTenu = () => {
  /** @type {any} */
  let options;
  /** @type {any} */
  let terminer;
  /** @type {any} */ (uploadActualiteFile).mockImplementation((_brut, opts) => {
    options = opts;
    return new Promise((resolve) => { terminer = resolve; });
  });
  return {
    finir: async (fichier) => { await act(async () => { terminer(fichier); }); },
    progresser: async (fraction) => {
      await act(async () => { options?.onProgress?.(fraction); });
    },
  };
};
const ajouter = async (/** @type {any} */ arbre, /** @type {string} */ cle) => {
  const action = arbre.root.findAllByType(TouchableOpacity)
    .find((/** @type {any} */ n) => n.props.testID === `feuille-${cle}`);
  // L'envoi reste en cours (le témoin le tient) : on n'attend que le choix du fichier.
  await act(async () => {
    action.props.onPress();
    await new Promise((resolve) => { setTimeout(resolve, 0); });
  });
};
const publier = (/** @type {any} */ arbre) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props?.testID === 'actualite-form-publier' && n.props?.title,
)[0];

beforeEach(() => {
  jest.clearAllMocks();
});

describe('VILLE-T18D — l écran montre l envoi d une pièce jointe', () => {
  it('une photo : sa vignette, « Envoi de la photo… n % », puis « Photo reçue… »', async () => {
    mockPickImage.mockResolvedValue(PHOTO_CHOISIE);
    const envoi = envoiTenu();
    const arbre = await monter();
    await ajouter(arbre, 'photos');
    expect(uploadActualiteFile).toHaveBeenCalledWith(
      PHOTO_CHOISIE,
      expect.objectContaining({ onProgress: expect.any(Function) }),
    );
    expect(textes(arbre)).toEqual(expect.arrayContaining(['Envoi de la photo…', ATTENTE]));
    const apercu = arbre.root.findAllByType(Image)
      .find((/** @type {any} */ n) => n.props.testID === 'actualite-form-envoi-apercu');
    expect(apercu.props.source.uri).toBe('file:///cache/113.png');
    expect(publier(arbre).props.disabled).toBe(true);

    await envoi.progresser(0.42);
    expect(textes(arbre)).toContain('Envoi de la photo… 42 %');
    await envoi.progresser(1);
    expect(textes(arbre)).toContain('Photo reçue, le serveur la prépare…');

    await envoi.finir({
      id: 71, mime: 'image/png', name: '113.png', url: 'https://r2.example/113.png',
    });
    expect(textes(arbre)).not.toContain('Photo reçue, le serveur la prépare…');
    expect(textes(arbre)).not.toContain(ATTENTE);
    expect(textes(arbre)).toContain('113.png');
    expect(publier(arbre).props.disabled).toBe(false);
  });

  it('un document : « Envoi du document… n % », sans vignette', async () => {
    mockPickDocument.mockResolvedValue([DOCUMENT_CHOISI]);
    const envoi = envoiTenu();
    const arbre = await monter();
    await ajouter(arbre, 'document');
    await envoi.progresser(0.5);
    expect(textes(arbre)).toContain('Envoi du document… 50 %');
    expect(arbre.root.findAllByType(Image)
      .filter((/** @type {any} */ n) => n.props.testID === 'actualite-form-envoi-apercu'))
      .toHaveLength(0);
    await envoi.progresser(1);
    expect(textes(arbre)).toContain('Document reçu, le serveur l’enregistre…');
    await envoi.finir({ id: 41, mime: 'application/pdf', name: 'reglement-interieur.pdf' });
    expect(textes(arbre)).not.toContain('Document reçu, le serveur l’enregistre…');
  });
});
