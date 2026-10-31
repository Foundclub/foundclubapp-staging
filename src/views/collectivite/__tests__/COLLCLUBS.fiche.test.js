/* eslint-disable max-len -- donnees de test : les fixtures se lisent mieux sur une ligne */
import { Linking, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import CollectiviteClubDetails from '../CollectiviteClubDetails';

// 🏛️ COLL-CLUBS (01/10) — PLANCHE 2 : la fiche d'un club, côté mairie (design HY521H1, page 7,
// « P7v2-fiche-tel » et « P7v2-fiche-ordi » ; SPEC §2 G, D70).
//
// Ce que ce témoin fige (ROUGE avant le lot : l'écran n'existait pas) :
//   - les blocs, DANS L'ORDRE du design : Qui joindre · En nombres · Ses créneaux de la Ville ·
//     Ses demandes · Coordonnées du club · Nos partenaires · Utilisation · L'offre ;
//   - qui joindre = les dirigeants nommés ; un club qui masque ses membres le dit ;
//   - en nombres, et les NOMS d'équipes (jamais un nom de membre) ;
//   - ses demandes : celle à trancher, la saison en chiffres, « Voir ses demandes » ;
//   - les coordonnées du club avec « non renseigné », les partenaires ;
//   - l'offre : « offert par la Ville » et depuis quand, ou « son propre abonnement », et le
//     renvoi vers l'équipe FoundClub pour la changer (D70) ;
//   - « Ses créneaux de la Ville » est là, vide et nommé : il attend le lot C2a.

/** @type {any} */
let mockFiche;
const mockNavigate = jest.fn();

/** CORR-COLLECTIVITES 101 — « Détacher ce club ». */
const mockDetacher = jest.fn(async () => ({}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => ({ params: { clubId: 'as-montrivage', collectiviteId: 'ville-de-recette' } }),
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
  // COLL-C5 (03/10) : « Utilisation » lit la saison (temoin COLL-C5.utilisation).
  useCollectiviteChiffres: () => ({ data: null, error: null, isLoading: false }),
  useCollectiviteClub: () => mockFiche,
  useCollectiviteClubs: () => ({ data: [], isError: false, isLoading: false }),
  useCollectiviteInstallations: () => ({ data: [] }),
  useMyCollectivites: () => ({
    data: [{ documentId: 'ville-de-recette', name: 'Ville de Montrivage' }],
    isLoading: false,
  }),
  // CORR-COLLECTIVITES 101 : « Détacher ce club ».
  useDetachCollectiviteClub: () => ({ isPending: false, mutateAsync: mockDetacher }),
  useSetClubPlanningColor: () => ({ isPending: false, mutateAsync: jest.fn() }),
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
jest.mock(
  '@/components/atoms/sponsorLogoTile/SponsorLogoTile',
  () => function SponsorLogoTileMock() { return null; },
);
// COLL-C2B (02/10) : la fiche ouvre desormais « Attribuer un creneau a ce club » dans une
// feuille du bas (module natif, illisible par jest) avec le formulaire d attribution (service
// HTTP). Ce temoin ne l ouvre pas : on les double ; le geste est fige par
// CollectiviteClubDetails.COLL-C2B.creneaux.
jest.mock('@/components/molecules/bottomModal/BottomModal', () => function BottomModalMock() {
  return null;
});
jest.mock(
  '@/components/organisms/seasonSlot/SeasonSlotForm',
  () => function SeasonSlotFormMock() { return null; },
);

const AS_MONTRIVAGE = {
  address: '12 rue des Tilleuls, Montrivage',
  documentId: 'as-montrivage',
  email: null,
  leaders: [{ name: 'Karim Benali' }],
  logo: null,
  membersCount: 2,
  name: 'AS Montrivage',
  offer: { kind: 'collectivite', since: '2026-09-15T08:00:00.000Z' },
  phoneNumber: null,
  requests: {
    accepted: 1,
    pending: [{
      documentId: 'demande-u13',
      facility: { name: 'Gymnase des Tilleuls' },
      requestedEnd: '2026-10-01T17:30:00.000Z',
      requestedStart: '2026-10-01T16:00:00.000Z',
      team: { name: 'U13' },
    }],
    pendingCount: 1,
    refused: 1,
  },
  sessionsThisWeek: { count: 2, facilities: ['Gymnase des Tilleuls'] },
  sponsors: [],
  teams: [{ name: 'U13' }, { name: 'U15' }],
  teamsCount: 2,
  websiteUrl: null,
};
const MONTRIVAGE_FC = {
  ...AS_MONTRIVAGE,
  address: null,
  documentId: 'montrivage-fc',
  email: 'contact@foundclubpro.example.invalid',
  leaders: null,
  name: 'Montrivage FC',
  offer: { kind: 'own', since: null },
  requests: {
    accepted: 0, pending: [], pendingCount: 0, refused: 0,
  },
  sponsors: [{
    link: 'https://boulangerie.example.invalid',
    logo: { url: '/uploads/b.png' },
    title: 'Boulangerie Martin',
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

const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<CollectiviteClubDetails />);
  });
  return arbre;
};

const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ n) => aplatirTexte(n.props.children).trim());

