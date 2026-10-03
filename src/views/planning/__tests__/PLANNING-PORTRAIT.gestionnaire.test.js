import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import en from '@/theme/strings/translations/en';
import fr from '@/theme/strings/translations/fr';

import {
  getCollectiviteClubs,
  getCollectiviteInstallations,
  getMyCollectivites,
} from '@/services/collectivite/collectiviteService';
import { getFacilityPlanning } from '@/services/facility/facilityService';

import PlanningWeekFullscreen from '../PersonalPlanningWeekFullscreen';

// PLANNING-PORTRAIT (01/10, lot 2 de PROMPT_COLLECTIVITES_FINITIONS.md), points 2 et 3 :
//
// 2. Le texte « organisateur » (depassements, demandes en attente) suivait le role du
//    COMPTE : un agent de mairie dont le compte est « joueur » lisait le texte du membre.
//    Il suit desormais le fait de GERER l installation : gestionnaire de la collectivite
//    qui en est proprietaire (le serveur le dit : /collectivites/mine puis ses
//    installations). Et « 2 slots » / « Pic 2/2 » deviennent des mots francais.
// 3. Sur le planning de la mairie, toucher le bloc d un AUTRE club ne faisait RIEN. SPEC
//    §2 C : « Touche un bloc : de qui il s agit […] et le contact du club. » D15 : la
//    mairie voit le contact GENERAL du club (e-mail et telephone du club, deja publics
//    dans l annuaire, rendus par /collectivites/:id/clubs). Une fiche en LECTURE s ouvre.
//    Pour tout autre lecteur, le bloc reste inerte (FINITIONS2 : pas un faux bouton).
// ROUGE avant le lot : texte du membre pour l agent « joueur », « slots » et « Pic »,
// et aucune fiche.

/** @type {any} */
let mockRoute;
/** @type {any} */
let mockNavigation;
/** @type {any[]} */
const mockTimelineProps = [];
/** @type {any} */
let mockAuth;

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ height: 390, width: 844 }),
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockAuth,
}));

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ valeurs) => {
      const gabarit = (() => {
        if (typeof repli === 'string') return repli;
        if (repli && typeof repli.defaultValue === 'string') return repli.defaultValue;
        if (repli && typeof repli.defaultValue_other === 'string') return repli.defaultValue_other;
        return cle;
      })();
      const variables = (repli && typeof repli === 'object') ? repli : (valeurs || {});
      return gabarit.replace(/\{\{(\w+)\}\}/g, (entier, nom) => (
        variables[nom] === undefined ? entier : String(variables[nom])
      ));
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
      Images: {
        arrowLeft: 1, arrowRight: 2, close: 3,
      },
      Spaces: espaces,
    }),
  };
});

jest.mock('@/components/templates/ScreenContainer', () => function ScreenContainerMock({
  children,
}) {
  return children;
});

jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() {
  return null;
});

jest.mock('@/components/molecules/bottomModal/BottomModal', () => function BottomModalMock(
  /** @type {any} */ { children, isVisible },
) {
  return isVisible ? children : null;
});

jest.mock('@/components/organisms/planningWeekTimelineView', () => function TimelineMock(
  /** @type {any} */ props,
) {
  mockTimelineProps.push(props);
  return null;
});

jest.mock('@/utils/device/orientation', () => ({
  lockToLandscape: jest.fn(),
  lockToPortrait: jest.fn(),
  unlockAllOrientations: jest.fn(),
}));

jest.mock('@/services/event/eventService', () => ({
  getClubPlanning: jest.fn(),
  getMyPlanning: jest.fn(),
}));

jest.mock('@/services/multisportClub/multisportClubService', () => ({
  getClubSharedPlanning: jest.fn(),
  getCMPlanning: jest.fn(),
}));

// COLL-C2B (02/10) : le planning d une installation a desormais 5 vues (Mois = le calendrier) et
// les gestes de la mairie (le service des creneaux) : deux doublures, sans effet sur ce temoin.
jest.mock(
  '@/components/organisms/planningCalendarView',
  () => function CalendarMock() { return null; },
);
jest.mock('@/services/seasonSlot/seasonSlotService', () => ({
  attributeSeasonSlot: jest.fn(),
  getClubTeamsForSlot: jest.fn(),
  getSeasonSlot: jest.fn(),
  listFacilitySeasonSlots: jest.fn(),
  modifySeasonSlot: jest.fn(),
  previewFacilitySeasonSlot: jest.fn(),
  restoreSeasonSlot: jest.fn(),
  withdrawSeasonSlot: jest.fn(),
}));

