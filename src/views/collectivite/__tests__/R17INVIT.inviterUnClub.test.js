/* eslint-disable max-len -- les phrases de l'écran sont citées en entier */
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import CollectiviteInviteClub from '../CollectiviteInviteClub';

// 🏛️ R17-INVITER (19/10/2026, REC17-009) — Adel, Test 17/10 : « pour inviter un club, on doit avoir
// la solution de base, beaucoup plus simple : on prend la recherche de club comme elle est de base
// sur l'app, et dès qu'on trouve le club on clique sur un bouton pour dire « ce club fait partie de
// ma collectivité », et ça lui envoie une demande ».
// Réglage du chef : un seul écran, la recherche habituelle (ClubListContent, mêmes filtres, même
// rendu) ; sur chaque club, « Ce club fait partie de ma collectivité » ; un club sans dirigeant :
// la demande est ENREGISTRÉE et attend son premier dirigeant (la Ville peut l'annuler, le lien
// reste proposé) ; plus d'onglets : « Par un lien » et « Par FoundClub » derrière un lien discret
// « Le club n'est pas sur FoundClub ? ».
//
// Ce que ce témoin exige (ROUGE avant le lot : trois onglets et une recherche dédiée) :
//   I1 — « Ajouter un club » ouvre la recherche habituelle, sans onglets ; la fiche d'un club s'y
//        ouvre avec la Ville (son bouton y est aussi) ;
//   I2 — « Le club n'est pas sur FoundClub ? » mène au lien et à « Par FoundClub » ; `onglet=lien`
//        et `onglet=foundclub` ouvrent toujours leurs formulaires ;
//   I3 — sur chaque carte, le bouton envoie la demande à CE club ;
//   I4 — chaque état a ses mots, dont « Demande enregistrée : elle attend le premier dirigeant du
//        club » (Annuler, et le lien en action secondaire) ;
//   I5 — les refus du serveur en mots ; le serveur d'aujourd'hui (club sans dirigeant refusé) ne
//        fait rien planter ;
//   I6 — pas gestionnaire de cette Ville (lecture refusée) : aucun bouton.

jest.setTimeout(30000);

/** @type {any} */
let mockRoute;
/** @type {any} */
let mockDemandes;
/** @type {any[]} */
let mockClubs;
/** @type {any} */
let mockListeProps;
const mockNavigate = jest.fn();
const mockProposer = {
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
  useCollectiviteInvitationLink: () => ({ data: { token: 'CodeDeLaVille0123456789ab' }, error: null }),
  useInviteClubByFoundClub: () => ({ error: null, isPending: false, mutate: jest.fn() }),
  useMyCollectivites: () => ({
    data: [{ documentId: 'ville-de-recette', name: 'Ville de Montrivage' }],
    isLoading: false,
  }),
  useRotateCollectiviteInvitationLink: () => ({ error: null, isPending: false, mutate: jest.fn() }),
}));

jest.mock('@/services/collectivite/collectiviteRattachementQueries', () => ({
  useAnswerCollectiviteAttachRequest: () => mockRepondre,
  useCancelCollectiviteProposal: () => mockAnnuler,
  useCollectiviteClubRequests: () => mockDemandes,
  useProposeCollectiviteClub: () => mockProposer,
}));

// La recherche HABITUELLE, doublée : elle retient ses propriétés et pose, sous chaque carte,
// l'action que l'écran de la Ville lui donne (comme la vraie, témoin ClubListContent R17-INVITER).
jest.mock('@/components/organisms/clubListContent/ClubListContent', () => {
  const { Text: TexteRN, View } = jest.requireActual('react-native');
  return function ClubListContentMock(/** @type {any} */ props) {
    mockListeProps = props;
    const { actionDeCarte } = props;
    return (
      <View testID="recherche-habituelle">
        {mockClubs.map((club) => (
          <View key={club.documentId} testID={`carte-${club.documentId}`}>
            <TexteRN>{`carte:${club.name}`}</TexteRN>
            {actionDeCarte ? actionDeCarte(club) : null}
          </View>
        ))}
      </View>
    );
  };
});

// R17-INVITER : l'écran réserve la place de la barre d'onglets du site (useBottomDockLayout tire
// @react-navigation/stack, que jest ne transforme pas) : doublé, comme dans ClubListContent.
// INVPAD : la place réservée à la barre (132 px sur le site) se règle par témoin.
const mockDock = { dockClearance: 0, floatingActionBottomOffset: 0, sceneBottomInset: 0 };
jest.mock('@/navigation/useBottomDockLayout', () => ({
  __esModule: true,
  default: () => mockDock,
}));
// INVPAD : la largeur de la fenêtre (ordinateur ou non). Par défaut, celle du téléphone de jest.
const mockFenetre = {
  fontScale: 2, height: 1334, scale: 2, width: 750,
};
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockFenetre,
}));

