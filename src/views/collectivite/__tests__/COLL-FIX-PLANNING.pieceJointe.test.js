import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { uploadActualiteFile } from '@/services/collectivite/collectiviteActualiteService';

import CollectiviteActualiteForm from '../CollectiviteActualiteForm';

// 🐞 COLL-FIX-PLANNING (02/10/2026), defaut de la tournee T9 (captures T9_DEFAUT_C18 et T9_C18_1) :
// une piece jointe d actualite par « Document » echouait SANS REQUETE (le journal du relais n a vu
// qu un seul POST /upload, celui de la photo), et le message d erreur restait affiche apres l envoi
// reussi d une photo. Harnais repris du temoin COLLC4A.actualites (les memes doublures).
//
// Ce que ce temoin fige (ROUGE avant le correctif) :
//   - un document choisi est d abord COPIE dans le cache de l app, et c est la copie qui part —
//     le chemin de la messagerie (Conversation.js, handlePickFile), qui envoie des documents ;
//   - un nouvel ajout efface le message d un echec precedent.

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
const mockReplace = jest.fn();
const mockPickDocument = jest.fn();
const mockPickImage = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack, navigate: mockNavigate, replace: mockReplace }),
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
// La feuille « Ajouter » toujours ouverte : on appuie directement sur ses actions.
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

const ECHEC = 'La pièce jointe n’a pas pu être envoyée. Réessayez.';
const DOCUMENT_CHOISI = {
  name: 'reglement-interieur.pdf',
  type: 'application/pdf',
  uri: 'file:///data/user/0/app/cache/reglement-interieur.pdf',
};
const PHOTO_CHOISIE = { assets: [{ fileName: 'affiche.jpg', type: 'image/jpeg', uri: 'file:///affiche.jpg' }] };

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
const ajouter = async (/** @type {any} */ arbre, /** @type {string} */ cle) => {
  const action = arbre.root.findAllByType(TouchableOpacity)
    .find((/** @type {any} */ n) => n.props.testID === `feuille-${cle}`);
  await act(async () => {
    await action.props.onPress();
  });
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('COLL-FIX-PLANNING — la piece jointe d une actualite (T9_C18)', () => {
  it('« Document » : le fichier est copie dans le cache, et c est la copie qui part', async () => {
    mockPickDocument.mockResolvedValue([DOCUMENT_CHOISI]);
    /** @type {any} */ (uploadActualiteFile).mockResolvedValue({
      id: 41, mime: 'application/pdf', name: 'reglement-interieur.pdf', url: '/uploads/r.pdf',
    });
    const arbre = await monter();
    await ajouter(arbre, 'document');
    // COLL-FIX2 (T10) : la copie ne suffisait pas ; le sélecteur s'ouvre maintenant comme celui
    // de la messagerie (mode « import »).
    expect(mockPickDocument).toHaveBeenCalledWith(expect.objectContaining({
      localCopy: true,
      mode: 'import',
    }));
    expect(uploadActualiteFile).toHaveBeenCalledWith([DOCUMENT_CHOISI]);
    expect(textes(arbre)).toContain('reglement-interieur.pdf');
    expect(textes(arbre)).not.toContain(ECHEC);
  });

  it('un echec puis une photo envoyee : le message de l echec disparait', async () => {
    mockPickDocument.mockResolvedValue([DOCUMENT_CHOISI]);
    mockPickImage.mockResolvedValue(PHOTO_CHOISIE);
    /** @type {any} */ (uploadActualiteFile)
      .mockRejectedValueOnce(new Error('Network request failed'))
      .mockResolvedValueOnce({
        id: 42, mime: 'image/jpeg', name: 'affiche.jpg', url: '/uploads/a.jpg',
      });
    const arbre = await monter();
    await ajouter(arbre, 'document');
    expect(textes(arbre)).toContain(ECHEC);
    await ajouter(arbre, 'photos');
    expect(uploadActualiteFile).toHaveBeenLastCalledWith(PHOTO_CHOISIE);
    expect(textes(arbre)).not.toContain(ECHEC);
  });

  it('un choix annule ne dit rien', async () => {
    mockPickDocument.mockRejectedValue(
      Object.assign(new Error('user canceled the document picker'), { code: 'OPERATION_CANCELED' }),
    );
    const arbre = await monter();
    await ajouter(arbre, 'document');
    expect(uploadActualiteFile).not.toHaveBeenCalled();
    expect(textes(arbre)).not.toContain(ECHEC);
  });
});
