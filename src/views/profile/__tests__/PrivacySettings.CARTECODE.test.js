// @ts-nocheck
/**
 * CARTECODE Q1 C (registre des mineurs ligne 46) — « Compte privé », dans un écran
 * « Confidentialité » neuf. L'interrupteur écrit `isProfileVisible` (le champ existe côté
 * serveur depuis D55) : allumé = compte privé = `isProfileVisible: false`.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Switch } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { updateMe } from '@/services/auth/authService';

import PrivacySettings from '../PrivacySettings';

/** @type {any} */
let mockUserData;

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (cle, repli) => (typeof repli === 'string' ? repli : cle),
  }),
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ getAuthTokens: () => ({ token: 'jeton' }), userData: mockUserData }),
}));

jest.mock('@/services/auth/authService', () => ({
  updateMe: jest.fn(async (champs) => ({ ...champs })),
}));

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const couleurs = genererCouleurs();
  return {
    __esModule: true,
    default: () => ({
      Colors: couleurs,
      Fonts: genererPolices(couleurs),
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) {
    return children;
  },
);

const monter = async (userData) => {
  mockUserData = userData;
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>
        <PrivacySettings />
      </QueryClientProvider>,
    );
  });
  return arbre;
};

describe('CARTECODE Q1 C — « Compte privé » dans Confidentialité', () => {
  beforeEach(() => jest.clearAllMocks());

  it('un compte sans réglage est public : l’interrupteur est éteint', async () => {
    const arbre = await monter({ documentId: 'u1' });
    expect(arbre.root.findByType(Switch).props.value).toBe(false);
  });

  it('allumer « Compte privé » enregistre isProfileVisible: false', async () => {
    const arbre = await monter({ documentId: 'u1', isProfileVisible: true });
    await act(async () => { arbre.root.findByType(Switch).props.onValueChange(true); });
    expect(updateMe).toHaveBeenCalledWith({ isProfileVisible: false });
  });

  it('un compte privé voit l’interrupteur allumé, et l’éteindre le rend public', async () => {
    const arbre = await monter({ documentId: 'u1', isProfileVisible: false });
    const interrupteur = arbre.root.findByType(Switch);
    expect(interrupteur.props.value).toBe(true);
    await act(async () => { interrupteur.props.onValueChange(false); });
    expect(updateMe).toHaveBeenCalledWith({ isProfileVisible: true });
  });
});
