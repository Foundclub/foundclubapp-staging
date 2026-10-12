import { sousTitreDesMembres } from './habillageDuFil';

// SITE-MSG-FENETRES (T20, 08/10) — LA LIGNE SOUS LE TITRE DU FIL.
//
// Le site ecrivait « N participants » en comptant `chat.participants` ; or le serveur ne joint
// PAS les membres d un fil d equipe ou de club (MSG1/N4, chat.ts) : l en-tete de « U15 » disait
// « 0 participants » (T19, T20) alors que l equipe en a 3. Le telephone, lui, suit la regle du
// pack (MSG1A §3.1, Conversation.js) : les prenoms des membres puis « Vous », et RIEN quand il
// ne les connait pas. Le site prend la meme regle, ecrite une fois ici.

const MOI = { documentId: 'moi', firstname: 'Adel' };
const BRUNO = { documentId: 'bruno', firstname: 'Bruno' };
const SAMI = { documentId: 'sami', firstname: '  Sami ' };
const ANONYME = { documentId: 'anonyme', firstname: '' };

describe('sousTitreDesMembres — la regle du telephone (MSG1A §3.1)', () => {
  test('un fil a plusieurs : les prenoms des AUTRES membres, puis « Vous »', () => {
    expect(sousTitreDesMembres({
      chat: { participants: [MOI, BRUNO, SAMI, ANONYME], type: 'group' },
      meId: 'moi',
      vous: 'Vous',
    })).toBe('Bruno, Sami, Vous');
  });

  test('membres absents du detail (equipe, club) : rien, jamais « 0 participants »', () => {
    ['team', 'club', 'multisport'].forEach((type) => {
      expect(sousTitreDesMembres({ chat: { type }, meId: 'moi', vous: 'Vous' })).toBe('');
      expect(sousTitreDesMembres({ chat: { participants: [], type }, meId: 'moi', vous: 'Vous' }))
        .toBe('');
    });
  });

  test('un tete-a-tete ne dit rien sous le nom', () => {
    expect(sousTitreDesMembres({
      chat: { participants: [MOI, BRUNO], type: 'whisper' },
      meId: 'moi',
      vous: 'Vous',
    })).toBe('');
  });

  test('seul dans le fil, ou fil pas encore charge : rien', () => {
    expect(sousTitreDesMembres({
      chat: { participants: [MOI], type: 'group' }, meId: 'moi', vous: 'Vous',
    })).toBe('');
    expect(sousTitreDesMembres({ chat: null, meId: 'moi', vous: 'Vous' })).toBe('');
  });

  test('30 prenoms au plus, comme le telephone', () => {
    const membres = Array.from({ length: 40 }, (_, index) => ({
      documentId: `m${index}`, firstname: `P${index}`,
    }));
    const ligne = sousTitreDesMembres({
      chat: { participants: membres, type: 'team' }, meId: 'moi', vous: 'Vous',
    });
    expect(ligne.split(', ')).toHaveLength(31);
    expect(ligne.endsWith(', Vous')).toBe(true);
  });
});
