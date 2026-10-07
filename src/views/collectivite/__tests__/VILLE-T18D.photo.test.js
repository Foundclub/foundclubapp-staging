import { Image, Modal, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { photosEtDocuments, photoUrl } from '@/domains/collectivite/collectiviteActualites';

import CollectiviteActualites from '../CollectiviteActualites';
import ActualiteCarte, { PieceJointeActualite } from '../components/ActualiteCarte';
import {
  BandeauActualiteMairie,
  BandeauActualiteMembre,
} from '../components/BandeauActualiteVille';
import BlocDeLaVille from '../components/BlocDeLaVille';

// 📷 VILLE-T18D (07/10/2026) — T17 défaut 6, revu par la T18 au point 2 (captures G71b, G72, M03) :
// la photo jointe à une actualité de la Ville restait un lien « Ouvrir 113.png · IMG », jamais une
// vignette, ni chez la mairie, ni chez le club, ni dans le bandeau de l'accueil.
//
// Cause racine : la carte PARTAGÉE (`ActualiteCarte`, 5 écrans) passait CHAQUE pièce jointe à
// `PieceJointeActualite`, la ligne d'un document ; le bandeau n'en montrait aucune.
//
// Ce que ce témoin fige (ROUGE avant le lot) :
//   - une photo s'affiche EN PHOTO dans la carte (vignette), et en plein écran au toucher ; la
//     croix « Fermer la photo » referme ;
//   - un PDF garde sa ligne « Ouvrir … » ; une photo n'en a plus ;
//   - la vignette prend la plus petite version du serveur assez large, le plein écran l'original ;
//   - chez la mairie (« Actualités de la Ville ») et chez le club (bloc « De la Ville ») ;
//   - le bandeau de l'accueil (membre et mairie) montre une vignette quand il y a une photo ;
//   - la ligne d'une photo dans le formulaire montre la photo au lieu de « IMG ».

/** @type {any} */
let mockMine;
/** @type {any} */
let mockListe;
/** @type {any} */
let mockBloc;
const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, setOptions: jest.fn() }),
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
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 47,
  }),
}));
jest.mock('@/services/collectivite/collectiviteActualiteQueries', () => ({
  useActualiteMutations: () => ({ retirer: { isPending: false, mutateAsync: jest.fn() } }),
  useClubActualitesNotify: () => ({ isPending: false, mutate: jest.fn() }),
  useClubCollectiviteActualites: () => mockBloc,
  useCollectiviteActualites: () => mockListe,
  useMarquerActualitesVues: () => ({ mutate: jest.fn() }),
  useMesActualitesDeLaVille: () => mockMine,
}));
jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useMyCollectivites: () => ({
    data: [{ documentId: 'ville-de-recette', name: 'Ville de Montrivage' }],
  }),
}));
jest.mock('@/platform/storage', () => ({ getItem: () => null, setItem: () => {} }));
jest.mock('@/responsive', () => ({ useIsDesktop: () => false }));
jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);
jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() { return null; });

const R2 = 'https://pub-recette.r2.dev';
// La photo de la T18, telle que le serveur de la recette l'a rendue (relay_corps.log, 13:31:13) :
// une capture de 912×2048, ses quatre versions, et l'original optimisé.
const PHOTO = {
  ext: '.png',
  formats: {
    large: { url: `${R2}/large_113.png`, width: 445 },
    medium: { url: `${R2}/medium_113.png`, width: 334 },
    small: { url: `${R2}/small_113.png`, width: 223 },
    thumbnail: { url: `${R2}/thumbnail_113.png`, width: 69 },
  },
  height: 2048,
  id: 71,
  mime: 'image/png',
  name: '113.png',
  url: `${R2}/113.png`,
  width: 912,
};
// Une photo d'appareil, en paysage : sa version « large » (1000 px) suffit à la carte.
const PAYSAGE = {
  ext: '.jpg',
  formats: {
    large: { url: '/uploads/large_affiche.jpg', width: 1000 },
    medium: { url: '/uploads/medium_affiche.jpg', width: 750 },
    small: { url: '/uploads/small_affiche.jpg', width: 500 },
    thumbnail: { url: '/uploads/thumbnail_affiche.jpg', width: 208 },
  },
  id: 72,
  mime: 'image/jpeg',
  name: 'affiche-forum.jpg',
  url: '/uploads/affiche.jpg',
  width: 2048,
};
const PDF = {
  ext: '.pdf',
  id: 12,
  mime: 'application/pdf',
  name: 'dossier-subvention.pdf',
  url: '/uploads/d.pdf',
};
const VILLE = { documentId: 'ville-de-recette', name: 'Ville de Montrivage' };
const ACTU = {
  attachments: [PHOTO, PDF],
  audience: 'dirigeants',
  body: 'Test de la tournee 18, a ignorer.',
  category: 'forum',
  collectivite: VILLE,
  documentId: 'actu-photo',
  publishedAt: new Date().toISOString(),
  recipients: { clubsCount: 3 },
  title: 'T18 essai actualite',
};

