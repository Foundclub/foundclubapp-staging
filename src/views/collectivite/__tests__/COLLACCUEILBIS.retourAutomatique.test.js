/* eslint-disable max-len -- les phrases de l'écran sont citées en entier */
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import CollectiviteJoin from '../CollectiviteJoin';
import CollectiviteJoinRequest from '../CollectiviteJoinRequest';

// 🏛️ COLL-ACCUEIL-BIS (03/10/2026) — PLANCHE 38 (P7v3-inviter, écran 5), LE RETOUR AUTOMATIQUE,
// côté club. Avant le lot, « Inscrire mon club » ouvrait la création d'un club SANS le lien de la
// Ville : la demande de rattachement ne partait jamais, et le club devait « rouvrir le lien ».
// Ce que ce fichier exige (ROUGE avant le lot) :
//   1. toucher « Inscrire mon club » RETIENT le lien de la Ville (connecté ou non : il survit au
//      détour par la connexion), puis ouvre la création du club ;
//   2. le bouton du même nom sur « Rejoindre la Ville » (aucun club dirigé) aussi, et sa phrase ne
//      dit plus de « rouvrir le lien » : la demande partira toute seule ;
//   3. revenu de la création, « Demande envoyée » s'affiche tout de suite (paramètre `resultat`),
//      et « Aller à mon club » ouvre le club créé.

/** @type {any} */
let mockApercu;
/** @type {any} */
let mockMesClubs;
/** @type {any} */
let mockUtilisateur;
/** @type {any} */
let mockParams;
const mockNavigate = jest.fn();
const mockOuvrirConnexion = jest.fn();
const mockDemander = { error: null, isPending: false, mutate: jest.fn() };
const mockRangement = new Map();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
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
      Images: {},
      Spaces: espaces,
    }),
  };
});

jest.mock('@/platform/storage', () => ({
  getItem: (/** @type {string} */ cle) => mockRangement.get(cle),
  removeItem: (/** @type {string} */ cle) => { mockRangement.delete(cle); },
  setItem: (/** @type {string} */ cle, /** @type {string} */ valeur) => {
    mockRangement.set(cle, valeur);
  },
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: mockUtilisateur }),
}));

jest.mock('@/navigation/public/publicAuthNavigation', () => ({
  openPublicAuthFlow: (/** @type {any} */ navigation) => mockOuvrirConnexion(navigation),
}));

jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useCollectiviteInvitationPreview: () => mockApercu,
  useMyClubsForCollectiviteInvitation: () => mockMesClubs,
  useRequestCollectiviteAttach: () => mockDemander,
}));

jest.mock('@/utils/facilityTypes', () => ({
  getFacilityTypeLabel: (/** @type {string} */ type) => type,
}));

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);
jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() { return null; });
jest.mock(
  '@/components/molecules/clubLogoMark/ClubLogoMark',
  () => function ClubLogoMarkMock() { return null; },
);

const LIEN = 'CodeDeLaVille0123456789ab';
const APERCU = {
  collectivite: { name: 'Ville de Montrivage', type: 'commune' },
  installations: [{
    address: null, maxSlots: 1, name: 'Dojo municipal', type: 'Dojo',
  }],
};

/**
 * Aplati les enfants React en une chaine.
 * @param {any} enfants
 * @returns {string}
 */
const aplatirTexte = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};

const monter = async (/** @type {any} */ Ecran) => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<Ecran />);
  });
  return arbre;
};

const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ n) => aplatirTexte(n.props.children).trim());

const bouton = (/** @type {any} */ arbre, /** @type {string} */ titre) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props?.title === titre && typeof n.props?.onPress === 'function',
)[0];

const lienRetenu = () => JSON.parse(mockRangement.get('coll-invitation-ville') || 'null')?.token || null;

beforeEach(() => {
  jest.clearAllMocks();
  mockRangement.clear();
  mockParams = { token: LIEN };
  mockApercu = { data: APERCU, error: null, isLoading: false };
  mockMesClubs = { data: [], error: null, isLoading: false };
  mockUtilisateur = null;
});

