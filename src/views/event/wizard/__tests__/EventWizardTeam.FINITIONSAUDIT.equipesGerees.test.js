import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import { EventWizardProvider } from '../EventWizardContext';
import EventWizardTeam from '../EventWizardTeam';

// FINITIONS-AUDIT, point 4a (30/09) — « Equipe organisatrice » d'un evenement : la meme
// confusion que GERER-ANNONCE, « les equipes ou je JOUE » (`myTeams`, schema utilisateur
// `mappedBy: players`) prises pour « les equipes que je GERE ». Le lot GERER-ANNONCE l'avait
// LUE sans la tester (EventWizardTeam.js:104-123). Ce temoin la VERIFIE, par le texte visible :
//   · caracterisation (vert avant, vert apres) : un entraineur voit SON equipe et pas les
//     autres du club ; un dirigeant voit toutes les equipes de son club ;
//   · 🚨 un JOUEUR, quand la liste du club ne revient pas (repli), se voyait proposer
//     l'equipe ou il joue — le serveur refuse ensuite de creer l'evenement ;
//   · 🚨 un entraineur qui JOUE aussi dans un autre club : l'ecran allait chercher les
//     equipes du club OU IL JOUE, n'y trouvait rien a gerer, et ne proposait RIEN.

const CLUB_1 = { documentId: 'club-1', name: 'FC Test' };
const CLUB_2 = { documentId: 'club-2', name: 'AS Voisine' };
const U15 = { club: CLUB_1, documentId: 'eq-1', name: 'U15 A' };
const SENIORS = { club: CLUB_1, documentId: 'eq-2', name: 'Seniors B' };
const VETERANS = { club: CLUB_2, documentId: 'eq-5', name: 'Vétérans' };

/** Ce que l'ecran recoit : le compte, et ce que « le serveur » rend pour un club. */
const mockEtat = {
  /** @type {any[]} */
  equipesDuServeur: [],
  /** @type {any} */
  userData: null,
};

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

jest.mock('@/components/molecules/wizardStepLayout/WizardStepLayout', () => function GabaritMock(
  /** @type {any} */ props,
) {
  return props.children;
});

jest.mock('@/domains/auth/useAuth', () => {
  const { USER_ROLES } = jest.requireActual('@/domains/auth/authUseCases');
  return { __esModule: true, default: () => ({ USER_ROLES, userData: mockEtat.userData }) };
});

// Meme raison que dans EventWizardTeam.rendu.test.js : sans ces doublures, le vrai client
// HTTP exige `API_URL` et le vrai `useQueryClient()` exige un fournisseur.
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ prefetchQuery: () => Promise.resolve() }),
}));
jest.mock('@/services/team/teamService', () => ({
  getTeamById: () => Promise.resolve(null),
  getTeams: () => Promise.resolve([]),
}));

// « Le serveur » : les equipes du club demande, pages comme la vraie requete ; rien tant que
// la requete est coupee (`enabled: false`), comme react-query.
jest.mock('@/services/team/teamQueries', () => ({
  useGetTeams: (/** @type {any} */ params, /** @type {any} */ options) => ({
    data: options?.enabled
      ? {
        pages: [{
          data: mockEtat.equipesDuServeur
            .filter((equipe) => equipe.club.documentId === params.clubId),
        }],
      }
      : undefined,
    error: null,
    isLoading: false,
    refetch: () => {},
  }),
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
jest.mock('@/components/molecules/input/Input', () => () => null);
jest.mock('@/components/atoms/button/Button', () => function BoutonMock(/** @type {any} */ props) {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN } = jest.requireActual('react-native');
  return reactActuel.createElement(TexteRN, null, props.title);
});

// La carte d'equipe rendue par le nom de l'equipe : c'est ce que l'on peut choisir.
jest.mock('@/views/event/wizard/components/EventWizardTeamCard', () => function CarteEquipeMock(
  /** @type {any} */ props,
) {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN } = jest.requireActual('react-native');
  return reactActuel.createElement(TexteRN, null, props.team?.name);
});

/** @type {any} */
let arbre;

/**
 * Les equipes que l'ecran propose de choisir, pour ce compte et ce « serveur ».
 * @param {any} userData Le compte connecte.
 * @param {any[]} equipesDuServeur Les equipes que le serveur rend, par club.
 * @returns {string[]} Les noms d'equipes proposes.
 */
const equipesProposees = (userData, equipesDuServeur) => {
  mockEtat.userData = userData;
  mockEtat.equipesDuServeur = equipesDuServeur;
  const navigation = { goBack: () => {}, navigate: () => {}, setParams: () => {} };
  act(() => {
    arbre = renderer.create(createElement(
      EventWizardProvider,
      null,
      createElement(EventWizardTeam, { navigation, route: { params: {} } }),
    ));
  });
  const noms = [U15, SENIORS, VETERANS].map((equipe) => equipe.name);
  return arbre.root
    .findAll((/** @type {any} */ noeud) => noeud.type === 'Text')
    .map((/** @type {any} */ noeud) => [].concat(noeud.props.children).join(''))
    .filter((texte) => noms.includes(texte));
};

afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
});

describe('FINITIONS-AUDIT (4a) — caracterisation : qui GERE choisit parmi ce qu il gere', () => {
  it('un entraineur voit SON equipe, pas les autres du club', () => {
    expect(equipesProposees({
      documentId: 'moi', myTeams: [], role: { name: 'Entraineur' }, trainedTeams: [U15],
    }, [U15, SENIORS])).toEqual(['U15 A']);
  });

  it('un dirigeant voit les equipes de son club', () => {
    expect(equipesProposees({
      club: CLUB_1, documentId: 'moi', myTeams: [], role: { name: 'Dirigeant' }, trainedTeams: [],
    }, [U15, SENIORS])).toEqual(expect.arrayContaining(['U15 A', 'Seniors B']));
  });

  it('un entraineur, quand la liste du club ne revient pas, garde SON equipe (repli)', () => {
    expect(equipesProposees({
      documentId: 'moi', myTeams: [], role: { name: 'Entraineur' }, trainedTeams: [U15],
    }, [])).toEqual(['U15 A']);
  });
});

describe('FINITIONS-AUDIT (4a) — « ou je JOUE » n est pas « ce que je GERE »', () => {
  it('🚨 un JOUEUR ne se voit jamais proposer l equipe ou il joue (repli)', () => {
    expect(equipesProposees({
      documentId: 'moi', myTeams: [VETERANS], role: { name: 'Joueur' }, trainedTeams: [],
    }, [])).toEqual([]);
  });

  it('🚨 un entraineur qui JOUE ailleurs voit l equipe qu il ENTRAINE', () => {
    expect(equipesProposees({
      documentId: 'moi', myTeams: [VETERANS], role: { name: 'Entraineur' }, trainedTeams: [U15],
    }, [U15, SENIORS, VETERANS])).toEqual(['U15 A']);
  });
});
