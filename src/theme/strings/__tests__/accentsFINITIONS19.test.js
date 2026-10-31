/* eslint-disable max-len -- des phrases entieres, comparees telles quelles */
import { readFileSync } from 'fs';
import { join } from 'path';

import i18n from '@/theme/strings';

// FINITIONS19 · POINT 1 (tournee T17 §1 et §7.5) — les derniers accents vus a l'ecran : « pour l
// ajouter ou la retirer » et « la fiche de l événement » (Modifier un événement, site), « Separer
// chaque certification » (tunnel d'annonce entraineur), le statut de candidature « Accepte », la
// console superadmin « Resolus » et « signalement(s) affiche(s) ». Le dictionnaire ET les replis
// des ecrans (le meme texte), plus le « Chargement de l événement... » des deux fiches du site.
// ROUGE avant.
// « Disciplines presentes sur FoundClub » (vitrine /annuaire/) vit dans le depot web : son temoin
// est web/scripts/__tests__/FINITIONS19-accents-vitrine.test.mjs.

const TEXTES = {
  'adminReports.filters.resolved': 'Résolus',
  'adminReports.shownCount_other': 'signalements affichés',
  'adWizardCoachProfile.certificationsHelper': 'Séparer chaque certification par une virgule.',
  'eventDetails.loadingTheEvent': 'Chargement de l’événement...',
  'eventEdit.clickATeamToAdd': 'Clique sur une équipe pour l’ajouter ou la retirer, sans combinaison clavier.',
  'eventEdit.loadingTheEvent': 'Chargement de l’événement...',
  'eventEdit.theFeaturingRequestIsMade': 'La demande de mise à la une se fait depuis la fiche de l’événement après création.',
  'recruitmentAdDetails.status.accepted': 'Accepté',
};

const SRC = join(__dirname, '..', '..', '..');

// Les replis ecrits dans les ecrans : ils s'affichent si la cle manque. Ce sont des TEXTES, jamais
// compares par le code (le statut se compare sur `accepted`, pas sur son libelle).
const REPLIS = {
  'components/molecules/proposalMessageBubble/ProposalMessageBubble.js': ["'Accepte'", "'Refuse'", "'Acceptee'"],
  'views/admin/AdminReports.js': ["'Resolus'", 'affiche(s)'],
  'views/event/EventDetails.web.js': ['Chargement de l événement'],
  'views/event/EventEdit.js': ["l'evenement une fois enregistre", 'mise a la une'],
  'views/event/EventEdit.web.js': ['l ajouter', 'l événement'],
  'views/recruitment/RecruitmentAdDetails.js': ["'Accepte'"],
  'views/recruitment/wizard/AdWizardCoachProfile.js': ['Separer'],
};

afterAll(async () => {
  await i18n.changeLanguage('fr');
});

describe('FINITIONS19 1 — les accents vus par la T17', () => {
  it.each(Object.entries(TEXTES))('🔴 %s', async (clef, francais) => {
    await i18n.changeLanguage('fr');
    expect(i18n.t(clef)).toBe(francais);
  });

  it.each(Object.entries(REPLIS))('🔴 aucun repli sans accent dans %s', (fichier, fragments) => {
    const source = readFileSync(join(SRC, fichier), 'utf8');
    expect(fragments.filter((fragment) => source.includes(fragment))).toEqual([]);
  });
});
