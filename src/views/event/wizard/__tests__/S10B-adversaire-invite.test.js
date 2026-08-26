import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import { EventWizardProvider, useEventWizard } from '../EventWizardContext';
import EventWizardOpponent from '../EventWizardOpponent';
import { keepAudiencesForEventType } from '../useEventWizardAudiences';

// ═══════════════════════════════════════════════════════════════════════════
// S10-B D2 — INVITER L'EQUIPE ADVERSE, DEPUIS « CONTRE QUI ? »
//
// 🧭 Cadre d'Adel du 2026-08-25, reponse 4 : « equipes EXTERNES seulement sur
// les MATCHS, via une option dans l'etape Contre qui ? — l'equipe externe
// invitee EST l'adversaire. Son coach doit accepter avant d'apparaitre, et la
// c'est TOUTE l'equipe (pas de cochage). »
//
// 🔒 LES TROIS INVARIANTS QUE CE FICHIER GARDE :
//   1. UNE SEULE equipe adverse. La section vient d'un ecran qui en acceptait
//      plusieurs ; en choisir une seconde REMPLACE la premiere.
//   2. L'invitation part en `PENDING` et n'entre PAS dans `invitedTeams` : une
//      equipe dont le coach n'a pas repondu n'est pas embarquee.
//   3. Elle ne touche jamais aux equipes de MON club (l'autre etape).
// ═══════════════════════════════════════════════════════════════════════════

/** La table des CLUBS, telle que `/clubs` la servirait. */
const CLUBS = [
  { documentId: 'club-moi', name: 'FC Maison' },
  { documentId: 'club-voisin', name: 'AS Voisine' },
];

/** La table des EQUIPES du club voisin. */
const EQUIPES_VOISINES = [
  { club: CLUBS[1], documentId: 'eq-voisin-1', name: 'Voisine U17' },
  { club: CLUBS[1], documentId: 'eq-voisin-2', name: 'Voisine Seniors' },
];

const TYPE_MATCH = { documentId: 'type-match', name: 'Match' };

const EQUIPE_ORGANISATRICE = {
  club: { documentId: 'club-moi', name: 'FC Maison' },
  documentId: 'equipe-1',
  name: 'U15 A',
};

/** Une invitation d'equipe INTERNE deja posee a l'etape « Participants ». */
const AUDIENCE_INTERNE = {
  audienceKind: 'internal_invited',
  selectedMembers: [],
  selectionMode: 'ALL_MEMBERS',
  status: 'ACCEPTED',
  team: { club: CLUBS[0], documentId: 'equipe-2', name: 'U17 B' },
};

jest.mock('react-i18next', () => ({
  initReactI18next: { init: () => {}, type: '3rdParty' },
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ options) => {
      let modele = cle;
      if (typeof repli === 'string') modele = repli;
      else if (repli && typeof repli.defaultValue === 'string') modele = repli.defaultValue;

      const valeurs = (repli && typeof repli === 'object') ? repli : options;
      if (!valeurs) return modele;

      return String(modele).replace(
        /\{\{(\w+)\}\}/g,
        (/** @type {string} */ trouve, /** @type {string} */ nom) => (
          valeurs[nom] === undefined ? trouve : String(valeurs[nom])
        ),
      );
    },
  }),
}));

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
      Images: { chevronDown: 1 },
      Spaces: espaces,
    }),
  };
});

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    userData: { club: { documentId: 'club-moi' }, documentId: 'moi', trainedTeams: [] },
  }),
}));

jest.mock('@/domains/places/usePlaces', () => ({
  __esModule: true,
  default: () => ({ getGeohashForPointAndRadius: () => '' }),
}));

// ⛔ Jamais `requireActual` sur un service : le client HTTP exige `API_URL` et
// la suite entiere meurt au CHARGEMENT (0 test execute).
jest.mock('@/services/club/clubService', () => ({
  getClubs: async () => ({
    data: [{ documentId: 'club-voisin', name: 'AS Voisine' }],
  }),
}));

jest.mock('@/services/team/teamService', () => ({
  getTeams: async (/** @type {any} */ params = {}) => ({
    data: params?.clubId === 'club-voisin'
      ? [
        {
          club: { documentId: 'club-voisin', name: 'AS Voisine' },
          documentId: 'eq-voisin-1',
          name: 'Voisine U17',
        },
        {
          club: { documentId: 'club-voisin', name: 'AS Voisine' },
          documentId: 'eq-voisin-2',
          name: 'Voisine Seniors',
        },
      ]
      : [],
  }),
}));

