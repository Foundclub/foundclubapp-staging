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
 * 🎨 MSG1A (§3.2) — le menu du pack porte une ICONE par ligne (jeu FOUNDCLUB, `GlyphIcon`)
 * et met en ROUGE Supprimer et Signaler (`alerte`). `destructive` garde son sens : seule
 * « Supprimer » detruit. Et « Repondre » disparait quand on ne peut pas ecrire dans le fil
 * (`canReply` faux, canal d'annonce) : il ouvrait une reponse sans champ de saisie.
 * @type {{alerte?: boolean, condition: (etat: {canCopy: boolean, canEdit: boolean,
 *   canReply: boolean, isMine: boolean}) => boolean, destructive?: boolean, fallback: string,
 *   icone: string, key: string, labelKey: string}[]}
 */
export const MESSAGE_ACTIONS = [
  {
    condition: ({ canReply }) => canReply,
    fallback: 'Repondre',
    icone: 'reply',
    key: 'reply',
    labelKey: 'conversation.actions.reply',
  },
  {
    // Un message qui ne porte aucun texte — une piece jointe seule — n a rien a copier.
    condition: ({ canCopy }) => Boolean(canCopy),
    fallback: 'Copier',
    icone: 'fileCopy',
    key: 'copy',
    labelKey: 'conversation.actions.copy',
  },
  {
    // `canEdit` porte DEJA les deux conditions de la vue : le message est a moi,
    // et sa composition est modifiable (un sondage ne l est pas).
    condition: ({ canEdit }) => Boolean(canEdit),
    fallback: 'Modifier',
    icone: 'penSquare',
    key: 'edit',
    labelKey: 'conversation.actions.edit',
  },
  {
    alerte: true,
    condition: ({ isMine }) => Boolean(isMine),
    destructive: true,
    fallback: 'Supprimer',
    icone: 'trashAlt',
    key: 'delete',
    labelKey: 'conversation.actions.delete',
  },
  {
    // 🔁 L EXACT MIROIR DE « Supprimer » : on ne signale pas son propre message.
    // Les deux ne peuvent donc jamais se montrer ensemble.
    alerte: true,
    condition: ({ isMine }) => !isMine,
    fallback: 'Signaler',
    icone: 'flag',
    key: 'report',
    labelKey: 'conversation.actions.report',
  },
];

/**
 * Les actions a afficher pour un message donne.
 * @param {{canCopy?: boolean, canEdit?: boolean, canReply?: boolean, isMine?: boolean}} [etat]
 *   Ce que la vue sait du message. `canReply` absent vaut vrai (la regle d'avant MSG1A).
 * @returns {typeof MESSAGE_ACTIONS} Les actions retenues, dans l ordre
 *   d affichage.
 */
export const getMessageActions = (etat) => {
  const faits = {
    canCopy: Boolean(etat?.canCopy),
    canEdit: Boolean(etat?.canEdit),
    canReply: etat?.canReply !== false,
    isMine: Boolean(etat?.isMine),
  };

  return MESSAGE_ACTIONS.filter((action) => action.condition(faits));
};