describe('COLL-ACCUEIL-BIS — planche 38 : « Inscrire mon club » garde le lien de la Ville', () => {
  it('connecté : le lien est RETENU, puis la création du club s ouvre', async () => {
    mockUtilisateur = { documentId: 'karim' };
    const arbre = await monter(CollectiviteJoin);
    await act(async () => { bouton(arbre, 'Inscrire mon club').props.onPress(); });
    expect(lienRetenu()).toBe(LIEN);
    expect(mockNavigate).toHaveBeenCalledWith('ClubStack', expect.objectContaining({ screen: 'ClubWizardName' }));
  });

  it('sans compte : le lien est retenu AVANT le détour par la connexion', async () => {
    const arbre = await monter(CollectiviteJoin);
    await act(async () => { bouton(arbre, 'Inscrire mon club').props.onPress(); });
    expect(lienRetenu()).toBe(LIEN);
    expect(mockOuvrirConnexion).toHaveBeenCalled();
  });

  it('« Rejoindre la Ville » sans club dirigé : le bouton retient aussi le lien, et la phrase ne dit plus de rouvrir le lien', async () => {
    mockUtilisateur = { documentId: 'karim' };
    const arbre = await monter(CollectiviteJoinRequest);
    const lus = textes(arbre);
    expect(lus).toContain('Tu ne diriges aucun club sur FoundClub. Inscris ton club : sa demande de rattachement partira toute seule.');
    expect(lus.join(' ')).not.toContain('rouvre le lien');
    await act(async () => { bouton(arbre, 'Inscrire mon club').props.onPress(); });
    expect(lienRetenu()).toBe(LIEN);
    expect(mockNavigate).toHaveBeenCalledWith('ClubStack', expect.objectContaining({ screen: 'ClubWizardName' }));
  });
});

describe('COLL-ACCUEIL-BIS — planche 38 : revenu de la création, « Demande envoyée » tout de suite', () => {
  it('le résultat de la création s affiche, et « Aller à mon club » ouvre le club créé', async () => {
    mockUtilisateur = { documentId: 'karim' };
    mockParams = {
      resultat: { clubId: 'club-neuf', outsideCommune: false, status: 'registered' },
      token: LIEN,
    };
    const arbre = await monter(CollectiviteJoinRequest);
    const lus = textes(arbre);
    expect(lus).toEqual(expect.arrayContaining([
      'Demande envoyée',
      'L’équipe FoundClub vérifie que ton club est bien à Montrivage, puis le rattache à la Ville. Tu seras prévenu.',
      'D’ici là, ton club fonctionne déjà normalement.',
    ]));
    await act(async () => { bouton(arbre, 'Aller à mon club').props.onPress(); });
    expect(mockNavigate).toHaveBeenCalledWith('Club', { clubId: 'club-neuf' });
  });
});

// LIENS-APP (07/10/2026, registre TEST_PROD_2_6_70 ligne 5a) — le lien de la Ville s'ouvre
// désormais DANS l'app. Sans compte, les deux boutons mènent à la connexion : ils posent un repère
// de RETOUR (useLiensEnAttente le lit après la connexion et rouvre cette page) ; la page,
// ouverte avec un compte, l'efface — on n'y revient qu'une fois. ROUGE avant le lot.
describe('LIENS-APP — sans compte, la connexion ramène à la page du lien', () => {
  const retourRetenu = () => JSON.parse(mockRangement.get('coll-invitation-ville-retour') || 'null')?.token || null;

  it.each([['Inscrire mon club'], ['Mon club est déjà sur FoundClub']])(
    'sans compte, « %s » pose le repère de retour, puis ouvre la connexion',
    async (titre) => {
      const arbre = await monter(CollectiviteJoin);
      await act(async () => { bouton(arbre, titre).props.onPress(); });
      expect(retourRetenu()).toBe(LIEN);
      expect(mockOuvrirConnexion).toHaveBeenCalled();
    },
  );

  it('connecté, la page du lien efface le repère : on n y revient qu une fois', async () => {
    mockRangement.set('coll-invitation-ville-retour', JSON.stringify({ at: Date.now(), token: LIEN }));
    mockUtilisateur = { documentId: 'karim' };
    await monter(CollectiviteJoin);
    expect(retourRetenu()).toBeNull();
  });
});
