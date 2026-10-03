import {
  avecMarqueUtf8,
  dureeLisible,
  largeurBarre,
  largeurJauge,
  nomDuFichierExporte,
  phraseDelai,
  phraseSeancesDesClubs,
  tauxLisible,
  tauxTenues,
} from './collectiviteChiffres';

// COLL-C5 (03/10) — les chiffres de la Ville EN MOTS (admin/docs/CONTRAT_CHIFFRES_VILLE.md).
// Un `t` minimal : les replis du code, au singulier pour 0 et 1 comme en français.
const t = (/** @type {string} */ _cle, /** @type {any} */ repli, /** @type {any} */ autres) => {
  const options = typeof repli === 'object' && repli ? repli : (autres || {});
  let texte = typeof repli === 'string' ? repli : '';
  if (typeof options.count === 'number') {
    texte = options[`defaultValue_${options.count <= 1 ? 'one' : 'other'}`];
  }
  return texte.replace(/\{\{(\w+)\}\}/g, (_tout, nom) => String(options?.[nom] ?? ''));
};

describe('COLL-C5 — les chiffres en mots', () => {
  it('une durée : « 14 h », « 1 h 30 », « 45 min », « 0 h » ; « — » si illisible', () => {
    expect([840, 90, 45, 0, 630.4].map(dureeLisible))
      .toEqual(['14 h', '1 h 30', '45 min', '0 h', '10 h 30']);
    expect(dureeLisible(null)).toBe('—');
  });

  it('une barre, en % de la plus grande ; la jauge plafonnée à 100 ; le taux ou « — »', () => {
    expect(largeurBarre(300, 390)).toBe(77);
    expect(largeurBarre(0, 390)).toBe(0);
    expect(largeurBarre(10, 0)).toBe(0);
    expect([largeurJauge(6), largeurJauge(130), largeurJauge(null)]).toEqual([6, 100, 0]);
    expect([tauxLisible(6), tauxLisible(null)]).toEqual(['6 %', '—']);
  });

  it('« % séances tenues » : tenues / (tenues + annulées + fermeture) ; null sinon', () => {
    expect(tauxTenues({ annulees: 1, fermeture: 1, tenues: 2 })).toBe(50);
    expect(tauxTenues({ annulees: 0, fermeture: 1, tenues: 4 })).toBe(80);
    expect(tauxTenues({
      annulees: 0, aVenir: 3, fermeture: 0, tenues: 0,
    })).toBeNull();
  });

  it('les séances des clubs : « toutes au Gymnase », ou sur plusieurs installations', () => {
    expect(phraseSeancesDesClubs(t, {
      installations: [
        { name: 'Gymnase des Tilleuls', seances: 9 },
        { name: 'Dojo municipal', seances: 0 },
      ],
    })).toBe('9 séances, toutes au Gymnase des Tilleuls.');
    expect(phraseSeancesDesClubs(t, { installations: [{ name: 'Salle Jean Moulin', seances: 1 }] }))
      .toBe('1 séance, à la Salle Jean Moulin.');
    expect(phraseSeancesDesClubs(t, { installations: [{ seances: 0 }] }))
      .toBe('Aucune séance sur la période.');
  });

  it('le délai : « 1,3 jour », « 2 jours », « — »', () => {
    expect(phraseDelai(t, 1.3)).toBe('Délai moyen de réponse : 1,3 jour.');
    expect(phraseDelai(t, 2)).toBe('Délai moyen de réponse : 2 jours.');
    expect(phraseDelai(t, null)).toBe('Délai moyen de réponse : —');
  });

  it('le fichier exporté : le nom du serveur, sans accent ; la marque UTF-8 une seule fois', () => {
    expect(nomDuFichierExporte('Ville de Montrivage', 'semaine', '2026-09-28'))
      .toBe('chiffres-ville-de-montrivage-semaine-2026-09-28.csv');
    expect(nomDuFichierExporte('Saint-Étienne', 'saison', null))
      .toBe('chiffres-saint-etienne-saison.csv');
    expect(avecMarqueUtf8('a;b')).toBe('\uFEFFa;b');
    expect(avecMarqueUtf8('\uFEFFa;b')).toBe('\uFEFFa;b');
  });
});
