import { PRESIDENT_GUIDE_SETTINGS } from '@/domains/tour/presidentGuideSettings';
import { M2M3_MISSIONS, M2M3_STEPS } from '@/domains/tour/presidentM2M3';
import { M4_MISSIONS, M4_STEPS } from '@/domains/tour/presidentM4';
import { exampleMembershipRequest, isExampleRequest } from '@/domains/tour/tourExamples';
import {
  indexOfStep,
  isStepAvailable,
  matchSignal,
  nextAvailableIndex,
} from '@/domains/tour/tourGuideEngine';

import { RouteNames } from '@/navigation/routeNames';

// Guide Dirigeant·e, M2, M3 et M4 (lots L4 et L5, 05/11) : ce que dit le code, pas le pack.

const profile = {
  missions: [...M2M3_MISSIONS, ...M4_MISSIONS],
  steps: [...M2M3_STEPS, ...M4_STEPS],
};
const withPlan = { created: {}, flags: { hasClubPlan: true } };
const withoutPlan = { created: {}, flags: { hasClubPlan: false } };
const at = (id) => indexOfStep(profile, id);
const idAt = (index) => profile.steps[index]?.id;
const step = (id) => profile.steps[at(id)];
const played = (ctx) => profile.steps.filter((one) => isStepAvailable(one, ctx))
  .map((one) => one.id);
const send = (id, signal, ctx = withPlan) => matchSignal(profile, at(id), signal, ctx);
const missionOf = (id) => profile.missions.find((mission) => mission.id === id);

describe('M2 : inviter un coach', () => {
  it('avec l offre Club, le parcours réel, dans l ordre de l app', () => {
    expect(played(withPlan).slice(0, 7)).toEqual([
      'm2-staff', 'm2-add', 'm2-role', 'm2-fields', 'm2-send', 'm2-invite', 'm2-sms',
    ]);
  });

  it('Staff : seule la rangée Staff ouvre la suite, pas une autre sous-page de la fiche', () => {
    expect(idAt(send('m2-staff', { key: 'club.section.staff', kind: 'interaction' }).index))
      .toBe('m2-add');
    expect(send('m2-staff', { key: 'club.section.teams', kind: 'interaction' }))
      .toBeNull();
  });

  it('l envoi fait hors de son étape mène quand même à la feuille d invitation', () => {
    ['m2-role', 'm2-fields'].forEach((id) => {
      expect(idAt(send(id, { key: 'staff.invited', kind: 'action' }).index)).toBe('m2-invite');
    });
  });

  it('le retour Android quitte le formulaire : la bulle revient sur le +', () => {
    ['m2-role', 'm2-fields', 'm2-send'].forEach((id) => {
      expect(idAt(send(id, { key: RouteNames.Club, kind: 'route' }).index)).toBe('m2-add');
    });
  });

  it('le numéro requis se juge au bouton de la bulle', () => {
    expect(step('m2-fields').nextRequires.field).toBe('cf.phone');
    expect(step('m2-fields').nextRequires.message()).toMatch(/numéro/);
    expect(step('m2-fields').veil).toBe(false);
  });

  it('la phrase dit la vérité : un compte créé, et le SMS est à envoyer soi-même', () => {
    expect(step('m2-fields').text).toMatch(/compte/);
    expect(step('m2-fields').text).toMatch(/SMS/);
    expect(step('m2-fields').text).not.toMatch(/recevra/);
  });

  it('« Inviter » puis retour : M2 validée, avec un bouton si le téléphone ne dit rien', () => {
    expect(idAt(send('m2-invite', { key: 'staff.sms.opened', kind: 'interaction' }).index))
      .toBe('m2-sms');
    expect(send('m2-sms', { key: 'app.returned', kind: 'interaction' }).completes).toBe(true);
    expect(step('m2-sms').nextLabel).toBe('C’est envoyé');
    expect(step('m2-sms').completesMission).toBe(true);
    expect(step('m2-sms').veil).toBe(false);
  });

  it('« Plus tard » et le numéro rattaché valident M2, sans attendre de SMS', () => {
    const invited = { ...withPlan, created: { 'staff.invited': {} } };
    const later = send('m2-invite', { key: 'staff.invite.later', kind: 'interaction' }, invited);
    expect(later.completes).toBe(true);
    expect(idAt(later.index)).toBe('m2-back');
    const linked = send('m2-send', { key: 'staff.linked', kind: 'action' });
    expect(linked.completes).toBe(true);
    expect(idAt(linked.index)).toBe('m2-back');
  });

  it('un compte déjà créé ne se recrée pas à la reprise', () => {
    const invited = { ...withPlan, created: { 'staff.invited': {} } };
    expect(played(invited)).not.toContain('m2-send');
    expect(step('m2-invite').resumeFrom).toBe('m2-sms');
    expect(isStepAvailable(step('m2-sms'), invited)).toBe(true);
  });

  it('passable avant la création du compte, plus après', () => {
    ['m2-staff', 'm2-add', 'm2-role', 'm2-fields', 'm2-send'].forEach((id) => {
      expect(step(id).passable).toBe(PRESIDENT_GUIDE_SETTINGS.coachPassable);
      expect(step(id).subMission).toBe('coach');
    });
    ['m2-invite', 'm2-sms'].forEach((id) => {
      expect(step(id).passable).toBeFalsy();
      expect(step(id).subMission).toBe('coach');
    });
  });

  it('sans droit ouvert, une visite : on montre où, rien ne se crée', () => {
    const ids = played(withoutPlan);
    expect(ids).toEqual(expect.arrayContaining(['m2-visit', 'm2-visit-add']));
    ['m2-staff', 'm2-add', 'm2-role', 'm2-fields', 'm2-send', 'm2-invite', 'm2-sms']
      .forEach((id) => expect(ids).not.toContain(id));
    expect(step('m2-visit-add').completesMission).toBe(true);
    expect(step('m2-visit-add').nextLabel).toBeTruthy();
  });

  it('un refus de l offre en route a sa raison, la mission a une issue', () => {
    expect(missionOf('president_m2').refusals['paywall.club-roles-manage-required'])
      .toMatch(/offre Club/);
    expect(missionOf('president_m2').refusals['paywall.club-licensee-limit']).toBeTruthy();
  });
});