// L'etape porte SA PROPRE recherche de club sous le champ libre (AC04). Muette
// ici : deux listes de clubs melangeraient les pressables vises.
jest.mock('@/services/club/clubQueries', () => ({
  useSearchClubs: () => ({ data: undefined, isLoading: false }),
}));

jest.mock('@/services/activity/activityQueries', () => ({
  useGetActivities: () => ({
    data: [], error: null, isLoading: false, refetch: () => {},
  }),
}));

jest.mock('@/components/molecules/wizardStepLayout/WizardStepLayout', () => function GabaritMock(
  /** @type {any} */ props,
) {
  return props.children;
});

jest.mock('@/components/molecules/searchBar/SearchBar', () => function BarreMock(
  /** @type {any} */ props,
) {
  const reactActuel = jest.requireActual('react');
  const { TextInput: ChampRN } = jest.requireActual('react-native');
  return reactActuel.createElement(ChampRN, {
    onChangeText: props.onChangeText,
    placeholder: props.placeholder,
    value: props.value,
  });
});

jest.mock(
  '@/components/molecules/clubSearchResultCard/ClubSearchResultCard',
  () => function CarteClubMock(/** @type {any} */ props) {
    const reactActuel = jest.requireActual('react');
    const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
    return reactActuel.createElement(
      PressableRN,
      { accessibilityRole: 'button', onPress: props.onPress },
      reactActuel.createElement(TexteRN, null, props.item?.name),
    );
  },
);

jest.mock('@/views/event/wizard/components/EventWizardTeamCard', () => function CarteEquipeMock(
  /** @type {any} */ props,
) {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return reactActuel.createElement(
    PressableRN,
    { accessibilityRole: 'button', onPress: props.onPress },
    reactActuel.createElement(TexteRN, null, props.team?.name),
    reactActuel.createElement(TexteRN, null, props.selectionSummary),
  );
});

jest.mock('@/components/atoms/button/Button', () => function BoutonMock(/** @type {any} */ props) {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return reactActuel.createElement(
    PressableRN,
    { accessibilityRole: 'button', disabled: Boolean(props.disabled), onPress: props.onPress },
    reactActuel.createElement(TexteRN, null, props.title),
  );
});

jest.mock('@/components/molecules/bottomModal/BottomModal', () => function FeuilleMock(
  /** @type {any} */ props,
) {
  return props.isVisible ? props.children : null;
});

jest.mock('@/components/molecules/autocompleteSelect/AutocompleteSelect', () => () => null);
jest.mock(
  '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput',
  () => () => null,
);
jest.mock('@react-native-community/slider', () => () => null);

/**
 * Tous les textes rendus sous un noeud de l'arbre de test.
 * @param {any} noeud Noeud de depart.
 * @returns {string[]} Les textes, dans l'ordre du rendu.
 */
const textesSous = (noeud) => {
  /** @type {string[]} */
  const sortie = [];
  const parcourir = (/** @type {any} */ enfant) => {
    if (typeof enfant === 'string' || typeof enfant === 'number') {
      sortie.push(String(enfant));
      return;
    }
    if (Array.isArray(enfant)) {
      enfant.forEach(parcourir);
      return;
    }
    if (enfant?.children) enfant.children.forEach(parcourir);
  };
  parcourir(noeud.children);
  return sortie;
};

/** @type {any} */
let arbre;
/** L'etat courant du tunnel, relu par les temoins apres chaque geste. */
let etatCourant = /** @type {any} */ ({});
/**
 * Le dispatch du tunnel, capte pour semer l'etat de depart.
 * @type {(action: any) => void}
 */
let semer = () => {};

/**
 * Sonde sans rendu : elle expose le `dispatch` et l'etat du tunnel.
 * @returns {null} Rien.
 */
function PriseDeCourant() {
  const { dispatch, state } = useEventWizard();
  semer = dispatch;
  etatCourant = state;
  return null;
}

/**
 * Les textes visibles apres le dernier rendu.
 * @returns {string[]} Les textes rendus.
 */
const textesCourants = () => textesSous(arbre.root);

/**
 * Laisse tourner l'anti-rebond (250 ms) puis les promesses en attente.
 * @returns {Promise<void>} Quand le reseau fictif s'est tu.
 */
const laisserLeReseauRepondre = async () => {
  for (let tour = 0; tour < 6; tour += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { jest.advanceTimersByTime(400); });
  }
};

