/* eslint-disable max-len -- les phrases de l'écran sont citées en entier */
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import CollectiviteClubs from '../CollectiviteClubs';
import CollectiviteInviteClub from '../CollectiviteInviteClub';

// 🏛️ COLL-CLUBS (01/10) — PLANCHE 3, côté MAIRIE : inviter un club absent (design HY521H1,
// page 7, « P7v3-inviter-tel » et « P7v3-inviter-ordi » ; D70).
//
// Ce que ce témoin fige (ROUGE avant le lot : l'écran n'existait pas, la liste n'invitait pas) :
//   - « Par un lien » : LE lien de la Ville (sa page publique sur le site), « Copier le lien »,
//     « Partager… », et « Changer le lien » qui demande confirmation avant d'agir ;
//   - « Par FoundClub » : le nom et le contact général du club, transmis à l'équipe FoundClub
//     (le serveur enregistre une demande, aucun e-mail) ; rien ne part tant qu'un champ est vide ;
//   - « Clubs rattachés » : « Inviter un club absent de FoundClub » ouvre cet écran, et SOUS la
//     liste, les invitations en cours avec leur état (Envoyée, Inscrit, Rattaché) et « Relancer ».

/** @type {any} */
let mockLien;
/** @type {any} */
let mockClubs;
/** @type {any} */
let mockInvitations;
const mockNavigate = jest.fn();
const mockChanger = { error: null, isPending: false, mutate: jest.fn() };
const mockInviter = { error: null, isPending: false, mutate: jest.fn() };
const mockRelancer = { isPending: false, mutate: jest.fn(), variables: null };
const mockShare = jest.fn();

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

// VILLE-INVITER-CLUB (07/10) : les demandes de rattachement vivent dans un module a part ;
// `data` absent = un serveur d'avant le lot : l'ecran garde « Invitations » comme avant.
// FINITIONS-VILLE (08/10) : « Refuser » une demande de rattachement ouvre la fenêtre des créneaux
// (DecisionCreneauModal), qui lit ces deux crochets ; sans doublure, le client réseau se charge.
jest.mock('@/services/facility/facilityQueries', () => ({
  useApproveFacilityOverrideRequest: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useRefuseFacilityOverrideRequest: () => ({ isPending: false, mutateAsync: jest.fn() }),
}));

jest.mock('@/services/collectivite/collectiviteRattachementQueries', () => ({
  useAnswerCollectiviteAttachRequest: () => ({ isPending: false, mutate: jest.fn() }),
  useCancelCollectiviteProposal: () => ({ isPending: false, mutate: jest.fn() }),
  useCollectiviteClubRequests: () => ({ data: undefined, error: null, isLoading: false }),
  useCollectiviteClubSearch: () => ({ data: [], error: null, isLoading: false }),
  useProposeCollectiviteClub: () => ({ isPending: false, mutate: jest.fn() }),
  useRemindCollectiviteProposal: () => ({ isPending: false, mutate: jest.fn() }),
}));

jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useCollectiviteClubs: () => mockClubs,
  useCollectiviteInvitationLink: () => mockLien,
  useCollectiviteInvitations: () => mockInvitations,
  useInviteClubByFoundClub: () => mockInviter,
  useMyCollectivites: () => ({
    data: [{ documentId: 'ville-de-recette', name: 'Ville de Montrivage' }],
    isLoading: false,
  }),
  useRemindCollectiviteInvitation: () => mockRelancer,
  useRotateCollectiviteInvitationLink: () => mockChanger,
}));

jest.mock('@/utils/shareLinks', () => ({
  buildPublicWebUrl: ({ path }) => `https://foundclub.example.invalid${path}`,
}));
jest.mock('@/platform/share', () => ({ share: (/** @type {any} */ payload) => mockShare(payload) }));

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);
jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() { return null; });
jest.mock(
  '@/components/molecules/segmentedControl/SegmentedControl',
  () => function SegmentedControlMock() { return null; },
);
jest.mock(
  '@/components/molecules/clubLogoMark/ClubLogoMark',
  () => function ClubLogoMarkMock() { return null; },
);

