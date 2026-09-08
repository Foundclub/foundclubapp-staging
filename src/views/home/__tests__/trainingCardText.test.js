const fs = require('fs');
const path = require('path');

const { compteARebours, joursAvant, sousTitreSeance } = require('../trainingCardText');

/**
 * LA CARTE « MON ENTRAINEMENT » DE L'ACCUEIL — ce qu'elle DIT.
 *
 * 🔎 LE TROU QUE CE FICHIER BOUCHE, mesure le 2026-09-08 : le seul temoin de
 * l'accueil verifiait que les cartes SONT LA. Il ne regardait ni leur titre, ni
 * leur sous-titre, ni leur destination. Quelqu'un pouvait casser l'aiguillage
 * vers le planning sans que rien ne rougisse.
 *
 * 🪤 ET CE QUE LA CARTE DISAIT AVANT : toujours le meme mot fige, « Mon
 * entrainement », et pour seul sous-titre le theme de la seance. Depuis
 * l'accueil, le joueur ne savait ni quel programme il suivait, ni si c'etait
 * pour ce matin ou pour la semaine prochaine, ni ou aller, ni combien de temps
 * ca prend.
 */

/**
 * Une traduction de test : elle rend la clef et ses options, pour qu'on les voie.
 * @param {string} clef la clef demandee
 * @param {any} [options] les valeurs a interpoler
 * @returns {string} la clef, suivie de ses options quand il y en a
 */
const t = (clef, options) => (
  options ? `${clef}|${JSON.stringify(options)}` : clef
);

const LUNDI = new Date('2026-09-07T10:00:00');

describe('le compte a rebours se dit en mots, jamais en date seche', () => {
  it('dit « aujourd hui » pour le jour meme', () => {
    expect(compteARebours('2026-09-07', t, LUNDI)).toBe('training.home.myCard.today');
  });

  it('dit « demain » pour le lendemain', () => {
    expect(compteARebours('2026-09-08', t, LUNDI)).toBe('training.home.myCard.tomorrow');
  });

  it('compte les jours au-dela, avec le pluriel qui va bien', () => {
    expect(compteARebours('2026-09-10', t, LUNDI))
      .toBe('training.home.countdown|{"count":3}');
  });

  it('garde « aujourd hui » pour une seance EN RETARD : elle attend, elle n est pas perdue', () => {
    expect(compteARebours('2026-09-01', t, LUNDI)).toBe('training.home.myCard.today');
  });

  it('ne dit rien quand la date manque, plutot que d afficher un trou', () => {
    expect(compteARebours(null, t, LUNDI)).toBe('');
    expect(compteARebours('pas une date', t, LUNDI)).toBe('');
  });

  it('compte en JOURS DE CALENDRIER, pas en heures : 23 h d ecart font bien 1 jour', () => {
    expect(joursAvant('2026-09-08', new Date('2026-09-07T23:00:00'))).toBe(1);
  });
});

describe('le sous-titre porte ce qu il faut savoir AVANT de partir', () => {
  const JOURNEE = {
    durationMinutes: 120,
    markers: ['un partenaire', 'un trepied', 'de l eau', 'des plots'],
    place: 'salle',
    title: 'Jour B — Detente',
  };

  it('dit le theme, le lieu ET la duree — l app n affichait que le theme', () => {
    expect(sousTitreSeance(JOURNEE, t)).toContain('"day":"Jour B — Detente"');
    expect(sousTitreSeance(JOURNEE, t)).toContain('"place":"salle"');
    expect(sousTitreSeance(JOURNEE, t)).toContain('"duration":120');
  });

  it('annonce combien de choses il y a a preparer', () => {
    expect(sousTitreSeance(JOURNEE, t)).toContain('toPrepare|{"count":4}');
  });

  it('se tait sur les preparatifs quand la journee n en porte aucun', () => {
    expect(sousTitreSeance({ ...JOURNEE, markers: [] }, t)).not.toContain('toPrepare');
  });

  it('ne laisse pas de trou entre deux points medians quand une donnee manque', () => {
    const sansMarqueurs = sousTitreSeance({ ...JOURNEE, markers: undefined }, t);

    expect(sansMarqueurs).not.toMatch(/ · *$/);
    expect(sansMarqueurs).not.toContain('· ·');
  });

  it('rend une chaine vide, jamais « undefined », quand il n y a pas de journee', () => {
    expect(sousTitreSeance(null, t)).toBe('');
  });
});

/**
 * Les trois cartes elles-memes se lisent dans le TEXTE de l'ecran : `HomeHub.js`
 * fait plus de 2 500 lignes et ne se monte pas sous `react-test-renderer`. C'est
 * la meme mecanique que le temoin d'accueil par role, juste a cote.
 */
describe('les trois cartes de la section, et ou elles menent', () => {
  const SOURCE = fs.readFileSync(path.resolve(__dirname, '..', 'HomeHub.js'), 'utf8');
  const MEMO = SOURCE.slice(
    SOURCE.indexOf('const trainingCards = useMemo('),
    SOURCE.indexOf('const searchCards = useMemo('),
  );

  it('la section en compte TROIS — le carnet etait une porte manquante', () => {
    expect(MEMO.match(/key: '([^']+)'/g)).toEqual([
      "key: 'training-mine'", "key: 'training-find'", "key: 'training-logbook'",
    ]);
  });

  it('la grande carte prend toute la largeur, comme celle de League', () => {
    expect(MEMO).toContain("layout: 'full'");
  });

  it('elle est mise en avant DANS LES DEUX CAS', () => {
    // 🪤 La mise en avant etait branchee sur « est-ce que je suis un programme ».
    // C'etait a l'envers : le joueur qu'il faut convaincre est celui qui n'a rien
    // commence, et il voyait la carte la plus eteinte de l'ecran.
    expect(MEMO).toContain('highlighted: true');
    expect(MEMO).not.toMatch(/highlighted: Boolean\(/);
  });

  it('le carnet mene AU CARNET, et le catalogue au catalogue', () => {
    expect(MEMO).toContain('RouteNames.TrainingLogbook');
    expect(MEMO).toContain('RouteNames.TrainingCatalog');
    expect(MEMO).toContain('RouteNames.TrainingPlan');
  });

  it('aucune carte ne porte plus le trophee, qui affichait un drapeau', () => {
    // La clef « trophy » est branchee sur flag.png (theme/images.js, « Temp mapping ») :
    // la carte du catalogue montrait donc le meme fond que FoundClub League, juste
    // en dessous sur le meme ecran, avec un petit drapeau par-dessus.
    expect(MEMO).not.toContain("icon: 'trophy'");
    expect(MEMO).toContain("icon: 'running'");
    expect(MEMO).toContain("icon: 'clock'");
  });
});
