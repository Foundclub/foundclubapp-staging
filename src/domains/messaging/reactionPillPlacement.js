/**
 * WHATSAPP — OU SE POSE LA PILULE DE REACTIONS, en coordonnees d ecran.
 *
 * 🎈 CE QUE CE CALCUL REMPLACE. Jusqu au 23/09, l appui long ouvrait une feuille
 * qui montait du bas et recouvrait la conversation : on choisissait une reaction
 * sans plus voir a quoi on reagissait. Sur WhatsApp, la rangee sort JUSTE
 * AU-DESSUS du message vise, qui reste lisible dessous. C est ce que fait ce
 * module, et il ne fait que ca.
 *
 * 🪤 IL EST PUR, ET CE N EST PAS UN GOUT DE STYLE : la geometrie de `BottomModal`
 * ment (elle annonce une hauteur qu elle n a pas encore). Aucune mesure de
 * feuille n entre donc ici — seulement la bulle mesuree a l ecran
 * (`measureInWindow`), la taille de la fenetre et les encoches. Pur veut aussi
 * dire testable sans emulateur, et c est la seule facon de prouver la bascule
 * haut/bas autrement qu a l oeil.
 */

/** L air entre la bulle et la pilule, en pixels. Assez pour les separer, assez peu pour les lier. */
/**
 * MSG1A (§3.2) — LA BULLE MESUREE, RAMENEE AUX COORDONNEES DE L'ECRAN.
 *
 * Constate sur l'emulateur (Pixel 9, API 36, 07/10) : la decoupe du voile tombait 142 px
 * TROP HAUT, soit exactement la barre d'etat. Sur Android, `measureInWindow` compte depuis le
 * bas de la barre d'etat ; le calque, lui (`Modal` `statusBarTranslucent`), compte depuis le
 * haut de l'ecran. Sur iPhone, les deux origines sont le haut de l'ecran : rien ne bouge.
 * @param {{ height: number, width: number, x: number, y: number }} mesure - `measureInWindow`.
 * @param {{ os: string, hauteurBarreDEtat?: number | null }} contexte
 * @returns {{ height: number, width: number, x: number, y: number }}
 */
export const ancreSurLEcran = (mesure, { hauteurBarreDEtat = 0, os }) => ({
  ...mesure,
  y: mesure.y + (os === 'android' ? Number(hauteurBarreDEtat) || 0 : 0),
});

export const REACTION_PILL_GAP = 8;

/** La marge minimale entre un panneau et le bord de l ecran. */
export const REACTION_PILL_SCREEN_MARGIN = 8;

/**
 * @param {unknown} value Une valeur quelconque.
 * @param {number} [defaut] Ce qu on prend si elle n est pas un nombre.
 * @returns {number} Un nombre utilisable, toujours.
 */
const nombre = (value, defaut = 0) => {
  const brut = Number(value);
  return Number.isFinite(brut) ? brut : defaut;
};

/**
 * Ramene une valeur entre deux bornes, meme quand elles sont croisees.
 *
 * 🧯 `max < min` ARRIVE POUR DE VRAI : une pilule plus large que la fenetre (un
 * tres petit ecran, ou une police systeme agrandie) inverse les bornes. On
 * prefere alors coller au minimum plutot que de rendre un `NaN` qui ferait
 * disparaitre la pilule sans rien dire.
 * @param {number} valeur La valeur a borner.
 * @param {number} min La borne basse.
 * @param {number} max La borne haute.
 * @returns {number} La valeur bornee.
 */
const borner = (valeur, min, max) => {
  if (max < min) return min;
  return Math.min(Math.max(valeur, min), max);
};

/**
 * OU SE RANGE UN PANNEAU, HORIZONTALEMENT.
 *
 * ↔️ IL SE COLLE AU BORD DE LA BULLE, du cote ou elle est : a gauche pour un
 * message recu, a droite pour les miens. C est ce qui le fait « appartenir » au
 * message plutot que flotter au milieu de l ecran.
 *
 * 🧱 Commun a la pilule ET au menu d actions depuis WHATSAPP2 : les deux doivent
 * s aligner sur la MEME verticale, sinon le groupe se lit comme deux objets sans
 * rapport. Une seule fonction, donc une seule regle a garder juste.
 * @param {object} params Les mesures.
 * @param {boolean} [params.alignEnd] Vrai pour MON message.
 * @param {{width?: number, x?: number} | null} [params.anchor] La bulle.
 * @param {number} params.margin La marge aux bords.
 * @param {number} params.width La largeur du panneau a poser.
 * @param {{width?: number}} [params.window] La fenetre.
 * @returns {number} Sa place en x, bornee a l ecran.
 */