// COLL-C4B-BIS (03/10) : le planning lit aussi les fermetures (panneau sur ordinateur, bandeau).
jest.mock('@/services/facilityClosure/facilityClosureService', () => ({
  closeFacility: jest.fn(),
  listCollectiviteClosures: jest.fn(),
  listFacilityClosures: jest.fn(async () => ({ data: [], meta: {} })),
  modifyFacilityClosure: jest.fn(),
  previewFacilityClosure: jest.fn(),
  reopenFacilityClosure: jest.fn(),
}));
jest.mock('@/services/facility/facilityService', () => ({
  getFacilityPlanning: jest.fn(),
}));

// Le vrai module charge le client HTTP : on double les trois lectures du gestionnaire.
jest.mock('@/services/collectivite/collectiviteService', () => ({
  getCollectiviteClubs: jest.fn(),
  getCollectiviteInstallations: jest.fn(),
  getMyCollectivites: jest.fn(),
}));

const BLOC_DE_MON_CLUB = {
  club: { documentId: 'club-A', name: 'AS Ville A' },
  documentId: 'evt-A',
  endAt: '2026-10-05T17:30:00.000Z',
  endTime: '19:30:00.000',
  facility: { documentId: 'gym-ville', name: 'Gymnase de la Ville', planningColor: null },
  hasExplicitTime: true,
  isOwnClub: true,
  kind: 'event',
  leagueMatch: false,
  startAt: '2026-10-05T16:00:00.000Z',
  startTime: '18:00:00.000',
  team: { name: 'Seniors A' },
  title: 'AS Ville A · Seniors A',
};
const BLOC_D_UN_AUTRE_CLUB = {
  ...BLOC_DE_MON_CLUB,
  club: { documentId: 'club-B', name: 'US Ville B' },
  documentId: null,
  endTime: '20:00:00.000',
  isOwnClub: false,
  startAt: '2026-10-05T16:30:00.000Z',
  startTime: '18:30:00.000',
  team: { name: 'Seniors B' },
  title: 'US Ville B · Seniors B',
};

const installationAvec = (/** @type {number} */ maxSlots) => ({
  data: [BLOC_DE_MON_CLUB, BLOC_D_UN_AUTRE_CLUB],
  meta: {
    facility: {
      capacityConflictMode: 'pending_validation',
      documentId: 'gym-ville',
      maxSlots,
      name: 'Gymnase de la Ville',
      planningColor: null,
    },
  },
});

const JOUEUR = { userData: { role: { name: 'Joueur', type: 'joueur' } } };
const DIRIGEANT = { userData: { role: { name: 'Dirigeant', type: 'president' } } };

// Le compte gere la Ville 1, proprietaire du gymnase.
const gereLaVille = () => {
  getMyCollectivites.mockResolvedValue({
    data: [{ documentId: 'ville-1', name: 'Ville de Montrivage' }],
  });
  getCollectiviteInstallations.mockImplementation((/** @type {string} */ id) => Promise.resolve({
    data: id === 'ville-1' ? [{ documentId: 'gym-ville', name: 'Gymnase de la Ville' }] : [],
  }));
};

/** @type {any[]} */
const arbres = [];

const attendre = async () => {
  await act(async () => {
    await new Promise((resolve) => { setTimeout(resolve, 20); });
  });
};

const rendre = async () => {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0, retry: false } } });
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>
        <PlanningWeekFullscreen />
      </QueryClientProvider>,
    );
  });
  // Trois lectures en chaine (planning ; mes collectivites -> leurs installations).
  await attendre();
  await attendre();
  await attendre();
  arbres.push({ arbre, client });
  return arbre;
};

const texte = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ noeud) => [].concat(noeud.props.children).join(''))
  .join(' | ');

const derniereGrille = () => mockTimelineProps[mockTimelineProps.length - 1];

