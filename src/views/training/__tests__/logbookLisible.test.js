import { rangerLeCarnet } from '@/views/training/logbookLisible';

/**
 * LE RECOLLAGE DU CARNET — le calcul qui rend les mesures relisibles.
 *
 * 🔎 POURQUOI IL SE TESTE SEUL, SANS MONTER D ECRAN : c est la seule partie de la
 * vue lisible qui puisse se tromper EN SILENCE. Le carnet brut ne contient que
 * des codes — « T2 », « images_chute » — et les noms vivent dans le PROGRAMME.
 * Si le recollage rate, l ecran affiche des codes au lieu de noms : ca se voit.
 * Mais s il recolle la MAUVAISE mesure, il affiche un joli nom sur la mauvaise
 * valeur, et plus rien ne le dit.
 */

const PROGRAMME = [
  {
    code: 'T',
    tests: [
      {
        code: 'T0',
        measures: [
          { key: 'hauteur', label: 'Hauteur de chute', unit: 'm' },
          {
            computed: true, key: 'mediane', label: 'Médiane des 3 chutes', unit: 'images',
          },
        ],
        name: 'Calibrations caméra',
      },
      {
        code: 'T1',
        measures: [{ key: 'temps', label: 'Temps sur 10 m', unit: 's' }],
        name: 'Sprint 10 mètres',
      },
    ],
  },
];

/**
 * Une ligne de carnet, telle que le serveur la rend.
 * @param {Record<string, any>} champs ce qui change d une ligne a l autre
 * @returns {Record<string, any>} la ligne complete
 */
const ligne = (champs) => ({
  attempt: 1,
  isValid: true,
  measureKey: 'temps',
  side: 'none',
  test: { code: 'T1' },
  value: 1.72,
  ...champs,
});

describe('les noms viennent du PROGRAMME, jamais du carnet', () => {
  it('remplace le code du test par son vrai nom', () => {
    const range = rangerLeCarnet(
      [{ day: { code: 'T', title: 'Jour T' }, plannedDate: '2026-09-06', results: [ligne({})] }],
      PROGRAMME,
    );

    expect(range[0].tests[0].name).toBe('Sprint 10 mètres');
    expect(range[0].tests[0].lignes[0].label).toBe('Temps sur 10 m');
  });

  it('🪤 se rabat sur le CODE quand le programme ne connait pas le test', () => {
    // Un programme peut changer sous un carnet deja ecrit. Mieux vaut afficher
    // « X9 » que rien du tout : la mesure existe, elle a ete prise.
    const range = rangerLeCarnet(
      [{ day: {}, results: [ligne({ measureKey: 'inconnue', test: { code: 'X9' } })] }],
      PROGRAMME,
    );

    expect(range[0].tests[0].name).toBe('X9');
    expect(range[0].tests[0].lignes[0].label).toBe('inconnue');
  });

  it('🚨 ignore une ligne SANS test : elle n a nulle part ou aller', () => {
    // C est le cas qui existait vraiment en production : le serveur rendait les
    // resultats sans leur relation `test`. Corrige cote serveur le 08/09, mais le
    // recollage doit rester debout si ca se reproduit.
    const range = rangerLeCarnet(
      [{ day: { code: 'T' }, results: [ligne({ test: undefined })] }],
      PROGRAMME,
    );

    expect(range).toEqual([]);
  });
});

describe('la pastille « calculé »', () => {
  it('se lit sur la MESURE du programme, pas sur la ligne du carnet', () => {
    // Aucune des onze colonnes du carnet ne dit qu une valeur a ete calculee.
    const range = rangerLeCarnet(
      [{
        day: { code: 'T' },
        results: [
          ligne({ measureKey: 'mediane', test: { code: 'T0' }, value: 14 }),
          ligne({ measureKey: 'hauteur', test: { code: 'T0' }, value: 0.4 }),
        ],
      }],
      PROGRAMME,
    );
    const [mediane, hauteur] = range[0].tests[0].lignes;

    expect(mediane.calculee).toBe(true);
    expect(hauteur.calculee).toBe(false);
  });
});

