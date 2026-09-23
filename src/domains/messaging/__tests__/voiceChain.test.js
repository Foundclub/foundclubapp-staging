import {
  nextVoiceToChain,
  onVoicePlayRequest,
  requestVoicePlay,
} from '@/domains/messaging/voiceChain';

// VOCAL2 — L'ENCHAÎNEMENT DES VOCAUX (décision d'Adel du 23/09 ~17h50) : le
// calcul « qui enchaîne ? » et le relais « à toi de jouer ».

describe('VOCAL2 — qui enchaîne après ce vocal ?', () => {
  const vocal = (id, auteur) => ({
    _id: id, composition: { type: 'voice_note' }, documentId: id, user: { _id: auteur },
  });

  it('le message juste en dessous est un vocal reçu : c\'est lui', () => {
    expect(nextVoiceToChain(vocal('b', 'lui'), false)).toBe('b');
  });

  it('un autre message s\'intercale (texte, photo, sondage) : personne', () => {
    expect(nextVoiceToChain({ _id: 't', text: 'ok', user: { _id: 'lui' } }, false)).toBe('');
    const sondage = { _id: 'p', composition: { type: 'poll' }, user: { _id: 'lui' } };
    expect(nextVoiceToChain(sondage, false)).toBe('');
  });

  it('un de MES vocaux : personne (je ne m\'écoute pas en chaîne)', () => {
    expect(nextVoiceToChain(vocal('m', 'moi'), true)).toBe('');
  });

  it('fin du fil, ou message illisible : personne', () => {
    expect(nextVoiceToChain(undefined, false)).toBe('');
    expect(nextVoiceToChain({}, false)).toBe('');
  });
});

describe('VOCAL2 — le relais « à toi de jouer »', () => {
  it('seul le vocal désigné est prévenu', () => {
    const b = jest.fn();
    const c = jest.fn();
    const arretB = onVoicePlayRequest('b', b);
    const arretC = onVoicePlayRequest('c', c);
    requestVoicePlay('b');
    expect(b).toHaveBeenCalledTimes(1);
    expect(c).not.toHaveBeenCalled();
    arretB();
    arretC();
  });

  it('un vocal qui a quitté l\'écran n\'est plus prévenu (la chaîne s\'arrête sans bruit)', () => {
    const b = jest.fn();
    const arret = onVoicePlayRequest('b', b);
    arret();
    expect(() => requestVoicePlay('b')).not.toThrow();
    expect(b).not.toHaveBeenCalled();
  });
});
