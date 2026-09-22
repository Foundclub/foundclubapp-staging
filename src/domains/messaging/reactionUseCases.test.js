import {
  getMyReactionEmoji,
  getReactionsForMessage,
  indexReactionsByMessage,
  REACTION_EMOJIS,
  summarizeReactionPeople,
  withMessageReactions,
} from './reactionUseCases';

// MSGREACT — les regles d affichage des reactions, cote telephone.
//
// 🎯 CE QUE CE TEMOIN GARDE : le serveur n envoie JAMAIS « c est la mienne » —
// ce serait vrai pour celui qui vient d appuyer et faux pour tous les autres.
// C est donc l app qui se reconnait elle-meme dans la liste des personnes, et
// c est exactement ce qui est teste ici.

describe('reactionUseCases', () => {
  const payload = [
    {
      messageDocumentId: 'm1',
      reactions: [
        {
          count: 2,
          emoji: '👍',
          users: [
            { documentId: 'moi', firstname: 'Ada', lastname: 'Lovelace' },
            { documentId: 'u2', firstname: 'Bob', lastname: 'Martin' },
          ],
        },
        {
          count: 1,
          emoji: '❤️',
          users: [{ documentId: 'u3', firstname: 'Cid', lastname: 'Nazar' }],
        },
      ],
    },
    {
      messageDocumentId: 'm2',
      reactions: [{
        count: 1,
        emoji: '😂',
        users: [{ documentId: 'u2', firstname: 'Bob', lastname: 'Martin' }],
      }],
    },
  ];

  test('le jeu d emojis du telephone est EXACTEMENT celui du serveur', () => {
    // ⛔ CETTE LISTE EST RECOPIEE A LA MAIN, et ce test est la pour qu on s en
    // souvienne : sa jumelle vit dans
    // admin/src/api/chat-message/services/chat-message-reactions.js
    // (ALLOWED_REACTION_EMOJIS). Si les deux divergent, l app propose un emoji
    // que le serveur REFUSE — un appui qui ne fait rien, sans rien dire.
    expect(REACTION_EMOJIS).toEqual(['👍', '❤️', '😂', '😮', '😢', '🙏']);
  });

  test('indexReactionsByMessage range les reactions par message', () => {
    const index = indexReactionsByMessage(payload);

    expect(Object.keys(index).sort()).toEqual(['m1', 'm2']);
    expect(getReactionsForMessage(index, 'm1')).toHaveLength(2);
    expect(getReactionsForMessage(index, 'inconnu')).toEqual([]);
    expect(getReactionsForMessage(null, 'm1')).toEqual([]);
  });

  test('indexReactionsByMessage supporte une charge vide ou abimee', () => {
    expect(indexReactionsByMessage(null)).toEqual({});
    expect(indexReactionsByMessage([{ reactions: [] }])).toEqual({});
    expect(
      indexReactionsByMessage([{ messageDocumentId: '  ', reactions: [{ emoji: '👍' }] }]),
    ).toEqual({});
  });

  test('getMyReactionEmoji me reconnait dans la liste des personnes', () => {
    const reactions = getReactionsForMessage(indexReactionsByMessage(payload), 'm1');

    expect(getMyReactionEmoji(reactions, 'moi')).toBe('👍');
    expect(getMyReactionEmoji(reactions, 'u3')).toBe('❤️');
    expect(getMyReactionEmoji(reactions, 'personne-sans-reaction')).toBe('');
    expect(getMyReactionEmoji(reactions, '')).toBe('');
    expect(getMyReactionEmoji([], 'moi')).toBe('');
  });

  test('withMessageReactions remplace les reactions d UN message sans toucher aux autres', () => {
    const index = indexReactionsByMessage(payload);
    const suivant = withMessageReactions(index, 'm1', [
      { count: 1, emoji: '🙏', users: [{ documentId: 'u9', firstname: 'Zoe', lastname: 'Q' }] },
    ]);

    expect(getReactionsForMessage(suivant, 'm1')).toHaveLength(1);
    expect(getReactionsForMessage(suivant, 'm1')[0].emoji).toBe('🙏');
    expect(getReactionsForMessage(suivant, 'm2')).toHaveLength(1);
    // L index d origine n est pas modifie : react-query compare les references.
    expect(getReactionsForMessage(index, 'm1')).toHaveLength(2);
  });

  test('withMessageReactions RETIRE l entree quand il ne reste plus rien', () => {
    const index = indexReactionsByMessage(payload);
    const suivant = withMessageReactions(index, 'm1', []);

    expect(getReactionsForMessage(suivant, 'm1')).toEqual([]);
    expect(Object.keys(suivant)).toEqual(['m2']);
  });

  test('summarizeReactionPeople nomme les gens, et dit « Compte supprime » sinon', () => {
    const lignes = summarizeReactionPeople(
      [
        {
          count: 3,
          emoji: '👍',
          users: [
            { documentId: 'moi', firstname: 'Ada', lastname: 'Lovelace' },
            { documentId: 'u2', firstname: 'Bob', lastname: 'Martin' },
          ],
        },
      ],
      { deletedLabel: 'Compte supprimé', myLabel: 'Toi', myUserId: 'moi' },
    );

    expect(lignes).toEqual([
      { emoji: '👍', key: '👍-moi', name: 'Toi' },
      { emoji: '👍', key: '👍-u2', name: 'Bob Martin' },
      { emoji: '👍', key: '👍-supprime-0', name: 'Compte supprimé' },
    ]);
  });
});
