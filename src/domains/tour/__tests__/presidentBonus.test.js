import { PRESIDENT_GUIDE } from '@/domains/tour/presidentGuide';
import {
  indexOfStep,
  isStepAvailable,
  matchSignal,
} from '@/domains/tour/tourGuideEngine';

import { RouteNames } from '@/navigation/routeNames';

// Guide Dirigeant·e, les bonus (lots L6 à L9, 05/11) : ce que dit le code, pas le pack.

const profile = PRESIDENT_GUIDE;
const ctx = { created: {}, flags: {} };
const at = (id) => indexOfStep(profile, id);
const idAt = (index) => profile.steps[index]?.id;
const step = (id) => profile.steps[at(id)];
const send = (id, signal) => matchSignal(profile, at(id), signal, ctx);
const stepsOf = (missionId) => profile.steps.filter((one) => one.missionId === missionId);
const playedOf = (missionId) => stepsOf(missionId)
  .filter((one) => isStepAvailable(one, ctx))
  .map((one) => one.id);

describe('tous les bonus', () => {
  it('sont entre le palier et la clôture, passables, sans jauge', () => {
    const ids = profile.steps.map((one) => one.id);
    profile.missions.filter((mission) => !mission.locked).forEach((mission) => {
      expect(mission.gaugeStep).toBe(0);
      expect(mission.estimatedSeconds).toBeGreaterThan(0);
      const steps = stepsOf(mission.id);
      expect(steps.length).toBeGreaterThan(0);
      steps.forEach((one) => {
        expect(ids.indexOf(one.id)).toBeGreaterThan(ids.indexOf('palier'));
        expect(ids.indexOf(one.id)).toBeLessThan(ids.indexOf('close'));
        expect(typeof one.text).toBe('string');
        expect(one.text).not.toMatch(/undefined/);
        expect(Boolean(one.resumeFrom || one.navTarget)).toBe(true);
        expect(one.targets || []).not.toContain('alert-ok');
      });
      // Une sortie pour finir : un bouton, un signal, ou un aiguillage qui valide.
      expect(steps.some((one) => one.completesMission)).toBe(true);
    });
  });

  it('un id par étape, et le menu Mon compte sait où commencent les bonus', () => {
    const ids = profile.steps.map((one) => one.id);
    expect(new Set(ids).size).toBe(ids.length);
    const first = profile.missions.find((mission) => !mission.locked);
    expect(profile.bonusFromMission).toBe(first.id);
  });

  it('chaque bonus commence par montrer le chemin depuis un écran connu', () => {
    profile.missions.filter((mission) => !mission.locked).forEach((mission) => {
      const first = stepsOf(mission.id).find((one) => isStepAvailable(one, ctx));
      expect(first.navigateOnEnter).toBe(true);
    });
  });
});

describe('B2 : le canal du club', () => {
  it('le chemin, le canal, puis la vérité : toi tu écris, eux lisent', () => {
    expect(playedOf('president_b2')).toEqual(['b2-dock', 'b2-canal', 'b2-info', 'b2-foot']);
    expect(step('b2-dock').targets).toEqual(['dock.messages']);
    expect(idAt(send('b2-dock', { key: RouteNames.Chat, kind: 'route' }).index)).toBe('b2-canal');
    expect(idAt(send('b2-canal', { key: RouteNames.Conversation, kind: 'route' }).index))
      .toBe('b2-info');
    expect(step('b2-foot').text).toMatch(/toi tu écris, eux lisent/i);
    expect(step('b2-foot').text).not.toMatch(/lecture seule/i);
    expect(step('b2-foot').completesMission).toBe(true);
  });

  // GUIDE-D-CORR TG-13 : la règle dite est celle de l'app, et le bonus est PASSÉ, pas fait.
  it('pas de canal : la bulle dit comment il naît, avec une sortie', () => {
    expect(step('b2-canal').checksCanal).toBe(true);
    expect(idAt(send('b2-canal', { key: 'messaging.canal.absent', kind: 'interaction' }).index))
      .toBe('b2-none');
    expect(step('b2-none').nextLabel).toBeTruthy();
    expect(step('b2-none').skipsMission).toBe(true);
    expect(step('b2-none').text).toMatch(/Contacter les entraîneur/);
    expect(step('b2-none').veil).toBe(false);
  });
});