jest.mock('@/utils/shareLinks', () => ({
  buildPublicWebUrl: ({ path }) => `https://foundclub.example.invalid${path}`,
}));
jest.mock('@/platform/share', () => ({ share: jest.fn() }));

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);
jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() { return null; });
jest.mock(
  '@/components/molecules/segmentedControl/SegmentedControl',
  () => function SegmentedControlMock() { return null; },
);

const aplatirTexte = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};

const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<CollectiviteInviteClub />);
  });
  return arbre;
};

const racine = (/** @type {any} */ x) => x.root || x;
const textes = (/** @type {any} */ arbre) => racine(arbre).findAllByType(Text)
  .map((/** @type {any} */ n) => aplatirTexte(n.props.children).trim());
const boutons = (/** @type {any} */ arbre, /** @type {string} */ titre) => racine(arbre).findAll(
  (/** @type {any} */ n) => n.props?.title === titre && typeof n.props?.onPress === 'function',
);
const dans = (/** @type {any} */ arbre, /** @type {string} */ testID) => racine(arbre).findAll(
  (/** @type {any} */ n) => n.props?.testID === testID,
)[0];
const onglets = (/** @type {any} */ arbre) => racine(arbre).findAll(
  (/** @type {any} */ n) => Array.isArray(n.props?.options) && typeof n.props?.onChange === 'function',
);
const appuyer = async (/** @type {any} */ noeud) => {
  await act(async () => { noeud.props.onPress(); });
};

const LE_BOUTON = 'Ce club fait partie de ma collectivité';
const ADRESSE_DU_LIEN = 'https://foundclub.example.invalid/invitation-ville/CodeDeLaVille0123456789ab';

const demande = (/** @type {Record<string, unknown>} */ champs) => ({
  attachedElsewhere: false,
  canAnswer: false,
  canCancel: false,
  canRemind: false,
  createdAt: '2026-10-19T08:00:00.000Z',
  kind: 'proposal',
  state: 'pending',
  ...champs,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockListeProps = null;
  mockRoute = { params: { collectiviteId: 'ville-de-recette', onglet: 'recherche' } };
  mockClubs = [
    { documentId: 'judo-e', name: 'Judo Club E' },
    { documentId: 'tennis-f', name: 'Tennis Club F' },
    { documentId: 'as-a', name: 'AS Montrivage' },
    { documentId: 'voisin-c', name: 'FC Voisin' },
    { documentId: 'basket-g', name: 'Basket G' },
    { documentId: 'hand-h', name: 'Hand H' },
    { documentId: 'stripe-d', name: 'Recette Stripe FC' },
  ];
  mockDemandes = {
    data: [], error: null, isError: false, isLoading: false,
  };
});

describe('R17INVIT · I1 — la recherche habituelle, sans onglets', () => {
  it('« Ajouter un club » ouvre la recherche habituelle ; plus d’onglets ; la fiche d’un club s’ouvre avec la Ville', async () => {
    const arbre = await monter();
    expect(dans(arbre, 'recherche-habituelle')).toBeTruthy();
    expect(onglets(arbre)).toHaveLength(0);
    expect(textes(arbre)).toEqual(expect.arrayContaining([
      'Ajouter un club',
      'Le club n’est pas sur FoundClub ?',
    ]));
    expect(mockListeProps.paramsDeFiche).toEqual({ collectiviteId: 'ville-de-recette' });
    expect(typeof mockListeProps.actionDeCarte).toBe('function');
  });

  it('sans `onglet` (le raccourci « Inviter un club » de l’accueil) : la même recherche', async () => {
    mockRoute = { params: { collectiviteId: 'ville-de-recette' } };
    const arbre = await monter();
    expect(dans(arbre, 'recherche-habituelle')).toBeTruthy();
    expect(onglets(arbre)).toHaveLength(0);
  });
});

