/**
 * W07 — l'ecran « Inviter une equipe » telechargeait la table des equipes de
 * toute la France, en parallele.
 *
 * 🔴 LE DEFAUT, tel que le code le produisait
 * (`EventWizardInvites.js:389-438`, avant ce lot) :
 *  · `loadInviteableExternalClubs` appelait `getTeams({ page: 1, pageSize: 100 })`
 *    — AUCUN filtre, donc la table entiere ;
 *  · il lisait `meta.pagination.pageCount` et tirait TOUTES les pages restantes
 *    d'un coup, dans un `Promise.all` ;
 *  · le tout pour n'en garder qu'une chose : la liste des CLUBS distincts. Le
 *    nom tape par l'utilisateur et les filtres etaient ensuite appliques EN
 *    MEMOIRE, sur ce butin.
 *  ⇒ ouvrir la section « equipe externe » coutait N/100 requetes, quoi que
 *    l'utilisateur cherche — et meme s'il ne cherchait rien.
 *
 * 🎯 CE QUE CET ECRAN CHERCHE VRAIMENT : un CLUB, n'importe lequel en France,
 * pour ensuite ouvrir SES equipes. Il ne cherche pas des equipes a ce
 * moment-la. Il n'y a donc pas de filtre a poser : il faut une RECHERCHE
 * SERVEUR — et le depot en a deja une, `getClubs({ name, activity, geohash })`,
 * celle que `HistoryWizardSingle` utilise deja pour sa liste de clubs.
 *
 * 🧪 CE FICHIER SE JOUE CONTRE UN SERVEUR FICTIF qui applique reellement les
 * parametres recus (filtres + pagination) et qui COMPTE ses appels. Sans lui,
 * un temoin resterait vert sur le code casse : rendre la bonne liste ne dit
 * rien de ce qu'il a fallu telecharger pour l'obtenir.
 *
 * Les quatre temoins :
 *  1. 🔴 l'ecran ne demande JAMAIS la table des equipes sans filtre ;
 *  2. 🔴 une reponse VIDE ne declenche pas la page suivante ;
 *  3. 🔒 on peut toujours inviter l'equipe qu'on veut (non-regression) ;
 *  4. 🔒 un resultat vide se DIT, il ne laisse pas un ecran blanc.
 */

import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import { EventWizardProvider, useEventWizard } from '../EventWizardContext';
import EventWizardInvites from '../EventWizardInvites';

jest.setTimeout(30000);

// ---------------------------------------------------------------------------
// LE SERVEUR FICTIF
// ---------------------------------------------------------------------------

/** La table des CLUBS, telle que `/clubs` la servirait. */
const mockTableClubs = [
  { documentId: 'club-moi', geohash: 'u09tv', name: 'FC Maison' },
  { documentId: 'club-voisin', geohash: 'u09tv', name: 'AS Voisine' },
  { documentId: 'club-lointain', geohash: 'spey0', name: 'Etoile Lointaine' },
];

/** La table des EQUIPES, telle que `/teams` la servirait. */
const mockTableEquipes = [
  {
    club: mockTableClubs[0], documentId: 'eq-moi-1', name: 'U15 A', players: [], trainers: [],
  },
  {
    club: mockTableClubs[0], documentId: 'eq-moi-2', name: 'Seniors B', players: [], trainers: [],
  },
  {
    club: mockTableClubs[1], documentId: 'eq-voisin-1', name: 'Voisine U17', players: [], trainers: [],
  },
  {
    club: mockTableClubs[2], documentId: 'eq-lointain-1', name: 'Lointaine Seniors', players: [], trainers: [],
  },
];

/**
 * Le journal du serveur fictif : une entree par requete de liste recue.
 * @type {{ route: string, params: any }[]}
 */
const mockJournal = [];

/** Ce que le serveur fictif annonce sur `/teams` quand la requete n'a AUCUN filtre. */
const mockReglages = { pageCountTableEntiere: 40, tableEquipesVide: false };

const mockNormaliser = (/** @type {any} */ valeur) => String(valeur || '')
  .normalize('NFD')
  .split('')
  .filter((caractere) => {
    const code = caractere.charCodeAt(0);
    return code < 0x300 || code > 0x36f;
  })
  .join('')
  .toLowerCase();

