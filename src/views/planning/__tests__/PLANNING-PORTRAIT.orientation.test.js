import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import {
  lockToLandscape,
  lockToPortrait,
  unlockAllOrientations,
} from '@/utils/device/orientation';

import PlanningWeekFullscreen from '../PersonalPlanningWeekFullscreen';

// PLANNING-PORTRAIT (01/10, decision d Adel « D6 A ») — le planning plein ecran SUIT le
// telephone au lieu de forcer le paysage :
//   - tenu droit (portrait) : UN jour, une colonne, les fleches changent de jour ;
//   - tourne (paysage)      : la semaine, comme avant ;
//   - en sortant            : l app revient en portrait.
// Mesure de FINITIONS5 : en portrait, une semaine ne laisse que ~50 pt par jour.
// ROUGE avant le lot : l ecran appelait lockToLandscape et montrait toujours la semaine.
//
// Le « faux appareil qui tourne » : `useWindowDimensions` double, dont on change la
// taille puis qu on re-rend — ce que fait RN quand l ecran pivote.

/** @type {any} */
let mockRoute;
/** @type {any} */
let mockNavigation;
/** @type {any[]} */
const mockTimelineProps = [];
/** @type {{ width: number, height: number }} */
let mockDimensions;
/** @type {any[]} */
const mockFocusEffects = [];

const PORTRAIT = { height: 844, width: 390 };
const PAYSAGE = { height: 390, width: 844 };

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockDimensions,
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: { role: { name: 'Joueur', type: 'joueur' } } }),
}));

// Le focus est rejoue a la main : on garde l effet pour l ouvrir (entrer) et le fermer (sortir).
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (/** @type {any} */ effet) => { mockFocusEffects.push(effet); },
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

jest.mock('@/services/facility/facilityService', () => ({
  getFacilityPlanning: jest.fn(() => Promise.resolve({
    data: [{
      club: { documentId: 'club-A', name: 'AS Ville A' },
      documentId: 'evt-A',
      endAt: '2026-10-07T17:30:00.000Z',
      endTime: '19:30:00.000',
      hasExplicitTime: true,
      isOwnClub: true,
      startAt: '2026-10-07T16:00:00.000Z',
      startTime: '18:00:00.000',
      team: { name: 'Seniors A' },
      title: 'AS Ville A · Seniors A',
    }],
    meta: { facility: { documentId: 'gym-ville', maxSlots: 2, name: 'Gymnase de la Ville' } },
  })),
}));

// Lu par l ecran apres le lot (qui gere l installation ?) : un joueur ne gere rien.
jest.mock('@/services/collectivite/collectiviteService', () => ({
  getCollectiviteClubs: jest.fn(() => Promise.resolve({ data: [] })),
  getCollectiviteInstallations: jest.fn(() => Promise.resolve({ data: [] })),
  getMyCollectivites: jest.fn(() => Promise.resolve({ data: [] })),
}));

/** @type {any[]} */
const arbres = [];

const attendre = async () => {
  // React Query notifie par un setTimeout(0) : on laisse passer un tour de minuterie.
  await act(async () => {
    await new Promise((resolve) => { setTimeout(resolve, 20); });
  });
};

const rendre = async () => {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0, retry: false } } });
  const ecran = () => (
    <QueryClientProvider client={client}>
      <PlanningWeekFullscreen />
    </QueryClientProvider>
  );
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(ecran());
  });
  await attendre();
  arbres.push({ arbre, client });
  // Tourner le telephone = changer la taille de l ecran, puis re-rendre.
  const tourner = async (/** @type {{ width: number, height: number }} */ taille) => {
    mockDimensions = taille;
    await act(async () => { arbre.update(ecran()); });
    await attendre();
  };
  return { arbre, tourner };
};

const texte = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ noeud) => [].concat(noeud.props.children).join(''))
  .join(' | ');

const derniereGrille = () => mockTimelineProps[mockTimelineProps.length - 1];

const appuyer = async (/** @type {any} */ arbre, /** @type {string} */ libelle) => {
  const bouton = arbre.root.findAllByType(TouchableOpacity)
    .find((/** @type {any} */ noeud) => noeud.props.accessibilityLabel === libelle);
  if (!bouton) throw new Error(`Aucun bouton « ${libelle} »`);
  await act(async () => { bouton.props.onPress(); });
  await attendre();
};