const titresDesBlocs = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .filter((/** @type {any} */ n) => n.props.accessibilityRole === 'header')
  .map((/** @type {any} */ n) => aplatirTexte(n.props.children).trim());

const parTestID = (/** @type {any} */ arbre, /** @type {string} */ testID) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props?.testID === testID,
)[0];

const boutonTitre = (/** @type {any} */ arbre, /** @type {string} */ titre) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props?.title === titre && typeof n.props?.onPress === 'function',
)[0];

beforeEach(() => {
  mockNavigate.mockClear();
  mockFiche = {
    data: AS_MONTRIVAGE, error: null, isLoading: false, refetch: jest.fn(),
  };
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('COLL-CLUBS — planche 2 : la fiche d’un club, côté mairie', () => {
  it('les blocs, dans l’ordre du design', async () => {
    expect(titresDesBlocs(await monter())).toEqual([
      'AS Montrivage',
      'Qui joindre',
      'En nombres',
      'Ses créneaux de la Ville',
      'Ses demandes',
      'Coordonnées du club',
      'Nos partenaires',
      'Utilisation',
      'L’offre',
    ]);
  });

  it('qui joindre, en nombres, noms d’équipes, coordonnées avec « non renseigné »', async () => {
    const lus = textes(await monter());
    expect(lus).toEqual(expect.arrayContaining([
      'Club rattaché à la Ville de Montrivage',
      'Offert par la Ville',
      'Karim Benali · dirigeant',
      'L’entraîneur n’est pas listé : la Ville s’adresse aux dirigeants.',
      'Équipes : U13, U15. Aucun nom de membre.',
      '12 rue des Tilleuls, Montrivage',
      'non renseigné',
      'Aucun partenaire renseigné par le club.',
      'Les créneaux que la Ville attribue à ce club s’afficheront ici.',
    ]));
  });

  it('ses demandes : celle à trancher, la saison en chiffres, « Voir ses demandes »', async () => {
    const arbre = await monter();
    const lus = textes(arbre);
    expect(lus).toEqual(expect.arrayContaining([
      'À trancher',
      'Cette saison : 1 acceptée, 1 refusée.',
    ]));
    expect(lus.some((texte) => texte.startsWith('U13 · ')
      && texte.endsWith(' · Gymnase des Tilleuls'))).toBe(true);
    await act(async () => { parTestID(arbre, 'fiche-club-voir-demandes').props.onPress(); });
    expect(mockNavigate).toHaveBeenCalledWith('CollectiviteRequests', {
      collectiviteId: 'ville-de-recette',
    });
  });

  it('l’offre de la Ville : depuis quand, et le renvoi vers l’équipe FoundClub (D70)', async () => {
    const arbre = await monter();
    expect(textes(arbre)).toEqual(expect.arrayContaining([
      'Abonnement offert par la Ville de Montrivage.',
      // INVERSE PAR FINITIONS15 point 8 — planche P2-fiche, « Depuis le jeu. 1 oct. ».
      'Depuis le mar. 15 sept.',
      'Pour la changer, écrivez à l’équipe FoundClub.',
    ]));
    await act(async () => { parTestID(arbre, 'fiche-club-offre-contact').props.onPress(); });
    expect(Linking.openURL).toHaveBeenCalledWith('mailto:contact@foundclubpro.com');
  });

  it('un club qui paie lui-même : son propre abonnement, sans montant ; partenaires', async () => {
    mockFiche = {
      data: MONTRIVAGE_FC, error: null, isLoading: false, refetch: jest.fn(),
    };
    const lus = textes(await monter());
    expect(lus).toEqual(expect.arrayContaining([
      'Son propre abonnement',
      'Son propre abonnement.',
      'Boulangerie Martin',
      'Le club ne rend pas public le nom de ses dirigeants.',
      'Aucune demande en attente.',
      'Cette saison : 0 acceptée, 0 refusée.',
      'contact@foundclubpro.example.invalid',
    ]));
    expect(lus.some((texte) => /€|formule|tarif/i.test(texte))).toBe(false);
  });

  it('erreur : le dire, et « Réessayer » relit la fiche', async () => {
    const refetch = jest.fn();
    mockFiche = {
      data: undefined, error: { message: 'Panne' }, isLoading: false, refetch,
    };
    const arbre = await monter();
    expect(textes(arbre)).toContain('La fiche du club n’a pas pu être lue.');
    const reessayer = boutonTitre(arbre, 'Réessayer');
    await act(async () => { reessayer.props.onPress(); });
    expect(refetch).toHaveBeenCalled();
  });
});

// VILLE-T18C (07/10) — ajout T18 du chef (19h25, SITE_G63) : « Cette saison : 2 acceptées, 38
// refusées. » — une série refusée compte une fois par DATE (36 jeudis) ; l'écran « Chiffres » le
// dit (« Une demande « chaque semaine » compte une fois par date. »), la fiche non. Même règle,
// même phrase (même clef). ROUGE avant.
describe('VILLE-T18C — la fiche d’un club dit comment se comptent ses demandes', () => {
  it('sous « Cette saison », la même phrase que « Chiffres »', async () => {
    const lus = textes(await monter());
    const saison = lus.indexOf('Cette saison : 1 acceptée, 1 refusée.');
    expect(saison).toBeGreaterThan(-1);
    expect(lus[saison + 1])
      .toBe('Une demande « chaque semaine » compte une fois par date.');
  });
});

jest.mock(
  '@/components/atoms/skeletonLoader/SkeletonLoader',
  () => function SkeletonMock({ children }) { return children; },
);
jest.mock('@/context/AppFeedbackContext', () => ({
  useAppFeedback: () => ({ showBanner: jest.fn() }),
}));

// CORR-COLLECTIVITES 101 (31/10/2026, décision d'Adel A) — la Ville ne pouvait pas détacher un
// club,
// même sans dirigeant. « Détacher ce club », avec une confirmation qui dit ce qui s'arrête ; puis
// la
// liste des clubs.
describe('CORR-COLLECTIVITES 101 — « Détacher ce club »', () => {
  it('le bouton, la confirmation, puis le geste et le retour à la liste', async () => {
    mockDetacher.mockClear();
    const arbre = await monter();
    await act(async () => { boutonTitre(arbre, 'Détacher ce club').props.onPress(); });
    expect(textes(arbre).some((texte) => texte.startsWith('Détacher AS Montrivage ?'))).toBe(true);
    expect(mockDetacher).not.toHaveBeenCalled();
    await act(async () => { await boutonTitre(arbre, 'Oui, détacher').props.onPress(); });
    expect(mockDetacher).toHaveBeenCalledWith({ clubId: 'as-montrivage', collectiviteId: 'ville-de-recette' });
    expect(mockNavigate).toHaveBeenCalledWith('CollectiviteClubs', { collectiviteId: 'ville-de-recette' });
  });

  it('« Annuler » : rien n’est détaché', async () => {
    mockDetacher.mockClear();
    const arbre = await monter();
    await act(async () => { boutonTitre(arbre, 'Détacher ce club').props.onPress(); });
    await act(async () => { boutonTitre(arbre, 'Annuler').props.onPress(); });
    expect(mockDetacher).not.toHaveBeenCalled();
  });
});
