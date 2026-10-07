import {
  getMessageActions,
  MESSAGE_ACTIONS,
} from './messageActions';

// WHATSAPP2 — E6 : LE TEMOIN CARACTERISANT, ECRIT AVANT DE TOUCHER AU RENDU.
//
// 🎯 CE QU IL PROTEGE. L appui long quitte la feuille du bas pour un menu compact
// pose sous le message. C est un changement de RENDU, pas de REGLES : les memes
// actions doivent apparaitre pour les memes messages, sous les memes conditions.
// Sans ce filet, « Modifier » pourrait disparaitre pour les sondages sans que
// personne ne le voie — les portes ne comptent pas les boutons d un menu.
//
// 📋 La matrice figee ici est celle de la feuille d avant (Conversation.js,
// version `ff003e83`), relevee ligne a ligne :
//   Repondre : toujours · Copier : si le message porte du texte ·
//   Modifier : si le message est a moi ET que sa composition est modifiable ·
//   Supprimer : si le message est a moi · Signaler : si le message n est PAS a moi.
//
// ⛔ « Annuler » n est PAS dans cette liste, et c est voulu : dans un menu
// contextuel, on ferme en appuyant a cote. Le bouton de la feuille disparait avec
// la feuille. C est le seul element retire, et il est retire sciemment.

const cles = (etat) => getMessageActions(etat).map((action) => action.key);

describe('WHATSAPP2 — quelles actions pour quel message', () => {
  it('mon message texte : tout sauf Signaler', () => {
    expect(cles({ canCopy: true, canEdit: true, isMine: true }))
      .toEqual(['reply', 'copy', 'edit', 'delete']);
  });

  it('le message de quelqu un d autre : ni Modifier ni Supprimer, mais Signaler', () => {
    expect(cles({ canCopy: true, canEdit: false, isMine: false }))
      .toEqual(['reply', 'copy', 'report']);
  });

  it('un message SANS texte (une piece jointe seule) : pas de Copier', () => {
    expect(cles({ canCopy: false, canEdit: true, isMine: true }))
      .toEqual(['reply', 'edit', 'delete']);
  });

  it('un message a moi mais NON modifiable (sondage, composition) : pas de Modifier', () => {
    expect(cles({ canCopy: true, canEdit: false, isMine: true }))
      .toEqual(['reply', 'copy', 'delete']);
  });

  it('le pire cas — piece jointe de quelqu un d autre : Repondre et Signaler', () => {
    expect(cles({ canCopy: false, canEdit: false, isMine: false }))
      .toEqual(['reply', 'report']);
  });

  it('Repondre est TOUJOURS la, quoi qu il arrive', () => {
    [true, false].forEach((canCopy) => {
      [true, false].forEach((canEdit) => {
        [true, false].forEach((isMine) => {
          expect(cles({ canCopy, canEdit, isMine })).toContain('reply');
        });
      });
    });
  });

  it('Supprimer et Signaler ne se montrent JAMAIS ensemble', () => {
    [true, false].forEach((canCopy) => {
      [true, false].forEach((canEdit) => {
        [true, false].forEach((isMine) => {
          const liste = cles({ canCopy, canEdit, isMine });
          expect(liste.includes('delete') && liste.includes('report')).toBe(false);
        });
      });
    });
  });

  it('chaque action porte sa clef de traduction et son intention', () => {
    getMessageActions({ canCopy: true, canEdit: true, isMine: true }).forEach((action) => {
      expect(typeof action.labelKey).toBe('string');
      expect(action.labelKey.startsWith('conversation.actions.')).toBe(true);
      expect(typeof action.fallback).toBe('string');
      expect(action.fallback.length).toBeGreaterThan(0);
    });
  });

  it('Supprimer est la seule action marquee comme destructrice', () => {
    const destructrices = getMessageActions({ canCopy: true, canEdit: true, isMine: true })
      .filter((action) => action.destructive)
      .map((action) => action.key);

    expect(destructrices).toEqual(['delete']);
  });

  it('ne rend jamais rien d absurde quand on ne lui donne rien', () => {
    expect(cles({})).toEqual(['reply', 'report']);
    expect(Array.isArray(getMessageActions())).toBe(true);
  });

  it('MESSAGE_ACTIONS decrit les cinq actions, sans doublon de clef', () => {
    const toutes = MESSAGE_ACTIONS.map((action) => action.key);
    expect(toutes).toHaveLength(5);
    expect(new Set(toutes).size).toBe(5);
  });
});

// MSG1A (§3.2) — LE MENU DU PACK : une icone par action, deux actions en rouge, et
// « Repondre » retire quand on ne peut PAS ecrire dans le fil (canal d'annonce).
// 🔴 ROUGE avant MSG1A : A1, A2, A3.
describe('MSG1A — le menu de l appui long', () => {
  it('A1 — chaque action porte son glyphe du jeu FOUNDCLUB', () => {
    const icones = Object.fromEntries(MESSAGE_ACTIONS.map((action) => [action.key, action.icone]));
    expect(icones).toEqual({
      copy: 'fileCopy', delete: 'trashAlt', edit: 'penSquare', reply: 'reply', report: 'flag',
    });
  });

  it('A2 — Supprimer et Signaler sont en rouge ; Supprimer reste la seule DESTRUCTRICE', () => {
    const rouges = MESSAGE_ACTIONS.filter((action) => action.alerte).map((action) => action.key);
    expect(rouges).toEqual(['delete', 'report']);
  });

  it('A3 — fil en lecture seule (canReply false) : plus de « Repondre », le reste inchange', () => {
    expect(cles({ canCopy: true, canReply: false, isMine: false })).toEqual(['copy', 'report']);
    expect(cles({ canCopy: true, canReply: true, isMine: false })).toEqual(['reply', 'copy', 'report']);
  });
});
