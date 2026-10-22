import fs from 'fs';
import path from 'path';

import { getStateFromPath } from '@react-navigation/native';
import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

// RESA-L6B-2 (20/10/2026) — E-P08 : connecté, foundclub://r/<code> ouvre la page d'invitation DANS
// l'app (ReserverInvitation, `code`), seulement l'interrupteur COMPLEXES_JOUEUR allumé ; éteint, le
// lien ne vise rien (l'écran n'est pas déclaré). L'écran est déclaré dans PrivateNavigator.js.
// Même lecture de la config que linking.routesAtteignables.test.js (NavigationContainer doublé).

const mockLinkings = /** @type {any[]} */ ([]);
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  __esModule: true,
  NavigationContainer: (/** @type {any} */ props) => {
    mockLinkings.push(props.linking);
    return null;
  },
}));
jest.mock('@/store/appContext', () => ({
  __esModule: true,
  useAppContext: () => [{ auth: { token: 'jeton' }, isAddingAccount: false }],
}));
jest.mock('@/theme/themeContext', () => ({
  __esModule: true,
  default: () => ({
    ApplicationStyle: { darkNavigationTheme: {}, lightNavigationTheme: {} },
    Colors: {},
    scheme: 'light',
  }),
}));
jest.mock('@/utils/logger/logger', () => ({
  __esModule: true,
  createLogger: () => ({
    debug: () => {}, error: () => {}, info: () => {}, warn: () => {},
  }),
}));
jest.mock('@/navigation/navigationService', () => ({
  __esModule: true,
  navigationRef: { getCurrentRoute: () => null },
}));
jest.mock('@/components/molecules/tour/TourBanner', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/navigation/private/PrivateNavigator', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/navigation/public/PublicMainNavigator', () => ({
  __esModule: true,
  default: () => null,
}));

/**
 * La config des liens du mode connecté, l'interrupteur du joueur posé.
 * @param {boolean} allume - COMPLEXES_JOUEUR.
 * @returns {any} La config.
 */
const configConnectee = (allume) => {
  mockLinkings.length = 0;
  jest.isolateModules(() => {
    jest.doMock('@/config/fonctionsMasquees', () => ({
      ...jest.requireActual('@/config/fonctionsMasquees'),
      __esModule: true,
      COMPLEXES_JOUEUR: allume,
    }));
    // eslint-disable-next-line global-require
    const AppNavigator = require('../appNavigator').default;
    act(() => {
      renderer.create(createElement(AppNavigator, {
        navigationIntegration: { registerNavigationContainer: () => {} },
      }));
    });
  });
  return mockLinkings[mockLinkings.length - 1]?.config;
};

it('allumé : foundclub://r/K7Q2M9 ouvre la page d’invitation, avec son code', () => {
  const etat = getStateFromPath('r/K7Q2M9', configConnectee(true));
  expect(etat?.routes?.[0]).toEqual(expect.objectContaining({
    name: 'ReserverInvitation',
    params: { code: 'K7Q2M9' },
  }));
});

it('éteint : le lien ne vise pas la page (elle n’est pas déclarée)', () => {
  const etat = getStateFromPath('r/K7Q2M9', configConnectee(false));
  expect(etat?.routes?.[0]?.name).not.toBe('ReserverInvitation');
});

it('PrivateNavigator déclare l’écran, derrière l’interrupteur', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'private', 'PrivateNavigator.js'),
    'utf8',
  );
  expect(source).toMatch(
    /COMPLEXES_JOUEUR \? \(\s*<Stack\.Screen\s*getComponent=\{\(\) => require\('@\/views\/reserverTerrain\/ReserverInvitation'\)\.default\}\s*name=\{RouteNames\.ReserverInvitation\}/,
  );
});
