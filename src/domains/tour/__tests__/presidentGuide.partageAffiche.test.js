import { PRESIDENT_GUIDE } from '../presidentGuide';

// Recette L10 : sur Android, « Partager l'affiche » l'enregistre puis propose de l'ouvrir ; aucune
// feuille de partage, et sur iPhone l'app ne sait pas si elle est partie. Le guide ne dit donc pas
// qu'elle est envoyée.
const step = (id) => PRESIDENT_GUIDE.steps.find((candidate) => candidate.id === id);
const text = (_key, fallback) => fallback;

describe('affiche du guide Dirigeant : aucun envoi annoncé sans preuve', () => {
  it('ni le bouton, ni la bulle suivante, ni le bilan', () => {
    expect(step('m1-psent').nextLabel).not.toMatch(/envoy/i);
    expect(step('m1-pclose').text).not.toMatch(/envoy/i);
    const lines = PRESIDENT_GUIDE.closingLines(text, { created: { 'club.poster.shared': {} } });
    expect(lines.filter(Boolean).join(' ')).not.toMatch(/partagée|envoy/i);
    expect(lines.filter(Boolean).join(' ')).toMatch(/Affiche/);
  });

  it('témoin : la bulle dit encore quoi faire', () => {
    expect(step('m1-pclose').text).toMatch(/croix/);
  });
});

// Recette L10 (l10-a14) : sans l'offre Club, la partie 4/5 n'existe pas, et le compteur sautait.
describe('M1 : la dernière partie ne porte pas de numéro', () => {
  it('ni 3/5 puis 5/5 en visite, ni 4/5 puis 5/5 en réel : « Dernière étape »', () => {
    expect(step('m1-poster').text).not.toMatch(/\d\/5/);
    expect(step('m1-poster').text).toMatch(/Dernière étape/);
  });
});

// Recette L11 (l11-m3e2b, l11-m3e3) : la bulle disait « Suivant » sous un bouton « Continuer sans
// niveau », et parlait d'un coach « que tu viens d'ajouter » quand M2 était passée.
describe('M3 : les bulles disent ce que montre l’écran', () => {
  const textOf = (pattern) => PRESIDENT_GUIDE.steps
    .map((one) => String(one.text || '')).find((one) => pattern.test(one));

  it('6/8 : le bouton du niveau, par son nom', () => {
    expect(textOf(/niveau de compétition/)).toContain('Continuer sans niveau');
  });

  it('7/8 : aucun coach ajouté supposé', () => {
    expect(textOf(/gérera l’équipe/)).not.toMatch(/viens d’ajouter/);
  });
});
