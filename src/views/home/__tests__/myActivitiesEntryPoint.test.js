const fs = require('fs');
const path = require('path');

// D57 — LE controle qui protege une fonctionnalite INVISIBLE.
//
// « Mes activites » (RouteNames.MyActivities) est ecrit, monte dans SearchStack,
// et il porte cote joueur l'onglet « Mes reponses » (MyActivitiesScreen.js:156).
// Mais AUCUNE porte n'y menait pour lui : les deux seules cases d'accueil qui
// l'ouvrent vivent dans `manageSectionCards`, et ce tableau rend `[]` des que le
// compte n'est ni entraineur ni president (HomeHub.js:1708). Un joueur ne
// pouvait donc pas atteindre ses propres candidatures.
//
// Le controle est fait sur la SOURCE plutot qu'au rendu, pour la meme raison
// que subscriptionEntryPoints.test.js : HomeHub.js fait 2 382 lignes et depend
// d'une vingtaine de contextes React. Un test de rendu couterait plus cher que
// l'ecran lui-meme, et surtout il ne dirait RIEN de la branche non prise —
// alors que le defaut est exactement une branche absente.

const SOURCE_HOME_HUB = fs.readFileSync(
  path.resolve(__dirname, '..', 'HomeHub.js'),
  'utf8',
);

/**
 * Le corps d'un `useMemo` nomme, delimite par sa declaration et son tableau de
 * dependances. On ne cherche pas l'accolade fermante : le tableau de deps
 * (`}, [`) termine un useMemo sans ambiguite dans ce fichier.
 * @param {string} nom Le nom de la constante.
 * @returns {string} Le corps du memo.
 */
const corpsDuMemo = (nom) => {
  const debut = SOURCE_HOME_HUB.indexOf(`const ${nom} = useMemo(`);
  if (debut === -1) throw new Error(`HomeHub n'a plus de memo « ${nom} »`);
  const fin = SOURCE_HOME_HUB.indexOf('}, [', debut);
  if (fin === -1) throw new Error(`Le memo « ${nom} » n'a pas de tableau de dependances`);
  return SOURCE_HOME_HUB.slice(debut, fin);
};

/**
 * La portion d'un memo gardee par `if (!hasManageSection) {`, c'est-a-dire ce
 * que voit un compte SANS section « Gerer mon club » : joueur, superadmin,
 * compte sans club.
 * @param {string} nom Le nom de la constante.
 * @returns {string} La branche, ou une chaine vide si elle n'existe pas.
 */
const brancheSansSectionGerer = (nom) => {
  const corps = corpsDuMemo(nom);
  const debut = corps.indexOf('if (!hasManageSection) {');
  if (debut === -1) return '';
  return corps.slice(debut);
};

describe('D57 — la porte de « Mes activites » existe pour un compte joueur', () => {
  // LE TEMOIN. Rouge avant le lot : la seule branche que voit un joueur
  // (`if (!hasManageSection)`) ne citait que SearchRecruitment.
  it('LE TEMOIN : un compte sans section « Gerer mon club » a une entree vers Mes activites', () => {
    expect(brancheSansSectionGerer('searchCards')).toContain('RouteNames.MyActivities');
  });

  it('cette entree est un vrai bouton : elle porte un onPress', () => {
    const branche = brancheSansSectionGerer('searchCards');
    const carteMyActivities = branche.slice(
      branche.lastIndexOf('cards.push', branche.indexOf('RouteNames.MyActivities')),
      branche.indexOf('RouteNames.MyActivities'),
    );

    expect(carteMyActivities).toContain('onPress');
  });

  // R06 : deux appelants avaient ecrit `navigate(Search, { screen: ... })`, soit
  // DEUX niveaux, et le bouton paraissait inerte. Ici la cible vit dans le MEME
  // navigateur que HomeHub (SearchStack.js:53-56, HomeHub y est SearchHome) :
  // un navigate a un seul niveau est donc la forme juste, et c'est celle que les
  // deux cases du staff utilisent deja depuis D35.
  it('elle vise la route directement, sans empiler un navigateur de plus', () => {
    const branche = brancheSansSectionGerer('searchCards');

    expect(branche).toContain('navigation.navigate(RouteNames.MyActivities)');
    expect(branche).not.toContain('screen: RouteNames.MyActivities');
  });

  // Le staff ne perd pas la sienne : c'est le meme ecran, atteint par la section
  // « Gerer mon club » (D35, §4 du pack).
  it('NON-REGRESSION : le staff garde son entree dans « Gerer mon club »', () => {
    expect(corpsDuMemo('manageSectionCards')).toContain('handleOpenMyRecruitmentAds');
    expect(SOURCE_HOME_HUB).toContain('navigation.navigate(RouteNames.MyActivities)');
  });
});
