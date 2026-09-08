import {
  avancement, essaisDuTest, etapeCourante, etapesDuJour,
} from '@/views/training/trainingEtapes';

/**
 * LES ÉTAPES D UNE SÉANCE — le calcul qui répond a « je fais quoi maintenant ? ».
 *
 * 🔎 POURQUOI IL SE TESTE SEUL. C est un calcul pur, et c est celui dont une erreur
 * coute le plus cher : il decide ce que le bouton principal propose de faire. S il
 * se trompe d une etape, la personne refait un essai deja valide — et ecrase une
 * mesure prise dans de bonnes conditions par une mesure prise fatiguee.
 */

const TEST_A = {
  code: 'B1',
  measures: [
    { attempts: 3, key: 'haut', moment: 'terrain' },
    // 🪤 Une mesure a UN seul essai a cote d une mesure a trois : le nombre
    // d essais du test est le MAXIMUM, jamais la somme ni la premiere.
    { attempts: 1, key: 'masse', moment: 'terrain' },
  ],
  name: 'Squat Jump',
};

const TEST_B = {
  code: 'B2',
  measures: [{ attempts: 2, key: 'temps', moment: 'terrain' }],
  name: 'CMJ',
};

const JOURNEE = { code: 'B', tests: [TEST_A, TEST_B] };

/**
 * Une ligne de resultat.
 * @param {string} code le code du test
 * @param {number} essai le numero de l essai
 * @param {string} clef la mesure
 * @returns {Record<string, any>} la ligne
 */
const ligne = (code, essai, clef) => ({ attempt: essai, measureKey: clef, test: { code } });

describe('combien d essais un test demande', () => {
  it('prend le MAXIMUM de ses mesures, pas leur somme', () => {
    expect(essaisDuTest(TEST_A)).toBe(3);
  });

  it('se rabat sur un seul essai quand rien ne le dit', () => {
    expect(essaisDuTest({ measures: [{ key: 'x' }] })).toBe(1);
    expect(essaisDuTest({})).toBe(1);
  });
});

describe('la liste des etapes', () => {
  it('pose une MISE EN PLACE par test, puis un essai par essai', () => {
    const etapes = etapesDuJour(JOURNEE, []);

    expect(etapes.map((e) => e.cle)).toEqual([
      'B1-prep', 'B1-e1', 'B1-e2', 'B1-e3',
      'B2-prep', 'B2-e1', 'B2-e2',
    ]);
  });

  it('🪤 compte la MISE EN PLACE comme une etape entiere', () => {
    // Elle prend cinq minutes et ne produit aucune mesure : un compteur base sur
    // les seules mesures la rendrait invisible, et la barre resterait a zero
    // pendant qu on travaille.
    const etapes = etapesDuJour(JOURNEE, []);

    expect(etapes.filter((e) => e.type === 'prep')).toHaveLength(2);
    expect(avancement(etapes).total).toBe(7);
  });

  it('marque « se calcule tout seul » un test dont rien ne se prend sur le terrain', () => {
    const etapes = etapesDuJour(
      { tests: [{ code: 'X', measures: [{ attempts: 1, key: 'a', moment: 'differe' }] }] },
      [],
    );

    expect(etapes.every((e) => e.calculSeul)).toBe(true);
  });
});

describe('ce qui est FAIT, et ce qui ne l est pas', () => {
  it('un essai est fait quand TOUTES ses mesures sont saisies, pas une seule', () => {
    // L essai 1 attend deux mesures (haut + masse) ; l essai 2 n en attend qu une.
    const etapes = etapesDuJour(JOURNEE, [ligne('B1', 1, 'haut')]);
    const parCle = Object.fromEntries(etapes.map((e) => [e.cle, e.etat]));

    expect(parCle['B1-e1']).toBe('current');
  });

  it('et il l est des que le compte y est', () => {
    const etapes = etapesDuJour(JOURNEE, [ligne('B1', 1, 'haut'), ligne('B1', 1, 'masse')]);
    const parCle = Object.fromEntries(etapes.map((e) => [e.cle, e.etat]));

    expect(parCle['B1-e1']).toBe('done');
    expect(parCle['B1-e2']).toBe('current');
  });

  it('la mise en place se DEDUIT : un test entame est un test installe', () => {
    // Elle ne produit aucune mesure : personne ne peut la cocher, et lui demander
    // une confirmation ajouterait un geste a chaque test.
    const etapes = etapesDuJour(JOURNEE, [ligne('B1', 2, 'haut')]);
    const parCle = Object.fromEntries(etapes.map((e) => [e.cle, e.etat]));

    expect(parCle['B1-prep']).toBe('done');
  });
});

describe('l etape EN COURS', () => {
  it('est la premiere PAS FAITE, jamais la derniere faite', () => {
    // 🪤 On revient souvent corriger un essai rate au milieu d une serie. Marquer
    // « en cours » d apres la derniere ligne saisie renverrait en arriere, et le
    // bouton « Continuer » proposerait de refaire un essai deja valide — ce qui
    // ecraserait une mesure prise dans de bonnes conditions.
    const etapes = etapesDuJour(JOURNEE, [
      ligne('B1', 1, 'haut'), ligne('B1', 1, 'masse'),
      ligne('B1', 3, 'haut'),
    ]);

    expect(etapeCourante(etapes).cle).toBe('B1-e2');
  });

  it('n existe plus quand tout est fait', () => {
    const etapes = etapesDuJour(
      { tests: [{ code: 'X', measures: [{ attempts: 1, key: 'a' }] }] },
      [ligne('X', 1, 'a')],
    );

    expect(etapeCourante(etapes)).toBeNull();
  });

  it('est la premiere de la liste quand rien n a commence', () => {
    expect(etapeCourante(etapesDuJour(JOURNEE, [])).cle).toBe('B1-prep');
  });
});

describe('l avancement', () => {
  it('compte les ETAPES, et separement les tests entierement finis', () => {
    const etapes = etapesDuJour(JOURNEE, [
      ligne('B1', 1, 'haut'), ligne('B1', 1, 'masse'),
      ligne('B1', 2, 'haut'),
      ligne('B1', 3, 'haut'),
    ]);
    const bilan = avancement(etapes);

    // 4 etapes de B1 faites (prep + 3 essais), 0 de B2.
    expect(bilan.faites).toBe(4);
    expect(bilan.total).toBe(7);
    expect(bilan.testsFaits).toBe(1);
    expect(bilan.ratio).toBeCloseTo(4 / 7);
  });

  it('rend zero partout sur une journee vide, sans diviser par zero', () => {
    expect(avancement([])).toEqual({
      faites: 0, ratio: 0, testsFaits: 0, total: 0,
    });
  });
});

describe('ce qui ne doit rien faire tomber', () => {
  it('traverse une journee absente', () => {
    expect(etapesDuJour(undefined, undefined)).toEqual([]);
    expect(etapeCourante(undefined)).toBeNull();
  });

  it('ignore une ligne sans test : elle ne sait pas ou elle va', () => {
    const etapes = etapesDuJour(JOURNEE, [{ attempt: 1, measureKey: 'haut' }]);

    expect(etapeCourante(etapes).cle).toBe('B1-prep');
  });
});
