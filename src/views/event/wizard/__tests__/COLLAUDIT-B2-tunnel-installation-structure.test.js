/**
 * COLLAUDIT - brique 2, CONTRE-EXPERTISE (lot 0 AUDIT, 2026-09-27).
 *
 * TEMOIN DE CARACTERISATION : il decrit ce que l'app fait AUJOURD'HUI sur
 * origin/staging (app e7560d42). Il doit etre VERT. Aucun fichier de production
 * n'est touche.
 *
 * CE QUE LA COLLECTIVITE EXIGERA (SPEC_COLLECTIVITES_2026-09.md section 3) :
 * l'entraineur d'un club rattache, quand il CREE un entrainement, voit les
 * installations de la mairie a cote de celles de son club.
 *
 * CE QUE CE FICHIER FIGE (chaine lue dans le code, puis executee ici) :
 *  1. dans le tunnel de CREATION, les equipes viennent de GET /teams en mode
 *     `summary` (EventWizardTeam.js:136-143), et le `populate` du club ne demande
 *     PAS `parentMultisport` (teamService.js:169-191) ;
 *  2. l'equipe choisie est rangee telle quelle dans l'etat du tunnel
 *     (EventWizardTeam.js:312, EventWizardContext.js:243-252) ;
 *  3. l'ecran « Lieu » lit pourtant `state.team.club.parentMultisport`
 *     (EventWizardLocation.js:55) pour demander les installations de la
 *     structure (FacilitySelector.js:109-113, `enabled: !!cmId`).
 * => cmId vaut undefined : le gymnase de la structure n'est jamais propose a la
 *    creation. Le temoin de controle montre que la meme equipe AVEC
 *    parentMultisport, elle, transmet bien cmId.
 *
 * Lancement :
 *   npx jest src/views/event/wizard/__tests__/COLLAUDIT-B2-tunnel-installation-structure.test.js --silent
 */

import { createElement, useEffect } from 'react';
import renderer, { act } from 'react-test-renderer';

const mockGet = jest.fn();
/** Proprietes recues par le selecteur d'installation, dans l'ordre du rendu. */
const mockSelecteurs = [];

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    delete: jest.fn(),
    get: mockGet,
    post: jest.fn(),
    put: jest.fn(),
  },
}));

jest.mock('@/services/celebrations/celebrationRuntime', () => ({
  celebrate: jest.fn(),
}));

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

// Le VRAI theme, sans le contexte React qui le porte (meme double que
// EventWizardLocation.rendu.test.js).
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

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    userData: { documentId: 'coach-club-1', role: { name: 'Entraineur', type: 'trainer' } },
  }),
}));

jest.mock(
  '@/components/organisms/facilitySelector/FacilitySelector',
  () => function SelecteurMock(/** @type {any} */ props) {
    mockSelecteurs.push(props);
    return null;
  },
);

const { getTeams } = require('@/services/team/teamService');
const { EventWizardProvider, useEventWizard } = require('../EventWizardContext');
const EventWizardLocation = require('../EventWizardLocation').default;

const CLUB_1 = 'club-1';
const CM_VILLE = 'cm-ville';

/**
 * Pose l'equipe dans l'etat du tunnel, comme EventWizardTeam.js:312.
 * @param {{ team: any, children?: any }} props Proprietes.
 * @returns {any} Les enfants.
 */
function PoseEquipe({ children, team }) {
  const { dispatch, state } = useEventWizard();
  useEffect(() => {
    dispatch({ payload: team, type: 'SET_TEAM' });
  }, [dispatch, team]);
  return state.team ? children : null;
}

/** @type {any} */
let arbre;

/**
 * Monte l'ecran « Lieu » avec une equipe deja choisie.
 * @param {any} team L'equipe telle que le tunnel la range.
 * @returns {any} Les dernieres proprietes recues par le selecteur.
 */
const afficherLieuAvec = (team) => {
  mockSelecteurs.length = 0;
  const navigation = { goBack: () => {}, navigate: () => {}, setParams: () => {} };
  act(() => {
    arbre = renderer.create(createElement(
      EventWizardProvider,
      null,
      createElement(
        PoseEquipe,
        { team },
        createElement(EventWizardLocation, { navigation, route: { params: {} } }),
      ),
    ));
  });
  return mockSelecteurs[mockSelecteurs.length - 1];
};

afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
  mockGet.mockReset();
});

test("AUJOURD'HUI : la liste d'equipes du tunnel (getTeams summary) ne demande que documentId et name du club, jamais parentMultisport", async () => {
  mockGet.mockResolvedValue({
    data: {
      data: [{ activities: [], club: { documentId: CLUB_1, name: 'Club 1' }, documentId: 'team-1', name: 'U13' }],
      meta: { pagination: { page: 1, pageCount: 1, pageSize: 100, total: 1 } },
    },
  });

  // Les parametres exacts d'EventWizardTeam.js:136-143 pour un entraineur.
  await getTeams({ clubId: CLUB_1, page: 1, pageSize: 100, summary: true });

  expect(mockGet).toHaveBeenCalledTimes(1);
  expect(mockGet.mock.calls[0][0]).toBe('/teams');
  const populateDuClub = mockGet.mock.calls[0][1].params.populate.club;
  expect(populateDuClub.fields).toEqual(['documentId', 'name']);
  expect(Object.keys(populateDuClub.populate).sort()).toEqual(['logo', 'sponsor']);
  expect(Object.hasOwn(populateDuClub.populate, 'parentMultisport')).toBe(false);
});

test("AUJOURD'HUI : une equipe telle que cette liste la rend (club sans parentMultisport) => l'ecran Lieu passe cmId undefined au selecteur : les installations de la structure ne sont jamais demandees", () => {
  const equipeDuTunnel = { club: { documentId: CLUB_1, name: 'Club 1' }, documentId: 'team-1', name: 'U13' };

  const selecteur = afficherLieuAvec(equipeDuTunnel);

  expect(selecteur).toBeDefined();
  expect(selecteur.clubId).toBe(CLUB_1);
  expect(selecteur.cmId).toBeUndefined();
});

test("AUJOURD'HUI : (controle) seule une equipe dont le club porte parentMultisport transmet cmId au selecteur", () => {
  const equipeAvecStructure = {
    club: { documentId: CLUB_1, name: 'Club 1', parentMultisport: { documentId: CM_VILLE } },
    documentId: 'team-1',
    name: 'U13',
  };

  const selecteur = afficherLieuAvec(equipeAvecStructure);

  expect(selecteur.clubId).toBe(CLUB_1);
  expect(selecteur.cmId).toBe(CM_VILLE);
});
