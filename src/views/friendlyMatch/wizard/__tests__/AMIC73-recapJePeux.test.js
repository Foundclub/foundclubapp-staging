import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import FriendlyMatchWizardRecap from '../FriendlyMatchWizardRecap';

// I18N-2 : ces textes passent par i18next.t hors composant — la doublure partagée rend le
// français de l app (fr.js, sinon le repli, jetons et pluriel français).
jest.mock('i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next
));

// AMICAUX-CORRECTIFS 73 (13/10) — constat des captures : la rangee « Je peux » du recapitulatif
// (etape 7/7) affichait « Il reçoit » : elle reprenait getHostingSummary, ecrit a la 3e personne
// pour la page d une annonce. Meme montage que FriendlyMatchWizardRecap.test.js.

/** @type {any[]} */
const mockPropsDuGabarit = [];
/** @type {any[]} */
const mockActions = [];
/** @type {any[]} */
const mockBannieres = [];
const mockCreer = jest.fn();

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
      Images: {},
      Spaces: espaces,
    }),
  };
});

jest.mock('@/components/molecules/wizardStepLayout/WizardStepLayout', () => function GabaritMock(
  /** @type {any} */ props,
) {
  mockPropsDuGabarit.push(props);
  return props.children;
});

jest.mock('@/context/AppFeedbackContext', () => ({
  __esModule: true,
  useAppFeedback: () => ({ showBanner: (/** @type {any} */ b) => mockBannieres.push(b) }),
}));

// ⛔ Jamais `requireActual` sur ce service : son client HTTP exige `API_URL` au
// chargement, et la suite meurt sans message lisible.
jest.mock('@/services/friendlyMatch/friendlyMatchService', () => ({
  __esModule: true,
  createFriendlyMatchAd: (/** @type {any} */ payload) => mockCreer(payload),
}));

/** Le brouillon, lu a chaque rendu : le test remplace son contenu. */
const mockBrouillon = /** @type {any} */ ({});
jest.mock('../FriendlyMatchWizardContext', () => ({
  __esModule: true,
  useFriendlyMatchWizard: () => ({
    dispatch: (/** @type {any} */ action) => mockActions.push(action),
    state: mockBrouillon,
  }),
}));

/**
 * Un brouillon COMPLET : rien ne bloque, la publication peut partir.
 * @returns {any} Le brouillon.
 */
const brouillonPublicable = () => ({
  activity: null,
  candidateDates: [{ date: '2099-05-12', start: '18:00' }],
  category: null,
  description: 'On cherche un adversaire.',
  entryOrigin: '',
  format: '',
  formatOther: '',
  hostingPreference: 'BOTH',
  installation: null,
  level: null,
  location: { city: 'Marseille' },
  refereeing: '',
  section: null,
  team: { documentId: 'team-1', name: 'U15' },
  travelRadiusKm: 25,
});

/**
 * Monte le recapitulatif sur un brouillon donne.
 * @param {any} [modifications] Ce qui change par rapport au brouillon publiable.
 * @returns {any} L'arbre, la navigation espionnee et l'ordre des gestes.
 */
const rendre = (modifications = {}) => {
  Object.keys(mockBrouillon).forEach((cle) => { delete mockBrouillon[cle]; });
  Object.assign(mockBrouillon, brouillonPublicable(), modifications);

  /** @type {any[]} */
  const gestes = [];
  const navigation = {
    goBack: jest.fn(),
    navigate: (/** @type {any} */ nom) => gestes.push({ geste: 'navigate', nom }),
    popTo: (/** @type {any} */ nom) => gestes.push({ geste: 'popTo', nom }),
    replace: (/** @type {any} */ nom, /** @type {any} */ params) => gestes.push({
      geste: 'replace', nom, params,
    }),
  };
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(createElement(FriendlyMatchWizardRecap, { navigation }));
  });
  return { arbre, gestes, navigation };
};

/**
 * Ce que la rangee « Je peux » dit, telle que le lecteur d ecran la lit (« <libelle> : <valeur> »).
 * @param {any} arbre
 * @returns {string}
 */
const rangeeJePeux = (arbre) => arbre.root.findAll((/** @type {any} */ noeud) => (
  typeof noeud.props?.accessibilityLabel === 'string'
  && noeud.props.accessibilityLabel.startsWith('Je peux : ')
))[0]?.props.accessibilityLabel;

describe('AMIC-73 — la rangee « Je peux » du recapitulatif parle a la 1re personne', () => {
  test.each([
    ['HOST', 'Je peux : Recevoir'],
    ['AWAY', 'Je peux : Me déplacer'],
    ['BOTH', 'Je peux : Recevoir ou me déplacer'],
  ])('73 — %s se lit « %s »', (hostingPreference, attendu) => {
    expect(rangeeJePeux(rendre({ hostingPreference }).arbre)).toBe(attendu);
  });

  test('73 — jamais la 3e personne d une annonce (« Il reçoit », « Il se déplace »)', () => {
    ['HOST', 'AWAY', 'BOTH'].forEach((hostingPreference) => {
      expect(rangeeJePeux(rendre({ hostingPreference }).arbre)).not.toMatch(/Il |Reçoit ou se/);
    });
  });
});