/**
 * Presse le premier pressable dont le texte visible vaut `libelle`.
 * @param {string} libelle Texte visible du pressable a actionner.
 * @returns {Promise<void>} Quand le rendu suivant est fait.
 */
const presserLeTexte = async (libelle) => {
  const pressables = arbre.root.findAll(
    (/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function',
    { deep: true },
  );
  const cible = pressables.find(
    (/** @type {any} */ noeud) => textesSous(noeud).includes(libelle),
  );
  if (!cible) {
    const vus = pressables
      .map((/** @type {any} */ noeud) => textesSous(noeud).join('|'))
      .filter(Boolean);
    throw new Error(
      `aucun pressable ne porte le texte « ${libelle} ». Pressables vus : ${JSON.stringify(vus)}`,
    );
  }
  await act(async () => { cible.props.onPress(); });
};

/**
 * Ouvre l'etape « Contre qui ? », deplie la section, et ouvre le club voisin.
 * @param {any} [etatSeme] L'etat du tunnel au moment de l'ouverture.
 * @returns {Promise<void>} Quand les equipes du club voisin sont a l'ecran.
 */
const ouvrirLesEquipesDuVoisin = async (etatSeme = {}) => {
  const navigation = {
    goBack: () => {},
    navigate: () => {},
    push: () => {},
    replace: () => {},
    setParams: () => {},
  };

  const rendre = (/** @type {any} */ contenu) => createElement(
    EventWizardProvider,
    null,
    createElement(PriseDeCourant),
    contenu,
  );

  await act(async () => { arbre = renderer.create(rendre(null)); });
  await act(async () => {
    semer({
      payload: { team: EQUIPE_ORGANISATRICE, type: TYPE_MATCH, ...etatSeme },
      type: 'SET_META',
    });
  });
  await act(async () => {
    arbre.update(rendre(createElement(EventWizardOpponent, {
      navigation,
      route: { params: {} },
    })));
  });

  await presserLeTexte('Inviter l équipe adverse sur FoundClub');
  await laisserLeReseauRepondre();
  await presserLeTexte('AS Voisine');
  await laisserLeReseauRepondre();
};

/**
 * Le champ libre « nom de l'adversaire », tel que l'organisateur le voit.
 * @returns {any} Le noeud du champ de saisie.
 */
const champAdversaire = () => arbre.root.findAll(
  (/** @type {any} */ noeud) => typeof noeud.props?.onChangeText === 'function'
    && typeof noeud.props?.maxLength === 'number',
  { deep: true },
)[0];

/**
 * Les audiences externes posees dans le tunnel.
 * @returns {any[]} Les invitations d'equipes externes.
 */
const audiencesExternes = () => (etatCourant.teamAudiences || [])
  .filter((/** @type {any} */ audience) => audience?.audienceKind === 'external_invited');

beforeEach(() => {
  jest.useFakeTimers();
  etatCourant = {};
});

afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
  jest.useRealTimers();
});

