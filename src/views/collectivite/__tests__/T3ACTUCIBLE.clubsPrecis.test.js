import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import CollectiviteActualiteForm from '../CollectiviteActualiteForm';

// 📰 T3-ACTU-CIBLE (03/11/2026) — FICHE 3, OPTION B : « Actualité : choisir à qui on l'envoie ».
// Une quatrième pastille « Des clubs précis » déplie les clubs à cocher, le tri par sport et les
// rôles ; le pied donne le nombre de destinataires AVANT l'envoi.
//
// Ce que ce témoin fige (ROUGE avant le lot : la pastille n'existait pas) :
//   1. les 3 pastilles d'origine ne bougent pas, et rien ne se déplie sans la 4e ;
//   2. le tri par sport ne garde que les clubs de ce sport, sans décocher les autres ;
//   3. « Tout cocher » ne vise que ce qui est affiché ;
//   4. publier sans club, ou sans rôle, le dit et n'envoie rien ;
//   5. publier envoie la liste et les rôles ; le pied dit le nombre ;
//   6. « Modifier » reprend les clubs et les rôles de l'actualité.

let mockParams = /** @type {any} */ ({});
let mockActualites = /** @type {any[]} */ ([]);
let mockClubs = /** @type {any} */ ({});
const mockPublier = jest.fn();
const mockModifier = jest.fn();
const mockRecipients = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn(), setOptions: jest.fn(),
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
    modifier: { isPending: false, mutateAsync: mockModifier },
    publier: { isPending: false, mutateAsync: mockPublier },
  }),
  useActualiteRecipients: (/** @type {any} */ _id, /** @type {any} */ cible) => {
    mockRecipients(cible);
    return {
      data: cible.audience === 'clubs'
        ? {
          approximate: cible.roles.includes('membres'),
          audience: 'clubs',
          clubsCount: cible.clubIds.length,
          personsCount: 42,
        }
        : { audience: cible.audience, clubsCount: 3 },
    };
  },
  useCollectiviteActualites: () => ({ data: mockActualites, isLoading: false }),
}));
jest.mock('@/services/collectivite/collectiviteActualiteService', () => ({
  uploadActualiteFile: jest.fn(),
}));
jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useCollectiviteClubs: () => mockClubs,
  useCollectiviteInstallations: () => ({ data: [{ documentId: 'dojo', name: 'Dojo municipal' }] }),
  useMyCollectivites: () => ({
    data: [{ documentId: 'ville-de-recette', name: 'Ville de Montrivage' }],
  }),
}));
jest.mock('@/platform/media', () => ({
  __esModule: true,
  default: { capturePhoto: jest.fn(), pickDocument: jest.fn(), pickImage: jest.fn() },
}));
jest.mock('@/responsive', () => ({ useIsDesktop: () => false }));
jest.mock('@/platform/media/depotDeFichiers', () => ({ ecouterLeDepot: () => () => {} }));
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

const CLUBS = [
  { documentId: 'c-foot', name: 'AS Foot', sports: ['Football'] },
  { documentId: 'c-omni', name: 'Omnisports', sports: ['Football', 'Tennis'] },
  { documentId: 'c-tennis', name: 'TC Tennis', sports: ['Tennis'] },
];

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
const appuyer = async (/** @type {any} */ arbre, /** @type {string} */ testID) => {
  await act(async () => { parTestID(arbre, testID).props.onPress(); });
};
const pastille = (/** @type {any} */ arbre, /** @type {string} */ libelle) => arbre.root.findAll(
  (/** @type {any} */ n) => typeof n.props?.onPress === 'function'
    && String(n.props?.accessibilityLabel || '').endsWith(libelle),
)[0];
const appuyerPastille = async (/** @type {any} */ arbre, /** @type {string} */ libelle) => {
  await act(async () => { pastille(arbre, libelle).props.onPress(); });
};
const coche = (/** @type {any} */ arbre, /** @type {string} */ id) => (
  parTestID(arbre, `actualite-form-club-${id}`)?.props?.accessibilityState?.checked
);
const pied = (/** @type {any} */ arbre) => aplatirTexte(
  parTestID(arbre, 'actualite-form-destinataires').props.children,
);
const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<CollectiviteActualiteForm />);
  });
  return arbre;
};
const ecrireLeTitre = async (/** @type {any} */ arbre) => {
  await act(async () => {
    parTestID(arbre, 'actualite-form-titre').props.onChangeText('Réunion');
  });
};

