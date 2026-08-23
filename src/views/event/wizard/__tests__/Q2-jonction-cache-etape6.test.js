import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import { useGetTeam } from '@/services/team/teamQueries';
import { getTeamById } from '@/services/team/teamService';

// Q2 — LA JONCTION : ce que l'etape 6 trouve quand l'etape 2 a precharge.
//
// 🔗 CE TEMOIN EST LE SEUL A TENIR LES DEUX BOUTS. Les deux autres fichiers Q2
// regardent chacun une moitie du lot :
//   · `Q2-prechargement-effectif` prouve que le toucher pose l'effectif dans le
//     cache, sous la cle `['team', id]` ;
//   · `Q2-effectif-tunnel-match` prouve que l'ecran dit honnetement qu'il
//     charge quand il charge.
// Aucun des deux ne prouve la PROMESSE du lot : que l'etape 6, avec un cache
// chaud, affiche l'effectif SANS PASSER PAR L'ETAT DE CHARGEMENT.
//
// 🧩 C'est pour ca que ce fichier ne double NI react-query NI `teamQueries` :
// il fait tourner les VRAIS. Il ne double que le service HTTP — obligatoire,
// le client exige `API_URL` au chargement (`client.native.js:21`).
//
// 🛡️ CE QU'IL PROTEGE VRAIMENT : la cle vit a DEUX endroits, dans deux fichiers
// que deux lots differents peuvent toucher — `teamQueries.js:43` (lecture) et
// `EventWizardTeam.js` (prechargement). Le jour ou l'une des deux bouge seule,
// tout reste vert ailleurs, et le retard revient sans que personne ne le voie.
// Ici, il devient rouge.

/** Les identifiants pour lesquels le service a vraiment ete appele. */
const mockAppelsEffectif = [];

/** L'effectif rendu par le serveur. */
const EFFECTIF_COMPLET = {
  documentId: 'eq-1',
  name: 'U15 A',
  players: [
    { documentId: 'j1', firstname: 'Karim', lastname: 'Benali' },
    { documentId: 'j2', firstname: 'Louis', lastname: 'Marchand' },
    { documentId: 'j3', firstname: 'Theo', lastname: 'Nguyen' },
  ],
};

// ⛔ Jamais `requireActual` sur un service : le client HTTP exige `API_URL` et
// la suite entiere meurt au chargement (0 test execute).
jest.mock('@/services/team/teamService', () => ({
  getTeamById: (/** @type {string} */ identifiant) => {
    mockAppelsEffectif.push(identifiant);
    return Promise.resolve({ ...EFFECTIF_COMPLET, documentId: identifiant });
  },
}));

/** Ce que l'etape 6 a lu, rendu par rendu. */
const lectures = [];

/**
 * La sonde fait exactement ce que fait l'etape 6 : le meme hook, la meme cle.
 * @returns {null} Rien.
 */
function CommeLEtape6() {
  const { data, isLoading } = useGetTeam('eq-1', { enabled: true });
  lectures.push({ isLoading, joueurs: data?.players?.length ?? null });
  return null;
}

/** @type {any} */
let client;
/** @type {any} */
let arbre;

/**
 * Monte la sonde sur le cache passe en parametre.
 * @returns {Promise<void>} Quand le montage est stabilise.
 */
const monterLEtape6 = async () => {
  await act(async () => {
    arbre = renderer.create(createElement(
      QueryClientProvider,
      { client },
      createElement(CommeLEtape6),
    ));
  });
};

beforeEach(() => {
  mockAppelsEffectif.length = 0;
  lectures.length = 0;
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

afterEach(async () => {
  if (arbre) await act(async () => { arbre.unmount(); });
  arbre = null;
  client.clear();
});

describe("Q2 — la jonction entre le prechargement et l'etape 6", () => {
  test('cache chaud : l etape 6 affiche l effectif SANS etat de chargement', async () => {
    // Ce que fait `handleSelectTeam` au toucher de l'equipe.
    await client.prefetchQuery({
      queryFn: () => getTeamById('eq-1'),
      queryKey: ['team', 'eq-1'],
    });

    await monterLEtape6();

    // LA promesse du lot, mesuree au PREMIER rendu : pas de loader, pas de
    // « 0 sur 0 », l'effectif est deja la.
    expect(lectures[0]).toEqual({ isLoading: false, joueurs: 3 });
  });

  test('cache froid : l etape 6 passe bien par l etat de chargement', async () => {
    // Le garde-fou : sans prechargement, l'ecran DOIT charger — c'est ce que le
    // loader honnete de `EventWizardParticipants` rend visible. Si ce temoin
    // devenait vert avec `isLoading: false`, le temoin du dessus ne prouverait
    // plus rien (il serait vert quoi qu'il arrive).
    await monterLEtape6();

    expect(lectures[0]).toEqual({ isLoading: true, joueurs: null });
  });

  test('le prechargement ne dispense PAS du rappel de fraicheur', async () => {
    await client.prefetchQuery({
      queryFn: () => getTeamById('eq-1'),
      queryKey: ['team', 'eq-1'],
    });
    await monterLEtape6();

    // 🧾 MESURE, PAS SOUHAIT — a lire avec le compte rendu du lot. Aucun
    // `staleTime` n'est pose sur cette cle (ni globalement,
    // `app/queryClient.js:111`, ni dans `teamQueries.js:40-45`), donc la donnee
    // prechargee est perimee des qu'elle arrive et le montage relance UN appel
    // de fond. L'organisateur ne le voit pas — il lit deja sa liste — mais le
    // serveur prend DEUX GET lourds par creation de match au lieu d'un.
    // ⛔ Rien n'est corrige ici : poser un `staleTime` sur `['team', id]`
    // toucherait aussi `TeamDetails` et `TeamEdit`, qui partagent la cle. Ce
    // temoin EPINGLE le chiffre pour que le jour ou quelqu'un le change, ce
    // soit un choix et pas un accident.
    expect(mockAppelsEffectif).toEqual(['eq-1', 'eq-1']);
  });
});
