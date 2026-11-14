import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import { RouteNames } from '@/navigation/routeNames';

import { EventWizardProvider, useEventWizard } from '../EventWizardContext';
import EventWizardTeam from '../EventWizardTeam';

// EVT-CLUB-ECRANS (14/11/2026, D121) — ecrans 1 et 2 de la maquette v2 :
// la carte « Tous les membres du club » au-dessus de « MES ÉQUIPES » (dirigeant seulement, Q1 A),
// masquee pendant une recherche, et la feuille « Prevenir tout le club ? » avec les comptes de l'apercu.
// Doublures : celles de `EventWizardTeam.rendu.test.js` (meme motif), plus l'apercu du serveur.

const mockAuth = { estDirigeant: true };
const mockRecherche = { props: null };
const mockApercu = {
  data: {
    audienceScope: 'club',
    counts: {
      children: 51, coaches: 10, members: 6, parents: 41, players: 111, total: 168,
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
      const champs = typeof repli === 'object' && repli ? repli : (valeurs || {});
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

jest.mock('@/components/molecules/wizardStepLayout/WizardStepLayout', () => function GabaritMock(
  /** @type {any} */ props,
) {
  return props.children;
});

jest.mock('@/domains/auth/useAuth', () => {
  const { USER_ROLES } = jest.requireActual('@/domains/auth/authUseCases');
  return {
    __esModule: true,
    default: () => ({
      USER_ROLES,
      userData: {
        club: { documentId: 'club-1', name: 'FC Test' },
        documentId: 'moi',
        role: mockAuth.estDirigeant ? { name: USER_ROLES.president } : { name: USER_ROLES.coach },
        trainedTeams: [{ club: { documentId: 'club-1', name: 'FC Test' }, documentId: 'eq-1', name: 'U15 A' }],
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
      pages: [{
        data: [
          { club: { documentId: 'club-1', name: 'FC Test' }, documentId: 'eq-1', name: 'U15 A' },
          { club: { documentId: 'club-1', name: 'FC Test' }, documentId: 'eq-2', name: 'Seniors B' },
        ],
      }],
    },
    error: null,
    isLoading: false,
    refetch: () => {},
  }),
}));
jest.mock('@/services/event/eventQueries', () => ({
  useGetClubAudiencePreview: () => mockApercu,
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
jest.mock('@/components/molecules/input/Input', () => function ChampMock(/** @type {any} */ props) {
  mockRecherche.props = props;
  return null;
});
jest.mock('@/components/molecules/bottomModal/BottomModal', () => function FeuilleMock(/** @type {any} */ props) {
  return props.isVisible ? props.children : null;
});
jest.mock('@/components/atoms/button/Button', () => function BoutonMock(/** @type {any} */ props) {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return reactActuel.createElement(
    PressableRN,
    { accessibilityRole: 'button', onPress: props.onPress, testID: `bouton:${props.title}` },
    reactActuel.createElement(TexteRN, null, props.title),
  );
});
jest.mock('@/views/event/wizard/components/EventWizardTeamCard', () => function CarteEquipeMock(
  /** @type {any} */ props,
) {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return reactActuel.createElement(
    PressableRN,
    { onPress: props.onPress, testID: `equipe:${props.team?.name}` },
    reactActuel.createElement(TexteRN, null, props.team?.name),
  );
});

const textesSous = (/** @type {any} */ noeud) => {
  const sortie = [];
  const parcourir = (/** @type {any} */ enfant) => {
    if (typeof enfant === 'string' || typeof enfant === 'number') { sortie.push(String(enfant)); return; }
    if (Array.isArray(enfant)) { enfant.forEach(parcourir); return; }
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
    arbre = renderer.create(createElement(
      EventWizardProvider,
      null,
      createElement(Sonde),
      createElement(EventWizardTeam, { navigation, route: { params: {} } }),
    ));
  });
  act(() => capte.dispatch({ payload: { documentId: `t-${nomDuType}`, name: nomDuType }, type: 'SET_TYPE' }));
};
const textes = () => textesSous(arbre.root);
const appuyer = (testID) => act(() => { arbre.root.findByProps({ testID }).props.onPress(); });

beforeEach(() => {
  mockAuth.estDirigeant = true;
  navigation.navigate.mockClear();
  if (typeof window !== 'undefined' && window.sessionStorage) window.sessionStorage.clear();
});
afterEach(() => { if (arbre) act(() => arbre.unmount()); arbre = null; });

describe('EVT-CLUB — ecran 1 : la carte « Tous les membres du club »', () => {
  test('le dirigeant la voit, sous « POUR TOUT LE CLUB », au-dessus de « MES ÉQUIPES »', () => {
    monter();
    const liste = textes();
    expect(liste).toContain('POUR TOUT LE CLUB');
    expect(liste).toContain('Tous les membres du club');
    expect(liste).toContain('FC Test · 2 équipes · 168 personnes');
    expect(liste.indexOf('POUR TOUT LE CLUB')).toBeLessThan(liste.indexOf('MES ÉQUIPES'));
    // Rien d'autre ne bouge : les deux intertitres d'aujourd'hui restent.
    expect(liste).toContain('AUTRES ÉQUIPES DU CLUB');
  });

  test('un entraineur ne la voit pas (Q1 A)', () => {
    mockAuth.estDirigeant = false;
    monter();
    expect(textes()).not.toContain('Tous les membres du club');
    expect(textes()).toContain('U15 A');
  });

  test('une recherche la masque ; vider le champ la ramene', () => {
    monter();
    act(() => mockRecherche.props.onChangeText('U15'));
    expect(textes()).not.toContain('Tous les membres du club');
    act(() => mockRecherche.props.onChangeText(''));
    expect(textes()).toContain('Tous les membres du club');
  });
});

describe('EVT-CLUB — ecran 2 : « Prevenir tout le club ? »', () => {
  test('toucher la carte ouvre la feuille avec les 4 comptes', () => {
    monter();
    appuyer('event-wizard-club-audience-card');
    const liste = textes();
    expect(liste).toContain('Prévenir tout le club ?');
    expect(liste).toContain('168 personnes');
    expect(liste).toContain('Joueurs de 13 ans et plus');
    expect(liste).toContain('111');
    expect(liste).toContain('Parents, pour 51 enfants de moins de 13 ans');
    expect(liste).toContain('41');
    expect(liste).toContain('Entraîneurs');
    expect(liste).toContain('Membres sans équipe');
    expect(liste).toContain('Oui, tout le club');
    expect(liste).toContain('Choisir une équipe');
  });

  test('« Choisir une équipe » referme la feuille sans rien changer', () => {
    monter();
    appuyer('event-wizard-club-audience-card');
    appuyer('bouton:Choisir une équipe');
    expect(textes()).not.toContain('Prévenir tout le club ?');
    expect(capte.state.audienceScope).toBeNull();
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  test('hors Match : « Oui » rattache au club et passe a l etape suivante', () => {
    monter('Autre');
    appuyer('event-wizard-club-audience-card');
    appuyer('bouton:Oui, tout le club');
    expect(capte.state.audienceScope).toBe('club');
    expect(capte.state.team).toBeNull();
    expect(capte.state.club).toEqual(expect.objectContaining({ documentId: 'club-1' }));
    expect(capte.state.clubAudienceCounts.total).toBe(168);
    expect(navigation.navigate).toHaveBeenCalledTimes(1);
    expect(navigation.navigate.mock.calls[0][0]).not.toBe(RouteNames.EventWizardTeam);
  });

  test('Match (R1 A) : « Oui » reste sur la liste ; l equipe choisie ensuite garde « tout le club »', () => {
    monter('Match');
    appuyer('event-wizard-club-audience-card');
    appuyer('bouton:Oui, tout le club');
    expect(navigation.navigate).not.toHaveBeenCalled();
    expect(textes()).toContain('Tout le club sera prévenu. Choisis maintenant l’équipe qui joue.');
    appuyer('equipe:U15 A');
    expect(capte.state.audienceScope).toBe('club');
    expect(capte.state.team).toEqual(expect.objectContaining({ documentId: 'eq-1' }));
    expect(navigation.navigate).toHaveBeenCalledTimes(1);
  });
});
