import { payloadsDeLaDemande } from '../collectiviteDemandesEnvoi';

// T3-STADE (03/11/2026, Adel, fiche 11 B) — la demande de toute l'installation part sur une date ;
// une série ne la porte pas.
const DEMANDE = {
  clubId: 'club',
  debut: '18:00',
  facilityId: 'salle',
  fin: '20:00',
  teamId: 'u13',
  touteInstallation: true,
  type: 'type',
  typeName: 'Entraînement',
};

describe('T3-STADE — demander toute l installation', () => {
  it('une date : la case part au serveur ; décochée, rien', () => {
    expect(payloadsDeLaDemande({ ...DEMANDE, dates: ['2026-11-03'] })[0].wholeFacility).toBe(true);
    expect(payloadsDeLaDemande({
      ...DEMANDE, dates: ['2026-11-03'], touteInstallation: false,
    })[0].wholeFacility).toBeUndefined();
  });

  it('une série : rien, le serveur ne juge pas la demande date par date', () => {
    const corps = payloadsDeLaDemande({ ...DEMANDE, dates: ['2026-11-03', '2026-11-10'], groupe: 'g' });
    expect(corps.map((un) => un.wholeFacility)).toEqual([undefined, undefined]);
  });
});