describe('S10-B D2 — inviter l equipe adverse depuis « Contre qui ? »', () => {
  test('temoin 1 — la section est offerte sur l etape, et elle se deplie', async () => {
    await ouvrirLesEquipesDuVoisin();

    expect(textesCourants()).toContain('Voisine U17');
    expect(textesCourants()).toContain('Voisine Seniors');
  });

  test('temoin 2 — inviter une equipe ecrit UNE audience externe en attente', async () => {
    await ouvrirLesEquipesDuVoisin();
    await presserLeTexte('Voisine U17');

    expect(audiencesExternes()).toEqual([{
      audienceKind: 'external_invited',
      // ⛔ Pas de cochage pour une equipe externe : c'est TOUTE l'equipe.
      selectedMembers: [],
      selectionMode: 'ALL_MEMBERS',
      // 🔒 Son coach doit accepter avant qu'elle apparaisse.
      status: 'PENDING',
      team: EQUIPES_VOISINES[0],
    }]);
  });

  test('temoin 3 🔒 — une equipe en attente n entre PAS dans invitedTeams', async () => {
    // `invitedTeams` est ce que la charge de creation embarque comme equipes
    // DEJA a bord. Y mettre une equipe qui n a pas repondu la ferait apparaitre
    // sur la fiche de l evenement avant meme que son coach ait vu l invitation.
    await ouvrirLesEquipesDuVoisin();
    await presserLeTexte('Voisine U17');

    expect(etatCourant.invitedTeams).toEqual([]);
  });

  test('temoin 4 — l equipe invitee donne son nom a l adversaire', async () => {
    await ouvrirLesEquipesDuVoisin();
    expect(champAdversaire().props.value).toBe('');

    await presserLeTexte('Voisine U17');

    expect(champAdversaire().props.value).toBe('Voisine U17');
    // Et le nom est ecrit dans le tunnel TOUT DE SUITE, sans attendre
    // « Suivant » : un retour arriere laisserait sinon une invitation partie
    // et un adversaire toujours « Pas encore connu » au recapitulatif.
    expect(etatCourant.opponentName).toBe('Voisine U17');
  });

  test('temoin 5 🔒 — la saisie manuelle PRIME, et ne detruit pas l invitation', async () => {
    await ouvrirLesEquipesDuVoisin();
    await presserLeTexte('Voisine U17');

    await act(async () => { champAdversaire().props.onChangeText('Voisine U17 (B)'); });

    expect(champAdversaire().props.value).toBe('Voisine U17 (B)');
    // ⛔ L invitation est partie chez un vrai coach : corriger une majuscule ne
    // doit pas la supprimer en silence. Elle se retire explicitement.
    expect(audiencesExternes()).toHaveLength(1);
  });

  test('temoin 6 🔒 — UNE SEULE equipe adverse : la seconde remplace la premiere', async () => {
    await ouvrirLesEquipesDuVoisin();
    await presserLeTexte('Voisine U17');
    await presserLeTexte('Voisine Seniors');

    expect(audiencesExternes().map((/** @type {any} */ a) => a.team.documentId))
      .toEqual(['eq-voisin-2']);
    expect(etatCourant.opponentName).toBe('Voisine Seniors');
  });

  test('temoin 7 — re-appuyer sur l equipe invitee retire l invitation', async () => {
    await ouvrirLesEquipesDuVoisin();
    await presserLeTexte('Voisine U17');
    expect(audiencesExternes()).toHaveLength(1);

    await presserLeTexte('Invitation en attente de réponse');

    expect(audiencesExternes()).toEqual([]);
  });

  test('temoin 8 🔒 — une invitation INTERNE deja posee survit', async () => {
    // Le jumeau du temoin 7 de `S10B-tunnel-fusion` : les deux familles vivent
    // dans la MEME liste, ecrite depuis DEUX ecrans.
    await ouvrirLesEquipesDuVoisin({ teamAudiences: [AUDIENCE_INTERNE] });
    await presserLeTexte('Voisine U17');

    expect(etatCourant.teamAudiences).toContainEqual(AUDIENCE_INTERNE);
    expect(etatCourant.teamAudiences).toHaveLength(2);
    expect(etatCourant.invitedTeams).toEqual(['equipe-2']);
  });
});

describe('S10-B D2 — la derniere ligne avant le serveur', () => {
  const AUDIENCE_EXTERNE = {
    audienceKind: 'external_invited',
    status: 'PENDING',
    team: EQUIPES_VOISINES[0],
  };

  test('temoin 9 — un match emporte ses deux familles d audience', () => {
    expect(keepAudiencesForEventType({
      teamAudiences: [AUDIENCE_INTERNE, AUDIENCE_EXTERNE],
      type: TYPE_MATCH,
    })).toEqual([AUDIENCE_INTERNE, AUDIENCE_EXTERNE]);
  });

  test('temoin 10 🔒 — tout autre type laisse les externes au vestiaire', () => {
    // Le brouillon web survit au changement de type : on peut commencer un
    // match, inviter une equipe adverse, puis repasser en « Entrainement ».
    // L audience externe serait alors invisible a l ecran ET partirait quand
    // meme au serveur.
    ['Entrainement', 'Stage', 'Tournoi', "Détection / Séance d'essai", 'Autre']
      .forEach((nomDuType) => {
        expect(keepAudiencesForEventType({
          teamAudiences: [AUDIENCE_INTERNE, AUDIENCE_EXTERNE],
          type: { name: nomDuType },
        })).toEqual([AUDIENCE_INTERNE]);
      });
  });

  test('temoin 10 bis — un match amical reste un match', () => {
    expect(keepAudiencesForEventType({
      teamAudiences: [AUDIENCE_EXTERNE],
      type: { name: 'Match amical' },
    })).toEqual([AUDIENCE_EXTERNE]);
  });

  test('temoin 11 — un etat vide ou abime rend une liste vide', () => {
    expect(keepAudiencesForEventType({})).toEqual([]);
    expect(keepAudiencesForEventType({ teamAudiences: null, type: TYPE_MATCH })).toEqual([]);
  });
});
