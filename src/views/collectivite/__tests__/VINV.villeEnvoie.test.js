/* eslint-disable max-len -- les phrases de l'écran sont citées en entier */
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import CollectiviteClubs from '../CollectiviteClubs';
import CollectiviteInviteClub from '../CollectiviteInviteClub';

// 🏛️ VILLE-INVITER-CLUB (07/10/2026), côté MAIRIE — le besoin d'Adel : « je sélectionne le club,
// je l'ajoute à la collectivité, et ça lui envoie une demande pour rejoindre la collectivité ».
// Décisions d'Adel : « club A » (le club accepte : rattaché tout de suite), « lien A » (la Ville
// accepte ou refuse les demandes venues de son lien).
//
// Ce que ce témoin fige (ROUGE avant le lot : la Ville ne pouvait inviter qu'un club ABSENT) :
//   E1 — « Ajouter un club » ouvre la recherche « Déjà sur FoundClub », la commune d'abord ;
//   E2 — un club qui a un dirigeant : « Envoyer la demande » part vers CE club ;
//   E3 — un club sans dirigeant : on le dit, et « Inviter par le lien » ouvre le lien de la Ville ;
//   E4 — chaque autre état a son mot ; le club qui a déjà demandé : « Accepter sa demande » ;
//   E5 — « Demandes de rattachement » : Accepter / Refuser (avec confirmation) celles venues du
//        lien, Relancer / Annuler celles que la Ville a envoyées ; « Invitations » ne garde que
//        les invitations « Par FoundClub ».

// Un ecran entier monte sous charge (suite complete, PC occupe) : le premier cas qui monte le
// champ de saisie paie le chargement des modules et depassait les 5 s par defaut (COLL-CONSOLE).
jest.setTimeout(30000);

/** @type {any} */
let mockRoute;
/** @type {any} */
let mockRecherche;
/** @type {any} */
let mockDemandes;
/** @type {any} */
let mockInvitations;
const mockNavigate = jest.fn();
const mockRechercheAppels = jest.fn();
const mockProposer = {
  error: null, isPending: false, mutate: jest.fn(), variables: null,
};
const mockRelancer = {
  error: null, isPending: false, mutate: jest.fn(), variables: null,
};
const mockAnnuler = {
  error: null, isPending: false, mutate: jest.fn(), variables: null,
};
const mockRepondre = {
  error: null, isPending: false, mutate: jest.fn(), variables: null,
};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => mockRoute,
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
  useCollectiviteClubs: () => ({
    data: [], error: null, isLoading: false, refetch: jest.fn(),
  }),
  useCollectiviteInvitationLink: () => ({ data: { token: 'CodeDeLaVille0123456789ab' }, error: null }),
  useCollectiviteInvitations: () => mockInvitations,
  useInviteClubByFoundClub: () => ({ error: null, isPending: false, mutate: jest.fn() }),
  useMyCollectivites: () => ({
    data: [{ documentId: 'ville-de-recette', name: 'Ville de Montrivage' }],
    isLoading: false,
  }),
  useRemindCollectiviteInvitation: () => ({ isPending: false, mutate: jest.fn(), variables: null }),
  useRotateCollectiviteInvitationLink: () => ({ error: null, isPending: false, mutate: jest.fn() }),
}));

jest.mock('@/services/collectivite/collectiviteRattachementQueries', () => ({
  useAnswerCollectiviteAttachRequest: () => mockRepondre,
  useCancelCollectiviteProposal: () => mockAnnuler,
  useCollectiviteClubRequests: () => mockDemandes,
  useCollectiviteClubSearch: (/** @type {any} */ collectiviteId, /** @type {any} */ q) => {
    mockRechercheAppels(collectiviteId, q);
    return mockRecherche;
  },
  useProposeCollectiviteClub: () => mockProposer,
  useRemindCollectiviteProposal: () => mockRelancer,
}));

jest.mock('@/utils/shareLinks', () => ({
  buildPublicWebUrl: ({ path }) => `https://foundclub.example.invalid${path}`,
}));
const mockShare = jest.fn();
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

// Un arbre (`.root`) ou un de ses noeuds : la meme lecture.
const racine = (/** @type {any} */ x) => x.root || x;

