import {
  creneauxDuJour,
  decoupagePlage,
  prixDeLaSemaine,
  prixDuCreneau,
  resumeOuverture,
  resumePlage,
} from '@/domains/complexe/complexeTerrain';

// COMPLEXE-TERRAINS (10/11/2026) — les plages et les tarifs après minuit (défauts 4 et 5),
// décisions du chef « nuit 1A 2A 3A 4A » : une fin avant l'ouverture finit le lendemain ; le
// créneau d'après minuit appartient au jour civil où il commence ; son prix vient du tarif de la
// veille qui passe minuit, sinon du jour, puis du prix de base. Les mêmes règles que le serveur
// (admin `slot-plan.ts`, témoin `COMPLEXETERRAINS-plages-de-nuit.test.js`).

/**
 * Une traduction de témoin : le texte par défaut, ses variables remplies.
 * @param {string} _cle - La clé.
 * @param {string} texte - Le texte par défaut.
 * @param {any} [valeurs] - Les variables.
 * @returns {string} Le texte.
 */
const t = (_cle, texte, valeurs = {}) => (
  texte.replace(/{{(\w+)}}/g, (_tout, nom) => String(valeurs[nom]))
);

const NUIT_DU_SAMEDI = {
  days: [6], durationMinutes: 60, from: '17:00', to: '01:00',
};

describe('COMPLEXE-TERRAINS — une plage qui passe minuit', () => {
  it('17:00 → 01:00 : 8 créneaux, le dernier à 0 h', () => {
    const decoupe = decoupagePlage(NUIT_DU_SAMEDI);
    expect(decoupe.nombre).toBe(8);
    expect(decoupe.debuts[decoupe.debuts.length - 1]).toBe('00:00');
    expect(decoupe.reste).toBeNull();
    expect(resumePlage(t, NUIT_DU_SAMEDI)).toBe('17 h – 1 h · créneaux de 1 h · 8 créneaux');
  });

  it('17:00 → 00:35 en 1 h : 7 créneaux, « De 0 h à 0 h 35, il reste 35 min »', () => {
    const decoupe = decoupagePlage({ ...NUIT_DU_SAMEDI, to: '00:35' });
    expect(decoupe.nombre).toBe(7);
    expect(decoupe.reste).toEqual({ from: '00:00', minutes: 35, to: '00:35' });
  });

  it('la frise de l’accueil : samedi jusqu’à 24 h, dimanche le créneau de 0 h', () => {
    const plan = { period: { from: '2026-11-10', until: null }, ranges: [NUIT_DU_SAMEDI] };
    expect(creneauxDuJour(plan, '2026-11-14').map((c) => c.from)).toEqual([
      '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00',
    ]);
    expect(creneauxDuJour(plan, '2026-11-15')).toEqual([{ from: '00:00', to: '01:00' }]);
    expect(creneauxDuJour({ ...plan, period: { from: '2026-11-15', until: null } }, '2026-11-15'))
      .toEqual([]);
  });

  it('« Ouvert : sam 17 h – 1 h »', () => {
    expect(resumeOuverture(t, { ranges: [NUIT_DU_SAMEDI] })).toBe('Ouvert : sam 17 h – 1 h');
  });
});

describe('COMPLEXE-TERRAINS — le prix de nuit', () => {
  const plan = {
    ranges: [NUIT_DU_SAMEDI],
    rates: [{
      days: [6], from: '20:00', price: 16, to: '01:00',
    }],
  };

  it('le créneau de 0 h du dimanche prend le tarif du samedi qui passe minuit', () => {
    expect(prixDuCreneau(plan, 12, 7, 0)).toBe(16);
    expect(prixDuCreneau(plan, 12, 6, 24 * 60)).toBe(16);
    expect(prixDuCreneau(plan, 12, 7, 60)).toBe(12);
    expect(prixDuCreneau(plan, 12, 6, 17 * 60)).toBe(12);
  });

  it('« Les prix de la semaine » : la tranche d’après minuit reste sur la ligne du samedi', () => {
    expect(prixDeLaSemaine(plan, 12)).toEqual([
      { a: '20:00', de: '17:00', prix: [null, null, null, null, null, 12, null] },
      { a: '01:00', de: '20:00', prix: [null, null, null, null, null, 16, null] },
    ]);
  });

  it('un tarif 17:00 → 00:00 (capture 7) couvre la soirée jusqu’à minuit', () => {
    const jusquaMinuit = {
      ranges: [{ ...NUIT_DU_SAMEDI, to: '24:00' }],
      rates: [{
        days: [6], from: '17:00', price: 16, to: '24:00',
      }],
    };
    expect(prixDeLaSemaine(jusquaMinuit, 12)).toEqual([
      { a: '24:00', de: '17:00', prix: [null, null, null, null, null, 16, null] },
    ]);
  });
});
