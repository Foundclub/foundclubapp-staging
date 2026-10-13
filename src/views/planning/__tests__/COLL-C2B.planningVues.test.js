import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Modal, Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import {
  getCollectiviteClubs,
  getCollectiviteInstallations,
  getMyCollectivites,
} from '@/services/collectivite/collectiviteService';
import { getFacilityPlanning } from '@/services/facility/facilityService';
import {
  attributeSeasonSlot,
  getClubTeamsForSlot,
  getSeasonSlot,
  listFacilitySeasonSlots,
  previewFacilitySeasonSlot,
} from '@/services/seasonSlot/seasonSlotService';

import {
  CLE_VUE_RETENUE,
  vueParDefaut,
  vuesProposees,
} from '@/utils/planning/installationPlanningViews';

import PlanningWeekFullscreen from '../PersonalPlanningWeekFullscreen';

// 📐 COLL-C2B (02/10/2026), planche 5 du design HY521H1 : « P5v2-vues-tel » et « P5v2-vues-ordi » —
// LES 5 VUES du planning d une installation, et « toucher pour agir ». Le vrai fr.js ecrit les
// phrases ; la grille et le calendrier sont doubles (on lit ce qu ils recoivent).
//
// Les temoins attendus par le prompt du lot (ROUGES avant : une seule vue, sans choix) :
//   - les 5 vues existent (Jour, 3 jours, Semaine, Mois, Liste) ; Jour par defaut sur telephone ;
//     la vue choisie est RETENUE ; telephone tourne : la semaine ; le site : Semaine par defaut ;
//   - la mairie touche une heure libre ⇒ « Attribuer pour la saison », deja rempli ; elle touche
//     un creneau ⇒ « Modifier le creneau », « Retirer le creneau » (D67) ;
//   - les plateaux en vue Jour : une colonne par plateau ; rien en vue Semaine ;
//   - un membre non gestionnaire n a AUCUN geste d ecriture (ni heure libre, ni « Attribuer »).

const i18nextTemoin = require('i18next');

const frTemoin = require('@/theme/strings/translations/fr');

(i18nextTemoin.default || i18nextTemoin).init({
  compatibilityJSON: 'v4',
  fallbackLng: 'fr',
  lng: 'fr',
  resources: { fr: { translation: frTemoin.default } },
});

const PORTRAIT = { height: 844, width: 390 };
const PAYSAGE = { height: 390, width: 844 };

/** @type {any} */
let mockRoute;
/** @type {any} */
let mockNavigation;
/** @type {any[]} */
const mockTimelineProps = [];
/** @type {any} */
let mockAuth;
/** @type {any} */
let mockDimensions = PORTRAIT;

// COLL-R-A7 (COL-005) : le tunnel plein écran rend le vrai gabarit des tunnels ; la marge du dépôt.
jest.setTimeout(30000);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockDimensions,
}));
jest.mock('@/responsive', () => ({ useIsDesktop: () => false }));
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
    t: (/** @type {any[]} */ ...args) => jest.requireActual('i18next').t(...args),
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
      Images: { arrowLeft: 1, arrowRight: 2, close: 3 },
      Spaces: espaces,
    }),
  };
});
jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);
jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() { return null; });
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
/** @type {any[]} */
const mockCalendarProps = [];
jest.mock('@/components/organisms/planningCalendarView', () => function CalendarMock(
  /** @type {any} */ props,
) {
  mockCalendarProps.push(props);
  return null;
});
/** @type {any} */
let mockVueRetenue;
const mockSetItem = jest.fn();
jest.mock('@/platform/storage', () => ({
  ...jest.requireActual('@/platform/storage'),
  getItem: () => mockVueRetenue,
  setItem: (/** @type {any[]} */ ...args) => mockSetItem(...args),
}));
/** @type {any[]} */
const mockInputProps = [];
jest.mock('@/components/molecules/input/Input', () => function InputMock(/** @type {any} */ props) {
  mockInputProps.push(props);
  return null;
});
jest.mock(
  '@/components/molecules/datePickerInput/DatePickerInput',
  () => function DatePickerInputMock() { return null; },
);
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const {
    Text: TexteRN, TouchableOpacity: PressableRN,
  } = jest.requireActual('react-native');
  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      { disabled: props.disabled, onPress: props.onPress },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
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
// COLL-C4B-BIS (03/10) : le planning lit aussi les fermetures (panneau sur ordinateur, bandeau).
jest.mock('@/services/facilityClosure/facilityClosureService', () => ({
  closeFacility: jest.fn(),
  listCollectiviteClosures: jest.fn(),
  listFacilityClosures: jest.fn(async () => ({ data: [], meta: {} })),
  modifyFacilityClosure: jest.fn(),
  previewFacilityClosure: jest.fn(),
  reopenFacilityClosure: jest.fn(),
}));
jest.mock('@/services/facility/facilityService', () => ({ getFacilityPlanning: jest.fn() }));
jest.mock('@/services/collectivite/collectiviteService', () => ({
  getCollectiviteClubs: jest.fn(),
  getCollectiviteInstallations: jest.fn(),
  getMyCollectivites: jest.fn(),
}));
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

