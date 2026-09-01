import { QueryClient, QueryClientProvider, QueryObserver } from '@tanstack/react-query';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import Button from '@/components/atoms/button/Button';

import WithDataWrapper from '../WithDataWrapper';

// Le vrai theme, construit sans provider : `ErrorWrapper` lit `Alignments`,
// `ApplicationStyle`, `Fonts` et `Spaces`. Un mock partiel les rendrait
// `undefined` et masquerait le vrai sujet du test.
jest.mock('@/theme/themeContext', () => {
  const Alignments = jest.requireActual('@/theme/alignements').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const colors = jest.requireActual('@/theme/colors').default();
  const ApplicationStyle = jest.requireActual('@/theme/applicationStyle').default(colors);
  const Fonts = jest.requireActual('@/theme/fonts').default(colors);
  return {
    __esModule: true,
    default: () => ({
      Alignments, ApplicationStyle, Colors: colors, Fonts, Images: {}, Spaces,
    }),
  };
});

jest.mock('@/components/atoms/skeletonLoader/SkeletonLoader', () => {
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: ({ children }) => <View>{children}</View> };
});

/**
 * U06 — TEMOIN 1 : « un ecran en panne propose de reessayer ».
 *
 * 🧨 Le defaut mesure : `ErrorWrapper` SAIT deja rendre un bouton « Reessayer »
 * (prop `onRetry`), mais `WithDataWrapper` — le seul chemin emprunte par
 * 30 fichiers d'ecran — ne la lui passait JAMAIS. Le pave rouge recouvrait la
 * liste sans proposer la moindre sortie.
 *
 * La correction est a la SOURCE (§1 bis) : ce composant-ci, une fois, et non
 * 30 ecrans un par un. Quand l'appelant ne fournit rien, on relance les requetes
 * REELLEMENT en echec dans le cache react-query.
 *
 * ⛔ AUCUN BOUTON INERTE : sans requete en echec et sans `onRetry`, le bouton
 * n'apparait pas — il n'aurait rien a relancer.
 */

// PERF3 — chaque observateur monté par la fabrique est désabonné après le test :
// un observateur qui survit continue d'écouter le cache du test suivant.
let desabonnements = [];

afterEach(() => {
  desabonnements.forEach((desabonner) => desabonner());
  desabonnements = [];
});

const clientAvecUneRequeteEnEchec = async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false } },
  });
  await client.prefetchQuery({
    queryFn: () => Promise.reject(new Error('reseau indisponible')),
    queryKey: ['u06-liste-en-panne'],
  });
  // PERF3 — un écran monté OBSERVE sa requête : c'est ce qui la rend « active ».
  // Sans observateur, une requête en échec n'est qu'un résidu de cache (écran
  // démonté, gcTime 5 min) et ne doit plus être ni comptée ni relancée.
  const observer = new QueryObserver(client, {
    queryFn: () => Promise.reject(new Error('reseau indisponible')),
    queryKey: ['u06-liste-en-panne'],
    // Sans quoi l'abonnement RELANCE la requête en erreur (retryOnMount par
    // défaut) : son statut repasse à 'pending' et le pavé n'a plus d'échec
    // à montrer au moment du rendu.
    retryOnMount: false,
  });
  desabonnements.push(observer.subscribe(() => {}));
  return client;
};

const monter = (client, props) => {
  let arbre;
  act(() => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>
        <WithDataWrapper
          error={props.error}
          isLoading={false}
          onRetry={props.onRetry}
        >
          <Text>contenu</Text>
        </WithDataWrapper>
      </QueryClientProvider>,
    );
  });
  return arbre;
};

const boutons = (arbre) => arbre.root.findAllByType(Button).map((noeud) => noeud.props);

