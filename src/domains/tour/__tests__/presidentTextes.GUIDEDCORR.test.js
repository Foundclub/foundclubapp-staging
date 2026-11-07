import { PRESIDENT_GUIDE } from '@/domains/tour/presidentGuide';
import fr from '@/theme/strings/translations/fr';

// GUIDE-D-CORR (tournée du 07/11) : une bulle ne nomme que ce qui est à l'écran, et ne dit que ce
// qui est vrai. TG-09 (« Placer sur la carte » absent), TG-11 (« Suivant » au lieu de
// « Démarrer »), TG-13 (règle du canal fausse, bonus compté fait), TG-17 à TG-20 et TG-23.

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

describe('les textes disent ce qui se passe vraiment', () => {
  it('TG-17 m1-pcap : pas de « places encore libres » sur un planning rempli d’exemples', () => {
    expect(texte('m1-pcap')).not.toContain('places encore libres');
    expect(step('m1-pdemo').hintWhenCut).toBe(true);
  });

  it('TG-18 affiche : rien ne promet la liste d’applications, ni de partager sous le voile', () => {
    expect(fr.showcase.saveHint).not.toContain('application');
    expect(texte('m1-pclose')).not.toContain('partager');
  });

  it('TG-19 bonus 1 : l’exemple est dit exemple, rien n’est créé', () => {
    expect(texte('b1-open')).toContain('rien n’est créé');
    expect(texte('b1-camp')).toMatch(/^Exemple/);
  });

  it('TG-20 fin de M3 : rubrique affichée, en-tête de M3, invitation par SMS', () => {
    expect(texte('m3-ok')).toContain(`« ${fr.teamListContent.sections.otherInClub} »`);
    expect(step('m3-ok').missionId).toBe('president_m3');
    expect(fr.teamWizard.steps.trainers.createHint).toContain('SMS');
  });

  it('TG-23 : bilan sans « rien n’a été envoyé » ; SMS court qui nomme le club', () => {
    expect(fr.tourCatalog.president.close.example).not.toContain('envoyé');
    const sms = fr.clubDetails.alerts.inviteTrainer.message;
    expect(sms).toContain('{{clubName}}');
    expect(sms.length).toBeLessThan(140);
  });
});