// Des secrets semes : si l un s affiche, la mairie lirait une personne.
const SECRETS = ['Jeanne', 'SECRET-NOM', 'jeanne.secret@exemple.fr'];
const PERSONNE = { email: SECRETS[2], firstname: SECRETS[0], lastname: SECRETS[1] };

const bloc = (/** @type {any} */ champs) => ({
  createdBy: PERSONNE,
  endAt: '2026-03-04T18:30:00.000Z',
  endTime: '19:30:00.000',
  facility: { documentId: 'gym-ville', name: 'Gymnase de la Ville', planningColor: null },
  hasExplicitTime: true,
  kind: 'event',
  leagueMatch: false,
  origin: 'club',
  pending: false,
  plateau: null,
  slot: null,
  startAt: '2026-03-04T17:00:00.000Z',
  startTime: '18:00:00.000',
  ...champs,
});
const BLOC_DE_MON_CLUB = bloc({
  club: { documentId: 'club-A', name: 'AS Ville A' },
  documentId: 'evt-A',
  isOwnClub: true,
  team: { name: 'Seniors A', trainers: [PERSONNE] },
  title: 'AS Ville A · Seniors A',
});
const BLOC_D_UN_AUTRE_CLUB = bloc({
  club: { documentId: 'club-B', name: 'US Ville B', president: PERSONNE },
  documentId: null,
  endAt: '2026-03-04T19:00:00.000Z',
  endTime: '20:00:00.000',
  isOwnClub: false,
  kind: 'slot',
  origin: 'slot',
  slot: {
    documentId: 'slot-B',
    source: 'attribution',
    validFrom: '2025-09-01',
    validUntil: '2026-06-30',
    weekday: 3,
  },
  startAt: '2026-03-04T17:30:00.000Z',
  startTime: '18:30:00.000',
  team: { name: 'Seniors B' },
  title: 'US Ville B · Seniors B',
});
const BLOC_EN_ATTENTE = bloc({
  club: { documentId: 'club-A', name: 'AS Ville A' },
  documentId: null,
  isOwnClub: false,
  origin: 'request',
  pending: true,
  team: { name: 'U13' },
  title: 'AS Ville A · U13',
});

const reponse = (/** @type {any[]} */ blocs) => ({
  data: blocs,
  meta: {
    facility: {
      capacityConflictMode: 'pending_validation',
      documentId: 'gym-ville',
      maxSlots: 2,
      name: 'Gymnase de la Ville',
      plateaux: [],
    },
  },
});

const JOUEUR = { userData: { role: { name: 'Joueur', type: 'joueur' } } };
const gereLaVille = () => {
  /** @type {any} */ (getMyCollectivites).mockResolvedValue({
    data: [{ documentId: 'ville-1', name: 'Ville de Montrivage' }],
  });
  /** @type {any} */ (getCollectiviteInstallations).mockResolvedValue({
    data: [{ documentId: 'gym-ville', maxSlots: 2, name: 'Gymnase de la Ville' }],
  });
};

/** @type {any[]} */
const montes = [];
const attendre = async () => {
  await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 20); }); });
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
  await attendre();
  await attendre();
  await attendre();
  montes.push({ arbre, client });
  return arbre;
};
const aplatir = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
  return String(enfants).replace(/\u00a0/g, ' ');
};
const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ noeud) => aplatir(noeud.props.children).trim());
const parTexte = (/** @type {any} */ arbre, /** @type {string} */ libelle) => arbre.root
  .findAllByType(TouchableOpacity)
  .filter((/** @type {any} */ noeud) => noeud.findAllByType(Text)
    .some((/** @type {any} */ texte) => aplatir(texte.props.children).trim() === libelle))
  .pop();
