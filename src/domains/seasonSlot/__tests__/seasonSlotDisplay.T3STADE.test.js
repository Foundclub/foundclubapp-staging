import { occupantsParHoraire } from '@/domains/collectivite/collectiviteDemandes';

import { occupantWho, slotWho } from '../seasonSlotDisplay';

// T3-STADE (03/11/2026, Adel) — « Complet : AS Foot y est déjà (Terrain de foot) ».
describe('T3-STADE — le nom de la partie', () => {
  const asFoot = { club: { name: 'AS Foot' }, team: { name: 'U15' } };

  it('l aperçu : la partie entre parenthèses, rien sans partie', () => {
    expect(occupantWho({ ...asFoot, part: 'Terrain de foot' }))
      .toBe('AS Foot · U15 (Terrain de foot)');
    expect(occupantWho(asFoot)).toBe(slotWho(asFoot));
    expect(occupantWho({ part: 'Piste' })).toBe('');
    expect(occupantWho(null)).toBe('');
  });

  it('la demande côté Ville : la partie suit le nom, deux parties restent deux lignes', () => {
    const horaire = { end: '2026-11-03T19:00:00.000Z', start: '2026-11-03T17:00:00.000Z' };
    const groupes = occupantsParHoraire({
      occupants: [
        { ...horaire, club: 'AS Foot', part: 'Terrain de foot' },
        { ...horaire, club: 'AS Foot', part: 'Piste' },
        { ...horaire, club: 'Club sans partie' },
      ],
    });
    expect(groupes).toHaveLength(1);
    expect(groupes[0].noms)
      .toEqual(['AS Foot (Terrain de foot)', 'AS Foot (Piste)', 'Club sans partie']);
  });
});
