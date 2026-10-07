import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import CollectiviteClubs from '../CollectiviteClubs';

// 🏛️ COLL-CLUBS (01/10) — PLANCHE 1 : la liste des clubs rattachés, restylée (design HY521H1,
// page 7, « P7-clubs-tel » et « P7-clubs-ordi » ; SPEC §2 G).
//
// Ce que ce témoin fige (ROUGE avant le lot) :
//   - TOUTE LA CARTE ouvre la fiche du club (avant : seule la ligne de contact se touchait) ;
//   - chaque carte nomme ses DIRIGEANTS (« Dirigeant : Karim Benali ») et dit ses séances de la
//     semaine sur les installations de la Ville ; un nombre illisible s'écrit « — » ;
//   - les quatre états du design : chargement (« Clubs rattachés : … »), erreur (« Les clubs
//     n'ont pas pu être lus. » + « Réessayer »), vide (qui rattache, et quoi faire), liste.
//   - aucune personne autre que les dirigeants : l'écran n'affiche que ce que le serveur rend
//     (témoin admin COLL-CLUBS K2).

/** @type {any} */
let mockClubs;
const mockInvitations = { data: [] };
const mockRelancer = { isPending: false, mutate: jest.fn(), variables: null };
const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
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

// VILLE-T18C (07/10) — l'ordinateur (le tableau), réglable par témoin ; le téléphone par défaut.
let mockBureau = false;
jest.mock('@/responsive', () => ({
  ...jest.requireActual('@/responsive'),
  useIsDesktop: () => mockBureau,
}));

jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useCollectiviteClubs: () => mockClubs,
  useCollectiviteInvitations: () => mockInvitations,
  useMyCollectivites: () => ({
    data: [{ documentId: 'ville-de-recette', name: 'Ville de Recette' }],
    isLoading: false,
  }),
  useRemindCollectiviteInvitation: () => mockRelancer,
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

const AS_MONTRIVAGE = {
  documentId: 'as-montrivage',
  email: null,
  leaders: [{ name: 'Karim Benali' }],
  logo: null,
  membersCount: 2,
  name: 'AS Montrivage',
  phoneNumber: null,
  sessionsThisWeek: { count: 2, facilities: ['Dojo municipal', 'Gymnase des Tilleuls'] },
  teamsCount: 2,
  websiteUrl: null,
};
const MONTRIVAGE_FC = {
  documentId: 'montrivage-fc',
  email: 'contact@foundclubpro.example.invalid',
  leaders: [{ name: 'Lea Martin' }, { name: 'Paul Morel' }],
  logo: null,
  membersCount: null,
  name: 'Montrivage FC',
  phoneNumber: null,
  sessionsThisWeek: null,
  teamsCount: 3,
  websiteUrl: null,
};
const MASQUE = {
  documentId: 'club-masque',
  email: null,
  leaders: null,
  logo: null,
  membersCount: 0,
  name: 'Club Masque',
  phoneNumber: null,
  sessionsThisWeek: { count: 0, facilities: [] },
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

const pressable = (/** @type {any} */ arbre, /** @type {string} */ testID) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props?.testID === testID && typeof n.props?.onPress === 'function',
)[0];

const parTestID = (/** @type {any} */ arbre, /** @type {string} */ testID) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props?.testID === testID,
)[0];

const boutonTitre = (/** @type {any} */ arbre, /** @type {string} */ titre) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props?.title === titre && typeof n.props?.onPress === 'function',
)[0];

beforeEach(() => {
  mockNavigate.mockClear();
  mockBureau = false;
  mockClubs = {
    data: [AS_MONTRIVAGE, MONTRIVAGE_FC, MASQUE], error: null, isLoading: false, refetch: jest.fn(),
  };
});