const alignHorizontalement = ({
  alignEnd, anchor, margin, width, window: fenetre,
}) => {
  const bulleX = nombre(anchor?.x);
  const bulleLargeur = nombre(anchor?.width);
  const voulu = alignEnd ? bulleX + bulleLargeur - width : bulleX;

  return borner(voulu, margin, nombre(fenetre?.width) - width - margin);
};

/**
 * Ou se pose la pilule d emojis, seule.
 * @param {object} [params] Les mesures.
 * @param {boolean} [params.alignEnd] Vrai pour MON message (bulle a droite).
 * @param {{height?: number, width?: number, x?: number, y?: number} | null} [params.anchor]
 *   La bulle, mesuree a l ecran. `null` tant qu elle ne l a pas ete.
 * @param {number} [params.gap] L air entre la bulle et la pilule.
 * @param {{bottom?: number, top?: number}} [params.insets] Les encoches.
 * @param {number} [params.margin] La marge aux bords de l ecran.
 * @param {{height?: number, width?: number}} [params.pill] La taille de la pilule.
 * @param {{height?: number, width?: number}} [params.window] La fenetre.
 * @returns {{left: number, placedAbove: boolean, top: number}} Sa place, et de quel cote elle a pris.
 */
export const computeReactionPillPlacement = ({
  alignEnd = false,
  anchor,
  gap = REACTION_PILL_GAP,
  insets,
  margin = REACTION_PILL_SCREEN_MARGIN,
  pill,
  window: fenetre,
} = {}) => {
  const bulleY = nombre(anchor?.y);
  const bulleHauteur = nombre(anchor?.height);

  const pilLargeur = nombre(pill?.width);
  const pilHauteur = nombre(pill?.height);

  const ecranHauteur = nombre(fenetre?.height);

  const hautSur = nombre(insets?.top);
  const basSur = nombre(insets?.bottom);

  // ⬆️⬇️ LA BASCULE. Au-dessus par defaut, comme WhatsApp ; en dessous seulement
  // quand le haut de l ecran est trop proche — sinon la pilule passerait sous
  // l encoche ou sous l en-tete de la conversation.
  const hautSiAuDessus = bulleY - gap - pilHauteur;
  const placedAbove = hautSiAuDessus >= hautSur;
  const hautVoulu = placedAbove ? hautSiAuDessus : bulleY + bulleHauteur + gap;

  return {
    left: alignHorizontalement({
      alignEnd, anchor, margin, width: pilLargeur, window: fenetre,
    }),
    placedAbove,
    top: borner(hautVoulu, hautSur, ecranHauteur - basSur - pilHauteur),
  };
};

/**
 * WHATSAPP2 — LA PILULE **ET** LE MENU, CALCULES ENSEMBLE.
 *
 * 🧨 LE DEFAUT QUE CE CALCUL EXISTE POUR EMPECHER. En 2.6.56, la pilule se posait
 * au-dessus du message et les actions occupaient tout le bas de l ecran, chacune
 * de son cote. Quand le message vise etait en bas — le cas le plus frequent,
 * puisque les derniers messages du fil y sont — le panneau d actions RECOUVRAIT
 * la pilule : Adel a vu ses emojis tranches a mi-hauteur.
 *
 * La cause n etait pas un style, c etait une ignorance : le placement de la
 * pilule ne savait rien de la place prise par les actions. Les deux sont donc
 * decides ICI, en une fois, et le temoin central de ce module est « ils ne se
 * chevauchent jamais » (`messageMenuLayout.test.js`).
 *
 * 📐 LES QUATRE CAS, dans l ordre ou ils sont essayes :
 *   1. de la place des deux cotes  → emojis au-dessus, actions en dessous (WhatsApp) ;
 *   2. rien au-dessus              → les deux empiles EN DESSOUS du message ;
 *   3. rien en dessous             → les deux empiles AU-DESSUS, emojis en premier ;
 *   4. un message plus grand que l ecran → emojis en haut, actions en bas, et le
 *      message passe dessous. Il vaut mieux recouvrir un message geant que rendre
 *      le menu inatteignable.
 * @param {object} [params] Les mesures.
 * @param {boolean} [params.alignEnd] Vrai pour MON message : tout se range a droite.
 * @param {{height?: number, width?: number, x?: number, y?: number} | null} [params.anchor]
 *   La bulle, mesuree a l ecran.
 * @param {number} [params.gap] L air entre la bulle et ce qui l entoure.
 * @param {{bottom?: number, top?: number}} [params.insets] Les encoches.
 * @param {number} [params.margin] La marge aux bords de l ecran.
 * @param {{height?: number, width?: number}} [params.menu] La taille du menu d actions.
 * @param {{height?: number, width?: number}} [params.pill] La taille de la pilule.
 * @param {{height?: number, width?: number}} [params.window] La fenetre.
 * @returns {{menu: {left: number, top: number}, menuBelow: boolean,
 *   pill: {left: number, top: number}, pillAbove: boolean}} Les deux places, et de quel cote elles ont pris.
 */
