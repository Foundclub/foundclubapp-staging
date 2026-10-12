import { villeInitiale } from './collectiviteActualites';
import { collectiviteInitial as initialeConsole } from './collectiviteConsole';
import { collectiviteInitial as initialeAffichage } from './collectiviteDisplay';

// 🛡️ VT18E (07/10/2026), point 5 et ajout T18 (c) — UNE SEULE RÈGLE POUR L'INITIALE D'UNE
// COLLECTIVITÉ. Trois fonctions coexistaient : « le DERNIER mot » (collectiviteConsole, console
// et aperçu de création ; villeInitiale, menu de la Ville et site) et « le premier mot du nom
// propre » (collectiviteDisplay, page du club et abonnement couvert). Tournée T18 : « Ville de
// Rouvres T18 essai » ⇒ « E » dans la liste de la console du site (SITE_S04) ; le même nom ⇒ « R »
// sur la page du club. La règle retenue : l'initiale du NOM PROPRE, après le nom commun officiel
// (« Ville de », « Département du », « Communauté de communes du »…). ROUGE avant le lot.

const ATTENDUS = [
  ['Ville de Montrivage', 'M'],
  ['Ville d’Aix', 'A'],
  ['Ville d\'Aix-en-Provence', 'A'],
  ['Département du Var', 'V'],
  ['Région Sud', 'S'],
  ['Métropole de Lyon', 'L'],
  ['Ville de Rouvres T18 essai', 'R'],
  ['Ville de Saint-Priest', 'S'],
  ['Communauté de communes du Val de Saône', 'V'],
  ['Communauté d’agglomération du Pays Basque', 'P'],
  ['', '?'],
];

describe('VT18E — l initiale d une collectivité : une seule règle', () => {
  it.each(ATTENDUS)('« %s » ⇒ « %s », partout', (nom, lettre) => {
    expect([initialeConsole(nom), initialeAffichage(nom), villeInitiale(nom)])
      .toEqual([lettre, lettre, lettre]);
  });
});
