import fr from '@/theme/strings/translations/fr';

// Les autres tests de cet écran remplacent `t` par une fonction qui rend le
// repli écrit dans le code : ils prouvent la mise en page, PAS le carnet de
// traductions. Or c'est fr.js qui gagne en vrai — un repli n'est lu que si la
// clé est absente. Ce fichier lit donc le carnet réel.
//
// Si une de ces lignes casse, c'est que le texte affiché à l'utilisateur a
// changé sans qu'on le veuille.

const lire = (/** @type {string} */ chemin) => chemin
  .split('.')
  .reduce((/** @type {any} */ noeud, /** @type {string} */ cle) => noeud?.[cle], fr);

const TEXTES_ATTENDUS = {
  'onboardingAffiliation.a11y.askForHelpHint': 'Envoie une demande aux superadmins FoundClub.',
  'onboardingAffiliation.a11y.nearbyHint': 'Autorise la localisation pour classer les clubs par distance.',
  'onboardingAffiliation.a11y.sportChipHint': 'Filtre la liste sur ton sport.',
  'onboardingAffiliation.actions.askForHelp': 'Besoin d\'aide ? Nous contacter',
  'onboardingAffiliation.actions.skip': 'Passer',
  'onboardingAffiliation.addClub.action': 'Ajouter',
  'onboardingAffiliation.addClub.subtitle': 'Ajoute-le en 2 minutes, on s\'occupe du reste.',
  'onboardingAffiliation.addClub.title': 'Ton club n\'est pas là ?',
  'onboardingAffiliation.addTeam.subtitle': 'Signale-la, on s\'occupe du reste.',
  'onboardingAffiliation.addTeam.title': 'Ton équipe n\'est pas là ?',
  'onboardingAffiliation.chips.nearby': 'Autour de moi',
  'onboardingAffiliation.search.placeholderClub': 'Nom du club ou ville',
  'onboardingAffiliation.sections.nearby': 'PRÈS DE CHEZ TOI',
  'onboardingAffiliation.sections.results': 'RÉSULTATS',
  'onboardingAffiliation.sections.suggestions': 'SUGGESTIONS',
  'onboardingAffiliation.sections.teams': 'ÉQUIPES',
  'onboardingAffiliation.subtitleClub': 'On personnalise ton accueil, ton planning et tes annonces autour de ton club.',
  'onboardingAffiliation.subtitleClubStaff': 'Retrouve ton club pour le gérer sur FoundClub.',
  'onboardingAffiliation.titleClub': 'Trouve ton club',
};

describe('fr.js — libellés de l\'étape « Trouve ton club » (6b)', () => {
  it.each(Object.entries(TEXTES_ATTENDUS))('%s', (chemin, attendu) => {
    expect(lire(chemin)).toBe(attendu);
  });

  it('le disclaimer et le bouton « Continuer plus tard » ne sont plus le sous-titre', () => {
    expect(lire('onboardingAffiliation.subtitleClub'))
      .not.toContain('revendiquer');
  });

  // Le titre annonçait « 18 autres écrans ». Mesure du 2026-08-06 : il y en
  // avait 9, tous dans views/onboarding — et depuis D15 il n'y en a plus AUCUN,
  // le lien « Passer cette étape » les a tous remplacés. La clé reste malgré
  // tout : rien ne prouve qu'aucune traduction ni aucun futur écran ne s'y
  // rattachera, et la retirer du carnet commun est un geste à part.
  it('« Continuer plus tard » reste dans le carnet commun, même sans utilisateur', () => {
    expect(lire('common.actions.continueLater')).toBe('Continuer plus tard');
  });
});
