import { getConversationName } from '@/domains/messaging/messagingUseCases';

import {
  estFilDeLaVille,
  filsDeLaMessagerie,
  peutEcrireDansLeFil,
  sousTitreDuFil,
  titreDuFil,
  voixDuFil,
} from './collectiviteCanaux';

// MSG-VILLE-NOUVELLE (20/10/2026, REC17-004 ter) — la conversation que la Ville OUVRE avec qui
// elle veut (`collectivite_conversation`, tête-à-tête ou groupe) est un fil de la Ville : elle vit
// dans « Messages » de SA Ville, la Ville y parle en son nom, et chacun y lit le bon nom.

/**
 * Une traduction de témoin : le texte par défaut, avec ses valeurs.
 * @param {string} cle - La clef.
 * @param {any} repli - Le texte par défaut.
 * @param {Record<string, any>} [valeurs] - Les valeurs.
 * @returns {string} Le texte.
 */
const t = (cle, repli, valeurs = {}) => String(
  typeof repli === 'string' ? repli : repli?.defaultValue || cle,
).replace(/\{\{(\w+)\}\}/g, (_m, nom) => (valeurs[nom] !== undefined ? String(valeurs[nom]) : _m));

const VILLE = { documentId: 'ville-1', name: 'Ville de Démouville' };
const TETE_A_TETE = {
  collectivite: VILLE,
  documentId: 'fil-1',
  groupName: null,
  participants: [
    { documentId: 'mairie', firstname: 'Adel', lastname: 'Ferchichi' },
    { documentId: 'karim', firstname: 'Karim', lastname: 'Benali' },
  ],
  type: 'collectivite_conversation',
};
const GROUPE = { ...TETE_A_TETE, documentId: 'fil-2', groupName: 'Forum des sports' };

describe('MSG-VILLE-NOUVELLE — la conversation ouverte par la Ville', () => {
  test('C1 — un fil de la Ville : on y écrit, la Ville y parle en son nom', () => {
    expect(estFilDeLaVille(TETE_A_TETE)).toBe(true);
    expect(peutEcrireDansLeFil({ chat: TETE_A_TETE })).toBe(true);
    expect(voixDuFil({ chat: TETE_A_TETE, espaceVille: true }))
      .toEqual({ senderSignature: { voix: 'ville' } });
    expect(voixDuFil({ chat: TETE_A_TETE, espaceVille: false })).toEqual({});
  });

  test('C2 — elle vit dans « Messages » de SA Ville ; côté membre, une ligne', () => {
    const autreVille = {
      ...TETE_A_TETE, collectivite: { documentId: 'ville-2', name: 'Autre' }, documentId: 'fil-3',
    };
    const whisper = { documentId: 'fil-4', participants: [], type: 'whisper' };
    const liste = [TETE_A_TETE, autreVille, whisper];
    const ids = (/** @type {any[]} */ fils) => fils.map((c) => c.documentId);
    expect(ids(filsDeLaMessagerie(liste, { collectiviteId: 'ville-1', espaceVille: true })))
      .toEqual(['fil-1']);
    expect(ids(filsDeLaMessagerie(liste, { espaceVille: false })))
      .toEqual(['fil-1', 'fil-3', 'fil-4']);
  });

  test('C3 — son nom : en face côté Ville, la Ville côté membre, le groupe pour tous', () => {
    expect(titreDuFil(t, { chat: TETE_A_TETE, espaceVille: true })).toBe('');
    expect(getConversationName({
      chatGroupName: TETE_A_TETE.groupName,
      chatParticipants: TETE_A_TETE.participants,
      chatType: TETE_A_TETE.type,
      meId: 'mairie',
    })).toBe('Karim Benali');
    expect(titreDuFil(t, { chat: TETE_A_TETE, espaceVille: false })).toBe('Ville de Démouville');
    expect(titreDuFil(t, { chat: GROUPE, espaceVille: true })).toBe('Forum des sports');
    expect(titreDuFil(t, { chat: GROUPE, espaceVille: false })).toBe('Forum des sports');
    expect(getConversationName({
      chatGroupName: 'Forum des sports', chatType: GROUPE.type, meId: 'karim',
    })).toBe('Forum des sports');
  });

  test('C4 — la ligne sous le titre : qui la lit (Ville), d’où elle vient (membre)', () => {
    expect(sousTitreDuFil(t, { chat: TETE_A_TETE, espaceVille: true }))
      .toBe('Seules les personnes choisies la lisent');
    expect(sousTitreDuFil(t, { chat: TETE_A_TETE, espaceVille: false }))
      .toBe('Conversation avec Ville de Démouville');
  });
});
