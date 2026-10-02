/* eslint-disable max-len -- donnees de test : les fixtures se lisent mieux sur une ligne */
// COLL-C2C (02/10) — le chargeur des installations d un club joint, SUR DEMANDE, les creneaux de
// saison du club (GET /clubs/:id/season-slots) a chaque installation (`clubSeasonSlots`).
// ROUGE avant le lot : l option n existait pas, aucune installation ne portait de creneau.
const mockGet = jest.fn();

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { get: mockGet },
}));

const { getClubFacilityContext } = require('./facilityService');

const reponses = (/** @type {Record<string, any>} */ parChemin) => {
  mockGet.mockImplementation(async (/** @type {string} */ chemin) => {
    const cle = Object.keys(parChemin).find((debut) => chemin.startsWith(debut));
    if (!cle) throw new Error(`appel non prevu : ${chemin}`);
    const valeur = parChemin[cle];
    if (valeur instanceof Error) throw valeur;
    return { data: valeur };
  });
};

const GYM = { collectivite: { documentId: 'ville', name: 'Ville de Montrivage' }, documentId: 'gym', name: 'Gymnase' };
const DOJO = { collectivite: { documentId: 'ville', name: 'Ville de Montrivage' }, documentId: 'dojo', name: 'Dojo' };
const SALLE = { documentId: 'salle', name: 'Salle annexe' };
const CRENEAU = {
  documentId: 's1', facility: { documentId: 'gym', name: 'Gymnase' }, team: { name: 'U15' }, weekday: 2,
};

describe('COLL-C2C — getClubFacilityContext({ includeClubSlots })', () => {
  beforeEach(() => jest.clearAllMocks());

  test('joint les creneaux du club a SES installations, et dit s il dirige le club', async () => {
    reponses({
      '/clubs/club-1/collectivite-installations': { data: [GYM, DOJO] },
      '/clubs/club-1/season-slots': { data: [CRENEAU], meta: { canManage: true } },
      '/facilities?': { data: [SALLE] },
    });
    const contexte = await getClubFacilityContext('club-1', null, {
      includeClubSlots: true, includeCollectivite: true, resolveCmId: false,
    });
    const parId = Object.fromEntries(contexte.allFacilities.map((f) => [f.documentId, f]));
    expect(parId.gym.clubSeasonSlots).toEqual([CRENEAU]);
    expect(parId.dojo.clubSeasonSlots).toBeUndefined();
    expect(parId.salle.clubSeasonSlots).toBeUndefined();
    expect(contexte.canManageClubSlots).toBe(true);
    expect(mockGet).toHaveBeenCalledWith('/clubs/club-1/season-slots');
  });

  test('sans l option : aucune lecture de plus, la reponse d avant', async () => {
    reponses({
      '/clubs/club-1/collectivite-installations': { data: [GYM] },
      '/facilities?': { data: [SALLE] },
    });
    const contexte = await getClubFacilityContext('club-1', null, { includeCollectivite: true, resolveCmId: false });
    expect(mockGet.mock.calls.map(([chemin]) => chemin).some((c) => c.includes('season-slots'))).toBe(false);
    expect('canManageClubSlots' in contexte).toBe(false);
  });

  test('un refus (403) des creneaux n emporte pas les installations avec lui', async () => {
    const refus = Object.assign(new Error('interdit'), { status: 403 });
    reponses({
      '/clubs/club-1/collectivite-installations': { data: [GYM] },
      '/clubs/club-1/season-slots': refus,
      '/facilities?': { data: [SALLE] },
    });
    const contexte = await getClubFacilityContext('club-1', null, {
      includeClubSlots: true, includeCollectivite: true, resolveCmId: false,
    });
    expect(contexte.allFacilities.map((f) => f.documentId)).toEqual(['salle', 'gym']);
    expect(contexte.canManageClubSlots).toBe(false);
  });
});