describe('M3 : créer une équipe', () => {
  it('le retour se fait depuis Staff : une étape en plus, si M2 y a laissé', () => {
    expect(step('m2-back').missionId).toBe('president_m3');
    expect(step('m2-back').targets).toEqual(['header.back']);
    // GUIDE-D-CORR TG-16 : le bord gauche reste libre (geste du retour), le reste sous le voile.
    expect(step('m2-back').edgeSwipe).toBe(true);
    expect(idAt(send('m2-back', { key: 'club.section.closed', kind: 'interaction' }).index))
      .toBe('m3-teams');
    const backWith = (created) => isStepAvailable(step('m2-back'), { created, flags: {} });
    expect(backWith({ 'staff.invited': {} })).toBe(true);
    expect(backWith({ 'staff.linked': {} })).toBe(true);
    expect(backWith({})).toBe(false);
  });

  it('m3-teams : rangée absente de l écran, le chemin du retour', () => {
    expect(step('m3-teams').fallback.targets).toEqual(['header.back']);
    expect(idAt(send('m3-teams', { key: 'club.section.teams', kind: 'interaction' }).index))
      .toBe('m3-create');
    // L'autre porte du tunnel (carte des résultats de la fiche).
    expect(idAt(send('m3-teams', { key: RouteNames.TeamWizardName, kind: 'route' }).index))
      .toBe('tw1');
  });

  it('le tunnel commun, sous cette mission, validé au succès serveur', () => {
    expect(played(withPlan)).toEqual(expect.arrayContaining(
      ['tw1', 'tw2', 'tw3', 'tw4', 'tw5', 'tw6', 'tw7', 'tw8'],
    ));
    ['tw1', 'tw7', 'tw8'].forEach((id) => expect(step(id).missionId).toBe('president_m3'));
    expect(send('tw8', { key: 'team.created', kind: 'action' }).completes).toBe(true);
    expect(step('tw8').listScrolls).toBe(true);
  });

  it('tw7 : vrai avec ou sans coach ajouté à M2', () => {
    expect(step('tw7').text).toMatch(/toi/);
    expect(step('tw7').text).toMatch(/coach/);
  });

  it('une équipe refusée par le quota se dit, et se passe', () => {
    expect(missionOf('president_m3').refusals['paywall.team-limit']).toBeTruthy();
    expect(missionOf('president_m3').refusals['paywall.club-tier-team-limit']).toBeTruthy();
  });
});