const aplatir = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
  return String(enfants);
};
const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ n) => aplatir(n.props.children).trim());
const monter = async (/** @type {any} */ element) => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(element);
  });
  return arbre;
};
// Un composant passe son `testID` à ses enfants : on garde le plus haut de chaque chaîne.
const tousParTestID = (/** @type {any} */ arbre, /** @type {string} */ testID) => arbre.root
  .findAll((/** @type {any} */ n) => n.props?.testID === testID
    && typeof n.type !== 'string'
    && n.parent?.props?.testID !== testID);
const imageParTestID = (/** @type {any} */ arbre, /** @type {string} */ testID) => arbre.root
  .findAllByType(Image)
  .find((/** @type {any} */ n) => n.props.testID === testID);
const sources = (/** @type {any} */ arbre) => arbre.root.findAllByType(Image)
  .map((/** @type {any} */ n) => n.props.source?.uri)
  .filter(Boolean);

beforeEach(() => {
  mockNavigate.mockReset();
  mockMine = { data: { actualites: [ACTU], bandeau: { actualite: ACTU, autres: 0 } } };
  mockListe = {
    data: [ACTU], error: null, isLoading: false, refetch: jest.fn(),
  };
  mockBloc = { data: { actualites: [ACTU], collectivite: VILLE, notify: false }, isLoading: false };
});

describe('VILLE-T18D — les règles, en fonctions pures', () => {
  it('une photo est une photo, un PDF un document', () => {
    expect(photosEtDocuments([PHOTO, PDF, PAYSAGE])).toEqual({
      documents: [PDF],
      photos: [PHOTO, PAYSAGE],
    });
    expect(photosEtDocuments(undefined)).toEqual({ documents: [], photos: [] });
  });

  it('la plus petite version assez large ; à défaut, l original', () => {
    expect(photoUrl(PAYSAGE, 900)).toBe('/uploads/large_affiche.jpg');
    expect(photoUrl(PAYSAGE, 120)).toBe('/uploads/thumbnail_affiche.jpg');
    // La capture en portrait : aucune version n'atteint 900 px de large.
    expect(photoUrl(PHOTO, 900)).toBe(`${R2}/113.png`);
    expect(photoUrl(PHOTO, 120)).toBe(`${R2}/small_113.png`);
    // Sans versions (envoi local, ou image plus petite que la vignette du serveur).
    expect(photoUrl({ mime: 'image/png', url: '/uploads/petite.png' }, 900))
      .toBe('/uploads/petite.png');
  });
});

