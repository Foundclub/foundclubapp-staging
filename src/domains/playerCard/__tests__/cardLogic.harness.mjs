// Harnais PUR autoportant (node, sans jest) : `node cardLogic.harness.mjs`
// Couvre les modules sans dependance projet (@/ non requis) :
//   cardModel.js, teamCardModel.js, cardMessages.js
// Exit 1 si un cas echoue. Le meme perimetre est porte en jest (voir *.test.js).
import assert from 'node:assert';
import {
  computeAge, extractCity, pickTopHistory, computeRarity, computeCompleteness,
  evaluateMinorGuard, resolveJerseyNumber, buildPlayerCardModel, RARITY,
} from '../cardModel.js';
import {
  buildTeamBacks, buildRecruitingNeeds, buildTeamCardModel, resolveMemberNumber,
} from '../teamCardModel.js';
import { buildCardShareMessage, buildCardShareTitle } from '../cardMessages.js';

const NOW = new Date('2026-07-11T12:00:00Z');
let passed = 0;
const test = (name, fn) => { fn(); passed += 1; console.log('  ok -', name); };

/* ---------- cardModel ---------- */
test('computeAge basique', () => {
  assert.strictEqual(computeAge('2000-07-11', NOW), 26);
  assert.strictEqual(computeAge('2000-07-12', NOW), 25);
  assert.strictEqual(computeAge(null, NOW), null);
  assert.strictEqual(computeAge('pas-une-date', NOW), null);
});

test('extractCity json et string', () => {
  assert.strictEqual(extractCity({ city: 'Lyon' }), 'Lyon');
  assert.strictEqual(extractCity('{"town":"Bron"}'), 'Bron');
  assert.strictEqual(extractCity(null), '');
  assert.strictEqual(extractCity('texte-libre-non-json'), '');
});

test('pickTopHistory tri actif->recent, limite 3', () => {
  const hs = [
    { startYear: 2018, endYear: 2020, club: { name: 'A' } },
    { startYear: 2022, isCurrentlyActive: true, customClubName: 'B', level: { name: 'National' } },
    { startYear: 2021, endYear: 2022, multisport_club: { name: 'C' } },
    { startYear: 2010, endYear: 2012, customClubName: 'D' },
  ];
  const top = pickTopHistory(hs, 3);
  assert.strictEqual(top.length, 3);
  assert.strictEqual(top[0].clubName, 'B');
  assert.strictEqual(top[0].isCurrentlyActive, true);
  assert.strictEqual(top[1].clubName, 'C');
  assert.strictEqual(top[2].clubName, 'A');
});

test('computeCompleteness monotone 0..100', () => {
  assert.strictEqual(computeCompleteness({}, []), 0);
  const full = computeCompleteness({
    avatar: { url: 'x' }, firstname: 'A', lastname: 'B', position: 'Ailier',
    preferredSport: 'Football', birthdate: '2000-01-01', nationality: 'FR',
    address: { city: 'Lyon' }, bestLevel: 'National',
  }, [{}, {}, {}]);
  assert.strictEqual(full, 100);
});

test('computeRarity paliers', () => {
  assert.strictEqual(computeRarity({ completeness: 0 }).rarity, RARITY.COMMON);
  const high = computeRarity({
    completeness: 100, bestLevel: 'Professionnel',
    topHistory: [{ level: 'National' }, { level: 'Regional' }, { level: 'National' }],
  });
  assert.strictEqual(high.rarity, RARITY.LEGENDARY);
  assert.ok(high.score >= 85);
});

