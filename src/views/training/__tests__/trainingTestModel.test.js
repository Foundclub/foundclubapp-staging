import {
  aSaisirPlusTard, ceQueCeTestAlimente, mesuresParFamille,
} from '@/views/training/trainingTestModel';

/**
 * CE QU ON DEDUIT D UN TEST — et pourquoi une erreur ici ne se verrait pas.
 *
 * 🔎 Ranger une mesure dans la mauvaise famille la fait DISPARAITRE de l ecran :
 * elle part dans une rubrique repliee, ou dans la section des valeurs calculees,
 * et personne ne s apercoit qu il manque une case tant qu on ne compare pas au
 * protocole papier. Aucune porte ne mesure ca. Ce filet, si.
 */

const TEST = {
  code: 'B1',
  measures: [
    // Se repete : elle appartient a la carte d essai.
    {
      attempts: 3, key: 'haut', label: 'Hauteur', moment: 'terrain',
    },
    // Ne se repete pas : « a noter une fois ».
    { key: 'masse', label: 'Masse', moment: 'terrain' },
    // Se calcule : « resultat de la serie ».
    {
      computed: true, formula: 'moyenne de haut', key: 'moy', label: 'Moyenne', moment: 'differe',
    },
  ],
  name: 'Squat Jump',
};

describe('les trois familles de mesures', () => {
  it('met dans la carte d essai ce qui SE REPETE', () => {
    expect(mesuresParFamille(TEST).parEssai.map((m) => m.key)).toEqual(['haut']);
  });

  it('met a part ce qui ne se note QU UNE FOIS', () => {
    expect(mesuresParFamille(TEST).uneFois.map((m) => m.key)).toEqual(['masse']);
  });

  it('met a part ce qui se CALCULE', () => {
    expect(mesuresParFamille(TEST).calculees.map((m) => m.key)).toEqual(['moy']);
  });

  it('🪤 c est la REPETITION qui decide, pas le moment', () => {
    // On a d abord separe sur `moment`, et le test T0 du vrai programme s est
    // retrouve avec ZERO carte d essai : ses trois chutes se lisent sur un
    // logiciel, donc en differe — alors que ce sont exactement elles qu on
    // repete trois fois. Une mesure qui se repete appartient a la carte
    // d essai, qu on la remplisse sur le terrain ou le soir.
    const differeRepetee = {
      measures: [{ attempts: 3, key: 'images', moment: 'differe' }],
    };

    expect(mesuresParFamille(differeRepetee).parEssai.map((m) => m.key)).toEqual(['images']);
  });

  it('rend trois listes vides sur un test sans mesures', () => {
    expect(mesuresParFamille({})).toEqual({ calculees: [], parEssai: [], uneFois: [] });
    expect(mesuresParFamille(undefined)).toEqual({ calculees: [], parEssai: [], uneFois: [] });
  });
});

describe('la marque « a saisir plus tard »', () => {
  it('suit le champ `moment` du serveur, deja rempli sur tout le programme', () => {
    expect(aSaisirPlusTard({ moment: 'differe' })).toBe(true);
    expect(aSaisirPlusTard({ moment: 'terrain' })).toBe(false);
  });

  it('traite une mesure SANS moment comme differee : mieux vaut prevenir', () => {
    expect(aSaisirPlusTard({})).toBe(true);
  });
});

describe('ce que ce test alimente', () => {
  const T0 = { code: 'T0', measures: [{ key: 'temps_10m' }, { key: 'masse' }] };
  const T1 = {
    code: 'T1',
    measures: [{
      computed: true,
      formula: 'moyenne de temps_10m sur les 3 essais valides',
      key: 'v_moy',
      label: 'Vitesse moyenne',
    }],
  };
  const T2 = {
    code: 'T2',
    measures: [{
      computed: true, formula: 'rien a voir', key: 'x', label: 'X',
    }],
  };

  it('trouve les mesures d AUTRES tests qui citent ses clefs', () => {
    expect(ceQueCeTestAlimente(T0, [T0, T1, T2]))
      .toEqual([{ measure: 'Vitesse moyenne', test: 'T1' }]);
  });

  it('🪤 exige le mot ENTIER : `temps` ne s attrape pas dans `temps_10m`', () => {
    // Sans les bornes, une clef courte s attraperait dans toutes les longues, et
    // la liste annoncerait des liens qui n existent pas.
    const court = { code: 'X', measures: [{ key: 'temps' }] };

    expect(ceQueCeTestAlimente(court, [court, T1])).toEqual([]);
  });

  it('ne se cite jamais LUI-MEME', () => {
    const seul = {
      code: 'S',
      measures: [{ key: 'a' }, {
        computed: true, formula: 'deux fois a', key: 'b', label: 'B',
      }],
    };

    expect(ceQueCeTestAlimente(seul, [seul])).toEqual([]);
  });

  it('rend une liste vide quand le test n a aucune clef', () => {
    expect(ceQueCeTestAlimente({ code: 'Z' }, [T1])).toEqual([]);
    expect(ceQueCeTestAlimente(undefined, undefined)).toEqual([]);
  });
});