export const computeMessageMenuLayout = ({
  alignEnd = false,
  anchor,
  gap = REACTION_PILL_GAP,
  insets,
  margin = REACTION_PILL_SCREEN_MARGIN,
  menu,
  pill,
  window: fenetre,
} = {}) => {
  const bulleY = nombre(anchor?.y);
  const bulleHauteur = nombre(anchor?.height);
  const basDeLaBulle = bulleY + bulleHauteur;

  const pilHauteur = nombre(pill?.height);
  const menuHauteur = nombre(menu?.height);

  const hautSur = nombre(insets?.top);
  const basSur = nombre(insets?.bottom);
  const hautUtile = hautSur + margin;
  const basUtile = nombre(fenetre?.height) - basSur - margin;

  const placeAuDessus = bulleY - hautUtile;
  const placeEnDessous = basUtile - basDeLaBulle;

  const pillAbove = placeAuDessus >= pilHauteur + gap;
  const menuBelow = placeEnDessous >= menuHauteur + gap;

  let hautPilule;
  let hautMenu;

  if (pillAbove && menuBelow) {
    // 1. Le cas nominal, celui de WhatsApp.
    hautPilule = bulleY - gap - pilHauteur;
    hautMenu = basDeLaBulle + gap;
  } else if (!pillAbove && menuBelow) {
    // 2. Le message touche le haut : tout descend, dans l ordre.
    hautPilule = basDeLaBulle + gap;
    hautMenu = hautPilule + pilHauteur + gap;
  } else if (pillAbove && !menuBelow) {
    // 3. Le message touche le bas : tout monte, et les emojis restent au-dessus
    //    des actions — l ordre de lecture ne change pas selon l endroit du fil.
    hautMenu = bulleY - gap - menuHauteur;
    hautPilule = hautMenu - gap - pilHauteur;
  } else {
    // 4. Le message est plus grand que la place : on colle aux deux bords.
    hautPilule = hautUtile;
    hautMenu = basUtile - menuHauteur;
  }

  // 🛟 LE FILET, ET IL SERT POUR DE VRAI. Les quatre cas ci-dessus supposent que
  // la pilule ET le menu tiennent ensemble dans l ecran utile. Sur un tres petit
  // telephone avec une police systeme agrandie, ce n est pas garanti : on borne,
  // puis on REPOUSSE le menu si le bornage vient de les faire se toucher.
  hautPilule = borner(hautPilule, hautUtile, basUtile - pilHauteur);
  hautMenu = borner(hautMenu, hautUtile, basUtile - menuHauteur);

  if (hautMenu < hautPilule + pilHauteur && hautMenu + menuHauteur > hautPilule) {
    const souslaPilule = hautPilule + pilHauteur + gap;
    hautMenu = souslaPilule + menuHauteur <= basUtile
      ? souslaPilule
      : Math.max(hautUtile, hautPilule - gap - menuHauteur);
  }

  return {
    menu: {
      left: alignHorizontalement({
        alignEnd, anchor, margin, width: nombre(menu?.width), window: fenetre,
      }),
      top: hautMenu,
    },
    menuBelow,
    pill: {
      left: alignHorizontalement({
        alignEnd, anchor, margin, width: nombre(pill?.width), window: fenetre,
      }),
      top: hautPilule,
    },
    pillAbove,
  };
};
