/**
 * WHATSAPP2 — QUELLES ACTIONS APPARAISSENT SOUS QUEL MESSAGE.
 *
 * 🧱 POURQUOI CES REGLES SORTENT DE L ECRAN. Elles vivaient en JSX, dans la
 * feuille du bas de `Conversation.js` : cinq `{condition ? <Button/> : null}`
 * melanges au rendu. Le lot WHATSAPP2 remplace ce rendu par un menu compact pose
 * sous le message — et rien n aurait dit qu une action avait disparu au passage,
 * parce qu aucune porte ne compte les boutons d un menu.
 *
 * Les regles sont donc devenues une DONNEE, figee par `messageActions.test.js`
 * (E6, ecrit avant le nouveau rendu). Le JSX ne decide plus rien : il affiche ce
 * que cette liste lui donne.
 *
 * ⛔ « Annuler » n est volontairement PAS ici. Il appartenait a la feuille du
 * bas ; dans un menu contextuel on ferme en appuyant a cote, comme sur WhatsApp.
 */

/**
 * Les cinq actions, DANS L ORDRE OU ELLES S AFFICHENT.
 *
 * Chaque entree dit a quelle condition elle apparait. `condition` recoit les
 * trois seuls faits dont l ecran dispose au moment de l appui long — et c est
 * voulu : ces trois-la sont deja calcules par la vue, les recalculer ici
 * demanderait d y importer la moitie de la messagerie.
 *
 * MESSAGERIE-1C — « Modifier la composition » (pack §3.2, §3.12) : sous la carte d'une
 * convocation publiee, pour qui peut convoquer dans cette equipe (`canEditComposition`, calcule
 * par la vue : entraineur de l'equipe ou super-admin). `icone` sert au menu de MESSAGERIE-1A.
 * @type {{condition: (etat: {canCopy: boolean, canEdit: boolean, canEditComposition: boolean,
 *   isMine: boolean}) => boolean, destructive?: boolean, fallback: string, icone?: string,
 *   key: string, labelKey: string}[]}
 */
export const MESSAGE_ACTIONS = [
  {
    condition: () => true,
    fallback: 'Repondre',
    key: 'reply',
    labelKey: 'conversation.actions.reply',
  },
  {
    // Un message qui ne porte aucun texte — une piece jointe seule — n a rien a copier.
    condition: ({ canCopy }) => Boolean(canCopy),
    fallback: 'Copier',
    key: 'copy',
    labelKey: 'conversation.actions.copy',
  },
  {
    // `canEdit` porte DEJA les deux conditions de la vue : le message est a moi,
    // et sa composition est modifiable (un sondage ne l est pas).
    condition: ({ canEdit }) => Boolean(canEdit),
    fallback: 'Modifier',
    key: 'edit',
    labelKey: 'conversation.actions.edit',
  },
  {
    condition: ({ canEditComposition }) => Boolean(canEditComposition),
    fallback: 'Modifier la composition',
    icone: 'penSquare',
    key: 'editComposition',
    labelKey: 'conversationConvocation.longPressEdit',
  },
  {
    condition: ({ isMine }) => Boolean(isMine),
    destructive: true,
    fallback: 'Supprimer',
    key: 'delete',
    labelKey: 'conversation.actions.delete',
  },
  {
    // 🔁 L EXACT MIROIR DE « Supprimer » : on ne signale pas son propre message.
    // Les deux ne peuvent donc jamais se montrer ensemble.
    condition: ({ isMine }) => !isMine,
    fallback: 'Signaler',
    key: 'report',
    labelKey: 'conversation.actions.report',
  },
];

/**
 * Les actions a afficher pour un message donne.
 * @param {{canCopy?: boolean, canEdit?: boolean, canEditComposition?: boolean,
 *   isMine?: boolean}} [etat]
 *   Ce que la vue sait du message.
 * @returns {typeof MESSAGE_ACTIONS} Les actions retenues, dans l ordre
 *   d affichage.
 */
export const getMessageActions = (etat) => {
  const faits = {
    canCopy: Boolean(etat?.canCopy),
    canEdit: Boolean(etat?.canEdit),
    canEditComposition: Boolean(etat?.canEditComposition),
    isMine: Boolean(etat?.isMine),
  };

  return MESSAGE_ACTIONS.filter((action) => action.condition(faits));
};