beforeEach(() => {
  jest.clearAllMocks();
  mockTimelineProps.length = 0;
  mockFocusEffects.length = 0;
  mockDimensions = PORTRAIT;
  mockNavigation = { goBack: jest.fn(), navigate: jest.fn() };
  mockRoute = {
    params: {
      contextDetailLabel: 'Gymnase de la Ville',
      // Mercredi 7 octobre 2026.
      date: '2026-10-07T10:00:00.000Z',
      facilityId: 'gym-ville',
      sourceType: 'facility',
    },
  };
});

afterEach(() => {
  act(() => {
    arbres.splice(0).forEach(({ arbre, client }) => {
      arbre.unmount();
      client.clear();
    });
  });
});

// COLL-C2B (02/10, design P5) : la barre dit « Mer. 7 oct. », ou « 5 – 11 oct. 2026 » tourne.
describe('PLANNING-PORTRAIT — tenu droit : UN jour', () => {
  test('portrait : la grille recoit le mode « jour », sur le jour ouvert', async () => {
    const { arbre } = await rendre();

    expect(derniereGrille().mode).toBe('day');
    expect(derniereGrille().currentDate.getDate()).toBe(7);
    expect(texte(arbre)).toMatch(/mer\. 7 oct\./i);
  });

  test('portrait : les fleches changent de JOUR, pas de semaine', async () => {
    const { arbre } = await rendre();

    await appuyer(arbre, 'Jour suivant');
    expect(derniereGrille().currentDate.getDate()).toBe(8);
    expect(texte(arbre)).toMatch(/jeu\. 8 oct\./i);

    await appuyer(arbre, 'Jour précédent');
    await appuyer(arbre, 'Jour précédent');
    expect(derniereGrille().currentDate.getDate()).toBe(6);
  });

  test('portrait : changer de jour ne relit pas la semaine (un seul appel)', async () => {
    const { getFacilityPlanning } = jest.requireMock('@/services/facility/facilityService');
    const { arbre } = await rendre();
    await appuyer(arbre, 'Jour suivant');

    expect(getFacilityPlanning).toHaveBeenCalledTimes(1);
    expect(getFacilityPlanning)
      .toHaveBeenCalledWith('gym-ville', { from: '2026-10-05', to: '2026-10-11' });
  });
});

describe('PLANNING-PORTRAIT — tourne : la semaine', () => {
  test('paysage : la grille recoit le mode « semaine », comme avant', async () => {
    mockDimensions = PAYSAGE;
    const { arbre } = await rendre();

    expect(derniereGrille().mode).toBe('week');
    expect(texte(arbre)).toContain('5 – 11 oct. 2026');
  });

  test('le faux telephone tourne : portrait, paysage, portrait, sans perdre le jour', async () => {
    const { arbre, tourner } = await rendre();
    await appuyer(arbre, 'Jour suivant');
    expect(derniereGrille().mode).toBe('day');

    await tourner(PAYSAGE);
    expect(derniereGrille().mode).toBe('week');
    expect(texte(arbre)).toContain('5 – 11 oct. 2026');

    await tourner(PORTRAIT);
    expect(derniereGrille().mode).toBe('day');
    expect(texte(arbre)).toMatch(/jeu\. 8 oct\./i);
  });

  test('paysage : les fleches changent de semaine', async () => {
    mockDimensions = PAYSAGE;
    const { arbre } = await rendre();

    await appuyer(arbre, 'Semaine suivante');
    expect(texte(arbre)).toContain('12 – 18 oct. 2026');
  });
});

describe('PLANNING-PORTRAIT — l orientation n est plus forcee', () => {
  test('entrer LIBERE l orientation (pas de paysage force) ; sortir : portrait', async () => {
    await rendre();
    jest.useFakeTimers();
    try {
      const effet = mockFocusEffects[mockFocusEffects.length - 1];
      /** @type {any} */
      let sortir;
      act(() => { sortir = effet(); });
      act(() => { jest.advanceTimersByTime(50); });

      expect(unlockAllOrientations).toHaveBeenCalledTimes(1);
      expect(lockToLandscape).not.toHaveBeenCalled();
      expect(lockToPortrait).not.toHaveBeenCalled();

      act(() => { sortir(); });
      expect(lockToPortrait).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });
});
