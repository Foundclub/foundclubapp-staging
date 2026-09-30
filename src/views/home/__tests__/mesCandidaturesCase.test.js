const fs = require('fs');
const path = require('path');

// MES-CANDIDATURES (audit V1, A12 + A13 — 01/10) : LA CASE DE L'ACCUEIL.
//
// 🔴 A12 : la case disait « Mes reponses », la page qu'elle ouvre disait « Mes
// activites ». Un seul mot du debut a la fin : la case et la page suivent LA MEME
// regle, `getRecruitmentRoleMode` — celle que `MyActivitiesScreen` lit deja pour
// choisir entre « Mes candidatures » (joueur) et « Mes activites » (staff).
// Le super admin arrive par cette case ET voit la page du staff : sa case dit
// donc « Mes activites », comme sa page.
// 🔴 A13 : la pastille ne suit plus l'ATTENTE (`search-my-activities` lit
// desormais les reponses non vues, homeCounters.js) ; l'attente s'ECRIT en gris
// dans le sous-titre (« 1 en attente »), par `selectMyApplicationsStatus`.
//
// Controle sur la SOURCE, comme ses voisins (`myActivitiesEntryPoint.test.js`,
// `accueilParRole.test.js`) : HomeHub fait 2 600 lignes et depend d'une vingtaine
// de contextes. Les regles elles-memes sont testees a part, sans ecran :
// `homeCounters.MESCANDIDATURES.test.js` et `MyActivitiesScreen.mesCandidatures.test.js`.

const SOURCE = fs.readFileSync(path.resolve(__dirname, '..', 'HomeHub.js'), 'utf8');
const FR = fs.readFileSync(
  path.resolve(__dirname, '..', '..', '..', 'theme', 'strings', 'translations', 'fr.js'),
  'utf8',
);
const EN = fs.readFileSync(
  path.resolve(__dirname, '..', '..', '..', 'theme', 'strings', 'translations', 'en.js'),
  'utf8',
);

/**
 * Le bloc `cards.push({ ... })` de la carte dont on donne la clef.
 * @param {string} clef La clef de la carte.
 * @returns {string} Le bloc, de `cards.push` a la fin de l'objet.
 */
const blocDeLaCarte = (clef) => {
  const repere = SOURCE.indexOf(`key: '${clef}'`);
  if (repere === -1) throw new Error(`HomeHub n'a plus de carte « ${clef} »`);
  const debut = SOURCE.lastIndexOf('cards.push({', repere);
  const fin = SOURCE.indexOf('});', repere);
  return SOURCE.slice(debut, fin);
};

/**
 * La valeur d'une clef feuille dans un bloc de dictionnaire, lue apres un chemin.
 * @param {string} dictionnaire Le texte de fr.js ou en.js.
 * @param {string[]} chemin Les clefs parentes, dans l'ordre.
 * @param {string} feuille La clef lue.
 * @returns {string} La valeur, ou '' si introuvable.
 */
const valeur = (dictionnaire, chemin, feuille) => {
  let curseur = 0;
  chemin.forEach((clef) => {
    curseur = dictionnaire.indexOf(`${clef}: {`, curseur);
  });
  if (curseur === -1) return '';
  const trouve = dictionnaire.slice(curseur).match(new RegExp(`\\n\\s*${feuille}: (['"])(.*?)\\1,`));
  return trouve ? trouve[2] : '';
};

describe('A12 — la case du joueur dit ce que la page dit', () => {
  const carte = blocDeLaCarte('search-my-activities');

  it('LE TEMOIN : son titre par defaut est « Mes candidatures », plus « Mes reponses »', () => {
    expect(carte).toContain("'Mes candidatures'");
    expect(carte).not.toContain("'Mes réponses'");
  });

  it('le dictionnaire dit la meme chose, dans les deux langues', () => {
    const chemin = ['homeHub', 'cards', 'search', 'myActivities'];
    expect(valeur(FR, chemin, 'title')).toBe('Mes candidatures');
    expect(valeur(EN, chemin, 'title')).toBe('My applications');
  });

  it('la case lit LA MEME regle que la page : le mode de recrutement du compte', () => {
    expect(carte).toContain('isMyActivitiesStaff');
    expect(SOURCE).toContain("getRecruitmentRoleMode(userData) === 'staff'");
    // Le super admin voit la page du staff : sa case reprend les mots du staff.
    expect(carte).toContain("t('homeHub.cards.manage.myAds.title', 'Mes activités')");
  });
});

describe('A13 — la case ecrit l attente, et ne rougit que pour une reponse non vue', () => {
  const carte = blocDeLaCarte('search-my-activities');

  it('LE TEMOIN : son sous-titre vient de `selectMyApplicationsStatus`', () => {
    expect(SOURCE).toContain('selectMyApplicationsStatus(homeCounters)');
    expect(carte).toContain('myApplicationsSubtitle');
  });

  it('sa pastille reste celle de la case (qui lit les reponses non vues)', () => {
    expect(carte).toContain("homeAlerts['search-my-activities']");
  });

  it('« 1 en attente » et « 1 nouvelle reponse » existent en francais ET en anglais, aux deux nombres', () => {
    const chemin = ['homeHub', 'cards', 'search', 'myActivities'];
    expect(valeur(FR, chemin, 'pending_one')).toBe('{{count}} en attente');
    expect(valeur(FR, chemin, 'pending_other')).toBe('{{count}} en attente');
    expect(valeur(FR, chemin, 'unseen_one')).toBe('{{count}} nouvelle réponse');
    expect(valeur(FR, chemin, 'unseen_other')).toBe('{{count}} nouvelles réponses');
    expect(valeur(EN, chemin, 'pending_one')).toBe('{{count}} pending');
    expect(valeur(EN, chemin, 'unseen_other')).toBe('{{count}} new replies');
  });
});
