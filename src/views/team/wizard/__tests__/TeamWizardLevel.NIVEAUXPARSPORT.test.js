import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import TeamWizardLevel from '../TeamWizardLevel';

// NIVEAUX-PAR-SPORT (17/11/2026) — l'etape « Niveau » de l'assistant ne propose que les niveaux
// du sport choisi a l'etape « Sport », s'il en a ; sinon, les niveaux « tous sports ».
// INSCRIPTION-PARCOURS-2 (D257, Q1 d'Adel) : les 4 niveaux sont pour tous (aucun sport relie), la
// competition est reliee aux sports a competition ; un sport voit les « tous sports » + les siens.

const mockEtat = { current: /** @type {any} */ ({ activities: '', level: '' }) };
const mockDispatch = jest.fn();

// Forme rendue par le serveur, rangee comme getLevels la rend (compareLevels).
const mockNiveaux = [
  { activities: [{ documentId: 'sport-foot' }], documentId: 'n-dep', name: 'Départemental' },
  { activities: [{ documentId: 'sport-foot' }], documentId: 'n-nat', name: 'National' },
  { activities: [{ documentId: 'sport-foot' }], documentId: 'n-reg', name: 'Régional' },
  {
    activities: [], documentId: 'n-2', name: '2 - Amateur', rank: 2,
  },
  {
    activities: [], documentId: 'n-4', name: '4 - Expert', rank: 4,
  },
  {
    activities: [], documentId: 'n-1', name: '1 - Débutant', rank: 1,
  },
  {
    activities: [], documentId: 'n-3', name: '3 - Confirmé', rank: 3,
  },
];

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : cle
    ),
  }),
}));
jest.mock('@/theme/themeContext', () => ({
  __esModule: true,
  default: () => ({ Fonts: {}, Spaces: { gap: {}, marginBottom: {} } }),
}));
jest.mock('@/services/client', () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock('@/services/level/levelQueries', () => {
  const { compareLevels } = jest.requireActual('@/services/level/levelService');
  // Lu au rendu, pas au chargement du module : mockNiveaux n'existe pas encore quand jest
  // hisse ce mock.
  return {
    useGetLevels: () => ({
      data: [...mockNiveaux].sort(compareLevels), error: null, isLoading: false, refetch: jest.fn(),
    }),
  };
});
jest.mock('@/views/team/wizard/TeamWizardContext', () => ({
  useTeamWizard: () => ({ dispatch: mockDispatch, state: mockEtat.current }),
}));
jest.mock('@/views/team/wizard/useTeamWizardExit', () => () => jest.fn());
jest.mock('@/components/atoms/button/Button', () => function BoutonMock() { return null; });
jest.mock(
  '@/components/molecules/wizardStepLayout/WizardStepLayout',
  () => function GabaritMock(/** @type {any} */ props) { return props.children; },
);
jest.mock(
  '@/components/molecules/wizardOptionCard/WizardOptionCard',
  () => function CarteMock(/** @type {any} */ props) {
    const { Text: TexteRN } = jest.requireActual('react-native');
    return jest.requireActual('react').createElement(TexteRN, { testID: 'carte' }, props.title);
  },
);

/**
 * Monte l'etape et rend les titres des cartes proposees.
 * @param {string} sport - Le documentId du sport choisi a l'etape precedente.
 * @param {string} [niveau] - Le niveau deja dans l'etat de l'assistant.
 * @returns {string[]} Les titres, dans l'ordre.
 */
const niveauxProposes = (sport, niveau = '') => {
  mockEtat.current = { activities: sport, level: niveau };
  /** @type {any} */
  let arbre;
  act(() => {
    const navigation = /** @type {any} */ ({ navigate: jest.fn() });
    arbre = renderer.create(<TeamWizardLevel navigation={navigation} />);
  });
  return arbre.root.findAll((noeud) => noeud.type === Text && noeud.props.testID === 'carte')
    .map((noeud) => noeud.props.children);
};

describe('NIVEAUX-PAR-SPORT · TeamWizardLevel', () => {
  it('Speleologie : seulement les 4 niveaux, de Debutant a Expert', () => {
    expect(niveauxProposes('sport-speleo'))
      .toEqual(['1 - Débutant', '2 - Amateur', '3 - Confirmé', '4 - Expert']);
  });

  it('Football : les 4 d abord, puis les niveaux de competition', () => {
    expect(niveauxProposes('sport-foot')).toEqual([
      '1 - Débutant', '2 - Amateur', '3 - Confirmé', '4 - Expert',
      'Départemental', 'Régional', 'National',
    ]);
  });

  it('un niveau deja choisi qui n est plus propose (sport change) est retire de l equipe', () => {
    mockDispatch.mockClear();
    niveauxProposes('sport-speleo', 'n-reg');
    expect(mockDispatch).toHaveBeenCalledWith({ payload: '', type: 'SET_LEVEL' });
  });

  it('un niveau choisi et toujours propose est garde', () => {
    mockDispatch.mockClear();
    niveauxProposes('sport-speleo', 'n-3');
    expect(mockDispatch).not.toHaveBeenCalled();
  });
});
