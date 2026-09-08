import {
  fileDesRelevés, nomDuFichier, outilDeLaMesure, totalARelever,
} from '@/views/training/trainingVideo';

/**
 * LA FILE DES RELEVES VIDEO — le calcul qui croise le programme et ce qui a ete fait.
 *
 * 🔎 POURQUOI IL SE TESTE SEUL : c est le seul endroit qui puisse OUBLIER une mesure.
 * S il en oublie une, elle n apparait dans aucune liste, personne ne la releve, et le
 * test se retrouve incomplet des mois plus tard — alors que la video existe et que le
 * terrain a bien ete fait. Rien a l ecran ne le dirait.
 *
 * 🪤 CORRECTION D UN VERDICT ANTERIEUR : aucun appel serveur ne manquait. Le champ
 * `moment` porte deja l information sur les 619 mesures, et « mon entrainement » rend
 * deja le programme ET les resultats. Il manquait ce calcul, rien d autre.
 */

const JOURNEE = {
  code: 'T',
  documentId: 'jour-t',
  tests: [
    {
      code: 'T0',
      measures: [
        { attempts: 2, key: 'haut', moment: 'terrain' },
        {
          attempts: 2,
          helper: 'a lire image par image dans Kinovea',
          key: 'images',
          moment: 'differe',
        },
      ],
      name: 'Calibrations',
    },
    {
      code: 'T1',
      measures: [{ attempts: 2, key: 'temps', moment: 'terrain' }],
      name: 'Sprint 10 m',
    },
  ],
  title: 'Jour T',
};

/**
 * Une ligne de resultat.
 * @param {string} code le code du test
 * @param {number} essai le numero d essai
 * @param {string} clef la mesure
 * @param {any} [valeur] la valeur, si elle est deja relevee
 * @returns {Record<string, any>} la ligne
 */
const ligne = (code, essai, clef, valeur) => ({
  attempt: essai, measureKey: clef, test: { code }, value: valeur ?? null,
});

describe('le logiciel a ouvrir', () => {
  it('se lit dans l AIDE de la mesure : c est la seule source', () => {
    expect(outilDeLaMesure({ helper: 'a lire dans Kinovea' })).toBe('Kinovea');
    expect(outilDeLaMesure({ helper: 'depuis My Jump Lab' })).toBe('My Jump Lab');
  });

  it('ne devine rien quand l aide ne nomme aucun logiciel', () => {
    expect(outilDeLaMesure({ helper: 'a mesurer au ruban' })).toBeNull();
    expect(outilDeLaMesure({})).toBeNull();
  });
});

describe('le nom du fichier video', () => {
  it('numerote sur deux chiffres : les fichiers se rangent alors dans l ordre', () => {
    // « essai10 » avant « essai2 » dans un dossier trie par nom : c est
    // exactement ce qu on veut eviter quand on cherche la bonne video.
    expect(nomDuFichier('T2', 5)).toBe('T2_essai05.mp4');
    expect(nomDuFichier('T2', 12)).toBe('T2_essai12.mp4');
  });
});

describe('ce qui reste a relever', () => {
  it('🪤 un test n apparait QUE si ses essais existent', () => {
    // Un test dont on n a fait aucun essai n a rien a relever : le faire figurer
    // ferait croire a un oubli, et on chercherait une video jamais filmee.
    const file = fileDesRelevés(
      [{
        day: { documentId: 'jour-t' },
        documentId: 's1',
        results: [ligne('T1', 1, 'temps', 1.7)],
      }],
      [JOURNEE],
    );

    // T1 n a que des mesures de terrain : rien a relever. T0 n a aucun essai.
    // La journee sort donc entierement de la file : elle est COMMENCEE et n a
    // rien qui attende, l afficher vide ferait chercher un travail inexistant.
    expect(file).toEqual([]);
  });

  it('compte une ligne PAR ESSAI FAIT, jamais par mesure', () => {
    const file = fileDesRelevés(
      [{
        day: { documentId: 'jour-t' },
        documentId: 's1',
        results: [ligne('T0', 1, 'haut', 0.4), ligne('T0', 2, 'haut', 0.42)],
      }],
      [JOURNEE],
    );

    expect(file[0].tests[0]).toMatchObject({
      code: 'T0', essais: 2, faites: 0, outil: 'Kinovea', restantes: 2, total: 2,
    });
  });

  it('retire de la file ce qui est DEJA releve', () => {
    const file = fileDesRelevés(
      [{
        day: { documentId: 'jour-t' },
        documentId: 's1',
        results: [
          ligne('T0', 1, 'haut', 0.4), ligne('T0', 2, 'haut', 0.42),
          ligne('T0', 1, 'images', 14),
        ],
      }],
      [JOURNEE],
    );

    expect(file[0].tests[0]).toMatchObject({ faites: 1, restantes: 1 });
    expect(file[0].tests[0].ratio).toBeCloseTo(0.5);
  });

  it('garde une journee PAS COMMENCEE, en la disant', () => {
    // 🪤 Sans ce cas, elle disparaissait de la liste et on croyait avoir tout
    // releve — alors qu on n avait simplement rien filme.
    const file = fileDesRelevés(
      [{ day: { documentId: 'jour-t' }, documentId: 's1', results: [] }],
      [JOURNEE],
    );

    expect(file).toHaveLength(1);
    expect(file[0].commencee).toBe(false);
  });

  it('additionne ce qui reste sur toutes les journees', () => {
    const file = fileDesRelevés(
      [
        {
          day: { documentId: 'jour-t' },
          documentId: 's1',
          results: [ligne('T0', 1, 'haut', 0.4), ligne('T0', 2, 'haut', 0.42)],
        },
        {
          day: { documentId: 'jour-t' },
          documentId: 's2',
          results: [ligne('T0', 1, 'haut', 0.4)],
        },
      ],
      [JOURNEE],
    );

    expect(totalARelever(file)).toBe(3);
  });

  it('ne compte pas un essai au-dela de ce que la mesure attend', () => {
    // Une mesure a deux essais n a rien a relever sur un troisieme, meme si le
    // terrain en a produit un.
    const file = fileDesRelevés(
      [{
        day: { documentId: 'jour-t' },
        documentId: 's1',
        results: [
          ligne('T0', 1, 'haut', 1), ligne('T0', 2, 'haut', 1), ligne('T0', 3, 'haut', 1),
        ],
      }],
      [JOURNEE],
    );

    expect(file[0].tests[0].total).toBe(2);
  });

  it('traverse des entrees absentes', () => {
    expect(fileDesRelevés(undefined, undefined)).toEqual([]);
    expect(totalARelever(undefined)).toBe(0);
  });
});
