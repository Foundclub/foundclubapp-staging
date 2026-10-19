/* eslint-disable max-len -- donnees de test : les fixtures se lisent mieux sur une ligne */
// 🚩 R17-SIGNALER-1 (19/10/2026, REC17-011) — la PASTILLE de l onglet « Sécurité et suivi »
// (planche P10-securite-ordi A, validee le 19/10) se lit dans le cache, SANS lecture de plus
// (consigne du chef d orchestre du 19/10). Ce que le temoin fixe :
//   - la liste de l onglet en cache : le nombre de ses signalements OUVERTS ;
//   - sinon le resume de la Ville (lu par la liste des installations) : l `openCount` de la ligne ;
//   - rien en cache : null ;
//   - et dans TOUS les cas, ZERO appel au service — meme apres une invalidation des signalements.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { useCachedFacilityOpenReportsCount } from '../facilityReportQueries';

jest.mock('../facilityReportService', () => ({
  closeFacilityFromReport: jest.fn(),
  getCollectiviteFacilityReportsSummary: jest.fn(() => Promise.resolve({ data: [] })),
  getFacilityReport: jest.fn(),
  getMyFacilityReports: jest.fn(),
  getOpenFacilityReports: jest.fn(),
  listFacilityReports: jest.fn(() => Promise.resolve({ data: [] })),
  setFacilityReportStatus: jest.fn(),
  submitFacilityReport: jest.fn(),
}));

const service = jest.requireMock('../facilityReportService');

/**
 * Le compte, rendu en texte.
 * @param {{ collectiviteId: string, facilityId: string | null }} props
 * @returns {import('react').ReactElement} Le compte.
 */
function Sonde({ collectiviteId, facilityId }) {
  const compte = useCachedFacilityOpenReportsCount(facilityId, collectiviteId);
  return <Text>{compte === null ? 'rien' : String(compte)}</Text>;
}

const monter = async (/** @type {QueryClient} */ client, facilityId = 'gym-tilleuls') => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>
        <Sonde collectiviteId="ville-montrivage" facilityId={facilityId} />
      </QueryClientProvider>,
    );
  });
  return arbre;
};
const lu = (/** @type {any} */ arbre) => arbre.root.findByType(Text).props.children;
const nouveauClient = () => new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } });

beforeEach(() => {
  jest.clearAllMocks();
});

describe('R17SS1 — la pastille de l onglet, lue dans le cache', () => {
  it('la liste de l onglet en cache : ses signalements OUVERTS (ni résolu ni sans suite)', async () => {
    const client = nouveauClient();
    client.setQueryData(['facility-reports', 'facility', 'gym-tilleuls'], {
      data: [{ status: 'envoye' }, { status: 'pris_en_charge' }, { status: 'resolu' }, { status: 'sans_suite' }],
    });
    expect(lu(await monter(client))).toBe('2');
    expect(service.listFacilityReports).not.toHaveBeenCalled();
    expect(service.getCollectiviteFacilityReportsSummary).not.toHaveBeenCalled();
  });

  it('sinon le résumé de la Ville (lu par la liste des installations) : l openCount de la ligne', async () => {
    const client = nouveauClient();
    client.setQueryData(['facility-reports', 'collectivite', 'ville-montrivage'], {
      data: [
        { facilityDocumentId: 'dojo', openCount: 5 },
        { facilityDocumentId: 'gym-tilleuls', openCount: 3 },
      ],
    });
    expect(lu(await monter(client))).toBe('3');
    // Une installation absente du résumé n a aucun signalement ouvert.
    expect(lu(await monter(client, 'piscine'))).toBe('0');
    expect(service.listFacilityReports).not.toHaveBeenCalled();
    expect(service.getCollectiviteFacilityReportsSummary).not.toHaveBeenCalled();
  });

  it('rien en cache : pas de pastille, et AUCUNE lecture — même après une invalidation', async () => {
    const client = nouveauClient();
    const arbre = await monter(client);
    expect(lu(arbre)).toBe('rien');
    await act(async () => {
      await client.invalidateQueries({ queryKey: ['facility-reports'] });
    });
    expect(service.listFacilityReports).not.toHaveBeenCalled();
    expect(service.getCollectiviteFacilityReportsSummary).not.toHaveBeenCalled();
  });

  it('le cache change (un geste relu ailleurs) : la pastille suit, toujours sans lecture', async () => {
    const client = nouveauClient();
    client.setQueryData(['facility-reports', 'collectivite', 'ville-montrivage'], {
      data: [{ facilityDocumentId: 'gym-tilleuls', openCount: 2 }],
    });
    const arbre = await monter(client);
    expect(lu(arbre)).toBe('2');
    await act(async () => {
      client.setQueryData(['facility-reports', 'facility', 'gym-tilleuls'], { data: [{ status: 'envoye' }] });
      // react-query prévient ses observateurs au tour suivant de la boucle.
      await new Promise((resolve) => { setTimeout(resolve, 0); });
    });
    expect(lu(arbre)).toBe('1');
    expect(service.listFacilityReports).not.toHaveBeenCalled();
  });

  it('pas d installation (un compte qui ne gère pas) : rien', async () => {
    expect(lu(await monter(nouveauClient(), null))).toBe('rien');
  });
});
