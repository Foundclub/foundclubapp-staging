import {
  ARRETS, arretsDuTest, dureeEchauffement, etatsDuRuban, gesteEnTroisLignes,
  lignesDeMiseEnPlace, mesuresQuiAttendentLaVideo, situer,
} from '@/views/training/trainingParcours';

/**
 * LA FILE D ARRETS D UN TEST — et pourquoi elle se teste a part.
 *
 * 🔎 C est elle qui decide ce que le bouton unique propose a chaque ecran. Une erreur
 * d un cran, et on saute une recuperation : la mesure suivante est prise sur un corps
 * qui n a pas recupere, elle entre au carnet comme les autres, et plus rien ne dit
 * qu elle est fausse.
 */

const TEST = {
  code: 'B1',
  measures: [
    { attempts: 3, key: 'haut', moment: 'terrain' },
    { attempts: 1, key: 'masse', moment: 'terrain' },
    { attempts: 3, key: 'images', moment: 'differe' },
  ],
  name: 'Squat Jump',
  setup: [
    { text: 'Un paragraphe qui ne se coche pas', type: 'p' },
    { items: ['Poser la box a 40 cm', 'Ruban a 5 m', 'Camera en 240 i/s'], type: 'ul' },
  ],
};

describe('la file d arrets', () => {
  it('alterne essai et recuperation, entre la prepa et la fin', () => {
    expect(arretsDuTest(TEST).map((a) => a.cle)).toEqual([
      'prep', 'warmup',
      'attempt-1', 'recovery-1',
      'attempt-2', 'recovery-2',
      'attempt-3',
      'end',
    ]);
  });

  it('⛔ ne pose PAS de recuperation apres le dernier essai', () => {
    // Elle n a rien a annoncer, et elle retarderait la validation d un ecran
    // pour rien.
    const file = arretsDuTest(TEST);
    const dernier = file[file.length - 2];

    expect(dernier.type).toBe(ARRETS.ATTEMPT);
    expect(dernier.essai).toBe(3);
  });

  it('tient debout sur un test sans mesures : un essai, et c est tout', () => {
    expect(arretsDuTest({}).map((a) => a.type)).toEqual([
      ARRETS.PREP, ARRETS.WARMUP, ARRETS.ATTEMPT, ARRETS.END,
    ]);
  });
});

describe('se situer dans la file', () => {
  it('rend l arret courant ET celui qui suit', () => {
    const file = arretsDuTest(TEST);
    const { courant, suivant } = situer(file, 'attempt-2');

    expect(courant.cle).toBe('attempt-2');
    expect(suivant.cle).toBe('recovery-2');
  });

  it('se rabat sur le premier arret quand la clef est inconnue', () => {
    expect(situer(arretsDuTest(TEST), 'nimporte-quoi').courant.cle).toBe('prep');
  });

  it('n a pas de suivant au dernier arret', () => {
    expect(situer(arretsDuTest(TEST), 'end').suivant).toBeNull();
  });
});

describe('le ruban', () => {
  it('🪤 marque FAIT ce qu on a DEPASSE, pas ce qui a produit une donnee', () => {
    // La mise en place et l echauffement ne produisent rien : les mesurer a la
    // donnee les laisserait gris pour toujours, et le ruban dirait qu on n a
    // rien fait alors qu on vient d installer le materiel pendant cinq minutes.
    expect(etatsDuRuban(arretsDuTest(TEST), 'attempt-1'))
      .toEqual(['done', 'done', 'current', 'todo', 'todo', 'todo', 'todo', 'todo']);
  });

  it('n a qu UN seul arret en cours', () => {
    const etats = etatsDuRuban(arretsDuTest(TEST), 'recovery-2');

    expect(etats.filter((e) => e === 'current')).toHaveLength(1);
  });
});

