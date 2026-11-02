import renderer, { act } from 'react-test-renderer';

import EventWizardTournamentSettings from '../EventWizardTournamentSettings';
import EventWizardTournamentStructure from '../EventWizardTournamentStructure';

// REPRISE-EVENEMENTS 129 (décision B) — les réglages du tournoi refusent déjà un effectif
// minimum à 0 et trop de poules pour le nombre d'équipes ; l'assistant de CRÉATION, non :
// « Suivant » passait, et le tournoi naissait avec des réglages qui ne peuvent pas marcher.

const mockEtat = { value: /** @type {any} */ ({}) };
const mockGabarit = { props: /** @type {any} */ (null) };

jest.mock('../EventWizardContext', () => ({
  useEventWizard: () => ({ dispatch: jest.fn(), state: mockEtat.value }),
}));

jest.mock('react-i18next', () => ({
  initReactI18next: { init: () => {}, type: '3rdParty' },
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
      if (typeof repli === 'string') return repli;
      return repli?.defaultValue_other || repli?.defaultValue || cle;
    },
  }),
}));

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const couleurs = genererCouleurs();
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      ApplicationStyle: genererStyles(couleurs),
      Colors: couleurs,
      Fonts: genererPolices(couleurs),
      Images: new Proxy({}, { get: () => 1 }),
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});

jest.mock('@/components/molecules/wizardStepLayout/WizardStepLayout', () => function Gabarit(
  /** @type {any} */ props,
) {
  mockGabarit.props = props;
  return props.children;
});

const navigation = { goBack: jest.fn(), navigate: jest.fn() };

/** @type {any[]} */
const montes = [];
afterEach(() => {
  act(() => { montes.splice(0).forEach((arbre) => arbre.unmount()); });
});

const monter = (/** @type {any} */ Etape, /** @type {any} */ etat) => {
  mockEtat.value = { eventTypeName: 'Tournoi', ...etat };
  let arbre = /** @type {any} */ (null);
  act(() => { arbre = renderer.create(<Etape navigation={navigation} route={{ params: {} }} />); });
  montes.push(arbre);
  return arbre;
};

const saisir = (
  /** @type {any} */ arbre,
  /** @type {string} */ exemple,
  /** @type {string} */ valeur,
) => {
  const champ = arbre.root.findAll((/** @type {any} */ n) => n.props?.placeholder === exemple
    && typeof n.props?.onChangeText === 'function')[0];
  act(() => { champ.props.onChangeText(valeur); });
};

const texte = (/** @type {any} */ arbre) => JSON.stringify(arbre.toJSON());

describe('REPRISE-EVENEMENTS 129 — l’assistant de création borne ses réglages', () => {
  test('🐞 effectif minimum à 0 : refusé et dit, « Suivant » bloqué', () => {
    const arbre = monter(EventWizardTournamentSettings, {});
    saisir(arbre, 'Ex. 5', '0');

    expect(mockGabarit.props.isNextDisabled).toBe(true);
    expect(texte(arbre)).toContain('au moins 1 joueur');
  });

  test('un effectif minimum de 1 passe', () => {
    const arbre = monter(EventWizardTournamentSettings, {});
    saisir(arbre, 'Ex. 5', '1');

    expect(mockGabarit.props.isNextDisabled).toBe(false);
  });

  test('🐞 3 poules pour 4 équipes : refusé et dit, « Suivant » bloqué', () => {
    const arbre = monter(EventWizardTournamentStructure, {
      tournamentFormatMode: 'groups_only',
      tournamentMaxTeams: 4,
    });
    saisir(arbre, 'Ex. 4', '3');

    expect(mockGabarit.props.isNextDisabled).toBe(true);
    expect(texte(arbre)).toContain('chaque poule doit compter 2 équipes');
  });

  test('2 poules pour 4 équipes passent', () => {
    const arbre = monter(EventWizardTournamentStructure, {
      tournamentFormatMode: 'groups_only',
      tournamentMaxTeams: 4,
    });
    saisir(arbre, 'Ex. 4', '2');

    expect(mockGabarit.props.isNextDisabled).toBe(false);
  });
});
