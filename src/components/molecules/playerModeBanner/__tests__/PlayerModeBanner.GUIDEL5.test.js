import renderer, { act } from 'react-test-renderer';

import PlayerModeBanner from '../PlayerModeBanner';

// GUIDE-BONUS (L5, 28/10) — audit du guide Entraîneur, captures 50-51 : pendant
// le guide, un double toucher sur « Passer ce bonus » est tombé sur « Voir l'app en
// joueur » ; le guide a continué en mode joueur, et « Revenir en mode entraîneur »
// était sous le voile. Pendant le guide, le bandeau ne PROPOSE aucune bascule ;
// le RETOUR, lui, reste toujours là.

let mockGuideActif = false;
jest.mock('@/context/useTour', () => ({
  useTour: () => ({
    isGuide: mockGuideActif,
    isTourActive: mockGuideActif,
    tourStatus: mockGuideActif ? 'active' : null,
  }),
}));

jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const alignements = jest.requireActual('@/theme/alignements').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();
  const theme = {
    Alignments: alignements,
    ApplicationStyle: genererStyles(couleurs),
    Colors: couleurs,
    Fonts: genererPolices(couleurs),
    Images: {},
    Spaces: espaces,
  };
  return { __esModule: true, default: () => theme };
});

/** @type {any[]} */
const montes = [];

/**
 * Monte le bandeau.
 * @param {any} props - Ce que l'accueil lui passe.
 * @returns {any} - L'arbre rendu.
 */
const monter = (props) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <PlayerModeBanner
        accountRoleKey={props.accountRoleKey}
        canUseParentMode={props.canUseParentMode === true}
        canUsePlayerMode={props.canUsePlayerMode === true}
        displayMode={props.displayMode ?? null}
        onChange={props.onChange || jest.fn()}
        onPratiqueAussi={props.onPratiqueAussi || jest.fn()}
        prenoms={props.prenoms || []}
      />,
    );
  });
  montes.push(arbre);
  return arbre;
};

afterEach(() => {
  while (montes.length) {
    const arbre = montes.pop();
    act(() => arbre.unmount());
  }
});

const COACH_QUI_JOUE = { accountRoleKey: 'coach', canUsePlayerMode: true };

it('hors guide : l’offre « Voir l’app en joueur » est là', () => {
  mockGuideActif = false;
  expect(monter(COACH_QUI_JOUE).root.findAll((n) => n.props?.testID === 'player-mode-enter').length)
    .toBeGreaterThan(0);
});

it('guide en cours : aucune offre de bascule', () => {
  mockGuideActif = true;
  const arbre = monter({ ...COACH_QUI_JOUE, canUseParentMode: true, prenoms: ['Anissa'] });
  expect(arbre.toJSON()).toBeNull();
});

it('guide en cours, déjà en mode joueur : le retour reste là', () => {
  mockGuideActif = true;
  const arbre = monter({ ...COACH_QUI_JOUE, displayMode: 'player' });
  const retours = arbre.root.findAll((n) => n.props?.testID === 'player-mode-exit');
  expect(retours.length).toBeGreaterThan(0);
});