const parLibelle = (/** @type {any} */ arbre, /** @type {string} */ libelle) => arbre.root
  .findAllByType(TouchableOpacity)
  .find((/** @type {any} */ noeud) => noeud.props.accessibilityLabel === libelle);
const grille = () => mockTimelineProps[mockTimelineProps.length - 1];

beforeEach(() => {
  jest.clearAllMocks();
  mockTimelineProps.length = 0;
  mockCalendarProps.length = 0;
  mockInputProps.length = 0;
  mockVueRetenue = undefined;
  mockDimensions = PORTRAIT;
  mockAuth = JOUEUR;
  mockNavigation = {
    goBack: jest.fn(), navigate: jest.fn(), setOptions: jest.fn(), setParams: jest.fn(),
  };
  mockRoute = {
    params: {
      contextDetailLabel: 'Gymnase de la Ville',
      date: '2026-03-04T10:00:00.000Z',
      facilityId: 'gym-ville',
      sourceType: 'facility',
    },
  };
  /** @type {any} */ (getFacilityPlanning).mockResolvedValue(
    reponse([BLOC_DE_MON_CLUB, BLOC_D_UN_AUTRE_CLUB, BLOC_EN_ATTENTE]),
  );
  /** @type {any} */ (getMyCollectivites).mockResolvedValue({ data: [] });
  /** @type {any} */ (getCollectiviteInstallations).mockResolvedValue({ data: [] });
  /** @type {any} */ (getCollectiviteClubs).mockResolvedValue({
    data: [{ documentId: 'club-B', email: 'contact@usvilleb.fr', name: 'US Ville B' }],
  });
});

afterEach(() => {
  act(() => {
    montes.splice(0).forEach(({ arbre, client }) => {
      arbre.unmount();
      client.clear();
    });
  });
});

const vues = (/** @type {any} */ arbre) => arbre.root.findAllByType(TouchableOpacity)
  .filter((/** @type {any} */ noeud) => noeud.props.accessibilityRole === 'tab'
    && String(noeud.props.testID || '').startsWith('vue-'));
const choisir = async (/** @type {any} */ arbre, /** @type {string} */ vue) => {
  const bouton = arbre.root.findAllByType(TouchableOpacity)
    .find((/** @type {any} */ noeud) => noeud.props.testID === `vue-${vue}`);
  await act(async () => { bouton.props.onPress(); });
  await attendre();
};

describe('COLL-C2B planche 5 — les 5 vues', () => {
  it('Jour, 3 jours, Semaine, Mois, Liste ; Jour par defaut sur telephone', async () => {
    const arbre = await rendre();
    const lus = textes(arbre);
    ['Jour', '3 jours', 'Semaine', 'Mois', 'Liste'].forEach((vue) => expect(lus).toContain(vue));
    expect(vues(arbre)).toHaveLength(5);
    expect(grille().mode).toBe('day');
  });

  it('le site : Semaine par defaut, et pas de « 3 jours »', () => {
    expect(vueParDefaut('web')).toBe('week');
    expect(vuesProposees('web')).toEqual(['day', 'week', 'month', 'list']);
    expect(vueParDefaut('android')).toBe('day');
    expect(vuesProposees('ios')).toHaveLength(5);
  });

  it('Semaine, puis 3 jours (la veille, le jour, le lendemain)', async () => {
    const arbre = await rendre();
    await choisir(arbre, 'week');
    expect(grille().mode).toBe('week');
    expect(textes(arbre)).toContain('2 – 8 mars 2026');
    await choisir(arbre, '3days');
    expect(grille().mode).toBe('3days');
    expect(grille().currentDate.getDate()).toBe(3);
    expect(textes(arbre)).toContain('Mar. 3 mars – jeu. 5 mars');
    await act(async () => { parLibelle(arbre, 'Jours suivants').props.onPress(); });
    await attendre();
    expect(grille().currentDate.getDate()).toBe(6);
  });

  it('la vue choisie est RETENUE, et se relit a la prochaine ouverture', async () => {
    const arbre = await rendre();
    await choisir(arbre, 'list');
    expect(mockSetItem).toHaveBeenCalledWith(CLE_VUE_RETENUE, 'list');
    expect(textes(arbre)).toContain('Mercredi 4 · complet 18:30 – 19:30');

    mockVueRetenue = 'list';
    const autre = await rendre();
    expect(textes(autre)).toContain('Lundi 2');
  });

  it('Mois : le calendrier des clubs, colore par club, puis « Ouvrir la journee »', async () => {
    const arbre = await rendre();
    await choisir(arbre, 'month');
    const calendrier = mockCalendarProps[mockCalendarProps.length - 1];
    expect(calendrier.currentDate.getDate()).toBe(4);
    const colores = calendrier.events
      .every((/** @type {any} */ evenement) => Boolean(evenement.displayColor));
    expect(colores).toBe(true);
    expect(getFacilityPlanning)
      .toHaveBeenLastCalledWith('gym-ville', { from: '2026-03-01', to: '2026-03-31' });
    expect(textes(arbre)).toContain('Mars 2026');
    await act(async () => { parTexte(arbre, 'Ouvrir la journée').props.onPress(); });
    await attendre();
    expect(grille().mode).toBe('day');
  });

  it('telephone tourne : la semaine, meme si la Liste est retenue', async () => {
    mockVueRetenue = 'list';
    mockDimensions = PAYSAGE;
    await rendre();
    expect(grille().mode).toBe('week');
  });
});

