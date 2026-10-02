/* eslint-disable max-len -- les phrases se lisent en entier. */
import {
  corrigerLaFeuille,
  direSaReponse,
  estUneLigneVide,
  joindreLesNoms,
  repriseDeSaReponse,
} from '../feuilleDeMatchModel';

// ==========================================================================
// 📐 ST-MATCH10 — L'ALERTE UNIQUE et ses voisins, sans écran.
// Les règles sont celles du serveur (`assertMatchStatsConsistency`) : une feuille
// qu'il refuse doit être nommée AVANT l'envoi, joueur par joueur.
// ==========================================================================

// La doublure de `t` : elle remplit les {{…}} et sait les pluriels (0 et 1 au singulier).
const remplir = (/** @type {string} */ modele, /** @type {any} */ valeurs) => modele.replace(
  /\{\{(\w+)\}\}/g,
  (/** @type {string} */ tout, /** @type {string} */ nom) => (valeurs && nom in valeurs ? String(valeurs[nom]) : tout),
);
const t = (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ options) => {
  if (typeof repli === 'string') return remplir(repli, options);
  if (repli && repli.defaultValue_one) return remplir(Number(repli.count) <= 1 ? repli.defaultValue_one : repli.defaultValue_other, repli);
  return cle;
};

const ligne = (/** @type {string} */ label, /** @type {any} */ chiffres = {}) => ({
  assists: '0', goals: '0', goalsConceded: '0', key: label, label, minutesPlayed: '90', ...chiffres,
});

describe('corrigerLaFeuille — football', () => {
  test('une feuille juste ne demande rien', () => {
    expect(corrigerLaFeuille({
      lignes: [ligne('Hugo Lemaire', { assists: '1', goals: '2' })], scoreAdverse: '1', scorePour: '2', sport: 'football', t,
    })).toEqual([]);
  });

  test('trop de buts : la phrase nomme les buteurs, et seulement eux', () => {
    const [correction] = corrigerLaFeuille({
      lignes: [ligne('Léo Diallo', { goals: '2' }), ligne('Enzo Petit', { goals: '1' }), ligne('Nino Garcia')],
      scoreAdverse: '0',
      scorePour: '2',
      sport: 'football',
      t,
    });
    expect(correction.texte).toBe('3 buts saisis pour un score de 2. Vérifie Léo Diallo et Enzo Petit.');
    expect(correction.lignes).toEqual(['Léo Diallo', 'Enzo Petit']);
  });

  test('plus de passes que de buts, et des buts encaissés au-delà du score adverse', () => {
    const corrections = corrigerLaFeuille({
      lignes: [ligne('Hugo Roux', { assists: '2', goals: '1' }), ligne('Karim Gardien', { goalsConceded: '3' })],
      scoreAdverse: '1',
      scorePour: '3',
      sport: 'football',
      t,
    });
    expect(corrections.map((c) => c.texte)).toEqual([
      'Plus de passes décisives (2) que de buts (1). Vérifie Hugo Roux.',
      'Plus de buts encaissés que le score adverse (1). Vérifie Karim Gardien.',
    ]);
  });

  test('clean sheet : impossible si l adversaire a marqué, et jamais avec un but encaissé', () => {
    const corrections = corrigerLaFeuille({
      lignes: [ligne('Karim Gardien', { cleanSheet: true, goalsConceded: '1' })],
      scoreAdverse: '1',
      scorePour: '0',
      sport: 'football',
      t,
    });
    expect(corrections.map((c) => c.cle)).toEqual(['cleanSheetScore', 'cleanSheetConceded']);
    expect(corrections[0].texte).toBe('Clean sheet impossible : l’adversaire a marqué. Vérifie Karim Gardien.');
  });

  test('score inconnu : on ne compare rien au score', () => {
    expect(corrigerLaFeuille({
      lignes: [ligne('Hugo Lemaire', { goals: '5' })], scoreAdverse: '', scorePour: '', sport: 'football', t,
    })).toEqual([]);
  });
});

describe('corrigerLaFeuille — basket', () => {
  test('trop de points, et des paniers à 3 points au-delà des points du joueur', () => {
    const corrections = corrigerLaFeuille({
      lignes: [
        ligne('Inès Moreau', { points: '40', threePointsMade: '2' }),
        ligne('Sarah Petit', { points: '3', threePointsMade: '2' }),
      ],
      scoreAdverse: '30',
      scorePour: '40',
      sport: 'basketball',
      t,
    });
    expect(corrections.map((c) => c.texte)).toEqual([
      '43 points saisis pour un score de 40. Vérifie Inès Moreau et Sarah Petit.',
      'Plus de points à 3 pts que de points marqués. Vérifie Sarah Petit.',
    ]);
  });
});

describe('les noms, les lignes, les réponses', () => {
  test('joindreLesNoms : un, deux, trois, puis « et N autres »', () => {
    expect(joindreLesNoms(['Hugo'], t)).toBe('Hugo');
    expect(joindreLesNoms(['Hugo', 'Léo'], t)).toBe('Hugo et Léo');
    expect(joindreLesNoms(['Hugo', 'Léo', 'Enzo'], t)).toBe('Hugo, Léo et Enzo');
    expect(joindreLesNoms(['Hugo', 'Léo', 'Enzo', 'Nino', 'Théo'], t)).toBe('Hugo, Léo et 3 autres');
  });

  test('estUneLigneVide : le brouillon d avant la réponse (défaut 19)', () => {
    expect(estUneLigneVide({ minutesPlayed: 0, sportPayload: { cleanSheet: false, goals: 0 } })).toBe(true);
    expect(estUneLigneVide({ minutesPlayed: 0, sportPayload: { goals: 1 } })).toBe(false);
    expect(estUneLigneVide({ minutesPlayed: 45, sportPayload: {} })).toBe(false);
  });

  test('repriseDeSaReponse : vrai tant que la ligne garde ses chiffres, faux dès qu on les change', () => {
    const reponse = { minutesPlayed: 90, sportPayload: { assists: 0, goals: 1 } };
    const cles = ['goals', 'assists'];
    expect(repriseDeSaReponse({
      assists: '0', goals: '1', minutesPlayed: '90', responseFigures: reponse,
    }, cles)).toBe(true);
    expect(repriseDeSaReponse({
      assists: '0', goals: '2', minutesPlayed: '90', responseFigures: reponse,
    }, cles)).toBe(false);
    expect(repriseDeSaReponse({
      assists: '0', goals: '1', minutesPlayed: '90', responseFigures: null,
    }, cles)).toBe(false);
  });

  test('direSaReponse : la participation, puis « avec un mot »', () => {
    expect(direSaReponse({ participation: 'played', quantitativeState: 'completed', selfComment: 'Bien' }, t)).toBe('A joué · avec un mot');
    expect(direSaReponse({ participation: 'played', quantitativeState: 'unknown' }, t)).toBe('A joué, sans ses chiffres');
    expect(direSaReponse({ participation: 'present_no_play' }, t)).toBe('Présent sans jouer');
    expect(direSaReponse({ participation: 'not_involved', selfComment: '  ' }, t)).toBe('Pas concerné');
  });
});
