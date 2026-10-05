import { readFileSync } from 'fs';
import { join } from 'path';

import i18n from '@/theme/strings';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';

// 🎨 FINITIONS15 point 9a (tournée T14) — « ENTRAÎNEMENT PRIVÉ », AVEC SON ACCENT.
//
// Relevé dans le récapitulatif de l'assistant : « Capacité illimitée (entraînement prive) ». La
// clef du récap (`eventWizard.recap.trainingCapacityPrivate`) n'existe pas : c'est le texte de
// secours du code qui s'affiche. Les deux clefs sœurs (fiche de l'événement, étape Participants)
// avaient la même graphie, comme le commentaire d'un retour au joueur.
//
// Chaque clef est RENDUE par le vrai i18next ; les textes de secours du code sont balayés : un
// écran dont la clef manque ne doit pas ressortir l'ancienne graphie. ROUGE avant le lot.

const RACINE_SRC = join(__dirname, '..', '..', '..');
const ECRANS = [
  'views/event/EventDetails.web.js',
  'views/event/wizard/EventWizardParticipants.js',
  'views/event/wizard/EventWizardRecap.js',
];

describe('FINITIONS15 point 9a — « privé » porte son accent', () => {
  test.each([
    ['eventDetails.privateTraining', 'Entraînement privé'],
    ['eventWizard.steps.participants.trainingPrivateCapacity', 'Illimité (entraînement privé)'],
    ['eventWizard.recap.trainingCapacityPrivate', 'Capacité illimitée (entraînement privé)'],
  ])('🚨 %s', async (clef, attendu) => {
    await i18n.changeLanguage('fr');
    expect(i18n.t(clef, SANS_ECHAPPEMENT)).toBe(attendu);
  });

  test.each(ECRANS)('🚨 %s ne garde aucun « prive » en dur', (fichier) => {
    const source = readFileSync(join(RACINE_SRC, fichier), 'utf8');

    expect(source).not.toMatch(/ntraînement prive\b/);
  });
});
