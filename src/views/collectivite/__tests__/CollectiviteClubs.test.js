import { Linking, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import CollectiviteClubs from '../CollectiviteClubs';

// 🏛️ COLLECTIVITES 1c — ECRAN 5 : les clubs rattachés (SPEC §2 G, H ; D15).
//
// Ce que ce temoin fige (ROUGE avant l ecran 5 : l ecran n existait pas) :
//   - chaque club : son nom, son CONTACT GENERAL (e-mail, telephone, site du club, D15) et
//     des NOMBRES — equipes, membres ; un nombre illisible s affiche « — », jamais 0 ;
//   - toucher l e-mail ou le telephone ouvre la messagerie ou le telephone ;
//   - aucune personne : l ecran n affiche que ce que le serveur rend (le serveur, lui, ne
//     rend aucun membre : temoin admin COLL1C C12 et banc vrai moteur C1c).

/** @type {any} */
let mockClubs;

jest.mock('@react-navigation/native', () => ({
  // COLL-CLUBS (01/10) : toute la carte ouvre la fiche du club (temoin COLLCLUBS.liste).
  useNavigation: () => ({ navigate: jest.fn() }),
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

jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useCollectiviteClubs: () => mockClubs,
  // COLL-CLUBS (01/10) : les invitations en cours, sous la liste (temoin COLLCLUBS.inviter).
  useCollectiviteInvitations: () => ({ data: [] }),
  useMyCollectivites: () => ({
    data: [{ documentId: 'ville-de-recette', name: 'Ville de Recette' }],
    isLoading: false,
  }),
  useRemindCollectiviteInvitation: () => ({ mutate: jest.fn() }),
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

const AIKI = {
  documentId: 'aiki',
  email: 'contact@aiki.example.invalid',
  logo: null,
  membersCount: 14,
  name: 'AIKI',
  phoneNumber: '0102030405',
  teamsCount: 2,
  websiteUrl: 'https://aiki.example.invalid',
};
const TEST_FC = {
  documentId: 'test-fc',
  email: null,
  logo: null,
  membersCount: null,
  name: 'Test Fc',
  phoneNumber: null,
  teamsCount: 1,
  websiteUrl: null,
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

const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<CollectiviteClubs />);
  });
  return arbre;
};

const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ n) => aplatirTexte(n.props.children).trim());

beforeEach(() => {
  mockClubs = {
    data: [AIKI, TEST_FC], error: null, isLoading: false, refetch: jest.fn(),
  };
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('COLLECTIVITES 1c — écran 5 : les clubs rattachés', () => {
  it('chaque club : son nom, son contact général et des NOMBRES', async () => {
    const lus = textes(await monter());
    expect(lus).toEqual(expect.arrayContaining([
      'AIKI',
      'Équipes : 2 · Membres : 14',
      'contact@aiki.example.invalid',
      '0102030405',
      'https://aiki.example.invalid',
      'Test Fc',
      'Équipes : 1 · Membres : —',
      'Clubs rattachés : 2',
    ]));
  });

  it('un club sans contact le dit, sans rien inventer', async () => {
    const lus = textes(await monter());
    expect(lus).toContain('Pas de contact renseigné par le club.');
  });

  it('toucher l e-mail ouvre la messagerie, le téléphone ouvre le téléphone', async () => {
    const arbre = await monter();
    const pressable = (/** @type {string} */ testID) => arbre.root.findAll(
      (/** @type {any} */ n) => n.props?.testID === testID && typeof n.props?.onPress === 'function',
    )[0];
    await act(async () => { pressable('collectivite-club-aiki-email').props.onPress(); });
    await act(async () => { pressable('collectivite-club-aiki-phone').props.onPress(); });
    expect(Linking.openURL).toHaveBeenCalledWith('mailto:contact@aiki.example.invalid');
    expect(Linking.openURL).toHaveBeenCalledWith('tel:0102030405');
  });

  it('aucun club rattaché : l écran le dit', async () => {
    mockClubs = {
      data: [], error: null, isLoading: false, refetch: jest.fn(),
    };
    expect(textes(await monter())).toContain('Aucun club rattaché pour l’instant.');
  });
});