beforeEach(() => {
  mockParams = { collectiviteId: 'ville-de-recette' };
  mockActualites = [];
  mockClubs = { data: CLUBS, isLoading: false };
  [mockPublier, mockModifier, mockRecipients].forEach((fn) => fn.mockReset());
});

describe('T3-ACTU-CIBLE — une 4e pastille, les 3 autres ne bougent pas', () => {
  it('rien ne se déplie tant qu’elle n’est pas choisie', async () => {
    const arbre = await monter();
    ['membres', 'dirigeants', 'installation', 'clubs'].forEach((valeur) => {
      expect(parTestID(arbre, `actualite-form-pour-${valeur}`)).toBeTruthy();
    });
    expect(textes(arbre)).toContain('Des clubs précis');
    expect(parTestID(arbre, 'actualite-form-clubs')).toBeUndefined();
    await appuyer(arbre, 'actualite-form-pour-clubs');
    expect(parTestID(arbre, 'actualite-form-clubs')).toBeTruthy();
    await appuyer(arbre, 'actualite-form-pour-membres');
    expect(parTestID(arbre, 'actualite-form-clubs')).toBeUndefined();
  });
});

describe('T3-ACTU-CIBLE — le tri par sport', () => {
  it('ne garde que les clubs du sport, omnisports compris, sans décocher les autres', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'actualite-form-pour-clubs');
    await appuyer(arbre, 'actualite-form-club-c-foot');
    expect(coche(arbre, 'c-foot')).toBe(true);

    await appuyerPastille(arbre, 'Tennis');
    expect(parTestID(arbre, 'actualite-form-club-c-foot')).toBeUndefined();
    expect(parTestID(arbre, 'actualite-form-club-c-omni')).toBeTruthy();
    expect(parTestID(arbre, 'actualite-form-club-c-tennis')).toBeTruthy();

    await appuyerPastille(arbre, 'Tous les sports');
    expect(coche(arbre, 'c-foot')).toBe(true);
  });

  it('un serveur qui ne rend pas les sports : pas de tri, la liste reste', async () => {
    mockClubs = { data: [{ documentId: 'c-foot', name: 'AS Foot' }], isLoading: false };
    const arbre = await monter();
    await appuyer(arbre, 'actualite-form-pour-clubs');
    expect(pastille(arbre, 'Tous les sports')).toBeUndefined();
    expect(parTestID(arbre, 'actualite-form-club-c-foot')).toBeTruthy();
  });
});

describe('T3-ACTU-CIBLE — « Tout cocher »', () => {
  it('coche ce qui est affiché, puis le décoche, sans toucher au reste', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'actualite-form-pour-clubs');
    await appuyer(arbre, 'actualite-form-club-c-foot');
    await appuyerPastille(arbre, 'Tennis');
    await appuyer(arbre, 'actualite-form-tout-cocher');
    expect(coche(arbre, 'c-omni')).toBe(true);
    expect(coche(arbre, 'c-tennis')).toBe(true);
    await appuyer(arbre, 'actualite-form-tout-cocher');
    expect(coche(arbre, 'c-omni')).toBe(false);
    expect(coche(arbre, 'c-tennis')).toBe(false);
    await appuyerPastille(arbre, 'Tous les sports');
    expect(coche(arbre, 'c-foot')).toBe(true);
  });
});

