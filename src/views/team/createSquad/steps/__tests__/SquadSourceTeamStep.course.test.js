import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

// BH12 P12-16 : choisir A puis B vite ; si A repond APRES B, c'est B qui doit rester importee.
const mockAttente = {};
let mockSetValue = null;

jest.mock('i18next', () => ({ t: (_k, r) => r }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k, r) => (typeof r === 'string' ? r : k) }) }));
jest.mock('@/theme/themeContext', () => () => ({ Colors: {}, Fonts: {} }));
jest.mock('@/components/atoms/button/Button', () => () => null);
jest.mock('@/components/molecules/autocompleteSelect/AutocompleteSelect', () => (props) => { mockSetValue = props.setValue; return null; });
jest.mock('@/services/team/teamService', () => ({
  getTeamById: (id) => new Promise((resolve) => { mockAttente[id] = resolve; }),
}));

const SquadSourceTeamStep = require('../SquadSourceTeamStep').default;

test('P12-16 : la réponse tardive de la première équipe n écrase pas la seconde', async () => {
  const donnees = {};
  const updateData = (cle, valeur) => { donnees[cle] = valeur; };
  act(() => {
    renderer.create(createElement(SquadSourceTeamStep, {
      data: {}, onNext: jest.fn(), onPrev: jest.fn(), updateData, user: { trainedTeams: [] },
    }));
  });
  let pA;
  let pB;
  act(() => { pA = mockSetValue({ label: 'A', value: 'a' }); });
  act(() => { pB = mockSetValue({ label: 'B', value: 'b' }); });
  await act(async () => { mockAttente.b({ name: 'Equipe B' }); await pB; });
  await act(async () => { mockAttente.a({ name: 'Equipe A' }); await pA; });
  expect(donnees.name).toBe('Equipe B');
});