const LIEN = 'https://foundclub.example.invalid/invitation-ville/CodeDeLaVille0123456789ab';

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

const parTestID = (/** @type {any} */ arbre, /** @type {string} */ testID) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props?.testID === testID && typeof n.props?.onPress === 'function',
)[0];

const saisir = (/** @type {any} */ arbre, /** @type {string} */ testID, /** @type {string} */ texte) => {
  const champ = arbre.root.findAll(
    (/** @type {any} */ n) => n.props?.testID === testID && typeof n.props?.onChangeText === 'function',
  )[0];
  champ.props.onChangeText(texte);
};

beforeEach(() => {
  jest.clearAllMocks();
  mockLien = { data: { token: 'CodeDeLaVille0123456789ab' }, error: null, isLoading: false };
  mockClubs = {
    data: [], error: null, isLoading: false, refetch: jest.fn(),
  };
  mockInvitations = { data: [] };
  global.navigator.clipboard = { writeText: jest.fn().mockResolvedValue(undefined) };
});

describe('COLL-CLUBS — planche 3, côté mairie : inviter un club absent', () => {
  it('par un lien : le lien de la Ville, sa page publique sur le site', async () => {
    const lus = textes(await monter(CollectiviteInviteClub));
    expect(lus).toEqual(expect.arrayContaining([
      'Inviter un club absent de FoundClub',
      LIEN,
      'Le même lien sert à tous les clubs. Vous pouvez le changer à tout moment : l’ancien ne marche plus.',
    ]));
  });

  it('« Copier le lien » copie, « Partager… » partage le lien', async () => {
    const arbre = await monter(CollectiviteInviteClub);
    await act(async () => { await bouton(arbre, 'Copier le lien').props.onPress(); });
    expect(global.navigator.clipboard.writeText).toHaveBeenCalledWith(LIEN);
    expect(textes(arbre)).toContain('Lien copié.');
    await act(async () => { await bouton(arbre, 'Partager…').props.onPress(); });
    expect(mockShare).toHaveBeenCalledWith(expect.objectContaining({ url: LIEN }));
  });

  it('« Changer le lien » demande confirmation avant d’agir', async () => {
    const arbre = await monter(CollectiviteInviteClub);
    await act(async () => { parTestID(arbre, 'inviter-changer').props.onPress(); });
    expect(mockChanger.mutate).not.toHaveBeenCalled();
    expect(textes(arbre)).toContain(
      'Les clubs qui ont l’ancien lien ne pourront plus l’ouvrir. Changer quand même ?',
    );
    await act(async () => { bouton(arbre, 'Changer le lien').props.onPress(); });
    expect(mockChanger.mutate).toHaveBeenCalledWith(
      { collectiviteId: 'ville-de-recette' },
      expect.any(Object),
    );
  });

  it('par FoundClub : rien ne part tant qu’un champ est vide, puis la demande est transmise', async () => {
    const arbre = await monter(CollectiviteInviteClub);
    const onglets = arbre.root.findAll(
      (/** @type {any} */ n) => Array.isArray(n.props?.options) && typeof n.props?.onChange === 'function',
    )[0];
    await act(async () => { onglets.props.onChange('foundclub'); });
    expect(bouton(arbre, 'Transmettre à l’équipe FoundClub').props.disabled).toBe(true);
    await act(async () => {
      saisir(arbre, 'inviter-nom', ' Judo Club de Montrivage ');
      saisir(arbre, 'inviter-contact', 'contact@judo.example.invalid');
    });
    const transmettre = bouton(arbre, 'Transmettre à l’équipe FoundClub');
    expect(transmettre.props.disabled).toBe(false);
    await act(async () => { transmettre.props.onPress(); });
    expect(mockInviter.mutate).toHaveBeenCalledWith({
      clubContact: 'contact@judo.example.invalid',
      clubName: 'Judo Club de Montrivage',
      collectiviteId: 'ville-de-recette',
    }, expect.any(Object));
    expect(textes(arbre)).toContain('Le contact du club, pas celui d’une personne.');
  });

  // COLL-R-A6 (13/10, COL-001, planche P7v4-clubs, D1 A′) : UN seul bouton, « Ajouter un club » ; il
  // ouvre cet écran (onglet « Déjà sur FoundClub »), où « Par FoundClub » invite un club absent.
  it('« Clubs rattachés » : « Ajouter un club » ouvre cet écran, depuis l’état vide', async () => {
    const arbre = await monter(CollectiviteClubs);
    expect(bouton(arbre, 'Inviter un club')).toBeUndefined();
    await act(async () => { bouton(arbre, 'Ajouter un club').props.onPress(); });
    expect(mockNavigate).toHaveBeenCalledWith('CollectiviteInviteClub', {
      collectiviteId: 'ville-de-recette',
      onglet: 'recherche',
    });
  });

  it('sous la liste : les invitations en cours, leur état, et « Relancer » pour celle qui attend', async () => {
    mockClubs = {
      data: [{
        documentId: 'as', leaders: [], membersCount: 1, name: 'AS Montrivage', sessionsThisWeek: null, teamsCount: 1,
      }],
      error: null,
      isLoading: false,
      refetch: jest.fn(),
    };
    mockInvitations = {
      data: [
        {
          clubName: 'Judo Club', createdAt: '2026-10-01T08:00:00.000Z', documentId: 'i1', kind: 'foundclub', remindCount: 0, status: 'sent',
        },
        {
          clubName: 'Recette Stripe FC', createdAt: '2026-10-01T08:00:00.000Z', documentId: 'i2', kind: 'attach_request', outsideCommune: true, remindCount: 0, status: 'registered',
        },
        {
          clubName: 'Tennis Club', createdAt: '2026-09-20T08:00:00.000Z', documentId: 'i3', kind: 'attach_request', outsideCommune: false, remindCount: 0, status: 'attached',
        },
      ],
    };
    const arbre = await monter(CollectiviteClubs);
    const lus = textes(arbre);
    expect(lus).toEqual(expect.arrayContaining([
      'Invitations',
      // INVERSE PAR FINITIONS15 point 8 — la date comme les planches : « jeu. 1 oct. ».
      'Judo Club', 'Envoyée', 'Le jeu. 1 oct. · Transmise à l’équipe FoundClub · pas encore inscrit.',
      'Recette Stripe FC', 'Inscrit',
      'Le jeu. 1 oct. · Hors de la commune : l’équipe FoundClub vérifie avec vous avant de le rattacher.',
      'Tennis Club', 'Rattaché', 'Le dim. 20 sept. · Il apparaît dans vos clubs.',
    ]));
    const relancer = arbre.root.findAll(
      (/** @type {any} */ n) => n.props?.title === 'Relancer' && typeof n.props?.onPress === 'function',
    );
    expect(relancer).toHaveLength(1);
    await act(async () => { relancer[0].props.onPress(); });
    expect(mockRelancer.mutate).toHaveBeenCalledWith({ collectiviteId: 'ville-de-recette', invitationId: 'i1' });
    // COLL-R-A6 (13/10, D1 A′) : le bouton en pointillés « Inviter un club absent » a laissé la
    // place au seul « Ajouter un club » (au-dessus des clubs).
    expect(parTestID(arbre, 'collectivite-clubs-inviter')).toBeUndefined();
    await act(async () => { bouton(arbre, 'Ajouter un club').props.onPress(); });
    expect(mockNavigate).toHaveBeenCalledWith('CollectiviteInviteClub', {
      collectiviteId: 'ville-de-recette',
      onglet: 'recherche',
    });
  });
});