describe('les lignes de mise en place', () => {
  it('prend les LISTES, pas les paragraphes', () => {
    // Un paragraphe se lit ; une liste se coche. Cocher un paragraphe de six
    // lignes ne dit rien de ce qui est installe.
    expect(lignesDeMiseEnPlace(TEST)).toEqual([
      'Poser la box a 40 cm', 'Ruban a 5 m', 'Camera en 240 i/s',
    ]);
  });

  it('rend une liste vide quand le test n a pas de mise en place', () => {
    expect(lignesDeMiseEnPlace({})).toEqual([]);
    expect(lignesDeMiseEnPlace(undefined)).toEqual([]);
  });
});

describe('le geste, en trois lignes', () => {
  it('⛔ n en garde JAMAIS plus de trois', () => {
    // Entre deux essais on relit une consigne en dix secondes, debout, en
    // soufflant. Le protocole complet fait souvent quinze lignes : le montrer la
    // revient a ne rien montrer, parce qu on ne le lit pas.
    const bavard = {
      protocol: [{ items: ['a', 'b', 'c', 'd', 'e'], type: 'ol' }],
    };

    expect(gesteEnTroisLignes(bavard)).toEqual(['a', 'b', 'c']);
  });

  it('ignore les paragraphes : seules les listes sont des consignes', () => {
    const melange = {
      protocol: [
        { text: 'Un long paragraphe de contexte', type: 'p' },
        { items: ['Se placer', 'Sauter'], type: 'ul' },
      ],
    };

    expect(gesteEnTroisLignes(melange)).toEqual(['Se placer', 'Sauter']);
  });

  it('rend une liste vide quand le test n a pas de protocole en liste', () => {
    expect(gesteEnTroisLignes({})).toEqual([]);
  });
});

describe('la duree de l echauffement', () => {
  const DEROULE = {
    timeline: [{
      head: ['Heure', 'Bloc', 'Durée', 'Récupération'],
      rows: [
        ['T − 25', 'Installation', '25 min', '—'],
        ['**T + 0**', '**RAMP** (échauffement en 4 phases)', '18 min', '120 s'],
      ],
      type: 'table',
    }],
  };

  it('🪤 la lit dans le TABLEAU DU DEROULE : elle n a pas de champ a elle', () => {
    // On la lit la ou elle est plutot que de demander une colonne de plus au
    // serveur — et le jour ou le programme change son echauffement, le chiffre
    // suit tout seul.
    expect(dureeEchauffement(DEROULE)).toBe(18);
  });

  it('cherche la colonne par son NOM, jamais par son rang', () => {
    // Les journees n ont pas toutes le meme nombre de colonnes : un rang en dur
    // casserait au premier tableau court.
    const court = {
      timeline: [{
        head: ['Bloc', 'Durée'],
        rows: [['RAMP', '12 min']],
        type: 'table',
      }],
    };

    // ⚠️ Ici le libelle est en PREMIERE colonne, pas en deuxieme : le calcul lit
    // toujours la colonne 1 pour le libelle, donc il ne trouve rien — et il rend
    // `null` plutot qu un chiffre pris au hasard.
    expect(dureeEchauffement(court)).toBeNull();
  });

  it('rend null quand le deroule ne dit rien', () => {
    expect(dureeEchauffement({})).toBeNull();
    expect(dureeEchauffement(undefined)).toBeNull();
  });
});

describe('ce qui attend la video', () => {
  it('compte les mesures differees ESSAI PAR ESSAI, pas une fois chacune', () => {
    // Une mesure a trois essais qui se lit sur la video, c est TROIS valeurs a
    // relever le soir, pas une. Annoncer « 1 mesure » ferait fermer l ecran
    // apres la premiere.
    expect(mesuresQuiAttendentLaVideo(TEST)).toBe(3);
  });

  it('rend zero quand tout se prend sur le terrain', () => {
    expect(mesuresQuiAttendentLaVideo({
      measures: [{ attempts: 2, key: 'a', moment: 'terrain' }],
    })).toBe(0);
  });
});