describe('les essais se relisent DANS L ORDRE', () => {
  it('remet le 1, 2, 3 en ordre meme quand la saisie a saute', () => {
    // On revient souvent corriger un essai rate : la ligne repartait alors en bas
    // de la liste, et on relisait 1, 3, 2.
    const range = rangerLeCarnet(
      [{
        day: { code: 'T' },
        results: [ligne({ attempt: 1 }), ligne({ attempt: 3 }), ligne({ attempt: 2 })],
      }],
      PROGRAMME,
    );

    expect(range[0].tests[0].lignes.map((l) => l.essai)).toEqual([1, 2, 3]);
  });

  it('garde l ordre des TESTS tel qu il a ete saisi, lui', () => {
    const range = rangerLeCarnet(
      [{
        day: { code: 'T' },
        results: [
          ligne({ measureKey: 'hauteur', test: { code: 'T0' } }),
          ligne({ test: { code: 'T1' } }),
        ],
      }],
      PROGRAMME,
    );

    expect(range[0].tests.map((t) => t.code)).toEqual(['T0', 'T1']);
  });
});

describe('ce qui distingue une ligne nulle et un cote', () => {
  it('marque nulle une ligne dont l essai a ete declare invalide', () => {
    const range = rangerLeCarnet(
      [{
        day: { code: 'T' },
        results: [ligne({ invalidReason: 'faux depart', isValid: false })],
      }],
      PROGRAMME,
    );

    expect(range[0].tests[0].lignes[0]).toMatchObject({ motif: 'faux depart', nulle: true });
  });

  it('🧑‍⚖️ garde QUI a juge : le terrain, ou la video', () => {
    // Sans ce mot, le carnet garde le verdict mais pas son auteur — et sur 22 des
    // 33 tests du programme, un essai porte a la fois un critere visible sur place
    // et un critere qui ne se lit que sur la video.
    const range = rangerLeCarnet(
      [{
        day: { code: 'T' },
        results: [ligne({ invalidatedBy: 'video', isValid: false })],
      }],
      PROGRAMME,
    );

    expect(range[0].tests[0].lignes[0]).toMatchObject({ jugePar: 'video', nulle: true });
  });

  it('ne garde QUE les deux juges connus : le champ vient du serveur', () => {
    const juge = (valeur) => rangerLeCarnet(
      [{ day: { code: 'T' }, results: [ligne({ invalidatedBy: valeur, isValid: false })] }],
      PROGRAMME,
    )[0].tests[0].lignes[0].jugePar;

    expect(juge('terrain')).toBe('terrain');
    expect(juge('video')).toBe('video');
    expect(juge('n importe quoi')).toBeNull();
    expect(juge(undefined)).toBeNull();
  });

  it('n ecrit un cote QUE quand il y en a un : « none » n est pas un cote', () => {
    const range = rangerLeCarnet(
      [{
        day: { code: 'T' },
        results: [ligne({}), ligne({ attempt: 2, side: 'left' })],
      }],
      PROGRAMME,
    );

    expect(range[0].tests[0].lignes[0].cote).toBeNull();
    expect(range[0].tests[0].lignes[1].cote).toBe('left');
  });

  it('prend la valeur TEXTE quand il n y a pas de nombre', () => {
    const range = rangerLeCarnet(
      [{ day: { code: 'T' }, results: [ligne({ textValue: 'oui', value: null })] }],
      PROGRAMME,
    );

    expect(range[0].tests[0].lignes[0].valeur).toBe('oui');
  });
});

describe('ce qui ne doit rien faire tomber', () => {
  it('rend une liste vide sur des entrees absentes', () => {
    expect(rangerLeCarnet(undefined, undefined)).toEqual([]);
    expect(rangerLeCarnet([], [])).toEqual([]);
  });

  it('ecarte les seances SANS aucune mesure : elles n ont rien a relire', () => {
    const range = rangerLeCarnet(
      [
        { day: { code: 'A' }, results: [] },
        { day: { code: 'T' }, results: [ligne({})] },
      ],
      PROGRAMME,
    );

    expect(range).toHaveLength(1);
    expect(range[0].code).toBe('T');
  });

  it('donne a chaque ligne une clef UNIQUE, meme quand tout se ressemble', () => {
    // Deux mesures peuvent porter le meme libelle, le meme essai et le meme cote
    // — un essai ressaisi — et React les fusionnerait a l affichage.
    const range = rangerLeCarnet(
      [{ day: { code: 'T' }, results: [ligne({}), ligne({})] }],
      PROGRAMME,
    );
    const clefs = range[0].tests[0].lignes.map((l) => l.cle);

    expect(new Set(clefs).size).toBe(2);
  });
});
