import fs from 'fs';
import path from 'path';

import en from '@/theme/strings/translations/en';
import fr from '@/theme/strings/translations/fr';

// FIN-TEXTES (02/11) — les restes vus par les contre-recettes de la reprise : « 0 roster » et
// « Warning roster » écrits en dur sur les cartes d'équipe de la fiche du tournoi, et
// « Installation: » / « Vainqueur: » sans l'espace français, écrits en dur eux aussi.

const valeur = (dict, cle) => cle.split('.').reduce((o, p) => (o == null ? o : o[p]), dict);
const source = (fichier) => fs.readFileSync(
  path.join(__dirname, '..', '..', '..', fichier),
  'utf8',
);

test.each([
  ['views/event/EventDetails.web.js'],
  ['views/event/EventDetails.js'],
])('🔴 %s : plus de « roster » écrit en dur à l’écran', (fichier) => {
  const code = source(fichier);
  expect(code).not.toMatch(/Warning roster/);
  // Un mot seul sur sa ligne, c'est du texte JSX.
  expect(code).not.toMatch(/^\s*roster\s*$/m);
});

test.each([
  ['views/event/TournamentMatchDetails.js'],
  ['views/event/tournamentCompetitionComponents.js'],
])('🔴 %s : plus de « Installation: » ni de « Vainqueur: » écrits en dur', (fichier) => {
  expect(source(fichier)).not.toMatch(/`(Installation|Vainqueur): /);
});

test.each([
  ['tournamentMatchDetails.facilityLine', 'Installation : {{name}}', 'Facility: {{name}}'],
  ['tournamentMatchDetails.winnerLine', 'Vainqueur : {{name}}', 'Winner: {{name}}'],
  ['tournamentManagement.competition', 'Compétition', 'Competition'],
  ['bookingCalendar.web.errors.refused',
    'Ton compte ne peut pas réserver cette installation pour l’instant : rien n’a été réservé.',
    'Your account can’t book this facility for now: nothing has been booked.'],
])('🔴 %s existe en français et en anglais', (cle, attenduFr, attenduEn) => {
  expect(valeur(fr, cle)).toBe(attenduFr);
  expect(valeur(en, cle)).toBe(attenduEn);
});