beforeEach(() => {
  jest.clearAllMocks();
  mockTimelineProps.length = 0;
  mockAuth = JOUEUR;
  mockNavigation = { goBack: jest.fn(), navigate: jest.fn() };
  mockRoute = {
    params: {
      contextDetailLabel: 'Gymnase de la Ville',
      date: '2026-10-07T10:00:00.000Z',
      facilityId: 'gym-ville',
      sourceType: 'facility',
    },
  };
  getFacilityPlanning.mockResolvedValue(installationAvec(2));
  getMyCollectivites.mockResolvedValue({ data: [] });
  getCollectiviteInstallations.mockResolvedValue({ data: [] });
  getCollectiviteClubs.mockResolvedValue({
    data: [{
      documentId: 'club-B',
      email: 'contact@usvilleb.fr',
      name: 'US Ville B',
      phoneNumber: '0102030405',
    }],
  });
});

afterEach(() => {
  act(() => {
    arbres.splice(0).forEach(({ arbre, client }) => {
      arbre.unmount();
      client.clear();
    });
  });
});

describe('PLANNING-PORTRAIT 2 — le texte « organisateur » suit le GESTIONNAIRE', () => {
  test('agent de mairie au compte « joueur » : texte qui parle des demandes', async () => {
    gereLaVille();
    getFacilityPlanning.mockResolvedValue(installationAvec(1));
    const lu = texte(await rendre());

    // COLL-C2B (02/10, design P5) : la mairie lit la capacite en UNE ligne (et « n demandes en
    // attente » quand il y en a) ; le texte d organisateur suit toujours le GESTIONNAIRE.
    // (La doublure de t() d ici prend toujours le pluriel ; le vrai i18next dit « 1 equipe ».)
    expect(lu).toMatch(/1 équipes? à la fois · complet/);
  });

  test('gestionnaire d une AUTRE ville : texte du membre (gerer ne suffit pas)', async () => {
    getMyCollectivites.mockResolvedValue({
      data: [{ documentId: 'ville-2', name: 'Ville voisine' }],
    });
    getCollectiviteInstallations.mockResolvedValue({ data: [{ documentId: 'autre-gym' }] });
    getFacilityPlanning.mockResolvedValue(installationAvec(1));
    const lu = texte(await rendre());

    // COLL-C2B (02/10, design P5) : un membre n a plus de bloc capacite du tout.
    expect(lu).not.toMatch(/équipes? à la fois|complet/i);
    expect(lu).not.toMatch(/demande en attente|dépassement/i);
  });

  test('« 2 slots » et « Pic 2/2 » deviennent des mots francais, pour tous', async () => {
    mockAuth = DIRIGEANT;
    const lu = texte(await rendre());

    // COLL-C2B (02/10, design P5) : une seule ligne, « 2 equipes a la fois · complet … ».
    expect(lu).toContain('2 équipes à la fois · complet');
    expect(lu).not.toMatch(/slot|Pic \d/i);
  });

  test('les VRAIES traductions (fr.js) ne disent plus « slot » ni « Pic »', () => {
    const plein = fr.personalPlanningWeekFullscreen;
    expect([plein.slots_one, plein.slots_other, plein.peak].join(' | ')).not.toMatch(/slot|Pic/i);
    expect(fr.facilityList.planning.capacityAvailable).not.toMatch(/slot/i);
    expect(plein.slots_other).toBe('{{count}} équipes à la fois');
    expect(plein.peak).toBe('Au plus chargé : {{peak}} sur {{max}}');
  });

  test('les cles neuves existent en francais ET en anglais', () => {
    const neuves = ['previousDay', 'nextDay', 'backToToday', 'rotateForWeek'];
    neuves.forEach((cle) => {
      expect(typeof fr.personalPlanningWeekFullscreen[cle]).toBe('string');
      expect(typeof en.personalPlanningWeekFullscreen[cle]).toBe('string');
    });
    const fiche = ['title', 'contactTitle', 'email', 'phone', 'noContact', 'close'];
    fiche.forEach((cle) => {
      expect(typeof fr.personalPlanningWeekFullscreen.blockSheet[cle]).toBe('string');
      expect(typeof en.personalPlanningWeekFullscreen.blockSheet[cle]).toBe('string');
    });
  });
});