describe('B3 : créer un groupe', () => {
  it('le parcours réel, validé à la création', () => {
    expect(playedOf('president_b3'))
      .toEqual(['b3-back', 'b3-new', 'b3-sel', 'b3-name', 'b3-create']);
    expect(idAt(send('b3-new', { key: RouteNames.NewConversation, kind: 'route' }).index))
      .toBe('b3-sel');
    expect(idAt(send('b3-sel', { key: 'conversation.step.name', kind: 'interaction' }).index))
      .toBe('b3-name');
    expect(send('b3-create', { key: 'conversation.group.created', kind: 'action' }).completes)
      .toBe(true);
  });

  it('le retour : ailleurs que sur le canal, l étape passe toute seule', () => {
    expect(idAt(send('b3-back', { key: RouteNames.Chat, kind: 'route' }).index)).toBe('b3-new');
    expect(send('b3-back', { key: RouteNames.Conversation, kind: 'route' })).toBeNull();
    // GUIDE-D-CORR TG-16 : le bord gauche reste libre (geste du retour), le reste sous le voile.
    expect(step('b3-back').edgeSwipe).toBe(true);
  });

  it('moins de 2 membres : une visite, sans rien créer et sans cul-de-sac', () => {
    expect(step('b3-sel').checksMembers).toBe(true);
    expect(idAt(send('b3-sel', { key: 'conversation.members.few', kind: 'interaction' }).index))
      .toBe('b3-few');
    // GUIDE-D-CORR-2 : rien n'est créé, le bonus est PASSÉ (plus compté comme fait).
    expect(step('b3-few').skipsMission).toBe(true);
    expect(step('b3-few').nextLabel).toBeTruthy();
    expect(step('b3-few').advanceOn).toBeUndefined();
  });

  it('une seule personne cochée : discussion à deux, dite, et le bonus finit', () => {
    expect(idAt(send('b3-sel', { key: RouteNames.Conversation, kind: 'route' }).index))
      .toBe('b3-whisper');
    expect(step('b3-whisper').completesMission).toBe(true);
    expect(step('b3-whisper').nextLabel).toBeTruthy();
  });

  it('la fenêtre des autorisations n a pas de cadre : la bulle la raconte avant', () => {
    expect(step('b3-name').targets).toEqual(['grp-name', 'grp-perms']);
    expect(step('b3-name').text).toMatch(/Autorisations/);
    ['perms-write', 'perms-back'].forEach((target) => {
      profile.steps.forEach((one) => expect(one.targets || []).not.toContain(target));
    });
  });
});

describe('B5 : rechercher', () => {
  it('une bulle par case présente, Réservations comprise', () => {
    expect(playedOf('president_b5'))
      .toEqual(['b5-back', 'b5-ev', 'b5-cl', 'b5-re', 'b5-pr', 'b5-fr']);
    [
      ['b5-ev', 'search-events'],
      ['b5-cl', 'search-clubs'],
      ['b5-re', 'search-reservations'],
      ['b5-pr', 'search-profiles'],
      ['b5-fr', 'search-amicaux'],
    ].forEach(([id, card]) => {
      expect(step(id).targets).toEqual([`home.card.${card}`]);
      expect(step(id).nextLabel).toBeTruthy();
    });
    expect(step('b5-fr').completesMission).toBe(true);
    expect(step('b5-re').when).toEqual(expect.any(Function));
  });
});

