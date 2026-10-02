// Le VRAI i18next, en français : la ligne lit ses textes par i18next.t.
import '@/theme/strings';

import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

import { mapFacilityOverrideRequestToHubItem } from './requestMappers';

// ─────────────────────────────────────────────────────────────────────────────
// 🏛️ COLL-C3B (02/10) — LA DEMANDE D'INSTALLATION, DANS « DEMANDES » D'UN CLUB PROPRIÉTAIRE.
//
// Planche P6v2 (note « À construire », constaté dans le code) : la ligne disait « U13 demande
// une place supplementaire sur Gymnase des Tilleuls (2/2 slots deja pris). » — le mot
// « slots », le « 2/2 » et les accents manquants. Elle dit désormais la MÊME phrase que la
// mairie : qui, quand, où, pour qui, puis la place.
// ─────────────────────────────────────────────────────────────────────────────

const DEMANDE = {
  club: { documentId: 'club-a', name: 'AS Montrivage' },
  documentId: 'rq-1',
  event: { documentId: 'ev-1', name: '', type: { name: 'Entraînement' } },
  facility: { documentId: 'gym', name: 'Gymnase des Tilleuls' },
  maxSlots: 2,
  overlapCount: 2,
  requestedBy: { documentId: 'u-karim', firstname: 'Karim', lastname: 'Benali' },
  requestedEnd: '2030-10-03T17:30:00.000Z',
  requestedStart: '2030-10-03T16:00:00.000Z',
  team: { documentId: 'u13', name: 'U13' },
};
const heure = (/** @type {string} */ iso) => format(new Date(iso), 'HH:mm');

describe('COLL-C3B — la demande d’installation se lit en une phrase (requestMappers)', () => {
  // eslint-disable-next-line max-len
  it('pleine : « AS Montrivage demande le jeudi 3 oct., de … à …, au Gymnase des Tilleuls, pour ses U13. Il y a déjà 2 équipes : c’est complet. »', () => {
    const ligne = mapFacilityOverrideRequestToHubItem(DEMANDE);
    const jour = format(new Date(DEMANDE.requestedStart), 'EEEE d MMM', { locale: fr });
    expect(ligne.subtitle).toBe(
      // eslint-disable-next-line max-len
      `AS Montrivage demande le ${jour}, de ${heure(DEMANDE.requestedStart)} à ${heure(DEMANDE.requestedEnd)}, `
      + 'au Gymnase des Tilleuls, pour ses U13. Il y a déjà 2 équipes : c’est complet.',
    );
    expect(ligne.subtitle).not.toMatch(/slots|2\/2/);
  });

  it('une place encore libre : « … Il reste 1 place. »', () => {
    const ligne = mapFacilityOverrideRequestToHubItem({ ...DEMANDE, overlapCount: 1 });
    expect(ligne.subtitle.endsWith('Il reste 1 place.')).toBe(true);
  });
});