describe('R17INVIT · I2 — « Le club n’est pas sur FoundClub ? »', () => {
  it('le lien discret mène au lien de la Ville, puis à « Par FoundClub » ; on revient à la recherche', async () => {
    const arbre = await monter();
    await appuyer(dans(arbre, 'inviter-absent'));
    expect(dans(arbre, 'recherche-habituelle')).toBeUndefined();
    expect(textes(arbre)).toEqual(expect.arrayContaining(['Inviter un club absent de FoundClub', ADRESSE_DU_LIEN]));
    const [choix] = onglets(arbre);
    expect(choix.props.options.map((/** @type {any} */ o) => o.value)).toEqual(['lien', 'foundclub']);
    await act(async () => { choix.props.onChange('foundclub'); });
    expect(dans(arbre, 'inviter-nom')).toBeTruthy();
    await appuyer(dans(arbre, 'inviter-retour-recherche'));
    expect(dans(arbre, 'recherche-habituelle')).toBeTruthy();
  });

  it.each([
    ['lien', 'inviter-lien'],
    ['foundclub', 'inviter-nom'],
  ])('`onglet=%s` ouvre toujours son formulaire', async (onglet, testID) => {
    mockRoute = { params: { collectiviteId: 'ville-de-recette', onglet } };
    const arbre = await monter();
    expect(dans(arbre, testID)).toBeTruthy();
    expect(dans(arbre, 'recherche-habituelle')).toBeUndefined();
  });
});

describe('R17INVIT · I3 — le bouton de chaque carte', () => {
  it('« Ce club fait partie de ma collectivité » envoie la demande à CE club', async () => {
    const arbre = await monter();
    const carte = dans(arbre, 'carte-judo-e');
    const [bouton] = boutons(carte, LE_BOUTON);
    expect(bouton).toBeTruthy();
    expect(boutons(arbre, LE_BOUTON)).toHaveLength(mockClubs.length);
    await appuyer(bouton);
    expect(mockProposer.mutate).toHaveBeenCalledWith(
      { clubId: 'judo-e', collectiviteId: 'ville-de-recette' },
      expect.any(Object),
    );
  });
});

describe('R17INVIT · I4 — chaque état a ses mots', () => {
  beforeEach(() => {
    mockDemandes = {
      data: [
        demande({ club: { documentId: 'as-a' }, documentId: 'p-as', state: 'attached' }),
        demande({
          attachedElsewhere: true, club: { documentId: 'voisin-c' }, documentId: 'r-voisin', kind: 'attach_request',
        }),
        demande({ canCancel: true, club: { documentId: 'basket-g' }, documentId: 'p-basket' }),
        demande({
          awaitingLeader: true, canCancel: true, club: { documentId: 'tennis-f' }, documentId: 'p-tennis',
        }),
        demande({ club: { documentId: 'hand-h' }, documentId: 'p-hand', state: 'refused' }),
        demande({
          canAnswer: true, club: { documentId: 'stripe-d' }, documentId: 'r1', kind: 'attach_request',
        }),
      ],
      error: null,
      isError: false,
      isLoading: false,
    };
  });

  it('rattaché, ailleurs, envoyée : le mot, et plus le bouton', async () => {
    const arbre = await monter();
    expect(textes(dans(arbre, 'carte-as-a'))).toContain('Déjà rattaché à la Ville');
    expect(textes(dans(arbre, 'carte-voisin-c'))).toContain('Rattaché à une autre collectivité');
    expect(textes(dans(arbre, 'carte-basket-g'))).toContain('Demande envoyée');
    ['as-a', 'voisin-c', 'basket-g'].forEach((id) => {
      expect(boutons(dans(arbre, `carte-${id}`), LE_BOUTON)).toHaveLength(0);
    });
    expect(boutons(dans(arbre, 'carte-judo-e'), LE_BOUTON)).toHaveLength(1);
  });

  it('club sans dirigeant : « Demande enregistrée : elle attend le premier dirigeant du club » ; Annuler ; le lien en action secondaire', async () => {
    const arbre = await monter();
    const carte = dans(arbre, 'carte-tennis-f');
    expect(textes(carte)).toContain('Demande enregistrée : elle attend le premier dirigeant du club');
    await appuyer(boutons(carte, 'Annuler la demande')[0]);
    expect(mockAnnuler.mutate).toHaveBeenCalledWith(
      { collectiviteId: 'ville-de-recette', invitationId: 'p-tennis' },
      expect.any(Object),
    );
    await appuyer(boutons(carte, 'Inviter par le lien')[0]);
    expect(textes(arbre)).toContain(ADRESSE_DU_LIEN);
  });

  it('refusée : « Renvoyer la demande » ; le club a déjà demandé : « Accepter sa demande »', async () => {
    const arbre = await monter();
    const refuse = dans(arbre, 'carte-hand-h');
    expect(textes(refuse)).toContain('Le club a refusé votre demande');
    await appuyer(boutons(refuse, 'Renvoyer la demande')[0]);
    expect(mockProposer.mutate).toHaveBeenCalledWith(
      { clubId: 'hand-h', collectiviteId: 'ville-de-recette' },
      expect.any(Object),
    );
    const stripe = dans(arbre, 'carte-stripe-d');
    expect(textes(stripe)).toContain('Ce club demande déjà à vous rejoindre');
    await appuyer(boutons(stripe, 'Accepter sa demande')[0]);
    expect(mockRepondre.mutate).toHaveBeenCalledWith(
      { accept: true, collectiviteId: 'ville-de-recette', invitationId: 'r1' },
      expect.any(Object),
    );
  });
});

