import en from '@/theme/strings/translations/en';
import fr from '@/theme/strings/translations/fr';

// « Ton relance » : relance est féminin. Valeur seulement, aucune clef renommée.

describe('RELANCE — titre de eventDetails.modals.remindSuccess', () => {
  test('ROUGE-AVANT — français accordé, anglais inchangé', () => {
    expect(fr.eventDetails.modals.remindSuccess.title).toBe('Ta relance a bien été envoyée');
    expect(en.eventDetails.modals.remindSuccess.title).toBe('Your reminder has been sent');
  });
});
