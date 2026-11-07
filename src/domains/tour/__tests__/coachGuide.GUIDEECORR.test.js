import { COACH_GUIDE } from '@/domains/tour/coachGuide';
import { indexOfStep, matchSignal, nextAvailableIndex } from '@/domains/tour/tourGuideEngine';
import { RouteNames } from '@/navigation/routeNames';

// GUIDE-E-CORR (tournée du 07/11, TG-14 et TG-15) : le guide Entraîneur validait la mission 2
// sans envoi, et la mission « Proposer un match amical » commençait par les profils.

const step = (id) => COACH_GUIDE.steps.find((candidate) => candidate.id === id);
const at = (id) => indexOfStep(COACH_GUIDE, id);
const signal = (fromId, kind, key) => matchSignal(COACH_GUIDE, at(fromId), { key, kind }, {});
const idOf = (match) => COACH_GUIDE.steps[match?.index]?.id;

describe('TG-15 — la mission 4 commence par le match amical', () => {
  const first = () => COACH_GUIDE.steps[nextAvailableIndex(COACH_GUIDE, at('m4-back'), {})];

  it('la 1re bulle après l accueil montre la carte « Matchs amicaux », pas « Profils »', () => {
    expect(first().missionId).toBe('coach_m4');
    expect(first().targets).toEqual(['home.card.search-amicaux']);
    expect(first().text).toMatch(/match amical/i);
    expect(first().text).not.toMatch(/profil/i);
  });

  it('la carte ouvre « Matchs amicaux » : la bulle suivante est « crée ton annonce »', () => {
    const match = signal(first().id, 'route', RouteNames.SearchHub);
    expect(idOf(match)).toBe('m4-frc');
  });

  it('aucune bulle de la mission 4 ne parle des profils ni des onglets Événement / Club', () => {
    const texts = COACH_GUIDE.steps
      .filter((one) => one.missionId === 'coach_m4' && !String(one.id).startsWith('rv-'))
      .map((one) => one.text);
    texts.forEach((text) => {
      expect(text).not.toMatch(/profils|Ouvre l’onglet Événement|Ouvre maintenant « Club »/);
    });
  });
});

describe('TG-14 — « C’est envoyé » ne valide pas un partage refermé', () => {
  it('feuille ouverte (m2-pick) : pas de « C’est envoyé », et le bouton ne valide pas', () => {
    expect(step('m2-pick').nextLabel).not.toMatch(/envoy/i);
    expect(step('m2-pick').completesMission).toBeFalsy();
  });

  it('le bouton de m2-pick mène à la question honnête, sans valider', () => {
    const next = COACH_GUIDE.steps[nextAvailableIndex(COACH_GUIDE, at('m2-pick'), {})];
    expect(next.id).toBe('m2-sent');
    expect(next.text).toMatch(/^Tu l’as envoyé \?/);
  });

  it('envoi certain (iPhone « partagé », site) : M2 validée', () => {
    const match = signal('m2-pick', 'action', 'team.invite.shared');
    expect(match.completes).toBe(true);
    expect(idOf(match)).toBe('m3-dock');
  });

  it('partage annulé (la plateforme le dit) : bulle sans bouton qui valide', () => {
    const match = signal('m2-pick', 'interaction', 'team.invite.dismissed');
    expect(match.completes).toBe(false);
    const cancelled = COACH_GUIDE.steps[match.index];
    expect(cancelled.nextLabel).toBeFalsy();
    expect(cancelled.completesMission).toBeFalsy();
    expect(cancelled.text).toMatch(/rien n’est parti/i);
    expect(cancelled.targets).toEqual(['team.more']);
  });

  it('annulé, puis le menu rouvert : retour au partage', () => {
    const cancelled = idOf(signal('m2-pick', 'interaction', 'team.invite.dismissed'));
    expect(idOf(signal(cancelled, 'interaction', 'team.actions.open'))).toBe('m2-share');
  });

  it('résultat inconnu (Android, SMS) : la bulle demande « Tu l’as envoyé ? »', () => {
    const match = signal('m2-pick', 'interaction', 'team.invite.returned');
    expect(match.completes).toBe(false);
    expect(idOf(match)).toBe('m2-sent');
    expect(step('m2-sent').text).toMatch(/^Tu l’as envoyé \?/);
    expect(step('m2-sent').nextLabel).toMatch(/^Oui/);
  });
});