/**
 * Decoupe une liste en une page, et rend la meta que Strapi rendrait.
 * @param {any[]} lignes Les lignes retenues par les filtres.
 * @param {number} [page] Le numero de page demande.
 * @param {number} [pageSize] La taille de page demandee.
 * @param {number} [pageCountForce] Un `pageCount` impose (cas « table entiere »).
 * @returns {any} La reponse paginee.
 */
const mockPaginer = (lignes, page, pageSize, pageCountForce) => {
  const numeroDePage = Number(page) || 1;
  const taille = Number(pageSize) || 10;
  const debut = (numeroDePage - 1) * taille;
  return {
    data: lignes.slice(debut, debut + taille),
    meta: {
      pagination: {
        page: numeroDePage,
        pageCount: pageCountForce || Math.max(1, Math.ceil(lignes.length / taille)),
        pageSize: taille,
        total: lignes.length,
      },
    },
  };
};

jest.mock('@/services/team/teamService', () => ({
  __esModule: true,
  /**
   * `/teams` — il APPLIQUE le filtre de club recu, et il annonce la table
   * entiere quand il n'en recoit aucun. C'est ce contraste qui rend le defaut
   * visible.
   * @param {any} [params] Les parametres de la requete.
   * @returns {Promise<any>} La page servie.
   */
  getTeams: async (params = {}) => {
    mockJournal.push({ params, route: '/teams' });
    const { clubId, page, pageSize } = params;

    if (clubId) {
      const lignes = mockTableEquipes.filter((equipe) => equipe.club.documentId === String(clubId));
      return mockPaginer(lignes, page, pageSize);
    }

    // 🚨 Aucun filtre : la table entiere. Le serveur annonce une pagination
    // realiste (40 pages), et sert eventuellement des pages VIDES — c'est le
    // piege mesure par U03 : une page vide ne doit RIEN relancer.
    const lignes = mockReglages.tableEquipesVide ? [] : mockTableEquipes;
    return mockPaginer(lignes, page, pageSize, mockReglages.pageCountTableEntiere);
  },
}));

jest.mock('@/services/club/clubService', () => ({
  __esModule: true,
  /**
   * `/clubs` — la recherche serveur deja en place dans le depot : un nom en
   * `$containsi`, un sport, un geohash, et une pagination.
   * @param {any} [params] Les parametres de la requete.
   * @returns {Promise<any>} La page servie.
   */
  getClubs: async (params = {}) => {
    mockJournal.push({ params, route: '/clubs' });
    const {
      activity, geohash, name, page, pageSize,
    } = params;

    let lignes = mockTableClubs;
    if (name) {
      lignes = lignes.filter((club) => mockNormaliser(club.name).includes(mockNormaliser(name)));
    }
    if (activity) {
      lignes = lignes.filter((club) => (club.activities || [])
        .some((/** @type {any} */ sport) => sport?.documentId === activity));
    }
    const zone = Array.isArray(geohash) ? String(geohash[0] || '') : String(geohash || '');
    if (zone) {
      lignes = lignes.filter((club) => String(club.geohash || '').includes(zone));
    }
    return mockPaginer(lignes, page, pageSize);
  },
}));

// ---------------------------------------------------------------------------
// LE DECOR
// ---------------------------------------------------------------------------

jest.mock('react-i18next', () => ({
  initReactI18next: { init: () => {}, type: '3rdParty' },
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
      if (typeof repli === 'string') return repli;
      if (repli && typeof repli.defaultValue === 'string') return repli.defaultValue;
      return cle;
    },
  }),
}));

// Le VRAI theme, sans le contexte React qui le porte. ⛔ Jamais un Proxy.
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
    userData: {
      club: { documentId: 'club-moi', name: 'FC Maison' },
      documentId: 'moi',
      trainedTeams: [{ documentId: 'eq-moi-1', name: 'U15 A' }],
    },
  }),
}));

