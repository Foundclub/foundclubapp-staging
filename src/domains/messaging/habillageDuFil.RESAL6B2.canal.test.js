import { estUnCanalDeComplexe, sousTitreDesMembres } from './habillageDuFil';

// RESA-L6B-2 (20/10/2026) — E-P12, LE CANAL D'UN COMPLEXE CÔTÉ JOUEUR (planche EP12 ; serveur
// RESA-L4 `masquerMembresDuCanal`) : le canal est un fil de groupe dont le serveur joint le NOMBRE
// réel de membres (`participantsCount`) et, à un membre qui n'est pas gérant, seulement lui-même et
// les gérants. L'en-tête dit donc « Canal du complexe · 214 membres », jamais les prénoms de la
// liste réduite (« Marc, Vous » serait faux : 212 membres manqueraient).

const MOI = { documentId: 'moi', firstname: 'Adel' };
const GERANT = { documentId: 'gerant', firstname: 'Marc' };
const CANAL = {
  participants: [MOI, GERANT], participantsCount: 214, type: 'group',
};
const canal = (/** @type {number} */ nombre) => `Canal du complexe · ${nombre} membres`;

test('le canal d’un complexe : un fil de groupe qui porte `participantsCount`', () => {
  expect(estUnCanalDeComplexe(CANAL)).toBe(true);
  expect(estUnCanalDeComplexe({ participants: [MOI, GERANT], type: 'group' })).toBe(false);
  expect(estUnCanalDeComplexe({ participantsCount: 3, type: 'whisper' })).toBe(false);
  expect(estUnCanalDeComplexe({ participantsCount: null, type: 'group' })).toBe(false);
  expect(estUnCanalDeComplexe(null)).toBe(false);
});

test('l’en-tête du canal : le nombre réel de membres, pas les prénoms de la liste réduite', () => {
  expect(sousTitreDesMembres({
    canal, chat: CANAL, meId: 'moi', vous: 'Vous',
  })).toBe('Canal du complexe · 214 membres');
});

test('un groupe ordinaire ne change pas ; sans la phrase du canal, la règle d’avant', () => {
  expect(sousTitreDesMembres({
    canal, chat: { participants: [MOI, GERANT], type: 'group' }, meId: 'moi', vous: 'Vous',
  })).toBe('Marc, Vous');
  expect(sousTitreDesMembres({ chat: CANAL, meId: 'moi', vous: 'Vous' })).toBe('Marc, Vous');
});
