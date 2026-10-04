import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { getCollectiviteChiffres } from '@/services/collectivite/collectiviteService';
import { getFacilityPlanning } from '@/services/facility/facilityService';

import { useInstallationsWeekSummary } from '../seasonSlotQueries';

// 🧮 FINITIONS13-COLL (04/10/2026), point 4 — « MÊME MOT, MÊME NOMBRE », la fin du travail.
// Tournée T13 (C2_9b) : la liste « Installations de la Ville » disait « Cette semaine :
// 14 séances » (Gymnase) et « 1 séance » (Dojo) quand l'accueil et « Chiffres » disaient
// 10 et 0. La liste comptait les BLOCS du planning, créneaux compris ; FINITIONS12-COLL
// point 9 avait déjà branché l'accueil sur « Chiffres » (`seances` de la ligne de
// l'installation, admin docs/CONTRAT_CHIFFRES_VILLE.md §1 et §5). La liste lit la même
// règle, partagée. Le « complet jeu. 18:00 – 19:30 » garde le planning (c'est un moment,
// pas un compte). ROUGE avant le lot.

jest.mock('@/services/seasonSlot/seasonSlotService', () => ({
  attributeSeasonSlot: jest.fn(),
  getClubTeamsForSlot: jest.fn(),
  getSeasonSlot: jest.fn(),
  listFacilitySeasonSlots: jest.fn(),
  modifySeasonSlot: jest.fn(),
  previewFacilitySeasonSlot: jest.fn(),
  restoreSeasonSlot: jest.fn(),
  withdrawSeasonSlot: jest.fn(),
}));
jest.mock('@/services/facility/facilityService', () => ({
  getClubCollectiviteFacilities: jest.fn(),
  getFacilityPlanning: jest.fn(),
}));
jest.mock('@/services/collectivite/collectiviteService', () => ({
  getCollectiviteChiffres: jest.fn(),
}));

// Un bloc du planning de la semaine : une séance, ou un créneau de saison (`kind: 'slot'`).
const bloc = (/** @type {string} */ debut, /** @type {string} */ fin, kind = 'event') => ({
  endTime: `${fin}:00.000`,
  hasExplicitTime: true,
  kind,
  startAt: `2026-10-01T${debut}:00.000+02:00`,
  startTime: `${debut}:00.000`,
});
// Le Gymnase de la T13 : 10 séances et 4 créneaux sans séance posée = 14 blocs ; 4 créneaux à
// 14:00 pour 2 places (le premier moment complet). Le Dojo : un créneau seul, aucune séance.
const PLANNINGS = {
  dojo: [bloc('10:00', '11:00', 'slot')],
  gym: [
    bloc('18:00', '19:30'), bloc('18:00', '19:30'),
    ...Array.from({ length: 8 }, (_, i) => {
      const h = String(8 + i).padStart(2, '0');
      return bloc(`${h}:00`, `${h}:45`);
    }),
    ...Array.from({ length: 4 }, () => bloc('14:00', '17:00', 'slot')),
  ],
};
const INSTALLATIONS = [{ documentId: 'gym', maxSlots: 2 }, { documentId: 'dojo', maxSlots: 2 }];

/** @type {any[]} */
const montes = [];
const lire = async () => {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0, retry: false } } });
  /** @type {any} */
  let resume = null;
  /**
   * Le crochet, tel que la liste l'appelle.
   * @returns {import('react').ReactElement} Rien de visible.
   */
  function Sonde() {
    resume = useInstallationsWeekSummary(INSTALLATIONS, 'ville-montrivage');
    return createElement(Text, null, 'sonde');
  }
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(createElement(QueryClientProvider, { client }, createElement(Sonde)));
  });
  for (let tour = 0; tour < 5; tour += 1) {
    // eslint-disable-next-line no-await-in-loop -- les tours sont sequentiels par nature
    await act(async () => {
      await new Promise((resoudre) => { setTimeout(resoudre, 0); });
    });
  }
  montes.push({ arbre, client });
  return resume;
};

beforeEach(() => {
  jest.clearAllMocks();
  /** @type {jest.Mock} */ (getFacilityPlanning).mockImplementation((/** @type {string} */ id) => (
    Promise.resolve({ data: PLANNINGS[/** @type {'gym' | 'dojo'} */ (id)] })
  ));
  /** @type {jest.Mock} */ (getCollectiviteChiffres).mockResolvedValue({
    data: {
      installations: [
        { documentId: 'gym', seances: 10, taux: 0.08 },
        { documentId: 'dojo', seances: 0, taux: 0 },
      ],
    },
  });
});

afterEach(() => {
  act(() => {
    montes.splice(0).forEach(({ arbre, client }) => {
      arbre.unmount();
      client.clear();
    });
  });
});

describe('FINITIONS13-COLL point 4 — la liste compte comme « Chiffres » et l’accueil', () => {
  it('Gymnase : 10 séances (pas 14 blocs) ; Dojo : 0 (pas 1 créneau)', async () => {
    const resume = await lire();
    expect(resume.gym.count).toBe(10);
    expect(resume.dojo.count).toBe(0);
    expect(getCollectiviteChiffres).toHaveBeenCalledWith('ville-montrivage', 'semaine');
  });

  it('le moment complet reste lu dans le planning', async () => {
    const resume = await lire();
    expect(resume.gym.full).toEqual({
      end: new Date('2026-10-01T15:00:00.000Z'),
      start: new Date('2026-10-01T12:00:00.000Z'),
    });
    expect(resume.dojo.full).toBeNull();
  });

  it('tant que « Chiffres » n’a pas répondu, la liste n’écrit pas un nombre faux', async () => {
    /** @type {jest.Mock} */ (getCollectiviteChiffres).mockReturnValue(new Promise(() => {}));
    const resume = await lire();
    expect(resume.gym).toBeUndefined();
    expect(resume.dojo).toBeUndefined();
  });
});
