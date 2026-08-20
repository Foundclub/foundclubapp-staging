import fs from 'fs';
import path from 'path';

/**
 * AA07 / K3 — LE CLAVIER DES CHAMPS QUI ATTENDENT UN NOMBRE.
 *
 * 🗣️ Adel, recette du 2026-08-20 : « quand on saisit le montant d une
 * cotisation, le clavier bugue — et c est un clavier de lettres qui s ouvre ».
 *
 * 🔬 CE QUE LE RECENSEMENT A MONTRE — l app compte 41 champs porteurs d un sens
 * numerique ; 36 declaraient deja leur clavier. Le defaut ne vient donc PAS
 * d un oubli general, il vient d UN composant enveloppe : `Field`, local a cet
 * ecran, n expose aucun `keyboardType`. Une recherche naive de `<TextInput>` ne
 * pouvait pas le voir — l enveloppe cachait le defaut.
 *
 * 🧨 ET CE N EST PAS QUE DU CONFORT : `euroToCents` (ligne 75) fait
 * `Math.round(Number('abc') * 100)` = **NaN**, que `JSON.stringify` transforme
 * en `null` avant l envoi. Un clavier de lettres sur « Montant » ne gene pas
 * l utilisateur : il laisse partir un montant vide au serveur.
 *
 * 📌 POURQUOI UN TEMOIN SUR LA SOURCE — le meme motif que
 * `accueilParRole.test.js` : ce qu on protege ici est une PROPRIETE DE
 * DECLARATION (« ce champ annonce un clavier de chiffres »), pas un rendu.
 * Monter l ecran entier pour la lire couterait 8 s et ne prouverait pas plus.
 */

const FICHIER = path.join(__dirname, '..', 'ClubLicenseCampaignSettings.js');
const SOURCE = fs.readFileSync(FICHIER, 'utf8');

/**
 * Rend le bloc de la balise ouvrante qui suit `ancre`, accolades comprises.
 * @param {string} ancre le libelle exact du champ cherche
 * @returns {string} le bloc `<Field ... />` qui porte ce libelle
 */
const blocDuChamp = (ancre) => {
  const position = SOURCE.indexOf(ancre);
  if (position === -1) throw new Error(`Champ introuvable dans la source : ${ancre}`);
  const debut = SOURCE.lastIndexOf('<', position);
  let index = debut;
  let profondeur = 0;
  while (index < SOURCE.length) {
    const caractere = SOURCE[index];
    if (caractere === '{') profondeur += 1;
    else if (caractere === '}') profondeur -= 1;
    else if (caractere === '>' && profondeur === 0) break;
    index += 1;
  }
  return SOURCE.slice(debut, index + 1);
};

// Les quatre champs de cet ecran ou l on tape un NOMBRE, et rien d autre.
// ⛔ « Libelle interne » n y est pas : c est du texte, il garde son clavier.
const CHAMPS_NUMERIQUES = [
  'label="Montant (EUR)"',
  'label="Priorite"',
  'label="Commencer X jours avant l échéance"',
  'label="Reprendre X jours après l échéance"',
];

describe('AA07 / K3 — un champ qui attend un nombre ouvre un clavier de chiffres', () => {
  it.each(CHAMPS_NUMERIQUES)('%s declare un clavier numerique', (ancre) => {
    expect(blocDuChamp(ancre)).toMatch(/keyboardType=/);
  });

  it('« Montant (EUR) » refuse les lettres avant qu elles atteignent le serveur', () => {
    // 🧨 Le vrai enjeu : `euroToCents('abc')` vaut NaN. Le champ doit donc
    // nettoyer la saisie, pas seulement proposer le bon clavier — un clavier
    // materiel, un copier-coller ou une dictee contournent le clavier.
    expect(blocDuChamp('label="Montant (EUR)"')).toMatch(/normalizeAmountInput/);
  });

  it('« Priorite » ne garde que des chiffres', () => {
    expect(blocDuChamp('label="Priorite"')).toMatch(/normalizeWholeNumberInput/);
  });

  it('le champ de TEXTE voisin garde son clavier de lettres', () => {
    // 🔒 GARDE-FOU : elargir le nettoyage aux libelles rendrait le champ
    // « Tarif joueurs seniors » impossible a remplir.
    expect(blocDuChamp('label="Libellé interne"')).not.toMatch(/keyboardType=/);
  });
});

describe('AA07 / K3 — le nettoyage des nombres entiers', () => {
  /**
   * Recharge le module pour lire le helper tel qu il est ecrit.
   * @returns {(valeur: unknown) => string} le normaliseur d entiers
   */
  const chargerNormaliseur = () => {
    const correspondance = SOURCE.match(
      /const normalizeWholeNumberInput = \(value\) => ([^;]+);/,
    );
    if (!correspondance) throw new Error('normalizeWholeNumberInput introuvable');
    // eslint-disable-next-line no-new-func
    return new Function('value', `return ${correspondance[1]};`);
  };

  it.each([
    ['12', '12'],
    ['abc', ''],
    ['1a2b3', '123'],
    ['-5', '5'],
    ['', ''],
    [null, ''],
  ])('« %s » devient « %s »', (saisie, attendu) => {
    expect(chargerNormaliseur()(saisie)).toBe(attendu);
  });
});