describe('R17INVIT · I5 — les refus du serveur, en mots', () => {
  const refus = (/** @type {string} */ code) => ({
    response: { data: { error: { details: { code } } }, status: 409 },
  });

  it('le serveur d’aujourd’hui refuse un club sans dirigeant : le dire, proposer le lien, rien ne plante', async () => {
    mockProposer.mutate.mockImplementation((_vars, options) => options?.onError?.(refus('COLLECTIVITE_CLUB_WITHOUT_LEADER')));
    const arbre = await monter();
    await appuyer(boutons(dans(arbre, 'carte-tennis-f'), LE_BOUTON)[0]);
    const carte = dans(arbre, 'carte-tennis-f');
    expect(textes(carte)).toContain('Aucun dirigeant sur FoundClub : personne ne pourrait accepter. Invitez-le par le lien.');
    await appuyer(boutons(carte, 'Inviter par le lien')[0]);
    expect(textes(arbre)).toContain(ADRESSE_DU_LIEN);
  });

  it('rattaché à une autre collectivité (409) : « Rattaché à une autre collectivité », jamais « détache-le »', async () => {
    mockProposer.mutate.mockImplementation((_vars, options) => options?.onError?.(refus('COLLECTIVITE_CLUB_ALREADY_ATTACHED')));
    const arbre = await monter();
    await appuyer(boutons(dans(arbre, 'carte-judo-e'), LE_BOUTON)[0]);
    const lus = textes(dans(arbre, 'carte-judo-e'));
    expect(lus).toContain('Rattaché à une autre collectivité');
    expect(lus.join(' ')).not.toMatch(/détache-le/);
    expect(boutons(dans(arbre, 'carte-judo-e'), LE_BOUTON)).toHaveLength(0);
  });
});

describe('R17INVIT · I6 — seul un gestionnaire de CETTE Ville voit le bouton', () => {
  it.each([
    ['lecture refusée (403)', {
      data: undefined, error: { response: { status: 403 } }, isError: true, isLoading: false,
    }],
    ['lecture en cours', {
      data: undefined, error: null, isError: false, isLoading: true,
    }],
  ])('%s : aucun bouton sur les cartes', async (_cas, lecture) => {
    mockDemandes = lecture;
    const arbre = await monter();
    expect(dans(arbre, 'carte-judo-e')).toBeTruthy();
    expect(boutons(arbre, LE_BOUTON)).toHaveLength(0);
  });
});

// INVPAD (20/10/2026) — Adel, le site sur un écran d'ordinateur : « il y a des gros problèmes de
// padding inutile » (colonne de 720 px dans un cadre de 1 180, 132 px réservés sous le lien à une
// barre d'onglets que le menu de la Ville remplace dès 1 024 px, une seule carte et son bouton coupé).
describe('INVPAD — sur ordinateur, ni colonne étroite, ni place pour une barre absente', () => {
  const { Platform, StyleSheet } = jest.requireActual('react-native');
  const osDOrigine = Platform.OS;
  const zone = (/** @type {any} */ arbre) => StyleSheet.flatten(dans(arbre, 'inviter-recherche').props.style);
  const regler = (/** @type {string} */ os, /** @type {number} */ largeur) => {
    Platform.OS = os;
    mockFenetre.width = largeur;
    mockDock.dockClearance = 132;
  };

  afterEach(() => {
    Platform.OS = osDOrigine;
    mockFenetre.width = 750;
    mockDock.dockClearance = 0;
  });

  it('site, 1 360 px : la largeur du cadre (comme Clubs), rien sous le lien, les cartes sur deux colonnes', async () => {
    regler('web', 1360);
    const arbre = await monter();
    expect(zone(arbre).maxWidth).toBeUndefined();
    expect(zone(arbre).paddingBottom).toBe(0);
    expect(mockListeProps.surDeuxColonnes).toBe(true);
  });

  it('site, 390 px : la place de la barre d’onglets flottante reste (R17-INVITER)', async () => {
    regler('web', 390);
    const arbre = await monter();
    expect(zone(arbre).paddingBottom).toBe(132);
  });

  it('téléphone (même une tablette de 1 366 px) : pas de barre sous cet écran, rien de réservé', async () => {
    regler('ios', 1366);
    const arbre = await monter();
    expect(zone(arbre).paddingBottom).toBe(0);
  });
});
