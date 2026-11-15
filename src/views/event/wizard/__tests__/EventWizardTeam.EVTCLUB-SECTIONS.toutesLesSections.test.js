import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import { EventWizardProvider, useEventWizard } from '../EventWizardContext';
import EventWizardTeam from '../EventWizardTeam';

// EVT-CLUB-SECTIONS (15/11/2026, R6 B, decision d Adel « 340 » : « A et B ») — dans un
// omnisports, l admin de l omnisports lui-meme voit, en plus de « Tous les membres du club » (la
// section, R6 A), la carte « Toutes les sections », avec le nombre de personnes de la reunion
// (apercu serveur `scope=all_sections`). Personne d autre : ni le dirigeant d une section, ni un
// entraineur. Un club simple ne change pas. Doublures : celles de
// `EventWizardTeam.EVTCLUB.toutLeClub.test.js`.

const mockAuth = { adminOmnisport: true, estDirigeant: true, omnisport: true };
const mockApercus = [];
const mockRecherche = { props: null };
const mockApercuSections = {
  data: {
    audienceScope: 'all_sections',
    counts: {
      children: 70,
      coaches: 18,
      members: 9,
      parents: 60,
      players: 200,
      total: 287,
    },
    multisport: true,
  },
  error: null,
  isLoading: false,
};
const mockApercu = {
  data: {
    audienceScope: 'club',
    counts: {
      children: 51,
      coaches: 10,
      members: 6,
      parents: 41,
      players: 111,
      total: 168,
    },
    multisport: false,
  },
  error: null,
  isLoading: false,
};

jest.mock('react-i18next', () => ({
  initReactI18next: { init: () => {}, type: '3rdParty' },
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ valeurs) => {
      let texte = cle;
      if (typeof repli === 'string') texte = repli;
      else if (repli && typeof repli.defaultValue === 'string') texte = repli.defaultValue;
      const champs = typeof repli === 'object' && repli ? repli : valeurs || {};
      return texte.replace(/\{\{(\w+)\}\}/g, (_tout, nom) => String(champs[nom] ?? ''));
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

jest.mock(
  '@/components/molecules/wizardStepLayout/WizardStepLayout',
  () => function GabaritMock(/** @type {any} */ props) {
    return props.children;
  },
);

jest.mock('@/domains/auth/useAuth', () => {
  const { USER_ROLES } = jest.requireActual('@/domains/auth/authUseCases');
  return {
    __esModule: true,
    default: () => ({
      USER_ROLES,
      userData: {
        club: { documentId: 'club-1', name: 'FC Test' },
        documentId: 'moi',
        multisportClubs: mockAuth.adminOmnisport ? [{
          documentId: 'omni-1',
          name: 'US Omnisports',
          sections: mockAuth.omnisport
            ? [{ documentId: 'club-1' }, { documentId: 'club-basket' }, { documentId: 'club-judo' }]
            : [{ documentId: 'club-autre' }],
        }] : [],
        role: mockAuth.estDirigeant ? { name: USER_ROLES.president } : { name: USER_ROLES.coach },
        trainedTeams: [
          { club: { documentId: 'club-1', name: 'FC Test' }, documentId: 'eq-1', name: 'U15 A' },
        ],
      },
    }),
  };
});

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ prefetchQuery: () => Promise.resolve() }),
}));
jest.mock('@/services/team/teamService', () => ({
  getTeamById: () => Promise.resolve(null),
  getTeams: () => Promise.resolve([]),
}));
jest.mock('@/services/team/teamQueries', () => ({
  useGetTeams: () => ({
    data: {
      pages: [
        {
          data: [
            { club: { documentId: 'club-1', name: 'FC Test' }, documentId: 'eq-1', name: 'U15 A' },
            {
              club: { documentId: 'club-1', name: 'FC Test' },
              documentId: 'eq-2',
              name: 'Seniors B',
            },
          ],
        },
      ],
    },
    error: null,
    isLoading: false,
    refetch: () => {},
  }),
}));
jest.mock('@/services/event/eventQueries', () => ({
  useGetClubAudiencePreview: (/** @type {string} */ clubId, /** @type {string} */ scope) => {
    mockApercus.push({ clubId, scope });
    return scope === 'all_sections' ? mockApercuSections : mockApercu;
  },
}));
jest.mock('@/services/activity/activityQueries', () => ({
  useGetActivities: () => ({ data: [], error: null, isLoading: false }),
}));
jest.mock('@/services/category/categoryQueries', () => ({
  useGetCategories: () => ({ data: [], error: null, isLoading: false }),
}));
jest.mock('@/services/section/sectionQueries', () => ({
  useGetSections: () => ({ data: [], error: null, isLoading: false }),
}));
jest.mock('@/components/molecules/autocompleteSelect/AutocompleteSelect', () => () => null);
jest.mock(
  '@/components/molecules/input/Input',
  () => function ChampMock(/** @type {any} */ props) {
    mockRecherche.props = props;
    return null;
  },
);
jest.mock(
  '@/components/molecules/bottomModal/BottomModal',
  () => function FeuilleMock(/** @type {any} */ props) {
    return props.isVisible ? props.children : null;
  },
);
jest.mock(
  '@/components/atoms/button/Button',
  () => function BoutonMock(/** @type {any} */ props) {
    const reactActuel = jest.requireActual('react');
    const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
    return reactActuel.createElement(
      PressableRN,
      { accessibilityRole: 'button', onPress: props.onPress, testID: `bouton:${props.title}` },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  },
);
jest.mock(
  '@/views/event/wizard/components/EventWizardTeamCard',
  () => function CarteEquipeMock(/** @type {any} */ props) {
    const reactActuel = jest.requireActual('react');
    const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
    return reactActuel.createElement(
      PressableRN,
      { onPress: props.onPress, testID: `equipe:${props.team?.name}` },
      reactActuel.createElement(TexteRN, null, props.team?.name),
    );
  },
);

const textesSous = (/** @type {any} */ noeud) => {
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

let capte = { dispatch: () => {}, state: {} };
/**
 * Capte l'etat du tunnel.
 * @returns {null} Rien.
 */
function Sonde() {
  capte = useEventWizard();
  return null;
}

let arbre;
const navigation = { goBack: jest.fn(), navigate: jest.fn(), setParams: jest.fn() };
const monter = (nomDuType = 'Autre') => {
  act(() => {
    arbre = renderer.create(
      createElement(
        EventWizardProvider,
        null,
        createElement(Sonde),
        createElement(EventWizardTeam, { navigation, route: { params: {} } }),
      ),
    );
  });
  act(() => capte.dispatch({
    payload: { documentId: `t-${nomDuType}`, name: nomDuType },
    type: 'SET_TYPE',
  }));
};
const textes = () => textesSous(arbre.root);
const appuyer = (testID) => act(() => {
  arbre.root.findByProps({ testID }).props.onPress();
});

beforeEach(() => {
  mockAuth.estDirigeant = true;
  mockAuth.omnisport = true;
  mockAuth.adminOmnisport = true;
  mockApercus.length = 0;
  navigation.navigate.mockClear();
  if (typeof window !== 'undefined' && window.sessionStorage) window.sessionStorage.clear();
});
afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
});