describe('PLANNING-PORTRAIT 3 — le bloc d un autre club, sur le planning de la mairie', () => {
  test('la mairie touche US Ville B : club, equipe, horaires, contact', async () => {
    gereLaVille();
    const arbre = await rendre();
    const { events, onReadOnlyEventPress } = derniereGrille();
    expect(typeof onReadOnlyEventPress).toBe('function');

    await act(async () => { onReadOnlyEventPress(events[1]); });
    await attendre();
    const lu = texte(arbre);

    expect(lu).toContain('US Ville B');
    expect(lu).toContain('Seniors B');
    expect(lu).toContain('lundi 5 octobre');
    expect(lu).toContain('18:30 - 20:00');
    expect(lu).toContain('contact@usvilleb.fr');
    expect(lu).toContain('0102030405');
    expect(getCollectiviteClubs).toHaveBeenCalledWith('ville-1');
    expect(mockNavigation.navigate).not.toHaveBeenCalled();
  });

  test('club sans contact renseigne : la fiche le dit, sans rien inventer', async () => {
    gereLaVille();
    getCollectiviteClubs.mockResolvedValue({
      data: [{ documentId: 'club-B', name: 'US Ville B' }],
    });
    const arbre = await rendre();
    const { events, onReadOnlyEventPress } = derniereGrille();

    await act(async () => { onReadOnlyEventPress(events[1]); });
    await attendre();

    expect(texte(arbre)).toContain('Aucun contact renseigné par le club.');
  });

  test('un MEMBRE (joueur sans collectivite) : le bloc d un autre club reste inerte', async () => {
    await rendre();

    expect(derniereGrille().onReadOnlyEventPress).toBeUndefined();
    expect(getCollectiviteClubs).not.toHaveBeenCalled();
  });

  test('le bloc de MON club s ouvre toujours sur son evenement', async () => {
    gereLaVille();
    await rendre();
    const { events, onEventPress } = derniereGrille();

    act(() => { onEventPress(events[0]); });
    expect(mockNavigation.navigate).toHaveBeenCalledWith('EventStack', {
      params: { eventId: 'evt-A' },
      screen: 'EventDetails',
    });
  });
});

// PLANNING-PORTRAIT, greffe « planning ton A » (tranche par le chef le 01/10, suite de la
// decision d Adel « ton A » : on vouvoie la mairie, on tutoie les clubs). Le planning est
// lu par les DEUX : ses textes ne disent plus ni « tu » ni « vous » (une seule cle chacun).
// ROUGE avant : « Change de semaine… reviens », « Reessaie ou change », « Change de periode ».
const TUTOIE_OU_VOUVOIE = /\b(change|reviens|réessaie|tu|te|ton|ta|tes|toi|vous|votre|vos|changez|revenez|réessayez)\b/i;

describe('PLANNING-PORTRAIT ton A — le planning ne tutoie ni ne vouvoie personne', () => {
  test('les VRAIES traductions (fr.js) des 3 textes sont impersonnelles', () => {
    const textes = [
      fr.personalPlanningWeekFullscreen.changeWeekToExploreThe,
      fr.personalPlanningWeekFullscreen.weekPlanningLoadError,
      fr.planningWeekTimelineViewV2.changeThePeriodToSee,
    ];

    textes.forEach((texteFr) => expect(texteFr).not.toMatch(TUTOIE_OU_VOUVOIE));
    expect(textes).toEqual([
      'Les flèches mènent aux autres dates.',
      'Le planning de cette semaine n’a pas pu être chargé. Réessayer, ou changer de semaine.',
      'Les flèches mènent aux autres dates.',
    ]);
  });

  test('semaine vide, lue par la mairie : un texte impersonnel', async () => {
    gereLaVille();
    getFacilityPlanning.mockResolvedValue({ data: [], meta: installationAvec(2).meta });
    const lu = texte(await rendre());

    expect(lu).toContain('Aucun créneau cette semaine');
    expect(lu).toContain('Les flèches mènent aux autres dates.');
    expect(lu).not.toMatch(/Change de semaine|reviens/);
  });

  test('planning en erreur : un texte impersonnel', async () => {
    gereLaVille();
    getFacilityPlanning.mockRejectedValue(new Error('panne'));
    const lu = texte(await rendre());

    expect(lu).toContain('Réessayer, ou changer de semaine.');
    expect(lu).not.toMatch(/Réessaie|récupère/);
  });
});
