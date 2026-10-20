import {
  creneauxDuJour,
  decoupagePlage,
  formatEuros,
  heureDe,
  initialesDuComplexe,
  joursTexte,
  libelleLieu,
  libelleMode,
  libelleSport,
  lignesDePrix,
  ligneTerrain,
  minutesDe,
  prixDeLaSemaine,
  prixDuCreneau,
  resumeOuverture,
  resumePlage,
  resumeTarif,
  sportsPopulaires,
  texteDuree,
  texteHeure,
} from './complexeTerrain';

// RESA-L5A1 (13/10/2026) — P00 : les règles PURES des écrans du gérant (prix, modes, plages).
// Planches P00 (carte d'un terrain), RA3 (sport et prix), RA4 (plages et tarifs), E-G07.

/**
 * Un `t` de témoin : il rend le libellé par défaut, interpolé.
 * @param {string} _cle - La clé (ignorée).
 * @param {string} defaut - Le libellé par défaut.
 * @param {Record<string, any>} [valeurs] - Les valeurs.
 * @returns {string} Le libellé.
 */
const t = (_cle, defaut, valeurs = {}) => String(defaut).replace(
  /{{(\w+)}}/g,
  (_tout, nom) => String(valeurs[nom]),
);

const NBSP = ' ';

describe('RESA-L5A1 P00 — les montants', () => {
  it('écrit les euros à la française, sans centimes inutiles', () => {
    expect(formatEuros(60)).toBe(`60${NBSP}€`);
    expect(formatEuros(6.5)).toBe(`6,50${NBSP}€`);
    expect(formatEuros(5.55)).toBe(`5,55${NBSP}€`);
    expect(formatEuros(null)).toBe('');
    expect(formatEuros('abc')).toBe('');
  });

  it('prix au créneau : « 60 € le créneau », « soit 6 € par joueur à 10 » (RA3)', () => {
    expect(lignesDePrix(t, { basePrice: 60, capacity: 10, priceUnit: 'creneau' })).toEqual({
      principal: `60${NBSP}€ le créneau`,
      secondaire: `soit 6${NBSP}€ par joueur à 10`,
    });
  });

  it('prix par joueur : « 6 € par joueur », « 24 € pour 4 joueurs » (RA3)', () => {
    expect(lignesDePrix(t, { basePrice: 6, capacity: 4, priceUnit: 'joueur' })).toEqual({
      principal: `6${NBSP}€ par joueur`,
      secondaire: `24${NBSP}€ pour 4 joueurs`,
    });
  });

  it('pas de prix : rien n’est inventé', () => {
    expect(lignesDePrix(t, { basePrice: null, capacity: 10, priceUnit: 'creneau' })).toBeNull();
    expect(lignesDePrix(t, { basePrice: undefined, capacity: 10, priceUnit: 'joueur' })).toBeNull();
  });

  it('sans nombre de joueurs, pas de seconde ligne', () => {
    expect(lignesDePrix(t, { basePrice: 60, capacity: null, priceUnit: 'creneau' })).toEqual({
      principal: `60${NBSP}€ le créneau`,
      secondaire: null,
    });
  });

  it('le prix par joueur s’arrondit au centime, comme le serveur', () => {
    expect(lignesDePrix(t, { basePrice: 70, capacity: 3, priceUnit: 'creneau' })?.secondaire)
      .toBe(`soit 23,33${NBSP}€ par joueur à 3`);
  });
});

describe('RESA-L5A1 P00 — le terrain, en mots', () => {
  it('les trois modes, côté gérant (P00 bloc 5)', () => {
    expect(libelleMode(t, 'automatique')).toBe('Automatique');
    expect(libelleMode(t, 'manuel')).toBe('Validation manuelle');
    expect(libelleMode(t, 'telephone')).toBe('Téléphone seulement');
    expect(libelleMode(t, 'autre')).toBe('');
  });

  it('intérieur et extérieur', () => {
    expect(libelleLieu(t, 'interieur')).toBe('Intérieur');
    expect(libelleLieu(t, 'exterieur')).toBe('Extérieur');
    expect(libelleLieu(t, null)).toBe('');
  });

  it('« Football à 5 » de l’app s’écrit « Foot à 5 » (plan §1.1)', () => {
    expect(libelleSport({ name: 'Football à 5' })).toBe('Foot à 5');
    expect(libelleSport({ name: 'Padel' })).toBe('Padel');
    expect(libelleSport(null)).toBe('');
  });

  it('la ligne de la carte : « Foot à 5 · Extérieur · 10 joueurs » (E-G07)', () => {
    expect(ligneTerrain(t, {
      capacity: 10, setting: 'exterieur', sport: { name: 'Football à 5' },
    })).toBe('Foot à 5 · Extérieur · 10 joueurs');
    expect(ligneTerrain(t, { capacity: 1, setting: null, sport: { name: 'Squash' } }))
      .toBe('Squash · 1 joueur');
  });

  it('les trois sports en tête, retrouvés dans la liste de l’app par leur nom (RA3)', () => {
    const activites = [
      { documentId: 'a-tennis', name: 'Tennis' },
      { documentId: 'a-foot', name: 'Football' },
      { documentId: 'a-five', name: 'Football à 5' },
      { documentId: 'a-padel', name: 'padel' },
    ];
    expect(sportsPopulaires(activites)).toEqual([
      { capacite: 10, documentId: 'a-five', label: 'Foot à 5' },
      { capacite: 4, documentId: 'a-padel', label: 'Padel' },
      { capacite: 4, documentId: 'a-tennis', label: 'Tennis' },
    ]);
    // Un sport absent de la liste ne s'invente pas.
    expect(sportsPopulaires([{ documentId: 'a-padel', name: 'Padel' }])).toEqual([
      { capacite: 4, documentId: 'a-padel', label: 'Padel' },
    ]);
    expect(sportsPopulaires(undefined)).toEqual([]);
  });
});