describe('COLL-C2B planche 5 — la mairie touche pour agir', () => {
  beforeEach(() => {
    gereLaVille();
    /** @type {any} */ (listFacilitySeasonSlots).mockResolvedValue({
      data: [],
      meta: {
        canManage: true,
        facility: { maxSlots: 2, name: 'Gymnase de la Ville', plateaux: [] },
        season: { validFrom: '2025-09-01', validUntil: '2026-06-30' },
      },
    });
    /** @type {any} */ (previewFacilitySeasonSlot).mockResolvedValue({
      data: {
        capacity: 2, needsConfirmation: false, occupants: [], peak: 0, remaining: 2, teamsAfter: 1,
      },
    });
    /** @type {any} */ (getSeasonSlot).mockResolvedValue({
      data: { documentId: 'slot-B', sessionsCount: 4 }, meta: { canManage: true },
    });
  });

  it('une heure libre ⇒ « Attribuer pour la saison », deja remplie', async () => {
    /** @type {any} */ (getClubTeamsForSlot).mockResolvedValue([]);
    /** @type {any} */ (attributeSeasonSlot).mockResolvedValue({
      data: { documentId: 'slot-neuf' },
    });
    const arbre = await rendre();
    expect(typeof grille().onFreeSlotPress).toBe('function');
    await act(async () => { grille().onFreeSlotPress(new Date(2026, 2, 4), 17); });
    await attendre();
    const lus = textes(arbre);
    // COLL-R-A7 (COL-005) : le moment de la case, au sous-titre du plein écran (et l'installation).
    expect(lus).toEqual(expect.arrayContaining([
      expect.stringMatching(/^Mercredi 17:00 – 18:30( · .+)?$/),
    ]));
    // IPH09 : la confirmation n'apparaît qu'au récapitulatif. COLL-R-A7 (COL-005) : depuis une
    // heure libre, Jour, Horaires et Période sont sautés (la case les apporte) : 3 étapes.
    // COLL-R-A7 (COL-005, planche P4v4-attribuer « Planning 3/3 ») : au téléphone, le tunnel
    // s'ouvre en PLEIN ÉCRAN et son bouton dit « Attribuer le créneau » (la période est au
    // récapitulatif). ROUGE avant : une feuille du bas, « Attribuer pour la saison ».
    expect(arbre.root.findByType(Modal).props.presentationStyle).toBe('fullScreen');
    expect(parTexte(arbre, 'Attribuer le créneau')).toBeUndefined();
    expect(textes(arbre)).toContain('Étape 1/3');
    const club = parTexte(arbre, 'US Ville B');
    expect(club.props.accessibilityRole).toBe('radio');
    await act(async () => { club.props.onPress(); });
    await attendre();
    for (let etape = 1; etape <= 2; etape += 1) {
      expect(textes(arbre)).toContain(`Étape ${etape}/3`);
      expect(attributeSeasonSlot).not.toHaveBeenCalled();
      const suivant = parTexte(arbre, 'Suivant');
      expect(suivant).toBeDefined();
      expect(suivant.props.disabled).not.toBe(true);
      // eslint-disable-next-line no-await-in-loop -- chaque étape dépend de la précédente
      await act(async () => { suivant.props.onPress(); });
      // eslint-disable-next-line no-await-in-loop -- attendre le rendu de l'étape suivante
      await attendre();
    }
    expect(textes(arbre)).toContain('Étape 3/3');
    expect(parTexte(arbre, 'Attribuer le créneau')).toBeDefined();
    const attendu = expect.objectContaining({ endTime: '18:30', startTime: '17:00', weekday: 3 });
    expect(previewFacilitySeasonSlot).toHaveBeenLastCalledWith('gym-ville', attendu);
    await act(async () => { parTexte(arbre, 'Attribuer le créneau').props.onPress(); });
    await attendre();
    expect(attributeSeasonSlot).toHaveBeenCalledTimes(1);
    expect(attributeSeasonSlot).toHaveBeenCalledWith('gym-ville', {
      club: 'club-B', endTime: '18:30', startTime: '17:00', weekday: 3,
    });
  });

  it('la Liste : chaque journee libre se touche pour attribuer', async () => {
    const arbre = await rendre();
    await choisir(arbre, 'list');
    const libre = arbre.root.findAllByType(TouchableOpacity)
      .find((/** @type {any} */ noeud) => noeud.props.testID === 'libre-2026-03-08');
    expect(libre).toBeDefined();
    expect(textes(arbre)).toContain('Libre toute la journée');
    await act(async () => { libre.props.onPress(); });
    await attendre();
    expect(textes(arbre)).toEqual(expect.arrayContaining([
      expect.stringMatching(/^Dimanche 08:00 – 09:30( · .+)?$/),
    ]));
  });

  it('un creneau attribue ⇒ « Modifier le creneau », « Retirer le creneau » (D67)', async () => {
    const arbre = await rendre();
    const { events, onReadOnlyEventPress } = grille();
    await act(async () => {
      onReadOnlyEventPress(events
        .find((/** @type {any} */ evenement) => evenement.club?.name === 'US Ville B'));
    });
    await attendre();
    expect(parTexte(arbre, 'Modifier le créneau')).toBeDefined();
    await act(async () => { parTexte(arbre, 'Retirer le créneau').props.onPress(); });
    await attendre();
    expect(getSeasonSlot).toHaveBeenCalledWith('slot-B');
    expect(textes(arbre)).toContain(
      'Ses entraînements déjà posés sur ce créneau restent : le club les garde ou les '
        + 'annule lui-même.',
    );
  });

  it('une seance du club ou une demande : ni Modifier ni Retirer', async () => {
    const arbre = await rendre();
    const { events, onReadOnlyEventPress } = grille();
    await act(async () => {
      onReadOnlyEventPress(events
        .find((/** @type {any} */ evenement) => evenement.team?.name === 'U13'));
    });
    await attendre();
    expect(parTexte(arbre, 'Modifier le créneau')).toBeUndefined();
    expect(parTexte(arbre, 'Retirer le créneau')).toBeUndefined();
  });
});