describe('EVT-CLUB-SECTIONS — la carte « Toutes les sections »', () => {
  test('l admin de l omnisports la voit sous « Tous les membres du club », avec la reunion', () => {
    monter();
    const liste = textes();
    expect(liste).toContain('Tous les membres du club');
    expect(liste).toContain('Toutes les sections');
    expect(liste).toContain('US Omnisports · 3 sections · 287 personnes');
    const club = liste.indexOf('Tous les membres du club');
    expect(club).toBeLessThan(liste.indexOf('Toutes les sections'));
    expect(liste.indexOf('Toutes les sections')).toBeLessThan(liste.indexOf('MES ÉQUIPES'));
    expect(liste.filter((texte) => texte === 'POUR TOUT LE CLUB')).toHaveLength(1);
    expect(mockApercus).toContainEqual({ clubId: 'club-1', scope: 'all_sections' });
  });

  test('« Oui, toutes les sections » pose la portee et la reunion, passe a la suite', () => {
    monter('Autre');
    appuyer('event-wizard-club-audience-card-all_sections');
    const liste = textes();
    expect(liste).toContain('Prévenir toutes les sections ?');
    expect(liste).toContain('287 personnes');
    expect(liste).toContain(
      'Une personne inscrite dans deux sections ne reçoit qu’une notification '
      + 'et n’est comptée qu’une fois.',
    );
    appuyer('bouton:Oui, toutes les sections');
    expect(capte.state.audienceScope).toBe('all_sections');
    expect(capte.state.club).toEqual(expect.objectContaining({ documentId: 'club-1' }));
    expect(capte.state.clubAudienceCounts.total).toBe(287);
    expect(navigation.navigate).toHaveBeenCalledTimes(1);
  });

  test('le dirigeant d une section (pas admin de l omnisports) ne la voit pas', () => {
    mockAuth.adminOmnisport = false;
    monter();
    expect(textes()).toContain('Tous les membres du club');
    expect(textes()).not.toContain('Toutes les sections');
    expect(mockApercus.some((appel) => appel.scope === 'all_sections')).toBe(false);
  });

  test('un entraineur ne la voit pas', () => {
    mockAuth.estDirigeant = false;
    mockAuth.adminOmnisport = false;
    monter();
    expect(textes()).not.toContain('Toutes les sections');
    expect(textes()).not.toContain('Tous les membres du club');
  });

  test('admin d un AUTRE omnisports que celui du club : pas de carte', () => {
    mockAuth.omnisport = false;
    monter();
    expect(textes()).not.toContain('Toutes les sections');
  });

  test('club simple (caracterisant) : la carte du club et son apercu sont inchanges', () => {
    mockAuth.adminOmnisport = false;
    monter();
    appuyer('event-wizard-club-audience-card');
    appuyer('bouton:Oui, tout le club');
    expect(capte.state.audienceScope).toBe('club');
    expect(capte.state.clubAudienceCounts.total).toBe(168);
    expect(mockApercus.some((appel) => appel.scope === 'all_sections')).toBe(false);
  });
});
