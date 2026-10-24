import renderer, { act } from 'react-test-renderer';

import useLeagueLegalAcceptance from '../useLeagueLegalAcceptance';

jest.mock('@/components/organisms/league/LeagueLegalAcceptanceModal', () => () => null);

// BH09 P3-09 : un second appel ne doit pas laisser la première promesse en suspens.
test('double appui : la première promesse se termine (null)', async () => {
  let api;
  const Probe = () => {
    api = useLeagueLegalAcceptance();
    return null;
  };
  act(() => { renderer.create(<Probe />); });
  let first;
  act(() => {
    first = api.requestLeagueLegalAcceptance({ scope: 'x' });
    api.requestLeagueLegalAcceptance({ scope: 'x' });
  });
  const settled = await Promise.race([first, new Promise((r) => { setTimeout(() => r('pending'), 50); })]);
  expect(settled).toBeNull();
});