describe('B4 : recruter, rien n est publié', () => {
  it('le chemin, puis le tunnel de l app, Validation comprise', () => {
    expect(playedOf('president_b4')).toEqual(
      ['b4-dock', 'b4-card', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'b4-cand'],
    );
    expect(step('b4-card').targets).toEqual(['home.card.manage-add-ad']);
    expect(idAt(send('a5', { key: RouteNames.AdWizardValidation, kind: 'route' }).index))
      .toBe('a5v');
    expect(idAt(send('a5', { key: RouteNames.AdWizardDescription, kind: 'route' }).index))
      .toBe('a6');
    expect(idAt(send('a5v', { key: RouteNames.AdWizardDescription, kind: 'route' }).index))
      .toBe('a6');
  });

  it('coach ou sport sans postes : les routes de l app, pas celles du pack', () => {
    expect(idAt(send('a2', { key: RouteNames.AdWizardCoachProfile, kind: 'route' }).index))
      .toBe('a3c');
    expect(idAt(send('a2', { key: RouteNames.AdWizardInfo, kind: 'route' }).index)).toBe('a4');
    expect(idAt(send('a3c', { key: RouteNames.AdWizardInfo, kind: 'route' }).index)).toBe('a4');
  });

  it('« Ailier gauche » est dit comme un exemple du foot, pas comme un poste de tout sport', () => {
    expect(step('a3').text).toMatch(/au foot/);
  });

  it('chaque étape désarme la publication, tout le bonus durant', () => {
    stepsOf('president_b4').forEach((one) => expect(one.simulatesAd).toBe(true));
    expect(step('a7').bubbleSlot).toBe(true);
    expect(step('a7').listScrolls).toBe(true);
  });

  it('arrêt au récap, puis une bulle (décision 8, un seul réglage)', () => {
    expect(idAt(send('a7', { key: 'ad.publish.example', kind: 'interaction' }).index))
      .toBe('b4-cand');
    // Décision « 80- B » : l'annonce d'exemple EN LIGNE, à lire, puis « Compris ».
    expect(step('b4-cand').adExample).toBe(true);
    expect(step('b4-cand').simulatesAd).toBe(true);
    expect(step('b4-cand').lookOnly).toBe(true);
    expect(step('b4-cand').targets).toEqual(['ad-cand', 'ad-poster']);
    expect(step('b4-cand').completesMission).toBe(true);
    expect(step('b4-cand').nextLabel).toBeTruthy();
    expect(step('a7').completesMission).toBeFalsy();
  });
});

describe('B1 : campagne de cotisation, rien n est envoyé', () => {
  it('le chemin, puis les 6 écrans du tunnel, et l arrêt au récap', () => {
    expect(playedOf('president_b1')).toEqual(
      ['b1-card', 'b1-sum', 'b1-new', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'b1-open', 'b1-camp'],
    );
    expect(profile.bonusFromMission).toBe('president_b1');
    stepsOf('president_b1').forEach((one) => expect(one.simulatesCampaign).toBe(true));
    const opened = send('b1-new', { key: RouteNames.ClubLicenseCampaignSettings, kind: 'route' });
    expect(idAt(opened.index)).toBe('c1');
  });

  it('club neuf : pas de synthèse, l écran de mise en route est cadré à la place', () => {
    ['b1-sum', 'b1-new'].forEach((id) => {
      expect(step(id).variants[0].targets).toEqual(['cot-setup']);
      expect(step(id).variants[0].text.length).toBeGreaterThan(5);
    });
  });

  it('une seule route : l écran du tunnel se dit par signal, en avant comme en arrière', () => {
    expect(idAt(send('c1', { key: 'licenseCampaign.step.audience', kind: 'interaction' }).index))
      .toBe('c2');
    expect(idAt(send('c5', { key: 'licenseCampaign.step.audience', kind: 'interaction' }).index))
      .toBe('c2');
    expect(idAt(send('c6', { key: 'licenseCampaign.step.reminders', kind: 'interaction' }).index))
      .toBe('c5');
    expect(send('c2', { key: 'licenseCampaign.step.audience', kind: 'interaction' })).toBeNull();
  });

  it('arrêt au récap, puis une bulle (décision 8, un seul réglage)', () => {
    expect(idAt(send('c6', { key: 'licenseCampaign.open.example', kind: 'interaction' }).index))
      .toBe('b1-open');
    expect(step('c6').completesMission).toBeFalsy();
    expect(step('c6').listScrolls).toBe(true);
    // Décision « 80- B » : « Campagne ouverte » sans alerte native, puis la campagne d'exemple.
    expect(step('b1-open').simulatesCampaign).toBe(true);
    expect(step('b1-open').campaignExample).toBeFalsy();
    expect(step('b1-open').completesMission).toBeFalsy();
    expect(step('b1-camp').campaignExample).toBe(true);
    expect(step('b1-camp').simulatesCampaign).toBe(true);
    expect(step('b1-camp').targets).toEqual(['camp-list', 'camp-relance']);
    // Pas `lookOnly` : « A payé » et « Relancer » se touchent, en local.
    expect(step('b1-camp').lookOnly).toBeFalsy();
    expect(step('b1-camp').completesMission).toBe(true);
    expect(step('b1-camp').nextLabel).toBeTruthy();
  });
});
