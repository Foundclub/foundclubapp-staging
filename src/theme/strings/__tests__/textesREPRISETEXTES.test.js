import fs from 'fs';
import path from 'path';

import en from '@/theme/strings/translations/en';
import fr from '@/theme/strings/translations/fr';

// REPRISE-TEXTES (étape 7, 01/11) — les textes que la revue et les contre-recettes ont encore vus :
// « roster » et « warning » en anglais dans le tournoi (24, 133, D-COACH-13), « aujourd hui » et
// `250` à l'étape 2 des cotisations (24), la phrase du stage sans accents (D-COACH-13), « Votes
// multiples autorises » (135), « a répondu qu’il ne serait pas là » au masculin (D-COACH-7),
// « Club organisateur: » (24), « V2 » chez le gérant (24), « Quota événement gratuit … avant
// paywall » sur un match. ROUGE avant : tout ceci est corrigé, et les « (s) » écrits en dur dans
// les écrans d'événements passent par des clés accordées.

const valeur = (dict, cle) => cle.split('.').reduce((o, p) => (o == null ? o : o[p]), dict);
const valeursDe = (o) => Object.values(o).flatMap((v) => (
  v && typeof v === 'object' ? valeursDe(v) : [v]
));

test('🔴 plus de « roster » ni de « warning » dans les textes français', () => {
  // Les {{jetons}} sont des noms de variables, pas du texte affiché.
  const fautifs = valeursDe(fr)
    .filter((v) => typeof v === 'string')
    .filter((v) => /\b(rosters?|[Ww]arnings?)\b/.test(v.replace(/\{\{\w+\}\}/g, '')));
  expect(fautifs).toEqual([]);
});

test.each([
  ['clubLicenseCampaignSettings.amountField.hint',
    'Saisis simplement un montant, par exemple 250 ou 250,00.'],
  ['clubLicenseCampaignSettings.audience.concernedToday_other',
    '{{count}} membres concernés aujourd’hui'],
  ['eventWizard.stage.applyToAllHelper',
    'Réinitialise les horaires personnalisés et réapplique la base du stage.'],
  ['pollDetails.multipleVotesAllowed', 'Votes multiples autorisés'],
  ['matchCallUp.selection.absentWarning.message_one', '{{names}} a dit ne pas venir.'],
  ['matchCallUp.selection.absentWarning.title_one', '1 réponse « Absent »'],
  ['eventDetails.organisingClub', 'Club organisateur :'],
  ['complexeStats.parHeure', 'Par heure · bientôt'],
  ['eventWizard.recap.freeQuota.title', 'Publication gratuite'],
  ['tournamentManagement.filterWarning', 'Alertes d’effectif'],
  ['login.codeSubtitle', 'Entre le code reçu par SMS.'],
])('🔴 %s', (cle, attendu) => {
  expect(valeur(fr, cle)).toBe(attendu);
});

test('🔴 les compteurs des postes, places et membres sont accordés, en fr et en en', () => {
  const cles = [
    'eventDetectionSlots.positionsCount',
    'eventDetectionSlots.placesCount',
    'eventDetectionSlots.openCount',
    'eventDetectionSlots.candidatesCount',
    'eventDetectionSlots.requestsCount',
    'eventDetectionSlots.validatedCount',
    'eventTasksSection.placesLeft',
    'eventTasksEditor.placesCount',
    'eventTeamAudiencesEditor.selectedMembers',
    'eventTeamAudiencesSection.selectedMembers',
    'eventDetails.tournamentTeamMembers',
  ];
  cles.forEach((cle) => {
    [fr, en].forEach((dict) => {
      expect(typeof valeur(dict, `${cle}_one`)).toBe('string');
      expect(typeof valeur(dict, `${cle}_other`)).toBe('string');
    });
  });
  expect(valeur(fr, 'eventDetectionSlots.positionsCount_other')).toBe('{{count}} postes');
});

test('🔴 aucun « (s) » écrit en dur dans les écrans d’événements corrigés', () => {
  const ecrans = [
    'views/event/components/EventDetectionSlots.js',
    'views/event/components/EventTasksSection.js',
    'views/event/components/EventTasksEditor.js',
    'views/event/components/EventTeamAudiencesEditor.js',
    'views/event/components/EventTeamAudiencesSection.js',
    'views/event/EventDetails.js',
    'views/event/EventDetails.web.js',
  ];
  const fautes = ecrans.flatMap((fichier) => {
    const source = fs.readFileSync(path.join(__dirname, '..', '..', '..', fichier), 'utf8');
    return [...source.matchAll(/`[^`]*\$\{[^`]*\((s|es)\)[^`]*`|['"] ?place\(s\)|\bwarning\(s\)/g)]
      .map((trouve) => `${fichier}: ${trouve[0].slice(0, 60)}`);
  });
  expect(fautes).toEqual([]);
});
