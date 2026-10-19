/* eslint-disable max-len -- des phrases entieres de l ecran, comparees telles quelles */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import EventEdit, { getEventEditHeaderTitle } from '../EventEdit';

// 🚚 COLL-R-DEPLACER A8 (14/10/2026, COL-013) — LE MODE « DÉPLACER » DE L'ÉCRAN DE MODIFICATION
// (aucune route neuve, prompt du lot point 3). `route.params.mode === 'deplacer'` : le tunnel
// « Déplacer la séance » (`as: 'ville'` : la Ville propose). Un serveur d'AVANT ce lot ne connaît
// pas la route des places : l'écran rend la modification de la séance, comme avant, sans planter,
// et remet son en-tête.
// ROUGES avant le lot : le mode n'existait pas, l'écran ouvrait toujours le formulaire général.
//
// Les doublures ci-dessous sont celles d'EventEditEvedit3Ouverture.test.js (le formulaire réel).

jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : cle
    ),
  }),
}));

// Publie en TypeScript non transforme : sans doublure, la SUITE ENTIERE meurt
// au chargement et aucun test ne s'execute (piege connu du depot).
jest.mock('react-native-gesture-handler', () => {
  const { ScrollView: DefilementRN } = jest.requireActual('react-native');
  return { ScrollView: DefilementRN };
});

// ⛔ Jamais un Proxy pour le theme : il rend les echecs Jest illisibles.
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
      Images: new Proxy({}, { get: () => 1 }),
      Spaces: espaces,
    }),
  };
});

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    userData: {
      club: { documentId: 'club-1' },
      documentId: 'user-1',
      role: { name: 'Entraineur' },
      trainedTeams: [{ club: { documentId: 'club-1' }, documentId: 'team-1', name: 'U15' }],
    },
  }),
}));

// FINITIONS11-COLL (03/10) : le juge du déplacement (aperçu au nom du club) lit le serveur ; ici,
// il ne dit jamais « mairie » (la phrase a son témoin : EventEditFIN11COLL).
jest.mock('@/services/seasonSlot/seasonSlotQueries', () => ({
  useMairieDecideDuDeplacement: () => false,
}));
// ⛔ Jamais `requireActual` sur un service : le client HTTP exige `API_URL`,
// absent de toute copie de travail, et la suite entiere meurt au chargement.
jest.mock('@/services/event/eventService', () => ({
  createEvent: jest.fn(() => Promise.resolve({})),
  getEventByIdForEdit: jest.fn(() => Promise.resolve(null)),
  getEventTypes: jest.fn(() => Promise.resolve([
    { documentId: 'type-entrainement', name: 'Entrainement' },
  ])),
  updateEvent: jest.fn(() => Promise.resolve({})),
}));

jest.mock('@/services/team/teamService', () => ({
  getTeams: jest.fn(() => Promise.resolve({ data: [] })),
}));

jest.mock('@/components/molecules/autocompleteSelect/AutocompleteSelect', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function AutocompleteSelectDouble(/** @type {any} */ props) {
    return react.createElement(rn.View, {
      testID: `select-${props.label || 'sans-libelle'}`,
    });
  };
});

// 🎯 LA DOUBLURE QUI FAIT LE TRAVAIL : elle garde `disabled` ET `onPress`.
// Sans `disabled`, on ne verrait pas que « Enregistrer » REFUSE ; sans
// `onPress`, on ne pourrait pas appuyer sur « Reessayer ».
jest.mock('@/components/atoms/button/Button', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function BoutonDouble(/** @type {any} */ props) {
    return react.createElement(rn.View, {
      disabled: Boolean(props.disabled),
      onPress: props.onPress,
      testID: `bouton-${props.title || 'sans-titre'}`,
    });
  };
});
/* eslint-disable global-require */
jest.mock(
  '@/components/molecules/datePickerInput/DatePickerInput',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_DatePickerInput'),
);
jest.mock(
  '@/components/molecules/dayPicker/DayPicker',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_DayPicker'),
);
jest.mock(
  '@/components/molecules/input/Input',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_Input'),
);
jest.mock(
  '@/components/molecules/timePickerInput/TimePickerInput',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_TimePickerInput'),
);
jest.mock(
  '@/components/organisms/facilitySelector/FacilitySelector',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_FacilitySelector'),
);
jest.mock('@/components/templates/ScreenContainer', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function ScreenContainerDouble(/** @type {any} */ props) {
    return react.createElement(rn.View, null, props.children);
  };
});
jest.mock(
  '../components/EventTasksEditor',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_EventTasksEditor'),
);
jest.mock(
  '../components/EventTeamAudiencesEditor',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_EventTeamAudiencesEditor'),
);
/* eslint-enable global-require */