jest.mock('@/domains/places/usePlaces', () => ({
  __esModule: true,
  default: () => ({ getGeohashForPointAndRadius: () => 'u09t' }),
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

jest.mock('@/components/atoms/button/Button', () => function BoutonMock(/** @type {any} */ props) {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return reactActuel.createElement(
    PressableRN,
    { accessibilityRole: 'button', disabled: Boolean(props.disabled), onPress: props.onPress },
    reactActuel.createElement(TexteRN, null, props.title),
  );
});

// La barre de recherche rendue comme un vrai champ : le test tape dedans.
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

// La carte de club rendue comme un pressable portant le nom du club.
jest.mock('@/components/molecules/clubSearchResultCard/ClubSearchResultCard', () => function CarteClubMock(
  /** @type {any} */ props,
) {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return reactActuel.createElement(
    PressableRN,
    { accessibilityRole: 'button', onPress: props.onPress },
    reactActuel.createElement(TexteRN, null, props.item?.name),
  );
});

jest.mock('@/views/event/wizard/components/EventWizardTeamCard', () => function CarteEquipeMock(
  /** @type {any} */ props,
) {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return reactActuel.createElement(
    PressableRN,
    { accessibilityRole: 'button', onPress: props.onPress },
    reactActuel.createElement(TexteRN, null, props.team?.name),
  );
});

jest.mock('@/components/molecules/bottomModal/BottomModal', () => function FeuilleMock(
  /** @type {any} */ props,
) {
  return props.children;
});

jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => () => null);
jest.mock('@/components/molecules/autocompleteSelect/AutocompleteSelect', () => () => null);
jest.mock('@/components/atoms/checkbox/Checkbox', () => () => null);
jest.mock('@/components/organisms/autocompleteAddressInput/autocompleteAddressInput', () => () => null);
jest.mock('@react-native-community/slider', () => () => null);

// ---------------------------------------------------------------------------
// LES OUTILS DU TEST
// ---------------------------------------------------------------------------

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

/**
 * L'etat du tunnel, capte pour lire les invitations posees.
 * @type {any}
 */
let etatDuTunnel = null;

/**
 * Composant sans rendu : il capte l'etat du tunnel.
 * @returns {null} Rien.
 */
function PriseDeCourant() {
  const { state } = useEventWizard();
  etatDuTunnel = state;
  return null;
}

/** Les textes visibles apres le dernier rendu. */
const textesCourants = () => textesSous(arbre.root);

/**
 * Presse le premier pressable dont le texte visible vaut `libelle`.
 * On cherche « ce qui porte un onPress » plutot qu'un type de composant.
 * @param {string} libelle Texte visible du pressable a actionner.
 */
const presserLeTexte = (libelle) => {
  const pressables = arbre.root.findAll(
    (/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function',
    { deep: true },
  );
  const cible = pressables.find((noeud) => textesSous(noeud).includes(libelle));
  if (!cible) {
    const vus = pressables.map((noeud) => textesSous(noeud).join('|')).filter(Boolean);
    throw new Error(
      `aucun pressable ne porte le texte « ${libelle} ». Pressables vus : ${JSON.stringify(vus)}`,
    );
  }
  cible.props.onPress();
};

/**
 * Tape un texte dans le champ portant ce texte d'invite.
 * @param {string} invite Le `placeholder` du champ vise.
 * @param {string} texte Ce que l'utilisateur tape.
 */
const taperDans = (invite, texte) => {
  const champ = arbre.root.findAll(
    (/** @type {any} */ noeud) => noeud.props?.placeholder === invite
      && typeof noeud.props?.onChangeText === 'function',
    { deep: true },
  )[0];
  if (!champ) throw new Error(`aucun champ « ${invite} »`);
  champ.props.onChangeText(texte);
};

/**
 * Laisse tourner l'anti-rebond (250 ms) puis toutes les promesses en attente.
 * Le nombre de tours est volontairement large : sur le code CASSE, chaque page
 * recue en reveille une autre, et le temoin doit voir la cascade entiere.
 * @returns {Promise<void>} Quand le reseau fictif s'est tu.
 */
const laisserLeReseauRepondre = async () => {
  await act(async () => {
    jest.advanceTimersByTime(400);
  });
  for (let tour = 0; tour < 60; tour += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
  }
};

/**
 * Monte l'ecran et ouvre la section « inviter une equipe externe ».
 * @returns {Promise<void>} Quand la section est ouverte et le reseau calme.
 */
const ouvrirLaRechercheDeClub = async () => {
  const navigation = { goBack: () => {}, navigate: () => {}, setParams: () => {} };
  const element = createElement(
    EventWizardProvider,
    null,
    createElement(PriseDeCourant),
    createElement(EventWizardInvites, { navigation, route: { params: {} } }),
  );

  await act(async () => { arbre = renderer.create(element); });
  await laisserLeReseauRepondre();
  mockJournal.length = 0;
  await act(async () => { presserLeTexte('Inviter une équipe externe'); });
  await laisserLeReseauRepondre();
};

/** Les requetes de liste envoyees depuis la derniere remise a zero. */
const requetesEnvoyees = () => mockJournal.slice();

beforeEach(() => {
  jest.useFakeTimers();
  mockJournal.length = 0;
  mockReglages.pageCountTableEntiere = 40;
  mockReglages.tableEquipesVide = false;
  etatDuTunnel = null;
});

afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
  jest.useRealTimers();
});

describe('W07 — la recherche de club externe ne telecharge plus la table des equipes', () => {
  test('TEMOIN 1 — l ecran ne demande JAMAIS une liste d equipes sans filtre', async () => {
    await ouvrirLaRechercheDeClub();

    const equipesSansFiltre = requetesEnvoyees().filter(
      (requete) => requete.route === '/teams' && !requete.params?.clubId,
    );

    expect(equipesSansFiltre).toEqual([]);
  });

  test('TEMOIN 2 — une reponse vide ne declenche PAS la page suivante', async () => {
    mockReglages.tableEquipesVide = true;

    await ouvrirLaRechercheDeClub();

    // Le serveur annonce 40 pages et n'a rien a rendre. Ouvrir la section ne
    // doit couter qu'UNE requete : la recherche de clubs, bornee.
    const requetes = requetesEnvoyees();
    expect(requetes.map((requete) => requete.route)).not.toContain('/teams');
    expect(requetes.length).toBeLessThanOrEqual(1);
  });

  test('TEMOIN 2 bis — chaque requete de liste porte une pagination bornee', async () => {
    await ouvrirLaRechercheDeClub();
    await act(async () => { taperDans('Rechercher un club externe', 'Voisine'); });
    await laisserLeReseauRepondre();

    requetesEnvoyees().forEach((requete) => {
      const taille = Number(requete.params?.pageSize);
      expect(Number.isFinite(taille)).toBe(true);
      expect(taille).toBeGreaterThan(0);
      expect(taille).toBeLessThanOrEqual(100);
    });
  });

  test('TEMOIN 3 🔒 — on peut toujours inviter l equipe d un club qui n est pas le mien', async () => {
    await ouvrirLaRechercheDeClub();

    await act(async () => { taperDans('Rechercher un club externe', 'Voisine'); });
    await laisserLeReseauRepondre();
    expect(textesCourants()).toContain('AS Voisine');

    await act(async () => { presserLeTexte('AS Voisine'); });
    await laisserLeReseauRepondre();
    expect(textesCourants()).toContain('Voisine U17');

    await act(async () => { presserLeTexte('Voisine U17'); });
    await laisserLeReseauRepondre();

    const invitees = (etatDuTunnel?.teamAudiences || [])
      .filter((/** @type {any} */ audience) => audience?.audienceKind === 'external_invited')
      .map((/** @type {any} */ audience) => audience?.team?.documentId);
    expect(invitees).toContain('eq-voisin-1');
  });

  test('TEMOIN 3 bis 🔒 — un club a l autre bout de la France reste atteignable', async () => {
    await ouvrirLaRechercheDeClub();

    await act(async () => { taperDans('Rechercher un club externe', 'Lointaine'); });
    await laisserLeReseauRepondre();

    expect(textesCourants()).toContain('Etoile Lointaine');
  });

  test('TEMOIN 4 — un resultat vide se DIT, il ne laisse pas un ecran blanc', async () => {
    await ouvrirLaRechercheDeClub();

    await act(async () => { taperDans('Rechercher un club externe', 'Zzzzz'); });
    await laisserLeReseauRepondre();

    expect(textesCourants()).toContain('Aucun club externe trouve pour cette recherche.');
  });
});