describe('COLL-CLUBS — planche 1 : la liste des clubs rattachés', () => {
  it('chaque carte nomme ses dirigeants et dit ses séances de la semaine', async () => {
    const lus = textes(await monter());
    expect(lus).toEqual(expect.arrayContaining([
      'Clubs rattachés : 3',
      'Dirigeant : Karim Benali',
      'Cette semaine : 2 séances · Dojo municipal, Gymnase des Tilleuls',
      'Dirigeants : Lea Martin, Paul Morel',
      'Cette semaine : —',
      'Équipes : 3 · Membres : —',
      'Cette semaine : aucune séance sur vos installations',
    ]));
  });

  it('un club qui masque ses membres : aucune ligne « Dirigeant »', async () => {
    const arbre = await monter();
    const carte = parTestID(arbre, 'collectivite-club-club-masque');
    const lus = carte.findAllByType(Text)
      .map((/** @type {any} */ n) => aplatirTexte(n.props.children));
    expect(lus.some((texte) => texte.startsWith('Dirigeant'))).toBe(false);
  });

  it('TOUTE la carte ouvre la fiche du club, avec la collectivité et le club', async () => {
    const arbre = await monter();
    const carte = pressable(arbre, 'collectivite-club-as-montrivage');
    expect(carte).toBeTruthy();
    expect(carte.type).toBe(TouchableOpacity);
    await act(async () => { carte.props.onPress(); });
    expect(mockNavigate).toHaveBeenCalledWith('CollectiviteClubDetails', {
      clubId: 'as-montrivage',
      collectiviteId: 'ville-de-recette',
    });
  });

  it('chargement : le titre écrit « … », jamais un 0', async () => {
    mockClubs = {
      data: undefined, error: null, isLoading: true, refetch: jest.fn(),
    };
    expect(textes(await monter())).toContain('Clubs rattachés : …');
  });

  it('erreur : le dire, avec le message du serveur, et « Réessayer » relit la liste', async () => {
    const refetch = jest.fn();
    mockClubs = {
      data: undefined, error: { message: 'Panne du serveur' }, isLoading: false, refetch,
    };
    const arbre = await monter();
    const lus = textes(arbre);
    expect(lus).toEqual(expect.arrayContaining([
      'Clubs rattachés',
      'Les clubs n’ont pas pu être lus.',
    ]));
    const reessayer = boutonTitre(arbre, 'Réessayer');
    await act(async () => { reessayer.props.onPress(); });
    expect(refetch).toHaveBeenCalled();
  });

  it('vide : qui rattache, et quoi faire', async () => {
    mockClubs = {
      data: [], error: null, isLoading: false, refetch: jest.fn(),
    };
    expect(textes(await monter())).toEqual(expect.arrayContaining([
      'Aucun club rattaché pour l’instant.',
      'L’équipe FoundClub rattache les clubs de la commune. Un club manque ? Invitez-le.',
    ]));
  });
});

// 🎨 VILLE-T18C (07/10) — ajout T18 du chef (19h25, SITE_G60) : dans le tableau du site, « Demander
// au club de compléter sa fiche » DÉBORDAIT de sa colonne (texte coupé, bord de la carte traversé).
// Planche 36 (P7-clubs-ordi) : « Demander de compléter » dans la colonne « Contact général ». Le
// bouton ne dépasse plus sa colonne. Au téléphone, le libellé entier reste. ROUGE avant.
describe('VILLE-T18C — tableau des clubs : « Demander de compléter » tient dans sa colonne', () => {
  it('ordinateur : le libellé de la planche, et le bouton borné à sa colonne', async () => {
    mockBureau = true;
    const arbre = await monter();
    expect(boutonTitre(arbre, 'Demander de compléter')).toBeDefined();
    expect(boutonTitre(arbre, 'Demander au club de compléter sa fiche')).toBeUndefined();
    const bouton = boutonTitre(arbre, 'Demander de compléter');
    // La boîte du bouton (EcrireAuxDirigeants) ne dépasse pas la colonne.
    const styleDe = (/** @type {any} */ noeud) => (
      Object.assign({}, ...[].concat(noeud?.props?.style))
    );
    let boite = bouton.parent;
    while (boite && !('alignSelf' in styleDe(boite))) boite = boite.parent;
    expect(styleDe(boite)).toEqual(expect.objectContaining({ maxWidth: '100%' }));
  });

  it('téléphone : le libellé entier', async () => {
    const arbre = await monter();
    expect(boutonTitre(arbre, 'Demander au club de compléter sa fiche')).toBeDefined();
  });
});