// Le tunnel lui-même a ses témoins (deplacer/__tests__/DeplacerLaSeance.CRDEP.test.js) : ici, une
// doublure qui dit ce qu'on lui passe et qui sait jouer « serveur d'avant ».
jest.mock('../deplacer/DeplacerLaSeance', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function TunnelDouble(/** @type {any} */ props) {
    return react.createElement(rn.View, {
      eventId: props.eventId,
      onPress: props.onIndisponible,
      proposalId: props.proposalId,
      testID: 'tunnel-deplacer',
      viewer: props.viewer,
    });
  };
});

jest.setTimeout(30000);

const eventService = jest.requireMock('@/services/event/eventService');
const BOUTON_ENREGISTRER = 'bouton-eventEdit.actions.save';

/** @type {any} */
let arbre = null;
/** @type {any} */
let navigation = null;

const laisserRepondre = async () => {
  for (let tour = 0; tour < 6; tour += 1) {
    // eslint-disable-next-line no-await-in-loop -- les tours sont sequentiels par nature
    await act(async () => {
      await new Promise((resoudre) => { setTimeout(resoudre, 0); });
    });
  }
};

const monterEcran = async (/** @type {Record<string, string>} */ params) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  navigation = {
    goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn(), setOptions: jest.fn(),
  };
  await act(async () => {
    arbre = renderer.create(createElement(
      QueryClientProvider,
      { client },
      createElement(EventEdit, { navigation, route: { params } }),
    ));
  });
  await laisserRepondre();
};

const trouver = (/** @type {string} */ testID) => arbre.root.findAll(
  (/** @type {any} */ noeud) => noeud.props?.testID === testID,
)[0];

beforeEach(() => {
  jest.clearAllMocks();
  eventService.getEventTypes.mockResolvedValue([{ documentId: 'type-entrainement', name: 'Entrainement' }]);
  eventService.getEventByIdForEdit.mockResolvedValue({
    date: '2030-05-15T18:30:00.000Z',
    documentId: 'event-1',
    endTime: '20:00:00.000',
    facility: { documentId: 'facility-1' },
    startTime: '18:30:00.000',
    team: { club: { documentId: 'club-1' }, documentId: 'team-1' },
    type: { documentId: 'type-entrainement', name: 'Entrainement' },
  });
});

afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
});

describe('CRDEP · le mode « déplacer » de la modification', () => {
  test('mode « deplacer » : le tunnel, pour le club ; le formulaire général ne se monte pas', async () => {
    await monterEcran({ eventId: 'event-1', mode: 'deplacer' });
    const tunnel = trouver('tunnel-deplacer');
    expect(tunnel).toBeTruthy();
    expect(tunnel.props.eventId).toBe('event-1');
    expect(tunnel.props.viewer).toBe('club');
    expect(trouver(BOUTON_ENREGISTRER)).toBeUndefined();
    expect(eventService.getEventByIdForEdit).not.toHaveBeenCalled();
  });

  test('`as: ville` : le tunnel de la Ville (elle propose)', async () => {
    await monterEcran({ as: 'ville', eventId: 'event-1', mode: 'deplacer' });
    expect(trouver('tunnel-deplacer').props.viewer).toBe('ville');
  });

  test('« Choisir une autre place » : la proposition de la Ville voyage jusqu au tunnel', async () => {
    await monterEcran({ eventId: 'event-1', mode: 'deplacer', proposalId: 'prop-1' });
    expect(trouver('tunnel-deplacer').props.proposalId).toBe('prop-1');
  });

  test('serveur d’avant (route des places absente) : la modification de la séance, comme avant, avec son en-tête', async () => {
    await monterEcran({ eventId: 'event-1', mode: 'deplacer' });
    await act(async () => { trouver('tunnel-deplacer').props.onPress(); });
    await laisserRepondre();
    expect(trouver('tunnel-deplacer')).toBeUndefined();
    expect(trouver(BOUTON_ENREGISTRER)).toBeTruthy();
    expect(navigation.setOptions).toHaveBeenCalledWith(expect.objectContaining({ headerShown: true }));
  });

  test('sans mode : la modification de toujours', async () => {
    await monterEcran({ eventId: 'event-1' });
    expect(trouver('tunnel-deplacer')).toBeUndefined();
    expect(trouver(BOUTON_ENREGISTRER)).toBeTruthy();
  });

  test('le titre de la pile : « Déplacer la séance » en mode déplacer, inchangé sinon', () => {
    const t = (/** @type {string} */ cle, /** @type {any} */ repli) => (typeof repli === 'string' ? repli : cle);
    expect(getEventEditHeaderTitle({ params: { eventId: 'e', mode: 'deplacer' } }, t)).toBe('Déplacer la séance');
    expect(getEventEditHeaderTitle({ params: { eventId: 'e' } }, t)).toBe('eventEdit.titleEdit');
    expect(getEventEditHeaderTitle({ params: {} }, t)).toBe('eventEdit.title');
  });
});