describe('COLL-C2B planche 5 — les plateaux en vue Jour (D66)', () => {
  it('une colonne par plateau en vue Jour ; rien en vue Semaine', async () => {
    /** @type {any} */ (getFacilityPlanning).mockResolvedValue({
      ...reponse([
        BLOC_DE_MON_CLUB,
        { ...BLOC_D_UN_AUTRE_CLUB, plateau: { name: 'Plateau B', number: 2 } },
      ]),
      meta: {
        facility: {
          documentId: 'gym-ville',
          maxSlots: 2,
          name: 'Gymnase de la Ville',
          plateaux: ['Plateau A', 'Plateau B'],
        },
      },
    });
    const arbre = await rendre();
    const { events, laneOf, lanes } = grille();
    expect(lanes.map((/** @type {any} */ colonne) => colonne.label))
      .toEqual(['Plateau A', 'Plateau B', 'Indifférent']);
    const deB = events
      .find((/** @type {any} */ evenement) => evenement.club?.name === 'US Ville B');
    const deA = events.find((/** @type {any} */ evenement) => evenement.documentId === 'evt-A');
    expect(laneOf(deB)).toBe(1);
    expect(laneOf(deA)).toBe(2);

    await choisir(arbre, 'week');
    expect(grille().lanes).toBeUndefined();
  });
});

describe('COLL-C2B planche 5 — un membre consulte, sans plus', () => {
  it('ni heure libre a toucher, ni « Attribuer » dans la Liste', async () => {
    const arbre = await rendre();
    expect(grille().onFreeSlotPress).toBeUndefined();
    await choisir(arbre, 'list');
    expect(parTexte(arbre, 'Attribuer')).toBeUndefined();
    expect(textes(arbre)).toContain('Libre toute la journée');
  });
});
