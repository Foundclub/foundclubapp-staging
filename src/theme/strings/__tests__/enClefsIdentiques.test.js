import en from '@/theme/strings/translations/en';
import fr from '@/theme/strings/translations/fr';

// 🔤 I18N-0 — le filet qui garde l'anglais au niveau du français.
//
// Une clef présente dans fr.js et absente de en.js ne casse rien en France :
// i18next retombe sur le français (`fallbackLng: 'fr'`). C'est exactement pour
// ça que personne ne la verrait manquer — l'utilisateur anglophone, lui, lirait
// une phrase française au milieu de l'écran. Ce témoin rougit à la première.
//
// ⚠️ Il compare des ENSEMBLES DE CLEFS, pas des lignes : un texte reformulé dans
// fr.js ne le fait pas rougir, une clef ajoutée d'un seul côté si.
// ✅ Réparer : `node scripts/i18n/clefs.js en --traductions <json>` pose les
// clefs manquantes à leur place triée dans en.js.

/**
 * Les feuilles d'un dictionnaire, chemin pointé → texte.
 * @param {Record<string, any>} noeud - Le dictionnaire ou un de ses objets.
 * @param {string[]} [prefixe] - Le chemin parcouru.
 * @returns {Array<[string, any]>} Les couples chemin / valeur.
 */
const feuilles = (noeud, prefixe = []) => Object.entries(noeud).flatMap(([clef, valeur]) => {
  const chemin = prefixe.concat(clef);
  if (valeur !== null && typeof valeur === 'object') return feuilles(valeur, chemin);
  return [[chemin.join('.'), valeur]];
});

const FR = new Map(feuilles(fr));
const EN = new Map(feuilles(en));

/**
 * Les `{{jetons}}` d'un texte, triés : l'ordre peut changer d'une langue à l'autre.
 * @param {string} texte - Le texte.
 * @returns {string} Les jetons, joints.
 */
const jetons = (texte) => (String(texte).match(/\{\{[^}]+\}\}/g) || []).sort().join(' ');

describe('I18N-0 — en.js a exactement les clefs de fr.js', () => {
  it('lit bien les deux dictionnaires', () => {
    // Garde-fou du témoin : deux dictionnaires vides seraient « égaux ».
    expect(FR.size).toBeGreaterThan(4000);
  });

  it('n’oublie aucune clef de fr.js', () => {
    expect([...FR.keys()].filter((clef) => !EN.has(clef))).toEqual([]);
  });

  it('n’a aucune clef que fr.js n’a pas', () => {
    expect([...EN.keys()].filter((clef) => !FR.has(clef))).toEqual([]);
  });

  it('ne met que du texte, jamais vide quand le français ne l’est pas', () => {
    const fautives = [...FR.entries()]
      .filter(([clef, texte]) => typeof EN.get(clef) !== 'string'
        || (String(texte).trim() !== '' && EN.get(clef).trim() === ''))
      .map(([clef]) => clef);
    expect(fautives).toEqual([]);
  });

  it('garde les mêmes interpolations {{…}} que le français', () => {
    const fautives = [...FR.entries()]
      .filter(([clef, texte]) => EN.has(clef) && jetons(texte) !== jetons(EN.get(clef)))
      .map(([clef]) => `${clef} : fr « ${jetons(FR.get(clef))} » / en « ${jetons(EN.get(clef))} »`);
    expect(fautives).toEqual([]);
  });
});
