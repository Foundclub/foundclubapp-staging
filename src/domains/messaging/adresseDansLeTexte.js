/**
 * MSG1A (§3.18) — UNE ADRESSE ECRITE DANS UN MESSAGE DEVIENT UN LIEN.
 *
 * Le pack la definit ainsi : « numero + type de voie ». Le motif reconnait :
 * - un numero (« 12 », « 45 bis »), puis un type de voie connu (rue, avenue, chemin...) ;
 * - le nom de la voie : des mots qui commencent par une MAJUSCULE ou un chiffre, relies par
 *   les petits mots du francais (de, du, la, l', d'...). C'est ce qui arrete l'adresse
 *   avant la suite de la phrase : « 12 rue de la Paix demain a 18h » rend « 12 rue de la Paix » ;
 * - en option, « , 83000 Toulon ».
 *
 * ⛔ Pas de drapeau `i` : il rendrait la majuscule du nom facultative, et toute la phrase
 * suivrait. Les types de voie portent donc leurs deux casses.
 * ponytail: un nom de voie tout en minuscules (« 3 rue des lilas ») s'arrete au type de voie ;
 * la voie de sortie est un vrai geocodeur, hors de ce lot.
 */

const TYPES_DE_VOIE = [
  'rue', 'avenue', 'av\\.', 'boulevard', 'bd', 'chemin', 'allée', 'allee', 'place', 'impasse',
  'route', 'quai', 'cours', 'square', 'voie', 'passage', 'résidence', 'lotissement', 'faubourg',
  'esplanade', 'promenade', 'rond-point', 'sentier', 'cité', 'hameau', 'parvis', 'traverse',
].map((type) => `[${type[0].toUpperCase()}${type[0]}]${type.slice(1)}`).join('|');

const LIAISON = "(?:(?:de|du|des|la|le|les|aux|au|et|sur|sous|en|à)\\s+|[ld]['’])";
const MOT_PROPRE = "[A-ZÀ-Ý0-9][A-Za-zÀ-ÿ0-9'’\\-]*";
const NOM_DE_VOIE = `${LIAISON}*${MOT_PROPRE}(?:\\s+${LIAISON}*${MOT_PROPRE})*`;
const VILLE = `,?\\s+\\d{5}\\s+${MOT_PROPRE}(?:[\\s\\-]${MOT_PROPRE})*`;

/**
 * Le motif d'une adresse ecrite dans un texte. Une NOUVELLE expression a chaque appel :
 * une expression partagee garde son `lastIndex` d'un appel a l'autre.
 * @returns {RegExp}
 */
export const motifDAdresse = () => new RegExp(
  `\\b\\d{1,4}(?:\\s?(?:bis|ter))?,?\\s+(?:${TYPES_DE_VOIE})\\s+${NOM_DE_VOIE}(?:${VILLE})?`,
  'g',
);

/**
 * Les adresses trouvees dans un texte, dans l'ordre.
 * @param {string} texte
 * @returns {string[]}
 */
export const adressesDansLeTexte = (texte) => String(texte || '').match(motifDAdresse()) || [];