describe('RESA-L5A1 P00 — le logo sans image', () => {
  it('les initiales des deux premiers mots : « LF » (planche P00 bloc 1)', () => {
    expect(initialesDuComplexe('Le Five de Montrivage')).toBe('LF');
    expect(initialesDuComplexe('padel')).toBe('P');
    expect(initialesDuComplexe('  ')).toBe('?');
    expect(initialesDuComplexe("L'Arène")).toBe('LA');
  });
});

describe('RESA-L5A1 P00 — les heures et les durées (RA4)', () => {
  it('« 17:00 » ⇔ 1020 minutes, « 24:00 » = minuit', () => {
    expect(minutesDe('17:00')).toBe(1020);
    expect(minutesDe('24:00')).toBe(1440);
    expect(minutesDe('17:00:00.000')).toBe(1020);
    expect(minutesDe('rien')).toBeNull();
    expect(heureDe(1095)).toBe('18:15');
    expect(heureDe(1440)).toBe('24:00');
  });

  it('« 17 h », « 18 h 15 », « 1 h 15 », « 45 min »', () => {
    expect(texteHeure('17:00')).toBe('17 h');
    expect(texteHeure('18:15')).toBe('18 h 15');
    expect(texteHeure('09:05')).toBe('9 h 05');
    expect(texteDuree(60)).toBe('1 h');
    expect(texteDuree(75)).toBe('1 h 15');
    expect(texteDuree(45)).toBe('45 min');
  });

  it('les jours : « Lun. au ven. », « Sam. · dim. » (comme le serveur)', () => {
    expect(joursTexte([1, 2, 3, 4, 5])).toBe('Lun. au ven.');
    expect(joursTexte([6, 7])).toBe('Sam. · dim.');
    expect(joursTexte([1, 2, 4, 5])).toBe('Lun. · mar. · jeu. · ven.');
    expect(joursTexte([])).toBe('');
  });
});

describe('RESA-L5A1 P00 — une plage découpée en créneaux (RA4 état 2)', () => {
  it('17 h – 23 h en créneaux de 1 h 15 : 4 créneaux, il reste 1 h', () => {
    expect(decoupagePlage({ durationMinutes: 75, from: '17:00', to: '23:00' })).toEqual({
      debuts: ['17:00', '18:15', '19:30', '20:45'],
      nombre: 4,
      reste: { from: '22:00', minutes: 60, to: '23:00' },
    });
  });

  it('une plage qui tombe juste ne laisse rien', () => {
    expect(decoupagePlage({ durationMinutes: 60, from: '17:00', to: '23:00' })).toEqual({
      debuts: ['17:00', '18:00', '19:00', '20:00', '21:00', '22:00'],
      nombre: 6,
      reste: null,
    });
  });

  it('une plage impossible ne donne aucun créneau', () => {
    expect(decoupagePlage({ durationMinutes: 60, from: '23:00', to: '17:00' }).nombre).toBe(0);
    expect(decoupagePlage({ durationMinutes: 0, from: '17:00', to: '23:00' }).nombre).toBe(0);
  });

  it('le résumé d’une plage : « 17 h – 23 h · créneaux de 1 h · 6 créneaux »', () => {
    expect(resumePlage(t, {
      days: [1, 2], durationMinutes: 60, from: '17:00', to: '23:00',
    }))
      .toBe('17 h – 23 h · créneaux de 1 h · 6 créneaux');
    expect(resumePlage(t, {
      days: [3], durationMinutes: 90, from: '09:00', to: '10:30',
    }))
      .toBe('9 h – 10 h 30 · créneaux de 1 h 30 · 1 créneau');
  });

  it('le résumé d’un tarif : toute la journée, ou des heures', () => {
    expect(resumeTarif(t, { days: [6, 7], price: 70 })).toBe('toute la journée');
    expect(resumeTarif(t, {
      days: [1], from: '18:00', price: 80, to: '22:00',
    }))
      .toBe('de 18 h à 22 h');
  });
});

