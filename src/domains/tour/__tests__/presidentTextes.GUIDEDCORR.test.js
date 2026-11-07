import fr from '@/theme/strings/translations/fr';

import { PRESIDENT_GUIDE } from '@/domains/tour/presidentGuide';

// GUIDE-D-CORR (tournée du 07/11) : une bulle ne nomme que ce qui est à l'écran, et ne dit que ce
// qui est vrai. TG-09 (« Placer sur la carte » absent), TG-11 (« Suivant » au lieu de
// « Démarrer »), TG-13 (règle du canal fausse, bonus compté fait).

const texte = (id) => fr.tourCatalog.president[id];
const step = (id) => PRESIDENT_GUIDE.steps.find((one) => one.id === id);

describe('les bulles nomment ce qui est à l’écran', () => {
  it('TG-09 m1-addr : pas de « Placer sur la carte »', () => {
    expect(texte('m1-addr')).not.toContain('Placer sur la carte');
    expect(step('m1-addr').text).not.toContain('Placer sur la carte');
  });

  it('TG-11 b3-sel : le bouton d’un membre est « Démarrer », celui d’un groupe « Suivant »', () => {
    expect(texte('b3-sel')).toContain(`« ${fr.newConversation.cta.start} »`);
    expect(texte('b3-sel')).toContain(`« ${fr.newConversation.cta.next} »`);
  });

  it('TG-13 b2-none : la règle dite est celle de l’app, et le bonus est PASSÉ, pas fait', () => {
    expect(texte('b2-none')).not.toContain('2 membres');
    expect(texte('b2-none')).toContain(`« ${fr.clubDetails.actions.contactTrainers} »`);
    expect(step('b2-none').skipsMission).toBe(true);
    expect(step('b2-none').completesMission).toBeFalsy();
  });
});