test('evaluateMinorGuard : adulte / <15 sans conso / <15 avec conso / 17 ans', () => {
  assert.strictEqual(evaluateMinorGuard({ birthdate: '2000-01-01' }, NOW).canPublish, true);
  const child = evaluateMinorGuard({ birthdate: '2015-01-01' }, NOW); // 11 ans
  assert.strictEqual(child.requiresConsent, true);
  assert.strictEqual(child.canPublish, false);
  assert.strictEqual(evaluateMinorGuard({ birthdate: '2015-01-01', parentalDeclarationAccepted: true }, NOW).canPublish, true);
  // consentement carte specifique accepte aussi
  assert.strictEqual(evaluateMinorGuard({ birthdate: '2015-01-01', cardConsentAcceptedAt: '2026-01-01' }, NOW).canPublish, true);
  const teen = evaluateMinorGuard({ birthdate: '2009-01-01' }, NOW); // 17 ans
  assert.strictEqual(teen.isMinor, true);
  assert.strictEqual(teen.requiresConsent, false);
  assert.strictEqual(teen.canPublish, true);
});

test('resolveJerseyNumber deterministe 1..99 + explicite', () => {
  const n1 = resolveJerseyNumber({ documentId: 'abc123' });
  assert.strictEqual(n1, resolveJerseyNumber({ documentId: 'abc123' }));
  assert.ok(n1 >= 1 && n1 <= 99);
  assert.strictEqual(resolveJerseyNumber({ jerseyNumber: 10 }), 10);
});

test('buildPlayerCardModel integration + SANS CLUB + dispo', () => {
  const model = buildPlayerCardModel({
    user: {
      documentId: 'u1', firstname: 'Sofia', lastname: 'martin', preferredSport: 'Football',
      position: 'Milieu', birthdate: '2005-03-01', nationality: 'FR',
      address: { city: 'Lyon' }, isLookingForClub: true, club: null,
    },
    histories: [
      { startYear: 2023, isCurrentlyActive: true, customClubName: 'OL', level: { name: 'National' } },
    ],
    qrUrl: 'https://foundclub.app/install.html?source=card',
    now: NOW,
  });
  assert.strictEqual(model.lastname, 'MARTIN');
  assert.strictEqual(model.hasClub, false);
  assert.strictEqual(model.isAvailable, true);
  assert.strictEqual(model.age, 21);
  assert.strictEqual(model.city, 'Lyon');
  assert.strictEqual(model.history.length, 1);
  assert.ok(Object.values(RARITY).includes(model.rarity));
  assert.strictEqual(model.guard.canPublish, true);
});

test('buildPlayerCardModel : mineur <15 sans conso => photo masquee (fallback dos)', () => {
  const model = buildPlayerCardModel({
    user: {
      documentId: 'kid', firstname: 'Leo', lastname: 'petit', birthdate: '2015-01-01',
      avatar: { url: 'https://cdn/leo.jpg' },
    },
    now: NOW,
  });
  assert.strictEqual(model.guard.canPublish, false);
  assert.strictEqual(model.hasPhoto, false, 'photo mineur non publiable doit etre masquee');
  assert.strictEqual(model.photoUrl, null);
});

test('buildPlayerCardModel : mineur <15 AVEC conso => photo autorisee', () => {
  const model = buildPlayerCardModel({
    user: {
      documentId: 'kid', firstname: 'Leo', lastname: 'petit', birthdate: '2015-01-01',
      parentalDeclarationAccepted: true, avatar: { url: 'https://cdn/leo.jpg' },
    },
    now: NOW,
  });
  assert.strictEqual(model.hasPhoto, true);
  assert.strictEqual(model.photoUrl, 'https://cdn/leo.jpg');
});

/* ---------- teamCardModel ---------- */
test('resolveMemberNumber deterministe + explicite', () => {
  const a = resolveMemberNumber({ documentId: 'p1' }, 0);
  assert.strictEqual(a, resolveMemberNumber({ documentId: 'p1' }, 0));
  assert.ok(a >= 1 && a <= 99);
  assert.strictEqual(resolveMemberNumber({ jerseyNumber: 7 }, 3), 7);
});

test('buildTeamBacks : dos floques (nom uppercase, numero), limite 6', () => {
  const players = Array.from({ length: 9 }, (_, i) => ({ documentId: `p${i}`, lastname: `nom${i}` }));
  const backs = buildTeamBacks(players);
  assert.strictEqual(backs.length, 6);
  assert.strictEqual(backs[0].name, 'NOM0');
  assert.ok(backs[0].number >= 1 && backs[0].number <= 99);
});