describe('T3-ACTU-CIBLE — publier', () => {
  it('sans club : le dit et n’envoie rien', async () => {
    const arbre = await monter();
    await ecrireLeTitre(arbre);
    await appuyer(arbre, 'actualite-form-pour-clubs');
    await appuyer(arbre, 'actualite-form-publier');
    expect(mockPublier).not.toHaveBeenCalled();
    expect(textes(arbre)).toContain('Cochez au moins un club.');
  });

  it('sans rôle : le dit et n’envoie rien', async () => {
    const arbre = await monter();
    await ecrireLeTitre(arbre);
    await appuyer(arbre, 'actualite-form-pour-clubs');
    await appuyer(arbre, 'actualite-form-club-c-foot');
    await appuyerPastille(arbre, 'Dirigeants');
    await appuyerPastille(arbre, 'Entraîneurs');
    await appuyerPastille(arbre, 'Joueurs et parents');
    await appuyer(arbre, 'actualite-form-publier');
    expect(mockPublier).not.toHaveBeenCalled();
    expect(textes(arbre)).toContain('Cochez au moins un rôle.');
  });

  it('envoie la liste et les rôles cochés ; les trois rôles sont cochés d’office', async () => {
    const arbre = await monter();
    await ecrireLeTitre(arbre);
    await appuyer(arbre, 'actualite-form-pour-clubs');
    await appuyer(arbre, 'actualite-form-club-c-foot');
    await appuyer(arbre, 'actualite-form-club-c-tennis');
    await appuyerPastille(arbre, 'Joueurs et parents');
    await appuyer(arbre, 'actualite-form-publier');
    expect(mockPublier).toHaveBeenCalledTimes(1);
    expect(mockPublier.mock.calls[0][0]).toMatchObject({
      audience: 'clubs',
      clubIds: ['c-foot', 'c-tennis'],
      roles: ['dirigeants', 'entraineurs'],
    });
  });
});

describe('T3-ACTU-CIBLE — le nombre avant l’envoi', () => {
  it('le pied suit la sélection : rien coché, puis le nombre lu sur le serveur', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'actualite-form-pour-clubs');
    expect(pied(arbre)).toBe('Cochez les clubs qui la recevront.');
    await appuyer(arbre, 'actualite-form-club-c-foot');
    expect(pied(arbre)).toMatch(/^Reçue par environ 42 personnes dans 1 club\. /);
    expect(mockRecipients).toHaveBeenLastCalledWith(expect.objectContaining({
      audience: 'clubs', clubIds: ['c-foot'], roles: ['dirigeants', 'entraineurs', 'membres'],
    }));
    await appuyerPastille(arbre, 'Joueurs et parents');
    expect(pied(arbre)).toMatch(/^Reçue par 42 personnes dans 1 club\. /);
  });
});

describe('T3-ACTU-CIBLE — « Modifier »', () => {
  it('reprend les clubs et les rôles de l’actualité, et les renvoie', async () => {
    mockParams = { actualiteId: 'a1', collectiviteId: 'ville-de-recette' };
    mockActualites = [{
      attachments: [],
      audience: 'clubs',
      audienceClubIds: ['c-tennis'],
      audienceRoles: ['dirigeants'],
      category: 'autre',
      documentId: 'a1',
      title: 'Réunion',
    }];
    const arbre = await monter();
    expect(coche(arbre, 'c-tennis')).toBe(true);
    expect(coche(arbre, 'c-foot')).toBe(false);
    await appuyer(arbre, 'actualite-form-publier');
    expect(mockModifier).toHaveBeenCalledTimes(1);
    expect(mockModifier.mock.calls[0][0].data).toMatchObject({
      audience: 'clubs', clubIds: ['c-tennis'], roles: ['dirigeants'],
    });
  });
});

describe('T3-ACTU-CIBLE — les clubs ne se lisent pas', () => {
  it('une erreur le dit, aucun rattaché le dit aussi', async () => {
    mockClubs = { data: undefined, isError: true, isLoading: false };
    const arbre = await monter();
    await appuyer(arbre, 'actualite-form-pour-clubs');
    expect(textes(arbre)).toContain('Les clubs n’ont pas pu être lus.');
    mockClubs = { data: [], isLoading: false };
    const vide = await monter();
    await appuyer(vide, 'actualite-form-pour-clubs');
    expect(textes(vide)).toContain('Aucun club n’est rattaché à votre collectivité.');
  });
});
