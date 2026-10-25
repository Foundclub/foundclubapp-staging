import renderer, { act } from 'react-test-renderer';

import AdminNotificationsHealth from '../AdminNotificationsHealth';

/**
 * C10 / P9-15 — « Diagnostic notifications » du SuperAdmin.
 *
 * LE SYMPTOME : un test d envoi qui n est parti nulle part s affichait
 * « Test standard : OK avec avertissement ».
 * CE QUE DIT LE SERVEUR (admin notification.ts, testHealthNotification) :
 * `ok` vaut `result.success`, faux quand le push est coupe (`push_disabled`),
 * quand le compte n a aucun jeton (`no_tokens`) ou quand aucun envoi n a reussi.
 * Dans les trois cas RIEN n est parti : c est un echec, pas un avertissement.
 */

/** @type {any} */
let mockRetourTest;

jest.mock('i18next', () => ({
  __esModule: true,
  default: {
    t: (/** @type {string} */ cle, /** @type {any} */ defaut) => (
      typeof defaut === 'string' ? defaut : cle
    ),
  },
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: jest.requireMock('i18next').default.t }),
}));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: () => {} }));
jest.mock('@/store/appContext', () => ({ useAppContext: () => [{ authSessions: [] }] }));
jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);
jest.mock(
  '@/views/admin/components/AdminStateView',
  () => function AdminStateViewMock() { return null; },
);
jest.mock('@/services/admin/adminQueries', () => {
  const mutation = (/** @type {() => any} */ lire) => () => ({
    isPending: false,
    mutateAsync: () => Promise.resolve(lire()),
  });
  return {
    useGetNotificationsHealth: () => ({
      data: {}, error: null, isFetching: false, isLoading: false, refetch: jest.fn(),
    }),
    usePurgeNotificationDeliveries: mutation(() => ({ ok: true })),
    useRetryNotificationDelivery: mutation(() => ({ ok: true })),
    useSendNotificationsHealthTest: mutation(() => mockRetourTest),
  };
});

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();
  return {
    __esModule: true,
    default: () => ({ Colors: couleurs, Fonts: genererPolices(couleurs), Spaces: espaces }),
  };
});

/** @type {any[]} */
const arbres = [];
afterEach(() => {
  while (arbres.length) {
    const arbre = arbres.pop();
    act(() => { arbre.unmount(); });
  }
});

/**
 * Monte l ecran, appuie sur « Test standard » et rend tout le texte affiche.
 * @returns {Promise<string>} Le texte de l ecran apres l action.
 */
const lancerTestStandard = async () => {
  /** @type {any} */
  let arbre;
  act(() => { arbre = renderer.create(<AdminNotificationsHealth />); });
  arbres.push(arbre);
  const bouton = arbre.root.findAll((/** @type {any} */ n) => typeof n.props?.onPress === 'function'
    && n.findAll((/** @type {any} */ e) => e.children?.includes?.('Test standard')).length > 0)[0];
  await act(async () => { await bouton.props.onPress(); });
  return arbre.root.findAll((/** @type {any} */ n) => n.type === 'Text')
    .map((/** @type {any} */ n) => n.children.join('')).join(' | ');
};

test('P9-15/1 — ok: false s affiche en echec, avec la raison du serveur', async () => {
  mockRetourTest = { kind: 'standard', ok: false, result: { reason: 'no_tokens', success: false } };

  const texte = await lancerTestStandard();

  expect(texte).not.toContain('Test standard : OK');
  expect(texte).toContain('Test standard : échec, rien n’a été envoyé (no_tokens)');
});

test('P9-15/2 — ok: false sans raison (aucun envoi reussi) reste un echec', async () => {
  mockRetourTest = { ok: false, result: { success: false } };

  expect(await lancerTestStandard()).toContain('Test standard : échec, rien n’a été envoyé |');
});

test('P9-15/3 — un envoi reussi reste « OK »', async () => {
  mockRetourTest = { ok: true, result: { success: true } };

  expect(await lancerTestStandard()).toContain('Test standard : OK');
});
