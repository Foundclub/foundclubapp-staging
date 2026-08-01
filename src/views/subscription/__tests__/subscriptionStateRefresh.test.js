import fs from 'fs';
import path from 'path';

import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import renderer, { act } from 'react-test-renderer';

import { getSubscriptionAccessLevel } from '@/domains/subscription/subscriptionDecision';

import { getAppBootstrap } from '@/services/bootstrap/bootstrapService';

import SubscriptionSuccess from '../SubscriptionSuccess';

/**
 * L08 — « après un achat réussi, Mon abonnement affiche encore Gratuit ;
 * il faut fermer et rouvrir l'app » (constaté par Adel sur la build 2.6.1).
 *
 * Ce que le test rejoue, à la seconde près :
 *  1. l'achat client réussit AVANT que le serveur n'ouvre les droits (le
 *     webhook du store converge en quelques secondes) ;
 *  2. le parcours d'achat invalide `['app-bootstrap']` tout de suite — il
 *     relit donc l'ANCIEN état et le remet en cache comme frais ;
 *  3. l'utilisateur appuie sur « Reprendre » au bout d'1 s : l'écran de succès
 *     est démonté, et avec lui les relances différées posées dans son
 *     `useEffect` (leur nettoyage de démontage les annule) ;
 *  4. plus rien ne relit jamais `['app-bootstrap']` (`refetchOnMount: false`,
 *     `refetchOnWindowFocus: false`) — d'où le redémarrage obligatoire.
 *
 * La sonde reproduit l'observateur de `useAuth` (PrivateNavigator le monte en
 * permanence) : c'est LUI qui alimente tous les écrans lisant
 * `subscriptionSummary`, pas seulement « Mon abonnement ».
 */

jest.mock('@/services/bootstrap/bootstrapService', () => ({
  getAppBootstrap: jest.fn(),
}));

// L11 : l'ecran traduit ses libelles ; sans instance i18next initialisee, le
// vrai hook rendrait les cles — le repli suffit ici, le scenario ne lit pas la copy.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ key, /** @type {any} */ fallback) => (
      typeof fallback === 'string' ? fallback : key
    ),
  }),
}));

jest.mock('@/services/subscription/subscriptionService', () => ({
  trackSubscriptionFunnelEvent: jest.fn(),
}));

jest.mock('@/theme/themeContext', () => {
  const styleLeaf = {};
  const makeRamp = () => new Proxy({}, { get: () => styleLeaf });
  return {
    __esModule: true,
    default: () => ({
      Alignments: makeRamp(),
      Colors: new Proxy({}, { get: (_target, key) => `couleur-${String(key)}` }),
      Fonts: makeRamp(),
      Spaces: new Proxy({}, { get: () => makeRamp() }),
    }),
  };
});

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) {
    return children;
  },
);

const mockButtonHandlers = new Map();
jest.mock('@/components/atoms/button/Button', () => function ButtonMock({ onPress, title }) {
  mockButtonHandlers.set(title, onPress);
  return null;
});

// Le serveur n'ouvre les droits qu'à la réception du webhook du store.
const SERVER_CONVERGENCE_MS = 6000;
const ABONNEMENT_GRATUIT = null;
const ABONNEMENT_ACTIF = {
  activePlanCodes: ['TEAM_2_YEARLY'],
  hasTeamPlan: true,
  payerSubscriptionIds: ['sub-l08'],
};

const BOOTSTRAP_QUERY_KEY = ['app-bootstrap', 'jeton-de-test'];

let purchasedAtMs = 0;
let niveauObserve = 'FREE';

/**
 * Copie conforme de l'observateur de `useAuth` (useAuth.js:237-250 + 645-690) :
 * mêmes options de query, même dérivation du niveau d'accès.
 * @returns {null} Rien à rendre : la sonde ne sert qu'aux assertions.
 */
function BootstrapProbe() {
  const { data } = useQuery({
    queryFn: getAppBootstrap,
    queryKey: BOOTSTRAP_QUERY_KEY,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 1000 * 30,
  });
  niveauObserve = getSubscriptionAccessLevel({
    entitlementsSummary: data?.entitlementsSummary,
    subscriptionSummary: data?.subscriptionSummary,
  });
  return null;
}

