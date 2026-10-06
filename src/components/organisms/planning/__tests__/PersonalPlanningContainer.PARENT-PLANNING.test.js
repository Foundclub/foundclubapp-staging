import renderer, { act } from 'react-test-renderer';

// PARENT-PLANNING (06/10/2026) — 4. LE SITE : LA LISTE DU PLANNING NE DOIT PAS ATTENDRE UN
// CALENDRIER QUI NE REPONDRA JAMAIS.
//
// Sur le web, « Mon planning » ne charge sa liste d evenements qu une fois le calendrier du
// haut servi (`ParticipantEventList.js` : onDataResolved -> isPlanningContentReady ->
// shouldLoadSecondaryPlanningData -> shouldLoadEventFeed). Ce calendrier lit
// `GET /users/me/planning`, que le role Parent n a PAS le droit de lire (`admin`
// src/index.ts, bloc Parent : pas de `api::event.event.getMyPlanning`) : la requete echoue,
// `onDataResolved` n etait jamais appele, et la liste (les evenements de l enfant compris)
// ne partait jamais sur le site.
//
// Ce fichier est aussi le premier temoin de ce conteneur (E6) : il caracterise d abord ce qui
// marchait (donnees recues -> un seul signal), puis exige le signal sur un echec.

const mockUseQuery = jest.fn();

jest.mock('@tanstack/react-query', () => ({
  useQuery: (/** @type {any} */ options) => mockUseQuery(options),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));

jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));

jest.mock('@/theme/themeContext', () => {
  const styleLeaf = {};
  const makeRamp = () => new Proxy({}, { get: () => styleLeaf });
  return {
    __esModule: true,
    default: () => ({
      Alignments: makeRamp(),
      Colors: new Proxy({}, { get: (_target, key) => `couleur-${String(key)}` }),
      Fonts: makeRamp(),
      Spaces: new Proxy({}, { get: () => makeRamp() }),
    }),
  };
});

// `.env` n existe dans aucune copie de travail : le service est double.
jest.mock('@/services/event/eventService', () => ({
  getMyPlanning: jest.fn(),
}));

/* eslint-disable global-require */
jest.mock(
  '@/components/atoms/loader/Loader',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_Loader'),
);
jest.mock(
  '@/components/molecules/segmentedControl/SegmentedControl',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_SegmentedControl'),
);
jest.mock(
  '@/components/organisms/planning/PlanningFullscreenButton',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_PlanningFullscreenButton'),
);
jest.mock(
  '@/components/organisms/planningCalendarView',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_PlanningCalendarView'),
);
jest.mock(
  '@/components/organisms/planningWeekTimelineView',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_PlanningWeekTimelineView'),
);
/* eslint-enable global-require */

// eslint-disable-next-line import/first
import PersonalPlanningContainer from '../PersonalPlanningContainer';

/** @type {any} */
let arbre = null;

/**
 * Monte le calendrier avec l etat de requete donne.
 * @param {any} etat - Ce que rend `useQuery`.
 * @param {jest.Mock} onDataResolved - Le signal attendu par la liste.
 */
const monter = (etat, onDataResolved) => {
  mockUseQuery.mockReturnValue(etat);
  act(() => {
    arbre = renderer.create(<PersonalPlanningContainer onDataResolved={onDataResolved} />);
  });
};

afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
  mockUseQuery.mockReset();
});

describe('PARENT-PLANNING / 4 — le calendrier libere la liste du planning', () => {
  test('4-1 CARACTERISATION — donnees recues : la liste est liberee, une seule fois', () => {
    const onDataResolved = jest.fn();
    monter({ data: { data: [] }, isError: false, isLoading: false }, onDataResolved);
    act(() => arbre.update(<PersonalPlanningContainer onDataResolved={onDataResolved} />));
    expect(onDataResolved).toHaveBeenCalledTimes(1);
  });

  test('4-2 CARACTERISATION — encore en lecture : la liste attend', () => {
    const onDataResolved = jest.fn();
    monter({ data: undefined, isError: false, isLoading: true }, onDataResolved);
    expect(onDataResolved).not.toHaveBeenCalled();
  });

  test('4-3 ROUGE-AVANT — calendrier refuse (Parent, 403) : la liste est liberee', () => {
    const onDataResolved = jest.fn();
    monter({ data: undefined, isError: true, isLoading: false }, onDataResolved);
    expect(onDataResolved).toHaveBeenCalledTimes(1);
  });
});
