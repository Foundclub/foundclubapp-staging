/**
 * COMPO-WEB (29/09) — JUMEAU TELEPHONE : IL NE FAIT RIEN, ET C'EST VOULU.
 *
 * Sur le telephone, les objets du parcours de composition (joueurs, placements,
 * compo en cours) voyagent avec la navigation : il n'y a rien a relire. Ce
 * crochet rend donc `route.params` TEL QUEL — meme identite, aucun calcul,
 * aucune requete — et aucun blocage.
 *
 * 🌐 Le vrai travail vit dans `useSiteCompositionRecovery.web.js`, que seul le
 * site compile : arrive par l'adresse (lien, rechargement, nouvel onglet), un
 * ecran du parcours y relit la composition sur le serveur.
 *
 * ⛔ C'est ce fichier-ci qui garantit que le telephone ne voit RIEN changer :
 * un jumeau `.web.js` ne peut pas etre charge par l'app.
 */

/** @type {Readonly<{ missingCount: number, publicationBlocked: boolean, status: string }>} */
const IDLE = Object.freeze({ missingCount: 0, publicationBlocked: false, status: 'idle' });

/**
 * Le second argument des appelants (`'field'` / `'selection'`, ce dont l'ecran
 * a besoin) n'est lu que par le site : ici, il est ignore.
 * @param {any} routeParams Les parametres de la route, tels quels.
 * @returns {{ params: any, recovery: typeof IDLE }}
 */
const useSiteCompositionRecovery = (routeParams) => ({ params: routeParams, recovery: IDLE });

export default useSiteCompositionRecovery;
