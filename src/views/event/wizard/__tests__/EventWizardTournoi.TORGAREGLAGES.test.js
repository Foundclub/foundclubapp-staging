/* eslint-disable max-len -- les témoins se lisent en entier. */
import renderer, { act } from 'react-test-renderer';

import EventWizardTournamentSettings from '../EventWizardTournamentSettings';

// T-ORGA-REGLAGES (18/11, nuit D231) — l'assistant de création saisit le prix par joueur (en euros,
// gardé en centimes), l'âge minimum, le seuil de joueurs payés (5 par défaut, jamais plus que
// l'effectif max) et le maillot obligatoire ; il prévient avant l'enregistrement qu'un tournoi
// payant sans club porteur sera refusé. Avant : aucun de ces champs.

const mockEtat = { value: /** @type {any} */ ({}) };
const mockGabarit = { props: /** @type {any} */ (null) };
const mockDispatch = jest.fn();

jest.mock('../EventWizardContext', () => ({
  useEventWizard: () => ({ dispatch: mockDispatch, state: mockEtat.value }),
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
  mockDispatch.mockClear();
});

const CLUB = { club: { documentId: 'club-rauze' } };
const monter = (/** @type {any} */ etat) => {
  mockEtat.value = { eventTypeName: 'Tournoi', ...etat };
  let arbre = /** @type {any} */ (null);
  act(() => { arbre = renderer.create(<EventWizardTournamentSettings navigation={navigation} route={{ params: {} }} />); });
  montes.push(arbre);
  return arbre;
};
const champ = (/** @type {any} */ arbre, /** @type {string} */ id) => arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === id && (n.props?.onChangeText || n.props?.onValueChange))[0];
const saisir = (/** @type {any} */ arbre, /** @type {string} */ id, /** @type {any} */ valeur) => {
  act(() => {
    const c = champ(arbre, id);
    if (c.props.onChangeText) c.props.onChangeText(valeur); else c.props.onValueChange(valeur);
  });
};
const suivant = () => { act(() => { mockGabarit.props.onNext(); }); return mockDispatch.mock.calls.at(-1)?.[0]?.payload; };
const texte = (/** @type {any} */ arbre) => JSON.stringify(arbre.toJSON());

describe('T-ORGA-REGLAGES — les règles payantes dans l’assistant', () => {
  test('🔴 20 €, 16 ans, 4 payés et le maillot partent dans l’état de l’assistant', () => {
    const arbre = monter({ team: CLUB });
    expect(champ(arbre, 'tournoi-regles-seuil')?.props.value).toBe('5');
    saisir(arbre, 'tournoi-regles-prix', '20');
    saisir(arbre, 'tournoi-regles-age', '16');
    saisir(arbre, 'tournoi-regles-seuil', '4');
    saisir(arbre, 'tournoi-regles-maillot', true);
    expect(suivant()).toEqual(expect.objectContaining({
      tournamentEntryFeeCents: 2000,
      tournamentJerseySizeRequired: true,
      tournamentMinAge: 16,
      tournamentPaidMembersToValidate: 4,
    }));
  });

  // T-SANS-PLAFOND (18/11, Adel D239) : plus d'effectif maximum, donc plus de « seuil au-dessus du max ».
  test('🔴 D239 : un seuil de 7 avec un ancien effectif max 6 ne bloque plus « Suivant », le champ max a disparu', () => {
    const arbre = monter({ team: CLUB, tournamentMaxRosterSize: 6 });
    saisir(arbre, 'tournoi-regles-prix', '20');
    saisir(arbre, 'tournoi-regles-seuil', '7');
    expect(mockGabarit.props.isNextDisabled).toBe(false);
    expect(texte(arbre)).not.toContain('Ce nombre ne peut pas dépasser l’effectif maximum');
    expect(texte(arbre)).not.toContain('Effectif max');
  });

  test('🔴 un tournoi payant sans club porteur : l’assistant le dit avant l’enregistrement', () => {
    const arbre = monter({ tournamentScopeMode: 'autonomous' });
    saisir(arbre, 'tournoi-regles-prix', '20');
    expect(texte(arbre)).toContain('Un tournoi payant doit être porté par un club.');
  });

  test('le retour sur l’étape retrouve les réglages déjà saisis', () => {
    const arbre = monter({
      team: CLUB, tournamentEntryFeeCents: 1950, tournamentMinAge: 18, tournamentPaidMembersToValidate: 3,
    });
    expect(champ(arbre, 'tournoi-regles-prix')?.props.value).toBe('19,50');
    expect(champ(arbre, 'tournoi-regles-age')?.props.value).toBe('18');
    expect(champ(arbre, 'tournoi-regles-seuil')?.props.value).toBe('3');
  });

  test('🔴 un tournoi gratuit de 4 joueurs max passe « Suivant » avec le seuil par défaut', () => {
    monter({ team: CLUB, tournamentMaxRosterSize: 4 });
    expect(mockGabarit.props.isNextDisabled).toBe(false);
  });
});
