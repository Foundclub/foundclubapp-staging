import fs from 'node:fs';
import path from 'node:path';

import fr from '@/theme/strings/translations/fr';

// T4-PARENT-RETOURS (04/11/2026, Q3 = B d'Adel, M0094) — le parent garde ses deux boutons sur la
// fiche d'un club, et chacun dit pour qui part l'intérêt. Seul avec lui-même, un bouton n'a rien à
// distinguer : les libellés d'avant restent.
const ecran = fs.readFileSync(path.join(__dirname, '..', 'ClubDetails.js'), 'utf8');

test('les deux textes disent pour qui', () => {
  expect(fr.clubDetails.clubInterest.buttonForMe).toBe('Pour moi : intéressé par le club');
  expect(fr.clubDetails.clubInterest.alreadySentForMe).toBe('Pour moi : intérêt déjà envoyé');
  expect(fr.clubDetails.actions.askPlaceForMyChild).toBe('Pour mon enfant : une place');
});

test('le libellé dépend de la présence des DEUX portes', () => {
  expect(ecran).toContain('const deuxPortes = showClubInterestAction && showChildInterestAction;');
  expect(ecran).toMatch(/deuxPortes\s*\? t\('clubDetails\.clubInterest\.buttonForMe'/);
  expect(ecran).toMatch(/deuxPortes\s*\? t\('clubDetails\.clubInterest\.alreadySentForMe'/);
  expect(ecran).toMatch(/deuxPortes\s*\? t\('clubDetails\.actions\.askPlaceForMyChild'/);
});
