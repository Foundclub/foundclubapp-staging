import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';

// D59 ④ — « Passes D » doit disparaitre des ecrans de statistiques.
//
// POURQUOI UN TEST SUR LA SOURCE, ET PAS SUR LE RENDU : `TeamDetails.js` fait
// 5 484 lignes et n'a AUCUN test (regle E6). Monter cet ecran pour lire un
// libelle couterait bien plus que ce que ca protege, et n'ajouterait aucune
// garantie sur les AUTRES ecrans — or c'est justement l'eparpillement du
// vocabulaire qui a cree le defaut : la forme longue existait deja a 5 endroits
// pendant que deux ecrans gardaient l'abreviation.
//
// Ce filet dit donc la seule chose utile : l'abreviation ne revient nulle part,
// et la dette qui reste est NOMMEE plutot que silencieuse.

const SOURCE_ROOT = join(__dirname, '..', '..', '..');
const CODE_EXTENSIONS = ['.js', '.ts', '.tsx', '.json'];

// 🔎 L'abreviation, insensible a la casse : « Passes D » suivi de tout sauf une
// lettre (pour ne pas attraper « Passes decisives », ni « passes dans »).
const ABBREVIATION = /passes\s+d(?![a-zàâäéèêëîïôöùûüç])/i;

/**
 * Tous les fichiers de code sous `src`, en chemins relatifs a la racine du depot.
 * @param {string} directory
 * @returns {string[]}
 */
const listCodeFiles = (directory) => readdirSync(directory).flatMap((entry) => {
  const fullPath = join(directory, entry);
  if (statSync(fullPath).isDirectory()) {
    return listCodeFiles(fullPath);
  }
  return CODE_EXTENSIONS.some((extension) => entry.endsWith(extension)) ? [fullPath] : [];
});

const offenders = listCodeFiles(SOURCE_ROOT)
  .filter((fullPath) => !fullPath.includes(`${sep}__tests__${sep}`))
  .filter((fullPath) => ABBREVIATION.test(readFileSync(fullPath, 'utf8')))
  .map((fullPath) => relative(SOURCE_ROOT, fullPath).split(sep).join('/'))
  .sort();

describe('Le vocabulaire des statistiques ne s abrege plus (D59 ④)', () => {
  it('l ecran d une equipe ecrit « Passes décisives » en toutes lettres', () => {
    const source = readFileSync(join(SOURCE_ROOT, 'views', 'team', 'TeamDetails.js'), 'utf8');

    expect(source).toContain("label: 'Passes décisives'");
    expect(ABBREVIATION.test(source)).toBe(false);
  });

  // ⚠️ DETTE NOMMEE, PAS OUBLIEE. `views/profile/` appartenait a une autre
  // session le 2026-08-10 et `UserDetails.js` y etait modifie au moment de ce
  // lot : y toucher aurait provoque une collision. La correction tient en un
  // mot, meme forme que ci-dessus :
  //     views/profile/UserDetails.js — { label: 'Passes D', value: assists }
  //  -> { label: 'Passes décisives', value: assists }
  // Quand elle sera faite, CE TEST TOMBERA et demandera de vider la liste.
  // C'est voulu : une dette qui se solde en silence est une dette qu'on oublie.
  it('la seule abreviation restante est celle qu une autre session tenait', () => {
    expect(offenders).toEqual(['views/profile/UserDetails.js']);
  });
});