const navigation = {
  goBack: jest.fn(),
  navigate: jest.fn(),
  reset: jest.fn(),
};

/**
 * Racine de test : la sonde vit hors de l'écran de succès, comme le navigateur
 * privé qui monte `useAuth` en permanence.
 * @param {{ afficheEcranSucces: boolean, queryClient: any }} props - Les props.
 * @returns {import('react').ReactElement} L'arbre de test.
 */
function Racine({ afficheEcranSucces, queryClient }) {
  return (
    <QueryClientProvider client={queryClient}>
      <BootstrapProbe />
      {afficheEcranSucces ? (
        <SubscriptionSuccess
          navigation={/** @type {any} */ (navigation)}
          route={/** @type {any} */ ({ params: { resumeCtaLabel: 'Reprendre' } })}
        />
      ) : null}
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockButtonHandlers.clear();
  purchasedAtMs = 0;
  niveauObserve = 'FREE';
  getAppBootstrap.mockImplementation(async () => ({
    serverTime: new Date().toISOString(),
    subscriptionSummary: purchasedAtMs && Date.now() - purchasedAtMs >= SERVER_CONVERGENCE_MS
      ? ABONNEMENT_ACTIF
      : ABONNEMENT_GRATUIT,
  }));
});

afterEach(() => {
  jest.useRealTimers();
});

describe('L08 — l\'état d\'abonnement se rafraîchit sans redémarrer l\'app', () => {
  it('passe de Gratuit à Team même si l\'écran de succès est quitté', async () => {
    const queryClient = new QueryClient();
    /** @type {any} */
    let arbre;

    await act(async () => {
      arbre = renderer.create(
        <Racine afficheEcranSucces={false} queryClient={queryClient} />,
      );
    });
    expect(niveauObserve).toBe('FREE');

    // --- L'achat store réussit : le parcours invalide, puis navigue vers l'écran de succès.
    purchasedAtMs = Date.now();
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['app-bootstrap'] });
    });
    await act(async () => {
      arbre.update(<Racine afficheEcranSucces queryClient={queryClient} />);
    });

    // --- 1 s plus tard, l'utilisateur reprend sa tâche : l'écran de succès disparaît.
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1000);
    });
    expect(mockButtonHandlers.get('Reprendre')).toEqual(expect.any(Function));
    await act(async () => {
      mockButtonHandlers.get('Reprendre')();
    });
    await act(async () => {
      arbre.update(<Racine afficheEcranSucces={false} queryClient={queryClient} />);
    });

    // --- On laisse très largement le temps au serveur (6 s) et au cache (30 s).
    await act(async () => {
      await jest.advanceTimersByTimeAsync(60000);
    });

    expect(niveauObserve).toBe('TEAM');
  });

  it('rafraîchit aussi quand l\'utilisateur ne touche à rien après l\'achat', async () => {
    const queryClient = new QueryClient();
    /** @type {any} */
    let arbre;

    await act(async () => {
      arbre = renderer.create(
        <Racine afficheEcranSucces={false} queryClient={queryClient} />,
      );
    });

    purchasedAtMs = Date.now();
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['app-bootstrap'] });
    });
    await act(async () => {
      arbre.update(<Racine afficheEcranSucces queryClient={queryClient} />);
    });

    await act(async () => {
      await jest.advanceTimersByTimeAsync(60000);
    });

    expect(niveauObserve).toBe('TEAM');
  });

  // Filet anti-dérive : la sonde ci-dessus ne vaut que si `useAuth` garde les
  // options qu'elle copie. Si l'une d'elles change, ce test tombe et force à
  // relire le scénario au lieu de le laisser mentir en silence.
  it('la sonde reste fidèle aux options de la query app-bootstrap de useAuth', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../../../domains/auth/useAuth.js'),
      'utf8',
    );
    expect(source).toContain("queryKey: ['app-bootstrap', auth?.token || 'no-token']");
    expect(source).toContain('refetchOnMount: false');
    expect(source).toContain('refetchOnWindowFocus: false');
    expect(source).toContain('staleTime: 1000 * 30');
  });
});
