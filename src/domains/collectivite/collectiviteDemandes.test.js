import {
  dateDeDecision,
  estDemandeHebdo,
  etatDeLaPlace,
  lieuAvecPreposition,
  MOTIFS_DE_REFUS,
  occupantsParHoraire,
  prevenusDe,
} from './collectiviteDemandes';

// 🏛️ COLL-C3B (02/10) — les règles pures des demandes en phrases (planches P6v2, P6-fenetre).

// Une traduction de test : le texte de repli, interpolé (comme le catalogue français).
const t = (/** @type {string} */ _cle, /** @type {string} */ repli, /** @type {any} */ valeurs) => (
  repli.replace(/\{\{(\w+)\}\}/g, (_tout, nom) => String(valeurs?.[nom] ?? ''))
);
const SEANCE = { end: '2030-10-01T17:30:00.000Z', start: '2030-10-01T16:00:00.000Z' };

describe('COLL-C3B — collectiviteDemandes', () => {
  it('le lieu prend sa préposition (au / à la / à l’), par les traductions', () => {
    expect(lieuAvecPreposition('Gymnase des Tilleuls', t)).toBe('au Gymnase des Tilleuls');
    expect(lieuAvecPreposition('Salle Jean Moulin', t)).toBe('à la Salle Jean Moulin');
    expect(lieuAvecPreposition('Écurie Mistral', t)).toBe('à l’Écurie Mistral');
    expect(lieuAvecPreposition('', t)).toBe('');
  });

  it('la place : équipes déjà là, places qui restent, ce que l’acceptation mettrait', () => {
    expect(etatDeLaPlace({ maxSlots: 2, occupants: [{ club: 'A' }, { club: 'B' }], remaining: 0 }))
      .toEqual({
        apres: 3, capacite: 2, complet: true, depasse: true, equipes: 2, restantes: 0,
      });
    expect(etatDeLaPlace({ maxSlots: 2, occupants: [], remaining: 2 }))
      .toEqual({
        apres: 1, capacite: 2, complet: false, depasse: false, equipes: 0, restantes: 2,
      });
    expect(etatDeLaPlace(null)).toBeNull();
  });

  it('qui est déjà là, regroupé par horaire, jamais deux fois le même « club · équipe »', () => {
    const groupes = occupantsParHoraire({
      occupants: [
        { ...SEANCE, club: 'AS Montrivage', team: 'U15' },
        { ...SEANCE, club: 'Montrivage FC', team: 'Senior B' },
        { ...SEANCE, club: 'Montrivage FC', team: 'Senior B' },
      ],
    });
    expect(groupes).toHaveLength(1);
    expect(groupes[0].noms).toEqual(['AS Montrivage · U15', 'Montrivage FC · Senior B']);
  });

  it('seront prévenus : l’encadrant qui demande, son club, et les clubs déjà là', () => {
    expect(prevenusDe({
      club: { name: 'AS Montrivage' },
      conflict: { occupants: [{ club: 'Montrivage FC', team: 'Senior B' }] },
      requestedBy: { firstname: 'Karim', lastname: 'Benali' },
    })).toEqual({
      club: 'AS Montrivage', clubsDejaLa: ['Montrivage FC · Senior B'], personne: 'Karim Benali',
    });
  });

  it('une série se reconnaît à sa série (serveur) ou à sa récurrence ; 3 motifs de refus', () => {
    expect(estDemandeHebdo({ series: { until: '2031-06-30' } })).toBe(true);
    expect(estDemandeHebdo({ event: { isRecurring: true } })).toBe(true);
    expect(estDemandeHebdo({ event: { isRecurring: false }, series: null })).toBe(false);
    expect(MOTIFS_DE_REFUS).toEqual(['complet', 'fermeture', 'manifestation']);
    expect(dateDeDecision({ updatedAt: 'pas une date' })).toBe('');
  });
});