describe('VILLE-T18D — la carte de l actualité', () => {
  it('la photo s affiche en photo ; le PDF garde sa ligne « Ouvrir »', async () => {
    const arbre = await monter(<ActualiteCarte actualite={ACTU} />);
    const vignettes = tousParTestID(arbre, 'actualite-photo');
    expect(vignettes).toHaveLength(1);
    expect(sources(arbre)).toContain(`${R2}/113.png`);
    const lignes = tousParTestID(arbre, 'actualite-piece-jointe');
    expect(lignes).toHaveLength(1);
    expect(textes(arbre)).toContain('dossier-subvention.pdf');
    expect(textes(arbre)).not.toContain('113.png');
    expect(textes(arbre)).not.toContain('IMG');
  });

  it('un toucher ouvre la photo en plein écran ; « Fermer la photo » la referme', async () => {
    const arbre = await monter(<ActualiteCarte actualite={{ ...ACTU, attachments: [PAYSAGE] }} />);
    expect(arbre.root.findAllByType(Modal)).toHaveLength(0);
    const [vignette] = tousParTestID(arbre, 'actualite-photo');
    expect(vignette.props.accessibilityLabel).toBe('Agrandir la photo');
    // La carte charge la version « large », pas l'original de 2048 px.
    expect(sources(arbre)).toEqual([expect.stringContaining('/uploads/large_affiche.jpg')]);
    await act(async () => {
      vignette.props.onPress();
    });
    const [plein] = arbre.root.findAllByType(Modal);
    expect(plein.props.visible).toBe(true);
    expect(sources(arbre)).toContainEqual(expect.stringContaining('/uploads/affiche.jpg'));
    const [fermer] = tousParTestID(arbre, 'actualite-photo-fermer');
    expect(fermer.props.accessibilityLabel).toBe('Fermer la photo');
    await act(async () => {
      fermer.props.onPress();
    });
    expect(arbre.root.findAllByType(Modal)).toHaveLength(0);
  });

  it('la carte compacte (accueil de la mairie) ne montre toujours aucune pièce', async () => {
    const arbre = await monter(<ActualiteCarte actualite={ACTU} compact />);
    expect(tousParTestID(arbre, 'actualite-photo')).toHaveLength(0);
    expect(tousParTestID(arbre, 'actualite-piece-jointe')).toHaveLength(0);
  });

  it('chez la mairie : « Actualités de la Ville » montre la photo', async () => {
    const arbre = await monter(<CollectiviteActualites />);
    expect(tousParTestID(arbre, 'actualite-photo')).toHaveLength(1);
  });

  it('chez le club : le bloc « De la Ville » montre la photo', async () => {
    const arbre = await monter(<BlocDeLaVille clubId="as-montrivage" />);
    expect(tousParTestID(arbre, 'actualite-photo')).toHaveLength(1);
  });
});

describe('VILLE-T18D — le bandeau de l accueil', () => {
  it('membre : une vignette de la photo, dans le lien du bandeau', async () => {
    const arbre = await monter(<BandeauActualiteMembre onOuvrir={jest.fn()} />);
    const photo = imageParTestID(arbre, 'bandeau-actualite-ville-photo');
    expect(photo.props.source.uri).toBe(`${R2}/small_113.png`);
  });

  it('membre : sans photo, pas de vignette', async () => {
    mockMine = { data: { bandeau: { actualite: { ...ACTU, attachments: [PDF] }, autres: 0 } } };
    const arbre = await monter(<BandeauActualiteMembre onOuvrir={jest.fn()} />);
    expect(tousParTestID(arbre, 'bandeau-actualite-ville-photo')).toHaveLength(0);
  });

  it('mairie : la même vignette dans « Votre actualité · en ligne »', async () => {
    const arbre = await monter(
      <BandeauActualiteMairie
        collectiviteId="ville-de-recette"
        nomVille="Ville de Montrivage"
        onOuvrir={jest.fn()}
      />,
    );
    expect(tousParTestID(arbre, 'bandeau-actualite-mairie-photo')).toHaveLength(1);
  });
});

describe('VILLE-T18D — la ligne d une photo dans le formulaire', () => {
  it('la photo elle-même, au lieu de l étiquette « IMG »', async () => {
    const arbre = await monter(<PieceJointeActualite fichier={PHOTO} sousTitre="Photo jointe" />);
    const vignette = imageParTestID(arbre, 'actualite-piece-jointe-vignette');
    expect(vignette.props.source.uri).toBe(`${R2}/small_113.png`);
    expect(textes(arbre)).not.toContain('IMG');
  });

  it('un PDF garde son étiquette « PDF »', async () => {
    const arbre = await monter(<PieceJointeActualite fichier={PDF} sousTitre="Document joint" />);
    expect(tousParTestID(arbre, 'actualite-piece-jointe-vignette')).toHaveLength(0);
    expect(textes(arbre)).toContain('PDF');
  });
});