describe('M4 : la demande d exemple', () => {
  const afterTeam = { created: { 'team.created': {} }, flags: {} };

  it('après l équipe : la bulle de M3, puis l accueil depuis Mes équipes', () => {
    expect(played(afterTeam).slice(-6)).toEqual(
      ['m3-ok', 'm4-back1', 'm4-card', 'm4-filter', 'm4-card2', 'm4-accept'],
    );
    expect(step('m4-back1').navigateOnEnter).toBeFalsy();
    expect(step('m4-back1').targets).toEqual(['dock.home']);
  });

  it('sans équipe créée, pas de bulle sur elle, et le guide ramène à l accueil', () => {
    const ids = played({ created: {}, flags: {} });
    expect(ids).not.toContain('m3-ok');
    expect(ids).not.toContain('m4-back1');
    expect(ids).toContain('m4-home');
    expect(step('m4-home').navigateOnEnter).toBe(true);
  });

  it('l exemple n existe que le temps des 3 étapes, porté par l étape et pas par la route', () => {
    ['m4-filter', 'm4-card2', 'm4-accept'].forEach((id) => {
      expect(step(id).tourExample).toBe('membershipRequest');
      expect(step(id).resumeFrom).toBe('m4-card');
    });
    expect(step('m4-card').tourExample).toBeUndefined();
  });

  it('le filtre Club puis l acceptation d exemple valident au geste', () => {
    const filter = { key: 'requests.filter.club', kind: 'interaction' };
    const filtered = send('m4-filter', filter, afterTeam);
    expect(idAt(filtered.index)).toBe('m4-card2');
    const accepted = send(
      'm4-accept',
      { key: 'membershipRequest.accepted.example', kind: 'interaction' },
      afterTeam,
    );
    expect(accepted.completes).toBe(true);
    expect(accepted.index).toBe(nextAvailableIndex(profile, at('m4-accept'), afterTeam));
  });

  it('la phrase corrigée : un coach que tu ajoutes est déjà membre', () => {
    expect(step('m4-card2').text).toMatch(/FAUSSE/);
    expect(step('m4-card2').text).toMatch(/déjà membre/);
    expect(step('m4-card2').text).not.toMatch(/quand ils installeront/);
  });

  it('aucun bouton absent de l écran : la bulle ne fait pas toucher « Voir le profil »', () => {
    expect(step('m4-accept').text).not.toMatch(/touche « Voir le profil »/);
    expect(step('m4-accept').text).toMatch(/Accepter/);
  });

  it('la demande d exemple : une carte de type club, marquée, sans identifiant serveur', () => {
    const item = exampleMembershipRequest();
    expect(item.id).toBe('tour-example-request');
    expect(item.type).toBe('club');
    expect(item.meta.requestId).toBe('');
    expect(item.meta.requesterId).toBe('');
    expect(item.actions).toEqual({ primary: 'accept', secondary: 'reject' });
    expect(item.title).toMatch(/exemple/);
    expect(item.meta.requesterName).toBe('Karim Benali');
    expect(isExampleRequest(item)).toBe(true);
    expect(isExampleRequest({ id: 'club:1', meta: {} })).toBe(false);
  });

  it('même prénom que le coach de M2, quelle que soit la casse : prénom de repli', () => {
    const nameWith = (coachFirstName) => exampleMembershipRequest({ coachFirstName })
      .meta.requesterName;
    expect(nameWith(' karim ')).toBe('Sami Benali');
    expect(nameWith('Julie')).toBe('Karim Benali');
  });
});

describe('Les textes et la reprise', () => {
  it('chaque étape dit son texte en français, au moment de la lire', () => {
    profile.steps.forEach((one) => {
      expect(typeof one.text).toBe('string');
      expect(one.text.length).toBeGreaterThan(5);
      expect(one.text).not.toMatch(/undefined/);
    });
  });

  it('un id par étape, sinon la reprise se trompe', () => {
    const ids = profile.steps.map((one) => one.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('chaque étape sait où reprendre', () => {
    profile.steps.forEach((one) => {
      expect(Boolean(one.resumeFrom || one.navTarget)).toBe(true);
    });
  });

  it('aucune bulle ne se pose sur une alerte ou une fenêtre native', () => {
    profile.steps.forEach((one) => {
      expect(one.targets || []).not.toContain('alert-ok');
    });
    expect(profile.steps.map((one) => one.id)).not.toContain('m4-super');
  });
});