describe('U06 — le pave rouge propose de reessayer', () => {
  it('temoin 1 — une liste en panne affiche un bouton « Reessayer »', async () => {
    const client = await clientAvecUneRequeteEnEchec();

    const arbre = monter(client, { error: 'reseau indisponible' });

    expect(boutons(arbre).map((props) => props.title)).toContain('Réessayer');
  });

  it('le bouton relance les requetes en echec, et elles seules', async () => {
    const client = await clientAvecUneRequeteEnEchec();
    const refetchQueries = jest.spyOn(client, 'refetchQueries').mockResolvedValue(undefined);

    const arbre = monter(client, { error: 'reseau indisponible' });
    await act(async () => {
      boutons(arbre).find((props) => props.title === 'Réessayer').onPress();
    });

    expect(refetchQueries).toHaveBeenCalledTimes(1);
    const { predicate } = refetchQueries.mock.calls[0][0];
    expect(predicate({ state: { status: 'error' } })).toBe(true);
    expect(predicate({ state: { status: 'success' } })).toBe(false);
  });

  it('un `onRetry` fourni par l ecran gagne sur la relance automatique', async () => {
    const client = await clientAvecUneRequeteEnEchec();
    const refetchQueries = jest.spyOn(client, 'refetchQueries').mockResolvedValue(undefined);
    const onRetry = jest.fn();

    const arbre = monter(client, { error: 'reseau indisponible', onRetry });
    await act(async () => {
      boutons(arbre).find((props) => props.title === 'Réessayer').onPress();
    });

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(refetchQueries).not.toHaveBeenCalled();
  });

  it('AUCUN BOUTON INERTE — rien a relancer, donc pas de bouton', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const arbre = monter(client, { error: 'formulaire incomplet' });

    expect(boutons(arbre).map((props) => props.title)).not.toContain('Réessayer');
  });

  it('sans panne, le contenu passe et aucun bouton n apparait', async () => {
    const client = await clientAvecUneRequeteEnEchec();

    const arbre = monter(client, { error: undefined });

    expect(boutons(arbre)).toHaveLength(0);
  });
});

/**
 * PERF3 — LE BOUTON « RÉESSAYER » N'AMPLIFIE PLUS LA PANNE.
 *
 * Le défaut mesuré (2026-09-01) : `refetchQueries({ predicate: isFailedQuery })`
 * sans filtre de clé relançait AUSSI les requêtes en erreur SANS observateur
 * (écran démonté, gcTime 5 min) — le seul balayage non borné de l'app. Et le
 * bouton n'avait ni `disabled` ni anti-rebond : le marteler multipliait la
 * demande précisément quand le serveur rame.
 */
describe('PERF3 — le bouton « Réessayer » n\'amplifie plus la panne', () => {
  it('la relance est BORNÉE aux requêtes observées (type active)', async () => {
    const client = await clientAvecUneRequeteEnEchec();
    const refetchQueries = jest.spyOn(client, 'refetchQueries').mockResolvedValue(undefined);

    const arbre = monter(client, { error: 'reseau indisponible' });
    await act(async () => {
      boutons(arbre).find((props) => props.title === 'Réessayer').onPress();
    });

    expect(refetchQueries).toHaveBeenCalledTimes(1);
    expect(refetchQueries.mock.calls[0][0].type).toBe('active');
  });

  it('une requête en échec dont l\'écran est DÉMONTÉ ne rend plus de bouton', async () => {
    // Le cache d'avant ce lot : une requête en échec SANS observateur (prefetch
    // seul) — l'écran qui l'avait montée est parti, elle dort dans le cache.
    const client = new QueryClient({
      defaultOptions: { queries: { gcTime: Infinity, retry: false } },
    });
    await client.prefetchQuery({
      queryFn: () => Promise.reject(new Error('reseau indisponible')),
      queryKey: ['ecran-demonte'],
    });

    const arbre = monter(client, { error: 'reseau indisponible' });

    expect(boutons(arbre).map((props) => props.title)).not.toContain('Réessayer');
  });

  it('marteler le bouton ne relance qu\'UNE fois tant que la relance est en vol', async () => {
    const client = await clientAvecUneRequeteEnEchec();
    let terminerLaRelance;
    const refetchQueries = jest.spyOn(client, 'refetchQueries').mockImplementation(
      () => new Promise((resolve) => { terminerLaRelance = resolve; }),
    );

    const arbre = monter(client, { error: 'reseau indisponible' });
    const bouton = () => boutons(arbre).find((props) => props.title === 'Réessayer');

    act(() => { bouton().onPress(); });
    act(() => { bouton().onPress(); });

    expect(refetchQueries).toHaveBeenCalledTimes(1);
    expect(bouton().isLoading).toBe(true);

    await act(async () => { terminerLaRelance(); });
    expect(bouton().isLoading).toBe(false);
  });
});