describe('RESA-L5A1 P00 — le prix d’un créneau et la semaine des prix (RA4)', () => {
  const plan = {
    extraSlots: [],
    period: { from: '2026-10-13', until: null },
    ranges: [
      {
        days: [1, 2, 4, 5], durationMinutes: 60, from: '17:00', to: '23:00',
      },
      {
        days: [6, 7], durationMinutes: 90, from: '09:00', to: '21:00',
      },
    ],
    rates: [
      { days: [6, 7], price: 70 },
      {
        days: [1, 2, 3, 4, 5], from: '18:00', price: 80, to: '22:00',
      },
    ],
  };

  it('le tarif le plus précis l’emporte : jour et heure, puis jour, puis base', () => {
    expect(prixDuCreneau(plan, 60, 1, 18 * 60)).toBe(80);
    expect(prixDuCreneau(plan, 60, 1, 17 * 60)).toBe(60);
    expect(prixDuCreneau(plan, 60, 6, 10 * 60)).toBe(70);
    expect(prixDuCreneau(plan, null, 1, 17 * 60)).toBeNull();
  });

  it('la grille de la semaine : une ligne par tranche d’heures, null quand c’est fermé', () => {
    expect(prixDeLaSemaine(plan, 60)).toEqual([
      { a: '17:00', de: '09:00', prix: [null, null, null, null, null, 70, 70] },
      { a: '18:00', de: '17:00', prix: [60, 60, null, 60, 60, 70, 70] },
      { a: '21:00', de: '18:00', prix: [80, 80, null, 80, 80, 70, 70] },
      { a: '22:00', de: '21:00', prix: [80, 80, null, 80, 80, null, null] },
      { a: '23:00', de: '22:00', prix: [60, 60, null, 60, 60, null, null] },
    ]);
  });

  it('sans plage, pas de grille', () => {
    expect(prixDeLaSemaine({ ranges: [], rates: [] }, 60)).toEqual([]);
    expect(prixDeLaSemaine(null, 60)).toEqual([]);
  });
});

describe('RESA-L5A1 P00 — les créneaux d’un jour (frise de l’accueil, E-G02)', () => {
  const plan = {
    extraSlots: [{ date: '2026-10-14', from: '07:00', to: '08:30' }],
    period: { from: '2026-10-13', until: '2026-12-31' },
    ranges: [{
      days: [3], durationMinutes: 60, from: '18:00', to: '20:30',
    }],
    rates: [],
  };

  it('un mercredi de la période : la plage et le créneau ponctuel, dans l’ordre', () => {
    // 14/10/2026 est un mercredi.
    expect(creneauxDuJour(plan, '2026-10-14')).toEqual([
      { from: '07:00', to: '08:30' },
      { from: '18:00', to: '19:00' },
      { from: '19:00', to: '20:00' },
    ]);
  });

  it('hors période ou un autre jour : rien de la plage', () => {
    expect(creneauxDuJour(plan, '2027-01-06')).toEqual([]);
    expect(creneauxDuJour(plan, '2026-10-15')).toEqual([]);
    expect(creneauxDuJour(null, '2026-10-14')).toEqual([]);
  });
});

describe('RESA-L5A1 P00 — « Ouvert : … » sur la carte d’un terrain (E-G07)', () => {
  it('regroupe les jours qui ont les mêmes heures', () => {
    expect(resumeOuverture(t, {
      ranges: [
        {
          days: [1, 2, 3, 4, 5], durationMinutes: 60, from: '17:00', to: '23:00',
        },
        {
          days: [6, 7], durationMinutes: 90, from: '09:00', to: '22:00',
        },
      ],
    })).toBe('Ouvert : lun-ven 17 h – 23 h, sam-dim 9 h – 22 h');
  });

  it('deux plages un même jour : « et »', () => {
    expect(resumeOuverture(t, {
      ranges: [
        {
          days: [3], durationMinutes: 60, from: '09:00', to: '12:00',
        },
        {
          days: [3], durationMinutes: 60, from: '14:00', to: '23:00',
        },
      ],
    })).toBe('Ouvert : mer 9 h – 12 h et 14 h – 23 h');
  });

  it('des jours qui ne se suivent pas', () => {
    expect(resumeOuverture(t, {
      ranges: [{
        days: [1, 2, 4, 5], durationMinutes: 60, from: '17:00', to: '23:00',
      }],
    })).toBe('Ouvert : lun-mar, jeu-ven 17 h – 23 h');
  });

  it('aucune plage : null (la carte dit « Aucun créneau ouvert »)', () => {
    expect(resumeOuverture(t, { ranges: [] })).toBeNull();
    expect(resumeOuverture(t, null)).toBeNull();
  });
});
