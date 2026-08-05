const fs = require('fs');
const path = require('path');

const { sizes, types } = require('@/theme/spaces');

// L38 — un espacement hors rampe ne casse RIEN de visible : `Spaces.paddingBottom[140]`
// vaut `undefined`, React Native ignore la propriete sans un mot, et le style est
// perdu EN SILENCE. Consequence mesuree sur cet ecran : `140` n'existe pas dans la
// rampe, les trois listes n'avaient donc aucune reserve en bas, et leur derniere
// carte passait sous la barre d'onglets.
//
// Le controle est fait sur la SOURCE plutot qu'au rendu : il couvre les 9 appels
// d'un coup, il ne monte pas un ecran de 1 300 lignes, et surtout il ECHOUE des
// qu'un dixieme appel hors rampe apparait — ce qu'aucun test de rendu ne verrait,
// puisque justement il ne se voit pas.

const CHEMIN_SOURCE = path.join(__dirname, '..', 'RecrutementListContent.js');

/**
 * Tous les appels `Spaces.<type>[<cle>]` du fichier, dans l'ordre d'apparition.
 * @returns {Array<{ appel: string; cle: string; type: string }>}
 */
const appelsAuxEspaces = () => [
  ...fs.readFileSync(CHEMIN_SOURCE, 'utf8').matchAll(/Spaces\.([a-zA-Z]+)\[(\d+)\]/g),
].map((occurrence) => ({
  appel: occurrence[0],
  cle: occurrence[2],
  type: occurrence[1],
}));

describe('RecrutementListContent — aucun espacement ne se perd en silence', () => {
  it('la rampe du theme est bien celle sur laquelle ces styles s\'appuient', () => {
    // Si cette liste change, les valeurs retenues ci-dessous sont a rejuger :
    // le test doit rougir plutot que de valider un arrondi devenu faux.
    expect(Object.keys(sizes).map(Number)).toEqual([
      0, 4, 8, 12, 16, 24, 32, 40, 64, 80, 128, 160,
    ]);
  });

  it('aucun appel a Spaces de cet ecran ne rend undefined', () => {
    const horsRampe = appelsAuxEspaces()
      .filter(({ cle, type }) => !(type in types) || !(cle in sizes))
      .map(({ appel }) => appel);

    expect(horsRampe).toEqual([]);
  });

  it('les trois listes reservent bien de la place sous la derniere carte', () => {
    // Le temoin de la panne d'origine : la 4e liste (les profils) passe sa
    // reserve en NOMBRE (`bottomPadding={140}`) et fonctionnait donc, seule.
    const reserves = appelsAuxEspaces()
      .filter(({ type }) => type === 'paddingBottom')
      .filter(({ cle }) => Number(sizes[cle]) >= 128);

    expect(reserves).toHaveLength(3);
  });
});