const textes = (/** @type {any} */ arbre) => racine(arbre).findAllByType(Text)
  .map((/** @type {any} */ n) => aplatirTexte(n.props.children).trim());

const boutons = (/** @type {any} */ arbre, /** @type {string} */ titre) => racine(arbre).findAll(
  (/** @type {any} */ n) => n.props?.title === titre && typeof n.props?.onPress === 'function',
);

const dans = (/** @type {any} */ arbre, /** @type {string} */ testID) => racine(arbre).findAll(
  (/** @type {any} */ n) => n.props?.testID === testID,
)[0];

const ligne = (/** @type {Record<string, unknown>} */ champs) => ({
  attached: false,
  attachedElsewhere: false,
  cityName: 'Montrivage',
  hasLeader: true,
  inCommune: true,
  logo: null,
  postcode: '13000',
  proposal: null,
  request: null,
  ...champs,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockRoute = { params: { collectiviteId: 'ville-de-recette', onglet: 'recherche' } };
  mockRecherche = {
    data: [
      ligne({ documentId: 'judo-e', name: 'Judo Club E' }),
      ligne({ documentId: 'tennis-f', hasLeader: false, name: 'Tennis Club F' }),
      ligne({ attached: true, documentId: 'as-a', name: 'AS Montrivage' }),
      ligne({ attachedElsewhere: true, documentId: 'voisin-c', name: 'FC Voisin' }),
      ligne({ documentId: 'basket-g', name: 'Basket G', proposal: { documentId: 'p9', state: 'pending' } }),
      ligne({ documentId: 'hand-h', name: 'Hand H', proposal: { documentId: 'p8', state: 'refused' } }),
      ligne({
        documentId: 'stripe-d', inCommune: false, name: 'Recette Stripe FC', request: { documentId: 'r1', state: 'pending' },
      }),
    ],
    error: null,
    isLoading: false,
    refetch: jest.fn(),
  };
  mockDemandes = { data: [], error: null, isLoading: false };
  mockInvitations = { data: [] };
});

describe('VINV · côté mairie — chercher un club déjà sur FoundClub et lui envoyer la demande', () => {
  it('E1 « Ajouter un club » ouvre la recherche ; sans texte, la commune d’abord', async () => {
    const arbre = await monter(CollectiviteInviteClub);
    expect(textes(arbre)).toEqual(expect.arrayContaining([
      'Ajouter un club déjà sur FoundClub',
      'Sans texte : les clubs de votre commune.',
    ]));
    expect(mockRechercheAppels).toHaveBeenCalledWith('ville-de-recette', '');
    const onglets = arbre.root.findAll(
      (/** @type {any} */ n) => Array.isArray(n.props?.options) && typeof n.props?.onChange === 'function',
    )[0];
    expect(onglets.props.value).toBe('recherche');
    expect(onglets.props.options.map((/** @type {any} */ o) => o.value)).toEqual(['recherche', 'lien', 'foundclub']);

    mockRoute = { params: { collectiviteId: 'ville-de-recette' } };
    const avant = await monter(CollectiviteClubs);
    await act(async () => { boutons(avant, 'Ajouter un club')[0].props.onPress(); });
    expect(mockNavigate).toHaveBeenCalledWith('CollectiviteInviteClub', {
      collectiviteId: 'ville-de-recette',
      onglet: 'recherche',
    });
  });

  it('E2 un club qui a un dirigeant : « Envoyer la demande » part vers CE club', async () => {
    const arbre = await monter(CollectiviteInviteClub);
    const carte = dans(arbre, 'ajouter-club-judo-e');
    expect(textes(carte)).toEqual(expect.arrayContaining(['Judo Club E', 'Un dirigeant est sur FoundClub']));
    const envoyer = boutons(carte, 'Envoyer la demande');
    expect(envoyer).toHaveLength(1);
    await act(async () => { envoyer[0].props.onPress(); });
    expect(mockProposer.mutate).toHaveBeenCalledWith(
      { clubId: 'judo-e', collectiviteId: 'ville-de-recette' },
      expect.any(Object),
    );
    expect(boutons(arbre, 'Envoyer la demande')).toHaveLength(1);
  });

  it('E3 un club sans dirigeant : personne ne pourrait accepter ; « Inviter par le lien » ouvre le lien de la Ville', async () => {
    const arbre = await monter(CollectiviteInviteClub);
    const carte = dans(arbre, 'ajouter-club-tennis-f');
    expect(textes(carte)).toContain('Aucun dirigeant sur FoundClub : personne ne pourrait accepter. Invitez-le par le lien.');
    expect(boutons(carte, 'Envoyer la demande')).toHaveLength(0);
    await act(async () => { boutons(carte, 'Inviter par le lien')[0].props.onPress(); });
    expect(textes(arbre)).toContain('https://foundclub.example.invalid/invitation-ville/CodeDeLaVille0123456789ab');
  });

  it('E4 rattaché, ailleurs, envoyée, refusée ; le club qui a déjà demandé : « Accepter sa demande »', async () => {
    const arbre = await monter(CollectiviteInviteClub);
    expect(textes(dans(arbre, 'ajouter-club-as-a'))).toContain('Déjà rattaché à la Ville');
    expect(textes(dans(arbre, 'ajouter-club-voisin-c'))).toContain('Rattaché à une autre collectivité');
    expect(textes(dans(arbre, 'ajouter-club-basket-g'))).toContain('Demande envoyée');
    const refuse = dans(arbre, 'ajouter-club-hand-h');
    expect(textes(refuse)).toContain('Le club a refusé votre demande');
    // « refus B » (Adel, 07/10 ~18h05) : la Ville peut renvoyer sa demande.
    await act(async () => { boutons(refuse, 'Renvoyer la demande')[0].props.onPress(); });
    expect(mockProposer.mutate).toHaveBeenCalledWith(
      { clubId: 'hand-h', collectiviteId: 'ville-de-recette' },
      expect.any(Object),
    );
    const stripe = dans(arbre, 'ajouter-club-stripe-d');
    expect(textes(stripe)).toEqual(expect.arrayContaining(['Ce club demande déjà à vous rejoindre', 'Hors de la commune']));
    await act(async () => { boutons(stripe, 'Accepter sa demande')[0].props.onPress(); });
    expect(mockRepondre.mutate).toHaveBeenCalledWith(
      { accept: true, collectiviteId: 'ville-de-recette', invitationId: 'r1' },
      expect.any(Object),
    );
  });
});

