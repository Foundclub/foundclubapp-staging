const fs = require('fs');
const path = require('path');

// 🕒 MARQUE-MAIRIE (14/10/2026) — COL-003, « D3- B » puis « 3- ok go » d'Adel : le bandeau
// de l'accueil dit que le prochain événement attend la mairie (« En attente de la mairie »).
// Le serveur pose `pendingDecider` sur `prochainEvenement` (joueur, dirigeant) et sur
// `prochaineSeance` (entraîneur) ; `normalizeHomeCounters` garde l'objet entier.
//
// Le contrôle est fait sur la SOURCE, comme ses voisins de ce dossier
// (`bandeauProchainEvenement`) : HomeHub fait plus de 2 600 lignes et dépend d'une vingtaine de
// contextes React. Le rendu de la phrase est prouvé par `HomeHeadBanner.MARQUE.test.js`, ses
// mots par `EventCardNew.MARQUE.test.js`.
// ROUGE avant le lot.

const SOURCE = fs.readFileSync(path.resolve(__dirname, '..', 'HomeHub.js'), 'utf8');

const corpsDuBandeau = () => {
  const debut = SOURCE.indexOf('const headBanner = useMemo(');
  if (debut === -1) throw new Error("HomeHub n'a plus de memo « headBanner »");
  const fin = SOURCE.indexOf('}, [', debut);
  if (fin === -1) throw new Error("Le memo « headBanner » n'a plus de dependances");
  return SOURCE.slice(debut, fin);
};
const compter = (/** @type {string} */ texte, /** @type {string} */ motif) => (
  texte.split(motif).length - 1
);

describe('MARQUE-MAIRIE — le bandeau de l accueil dit que le prochain événement attend', () => {
  it('les mots viennent de LA règle partagée (fiche, grille, carte), pas d une copie', () => {
    expect(SOURCE).toContain(
      "import { pendingDeciderLabel } from '@/domains/event/pendingDeciderLabel';",
    );
  });

  it('joueur et dirigeant : la phrase du prochain événement, sur ses trois bandeaux', () => {
    const corps = corpsDuBandeau();
    expect(corps).toContain(
      'const attente = pendingDeciderLabel(homeCounters.prochainEvenement?.pendingDecider, t);',
    );
    // La ligne du dirigeant, et les deux bandeaux du joueur (avec et sans réponse).
    expect(compter(corps, 'notice: attente ||')).toBe(3);
  });

  it('entraîneur : la phrase de SA prochaine séance', () => {
    expect(corpsDuBandeau()).toContain('notice: pendingDeciderLabel(seance.pendingDecider, t)');
  });
});
