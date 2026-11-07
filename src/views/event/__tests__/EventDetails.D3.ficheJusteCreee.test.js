// RETOURS-TESTEUR-3 D3 (07/11/2026) — « Infos rapides » vides sur la fiche d'un événement
// tout juste créé, constaté sur le site (CR-TRAIN5, point 5 : TYPE Non défini, ÉQUIPE Non
// définie, CAPACITÉ 0,
// l'en-tête disant pourtant « Entraînement · CR-T5 U13 »).
// La fiche est d'abord remplie avec la réponse de la création (EventWizardRecap.js:171,
// `setQueryData(['event', id], …)`), qui ne porte ni type ni équipe ; elle doit relire le serveur à
// l'arrivée (EventDetails.web.js:232, `refetchOnMount: 'always'` quand `fromEventCreation`).
// Ce témoin rejoue, sans serveur, les deux maillons côté client : le paramètre qui déclenche
// la relecture traverse-t-il l'adresse du site, et la relecture remplace-t-elle la réponse de
// création ?
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import renderer, { act } from 'react-test-renderer';

import { RouteNames } from '@/navigation/routeNames';
import { createWebNavigationAdapter } from '@/navigation/webNavigationAdapter';
import { readWebQueryParams } from '@/navigation/webRoutes';

import { useGetEvent } from '@/services/event/eventQueries';

const mockGetEventById = jest.fn();
jest.mock('@/services/event/eventService', () => ({
  getEventById: (/** @type {string} */ id) => mockGetEventById(id),
}));

// La réponse de POST /events : les colonnes, aucune relation peuplée.
const REPONSE_DE_CREATION = Object.freeze({
  capacity: 0,
  documentId: 'ev-neuf',
  name: 'Entraînement · CR-T5 U13',
  status: 'published',
});
// GET /events/:id avec son populate (find-one-populate.ts : `type`, `team`).
const FICHE_RELUE = Object.freeze({
  ...REPONSE_DE_CREATION,
  team: { documentId: 'eq-u13', name: 'CR-T5 U13', section: null },
  type: { documentId: 'type-ent', name: 'Entraînement' },
});

describe('D3 — la fiche d un événement tout juste créé, sur le site', () => {
  // Entraînement : pas d'affiche, donc une seule route dans la pile.
  it('maillon 1 : « fromEventCreation » traverse l adresse et revient VRAI', () => {
    /** @type {string[]} */
    const chemins = [];
    const navigation = createWebNavigationAdapter({
      currentPath: '/events/create/recap',
      currentRouteName: RouteNames.EventWizardRecap,
      goBack: () => {},
      params: {},
      push: (/** @type {string} */ chemin) => { chemins.push(chemin); },
      replace: (/** @type {string} */ chemin) => { chemins.push(chemin); },
      setSearchParams: () => {},
    });

    // Les paramètres exacts de EventWizardRecap.js (club sans offre : `subscriptionFollowUp`).
    navigation.reset({
      index: 0,
      routes: [{
        name: RouteNames.EventDetails,
        params: {
          creationCelebration: { actionKey: 'event_created', payload: { eventId: 'ev-neuf' } },
          eventCampaignCreationSuggested: true,
          eventId: 'ev-neuf',
          fromEventCreation: true,
          subscriptionFollowUp: {
            beforeRemaining: 2, consumedCount: 1, quotaType: 'EVENT_PUBLISH', total: 2,
          },
        },
      }],
    });

    expect(chemins).toHaveLength(1);
    const adresse = new URL(chemins[0], 'https://foundclub.app');
    expect(adresse.pathname).toBe('/events/ev-neuf');
    expect(readWebQueryParams(adresse.searchParams).fromEventCreation).toBe(true);
  });

  it('maillon 2 : la relecture à l arrivée remplace la réponse de création', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(['event', 'ev-neuf'], REPONSE_DE_CREATION);
    mockGetEventById.mockResolvedValue(FICHE_RELUE);
    /** @type {any[]} */
    const vus = [];
    /**
     * La fiche réduite à sa lecture de l'événement.
     * @returns {null} Rien à afficher.
     */
    function Fiche() {
      // Les options exactes de EventDetails.web.js quand `fromEventCreation` est vrai.
      const { data } = useGetEvent('ev-neuf', { refetchOnMount: 'always', staleTime: 0 });
      vus.push(data);
      return null;
    }

    /** @type {any} */
    let arbre;
    await act(async () => {
      arbre = renderer.create(<QueryClientProvider client={client}><Fiche /></QueryClientProvider>);
    });

    // La relecture se résout après le montage : on laisse passer la promesse du serveur doublé.
    await act(async () => { await new Promise((fin) => { setTimeout(fin, 50); }); });
    expect(mockGetEventById).toHaveBeenCalledWith('ev-neuf');
    // Le premier rendu montre la réponse de création (c'est attendu), le dernier la fiche relue.
    expect(vus[0]).toBe(REPONSE_DE_CREATION);
    expect(vus[vus.length - 1]?.type?.name).toBe('Entraînement');
    expect(vus[vus.length - 1]?.team?.name).toBe('CR-T5 U13');
    act(() => arbre.unmount());
    client.clear();
  });
});
