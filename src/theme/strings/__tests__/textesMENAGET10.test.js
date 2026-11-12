import fs from 'fs';
import path from 'path';

import en from '@/theme/strings/translations/en';
import fr from '@/theme/strings/translations/fr';

// MENAGE-T10 (12/11) — code mort et textes sans lecteur, retirés sans rien changer à l'écran :
// D60 `searchClubsScreen.*` (SearchClubsScreen retiré par ORPHELINS-RECHERCHE) ; D62 le plafond
// « Réservations à venir par personne » (retiré de l'écran par COMPLEXE-TERRAINS, décision d'Adel
// du 10/11) ; la prop `dejaInscrit` de TrainerInvitedModal (plus aucun appelant depuis
// INVITE-STAFF) et ses deux textes. ROUGE avant le ménage.

const valeur = (dict, cle) => cle.split('.').reduce((o, p) => (o == null ? o : o[p]), dict);

test.each([
  ['searchClubsScreen'],
  ['complexeGerant.reglages.aVenir'],
  ['complexeGerant.reglages.aVenirAide'],
  ['addCoach.alerts.invitation.title'],
  ['addCoach.alerts.invitation.description'],
])('🔴 %s : retiré en fr et en en', (cle) => {
  expect(valeur(fr, cle)).toBeUndefined();
  expect(valeur(en, cle)).toBeUndefined();
});

test('🟢 le texte encore lu de addCoach.alerts.invitation reste (CreateSectionScreen)', () => {
  expect(valeur(fr, 'addCoach.alerts.invitation.actions.send')).toBeTruthy();
  expect(valeur(en, 'addCoach.alerts.invitation.actions.send')).toBeTruthy();
});

test('🔴 TrainerInvitedModal ne connaît plus la prop dejaInscrit', () => {
  const fichier = 'components/organisms/trainerInvitedModal/TrainerInvitedModal.js';
  const source = fs.readFileSync(path.join(__dirname, '..', '..', '..', fichier), 'utf8');
  expect(source).not.toMatch(/dejaInscrit/);
});