describe('VINV · côté mairie — T18 : le lien de la Ville, ses deux phrases', () => {
  it('E6 le texte partagé commence par sa majuscule ; l’écran dit que la Ville accepte (« lien A »)', async () => {
    mockRoute = { params: { collectiviteId: 'ville-de-recette' } };
    const arbre = await monter(CollectiviteInviteClub);
    const lus = textes(arbre);
    expect(lus).toContain('Un club n’est pas encore sur FoundClub ? Envoyez-lui le lien de la Ville de Montrivage : il inscrit son club et demande à vous rejoindre ; vous acceptez sa demande dans vos clubs.');
    expect(lus.some((texte) => texte.includes('l’équipe FoundClub le rattache'))).toBe(false);
    await act(async () => { await boutons(arbre, 'Partager…')[0].props.onPress(); });
    expect(mockShare).toHaveBeenCalledWith(expect.objectContaining({
      message: 'La Ville de Montrivage vous invite à inscrire votre club sur FoundClub : https://foundclub.example.invalid/invitation-ville/CodeDeLaVille0123456789ab',
    }));
  });
});

describe('VINV · côté mairie — « Demandes de rattachement » dans « Clubs rattachés »', () => {
  beforeEach(() => {
    mockRoute = { params: { collectiviteId: 'ville-de-recette' } };
    mockDemandes = {
      data: [
        {
          attachedElsewhere: false, canAnswer: true, canCancel: false, canRemind: false, club: { documentId: 'stripe-d', name: 'Recette Stripe FC' }, createdAt: '2026-10-07T11:51:00.000Z', documentId: 'r1', kind: 'attach_request', outsideCommune: true, remindCount: 0, state: 'pending',
        },
        {
          attachedElsewhere: false, canAnswer: false, canCancel: true, canRemind: true, club: { documentId: 'judo-e', name: 'Judo Club E' }, createdAt: '2026-10-05T08:00:00.000Z', documentId: 'p1', kind: 'proposal', remindCount: 1, state: 'pending',
        },
        {
          attachedElsewhere: false, canAnswer: false, canCancel: false, canRemind: false, club: { documentId: 'hand-h', name: 'Hand H' }, createdAt: '2026-10-01T08:00:00.000Z', documentId: 'p2', kind: 'proposal', remindCount: 0, state: 'refused',
        },
      ],
      error: null,
      isLoading: false,
    };
    mockInvitations = {
      data: [
        {
          clubName: 'Judo Club', createdAt: '2026-10-01T08:00:00.000Z', documentId: 'i1', kind: 'foundclub', remindCount: 0, status: 'sent',
        },
        {
          clubName: 'Recette Stripe FC', createdAt: '2026-10-07T11:51:00.000Z', documentId: 'r1', kind: 'attach_request', outsideCommune: true, remindCount: 0, status: 'registered',
        },
      ],
    };
  });

  it('E5 la demande venue du lien : Accepter, ou Refuser après confirmation', async () => {
    const arbre = await monter(CollectiviteClubs);
    expect(textes(arbre)).toContain('Demandes de rattachement');
    const demande = dans(arbre, 'demande-rattachement-r1');
    expect(textes(demande)).toEqual(expect.arrayContaining([
      'Recette Stripe FC', 'À traiter', 'Le club demande à rejoindre la Ville. Il n’est pas dans la commune.',
    ]));
    await act(async () => { boutons(demande, 'Accepter')[0].props.onPress(); });
    expect(mockRepondre.mutate).toHaveBeenCalledWith(
      { accept: true, collectiviteId: 'ville-de-recette', invitationId: 'r1' },
      expect.any(Object),
    );
    await act(async () => { boutons(demande, 'Refuser')[0].props.onPress(); });
    expect(mockRepondre.mutate).toHaveBeenCalledTimes(1);
    expect(textes(arbre)).toContain('Refuser la demande de Recette Stripe FC ?');
    await act(async () => { boutons(arbre, 'Oui, refuser')[0].props.onPress(); });
    expect(mockRepondre.mutate).toHaveBeenLastCalledWith(
      { accept: false, collectiviteId: 'ville-de-recette', invitationId: 'r1' },
      expect.any(Object),
    );
  });

  it('E5 la demande de la Ville : Relancer, Annuler ; refusée, plus rien à faire ; « Invitations » ne garde que « Par FoundClub »', async () => {
    const arbre = await monter(CollectiviteClubs);
    const envoyee = dans(arbre, 'demande-rattachement-p1');
    expect(textes(envoyee)).toEqual(expect.arrayContaining([
      'Judo Club E', 'En attente', 'Envoyée au club : ses dirigeants acceptent ou refusent.', 'Relancée 1 fois.',
    ]));
    await act(async () => { boutons(envoyee, 'Relancer')[0].props.onPress(); });
    expect(mockRelancer.mutate).toHaveBeenCalledWith(
      { collectiviteId: 'ville-de-recette', invitationId: 'p1' },
      expect.any(Object),
    );
    await act(async () => { boutons(envoyee, 'Annuler la demande')[0].props.onPress(); });
    expect(mockAnnuler.mutate).toHaveBeenCalledWith(
      { collectiviteId: 'ville-de-recette', invitationId: 'p1' },
      expect.any(Object),
    );
    const refusee = dans(arbre, 'demande-rattachement-p2');
    expect(textes(refusee)).toEqual(expect.arrayContaining(['Refusée', 'Le club a refusé votre demande.']));
    // « refus B » (Adel, 07/10 ~18h05) : « Renvoyer la demande », et rien d'autre.
    expect(refusee.findAll((/** @type {any} */ n) => typeof n.props?.title === 'string' && typeof n.props?.onPress === 'function')
      .map((/** @type {any} */ n) => n.props.title)).toEqual(['Renvoyer la demande']);
    await act(async () => { boutons(refusee, 'Renvoyer la demande')[0].props.onPress(); });
    expect(mockProposer.mutate).toHaveBeenCalledWith(
      { clubId: 'hand-h', collectiviteId: 'ville-de-recette' },
      expect.any(Object),
    );

    expect(dans(arbre, 'collectivite-invitation-i1')).toBeTruthy();
    expect(dans(arbre, 'collectivite-invitation-r1')).toBeUndefined();
  });
});