test('buildRecruitingNeeds : agrege par poste, ignore expirees', () => {
  const ads = [
    { audienceType: 'player', position: 'Gardien', quantity: 1 },
    { audienceType: 'player', position: 'Gardien', quantity: 2 },
    { audienceType: 'coach', coachRole: 'entraineur_adjoint', quantity: 1 },
    { audienceType: 'player', position: 'Ailier', quantity: 1, expirationDate: '2020-01-01' }, // expiree
    { audienceType: 'player', position: 'Avant', quantity: 1, isActive: false }, // inactive
  ];
  const needs = buildRecruitingNeeds(ads, NOW);
  const gardien = needs.find((n) => n.label === 'Gardien');
  assert.ok(gardien, 'poste gardien present');
  assert.strictEqual(gardien.quantity, 3, 'quantites agregees');
  assert.ok(needs.find((n) => n.audienceType === 'coach' && n.label === 'Entraineur adjoint'));
  assert.ok(!needs.find((n) => n.label === 'Ailier'), 'annonce expiree exclue');
  assert.ok(!needs.find((n) => n.label === 'Avant'), 'annonce inactive exclue');
});

test('buildTeamCardModel : modele complet', () => {
  const model = buildTeamCardModel({
    team: {
      name: 'U17 Feminines', club: { name: 'OL', city: 'Lyon' },
      activities: [{ name: 'Football' }],
      players: [{ documentId: 'p1', lastname: 'Durand' }, { documentId: 'p2', lastname: 'Bernard' }],
    },
    recruitmentAds: [{ audienceType: 'player', position: 'Gardienne', quantity: 1 }],
    qrUrl: 'https://foundclub.app/install.html',
    now: NOW,
  });
  assert.strictEqual(model.audience, 'team');
  assert.strictEqual(model.teamName, 'U17 FEMININES');
  assert.strictEqual(model.hasClub, true);
  assert.strictEqual(model.sport, 'Football');
  assert.strictEqual(model.city, 'Lyon');
  assert.strictEqual(model.rosterCount, 2);
  assert.strictEqual(model.backs.length, 2);
  assert.strictEqual(model.isRecruiting, true);
  assert.strictEqual(model.recruitingNeeds[0].label, 'Gardienne');
});

/* ---------- cardMessages ---------- */
test('buildCardShareTitle : nom complet ou fallback', () => {
  assert.strictEqual(buildCardShareTitle({ firstname: 'Sofia', lastname: 'MARTIN' }), 'Sofia MARTIN');
  assert.strictEqual(buildCardShareTitle({}, { fallbackName: 'Ma carte' }), 'Ma carte');
});

test('buildCardShareMessage : intro + suffixe dispo + lien', () => {
  const out = buildCardShareMessage({
    model: { firstname: 'Sofia', lastname: 'MARTIN', isAvailable: true, qrUrl: 'https://foundclub.app/x' },
    labels: {
      intro: 'Voici ma carte FoundClub', availableSuffix: 'Je cherche un club !',
      linkLabel: 'Trouve-moi sur FoundClub',
    },
  });
  assert.strictEqual(out.title, 'Sofia MARTIN');
  assert.ok(out.message.includes('Voici ma carte FoundClub'));
  assert.ok(out.message.includes('Je cherche un club !'));
  assert.ok(out.message.includes('Trouve-moi sur FoundClub :\nhttps://foundclub.app/x'));
});

test('buildCardShareMessage : pas de lien => pas de section url', () => {
  const out = buildCardShareMessage({ model: { firstname: 'A', qrUrl: '' }, labels: { intro: 'Hey' } });
  assert.strictEqual(out.url, '');
  assert.strictEqual(out.message, 'Hey');
});

console.log(`\n${passed} tests OK`);
