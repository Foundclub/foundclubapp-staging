import { useMutation, useQueryClient } from '@tanstack/react-query'
import i18next from 'i18next';
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import { useWindowDimensions, View } from 'react-native'

import useAuth from '@/domains/auth/useAuth'
import annuaireDesMembres from '@/domains/messaging/annuaireDesMembres';
import { separerLeFilDAssistance } from '@/domains/messaging/assistance';
import canWriteInChat from '@/domains/messaging/canWriteInChat';
import { EMOJI_CATALOG } from '@/domains/messaging/emojiCatalog';
import { presenceDansLeFil } from '@/domains/messaging/evenementDansLeFil';
import { libelleDuRole } from '@/domains/messaging/roleDuMembre';
// MSG1W §3.2 — les regles du menu d un message, les MEMES que le telephone (WHATSAPP2).
import { getMessageActions } from '@/domains/messaging/messageActions';
// MSG1W — la couleur d un nom, la MEME que sur le telephone (MSG1A).
import { couleurDuNom, sousTitreDesMembres } from '@/domains/messaging/habillageDuFil';
import {
  estArchivePourMoi,
  estEpinglePourMoi,
  filtrerLesFils,
  formatChatTimestamp,
  getChatLastMessage,
  getChatMessagePreview,
  getConversationName,
  trierLesFils,
} from '@/domains/messaging/messagingUseCases';
import {
  applyOptimisticPollVote,
  createPollComposition,
} from '@/domains/messaging/pollUseCases'
import {
  getMyReactionEmoji,
  getReactionsForMessage,
  indexReactionsByMessage,
  REACTION_EMOJIS,
} from '@/domains/messaging/reactionUseCases';
import useMessaging from '@/domains/messaging/useMessaging'
import {
  getParticipationErrorMessage,
  resolveParticipationFlow,
} from '@/domains/participation/participationFlow';
// MSG1W §3.16 — bloquer une personne et cacher ses messages : la regle du telephone (K3, K4).
import {
  hideBlockedChats,
  hideBlockedMessages,
  peutBloquer,
  resolveOtherParticipantId,
  toBlockedUserIdSet,
} from '@/domains/userBlock/userBlockFilters';
// MSG1W (07/10) — « Bruno écrit… » : la regle de la minuterie du telephone.
import useQuiEcrit from '@/domains/messaging/useQuiEcrit';
import { formatThreadUnreadBadge } from '@/domains/messaging/useUnreadMessages';
// MSG1W (07/10) — les glyphes de la messagerie (coches, envoyer, micro, +), ceux du telephone.
import ConvocationGlyph from '@/components/atoms/convocationGlyph/ConvocationGlyph';
import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';
import { BREAKPOINTS } from '@/responsive'
// eslint-disable-next-line max-len -- un chemin d'import ne se coupe pas
import CompositionMessageBubbleDuFil from '@/components/molecules/compositionMessageBubble/CompositionMessageBubbleDuFil';
// MSGIMG (20/10) — l image ouverte en grand : memes regles que le telephone.
import ApercuDImageDuSite from '@/components/molecules/apercuDImage/ApercuDImageDuSite';
// MSG1W §3.5 — les fenetres du « + » reprennent les composants du telephone.
import EventCardNew from '@/components/molecules/eventCard/EventCardNew';
// MSG1W §3.4 / §3.8 — les bulles PARTAGEES du telephone (restylees par MESSAGERIE-1A).
import ContactShareBubble from '@/components/molecules/contactShareBubble/ContactShareBubble';
import EventMessageBubble from '@/components/molecules/eventMessageBubble/EventMessageBubble';
import LocationShareBubble from '@/components/molecules/locationShareBubble/LocationShareBubble';
import PollMessageBubble from '@/components/molecules/pollMessageBubble/PollMessageBubble';
// AMICAUX-CORRECTIFS 81 — la bulle de proposition AMICALE du telephone, et ses regles.
// eslint-disable-next-line max-len -- un chemin d'import ne se coupe pas
import ProposalMessageBubble from '@/components/molecules/proposalMessageBubble/ProposalMessageBubble';
import PollCreationModal from '@/components/organisms/pollCreationModal/PollCreationModal';
import ScreenContainer from '@/components/templates/ScreenContainer'
// MSG1W (07/10) — la forme du fil (groupes, puces de date, coches), sans rendu.
import {
  estModifiable,
  etatDesCoches,
  evenementDuMessage,
  libelleDuJour,
  morceauxDuTexte,
  rangerLeFil,
} from '@/views/conversationWeb/filDuSite';
// MSG1W §3.13 — la liste « Messages » de la colonne de gauche, avec les regles de la messagerie.
import {
  estMineurConnu, filsDeLaMessagerie, titreDuFil,
} from '@/domains/collectivite/collectiviteCanaux';
// COLL-C4A2 (02/10) — les fils de la Ville (canal des dirigeants, conversation privee).
import { ListeDesMembresDuFil } from '@/views/collectivite/CollectiviteCanalMembres';
// COLL-C4A3 (03/10) — la colonne de gauche de la Ville et l'écusson de l'en-tête (planche 47).
import CanauxDeLaVille, {
  ColonneDesFilsDeLaVille,
} from '@/views/collectivite/components/CanauxDeLaVille';
import {
  BoutonMembresDuFil,
  EcussonDuFil,
  FilDeLaVilleQuitte,
  VideDuFilDeLaVille,
} from '@/views/collectivite/components/FilDeLaVille';
// MSG-SUPPORT (20/10) — l'habillage des fils de la Ville, et de la conversation d'assistance.
import { useHabillageDuFil } from '@/views/chat/FilDAssistance';
import LigneAssistance from '@/views/chat/LigneAssistance';
// MSG1W « convocation site B » — l assistant de MESSAGERIE-1C, importe DIRECTEMENT : sa porte
// differee (`require`) ne passe pas le serveur de dev du site (greffon des images seulement).
import ConvocationLineupMessage from '@/views/conversationConvocation/ConvocationLineupMessage';
import ConvocationWizard from '@/views/conversationConvocation/ConvocationWizard';
import {
  canConvokeFromChat,
  getTeamIdOfChat,
} from '@/views/conversationConvocation/convocationWizardUtils';
import { RouteNames } from '@/navigation/routeNames'
import links from '@/platform/links'
// MSG1W (1-A) — les liens des applis de cartes, ceux du telephone (FeuilleDAdresse de MSG1A).
import { buildExternalMapLinks } from '@/platform/maps/externalMap';
import media from '@/platform/media'
import {
  useGetChatById,
  useGetChatMessageReactions,
  useGetChatMessages,
  useGetChats,
} from '@/services/chat/chatQueriesCompat';
import { createChatMessage, leaveGroupChat } from '@/services/chat/chatService'
import client from '@/services/client'
import { useGetEvents } from '@/services/event/eventQueries'
import { createEventParticipation } from '@/services/eventParticipation/eventParticipationService';
import {
  createLeagueProposal,
  respondToLeagueProposal,
} from '@/services/league/leagueMatchService'
import { createMessageReport } from '@/services/messageReport/messageReportService'
import {
  useBlockUser,
  useGetMyBlockedUsers,
  useUnblockUser,
} from '@/services/userBlock/userBlockQueries';
// MSG1W — les jetons de la messagerie (MSG1A), lus par les composants du fil.
import { colors, withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext'
import {
  getDocumentDisplayName,
  isDocumentAttachment,
  isImageAttachment,
} from '@/utils/documentAttachment'
import { areSameEntityId, getEntityDocumentId } from '@/utils/entityId'
import { getImageUrl } from '@/utils/imageUrl'
import { useEventAnswerMutations } from '@/views/event/hooks/useEventAnswerMutations';
import {
  buildFriendlyProposalConfirmation,
  canAcceptFriendlyProposal,
  isFriendlyProposal,
  respondToFriendlyProposal,
} from '@/views/friendlyMatch/friendlyProposalInChat';
import {
  buildCanonicalLeagueProposalPayload,
  buildLeagueProposalPayload,
} from '@/views/league/match/utils/proposalPayload'
import {
  buildLeagueLegalAcceptancePayload,
  LEAGUE_LEGAL_SCOPES,
} from '@/constants/leagueLegalAcceptance'

const { openUrl } = links || {}
const { pickDocument, pickImage, recordVoiceNote } = media || {}

// @ts-ignore: FIXME: Baseline TS regression
const formatDateTime = (value, options = {}) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  // ponytail: meme regle que localeDesFormats() -- un import de plus dans ce fichier aux imports
  // entremeles de constantes ajoutait une erreur import/first ou perfectionist ;
  // sortie : ranger les imports.
  return date.toLocaleString(i18next.language === 'en' ? 'en-GB' : 'fr-FR', options)
}

// @ts-ignore: FIXME: Baseline TS regression
const formatTime = (value) => formatDateTime(value, {
  hour: '2-digit',
  minute: '2-digit',
})

// @ts-ignore: FIXME: Baseline TS regression
const formatDay = (value) => formatDateTime(value, {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

// @ts-ignore: FIXME: Baseline TS regression
const getDisplayName = (user) => {
  const firstname = String(user?.firstname || '').trim()
  const lastname = String(user?.lastname || '').trim()
  const fullName = `${firstname} ${lastname}`.trim()
  return fullName || 'Membre'
}

// @ts-ignore: FIXME: Baseline TS regression
const getInitials = (value) => String(value || '')
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part[0]?.toUpperCase() || '')
  .join('')

// @ts-ignore: FIXME: Baseline TS regression
const flattenInfinitePages = (pages) => {
  if (!Array.isArray(pages)) return []
  // @ts-ignore: FIXME: Baseline TS regression
  const items = []
  pages.forEach((page) => {
    if (!Array.isArray(page?.data)) return
    // @ts-ignore: FIXME: Baseline TS regression
    page.data.forEach((item) => items.push(item))
  })
  // @ts-ignore: FIXME: Baseline TS regression
  return items
}

// @ts-ignore: FIXME: Baseline TS regression
const dedupeByDocumentId = (items) => {
  const seen = new Set()
  return (Array.isArray(items) ? items : []).filter((item) => {
    const key = String(
      item?.documentId
      || item?.id
      || item?._id
      || item?.clientMessageId
      || '',
    ).trim()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// @ts-ignore: FIXME: Baseline TS regression
const getMessageId = (message) => String(
  message?.documentId
  || message?.id
  || message?._id
  || message?.clientMessageId
  || '',
).trim()

// @ts-ignore: FIXME: Baseline TS regression
const sortMessagesAscending = (messages) => dedupeByDocumentId(messages)
  .sort((left, right) => {
    const leftTime = new Date(left?.createdAt || 0).getTime()
    const rightTime = new Date(right?.createdAt || 0).getTime()
    return leftTime - rightTime
  })

// @ts-ignore: FIXME: Baseline TS regression
const getAttachmentUrl = (attachment) => {
  const candidates = [
    attachment?.url,
    attachment?.formats?.large?.url,
    attachment?.formats?.medium?.url,
    attachment?.formats?.small?.url,
    attachment?.formats?.thumbnail?.url,
    attachment?.previewUrl,
    attachment?.uri,
  ]

  for (let index = 0; index < candidates.length; index += 1) {
    const resolved = getImageUrl(candidates[index])
    if (resolved) return resolved
  }

  return ''
}

// @ts-ignore: FIXME: Baseline TS regression
const buildEventShareComposition = (event) => {
  const eventDocumentId = getEntityDocumentId(event)
  return {
    eventDate: event?.date || null,
    eventDocumentId,
    eventName: event?.name || 'Événement',
    eventPreview: event,
    locationLabel: event?.location?.label || event?.facility?.address || event?.facility?.name || '',
    teamName: event?.team?.name || '',
    type: 'event_share',
  }
}

// @ts-ignore: FIXME: Baseline TS regression
const getErrorMessage = (error, fallback) => String(error?.message || fallback || i18next.t(
  'conversation.banner.errorFallback',
  'Une erreur est survenue.',
))
  .trim()

/** Les mesures de la barre ouverte, en pixels : 6 emojis, le « + », leurs marges, son cadre. */
const REACTION_BAR_WIDTH = 272;
const REACTION_BAR_HEIGHT = 44;

/** WHATSAPP — les mesures du clavier complet, celui que le « + » ouvre. */
const REACTION_PICKER_WIDTH = 320;
const REACTION_PICKER_HEIGHT = 280;

/**
 * MSG1W — L ORIGINE DES ELEMENTS « FIXES » DE CETTE PAGE.
 *
 * 🪟 Sur le site, le cadre de la page (`.shell-main`) porte un FLOU D ARRIERE-PLAN
 * (backdrop-filter, index.css). Un ancetre qui floute, transforme ou filtre devient le repere
 * des elements en `position: fixed` : poses aux coordonnees de l ECRAN, ils sortaient decales
 * de la largeur du menu lateral (264 px a 1 280). Mesure du 07/10 : le « + » de la barre des
 * reactions tombait hors de l ecran des que le fil etait a droite (colonne « Messages »).
 * On cherche ce repere et on retire son origine aux coordonnees d ecran.
 * @param {Element | null | undefined} element - Un element de la page (le declencheur).
 * @returns {{ x: number, y: number }} L origine du repere des elements fixes, en pixels d ecran.
 */
const origineDuRepereFixe = (element) => {
  let noeud = element?.parentElement || null;
  while (noeud && typeof window !== 'undefined' && window.getComputedStyle) {
    const style = window.getComputedStyle(noeud);
    const flou = style.backdropFilter || style.getPropertyValue('-webkit-backdrop-filter');
    if (
      style.transform !== 'none'
      || style.filter !== 'none'
      || (flou && flou !== 'none')
      || style.perspective !== 'none'
    ) {
      const cadre = noeud.getBoundingClientRect();
      return { x: cadre.left, y: cadre.top };
    }
    noeud = noeud.parentElement;
  }
  return { x: 0, y: 0 };
};

/**
 * REACT-WEB — OU POSER LA BARRE, EN COORDONNEES D ECRAN.
 *
 * 🪟 ELLE EST EN `position: fixed`, ET C EST TOUT LE POINT : la liste des messages
 * defile (`overflowY: 'auto'`), donc n IMPORTE QUEL panneau pose a l interieur en
 * depassant est COUPE par ce cadre. Mesure du 22/09, capture a l appui : ouverte
 * au-dessus de la premiere bulle, la barre n en montrait que la moitie basse ;
 * ouverte a l interieur, elle recouvrait la premiere ligne du message — on
 * choisissait une reaction sans plus voir a quoi on reagissait. Un element fixe
 * n est coupe par aucun ancetre : les deux defauts tombent d un coup.
 *
 * ⬆️⬇️ Elle s ouvre AU-DESSUS du bouton et BASCULE EN DESSOUS quand le haut de la
 * fenetre est trop proche — sans cette bascule, la bulle du haut la couperait de
 * nouveau.
 *
 * ↔️ Elle est bornee aux deux bords de la fenetre : sur une bulle etroite collee a
 * un bord, une barre de 236 px depasserait sinon hors de l ecran.
 * 📐 LES MESURES SONT DES PARAMETRES depuis le lot WHATSAPP : le meme calcul sert
 * la barre des six ET le clavier complet, qui est bien plus grand. Deux fonctions
 * auraient fait deux bascules haut/bas a garder identiques.
 * @param {HTMLElement} trigger Le bouton qui vient d etre active.
 * @param {number} [largeur] La largeur du panneau a poser.
 * @param {number} [hauteur] Sa hauteur.
 * @returns {{left: number, top: number}} Sa place, en pixels d ecran.
 */
const getReactionBarAnchor = (
  trigger,
  largeur = REACTION_BAR_WIDTH,
  hauteur = REACTION_BAR_HEIGHT,
) => {
  const rect = trigger.getBoundingClientRect();
  const placeAuDessus = rect.top > hauteur + 12;
  const origine = origineDuRepereFixe(trigger);

  return {
    left: Math.max(8, Math.min(
      rect.right - largeur,
      window.innerWidth - largeur - 8,
    )) - origine.x,
    top: (placeAuDessus
      ? rect.top - hauteur - 6
      : rect.bottom + 6) - origine.y,
  };
};

/**
 * REACT-WEB — LE SURVOL NE PEUT PAS SE FAIRE EN STYLE EN LIGNE.
 *
 * 🖱️ Un style en ligne ne connait ni `:hover` ni `:focus-within`. Les refaire a la
 * main demanderait des etats React recalcules a chaque mouvement de souris, dans
 * une liste qui porte des centaines de bulles. Trois regles CSS couvrent les trois
 * cas et ne coutent aucun rendu.
 *
 * 👆 `@media (hover: none)` EST LE CAS TACTILE, et il n est pas decoratif : sur un
 * telephone ou une tablette il n existe aucun survol, donc le bouton y reste
 * visible en permanence. Sans cette regle, reagir serait simplement impossible la-bas.
 *
 * ⌨️ `pointer-events: none` tant qu il est transparent evite une cible cliquable
 * invisible. Le focus clavier, lui, passe toujours : `:focus-within` le rend visible
 * des que la tabulation arrive dessus.
 */
const REACTION_HOVER_STYLE = `
  .REACTWEB-hote .REACTWEB-declencheur { opacity: 0; pointer-events: none; }
  .REACTWEB-hote:hover .REACTWEB-declencheur,
  .REACTWEB-hote:focus-within .REACTWEB-declencheur { opacity: 1; pointer-events: auto; }
  @media (hover: none) {
    .REACTWEB-hote .REACTWEB-declencheur { opacity: 1; pointer-events: auto; }
  }
  @keyframes MSG1W-point {
    0%, 80%, 100% { opacity: 0.35; transform: translateY(0); }
    40% { opacity: 1; transform: translateY(-3px); }
  }
  .MSG1W-point { animation: MSG1W-point 1.2s infinite ease-in-out; }
  @media (hover: none) { .REACTWEB-hote .MSG1W-sur-souris { display: none; } }
  .MSG1W-ligne-menu:hover,
  .MSG1W-ligne-menu:focus-visible { background: rgba(255, 255, 255, 0.06); }
  @media (prefers-reduced-motion: reduce) { .MSG1W-point { animation: none; } }
`;

/**
 * MSG1W (07/10) — LES COULEURS DU FIL, lues dans les jetons de la messagerie (MSG1A, SPECS §0),
 * avec les memes opacites que le telephone (`bulleDuFil/`). Les composants du fil vivent hors
 * du rendu de l ecran : ils lisent les jetons ici, une fois (le theme n a qu un jeu de couleurs).
 */
const PALETTE_DU_FIL = {
  accent: colors.primary500,
  barre: colors.chatBar,
  bulleMienne: colors.chatBubbleMine,
  bulleRecue: colors.primary700,
  carteMienne: withAlpha(colors.neutral900, 0.22),
  carteRecue: withAlpha(colors.primary900, 0.3),
  champ: colors.primary800,
  champBord: colors.primary700,
  cochesEnvoye: withAlpha(colors.neutral00, 0.5),
  cochesLu: colors.neutral00,
  danger: colors.chatDanger,
  encre: colors.primary900,
  feuille: colors.chatSheet,
  fil: colors.chatBackground,
  filet: withAlpha(colors.neutral00, 0.06),
  menu: colors.chatMenu,
  menuBord: withAlpha(colors.neutral00, 0.08),
  metaMienne: withAlpha(colors.neutral00, 0.72),
  metaRecue: withAlpha(colors.neutral00, 0.62),
  noticeFond: withAlpha(colors.chatBar, 0.55),
  noticeTexte: withAlpha(colors.neutral00, 0.62),
  puce: withAlpha(colors.chatBar, 0.84),
  revenirEnBas: withAlpha(colors.primary700, 0.98),
  role: withAlpha(colors.neutral00, 0.55),
  texte: colors.neutral00,
  texteDoux: withAlpha(colors.neutral00, 0.6),
  voile: withAlpha(colors.neutral900, 0.45),
};

/** Le style d un texte LU par le lecteur d ecran mais invisible a l ecran. */
/** @type {import('react').CSSProperties} */
const TEXTE_MASQUE = {
  border: 0,
  clip: 'rect(0 0 0 0)',
  height: 1,
  margin: -1,
  overflow: 'hidden',
  padding: 0,
  position: 'absolute',
  whiteSpace: 'nowrap',
  width: 1,
};

/**
 * La couleur du nom d une personne dans le fil : la MEME que sur le telephone (meme identifiant,
 * meme hachage, `habillageDuFil.couleurDuNom`).
 * @param {any} personne - L expediteur.
 * @returns {string} Sa couleur.
 */
const couleurDeLaPersonne = (personne) => couleurDuNom(colors, getEntityDocumentId(personne));

/**
 * MSG1W — l heure et les coches, DANS la bulle (README §3.1, SPECS §1). Les coches ne se
 * posent que sur MES messages : pales = envoye, blanches = lu (regle du telephone).
 * @param {{ heure: string, idMessage: string, mien: boolean, message: any }} props
 * @returns {import('react').ReactElement} La ligne d heure.
 */
function MetaDuMessage({
  heure, idMessage, message, mien,
}) {
  const etat = mien ? etatDesCoches(message) : undefined;
  let coches = null;
  if (etat === 'echec') {
    coches = (
      <span style={{ color: PALETTE_DU_FIL.danger, fontFamily: 'Montserrat-Bold, sans-serif' }}>
        !
      </span>
    );
  } else if (etat === 'en-cours') {
    coches = <GlyphIcon color={PALETTE_DU_FIL.cochesEnvoye} name="clock" size={13} />;
  } else if (etat) {
    coches = (
      <GlyphIcon
        color={etat === 'lu' ? PALETTE_DU_FIL.cochesLu : PALETTE_DU_FIL.cochesEnvoye}
        name="checkDouble"
        size={15}
      />
    );
  }
  const libellesDesCoches = {
    echec: i18next.t('conversation.web.fil.echec', 'Non envoyé'),
    'en-cours': i18next.t('conversation.web.fil.enCours', 'Envoi en cours'),
    envoye: i18next.t('conversation.web.fil.envoye', 'Envoyé'),
    lu: i18next.t('conversation.web.fil.lu', 'Lu'),
  };
  return (
    <span
      data-coches={etat}
      data-testid={`MSG1W-meta-${idMessage}`}
      style={{
        alignItems: 'center',
        color: mien ? PALETTE_DU_FIL.metaMienne : PALETTE_DU_FIL.metaRecue,
        display: 'inline-flex',
        fontFamily: 'Montserrat-Regular, sans-serif',
        fontSize: 11,
        gap: 3,
        lineHeight: '15px',
        whiteSpace: 'nowrap',
      }}
    >
      {heure}
      {coches ? (
        <span style={{ display: 'inline-flex' }}>
          {coches}
          <span style={TEXTE_MASQUE}>{libellesDesCoches[etat || 'envoye']}</span>
        </span>
      ) : null}
    </span>
  );
}

/**
 * MSG1W — la queue de la DERNIERE bulle d un groupe (SPECS §1 : 24 × 18, vers l exterieur).
 * @param {{ couleur: string, mienne: boolean }} props
 * @returns {import('react').ReactElement} La queue.
 */
function QueueDeBulle({ couleur, mienne }) {
  return (
    <svg
      aria-hidden="true"
      height="14"
      style={{
        bottom: 0,
        left: mienne ? undefined : -7,
        position: 'absolute',
        right: mienne ? -7 : undefined,
      }}
      viewBox="0 0 12 14"
      width="12"
    >
      <path d={mienne ? 'M0 0 Q2 10 12 14 L0 14 Z' : 'M12 0 Q10 10 0 14 L12 14 Z'} fill={couleur} />
    </svg>
  );
}

/**
 * MSG1W — l avatar de 28 au bas d un groupe (groupes seulement) : la photo, sinon les initiales
 * sur la couleur de la personne.
 * @param {{ idMessage: string, personne: any }} props
 * @returns {import('react').ReactElement} L avatar.
 */
function AvatarDuGroupe({ idMessage, personne }) {
  const photo = getImageUrl(
    personne?.avatar?.url || personne?.avatar?.formats?.thumbnail?.url || '',
  );
  const initiales = getInitials(getDisplayName(personne));
  return (
    <span
      aria-hidden="true"
      data-testid={`MSG1W-avatar-${idMessage}`}
      style={{
        alignItems: 'center',
        background: couleurDeLaPersonne(personne),
        backgroundImage: photo ? `url("${photo}")` : undefined,
        backgroundPosition: 'center',
        backgroundSize: 'cover',
        borderRadius: '50%',
        color: PALETTE_DU_FIL.encre,
        display: 'inline-flex',
        fontFamily: 'Montserrat-Bold, sans-serif',
        fontSize: 11,
        height: 28,
        justifyContent: 'center',
        width: 28,
      }}
    >
      {photo ? null : initiales}
    </span>
  );
}

/**
 * MSG1W — un petit bouton rond de la barre qui apparait au survol d une bulle. Son libelle est
 * un TEXTE masque (lu par le lecteur d ecran, trouve par `getByRole`), pas un `aria-label`.
 * @param {{ children: any, classeEnPlus?: string, libelle: string, menu?: boolean,
 *   menuOuvert?: boolean, onClick: (event: any) => void, testId?: string }} props
 * @returns {import('react').ReactElement} Le bouton.
 */
function BoutonDuSurvol({
  children, classeEnPlus = '', libelle, menu = false, menuOuvert = false, onClick, testId,
}) {
  return (
    <button
      aria-expanded={menu ? menuOuvert : undefined}
      aria-haspopup={menu ? 'menu' : undefined}
      className={`REACTWEB-declencheur ${classeEnPlus}`.trim()}
      data-testid={testId}
      onClick={onClick}
      style={{
        alignItems: 'center',
        background: PALETTE_DU_FIL.menu,
        border: `1px solid ${PALETTE_DU_FIL.menuBord}`,
        borderRadius: 999,
        color: PALETTE_DU_FIL.texte,
        cursor: 'pointer',
        display: 'flex',
        height: 28,
        justifyContent: 'center',
        padding: 0,
        position: 'relative',
        transition: 'opacity 120ms ease',
        width: 28,
      }}
      title={libelle}
      type="button"
    >
      {children}
      <span style={TEXTE_MASQUE}>{libelle}</span>
    </button>
  );
}

/** La fleche « repondre », au trait (aucun emoji dans l habillage). */
const DESSIN_REPONDRE = (
  <svg
    aria-hidden="true"
    fill="none"
    height="15"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="2"
    viewBox="0 0 24 24"
    width="15"
  >
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </svg>
);

/** Le drapeau « signaler », au trait. */
const DESSIN_SIGNALER = (
  <svg
    aria-hidden="true"
    fill="none"
    height="14"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="2"
    viewBox="0 0 24 24"
    width="14"
  >
    <path d="M4 22V4" />
    <path d="M4 4h12l-2 4 2 4H4" />
  </svg>
);

/** La fleche du survol qui ouvre le menu d un message. */
const DESSIN_PLUS_D_ACTIONS = (
  <svg
    aria-hidden="true"
    fill="none"
    height="15"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="2.2"
    viewBox="0 0 24 24"
    width="15"
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

/** Copier : deux feuilles. */
const DESSIN_COPIER = (
  <svg
    aria-hidden="true"
    fill="none"
    height="20"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="2"
    viewBox="0 0 24 24"
    width="20"
  >
    <rect height="13" rx="2" width="13" x="9" y="9" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

/** Modifier : un crayon. */
const DESSIN_MODIFIER = (
  <svg
    aria-hidden="true"
    fill="none"
    height="20"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="2"
    viewBox="0 0 24 24"
    width="20"
  >
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);

/** La croix d une barre ou d une fenetre. */
const DESSIN_FERMER = (
  <svg
    aria-hidden="true"
    fill="none"
    height="16"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="2.2"
    viewBox="0 0 24 24"
    width="16"
  >
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

/** La fleche vers le bas du bouton « revenir en bas ». */
const DESSIN_VERS_LE_BAS = (
  <svg
    aria-hidden="true"
    fill="none"
    height="20"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="2"
    viewBox="0 0 24 24"
    width="20"
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

/** La fleche de retour de l en-tete. */
const DESSIN_RETOUR = (
  <svg
    aria-hidden="true"
    fill="none"
    height="20"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="2"
    viewBox="0 0 24 24"
    width="20"
  >
    <path d="M19 12H5" />
    <path d="m12 19-7-7 7-7" />
  </svg>
);

/**
 * MSG1W §3.13 — LA COLONNE « MESSAGES » DU SITE, A GAUCHE DU FIL (WhatsApp Web ; SPECS §7) : la
 * liste de la messagerie (memes fils, memes regles : `filsDeLaMessagerie`, personnes bloquees
 * cachees), le fil ouvert marque. Toucher une ligne ouvre son fil a droite, sans quitter la page.
 * 🗂️ ARCHIVEES (08/10, README §3.14) — mes fils archives n y sont plus : la ligne « Archivées »,
 * en tete, bascule la colonne sur eux ; le clic droit ou le « … » d une ligne ouvre « Archiver »
 * (fil ordinaire) ou « Désarchiver » (fil archive).
 * 🧭 SMF (T20, 08/10) — UNE SEULE LISTE SUR ORDINATEUR : la colonne sert aussi `/messages` (sans
 * fil choisi, `MessagesDuSite`), qui montrait une 2e liste. Elle charge donc elle-meme la liste de
 * la page du telephone (meme requete, meme cache) et en reprend ce qui lui manquait : la
 * recherche, « Toutes / Classique / League », les canaux de la Ville en tete, mes epingles en
 * tete (et « Épingler » dans le menu), les pages suivantes. L ordre et le filtre sont les regles
 * partagees `trierLesFils` / `filtrerLesFils`.
 * @param {{ chatId: string, gestes: { archiveChatAsync: (id: string) => Promise<any>,
 *   pinChatAsync: (id: string) => Promise<any>, unarchiveChatAsync: (id: string) => Promise<any>,
 *   unpinChatAsync: (id: string) => Promise<any> }, navigation: any, t: any }} props
 * @returns {import('react').ReactElement} La colonne.
 */
function ColonneDesConversations({
  chatId, gestes, navigation, t,
}) {
  const { allMyTeams, userData } = useAuth();
  const meId = String(userData?.documentId || '');
  // La requete de la page du telephone (Messaging.js) : meme clef, donc meme cache.
  const mesEquipes = useMemo(() => (Array.isArray(allMyTeams)
    ? Array.from(new Set(allMyTeams
      .map((/** @type {any} */ equipe) => String(equipe?.documentId || '').trim())
      .filter(Boolean)))
    : []), [allMyTeams]);
  const {
    data: listeDesFils,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch: relireLaListe,
  } = useGetChats({
    currentUserClubId: userData?.club?.documentId,
    currentUserId: userData?.documentId,
    currentUserTeamIds: mesEquipes,
  });
  const { data: mesBlocages } = /** @type {{ data?: any[] }} */ (
    useGetMyBlockedUsers({ enabled: peutBloquer(userData) })
  );
  const [recherche, setRecherche] = useState('');
  const [portee, setPortee] = useState('all');
  const [afficheArchivees, setAfficheArchivees] = useState(false);
  const [menu, setMenu] = useState(
    /** @type {{ declencheur: HTMLElement, fil: any, x: number, y: number } | null} */ (null),
  );
  const menuRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const listeRef = useRef(/** @type {HTMLElement | null} */ (null));
  const finDeListeRef = useRef(/** @type {HTMLDivElement | null} */ (null));

  const filsTries = useMemo(() => {
    const pages = /** @type {any} */ (listeDesFils)?.pages;
    const fils = Array.isArray(pages)
      ? pages.flatMap((/** @type {any} */ page) => page?.data || [])
      : [];
    return trierLesFils(hideBlockedChats(fils, meId, toBlockedUserIdSet(mesBlocages || [])), meId);
  }, [listeDesFils, meId, mesBlocages]);
  // 🛟 MSG-SUPPORT (20/10) — l'assistance est épinglée à part, en tête (comme au
  // téléphone) ; elle quitte donc les lignes ordinaires.
  const { autres: filsSansAssistance, filDAssistance } = separerLeFilDAssistance(filsTries);
  const monClubId = userData?.club?.documentId || null;
  // R17-CANAUX (décision d'Adel « B ») — « Toute la ville » n'est pas montré à un mineur connu.
  const mineur = estMineurConnu(userData);
  const actifs = filsSansAssistance.filter((fil) => !estArchivePourMoi(fil, meId));
  const archivees = filsDeLaMessagerie(
    filsSansAssistance.filter((fil) => estArchivePourMoi(fil, meId)),
    { mineur, monClubId },
  );
  // Le dernier fil desarchive : la liste ordinaire revient seule (prototype : `showArch`).
  const enModeArchivees = afficheArchivees && archivees.length > 0;
  useEffect(() => {
    if (archivees.length === 0) setAfficheArchivees(false);
  }, [archivees.length]);
  // La liste arrive par pages de 20, archives melees : la page des archives lit les suivantes
  // (comme le telephone).
  useEffect(() => {
    if (enModeArchivees && hasNextPage && !isFetchingNextPage) fetchNextPage?.();
  }, [enModeArchivees, fetchNextPage, hasNextPage, isFetchingNextPage]);
  // Les pages suivantes : des que le bas de la liste parait (FlashList.onEndReached au telephone).
  useEffect(() => {
    const fin = finDeListeRef.current;
    if (!fin || !hasNextPage) return undefined;
    if (typeof window.IntersectionObserver === 'undefined') return undefined;
    const observateur = new window.IntersectionObserver((entrees) => {
      if (entrees.some((entree) => entree.isIntersecting) && !isFetchingNextPage) fetchNextPage?.();
    }, { root: listeRef.current, rootMargin: '0px 0px 200px 0px' });
    observateur.observe(fin);
    return () => observateur.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  // Le menu prend le focus ; Echap le ferme et rend le focus a ce qui l a ouvert ; un clic a cote
  // le ferme aussi (comme le menu ⋮ du fil).
  useEffect(() => {
    if (!menu) return undefined;
    const premiere = /** @type {HTMLElement | null | undefined} */ (
      menuRef.current?.querySelector('[role="menuitem"]')
    );
    premiere?.focus?.();
    const surTouche = (/** @type {KeyboardEvent} */ event) => {
      if (event.key !== 'Escape') return;
      setMenu(null);
      menu.declencheur?.focus?.();
    };
    const surClic = (/** @type {MouseEvent} */ event) => {
      if (menuRef.current?.contains(/** @type {Node} */ (event.target))) return;
      setMenu(null);
    };
    document.addEventListener('keydown', surTouche);
    document.addEventListener('mousedown', surClic);
    return () => {
      document.removeEventListener('keydown', surTouche);
      document.removeEventListener('mousedown', surClic);
    };
  }, [menu]);

  const nomDuFil = (/** @type {any} */ fil) => titreDuFil(t, { chat: fil }) || getConversationName({
    chatClub: fil?.club,
    chatGroupName: fil?.groupName,
    chatLeagueMatch: fil?.league_match,
    chatMultisportClub: fil?.multisportClub,
    chatParticipants: fil?.participants,
    chatTeam: fil?.team,
    chatType: fil?.type,
    meId,
  }) || t('common.chat', 'Conversation');
  const fils = filtrerLesFils(
    enModeArchivees ? archivees : filsDeLaMessagerie(actifs, { mineur, monClubId }),
    { nomDuFil, portee, recherche },
  );
  let listeVide = t('messaging.noData', 'Aucune conversation trouvée.');
  if (recherche.trim()) listeVide = t('messaging.noSearchResults', 'Aucune conversation trouvée.');
  else if (portee === 'league') {
    listeVide = t('messaging.noLeagueData', 'Aucune conversation League.');
  } else if (portee === 'classic') {
    listeVide = t('messaging.noClassicData', 'Aucune conversation classique.');
  }

  // Le meme geste archive un fil ordinaire et desarchive un fil archive (comme le telephone) ;
  // idem pour epingler.
  const basculer = async (/** @type {'archive' | 'epingle'} */ geste, /** @type {any} */ fil) => {
    const id = String(fil?.documentId || '');
    if (!id) return;
    const deja = geste === 'archive' ? estArchivePourMoi(fil, meId) : estEpinglePourMoi(fil, meId);
    let erreurParDefaut = deja
      ? t('messaging.unpinError', 'Impossible de désépingler cette conversation.')
      : t('messaging.pinError', "Impossible d'épingler cette conversation.");
    if (geste === 'archive') {
      erreurParDefaut = deja
        ? t('messaging.unarchiveError', 'Impossible de désarchiver cette conversation.')
        : t('messaging.archiveError', "Impossible d'archiver cette conversation.");
    }
    try {
      if (geste === 'archive') {
        await (deja ? gestes.unarchiveChatAsync(id) : gestes.archiveChatAsync(id));
      } else {
        await (deja ? gestes.unpinChatAsync(id) : gestes.pinChatAsync(id));
      }
    } catch (error) {
      // eslint-disable-next-line no-alert -- le meme retour que les autres gestes du fil du site
      window.alert(getErrorMessage(error, erreurParDefaut));
    }
  };
  const libelleDuMenu = t('messaging.conversationOptions', 'Options de la conversation');
  const portees = [
    { libelle: t('messaging.filters.all', 'Toutes'), valeur: 'all' },
    { libelle: t('messaging.filters.classic', 'Classique'), valeur: 'classic' },
    { libelle: t('messaging.filters.league', 'League'), valeur: 'league' },
  ];
  const styleDeLEntree = {
    alignItems: 'center',
    background: 'transparent',
    border: 0,
    borderRadius: 10,
    color: PALETTE_DU_FIL.texte,
    cursor: 'pointer',
    display: 'flex',
    fontFamily: 'Montserrat-Regular, sans-serif',
    fontSize: 15,
    gap: 12,
    minHeight: 44,
    padding: '0 14px',
    textAlign: /** @type {const} */ ('left'),
  };
  return (
    <aside
      aria-label={t('conversation.web.fil.titreListe', 'Messages')}
      data-testid="MSG1W-colonne-messages"
      style={{
        background: PALETTE_DU_FIL.fil,
        border: `1px solid ${PALETTE_DU_FIL.filet}`,
        borderRadius: 20,
        display: 'grid',
        gridTemplateRows: 'auto minmax(0, 1fr)',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          background: PALETTE_DU_FIL.barre,
          borderBottom: `1px solid ${PALETTE_DU_FIL.filet}`,
          boxSizing: 'border-box',
          display: 'grid',
          gap: 10,
          padding: '10px 14px 12px 18px',
        }}
      >
        <div
          style={{
            alignItems: 'center', display: 'flex', justifyContent: 'space-between', minHeight: 42,
          }}
        >
          <h2
            style={{
              color: PALETTE_DU_FIL.texte,
              fontFamily: 'Montserrat-Bold, sans-serif',
              fontSize: 20,
              margin: 0,
            }}
          >
            {t('conversation.web.fil.titreListe', 'Messages')}
          </h2>
          <button
            aria-label={t('conversation.web.fil.nouvelleDiscussion', 'Nouvelle discussion')}
            onClick={() => navigation.navigate(RouteNames.NewConversation)}
            style={{
              alignItems: 'center',
              background: PALETTE_DU_FIL.accent,
              border: 0,
              borderRadius: 999,
              cursor: 'pointer',
              display: 'flex',
              height: 36,
              justifyContent: 'center',
              padding: 0,
              width: 36,
            }}
            type="button"
          >
            <GlyphIcon color={PALETTE_DU_FIL.encre} name="plus2" size={20} />
          </button>
        </div>
        {/* SMF — la recherche et la portee de la page de la messagerie (README §3.13). */}
        <div
          style={{
            alignItems: 'center',
            background: PALETTE_DU_FIL.menu,
            border: `1px solid ${PALETTE_DU_FIL.menuBord}`,
            borderRadius: 999,
            display: 'flex',
            gap: 8,
            minHeight: 40,
            padding: '0 14px',
          }}
        >
          <GlyphIcon color={PALETTE_DU_FIL.texteDoux} name="search" size={16} />
          <input
            aria-label={t('messaging.searchPlaceholder', 'Rechercher une conversation...')}
            onChange={(event) => setRecherche(event.target.value)}
            placeholder={t('messaging.searchPlaceholder', 'Rechercher une conversation...')}
            style={{
              background: 'transparent',
              border: 0,
              color: PALETTE_DU_FIL.texte,
              flex: 1,
              fontFamily: 'Montserrat-Regular, sans-serif',
              fontSize: 14,
              minWidth: 0,
              outline: 'none',
            }}
            type="search"
            value={recherche}
          />
        </div>
        <div
          aria-label={t('messaging.filters.label', 'Conversations à afficher')}
          role="group"
          style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}
        >
          {portees.map(({ libelle, valeur }) => (
            <button
              aria-pressed={portee === valeur}
              key={valeur}
              onClick={() => setPortee(valeur)}
              style={{
                background: portee === valeur ? PALETTE_DU_FIL.accent : 'transparent',
                border: `1px solid ${
                  portee === valeur ? PALETTE_DU_FIL.accent : PALETTE_DU_FIL.menuBord
                }`,
                borderRadius: 999,
                color: portee === valeur ? PALETTE_DU_FIL.encre : PALETTE_DU_FIL.texte,
                cursor: 'pointer',
                fontFamily: 'Montserrat-Bold, sans-serif',
                fontSize: 13,
                minHeight: 32,
                padding: '0 14px',
              }}
              type="button"
            >
              {libelle}
            </button>
          ))}
        </div>
      </div>
      <nav ref={listeRef} style={{ overflowY: 'auto' }}>
        <style>{ARCHIVEES_STYLE}</style>
        {/* R17-CANAUX (19/10) — plus de canaux de la Ville épinglés au-dessus : le canal des
            dirigeants et « Toute la ville » sont des lignes (filsDeLaMessagerie). Reste la
            demande « mes canaux » et, GARDE (décision « C » du chef), la carte « Actualités de la
            Ville » tant que la liste n a pas « Toute la ville » ; comme sur staging, ni en
            archives ni en recherche, et rien avant que la liste soit lue. */}
        <CanauxDeLaVille
          chats={listeDesFils && !enModeArchivees && !recherche.trim() ? actifs : undefined}
          mineur={mineur}
          navigation={navigation}
          style={{ paddingHorizontal: 14, paddingTop: 12 }}
        />
        {archivees.length > 0 ? (
          <button
            data-testid="ARCH-colonne-archivees"
            onClick={() => setAfficheArchivees(!enModeArchivees)}
            style={{
              alignItems: 'center',
              background: 'transparent',
              border: 0,
              borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
              color: PALETTE_DU_FIL.texte,
              cursor: 'pointer',
              display: 'flex',
              fontFamily: 'Montserrat-Bold, sans-serif',
              fontSize: 15,
              gap: 12,
              minHeight: 52,
              padding: '0 14px',
              textAlign: 'left',
              width: '100%',
            }}
            type="button"
          >
            <span
              aria-hidden="true"
              style={{ display: 'inline-flex', justifyContent: 'center', width: 52 }}
            >
              <GlyphIcon color={withAlpha(colors.neutral00, 0.7)} name="boxArchive" size={20} />
            </span>
            <span style={{ flex: 1 }}>
              {enModeArchivees
                ? t('messaging.archivedBack', 'Retour aux discussions')
                : t('messaging.archived', 'Archivées')}
            </span>
            <span
              style={{
                color: withAlpha(colors.neutral00, 0.5),
                fontFamily: 'Montserrat-Regular, sans-serif',
                fontSize: 13,
              }}
            >
              {archivees.length}
            </span>
          </button>
        ) : null}
        {enModeArchivees ? null : (
          <LigneAssistance
            fil={filDAssistance}
            meId={meId}
            navigation={navigation}
            onFilCree={() => { relireLaListe?.(); }}
            style={{ paddingHorizontal: 14 }}
          />
        )}
        {fils.length === 0 && filsTries.length > 0 ? (
          <p
            style={{
              color: PALETTE_DU_FIL.texteDoux, fontSize: 14, margin: 0, padding: '18px 14px',
            }}
          >
            {listeVide}
          </p>
        ) : null}
        {fils.map((/** @type {any} */ fil) => {
          const id = String(fil?.documentId || '');
          const titre = nomDuFil(fil);
          const dernier = getChatLastMessage(fil);
          const deMoi = Boolean(meId) && dernier?.sender?.documentId === meId;
          const nonLus = formatThreadUnreadBadge(fil?.unreadCount);
          const ouvert = id === chatId;
          const epingle = estEpinglePourMoi(fil, meId);
          const prenom = !deMoi && fil?.type !== 'whisper'
            ? String(dernier?.sender?.firstname || '').trim()
            : '';
          return (
            <div className="ARCH-ligne" key={`ligne-${id}`} style={{ position: 'relative' }}>
              <button
                aria-current={ouvert ? 'page' : undefined}
                data-testid={`MSG1W-ligne-${id}`}
                onClick={() => {
                  if (ouvert) return;
                  navigation.navigate(RouteNames.Conversation, { chatId: id, chatType: fil?.type });
                }}
                // ARCHIVEES — le clic droit ouvre le menu de la ligne, la ou on a clique.
                onContextMenu={(event) => {
                  event.preventDefault();
                  setMenu({
                    declencheur: event.currentTarget, fil, x: event.clientX, y: event.clientY,
                  });
                }}
                style={{
                  alignItems: 'center',
                  background: ouvert ? PALETTE_DU_FIL.bulleRecue : 'transparent',
                  border: 0,
                  borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
                  color: PALETTE_DU_FIL.texte,
                  cursor: 'pointer',
                  display: 'flex',
                  gap: 12,
                  minHeight: 72,
                  padding: '8px 14px',
                  textAlign: 'left',
                  width: '100%',
                }}
                type="button"
              >
                <span
                  aria-hidden="true"
                  style={{
                    alignItems: 'center',
                    background: couleurDeLaPersonne({ documentId: id }),
                    borderRadius: '50%',
                    color: PALETTE_DU_FIL.encre,
                    display: 'inline-flex',
                    flexShrink: 0,
                    fontFamily: 'Montserrat-Bold, sans-serif',
                    fontSize: 16,
                    height: 52,
                    justifyContent: 'center',
                    width: 52,
                  }}
                >
                  {getInitials(titre)}
                </span>
                <span
                  style={{
                    display: 'grid', flex: 1, gap: 4, minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      alignItems: 'baseline',
                      display: 'flex',
                      gap: 8,
                      justifyContent: 'space-between',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'Montserrat-Bold, sans-serif',
                        fontSize: 16,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {titre}
                    </span>
                    <span
                      style={{
                        color: nonLus ? PALETTE_DU_FIL.accent : PALETTE_DU_FIL.texteDoux,
                        flexShrink: 0,
                        fontFamily: nonLus ? 'Montserrat-Bold, sans-serif' : undefined,
                        fontSize: 12.5,
                      }}
                    >
                      {dernier ? formatChatTimestamp(dernier.createdAt) : ''}
                    </span>
                  </span>
                  <span style={{ alignItems: 'center', display: 'flex', gap: 6 }}>
                    {deMoi ? (
                      <GlyphIcon color={PALETTE_DU_FIL.texteDoux} name="checkDouble" size={16} />
                    ) : null}
                    <span
                      style={{
                        color: 'rgba(255, 255, 255, 0.58)',
                        flex: 1,
                        fontSize: 14,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {prenom ? (
                        <span style={{ color: 'rgba(255, 255, 255, 0.8)' }}>{`${prenom} : `}</span>
                      ) : null}
                      {dernier ? getChatMessagePreview(dernier, t) : ''}
                    </span>
                    {/* SMF — l epingle de 15 (SPECS §7), avant la pastille de non-lus. */}
                    {epingle ? (
                      <span
                        aria-label={t('messaging.pinnedBadge', 'Épinglé')}
                        data-testid={`SMF-epingle-${id}`}
                        role="img"
                        style={{ display: 'inline-flex', flexShrink: 0 }}
                      >
                        <GlyphIcon color={PALETTE_DU_FIL.texteDoux} name="thumbtack" size={15} />
                      </span>
                    ) : null}
                    {nonLus ? (
                      <span
                        style={{
                          background: PALETTE_DU_FIL.accent,
                          borderRadius: 999,
                          color: PALETTE_DU_FIL.encre,
                          flexShrink: 0,
                          fontFamily: 'Montserrat-Bold, sans-serif',
                          fontSize: 11.5,
                          minWidth: 20,
                          padding: '2px 6px',
                          textAlign: 'center',
                        }}
                      >
                        {nonLus}
                      </span>
                    ) : null}
                  </span>
                </span>
              </button>
              {/* ARCHIVEES — le « … » de la ligne (au survol, au clavier, toujours au doigt). */}
              <button
                aria-expanded={menu?.fil === fil}
                aria-haspopup="menu"
                aria-label={libelleDuMenu}
                className="ARCH-options"
                data-testid={`ARCH-options-${id}`}
                onClick={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  setMenu({
                    declencheur: event.currentTarget, fil, x: rect.left, y: rect.bottom + 4,
                  });
                }}
                style={{
                  alignItems: 'center',
                  background: PALETTE_DU_FIL.menu,
                  border: `1px solid ${PALETTE_DU_FIL.menuBord}`,
                  borderRadius: 999,
                  cursor: 'pointer',
                  display: 'flex',
                  height: 28,
                  justifyContent: 'center',
                  padding: 0,
                  position: 'absolute',
                  right: 8,
                  top: 22,
                  width: 28,
                }}
                type="button"
              >
                <GlyphIcon color={PALETTE_DU_FIL.texte} name="dotsVertical" size={16} />
              </button>
            </div>
          );
        })}
        {/* SMF — le bas de la liste : quand il parait, la page suivante se charge. */}
        <div aria-hidden="true" ref={finDeListeRef} style={{ height: 1 }} />
      </nav>
      {menu ? (
        <div
          aria-label={libelleDuMenu}
          ref={menuRef}
          role="menu"
          style={{
            background: PALETTE_DU_FIL.menu,
            border: `1px solid ${PALETTE_DU_FIL.menuBord}`,
            borderRadius: 16,
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
            display: 'grid',
            left: Math.max(8, Math.min(menu.x, window.innerWidth - 238)),
            minWidth: 230,
            padding: 6,
            position: 'fixed',
            top: Math.max(8, Math.min(menu.y, window.innerHeight - 108)),
            zIndex: 1100,
          }}
        >
          {/* SMF — « Épingler » / « Désépingler », comme l apercu du telephone (MSG1BA §3.14). */}
          <button
            className="MSG1W-ligne-menu"
            onClick={() => {
              const { fil } = menu;
              setMenu(null);
              basculer('epingle', fil);
            }}
            role="menuitem"
            style={styleDeLEntree}
            type="button"
          >
            <GlyphIcon color={PALETTE_DU_FIL.texte} name="thumbtack" size={18} />
            {estEpinglePourMoi(menu.fil, meId)
              ? t('messaging.unpin', 'Désépingler')
              : t('messaging.pin', 'Épingler')}
          </button>
          <button
            className="MSG1W-ligne-menu"
            onClick={() => {
              const { fil } = menu;
              setMenu(null);
              basculer('archive', fil);
            }}
            role="menuitem"
            style={styleDeLEntree}
            type="button"
          >
            <GlyphIcon color={PALETTE_DU_FIL.texte} name="boxArchive" size={18} />
            {estArchivePourMoi(menu.fil, meId)
              ? t('messaging.unarchive', 'Désarchiver')
              : t('messaging.archive', 'Archiver')}
          </button>
        </div>
      ) : null}
    </aside>
  );
}

/**
 * MSG1W §3.1 — LE CADRE A LA HAUTEUR DE L ECRAN : sa hauteur, mesuree sous ce qui le precede, et
 * remesuree quand la fenetre change ou que `declencheur` change (le fil vient d arriver).
 * @param {{ current: HTMLElement | null }} cadreRef - Le cadre.
 * @param {boolean} isDesktop - Ordinateur (20 px de marge en bas) ou telephone (96 : les onglets).
 * @param {unknown} declencheur - Ce qui oblige a remesurer.
 * @returns {number} La hauteur, 0 tant qu elle n est pas mesuree.
 */
function useHauteurDuCadre(cadreRef, isDesktop, declencheur) {
  const [hauteurDuCadre, setHauteurDuCadre] = useState(0);
  useEffect(() => {
    // Le banc jest (react-native) n a pas de fenetre a mesurer : rien a faire.
    if (typeof window === 'undefined') return undefined;
    if (typeof window.addEventListener !== 'function') return undefined;
    const mesurer = () => {
      const cadre = cadreRef.current;
      if (!cadre?.getBoundingClientRect) return;
      const haut = cadre.getBoundingClientRect().top + (window.scrollY || 0);
      const reserveDuBas = isDesktop ? 20 : 96;
      setHauteurDuCadre(Math.max(420, Math.round(window.innerHeight - haut - reserveDuBas)));
    };
    mesurer();
    window.addEventListener('resize', mesurer);
    return () => window.removeEventListener('resize', mesurer);
  }, [cadreRef, declencheur, isDesktop]);
  return hauteurDuCadre;
}

/**
 * ARCHIVEES — le « … » d une ligne de la colonne n apparait qu au survol de la ligne (ou au focus
 * clavier) ; au doigt il n existe aucun survol, il reste donc visible (memes regles que
 * `REACTION_HOVER_STYLE`). Transparent, il ne prend aucun clic.
 */
const ARCHIVEES_STYLE = `
  .ARCH-ligne .ARCH-options { opacity: 0; pointer-events: none; }
  .ARCH-ligne:hover .ARCH-options,
  .ARCH-ligne:focus-within .ARCH-options,
  .ARCH-options[aria-expanded="true"] { opacity: 1; pointer-events: auto; }
  @media (hover: none) {
    .ARCH-ligne .ARCH-options { opacity: 1; pointer-events: auto; }
  }
`;

/**
 * MSG1W §3.5 — UNE FENETRE DU SITE : les feuilles du bas du telephone deviennent des fenetres
 * centrees (titre, croix, contenu qui defile). Echap la ferme (effet de l ecran).
 * @param {{ children: any, compacte?: boolean, idTitre: string, onFermer: () => void,
 *   titre: string }} props - Le contenu, la taille (telephone), le titre et la fermeture.
 * @returns {import('react').ReactElement} La fenetre.
 */
function FenetreDuSite({
  children, compacte = false, idTitre, onFermer, titre,
}) {
  return (
    <div
      style={{
        alignItems: 'center',
        background: PALETTE_DU_FIL.voile,
        display: 'flex',
        inset: 0,
        justifyContent: 'center',
        position: 'fixed',
        zIndex: 1100,
      }}
    >
      <div
        aria-labelledby={idTitre}
        aria-modal="true"
        role="dialog"
        style={{
          background: PALETTE_DU_FIL.feuille,
          borderRadius: 22,
          boxSizing: 'border-box',
          display: 'grid',
          gap: 14,
          gridTemplateRows: 'auto minmax(0, 1fr)',
          // Sur telephone, la barre d onglets du site couvre le bas de l ecran.
          maxHeight: compacte ? 'calc(100vh - 200px)' : 'calc(100vh - 48px)',
          padding: 20,
          width: 'min(560px, calc(100vw - 32px))',
        }}
      >
        <div
          style={{
            alignItems: 'center', display: 'flex', gap: 10, justifyContent: 'space-between',
          }}
        >
          <h2
            id={idTitre}
            style={{
              color: PALETTE_DU_FIL.texte,
              fontFamily: 'Montserrat-Bold, sans-serif',
              fontSize: 18,
              margin: 0,
            }}
          >
            {titre}
          </h2>
          <button
            aria-label={i18next.t('common.actions.close', 'Fermer')}
            onClick={onFermer}
            style={{
              alignItems: 'center',
              background: PALETTE_DU_FIL.menuBord,
              border: 0,
              borderRadius: 999,
              color: PALETTE_DU_FIL.texte,
              cursor: 'pointer',
              display: 'flex',
              flexShrink: 0,
              height: 32,
              justifyContent: 'center',
              padding: 0,
              width: 32,
            }}
            type="button"
          >
            {DESSIN_FERMER}
          </button>
        </div>
        {/* SMF (T20) — des lignes a la hauteur de leur contenu : sans `max-content`, la grille
            tassait ses lignes a la hauteur de la fenetre des que le contenu la depassait, et
            les grandes cartes du planning (EventCardNew, `minHeight: 0`) s empilaient. */}
        <div
          style={{
            display: 'grid', gap: 12, gridAutoRows: 'max-content', minHeight: 0, overflowY: 'auto',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * MSG1W — UNE CONFIRMATION DU SITE (SPECS §4 : boite de 300, titre centre, « Annuler » au contour,
 * l action en rouge). Pour supprimer un message, retirer un membre, bloquer une personne,
 * quitter un groupe (la question seule, sans texte, comme le telephone).
 * @param {{ id: string, libelleAction: string, onAnnuler: () => void, onConfirmer: () => void,
 *   texte?: string, titre: string }} props - Les mots et les deux gestes.
 * @returns {import('react').ReactElement} La confirmation.
 */
function ConfirmationDuSite({
  id, libelleAction, onAnnuler, onConfirmer, texte, titre,
}) {
  return (
    <div
      style={{
        alignItems: 'center',
        background: PALETTE_DU_FIL.voile,
        display: 'flex',
        inset: 0,
        justifyContent: 'center',
        position: 'fixed',
        zIndex: 1150,
      }}
    >
      <div
        aria-describedby={texte ? `${id}-texte` : undefined}
        aria-labelledby={`${id}-titre`}
        aria-modal="true"
        role="alertdialog"
        style={{
          background: PALETTE_DU_FIL.feuille,
          borderRadius: 20,
          boxSizing: 'border-box',
          display: 'grid',
          gap: 12,
          padding: 20,
          textAlign: 'center',
          width: 'min(300px, calc(100vw - 32px))',
        }}
      >
        <h2
          id={`${id}-titre`}
          style={{
            color: PALETTE_DU_FIL.texte,
            fontFamily: 'Montserrat-Bold, sans-serif',
            fontSize: 17,
            margin: 0,
          }}
        >
          {titre}
        </h2>
        {texte ? (
          <p
            id={`${id}-texte`}
            style={{ color: PALETTE_DU_FIL.texteDoux, fontSize: 14, margin: 0 }}
          >
            {texte}
          </p>
        ) : null}
        <div
          style={{
            display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr', marginTop: 6,
          }}
        >
          <button onClick={onAnnuler} style={STYLE_BOUTON_CONTOUR} type="button">
            {i18next.t('common.actions.cancel', 'Annuler')}
          </button>
          <button
            onClick={onConfirmer}
            style={{
              ...STYLE_BOUTON_CONTOUR,
              background: withAlpha(PALETTE_DU_FIL.danger, 0.16),
              border: `1.5px solid ${PALETTE_DU_FIL.danger}`,
              color: PALETTE_DU_FIL.danger,
            }}
            type="button"
          >
            {libelleAction}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Un champ d une fenetre du site (proposition de match). */
/** @type {import('react').CSSProperties} */
const STYLE_CHAMP_DE_FENETRE = {
  background: PALETTE_DU_FIL.champ,
  border: `1px solid ${PALETTE_DU_FIL.champBord}`,
  borderRadius: 14,
  boxSizing: 'border-box',
  color: PALETTE_DU_FIL.texte,
  fontFamily: 'Montserrat-Regular, sans-serif',
  fontSize: 15,
  outline: 'none',
  padding: '12px 14px',
  width: '100%',
};

/** MSG1W §3.5 — l icone de chaque entree du « + » (pastille ronde, feuille du telephone). */
const ICONES_DU_PLUS = {
  contact: 'idCard',
  convocation: <ConvocationGlyph color={PALETTE_DU_FIL.accent} name="clipboardUser" size={18} />,
  document: 'fileArrowUp',
  event: 'calendar',
  // Le jeu de glyphes de l app n a ni photo ni repere : deux dessins au trait.
  location: (
    <svg
      aria-hidden="true"
      fill="none"
      height="18"
      stroke={PALETTE_DU_FIL.accent}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="18"
    >
      <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  ),
  photos: (
    <svg
      aria-hidden="true"
      fill="none"
      height="18"
      stroke={PALETTE_DU_FIL.accent}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="18"
    >
      <rect height="16" rx="2" width="18" x="3" y="4" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="m21 16-5-5-9 9" />
    </svg>
  ),
  poll: 'chartColumn',
  proposal: 'calendarDays',
};

/**
 * L icone d une entree du « + » : un glyphe de l app (nom), ou un dessin.
 * @param {{ cle: string }} props - La clef de l entree.
 * @returns {import('react').ReactElement | null} L icone.
 */
function IconeDuPlus({ cle }) {
  /** @type {any} */
  const icone = ICONES_DU_PLUS[/** @type {keyof typeof ICONES_DU_PLUS} */ (cle)];
  if (typeof icone === 'string') {
    return <GlyphIcon color={PALETTE_DU_FIL.accent} name={icone} size={18} />;
  }
  return icone || null;
}

/** MSG1W §3.2 — l icone de chaque action du menu (cles de messageActions.js). */
const ICONES_DU_MENU = {
  copy: DESSIN_COPIER,
  delete: <GlyphIcon color={PALETTE_DU_FIL.danger} name="trashAlt" size={20} />,
  edit: DESSIN_MODIFIER,
  editComposition: DESSIN_MODIFIER,
  reply: DESSIN_REPONDRE,
  report: DESSIN_SIGNALER,
};

/** Le bouton au contour d une fenetre (« Annuler »). */
/** @type {import('react').CSSProperties} */
const STYLE_BOUTON_CONTOUR = {
  background: 'transparent',
  border: `1.5px solid ${PALETTE_DU_FIL.accent}`,
  borderRadius: 999,
  color: PALETTE_DU_FIL.accent,
  cursor: 'pointer',
  fontFamily: 'Montserrat-Bold, sans-serif',
  fontSize: 15,
  minHeight: 46,
  padding: '0 18px',
};

/** Le bouton plein d une fenetre (« Enregistrer »). */
/** @type {import('react').CSSProperties} */
const STYLE_BOUTON_PLEIN = {
  ...STYLE_BOUTON_CONTOUR,
  background: PALETTE_DU_FIL.accent,
  border: 0,
  color: PALETTE_DU_FIL.encre,
};

/** Les gestes rouges du bas des infos du groupe (« Quitter le groupe », « Signaler le groupe »). */
/** @type {import('react').CSSProperties} */
const STYLE_BOUTON_ROUGE_DES_INFOS = {
  background: 'transparent',
  border: `1px solid ${PALETTE_DU_FIL.menuBord}`,
  borderRadius: 14,
  color: PALETTE_DU_FIL.danger,
  cursor: 'pointer',
  fontFamily: 'Montserrat-Bold, sans-serif',
  fontSize: 15,
  minHeight: 48,
};

/**
 * Le mot d une puce de date « [Aujourd'hui] » (format de moment, celui du telephone) sans ses
 * crochets.
 * @param {string} valeur - La traduction.
 * @returns {string} Le mot.
 */
const sansCrochets = (valeur) => String(valeur || '').replace(/[[\]]/g, '');

// @ts-ignore: FIXME: Baseline TS regression
const formatDurationLabel = (durationMs) => {
  const totalSeconds = Math.max(0, Math.round(Number(durationMs || 0) / 1000))
  if (!totalSeconds) return ''
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes > 0 ? `${minutes}:${String(seconds).padStart(2, '0')}` : `${seconds}s`
}

/**
 * @param {{ navigation: any, route: any }} props
 */
function Conversation({ navigation, route }) {
  const chatId = String(route?.params?.chatId || '').trim()
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const { width } = useWindowDimensions()
  const isDesktop = width >= BREAKPOINTS.desktop
  const {
    Colors,
    Images,
  } = useTheme()
  // Sur le site, une image du theme est une adresse (`images.web.js` : { uri }).
  const adresseDuMotif = /** @type {{ uri?: string } | undefined} */ (Images?.motifDuFil)?.uri;
  const {
    hasClubAccess,
    userData,
  } = useAuth()
  const {
    archiveChatAsync,
    deleteMessage,
    editMessage,
    joinChat,
    leaveChat,
    pinChatAsync,
    reactToMessage,
    removeGroupMember,
    respondToProposal,
    retryFailedMessage: retryFailedMessageSansVoix,
    sendMessage: sendMessageSansVoix,
    sendReadReceipt,
    sendTypingStart,
    sendTypingStop,
    socket,
    unarchiveChatAsync,
    unpinChatAsync,
    updateGroupMeta,
    votePoll,
  } = useMessaging(chatId)

  const [composerText, setComposerText] = useState('')
  // COLL-C4A2 (02/10) — « Demander au club de compléter sa fiche » ouvre la conversation privée
  // avec une phrase prête à envoyer : on la relit, on l'envoie ou on la change.
  const brouillonDuFil = route?.params?.brouillon;
  useEffect(() => {
    if (brouillonDuFil) setComposerText((actuel) => actuel || String(brouillonDuFil));
  }, [brouillonDuFil]);
  const [replyTarget, setReplyTarget] = useState(/** @type {any} */ (null));
  const [isSending, setIsSending] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [proposalDate, setProposalDate] = useState('')
  const [proposalStartTime, setProposalStartTime] = useState('')
  const [proposalEndTime, setProposalEndTime] = useState('')
  const [proposalVenue, setProposalVenue] = useState('')
  const [proposalAddress, setProposalAddress] = useState('')
  const [isRecordingVoice, setIsRecordingVoice] = useState(false)
  const [isStoppingVoice, setIsStoppingVoice] = useState(false)
  const [isSubmittingProposal, setIsSubmittingProposal] = useState(false)
  const [, setReportedMessageId] = useState('')
  // REACT-WEB — le message dont la barre de six emojis est ouverte, ou une chaine
  // vide. UN SEUL ETAT : un booleen « ouverte » doublé d un identifiant pourraient
  // se contredire, et deux barres s ouvrir en meme temps.
  const [reactionBarMessageId, setReactionBarMessageId] = useState('');
  // MSGIMG — l adresse de la photo ouverte en grand, ou une chaine vide (fermee).
  const [imageEnGrand, setImageEnGrand] = useState('');
  const fermerLImageEnGrand = useCallback(() => setImageEnGrand(''), []);
  const [reactionBarAnchor, setReactionBarAnchor] = useState(
    /** @type {{left: number, top: number} | null} */ (null),
  );
  // WHATSAPP — LE CLAVIER EST UN TROISIEME ETAT DU MEME PANNEAU, pas un second
  // panneau : il reutilise l identifiant, l ancre et la reference de la barre, et
  // herite donc sans une ligne de plus d Echap, du clic a cote et du defilement,
  // deja ecrits juste en dessous.
  const [clavierOuvert, setClavierOuvert] = useState(false);
  const [familleEmoji, setFamilleEmoji] = useState(EMOJI_CATALOG[0]?.key ?? '');
  const reactionTriggerRef = useRef(/** @type {HTMLButtonElement | null} */ (null));
  const reactionBarRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  // MSGREACT — la requete est la MEME que celle du telephone, donc la socket
  // `message-reaction-updated` qui met a jour cette reserve (useMessaging) tient
  // aussi ici : une reaction posee depuis un autre appareil arrive toute seule.
  const { data: chatReactionsData } = useGetChatMessageReactions(chatId);
  const reactionsByMessage = useMemo(
    () => indexReactionsByMessage(chatReactionsData?.data),
    [chatReactionsData?.data],
  );
  const messagePaneRef = useRef(null)
  const typingTimeoutRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null))
  const handledSharedEventFromPickerRef = useRef('')
  const voiceRecorderRef = useRef(null)
  // MSG1W §3.1 — le cadre a la hauteur de l ecran, « revenir en bas », le menu « + », la saisie.
  const cadreRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const [loinDuBas, setLoinDuBas] = useState(false);
  // Vrai tant que le fil est colle en bas : une photo qui se charge l y laisse.
  const colleAuBasRef = useRef(true);
  const contenuDuFilRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const [menuAjouterOuvert, setMenuAjouterOuvert] = useState(false);
  const menuAjouterRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const saisieRef = useRef(/** @type {HTMLTextAreaElement | null} */ (null));
  // MSG1W §3.2 — le menu d un message (clic droit, ou la fleche du survol), et ses fenetres.
  const [menuDuMessage, setMenuDuMessage] = useState(
    /** @type {{ id: string, left: number, top: number } | null} */ (null),
  );
  const menuDuMessageRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const declencheurDuMenuRef = useRef(/** @type {HTMLElement | null} */ (null));
  const [messageEnEdition, setMessageEnEdition] = useState(/** @type {any} */ (null));
  const [texteEnEdition, setTexteEnEdition] = useState('');
  const [enregistrementEnCours, setEnregistrementEnCours] = useState(false);
  const [messageASupprimer, setMessageASupprimer] = useState(/** @type {any} */ (null));
  const [annonce, setAnnonce] = useState('');
  // MSG1W §3.5 — la fenetre ouverte depuis le « + » : '', 'evenement', 'contact', 'proposition'.
  const [fenetre, setFenetre] = useState('');
  // MSG1W (1-A, §3.18) — l adresse touchee dans un message ; '' : fenetre fermee.
  const [adresseOuverte, setAdresseOuverte] = useState('');
  const [sondageOuvert, setSondageOuvert] = useState(false);
  const [contactChoisi, setContactChoisi] = useState('');
  // MSG1W §3.16 — le menu ⋮, la fenetre « Infos du groupe » et ses confirmations.
  const [menuOptionsOuvert, setMenuOptionsOuvert] = useState(false);
  const menuOptionsRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const [infosOuvertes, setInfosOuvertes] = useState(false);
  const [nomEnEdition, setNomEnEdition] = useState(/** @type {string | null} */ (null));
  const [membreARetirer, setMembreARetirer] = useState(/** @type {any} */ (null));
  const [departAConfirmer, setDepartAConfirmer] = useState(false);
  const [blocageAConfirmer, setBlocageAConfirmer] = useState(false);

  const {
    data: chatData,
    error: chatError,
    isLoading: isChatLoading,
    refetch: refetchChat,
  } = useGetChatById(chatId)
  const {
    data: messagesPages,
    error: messagesError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isMessagesLoading,
    refetch: refetchMessages,
  } = useGetChatMessages({ chatId, pageSize: 30 })
  // 🏛️ COLL-C4A2 (02/10) — les fils de la Ville (canal des dirigeants, conversation privée) : le
  // titre, la ligne sous le titre, qui écrit et pour quel club, la voix demandée au serveur, et
  // « Tu ne fais plus partie de ce canal » (voir Conversation.js). Ailleurs, rien ne change.
  // 🛟 MSG-SUPPORT (20/10) — et l'assistance (views/chat/FilDAssistance.js).
  const filDeLaVille = useHabillageDuFil({
    chatData,
    chatId,
    espaceVille: route?.params?.espace === 'ville',
    messagesError,
    messagesPages,
    navigation,
    routeChatType: route?.params?.chatType || null,
  });
  const sendMessage = useCallback((
    /** @type {string} */ id,
    /** @type {string} */ texte,
    /** @type {Record<string, any>} */ extra = {},
  ) => sendMessageSansVoix(id, texte, { ...filDeLaVille.voix, ...extra }), [
    filDeLaVille.voix,
    sendMessageSansVoix,
  ]);
  // COLL-C4A3 (point 4) — « Renvoyer » redemande la MÊME voix que l'envoi (voir Conversation.js).
  const retryFailedMessage = useCallback((
    /** @type {string} */ id,
    /** @type {any} */ message,
  ) => retryFailedMessageSansVoix(id, message, filDeLaVille.voix), [
    filDeLaVille.voix,
    retryFailedMessageSansVoix,
  ]);
  // 🖥️ COLL-C4A3 (planche 47, P3c-canal-ordi) — sur ordinateur, depuis l'espace de la Ville, un
  // fil de la Ville s'ouvre en TROIS colonnes : ses canaux et conversations à gauche. La liste des
  // fils est la requête de la messagerie : la socket la réécrit, la colonne suit sans recharger.
  // Le type `Chat` ne connaît pas encore la Ville d'un fil (COLL-C4A2) : lue telle quelle.
  const villeDuFil = String(/** @type {any} */ (chatData)?.collectivite?.documentId || '');
  // MSG1W §3.13 — sur ordinateur, hors de l espace de la Ville, la liste « Messages » a gauche.
  const avecColonneDesMessages = isDesktop && route?.params?.espace !== 'ville';
  const avecColonneDeLaVille = Boolean(
    isDesktop && route?.params?.espace === 'ville' && filDeLaVille.estFil && villeDuFil,
  );
  // La colonne « Messages » charge sa liste elle-meme (SMF) ; celle-ci ne sert qu a la Ville.
  const { data: listeDesFils } = useGetChats({
    currentUserClubId: userData?.club?.documentId,
    currentUserId: userData?.documentId,
  }, { enabled: avecColonneDeLaVille });
  const filsDeLaColonne = useMemo(() => {
    const pages = listeDesFils?.pages;
    return Array.isArray(pages)
      ? pages.flatMap((/** @type {any} */ page) => page?.data || [])
      : [];
  }, [listeDesFils]);
  let colonnesDeLaGrille = isDesktop ? 'minmax(0, 1fr) minmax(300px, 360px)' : 'minmax(0, 1fr)';
  if (avecColonneDesMessages) {
    colonnesDeLaGrille = 'minmax(280px, 360px) minmax(0, 1fr) minmax(280px, 340px)';
  }
  if (avecColonneDeLaVille) {
    // MSG1W — le fil du milieu garde 360 px au moins : a 1 280 il etait ecrase a ~190 px.
    colonnesDeLaGrille = 'minmax(220px, 280px) minmax(360px, 1fr) minmax(260px, 320px)';
  }
  const { data: sharedEventsPages } = useGetEvents({
    compact: true,
    excludeType: 'Reservation',
    myTeams: true,
    pageSize: 20,
    sort: 'date:asc',
  }, {
    enabled: Boolean(chatId),
  })
  const reportMessageMutation = useMutation({
    mutationFn: createMessageReport,
    onError: (error) => {
      window.alert(getErrorMessage(error, i18next.t(
        'conversation.web.report.error',
        'Impossible de signaler ce message pour le moment.',
      )))
    },
    onSuccess: () => {
      window.alert(i18next.t(
        'conversation.web.report.sent',
        'Signalement envoyé. Merci, notre équipe va vérifier ce message.',
      ))
      setReportedMessageId('')
    },
  })

  const messages = useMemo(
    () => sortMessagesAscending(flattenInfinitePages(messagesPages?.pages)),
    [messagesPages?.pages],
  )

  const shareableEvents = useMemo(
    () => dedupeByDocumentId(flattenInfinitePages(sharedEventsPages?.pages)).slice(0, 24),
    [sharedEventsPages?.pages],
  )

  const shareableContacts = useMemo(() => {
    // @ts-ignore: FIXME: Baseline TS regression
    const participants = Array.isArray(chatData?.participants) ? chatData.participants : []
    return participants.filter((participant) => (
      participant?.documentId && participant.documentId !== userData?.documentId
    ))
  }, [chatData?.participants, userData?.documentId])

  const conversationName = useMemo(() => filDeLaVille.titre || getConversationName({
    chatClub: chatData?.club,
    chatGroupName: chatData?.groupName,
    chatLeagueMatch: chatData?.league_match,
    chatMultisportClub: chatData?.multisportClub,
    chatParticipants: chatData?.participants,
    chatTeam: chatData?.team,
    // @ts-ignore: FIXME: Baseline TS regression
    chatType: chatData?.type,
    meId: userData?.documentId,
  }) || 'Conversation', [chatData, filDeLaVille.titre, userData?.documentId]);

  const latestMessageId = messages.length > 0 ? getMessageId(messages[messages.length - 1]) : ''
  const leagueMatchId = getEntityDocumentId(chatData?.league_match)
  const leagueLegalMatchLabel = useMemo(() => {
    const match = chatData?.league_match
    if (!match) return 'Match FoundClub League'
    return `${match?.team_a?.name || i18next.t(
      'conversation.league.teamA',
      'Équipe A',
    )} VS ${match?.team_b?.name || 'Adversaire'}`
  }, [chatData?.league_match])
  const isLeagueConversation = chatData?.type === 'league_match'
  const canUseConversationActions = Boolean(chatId && chatData)
  const isVoiceRecordingSupported = typeof window !== 'undefined'
    && typeof navigator !== 'undefined'
    && Boolean(navigator.mediaDevices?.getUserMedia)
    && typeof window.MediaRecorder !== 'undefined'

  const invalidateConversationQueries = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['chat', chatId] }),
      queryClient.invalidateQueries({ queryKey: ['chat-messages', chatId] }),
      queryClient.invalidateQueries({ queryKey: ['chats'] }),
      queryClient.invalidateQueries({ queryKey: ['events'] }),
      queryClient.invalidateQueries({ queryKey: ['league-matches'] }),
    ])
  }, [chatId, queryClient])

  // @ts-ignore: FIXME: Baseline TS regression
  const requestWebLeagueLegalAcceptance = useCallback((scope, targetDocumentId, metadata = {}) => {
    const confirmed = window.confirm(
      i18next.t(
        'conversation.web.league.legalConfirm',
        "FoundClub League met en relation les équipes mais n'organise pas la rencontre. Confirmes-tu accepter les risques sportifs, vérifier ton assurance et respecter les règles du lieu ?", // eslint-disable-line max-len
      ),
    )
    if (!confirmed) return null
    return buildLeagueLegalAcceptancePayload({
      metadata,
      scope,
      sourceScreen: 'conversation_web_league',
      targetDocumentId,
      targetType: 'league_match',
    })
  }, [])

  useEffect(() => {
    if (!chatId) return undefined
    joinChat(chatId)
    return () => leaveChat(chatId)
  }, [chatId, joinChat, leaveChat])

  useEffect(() => () => {
    const recorder = voiceRecorderRef.current
    voiceRecorderRef.current = null
    // @ts-ignore: FIXME: Baseline TS regression
    if (recorder?.cancel) {
      // @ts-ignore: FIXME: Baseline TS regression
      recorder.cancel().catch(() => undefined)
    }
  }, [])

  useEffect(() => {
    if (!chatId || !latestMessageId) return
    sendReadReceipt(chatId, latestMessageId)
  }, [chatId, latestMessageId, sendReadReceipt])

  useEffect(() => {
    if (!messagePaneRef.current) return
    const frame = window.requestAnimationFrame(() => {
      if (!messagePaneRef.current) return
      // @ts-ignore: FIXME: Baseline TS regression
      messagePaneRef.current.scrollTop = messagePaneRef.current.scrollHeight
    })
    return () => window.cancelAnimationFrame(frame)
  }, [messages.length])

  useEffect(() => {
    if (!chatId) return undefined
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = null
    }

    if (composerText.trim()) {
      sendTypingStart(chatId)
      typingTimeoutRef.current = setTimeout(() => {
        sendTypingStop(chatId)
        typingTimeoutRef.current = null
      }, 1200)
    } else {
      sendTypingStop(chatId)
    }

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = null
      }
    }
  }, [chatId, composerText, sendTypingStart, sendTypingStop])

  useEffect(() => {
    if (!chatData?.league_match?.date) return
    const date = new Date(chatData.league_match.date)
    if (Number.isNaN(date.getTime())) return

    if (!proposalDate) {
      setProposalDate(date.toISOString().slice(0, 10))
    }
    if (!proposalStartTime) {
      setProposalStartTime(date.toISOString().slice(11, 16))
    }
    if (!proposalEndTime) {
      const endDate = new Date(date.getTime() + (60 * 60 * 1000))
      setProposalEndTime(endDate.toISOString().slice(11, 16))
    }
    if (!proposalVenue) {
      setProposalVenue(String(chatData?.league_match?.proposed_venue || chatData?.league_match?.venue || ''))
    }
    if (!proposalAddress) {
      setProposalAddress(String(
        chatData?.league_match?.location?.address
        || chatData?.league_match?.location?.label
        || '',
      ))
    }
  }, [
    chatData?.league_match?.date,
    chatData?.league_match?.location?.address,
    chatData?.league_match?.location?.label,
    chatData?.league_match?.proposed_venue,
    chatData?.league_match?.venue,
    proposalAddress,
    proposalDate,
    proposalEndTime,
    proposalStartTime,
    proposalVenue,
  ])

  // MSG1W §3.1 — LE CADRE A LA HAUTEUR DE L ECRAN. Mesure : du haut du cadre au bas de la
  // fenetre ; sur telephone, la barre d onglets du site occupe le bas (5,75 rem, index.css).
  // MSG1W §3.1 — « Bruno écrit… » : sous le titre (en cyan) et en bulle au bas du fil.
  const quiEcrit = useQuiEcrit({ chatId, moi: userData?.documentId, socket });
  const libelleQuiEcrit = useMemo(() => {
    if (!quiEcrit.length) return '';
    const prenoms = quiEcrit.map((id) => {
      // @ts-ignore: FIXME: Baseline TS regression
      const participant = (Array.isArray(chatData?.participants) ? chatData.participants : [])
        .find((/** @type {any} */ personne) => areSameEntityId(personne?.documentId, id));
      return String(participant?.firstname || '').trim();
    }).filter(Boolean);
    if (!prenoms.length) return t('conversation.typing.someone', "Quelqu'un écrit...");
    return t('conversation.typing.named', {
      count: prenoms.length,
      defaultValue_one: '{{names}} écrit...',
      defaultValue_other: '{{names}} écrivent...',
      names: prenoms.slice(0, 2).join(', '),
      ...SANS_ECHAPPEMENT,
    });
  }, [chatData?.participants, quiEcrit, t]);

  // MSG1W §3.11 — qui peut ecrire ici : la regle du telephone (canWriteInChat.js). Un canal de
  // club ou omnisport ferme sa saisie a qui n en est pas dirigeant.
  // R17-CANAUX — « Toute la ville » : la Ville seule (useFilDeLaVille), depuis son espace ou quand
  // le serveur le dit ; un membre y lit « Seule la Ville écrit ici ».
  const peutEcrire = useMemo(
    () => (
      canWriteInChat({ chat: chatData, hasClubAccess, user: userData }) || filDeLaVille.peutEcrire
    ),
    [chatData, filDeLaVille.peutEcrire, hasClubAccess, userData],
  );
  // MSG1W §3.10 (« avertissement B », Adel 07/10) — un fil rattache a un club (fil de club, fil
  // d equipe) peut etre lu par son dirigeant : une notice EN TETE DU FIL le dit. Un tete-a-tete ou
  // un groupe libre n a pas de club (createWhisperChat) : la phrase y serait fausse (CONVAVERT).
  const clubDuFil = String(
    chatData?.club?.documentId
    || chatData?.club?.id
    // @ts-ignore: FIXME: Baseline TS regression
    || chatData?.team?.club?.documentId
    // @ts-ignore: FIXME: Baseline TS regression
    || chatData?.team?.club?.id
    || '',
  ).trim();

  const filCharge = Boolean(chatData);
  const hauteurDuCadre = useHauteurDuCadre(cadreRef, isDesktop, filCharge);

  // MSG1W §3.1 — UN FIL COLLE EN BAS LE RESTE. Une photo qui se charge, une reaction ou une
  // carte qui se dessine apres coup font grandir le fil SOUS les yeux : sans ceci, le dernier
  // message glissait hors de l ecran (vu au banc : « Revenir en bas » apparaissait seul).
  useEffect(() => {
    const contenu = contenuDuFilRef.current;
    /** @type {any} */
    const fil = messagePaneRef.current;
    if (!contenu || !fil || typeof window.ResizeObserver === 'undefined') return undefined;
    const observateur = new window.ResizeObserver(() => {
      if (colleAuBasRef.current) fil.scrollTop = fil.scrollHeight;
    });
    observateur.observe(contenu);
    // Les gestes qui DECOLLENT le fil du bas : la molette vers le haut, le doigt, le clavier,
    // et un clic sur la barre de defilement elle-meme (il tombe sur le fil, pas sur un message).
    const decoller = () => { colleAuBasRef.current = false; };
    const surMolette = (/** @type {WheelEvent} */ event) => { if (event.deltaY < 0) decoller(); };
    const surTouche = (/** @type {KeyboardEvent} */ event) => {
      if (['ArrowUp', 'Home', 'PageUp'].includes(event.key)) decoller();
    };
    const surClic = (/** @type {MouseEvent} */ event) => { if (event.target === fil) decoller(); };
    fil.addEventListener('wheel', surMolette, { passive: true });
    fil.addEventListener('touchmove', decoller, { passive: true });
    fil.addEventListener('keydown', surTouche);
    fil.addEventListener('mousedown', surClic);
    return () => {
      observateur.disconnect();
      fil.removeEventListener('wheel', surMolette);
      fil.removeEventListener('touchmove', decoller);
      fil.removeEventListener('keydown', surTouche);
      fil.removeEventListener('mousedown', surClic);
    };
  }, [filCharge]);

  // MSG1W §3.1 — la saisie grandit avec le texte, jusqu a 140 px, puis defile.
  useEffect(() => {
    const champ = saisieRef.current;
    if (!champ?.style) return;
    champ.style.height = 'auto';
    champ.style.height = `${Math.min(140, Math.max(44, champ.scrollHeight || 0))}px`;
  }, [composerText]);

  // MSG1W §3.1 — le menu « + » se ferme par Echap ou par un clic a cote, comme la barre des
  // reactions.
  useEffect(() => {
    if (!menuAjouterOuvert) return undefined;
    const surTouche = (/** @type {KeyboardEvent} */ event) => {
      if (event.key === 'Escape') setMenuAjouterOuvert(false);
    };
    const surClic = (/** @type {MouseEvent} */ event) => {
      if (menuAjouterRef.current?.contains(/** @type {Node} */ (event.target))) return;
      setMenuAjouterOuvert(false);
    };
    document.addEventListener('keydown', surTouche);
    document.addEventListener('mousedown', surClic);
    return () => {
      document.removeEventListener('keydown', surTouche);
      document.removeEventListener('mousedown', surClic);
    };
  }, [menuAjouterOuvert]);

  // MSG1W §3.1 — le fil range en groupes et en jours (filDuSite.js), et les mots des puces,
  // ceux du telephone (format de moment « [Aujourd'hui] », sans ses crochets).
  const libelleAujourdhui = sansCrochets(t('conversation.calendarFormat.sameDay', "[Aujourd'hui]"));
  const libelleHier = sansCrochets(t('conversation.calendarFormat.lastDay', '[Hier]'));

  const sendChatPayload = useCallback(async (/** @type {any} */ {
    attachments = [],
    composition = null,
    event = null,
    message = '',
    replyTo = null,
  }) => {
    const trimmedMessage = String(message || '').trim()
    const replyPayload = replyTo?.documentId ? { documentId: replyTo.documentId } : null
    const optimisticMessageId = sendMessage(chatId, trimmedMessage, {
      attachments,
      composition,
      event,
      replyTo: replyPayload,
      sender: userData,
    })

    if (optimisticMessageId) {
      setReplyTarget(null)
      if (trimmedMessage) {
        setComposerText('')
      }
      return optimisticMessageId
    }

    const response = await createChatMessage({
      attachments,
      chatId,
      composition,
      event,
      message: trimmedMessage,
      replyTo: replyPayload,
      ...filDeLaVille.voix,
    })
    await invalidateConversationQueries()
    setReplyTarget(null)
    if (trimmedMessage) {
      setComposerText('')
    }
    // @ts-ignore: FIXME: Baseline TS regression
    return getEntityDocumentId(response?.data || response)
  }, [chatId, filDeLaVille.voix, invalidateConversationQueries, sendMessage, userData]);

  // @ts-ignore: FIXME: Baseline TS regression
  const uploadAttachment = useCallback(async (file) => {
    const formData = new FormData()
    formData.append('files', file, file?.name || `upload-${Date.now()}`)
    const response = await client.post('/upload', formData)
    return Array.isArray(response?.data) ? response.data : []
  }, [])

  // @ts-ignore: FIXME: Baseline TS regression
  const sendPickedFile = useCallback(async (file) => {
    if (!file || !chatId) return

    setIsUploading(true)
    try {
      const uploadedFiles = await uploadAttachment(file)
      if (!uploadedFiles.length) {
        window.alert(i18next.t(
          'conversation.web.attachment.noneUploaded',
          'Aucune pièce jointe n a pu être televersee.',
        ))
        return
      }

      const firstFile = uploadedFiles[0]
      const fallbackMessage = isImageAttachment(firstFile)
        ? composerText
        : (composerText || `Pièce jointe : ${getDocumentDisplayName(firstFile)}`)

      await sendChatPayload({
        attachments: uploadedFiles,
        message: fallbackMessage,
        replyTo: replyTarget,
      })
    } catch (error) {
      // @ts-ignore: FIXME: Baseline TS regression
      window.alert(error?.message || i18next.t(
        'conversation.web.attachment.sendError',
        'Impossible d envoyer cette pièce jointe.',
      ))
    } finally {
      setIsUploading(false)
    }
  }, [chatId, composerText, replyTarget, sendChatPayload, uploadAttachment])

  const handlePickImage = useCallback(async () => {
    try {
      const file = await pickImage()
      if (file) {
        await sendPickedFile(file)
      }
    } catch (error) {
      // @ts-ignore: FIXME: Baseline TS regression
      window.alert(error?.message || i18next.t(
        'conversation.web.picker.imageError',
        'Impossible de choisir une image.',
      ))
    }
  }, [sendPickedFile])

  const handlePickDocument = useCallback(async () => {
    try {
      const file = await pickDocument()
      if (file) {
        await sendPickedFile(file)
      }
    } catch (error) {
      // @ts-ignore: FIXME: Baseline TS regression
      window.alert(error?.message || i18next.t(
        'conversation.web.picker.fileError',
        'Impossible de choisir un fichier.',
      ))
    }
  }, [sendPickedFile])

  // @ts-ignore: FIXME: Baseline TS regression
  const handleSendVoiceNote = useCallback(async (voiceNote) => {
    if (!voiceNote?.file || !chatId) return

    setIsUploading(true)
    try {
      const uploadedFiles = await uploadAttachment(voiceNote.file)
      if (!uploadedFiles.length) {
        window.alert(i18next.t(
          'conversation.web.voice.noneUploaded',
          'Aucune note vocale n a pu être televersee.',
        ))
        return
      }

      await sendChatPayload({
        attachments: uploadedFiles,
        composition: {
          durationMs: Number(voiceNote?.durationMs || 0) || 0,
          mime: voiceNote?.mime || voiceNote?.file?.type || uploadedFiles?.[0]?.mime || 'audio/webm',
          size: Number(voiceNote?.size || voiceNote?.file?.size || 0) || 0,
          type: 'voice_note',
          version: 1,
          waveform: [],
        },
        message: composerText.trim(),
        replyTo: replyTarget,
      })
    } catch (error) {
      // @ts-ignore: FIXME: Baseline TS regression
      window.alert(error?.message || i18next.t(
        'conversation.web.voice.sendError',
        'Impossible d envoyer cette note vocale.',
      ))
    } finally {
      setIsUploading(false)
    }
  }, [chatId, composerText, replyTarget, sendChatPayload, uploadAttachment])

  const handleVoiceNote = useCallback(async () => {
    if (!isRecordingVoice) {
      try {
        const recorder = await recordVoiceNote()
        voiceRecorderRef.current = recorder
        setIsRecordingVoice(true)
      } catch (error) {
        // @ts-ignore: FIXME: Baseline TS regression
        window.alert(error?.message || i18next.t(
          'conversation.web.voice.unavailable',
          'L enregistrement vocal n est pas disponible sur ce navigateur.',
        ))
      }
      return
    }

    const activeRecorder = voiceRecorderRef.current
    // @ts-ignore: FIXME: Baseline TS regression
    if (!activeRecorder?.stop) {
      voiceRecorderRef.current = null
      setIsRecordingVoice(false)
      return
    }

    setIsStoppingVoice(true)
    try {
      // @ts-ignore: FIXME: Baseline TS regression
      const result = await activeRecorder.stop()
      voiceRecorderRef.current = null
      setIsRecordingVoice(false)
      await handleSendVoiceNote(result)
    } catch (error) {
      // @ts-ignore: FIXME: Baseline TS regression
      if (error?.message !== 'VOICE_NOTE_RECORDING_CANCELLED') {
        // @ts-ignore: FIXME: Baseline TS regression
        window.alert(error?.message || i18next.t(
          'conversation.web.voice.finalizeError',
          'Impossible de finaliser cette note vocale.',
        ))
      }
    } finally {
      setIsStoppingVoice(false)
      setIsRecordingVoice(false)
    }
  }, [handleSendVoiceNote, isRecordingVoice])

  const handleSendText = useCallback(async () => {
    const trimmed = composerText.trim()
    if (!trimmed || !chatId) return
    setIsSending(true)
    try {
      await sendChatPayload({
        message: trimmed,
        replyTo: replyTarget,
      })
    } catch (error) {
      // @ts-ignore: FIXME: Baseline TS regression
      window.alert(error?.message || i18next.t(
        'conversation.web.message.sendError',
        'Impossible d envoyer le message.',
      ))
    } finally {
      setIsSending(false)
    }
  }, [chatId, composerText, replyTarget, sendChatPayload])

  // @ts-ignore: FIXME: Baseline TS regression
  const handleShareContact = useCallback(async (contact) => {
    try {
      await sendChatPayload({
        composition: {
          avatarUrl: contact?.avatar?.url || '',
          firstname: contact?.firstname || '',
          lastname: contact?.lastname || '',
          roleLabel: contact?.role?.name || contact?.role?.type || contact?.role || '',
          type: 'contact_share',
          userDocumentId: contact?.documentId || '',
        },
        replyTo: replyTarget,
      })
    } catch (error) {
      // @ts-ignore: FIXME: Baseline TS regression
      window.alert(error?.message || i18next.t(
        'conversation.web.share.contactError',
        'Impossible de partager ce contact.',
      ))
    }
  }, [replyTarget, sendChatPayload])

  // @ts-ignore: FIXME: Baseline TS regression
  const handleShareEvent = useCallback(async (event) => {
    try {
      await sendChatPayload({
        composition: buildEventShareComposition(event),
        event: getEntityDocumentId(event),
        message: 'Partage',
        replyTo: replyTarget,
      })
    } catch (error) {
      // @ts-ignore: FIXME: Baseline TS regression
      window.alert(error?.message || i18next.t(
        'conversation.web.share.eventError',
        'Impossible de partager cet événement.',
      ))
    }
  }, [replyTarget, sendChatPayload])

  useEffect(() => {
    const eventFromPicker = route?.params?.sharedEventFromPicker
    const eventDocumentId = String(eventFromPicker?.documentId || '').trim()
    if (!eventDocumentId) {
      handledSharedEventFromPickerRef.current = ''
      return
    }
    if (handledSharedEventFromPickerRef.current === eventDocumentId) return
    handledSharedEventFromPickerRef.current = eventDocumentId

    handleShareEvent(eventFromPicker)
    navigation.setParams?.({ sharedEventFromPicker: undefined })
  }, [handleShareEvent, navigation, route?.params?.sharedEventFromPicker])

  const handleShareLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      window.alert(i18next.t(
        'conversation.web.location.unavailable',
        'La geolocalisation n est pas disponible sur ce navigateur.',
      ))
      return
    }

    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        await sendChatPayload({
          composition: {
            address: 'Position actuelle',
            label: 'Position actuelle',
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            type: 'location_share',
          },
          replyTo: replyTarget,
        })
      } catch (error) {
        // @ts-ignore: FIXME: Baseline TS regression
        window.alert(error?.message || i18next.t(
          'conversation.web.location.shareError',
          'Impossible de partager ta position.',
        ))
      }
    }, (error) => {
      window.alert(error?.message || i18next.t(
        'conversation.web.location.accessError',
        'Impossible d acceder à ta position.',
      ))
    })
  }, [replyTarget, sendChatPayload])

  // @ts-ignore: FIXME: Baseline TS regression
  const handleVoteOnPoll = useCallback(async (message, optionId) => {
    const messageId = getMessageId(message)
    if (!messageId || !optionId) return

    queryClient.setQueriesData({ queryKey: ['chat-messages', chatId] }, (oldData) => {
      if (!oldData?.pages) return oldData
      return {
        ...oldData,
        // @ts-ignore: FIXME: Baseline TS regression
        pages: oldData.pages.map((page) => ({
          ...page,
          data: Array.isArray(page?.data)
            // @ts-ignore: FIXME: Baseline TS regression
            ? page.data.map((entry) => {
              if (getMessageId(entry) !== messageId) return entry
              const optimistic = applyOptimisticPollVote({
                currentUserId: userData?.documentId || '',
                optionId,
                poll: entry?.composition,
              })
              if (!optimistic.changed) return entry
              return {
                ...entry,
                composition: optimistic.nextComposition,
              }
            })
            : [],
        })),
      }
    })

    try {
      await votePoll(messageId, optionId)
      await invalidateConversationQueries()
    } catch (error) {
      await invalidateConversationQueries()
      // @ts-ignore: FIXME: Baseline TS regression
      window.alert(error?.message || i18next.t(
        'conversation.web.poll.voteError',
        'Impossible de sauvegarder ce vote.',
      ))
    }
  }, [chatId, invalidateConversationQueries, queryClient, userData?.documentId, votePoll])

  const handleSendProposal = useCallback(async () => {
    if (!proposalDate || !proposalStartTime) {
      window.alert(i18next.t(
        'conversation.web.proposal.pickDate',
        'Choisis une date et une heure pour la proposition.',
      ))
      return
    }

    setIsSubmittingProposal(true)
    try {
      const startIso = new Date(`${proposalDate}T${proposalStartTime}:00`).toISOString()
      const endIso = proposalEndTime
        ? new Date(`${proposalDate}T${proposalEndTime}:00`).toISOString()
        : new Date(new Date(startIso).getTime() + (60 * 60 * 1000)).toISOString()
      const payload = buildLeagueProposalPayload(leagueMatchId, {
        address: proposalAddress,
        addressObject: proposalAddress
          ? { address: proposalAddress, label: proposalAddress }
          : undefined,
        date: startIso,
        endDate: endIso,
        venue: proposalVenue || i18next.t(
          'conversation.negotiation.venueToBeDefined',
          'Lieu à définir',
        ),
      }, chatData?.league_match?.location)

      if (leagueMatchId) {
        const legalAcceptance = requestWebLeagueLegalAcceptance(
          LEAGUE_LEGAL_SCOPES.MATCH_CAPTAIN_PROPOSAL,
          leagueMatchId,
          {
            matchLabel: leagueLegalMatchLabel,
            venueLabel: proposalVenue || i18next.t(
              'conversation.negotiation.venueToBeDefined',
              'Lieu à définir',
            ),
          },
        )
        if (!legalAcceptance) return
        await createLeagueProposal(
          leagueMatchId,
          // @ts-ignore: FIXME: Baseline TS regression
          buildCanonicalLeagueProposalPayload(payload.message.composition),
          { legalAcceptance },
        )
      } else {
        await sendChatPayload({
          composition: payload.message.composition,
          message: payload.message.message,
        })
      }
    } catch (error) {
      // @ts-ignore: FIXME: Baseline TS regression
      window.alert(error?.message || i18next.t(
        'conversation.web.proposal.sendError',
        'Impossible d envoyer cette proposition.',
      ))
    } finally {
      setIsSubmittingProposal(false)
    }
  }, [
    chatData?.league_match?.location,
    leagueLegalMatchLabel,
    leagueMatchId,
    proposalAddress,
    proposalDate,
    proposalEndTime,
    proposalStartTime,
    proposalVenue,
    requestWebLeagueLegalAcceptance,
    sendChatPayload,
  ])

  // @ts-ignore: FIXME: Baseline TS regression
  const handleProposalResponse = useCallback(async (message, status) => {
    const messageId = getMessageId(message)
    const matchId = String(message?.composition?.matchId || leagueMatchId || '').trim()
    // AMICAUX-CORRECTIFS 81 — un match AMICAL se repond par SON workflow, comme au telephone : le
    // match se cree, les autres propositions sont refusees. La reponse generique ne changeait que
    // l etiquette de la bulle. Accepter est lourd : on confirme d abord.
    const amical = isFriendlyProposal(message?.composition);
    if (amical && status === 'accepted') {
      const confirmation = buildFriendlyProposalConfirmation();
      // eslint-disable-next-line no-alert -- la confirmation native du site, comme « Signaler »
      if (!window.confirm(`${confirmation.title}\n\n${confirmation.body}`)) return;
    }

    try {
      if (amical) {
        const action = status === 'accepted' ? 'accept' : 'decline';
        await respondToFriendlyProposal(message.composition, action);
        await queryClient.invalidateQueries({ queryKey: ['friendly-match-ads'] });
      } else if (status === 'accepted' && matchId) {
        const legalAcceptance = requestWebLeagueLegalAcceptance(
          LEAGUE_LEGAL_SCOPES.MATCH_CAPTAIN_ACCEPTANCE,
          matchId,
          {
            matchLabel: leagueLegalMatchLabel,
            proposalMessageId: messageId,
          },
        )
        if (!legalAcceptance) return
        await respondToLeagueProposal(matchId, messageId, 'accept', { legalAcceptance })
      } else if (matchId) {
        await respondToLeagueProposal(matchId, messageId, 'decline')
      } else if (message?.composition?.type === 'proposal' && chatData?.type === 'league_match') {
        throw new Error(i18next.t(
          'conversation.web.proposal.incomplete',
          'Proposition League incomplète. Recharge la conversation avant de répondre.',
        ))
      } else {
        await respondToProposal(messageId, status)
      }
      await invalidateConversationQueries()
    } catch (error) {
      // @ts-ignore: FIXME: Baseline TS regression
      window.alert(error?.message || i18next.t(
        'conversation.web.proposal.replyError',
        'Impossible de répondre à cette proposition.',
      ))
    }
  }, [
    invalidateConversationQueries,
    chatData?.type,
    leagueLegalMatchLabel,
    leagueMatchId,
    queryClient,
    requestWebLeagueLegalAcceptance,
    respondToProposal,
  ])

  const baseTextColor = Colors?.neutral00 || '#ffffff'
  const mutedTextColor = Colors?.neutral300 || '#adb1b2'
  const panelBackground = 'rgba(4, 18, 28, 0.78)'
  const borderColor = 'rgba(255, 255, 255, 0.08)'
  const primaryColor = Colors?.primary500 || '#01b3f4'
  const canSendText = Boolean(composerText.trim())
    && canUseConversationActions
    && !isSending
    && !isUploading
    && !isRecordingVoice
    && !isStoppingVoice
  const canSubmitProposal = Boolean(proposalDate && proposalStartTime)
    && canUseConversationActions
    && !isSubmittingProposal
    && !isUploading
    && !isRecordingVoice

  const renderStateCard = useCallback((/** @type {any} */ {
    actionLabel,
    description,
    onAction,
    title,
  }) => (
    <section style={{
      background: panelBackground,
      border: `1px solid ${borderColor}`,
      borderRadius: 28,
      color: baseTextColor,
      display: 'grid',
      gap: 14,
      justifyItems: 'start',
      margin: '0 auto',
      maxWidth: 760,
      padding: 28,
      width: '100%',
    }}
    >
      <div style={{ display: 'grid', gap: 8 }}>
        <span style={{ color: mutedTextColor, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Messagerie
        </span>
        <h1
          style={{
            color: baseTextColor, fontFamily: 'Montserrat-Black, sans-serif', fontSize: 28, margin: 0,
          }}
        >
          {title}
        </h1>
      </div>
      <div style={{ color: mutedTextColor, fontSize: 14, lineHeight: 1.6 }}>
        {description}
      </div>
      {onAction ? (
        <button
          onClick={onAction}
          style={{
            background: primaryColor,
            border: 0,
            borderRadius: 999,
            color: '#001218',
            cursor: 'pointer',
            fontFamily: 'Montserrat-Bold, sans-serif',
            padding: '12px 18px',
          }}
          type="button"
        >
          {actionLabel || i18next.t('conversation.web.retry', 'Réessayer')}
        </button>
      ) : null}
    </section>
  ), [baseTextColor, borderColor, mutedTextColor, panelBackground, primaryColor])

  const retryConversationLoad = useCallback(async () => {
    await Promise.all([
      refetchChat(),
      refetchMessages(),
    ])
  }, [refetchChat, refetchMessages])

  // @ts-ignore: FIXME: Baseline TS regression
  const handleRetryFailedMessage = useCallback((message) => {
    if (!chatId || !message) return
    retryFailedMessage(chatId, message)
  }, [chatId, retryFailedMessage])

  // @ts-ignore: FIXME: Baseline TS regression
  const handleReportMessage = useCallback((message) => {
    const messageId = getMessageId(message)
    if (!messageId || reportMessageMutation.isPending) return
    if (!window.confirm(i18next.t(
      'conversation.web.report.confirm',
      'Signaler ce message à la moderation FoundClub ?',
    ))) return
    setReportedMessageId(messageId)
    reportMessageMutation.mutate({ message: messageId })
  }, [reportMessageMutation])

  // @ts-ignore: FIXME: Baseline TS regression
  const renderAttachments = useCallback((attachments = []) => (
    <div style={{ display: 'grid', gap: 10 }}>
      {attachments.map((attachment, index) => {
        const attachmentUrl = getAttachmentUrl(attachment)
        const label = getDocumentDisplayName(attachment)
        const isImage = isImageAttachment(attachment)
        const isDocument = isDocumentAttachment(attachment)

        if (isImage && attachmentUrl) {
          return (
            <button
              key={`${label}-${index}`}
              // MSGIMG — la photo s ouvre en grand DANS la page (avant : un nouvel onglet).
              onClick={() => setImageEnGrand(attachmentUrl)}
              style={{
                background: 'transparent',
                border: 0,
                cursor: 'pointer',
                padding: 0,
                textAlign: 'left',
              }}
              type="button"
            >
              <img
                alt={label}
                src={attachmentUrl}
                style={{
                  borderRadius: 18,
                  display: 'block',
                  maxHeight: 260,
                  maxWidth: '100%',
                  objectFit: 'cover',
                  width: '100%',
                }}
              />
            </button>
          )
        }

        return (
          <button
            key={`${label}-${index}`}
            onClick={() => {
              if (attachmentUrl) {
                openUrl(attachmentUrl)
              }
            }}
            style={{
              alignItems: 'center',
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${borderColor}`,
              borderRadius: 14,
              color: baseTextColor,
              cursor: attachmentUrl ? 'pointer' : 'default',
              display: 'flex',
              gap: 10,
              justifyContent: 'space-between',
              padding: '12px 14px',
              textAlign: 'left',
              width: '100%',
            }}
            type="button"
          >
            <span style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 13 }}>
                {label}
              </span>
              <span style={{ color: mutedTextColor, fontSize: 12 }}>
                {isDocument ? 'Document' : attachment?.mime || i18next.t(
                  'conversation.web.attachment.label',
                  'Pièce jointe',
                )}
              </span>
            </span>
            <span style={{ color: primaryColor, fontSize: 12 }}>
              {attachmentUrl ? 'Ouvrir' : 'Indisponible'}
            </span>
          </button>
        )
      })}
    </div>
  ), [baseTextColor, borderColor, mutedTextColor, primaryColor])

  // MSG1W §3.4 — les noms des votants. T19-RESTES : la règle commune du téléphone (le nom le plus
  // frais l'emporte : participants, mon compte, puis les messages du plus récent au plus ancien).
  // Avant, le PLUS VIEUX message passait devant mon compte : « Oui, 1 vote, mouri nio ».
  const annuaireDesVotants = useMemo(() => {
    const annuaire = new Map();
    annuaireDesMembres({
      messages,
      participants: chatData?.participants,
      userData,
    }).forEach((personne, id) => annuaire.set(id, getDisplayName(personne)));
    return annuaire;
  }, [chatData?.participants, messages, userData]);
  const resolveVoterName = useCallback(
    (/** @type {string} */ id) => annuaireDesVotants.get(String(id)) || 'Membre',
    [annuaireDesVotants],
  );

  // MSG1W « convocation site B » (decision d Adel, 07/10) — la convocation depuis le groupe
  // d equipe, comme le telephone (MESSAGERIE-1C) : qui peut convoquer (entraineur de l equipe du
  // fil, super-admin : la regle partagee de 1C), et l assistant, monte seulement a l ouverture.
  const peutConvoquer = useMemo(
    () => canConvokeFromChat({ chat: chatData, user: userData }),
    [chatData, userData],
  );
  const [demandeConvocation, setDemandeConvocation] = useState(/** @type {any} */ (null));
  const ouvrirModificationConvocation = useCallback((/** @type {any} */ demande) => {
    const composition = demande?.composition;
    if (!composition?.eventId) return;
    setDemandeConvocation({
      eventId: String(composition.eventId),
      eventSummary: composition,
      mode: 'edit',
      startStep: demande?.startStep === 3 ? 3 : 2,
    });
  }, []);

  // §3.4 — toucher la carte d un sondage ouvre « Détail du sondage » (PollDetails.web.js).
  const ouvrirLesVotes = useCallback((/** @type {any} */ message) => {
    const id = getMessageId(message);
    if (!chatId || !id) return;
    navigation.navigate(RouteNames.PollDetails, { chatId, messageId: id, pollId: id });
  }, [chatId, navigation]);

  // @ts-ignore: FIXME: Baseline TS regression
  const renderComposition = useCallback((message, isMine = false) => {
    const composition = message?.composition
    if (!composition?.type) return null

    // MSG1W §3.4 — la bulle de sondage du TELEPHONE (ronds, barres, votants, « voir les votes »).
    if (composition.type === 'poll') {
      return (
        <div style={{ display: 'grid', gap: 4 }}>
          {/* ⚠️ Sans `onOpenDetails` : sur le site, la carte cliquable devient un <button> qui
              contient les boutons de vote (HTML invalide, votes injoignables au lecteur d ecran).
              « Voir les votes » est donc un bouton a part, sous la carte. */}
          <PollMessageBubble
            currentUserId={userData?.documentId || ''}
            isMe={isMine}
            // T19-RESTES — donné, la bulle lit elle-même les noms des votants au serveur
            // (`poll-voters`), comme au téléphone : le site ne les demandait jamais.
            messageId={getMessageId(message)}
            onVote={(/** @type {string} */ optionId) => handleVoteOnPoll(message, optionId)}
            poll={composition}
            resolveVoterName={resolveVoterName}
          />
          <button
            onClick={() => ouvrirLesVotes(message)}
            style={{
              background: 'transparent',
              border: 0,
              borderTop: '1px solid rgba(255, 255, 255, 0.14)',
              color: PALETTE_DU_FIL.accent,
              cursor: 'pointer',
              fontFamily: 'Montserrat-Bold, sans-serif',
              fontSize: 15,
              padding: '10px 0 4px',
            }}
            type="button"
          >
            {i18next.t('conversation.web.fil.voirLesVotes', 'Voir les votes')}
          </button>
        </div>
      );
    }

    // AMICAUX-CORRECTIFS 81 — la proposition de match AMICAL : la bulle du TELEPHONE. Ses boutons
    // ne vont qu a ceux que le SERVEUR designe (`canAcceptUserIds`) : la carte generique ci-dessous
    // les montrait aussi a l equipe qui a ENVOYE la proposition.
    // Temoin : views/__tests__/ConversationWebAMIC81.test.js.
    if (isFriendlyProposal(composition)) {
      return (
        <ProposalMessageBubble
          allowResponseActions
          isMe={!canAcceptFriendlyProposal(composition, userData?.documentId)}
          onAccept={() => handleProposalResponse(message, 'accepted')}
          onDecline={() => handleProposalResponse(message, 'declined')}
          proposal={composition}
        />
      );
    }

    if (composition.type === 'proposal') {
      const proposalStatus = String(composition?.status || 'pending').trim().toLowerCase()
      return (
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 15 }}>
            {i18next.t('conversation.web.proposal.title', 'Proposition de match')}
          </div>
          <div style={{ color: mutedTextColor, display: 'grid', fontSize: 13, gap: 4 }}>
            <span>{formatDay(composition?.date)}</span>
            <span>
              {composition?.venue || i18next.t(
                'conversation.negotiation.venueToBeDefined',
                'Lieu à définir',
              )}
            </span>
            <span>{composition?.address || composition?.addressObject?.label || ''}</span>
            <span>
              Statut:
              {' '}
              {proposalStatus === 'accepted'
                ? 'Acceptee'
                : proposalStatus === 'declined'
                  ? 'Refusee'
                  : 'En attente'}
            </span>
          </div>
          {proposalStatus === 'pending' ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <button
                onClick={() => handleProposalResponse(message, 'accepted')}
                style={{
                  background: primaryColor,
                  border: 0,
                  borderRadius: 999,
                  color: '#001218',
                  cursor: 'pointer',
                  fontFamily: 'Montserrat-Bold, sans-serif',
                  padding: '10px 14px',
                }}
                type="button"
              >
                Accepter
              </button>
              <button
                onClick={() => handleProposalResponse(message, 'declined')}
                style={{
                  background: 'transparent',
                  border: `1px solid ${borderColor}`,
                  borderRadius: 999,
                  color: baseTextColor,
                  cursor: 'pointer',
                  fontFamily: 'Montserrat-Bold, sans-serif',
                  padding: '10px 14px',
                }}
                type="button"
              >
                Refuser
              </button>
            </div>
          ) : null}
        </div>
      )
    }

    if (composition.type === 'event_share') {
      const eventId = String(composition?.eventDocumentId || '').trim()
      return (
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 15 }}>
            {composition?.eventName || 'Événement'}
          </div>
          <div style={{ color: mutedTextColor, display: 'grid', fontSize: 13, gap: 4 }}>
            <span>{formatDay(composition?.eventDate)}</span>
            <span>{composition?.teamName || ''}</span>
            <span>{composition?.locationLabel || ''}</span>
          </div>
          {eventId ? (
            <button
              onClick={() => navigation.navigate(RouteNames.EventDetails, { eventId })}
              style={{
                alignSelf: 'flex-start',
                background: 'transparent',
                border: `1px solid ${borderColor}`,
                borderRadius: 999,
                color: baseTextColor,
                cursor: 'pointer',
                padding: '10px 14px',
              }}
              type="button"
            >
              {i18next.t('conversation.web.viewEvent', 'Voir l événement')}
            </button>
          ) : null}
        </div>
      )
    }

    // MSG1W §3.18 — contact et position : les bulles du TELEPHONE (restylees par MESSAGERIE-1A).
    if (composition.type === 'contact_share') {
      return (
        <ContactShareBubble
          composition={composition}
          isMe={isMine}
          onPressContact={(/** @type {string} */ userId) => {
            if (userId) navigation.navigate(RouteNames.UserDetails, { userId });
          }}
        />
      );
    }

    if (composition.type === 'location_share') {
      return <LocationShareBubble composition={composition} isMe={isMine} />;
    }

    if (composition.type === 'voice_note') {
      const voiceAttachment = Array.isArray(message?.attachments)
        // @ts-ignore: FIXME: Baseline TS regression
        ? message.attachments.find((attachment) => Boolean(getAttachmentUrl(attachment)))
        : null
      const voiceUrl = getAttachmentUrl(voiceAttachment)
      const durationLabel = formatDurationLabel(composition?.durationMs)
      return (
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 15 }}>
            Note vocale
          </div>
          {durationLabel ? (
            <div style={{ color: mutedTextColor, fontSize: 12 }}>
              Duree {durationLabel}
            </div>
          ) : null}
          {voiceUrl ? (
            <audio controls preload="metadata" src={voiceUrl} style={{ maxWidth: '100%', width: '100%' }} />
          ) : (
            <div style={{ color: mutedTextColor, fontSize: 13 }}>
              {i18next.t(
                'conversation.web.voice.playbackUnavailable',
                'Le fichier audio n est pas disponible pour la lecture web.',
              )}
            </div>
          )}
        </div>
      )
    }

    // 🙋 COMPO-CARTE-SITE — LA MEME CARTE QUE LE TELEPHONE. Le site ecrivait ici
    // « Composition lineup_share » en texte brut : le mot technique, a tout
    // lecteur d'un canal d'equipe. La carte est le composant du telephone,
    // tel quel : titre, quand, ou, terrain, noms, Present / Absent (BULLE) et
    // « Ouvrir » vers « Tu es convoque » ou le plein ecran (regle COMPOMSG).
    // ⛔ Sans match rattache, « Ouvrir » n'aurait rien a ouvrir sur le site :
    // le telephone passe la compo a l'ecran par la memoire, le site par
    // l'adresse, qui ne porte ni joueurs ni placements. Repli, comme pour tout
    // type que le site ne sait pas dessiner — en francais, jamais son nom.
    if (composition.type === 'lineup_share' && String(composition?.eventId || '').trim()) {
      return (
        // FINITIONS15 point 6 : la carte s'abonne elle-même à la fiche du fil.
        // MSG1W « convocation site B » — « Modifier » et « Reponses » (contrat onEdit /
        // renderReponses de 1A, rempli par ConvocationLineupMessage de 1C).
        <ConvocationLineupMessage
          chatId={chatId}
          composition={composition}
          onEdit={peutConvoquer ? ouvrirModificationConvocation : undefined}
        >
          {(/** @type {any} */ convocation) => (
            <CompositionMessageBubbleDuFil
              chatId={chatId}
              composition={composition}
              currentEvent={message?.event}
              isMe={isMine}
              onEdit={convocation.onEdit}
              renderReponses={convocation.renderReponses}
            />
          )}
        </ConvocationLineupMessage>
      );
    }

    return (
      <div
        style={{
          color: mutedTextColor,
          display: 'grid',
          fontSize: 13,
          gap: 4,
        }}
      >
        {composition.type === 'lineup_share' ? (
          <span
            style={{
              color: baseTextColor,
              fontFamily: 'Montserrat-Bold, sans-serif',
            }}
          >
            {i18next.t('compositionMessageBubble.published', 'Composition publiée')}
          </span>
        ) : null}
        <span>
          {i18next.t(
            'conversation.web.composition.unavailable',
            'Ce contenu ne peut pas s’afficher sur le site.',
          )}
        </span>
      </div>
    );
  }, [
    baseTextColor,
    borderColor,
    chatId,
    handleProposalResponse,
    handleVoteOnPoll,
    mutedTextColor,
    navigation,
    ouvrirLesVotes,
    ouvrirModificationConvocation,
    peutConvoquer,
    primaryColor,
    resolveVoterName,
    userData?.documentId,
  ])

  /**
   * REACT-WEB — pose, remplace ou retire MA reaction sur un message.
   *
   * 🎯 LE SITE N ARBITRE RIEN : il envoie TOUJOURS l emoji sur lequel on a clique,
   * et c est le serveur qui decide (chat-message-reaction-actions.ts) — meme emoji
   * que la mienne : il la retire ; autre emoji : il la remplace ; aucune encore :
   * il la pose. Rejouer cette regle ici ferait DEUX regles a garder identiques,
   * exactement comme le telephone a choisi de ne pas le faire.
   * @param {string} messageDocumentId Le message vise.
   * @param {string} emoji L emoji cliqué, pris dans le jeu ferme.
   * @returns {Promise<void>} Rien : le resultat arrive par la reserve react-query.
   */
  const handleToggleReaction = useCallback(async (
    /** @type {string} */ messageDocumentId,
    /** @type {string} */ emoji,
  ) => {
    if (!messageDocumentId || !emoji) return;
    setReactionBarMessageId('');

    try {
      await reactToMessage(messageDocumentId, emoji);
    } catch (error) {
      // Le meme canal que toutes les autres erreurs de cet ecran.
      window.alert(error?.message || i18next.t(
        'conversation.reactions.error',
        "Impossible d'enregistrer ta réaction.",
      ));
    }
  }, [reactToMessage]);

  // WHATSAPP — sans ce rappel, rouvrir une barre la montrerait directement en
  // mode clavier : l etat serait reste vrai depuis la fois d avant.
  useEffect(() => {
    if (!reactionBarMessageId) setClavierOuvert(false);
  }, [reactionBarMessageId]);

  // REACT-WEB — ECHAP FERME LA BARRE ET REND LE FOCUS AU BOUTON qui l a ouverte.
  // Sans ce retour, une personne au clavier se retrouve projetee en haut de la page,
  // sans aucun repere pour revenir a son message. Un clic a cote ferme aussi la
  // barre — sinon le panneau reste suspendu au-dessus de la conversation.
  useEffect(() => {
    if (!reactionBarMessageId) return undefined;

    const handleKeyDown = (/** @type {KeyboardEvent} */ event) => {
      if (event.key !== 'Escape') return;
      setReactionBarMessageId('');
      reactionTriggerRef.current?.focus();
    };
    const handlePointerDown = (/** @type {MouseEvent} */ event) => {
      const { target } = event;
      if (reactionBarRef.current?.contains(/** @type {Node} */ (target))) return;
      // Le bouton lui-meme est exclu : sinon ce clic fermerait la barre ici, et
      // son propre `onClick` la rouvrirait aussitot — elle ne se fermerait jamais.
      if (reactionTriggerRef.current?.contains(/** @type {Node} */ (target))) return;
      setReactionBarMessageId('');
    };

    // ⛔ ET LE DEFILEMENT LA FERME. La barre est FIXE a l ecran : si la liste
    // bouge sous elle, elle reste en place et se retrouve pointee sur un autre
    // message. `true` en 3e argument est indispensable — l evenement `scroll` d un
    // cadre interieur ne remonte pas, il ne se prend qu a la descente.
    const handleScroll = () => setReactionBarMessageId('');

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, [reactionBarMessageId]);

  // MSG1W §3.3 — repondre a un message : la barre au-dessus de la saisie, et le curseur y va.
  const repondreA = useCallback((/** @type {any} */ message) => {
    setReplyTarget(message);
    window.requestAnimationFrame?.(() => saisieRef.current?.focus?.());
  }, []);

  // MSG1W — une phrase breve (« Copié »), lue par le lecteur d ecran, qui s efface seule.
  useEffect(() => {
    if (!annonce) return undefined;
    const minuterie = setTimeout(() => setAnnonce(''), 2500);
    return () => clearTimeout(minuterie);
  }, [annonce]);

  /**
   * MSG1W §3.2 — les actions d un message : les regles de `messageActions.js` (WHATSAPP2),
   * telles quelles, et « Répondre » retire quand on ne peut pas ecrire (chef, 07/10).
   * @param {any} message - Le message.
   * @returns {ReturnType<typeof getMessageActions>} Les actions, dans l ordre d affichage.
   */
  const actionsDuMessage = useCallback((/** @type {any} */ message) => {
    const mien = areSameEntityId(message?.sender?.documentId, userData?.documentId);
    return getMessageActions({
      canCopy: Boolean(String(message?.message || '').trim()),
      canEdit: mien && estModifiable(message),
      // MSG1W « convocation site B » — « Modifier la composition » sur une carte publiee (1C).
      canEditComposition: peutConvoquer
        && message?.composition?.type === 'lineup_share'
        && Boolean(message?.composition?.eventId),
      isMine: mien,
    }).filter((action) => peutEcrire || action.key !== 'reply');
  }, [peutConvoquer, peutEcrire, userData?.documentId]);

  const fermerLeMenu = useCallback((/** @type {boolean} */ rendreLeFocus) => {
    setMenuDuMessage(null);
    if (rendreLeFocus) declencheurDuMenuRef.current?.focus?.();
  }, []);

  /**
   * MSG1W §3.2 — ouvre le menu d un message la ou on a clique (clic droit), ou sous la fleche
   * du survol ; il reste dans la fenetre.
   * @param {any} message - Le message.
   * @param {{ x: number, y: number }} point - Ou l ouvrir, en pixels d ecran.
   * @param {HTMLElement | null} declencheur - Ce qui reprendra le focus a la fermeture.
   */
  const ouvrirLeMenu = useCallback((
    /** @type {any} */ message,
    /** @type {{ x: number, y: number }} */ point,
    /** @type {HTMLElement | null} */ declencheur,
  ) => {
    const id = getMessageId(message);
    if (!id || typeof window === 'undefined') return;
    declencheurDuMenuRef.current = declencheur;
    setReactionBarMessageId('');
    const largeur = 252;
    const hauteur = 64 + (48 * actionsDuMessage(message).length) + 16;
    // Le bas utile de l ecran : sur telephone, la barre d onglets du site (5,75 rem) le couvre.
    const bas = window.innerHeight - (isDesktop ? 8 : 100);
    // Pas la place en dessous : le menu s ouvre AU-DESSUS du point.
    const haut = point.y + hauteur > bas ? point.y - hauteur : point.y;
    // Le repere des elements fixes de la page (voir origineDuRepereFixe).
    const origine = origineDuRepereFixe(declencheur || messagePaneRef.current);
    setMenuDuMessage({
      id,
      left: Math.max(8, Math.min(point.x, window.innerWidth - largeur - 8)) - origine.x,
      top: Math.max(8, Math.min(haut, bas - hauteur)) - origine.y,
    });
  }, [actionsDuMessage, isDesktop]);

  // MSG1W §3.2 — le menu prend le focus (premiere ligne) ; Echap le ferme et rend le focus a ce
  // qui l a ouvert ; un clic a cote, la molette ou le doigt le ferment (il est fixe a l ecran).
  // ⚠️ Pas l evenement « scroll » : un defilement PROGRAMME (le fil qui reste colle en bas quand
  // une photo se charge) le refermait sous les yeux de la personne (temoin instable sous charge).
  useEffect(() => {
    if (!menuDuMessage) return undefined;
    /** @type {HTMLElement | null | undefined} */ (
      menuDuMessageRef.current?.querySelector?.('[role="menuitem"]')
    )?.focus?.();
    const surTouche = (/** @type {KeyboardEvent} */ event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      fermerLeMenu(true);
    };
    const surClic = (/** @type {MouseEvent} */ event) => {
      if (menuDuMessageRef.current?.contains(/** @type {Node} */ (event.target))) return;
      fermerLeMenu(false);
    };
    const surDefilement = (/** @type {Event} */ event) => {
      if (menuDuMessageRef.current?.contains(/** @type {Node} */ (event.target))) return;
      fermerLeMenu(false);
    };
    document.addEventListener('keydown', surTouche);
    document.addEventListener('mousedown', surClic);
    document.addEventListener('wheel', surDefilement, true);
    document.addEventListener('touchmove', surDefilement, true);
    return () => {
      document.removeEventListener('keydown', surTouche);
      document.removeEventListener('mousedown', surClic);
      document.removeEventListener('wheel', surDefilement, true);
      document.removeEventListener('touchmove', surDefilement, true);
    };
  }, [fermerLeMenu, menuDuMessage]);

  // Les fleches du clavier passent d une ligne du menu a l autre.
  const naviguerDansLeMenu = useCallback((/** @type {any} */ event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const lignes = Array.from(
      menuDuMessageRef.current?.querySelectorAll('[role="menuitem"]') || [],
    );
    if (!lignes.length) return;
    const ici = lignes.indexOf(/** @type {any} */ (document.activeElement));
    const pas = event.key === 'ArrowDown' ? 1 : -1;
    const suivante = /** @type {any} */ (lignes[(ici + pas + lignes.length) % lignes.length]);
    suivante?.focus?.();
  }, []);

  const lancerAction = useCallback(async (
    /** @type {string} */ cle,
    /** @type {any} */ message,
  ) => {
    fermerLeMenu(false);
    if (cle === 'reply') {
      repondreA(message);
      return;
    }
    if (cle === 'copy') {
      try {
        await navigator.clipboard.writeText(String(message?.message || '').trim());
        setAnnonce(t('conversation.actions.copySuccess.title', 'Copié'));
      } catch {
        setAnnonce(t(
          'conversation.actions.copyUnavailable',
          'Le presse-papiers est indisponible sur cette build.',
        ));
      }
      return;
    }
    if (cle === 'edit') {
      setTexteEnEdition(String(message?.message || ''));
      setMessageEnEdition(message);
      return;
    }
    if (cle === 'delete') {
      setMessageASupprimer(message);
      return;
    }
    if (cle === 'editComposition') {
      ouvrirModificationConvocation({ composition: message?.composition, startStep: 2 });
      return;
    }
    if (cle === 'report') handleReportMessage(message);
  }, [fermerLeMenu, handleReportMessage, ouvrirModificationConvocation, repondreA, t]);

  // MSG1W §3.2 — la fenetre « Modifier » prend le focus ; Echap ferme les deux fenetres.
  const champEditionRef = useRef(/** @type {HTMLTextAreaElement | null} */ (null));
  useEffect(() => {
    if (!messageEnEdition && !messageASupprimer) return undefined;
    if (messageEnEdition) champEditionRef.current?.focus?.();
    const surTouche = (/** @type {KeyboardEvent} */ event) => {
      if (event.key !== 'Escape') return;
      setMessageEnEdition(null);
      setMessageASupprimer(null);
    };
    document.addEventListener('keydown', surTouche);
    return () => document.removeEventListener('keydown', surTouche);
  }, [messageASupprimer, messageEnEdition]);

  // MSG1W §3.2 — « Modifier » : le texte seul. Les pieces jointes ne sont pas envoyees, le serveur
  // les garde telles quelles (chat-message.ts, `hasAttachmentField`).
  const enregistrerLEdition = useCallback(async () => {
    const id = getMessageId(messageEnEdition);
    if (!id || typeof editMessage !== 'function') return;
    const aDesPiecesJointes = Array.isArray(messageEnEdition?.attachments)
      && messageEnEdition.attachments.length > 0;
    if (!texteEnEdition.trim() && !aDesPiecesJointes) {
      setAnnonce(t('conversation.edit.emptyMessage', 'Le message ne peut pas être vide.'));
      return;
    }
    setEnregistrementEnCours(true);
    try {
      await editMessage({ chatId, data: { message: texteEnEdition }, messageId: id });
      setMessageEnEdition(null);
    } catch {
      setAnnonce(t('conversation.edit.error', 'Impossible de modifier ce message.'));
    } finally {
      setEnregistrementEnCours(false);
    }
  }, [chatId, editMessage, messageEnEdition, t, texteEnEdition]);

  // MSG1W §3.2 — « Supprimer », apres confirmation : pour tout le monde. Le serveur previent les
  // autres par la socket ; ici, la bulle part tout de suite.
  const confirmerLaSuppression = useCallback(async () => {
    const id = getMessageId(messageASupprimer);
    setMessageASupprimer(null);
    if (!id || typeof deleteMessage !== 'function') return;
    try {
      await deleteMessage(id);
      const sansLui = (/** @type {any} */ ancien) => {
        if (!ancien?.pages) return ancien;
        return {
          ...ancien,
          pages: ancien.pages.map((/** @type {any} */ page) => ({
            ...page,
            data: Array.isArray(page?.data)
              ? page.data.filter((/** @type {any} */ entree) => getMessageId(entree) !== id)
              : [],
          })),
        };
      };
      queryClient.setQueriesData({ queryKey: ['chat-messages', chatId] }, sansLui);
    } catch {
      setAnnonce(t('conversation.actions.deleteError', 'Impossible de supprimer ce message.'));
    }
  }, [chatId, deleteMessage, messageASupprimer, queryClient, t]);

  // MSG1W §3.8 — repondre a un evenement depuis sa bulle : les MEMES gestes que le telephone
  // (Conversation.js : handleParticipateToEvent, handleDeclineEvent, handleJoinEvent). Ce que le
  // site ne sait pas faire dans le fil (reservation, choix d un creneau, seance parente) ouvre la
  // fiche de l evenement.
  const { missingEventMutation, respondToEventRsvpMutation } = useEventAnswerMutations();
  const participationMutation = useMutation({
    mutationFn: createEventParticipation,
    onError: (/** @type {any} */ erreur) => {
      setAnnonce(getParticipationErrorMessage(
        erreur,
        t('common.errorOccurred', 'Une erreur est survenue.'),
      ));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['planning', 'personal'] });
      setAnnonce(t('eventDetails.participationSuccess', 'Ta participation est enregistrée.'));
    },
  });
  const ouvrirLEvenement = useCallback((/** @type {string} */ eventId) => {
    if (eventId) navigation.navigate(RouteNames.EventDetails, { eventId });
  }, [navigation]);
  const participerALEvenement = useCallback(async (/** @type {any} */ evenement) => {
    if (evenement?.documentId && (
      String(evenement?.eventFormat || '').toLowerCase() === 'stage_day'
      || presenceDansLeFil({ evenement, utilisateur: userData })
    )) {
      await respondToEventRsvpMutation.mutateAsync({
        answer: 'present', eventId: evenement.documentId,
      });
      return;
    }
    const flux = resolveParticipationFlow(evenement, { user: userData });
    if (!flux?.canAct) {
      setAnnonce(flux?.blockedReason || t('common.errorOccurred', 'Une erreur est survenue.'));
      return;
    }
    if (flux?.submitMode === 'redirect-parent') {
      ouvrirLEvenement(evenement?.parentEvent?.documentId);
      return;
    }
    if (flux?.kind === 'reservation-recruiting' || flux?.submitMode === 'detection-slot-picker') {
      ouvrirLEvenement(evenement?.documentId);
      return;
    }
    if (evenement?.documentId && userData?.documentId) {
      await participationMutation.mutateAsync({
        event: evenement.documentId, user: userData.documentId,
      });
    }
  }, [ouvrirLEvenement, participationMutation, respondToEventRsvpMutation, t, userData]);
  const declinerLEvenement = useCallback((/** @type {any} */ evenement) => {
    if (!evenement?.documentId) return Promise.resolve();
    if (String(evenement?.eventFormat || '').toLowerCase() === 'stage_day') {
      return respondToEventRsvpMutation.mutateAsync({
        answer: 'absent', eventId: evenement.documentId,
      });
    }
    return missingEventMutation.mutateAsync(evenement.documentId);
  }, [missingEventMutation, respondToEventRsvpMutation]);
  const rejoindreLEvenement = useCallback((/** @type {any} */ evenement) => {
    ouvrirLEvenement(evenement?.parentEvent?.documentId || evenement?.documentId);
  }, [ouvrirLEvenement]);

  // MSG1W §3.5 — la fenetre « Créer un sondage » du telephone (PollCreationModal) : elle valide
  // la question et 2 a 6 options ; ici on n envoie que ce qu elle rend.
  const envoyerLeSondage = useCallback(async (/** @type {any} */ sondage) => {
    await sendChatPayload({
      composition: createPollComposition({
        allowMultipleVotes: Boolean(sondage?.allowMultipleVotes),
        createdBy: userData?.documentId || '',
        isAnonymous: Boolean(sondage?.isAnonymous),
        options: Array.isArray(sondage?.options) ? sondage.options : [],
        question: String(sondage?.question || '').trim(),
      }),
    });
    setSondageOuvert(false);
  }, [sendChatPayload, userData?.documentId]);

  // MSG1W §3.16 — LE GROUPE ET LE TETE-A-TETE. Memes regles que le telephone (Conversation.js) :
  // les admins d un groupe le renomment et retirent ses membres ; un tete-a-tete STRICTEMENT a deux
  // (K5) permet de bloquer la personne ; les messages d une personne bloquee sont caches (K4).
  const estUnGroupe = chatData?.type === 'group';
  const adminsDuGroupe = useMemo(() => (
    // @ts-ignore: FIXME: Baseline TS regression
    (Array.isArray(chatData?.groupAdmins) ? chatData.groupAdmins : [])
      .map((/** @type {any} */ admin) => String(admin?.documentId || admin?.id || ''))
      .filter(Boolean)
  ), [chatData]);
  const jeSuisAdmin = estUnGroupe && adminsDuGroupe.includes(String(userData?.documentId || ''));
  const autrePersonne = resolveOtherParticipantId(chatData, userData?.documentId);
  // Les crochets de blocage se declarent `object` : on dit ce qu on en lit.
  const { data: mesBlocages } = /** @type {{ data?: any[] }} */ (
    useGetMyBlockedUsers({ enabled: Boolean(userData?.documentId) })
  );
  const personnesBloquees = useMemo(() => toBlockedUserIdSet(mesBlocages || []), [mesBlocages]);
  const autrePersonneBloquee = Boolean(autrePersonne && personnesBloquees.has(autrePersonne));
  // Le fil range en groupes et en jours, SANS les messages d une personne bloquee (K4).
  const entreesDuFil = useMemo(
    () => rangerLeFil(hideBlockedMessages(messages, personnesBloquees)),
    [messages, personnesBloquees],
  );
  /** @typedef {{ isPending: boolean, mutate: (id: string) => void }} GesteDeBlocage */
  const { isPending: blocageEnCours, mutate: bloquer } = /** @type {GesteDeBlocage} */ (
    useBlockUser()
  );
  const { isPending: deblocageEnCours, mutate: debloquer } = /** @type {GesteDeBlocage} */ (
    useUnblockUser()
  );
  // Contrat 1B §2.3 : le repli du role du staff, absent du type `Chat` partage (lot 1B-app).
  const rolesDuStaff = /** @type {Record<string, string> | undefined} */ (
    /** @type {any} */ (chatData)?.staffRoles
  );

  // Comme le telephone : le signalement d un fil passe par le support.
  const texteDuSignalement = t(
    'conversation.report.contactSupport',
    'Pour signaler ce match ou cet utilisateur, merci de contacter le support via les paramètres.',
  );
  const entreesDuMenuOptions = [
    ...(estUnGroupe ? [{
      action: () => setInfosOuvertes(true),
      cle: 'infos',
      libelle: t('conversation.web.fil.infosDuGroupe', 'Infos du groupe'),
    }] : []),
    {
      action: () => setAnnonce(texteDuSignalement),
      cle: 'signaler',
      libelle: t('conversation.actions.report', 'Signaler'),
    },
    ...(autrePersonne ? [{
      action: () => {
        if (autrePersonneBloquee) {
          debloquer(autrePersonne);
          return;
        }
        setBlocageAConfirmer(true);
      },
      cle: 'bloquer',
      libelle: autrePersonneBloquee
        ? t('userBlock.actions.unblock', 'Débloquer cette personne')
        : t('userBlock.actions.block', 'Bloquer cette personne'),
    }] : []),
  ];

  // Le menu ⋮ se ferme par Echap ou un clic a cote.
  useEffect(() => {
    if (!menuOptionsOuvert) return undefined;
    const surTouche = (/** @type {KeyboardEvent} */ event) => {
      if (event.key === 'Escape') setMenuOptionsOuvert(false);
    };
    const surClic = (/** @type {MouseEvent} */ event) => {
      if (menuOptionsRef.current?.contains(/** @type {Node} */ (event.target))) return;
      setMenuOptionsOuvert(false);
    };
    document.addEventListener('keydown', surTouche);
    document.addEventListener('mousedown', surClic);
    return () => {
      document.removeEventListener('keydown', surTouche);
      document.removeEventListener('mousedown', surClic);
    };
  }, [menuOptionsOuvert]);

  // Echap ferme les infos du groupe et ses confirmations.
  useEffect(() => {
    if (!infosOuvertes && !membreARetirer && !blocageAConfirmer) return undefined;
    if (typeof document === 'undefined') return undefined;
    const surTouche = (/** @type {KeyboardEvent} */ event) => {
      if (event.key !== 'Escape') return;
      if (membreARetirer || departAConfirmer) {
        setMembreARetirer(null);
        setDepartAConfirmer(false);
        return;
      }
      setBlocageAConfirmer(false);
      setInfosOuvertes(false);
      setNomEnEdition(null);
    };
    document.addEventListener('keydown', surTouche);
    return () => document.removeEventListener('keydown', surTouche);
  }, [blocageAConfirmer, departAConfirmer, infosOuvertes, membreARetirer]);

  const enregistrerLeNom = useCallback(async () => {
    const nom = String(nomEnEdition || '').trim();
    if (!chatId || !nom || typeof updateGroupMeta !== 'function') {
      setAnnonce(t('conversation.group.invalidName', 'Entre un nom de groupe valide.'));
      return;
    }
    try {
      await updateGroupMeta({ chatId, data: { groupName: nom } });
      setNomEnEdition(null);
      setAnnonce(t('conversation.group.renamed', 'Nom du groupe mis à jour.'));
      await queryClient.invalidateQueries({ queryKey: ['chat', chatId] });
    } catch {
      setAnnonce(t(
        'conversation.group.renameError',
        'Impossible de mettre à jour le nom du groupe.',
      ));
    }
  }, [chatId, nomEnEdition, queryClient, t, updateGroupMeta]);

  const retirerLeMembre = useCallback(async () => {
    const membre = membreARetirer;
    setMembreARetirer(null);
    const id = String(membre?.documentId || membre?.id || '').trim();
    if (!chatId || !id || typeof removeGroupMember !== 'function') return;
    try {
      await removeGroupMember({ chatId, userId: id });
      await queryClient.invalidateQueries({ queryKey: ['chat', chatId] });
    } catch {
      setAnnonce(t('conversation.group.removeError', 'Impossible de retirer ce membre.'));
    }
  }, [chatId, membreARetirer, queryClient, removeGroupMember, t]);

  // MSG1W (§3.16, decision d Adel `quitter maintenant`) — QUITTER LE GROUPE, pour tout membre,
  // par la fonction de service du telephone (chatService.leaveGroupChat, route 1B §5.6), puis
  // retour a la liste.
  const quitterLeGroupe = useCallback(async () => {
    setDepartAConfirmer(false);
    if (!chatId) return;
    try {
      await leaveGroupChat(chatId);
      setInfosOuvertes(false);
      await queryClient.invalidateQueries({ queryKey: ['chats'] });
      navigation.navigate(RouteNames.Chat);
    } catch {
      setAnnonce(t(
        'conversation.groupInfo.leaveError',
        'Impossible de quitter le groupe pour le moment.',
      ));
    }
  }, [chatId, navigation, queryClient, t]);

  // Echap ferme la fenetre ouverte depuis le « + » (« Créer un sondage » compris : SMF, T20),
  // ou celle d une adresse. ⚠️ Ecoutee A LA DESCENTE (`true`) : les champs du sondage sont des
  // TextInput de react-native-web, qui arretent la touche (`stopPropagation`) avant le document.
  useEffect(() => {
    if (!fenetre && !adresseOuverte && !sondageOuvert) return undefined;
    if (typeof document === 'undefined') return undefined;
    const surTouche = (/** @type {KeyboardEvent} */ event) => {
      if (event.key !== 'Escape') return;
      setFenetre('');
      setAdresseOuverte('');
      setSondageOuvert(false);
    };
    document.addEventListener('keydown', surTouche, true);
    return () => document.removeEventListener('keydown', surTouche, true);
  }, [adresseOuverte, fenetre, sondageOuvert]);

  const copierLAdresse = useCallback(async () => {
    const adresse = adresseOuverte;
    setAdresseOuverte('');
    try {
      await navigator.clipboard.writeText(adresse);
      setAnnonce(t('conversation.address.copied', 'Adresse copiée'));
    } catch {
      setAnnonce(t(
        'conversation.actions.copyUnavailable',
        'Le presse-papiers est indisponible sur cette build.',
      ));
    }
  }, [adresseOuverte, t]);

  /**
   * MSG1W §3.1 — UNE BULLE DU FIL, au dessin du pack « modele WhatsApp » (SPECS §1) :
   * groupee par expediteur (nom sur la premiere, avatar et queue sur la derniere), heure et
   * coches DANS la bulle, reactions a cheval sur son bas. Les gestes (reagir, repondre,
   * signaler, renvoyer) restent ceux d avant : seule leur place change.
   * @param {import('@/views/conversationWeb/filDuSite').EntreeMessage} entree - Le message rangé.
   * @returns {import('react').ReactElement} La rangee du message.
   */
  const renderMessageCard = useCallback((
    /** @type {import('@/views/conversationWeb/filDuSite').EntreeMessage} */ entree,
  ) => {
    const { dernier, message, premier } = entree;
    const idMessage = getMessageId(message);
    // COLL-C4A2 — « … a rejoint le canal » n'a pas d'expéditeur : une notice centrée, sans bulle.
    // MSG1W §3.17 — de meme pour une notice de groupe (contrat 1B §6 : `systemNotice` present,
    // jamais sur un message ordinaire) : sa phrase, dans le style discret du pack.
    // 🏛️ R17-CANAUX — l'actualité posée par la Ville dans son canal : une notice qui mène à elle
    // (bouton de 44 de haut au moins, nommé pour le lecteur d'écran).
    const lienActualite = filDeLaVille.ligneDActualite(message);
    if (lienActualite) {
      return (
        <div
          data-msg1w-id={idMessage}
          key={idMessage}
          style={{ display: 'flex', justifyContent: 'center', marginTop: 6 }}
        >
          <button
            aria-label={lienActualite.libelle}
            data-testid={`R17CANAUX-actualite-${idMessage}`}
            onClick={lienActualite.ouvrir}
            style={{
              background: PALETTE_DU_FIL.noticeFond,
              border: 'none',
              borderRadius: 8,
              color: PALETTE_DU_FIL.texteDoux,
              cursor: 'pointer',
              fontFamily: 'Montserrat, sans-serif',
              fontSize: 11.5,
              lineHeight: '15px',
              maxWidth: 280,
              minHeight: 44,
              padding: '3px 10px',
              textAlign: 'center',
            }}
            type="button"
          >
            {lienActualite.texte}
            {' '}
            <span style={{ color: PALETTE_DU_FIL.accent, textDecoration: 'underline' }}>
              {lienActualite.voir}
            </span>
          </button>
        </div>
      );
    }
    if (filDeLaVille.estLigneSysteme(message) || message?.systemNotice != null) {
      return (
        <div
          data-msg1w-id={idMessage}
          data-testid={`MSG1W-notice-${idMessage}`}
          key={idMessage}
          style={{ display: 'flex', justifyContent: 'center', marginTop: 6 }}
        >
          <span
            style={{
              background: PALETTE_DU_FIL.noticeFond,
              borderRadius: 8,
              color: PALETTE_DU_FIL.noticeTexte,
              fontSize: 11.5,
              lineHeight: '15px',
              maxWidth: 280,
              padding: '3px 10px',
              textAlign: 'center',
            }}
          >
            {String(message?.message || '')}
          </span>
        </div>
      );
    }
    // COLL-C4A2 — dans un fil de la Ville, qui écrit ET pour quel club.
    const senderName = filDeLaVille.nomDeLExpediteur(message) || getDisplayName(message?.sender);
    // MSG-SUPPORT — en console, les réponses de l'équipe sont à droite.
    const isMine = areSameEntityId(message?.sender?.documentId, userData?.documentId)
      || Boolean(filDeLaVille.estDeMonCote?.(message))
    // FINITIONS16 20 (planche 47) : MON message dans un fil de la Ville dit au nom de qui il part.
    let maVoix = isMine && filDeLaVille.estFil
      ? String(message?.senderSignature?.nom || '').trim()
      : '';
    // MSG-SUPPORT — en console, NOS réponses disent qui de l'équipe les a écrites.
    if (isMine && filDeLaVille.estAssistance) {
      maVoix = String(filDeLaVille.nomDeLExpediteur(message) || '');
    }
    // Le nom et l avatar ne servent qu a plusieurs : un tete-a-tete n en porte pas (SPECS §1).
    const estAPlusieurs = chatData?.type !== 'whisper';
    const montrerNom = (!isMine && estAPlusieurs && premier) || Boolean(maVoix && premier);
    const montrerAvatar = !isMine && estAPlusieurs && dernier;
    // MSG1B-1 (serveur, contrat du 07/10, §2.3) : `sender.staffRole` vaut `dirigeant` ou
    // `entraineur` dans les fils d equipe, de club et omnisport, en repli `chat.staffRoles`
    // (la regle du telephone, « genre A »). Absent : rien ne s affiche.
    const cleDuRole = message?.sender?.staffRole
      || rolesDuStaff?.[getEntityDocumentId(message?.sender)];
    const roleDuStaff = {
      dirigeant: i18next.t('conversation.staffRole.dirigeant', 'Dirigeant'),
      entraineur: i18next.t('conversation.staffRole.entraineur', 'Coach / Prof'),
    }[String(cleDuRole || '')] || '';
    const attachments = Array.isArray(message?.attachments) ? message.attachments : []
    const shouldRenderAttachments = attachments.length > 0 && message?.composition?.type !== 'voice_note'
    const replyPreview = message?.replyTo
    // MSG1W §3.8 — un evenement (relation ou partage) se dessine avec la bulle du telephone ; le
    // mot « Partage » envoye avec lui ne s affiche plus.
    const evenement = evenementDuMessage(message);
    // AMICAUX-CORRECTIFS 81 — le texte de secours d une proposition amicale parle au camp qui
    // RECOIT (« … se deplace chez vous ») : faux pour celui qui l a envoyee, et la bulle dit deja
    // tout, petit mot compris (AMIC-82). Seule une proposition d avant ce lot, sans petit mot dans
    // la bulle, le garde — et seulement pour le camp qui recoit.
    const propositionAmicale = isFriendlyProposal(message?.composition);
    const texteDeSecoursInutile = propositionAmicale && (
      Boolean(String(message?.composition?.staffMessage || '').trim())
      || !canAcceptFriendlyProposal(message?.composition, userData?.documentId)
    );
    const texte = evenement || texteDeSecoursInutile ? '' : String(message?.message || '').trim();
    // Les cartes du telephone (composition, sondage) portent deja leur cadre : elles se posent
    // SANS bulle. COL-015 — PAS l evenement : depuis MSG1A §3.8, EventMessageBubble se pose DANS
    // la bulle (BulleDuFil sur le telephone) ; nue, elle tombait sur le fond nuit du fil.
    const estCarteNue = ['contact_share', 'location_share', 'poll']
      .includes(String(message?.composition?.type || ''))
      || propositionAmicale
      || (message?.composition?.type === 'lineup_share'
        && Boolean(String(message?.composition?.eventId || '').trim()));
    const fondDeBulle = isMine ? PALETTE_DU_FIL.bulleMienne : PALETTE_DU_FIL.bulleRecue;
    const messageReactions = getReactionsForMessage(reactionsByMessage, idMessage);
    const myReactionEmoji = getMyReactionEmoji(messageReactions, userData?.documentId);
    const totalDesReactions = messageReactions.reduce(
      (somme, reaction) => somme + (Number(reaction?.count) || 0),
      0,
    );
    const auteurCite = replyPreview?.sender;
    const meta = (
      <MetaDuMessage
        heure={formatTime(message?.createdAt)}
        idMessage={idMessage}
        message={message}
        mien={isMine}
      />
    );

    return (
      <div
        data-msg1w-id={idMessage}
        key={idMessage}
        style={{
          alignItems: 'flex-end',
          display: 'flex',
          gap: 8,
          justifyContent: isMine ? 'flex-end' : 'flex-start',
          marginBottom: messageReactions.length > 0 ? 16 : 0,
          marginTop: premier ? 10 : 2,
          paddingLeft: isMine ? (isDesktop ? '18%' : 64) : 8,
          paddingRight: isMine ? 10 : (isDesktop ? '18%' : 40),
        }}
      >
        {!isMine && estAPlusieurs ? (
          <span style={{ flexShrink: 0, width: 28 }}>
            {montrerAvatar ? (
              <AvatarDuGroupe idMessage={idMessage} personne={message?.sender} />
            ) : null}
          </span>
        ) : null}
        <div
          className="REACTWEB-hote"
          style={{
            display: 'flex',
            flexDirection: 'column',
            maxWidth: '100%',
            minWidth: 0,
            // REACT-WEB — la barre du survol est posee EN ABSOLU a cote de la bulle : elle
            // n occupe aucune place, donc aucune bulle ne se decale quand elle apparait.
            position: 'relative',
          }}
        >
          <div
            data-testid={`REACTWEB-bulle-${idMessage}`}
            // MSG1W §3.2 — l appui long du telephone devient le CLIC DROIT.
            onContextMenu={(event) => {
              event.preventDefault();
              ouvrirLeMenu(message, { x: event.clientX, y: event.clientY }, null);
            }}
            style={{
              alignSelf: isMine ? 'flex-end' : 'flex-start',
              background: estCarteNue ? 'transparent' : fondDeBulle,
              borderBottomLeftRadius: !isMine && dernier && !estCarteNue ? 4 : 18,
              borderBottomRightRadius: isMine && dernier && !estCarteNue ? 4 : 18,
              borderRadius: 18,
              boxSizing: 'border-box',
              color: PALETTE_DU_FIL.texte,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              maxWidth: '100%',
              minWidth: 0,
              padding: estCarteNue ? 0 : '6px 10px 7px',
              position: 'relative',
            }}
          >
            {dernier && !estCarteNue ? (
              <QueueDeBulle couleur={fondDeBulle} mienne={isMine} />
            ) : null}
            {montrerNom ? (
              <div
                data-testid={`MSG1W-nom-${idMessage}`}
                style={{
                  alignItems: 'baseline',
                  display: 'flex',
                  gap: 10,
                  justifyContent: 'space-between',
                }}
              >
                <span
                  style={{
                    color: isMine ? PALETTE_DU_FIL.texteDoux : couleurDeLaPersonne(message?.sender),
                    fontFamily: 'Montserrat-Bold, sans-serif',
                    fontSize: 13,
                  }}
                >
                  {isMine ? maVoix : senderName}
                </span>
                {roleDuStaff && !isMine ? (
                  <span style={{ color: PALETTE_DU_FIL.role, fontSize: 11.5 }}>{roleDuStaff}</span>
                ) : null}
              </div>
            ) : null}
            {replyPreview ? (
              <button
                onClick={() => {
                  colleAuBasRef.current = false;
                  const cible = document.querySelector(
                    `[data-msg1w-id="${getMessageId(replyPreview)}"]`,
                  );
                  cible?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
                }}
                style={{
                  background: isMine ? PALETTE_DU_FIL.carteMienne : PALETTE_DU_FIL.carteRecue,
                  border: 0,
                  borderLeft: `4px solid ${couleurDeLaPersonne(auteurCite)}`,
                  borderRadius: 10,
                  color: PALETTE_DU_FIL.texte,
                  cursor: 'pointer',
                  display: 'grid',
                  gap: 2,
                  minWidth: 190,
                  padding: '6px 10px',
                  textAlign: 'left',
                }}
                type="button"
              >
                <span
                  style={{
                    color: couleurDeLaPersonne(auteurCite),
                    fontFamily: 'Montserrat-Bold, sans-serif',
                    fontSize: 12.5,
                  }}
                >
                  {getDisplayName(auteurCite)}
                </span>
                <span
                  style={{
                    color: PALETTE_DU_FIL.texteDoux,
                    fontSize: 13,
                    lineHeight: '18px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {String(replyPreview?.message || '').trim() || 'Message partagé'}
                </span>
              </button>
            ) : null}
            {shouldRenderAttachments ? renderAttachments(attachments) : null}
            {evenement ? (
              <EventMessageBubble
                event={evenement}
                isMe={isMine}
                // COL-015 — l heure DANS la carte, au-dessus du pied (Conversation.js, `meta`).
                meta={meta}
                onDecline={(eventHydrate = evenement) => declinerLEvenement(eventHydrate)}
                onJoin={() => rejoindreLEvenement(evenement)}
                onParticipate={(eventHydrate = evenement) => participerALEvenement(eventHydrate)}
              />
            ) : null}
            {message?.composition && !evenement ? renderComposition(message, isMine) : null}
            {texte ? (
              <div
                style={{
                  fontFamily: 'Montserrat-Regular, sans-serif',
                  fontSize: 15,
                  lineHeight: '20px',
                  overflowWrap: 'anywhere',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {/* MSG1W (1-A, §3.18) — une adresse ecrite devient un lien (regle de MSG1A). */}
                {morceauxDuTexte(texte).map((morceau, rang) => (morceau.type === 'adresse' ? (
                  <button
                    aria-haspopup="dialog"
                    // eslint-disable-next-line react/no-array-index-key -- sans identifiant
                    key={`adresse-${rang}`}
                    onClick={() => setAdresseOuverte(morceau.valeur)}
                    style={{
                      background: 'transparent',
                      border: 0,
                      color: isMine ? PALETTE_DU_FIL.texte : PALETTE_DU_FIL.accent,
                      cursor: 'pointer',
                      font: 'inherit',
                      padding: 0,
                      textAlign: 'inherit',
                      textDecoration: 'underline',
                    }}
                    type="button"
                  >
                    {morceau.valeur}
                  </button>
                  // eslint-disable-next-line react/no-array-index-key -- morceaux sans identifiant
                ) : <Fragment key={`texte-${rang}`}>{morceau.valeur}</Fragment>))}
                {/* La place de l heure au bout de la derniere ligne (SPECS §1 : 54 / 36). */}
                <span
                  aria-hidden="true"
                  style={{ display: 'inline-block', width: isMine ? 58 : 40 }}
                />
              </div>
            ) : null}
            {texte ? (
              <span style={{ bottom: 6, position: 'absolute', right: 10 }}>{meta}</span>
            ) : null}
            {!texte && !evenement ? (
              <span style={{ alignSelf: 'flex-end', paddingRight: estCarteNue ? 8 : 0 }}>
                {meta}
              </span>
            ) : null}
            {messageReactions.length > 0 ? (
              <span
                data-testid={`MSGREACT-rangee-${idMessage}`}
                style={{
                  alignItems: 'center',
                  background: PALETTE_DU_FIL.bulleRecue,
                  border: `1px solid ${myReactionEmoji ? PALETTE_DU_FIL.accent : 'transparent'}`,
                  borderRadius: 12,
                  bottom: -17,
                  boxShadow: `0 0 0 2px ${PALETTE_DU_FIL.fil}`,
                  boxSizing: 'border-box',
                  display: 'inline-flex',
                  fontSize: 13,
                  gap: 2,
                  height: 24,
                  left: isMine ? undefined : 10,
                  padding: '0 7px',
                  position: 'absolute',
                  right: isMine ? 10 : undefined,
                }}
                title={messageReactions
                  .flatMap((reaction) => (Array.isArray(reaction?.users) ? reaction.users : []))
                  .map((user) => [user?.firstname, user?.lastname].filter(Boolean).join(' '))
                  .filter(Boolean)
                  .join(', ')}
              >
                {messageReactions.slice(0, 3).map((reaction) => (
                  <span key={`${idMessage}-${reaction?.emoji}`}>{reaction?.emoji}</span>
                ))}
                <span
                  style={{
                    color: PALETTE_DU_FIL.texteDoux,
                    fontFamily: 'Montserrat-Bold, sans-serif',
                    fontSize: 12,
                    marginLeft: 3,
                  }}
                >
                  {String(totalDesReactions)}
                </span>
              </span>
            ) : null}
          </div>
          {message?.failed ? (
            <button
              onClick={() => handleRetryFailedMessage(message)}
              style={{
                alignSelf: 'flex-end',
                background: 'transparent',
                border: 0,
                color: PALETTE_DU_FIL.danger,
                cursor: 'pointer',
                fontFamily: 'Montserrat-Bold, sans-serif',
                fontSize: 12,
                marginTop: 4,
                padding: 0,
              }}
              type="button"
            >
              Renvoyer
            </button>
          ) : null}
          {/* La barre du survol, A COTE de la bulle : reagir, repondre, signaler. */}
          <div
            style={{
              alignItems: 'center',
              display: 'flex',
              gap: 4,
              left: isMine ? undefined : '100%',
              padding: '0 6px',
              position: 'absolute',
              right: isMine ? '100%' : undefined,
              top: 4,
              zIndex: 2,
            }}
          >
            <button
              aria-expanded={reactionBarMessageId === idMessage}
              aria-haspopup="true"
              aria-label={i18next.t('conversation.reactions.add', 'Réagir à ce message')}
              className="REACTWEB-declencheur"
              data-testid={`REACTWEB-reagir-${idMessage}`}
              onClick={(event) => {
                reactionTriggerRef.current = event.currentTarget;
                if (reactionBarMessageId === idMessage) {
                  setReactionBarMessageId('');
                  return;
                }
                setReactionBarAnchor(getReactionBarAnchor(event.currentTarget));
                setReactionBarMessageId(idMessage);
              }}
              style={{
                alignItems: 'center',
                background: PALETTE_DU_FIL.menu,
                border: `1px solid ${PALETTE_DU_FIL.menuBord}`,
                borderRadius: 999,
                color: PALETTE_DU_FIL.texte,
                cursor: 'pointer',
                display: 'flex',
                height: 28,
                justifyContent: 'center',
                lineHeight: 1,
                padding: 0,
                transition: 'opacity 120ms ease',
                width: 28,
              }}
              type="button"
            >
              {/* REACT-WEB — l icone du bouton qui ouvre la barre (FINITIONS16 20 : un dessin au
                  trait, plus un emoji). Elle n appartient PAS au jeu ferme des six reactions. */}
              <svg
                aria-hidden="true"
                fill="none"
                height="16"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                width="16"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M8.5 14.5c.9 1.2 2.1 1.8 3.5 1.8s2.6-.6 3.5-1.8" />
                <path d="M9 9.5h.01M15 9.5h.01" />
              </svg>
            </button>
            {peutEcrire ? (
              <BoutonDuSurvol
                classeEnPlus="MSG1W-sur-souris"
                libelle={i18next.t('conversation.actions.reply', 'Répondre')}
                onClick={() => repondreA(message)}
                testId={`MSG1W-repondre-${idMessage}`}
              >
                {DESSIN_REPONDRE}
              </BoutonDuSurvol>
            ) : null}
            <BoutonDuSurvol
              libelle={i18next.t('conversation.web.fil.plusDActions', 'Plus d’actions')}
              menu
              menuOuvert={menuDuMessage?.id === idMessage}
              onClick={(event) => {
                const cadre = event.currentTarget.getBoundingClientRect();
                ouvrirLeMenu(message, { x: cadre.left, y: cadre.bottom + 4 }, event.currentTarget);
              }}
              testId={`MSG1W-plus-${idMessage}`}
            >
              {DESSIN_PLUS_D_ACTIONS}
            </BoutonDuSurvol>
          </div>
          {reactionBarMessageId === getMessageId(message) && reactionBarAnchor && !clavierOuvert ? (
            <div
              aria-label={i18next.t('conversation.reactions.pick', 'Choisir une réaction')}
              data-testid={`REACTWEB-barre-${getMessageId(message)}`}
              ref={reactionBarRef}
              role="group"
              style={{
                alignItems: 'center',
                backdropFilter: 'blur(10px)',
                background: panelBackground,
                border: `1px solid ${borderColor}`,
                borderRadius: 999,
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.45)',
                boxSizing: 'border-box',
                display: 'flex',
                gap: 2,
                height: REACTION_BAR_HEIGHT,
                justifyContent: 'center',
                left: reactionBarAnchor.left,
                padding: 4,
                // Fixe, donc hors d atteinte du cadre qui defile : voir getReactionBarAnchor.
                position: 'fixed',
                top: reactionBarAnchor.top,
                width: REACTION_BAR_WIDTH,
                zIndex: 40,
              }}
            >
              {REACTION_EMOJIS.map((emoji, emojiIndex) => (
                <button
                  aria-label={emoji}
                  aria-pressed={myReactionEmoji === emoji}
                  data-testid={`REACTWEB-emoji-${emojiIndex}`}
                  key={`reaction-choice-${emoji}`}
                  onClick={() => handleToggleReaction(getMessageId(message), emoji)}
                  style={{
                    background: myReactionEmoji === emoji
                      ? 'rgba(1, 179, 244, 0.22)'
                      : 'transparent',
                    border: 0,
                    borderRadius: 999,
                    cursor: 'pointer',
                    fontSize: 18,
                    lineHeight: 1,
                    padding: '6px 8px',
                  }}
                  type="button"
                >
                  {emoji}
                </button>
              ))}
              {/*
                WHATSAPP — LE « + ». Avant ce lot, la barre s arretait aux six
                raccourcis et le serveur REFUSAIT tout le reste : reagir avec
                autre chose etait litteralement impossible. Il ouvre le clavier
                complet, A LA PLACE de la barre — les deux ne coexistent jamais.
              */}
              <button
                aria-label={i18next.t('conversation.reactions.more', "Plus d'emojis")}
                data-testid="REACTWEB-plus"
                onClick={() => {
                  if (reactionTriggerRef.current) {
                    setReactionBarAnchor(getReactionBarAnchor(
                      reactionTriggerRef.current,
                      REACTION_PICKER_WIDTH,
                      REACTION_PICKER_HEIGHT,
                    ));
                  }
                  setClavierOuvert(true);
                }}
                style={{
                  background: 'transparent',
                  border: 0,
                  borderRadius: 999,
                  color: baseTextColor,
                  cursor: 'pointer',
                  fontSize: 18,
                  lineHeight: 1,
                  padding: '6px 8px',
                }}
                type="button"
              >
                +
              </button>
            </div>
          ) : null}
          {reactionBarMessageId === getMessageId(message) && reactionBarAnchor && clavierOuvert ? (
            <div
              aria-label={i18next.t('conversation.reactions.more', "Plus d'emojis")}
              data-testid={`REACTWEB-clavier-${getMessageId(message)}`}
              ref={reactionBarRef}
              role="dialog"
              style={{
                background: panelBackground,
                border: `1px solid ${borderColor}`,
                borderRadius: 16,
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.45)',
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                height: REACTION_PICKER_HEIGHT,
                left: reactionBarAnchor.left,
                padding: 8,
                // Fixe, comme la barre, et pour la meme raison : voir getReactionBarAnchor.
                position: 'fixed',
                top: reactionBarAnchor.top,
                width: REACTION_PICKER_WIDTH,
                zIndex: 40,
              }}
            >
              <div
                role="tablist"
                style={{
                  display: 'flex',
                  gap: 4,
                  overflowX: 'auto',
                  paddingBottom: 6,
                }}
              >
                {EMOJI_CATALOG.map((categorie) => (
                  <button
                    aria-selected={familleEmoji === categorie.key}
                    key={categorie.key}
                    onClick={() => setFamilleEmoji(categorie.key)}
                    role="tab"
                    style={{
                      background: familleEmoji === categorie.key
                        ? 'rgba(1, 179, 244, 0.22)'
                        : 'transparent',
                      border: 0,
                      borderRadius: 999,
                      color: baseTextColor,
                      cursor: 'pointer',
                      fontSize: 12,
                      padding: '5px 10px',
                      whiteSpace: 'nowrap',
                    }}
                    type="button"
                  >
                    {i18next.t(`conversation.reactions.categories.${categorie.key}`, categorie.key)}
                  </button>
                ))}
              </div>
              <div
                style={{
                  display: 'grid',
                  flex: 1,
                  gridTemplateColumns: 'repeat(8, 1fr)',
                  overflowY: 'auto',
                }}
              >
                {(EMOJI_CATALOG.find((categorie) => categorie.key === familleEmoji)?.emojis ?? [])
                  .map((emoji) => (
                    <button
                      aria-label={emoji}
                      key={`catalogue-${emoji}`}
                      onClick={() => handleToggleReaction(getMessageId(message), emoji)}
                      style={{
                        background: 'transparent',
                        border: 0,
                        borderRadius: 8,
                        cursor: 'pointer',
                        fontSize: 20,
                        lineHeight: 1,
                        padding: 4,
                      }}
                      type="button"
                    >
                      {emoji}
                    </button>
                  ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    )
  }, [
    baseTextColor,
    borderColor,
    chatData?.type,
    clavierOuvert,
    familleEmoji,
    filDeLaVille,
    handleRetryFailedMessage,
    handleToggleReaction,
    isDesktop,
    panelBackground,
    reactionBarAnchor,
    reactionBarMessageId,
    reactionsByMessage,
    declinerLEvenement,
    menuDuMessage?.id,
    ouvrirLeMenu,
    participerALEvenement,
    peutEcrire,
    rejoindreLEvenement,
    renderAttachments,
    renderComposition,
    repondreA,
    rolesDuStaff,
    userData?.documentId,
  ])

  if (!chatId) {
    return (
      <ScreenContainer
        bgImage="bg2"
        contentWidth="full"
        responsivePadding
        // @ts-ignore: FIXME: Baseline TS regression
        style={{ paddingBottom: 32 }}
      >
        {renderStateCard({
          actionLabel: i18next.t('conversation.web.noChat.cta', 'Voir mes messages'),
          description: i18next.t(
            'conversation.web.noChat.body',
            'Aucune conversation n a été sélectionnée. Reviens à la liste des messages puis ouvre une discussion.', // eslint-disable-line max-len
          ),
          onAction: () => navigation.navigate(RouteNames.Chat),
          title: 'Conversation introuvable',
        })}
      </ScreenContainer>
    )
  }

  if (isChatLoading && !chatData) {
    return (
      <ScreenContainer
        bgImage="bg2"
        contentWidth="full"
        responsivePadding
        // @ts-ignore: FIXME: Baseline TS regression
        style={{ paddingBottom: 32 }}
      >
        {renderStateCard({
          description: i18next.t(
            'conversation.web.loading.conversationInProgress',
            'Chargement de la conversation en cours...',
          ),
          title: 'Chargement',
        })}
      </ScreenContainer>
    )
  }

  if (chatError && !chatData) {
    return (
      <ScreenContainer
        bgImage="bg2"
        contentWidth="full"
        responsivePadding
        // @ts-ignore: FIXME: Baseline TS regression
        style={{ paddingBottom: 32 }}
      >
        {renderStateCard({
          actionLabel: i18next.t('conversation.web.retry', 'Réessayer'),
          description: getErrorMessage(chatError, i18next.t(
            'conversation.web.loading.conversationError',
            'Impossible de charger cette conversation.',
          )),
          onAction: retryConversationLoad,
          title: 'Conversation indisponible',
        })}
      </ScreenContainer>
    )
  }

  if (!chatData) {
    return (
      <ScreenContainer
        bgImage="bg2"
        contentWidth="full"
        responsivePadding
        // @ts-ignore: FIXME: Baseline TS regression
        style={{ paddingBottom: 32 }}
      >
        {renderStateCard({
          actionLabel: i18next.t('conversation.web.notFound.cta', 'Retour à mes messages'),
          description: i18next.t(
            'conversation.web.notFound.body',
            "Cette conversation est introuvable ou tu n'y as plus accès.",
          ),
          onAction: () => navigation.navigate(RouteNames.Chat),
          title: 'Conversation introuvable',
        })}
      </ScreenContainer>
    )
  }

  // MSG1W §3.2 — le message dont le menu est ouvert, ses actions, et ma reaction a lui.
  const messageDuMenu = menuDuMessage
    ? messages.find(
      (/** @type {any} */ message) => getMessageId(message) === menuDuMessage.id,
    ) || null
    : null;
  const actionsDuMenu = messageDuMenu ? actionsDuMessage(messageDuMenu) : [];
  const maReactionDuMenu = menuDuMessage
    ? getMyReactionEmoji(
      getReactionsForMessage(reactionsByMessage, menuDuMessage.id),
      userData?.documentId,
    )
    : '';
  const filVideHorsVille = !isMessagesLoading && !messagesError && !messages.length
    && !filDeLaVille.estFil;
  const placeholderDeLaSaisie = filDeLaVille.placeholder
    || t('conversation.messagePlaceholder', 'Message');
  const aDuTexte = Boolean(composerText.trim());
  const micIndisponible = isStoppingVoice
    || (!isRecordingVoice && !isVoiceRecordingSupported)
    || isUploading
    || isSending
    || isSubmittingProposal;
  // SMF (T20) — la regle du telephone (MSG1A §3.1) : les prenoms des membres puis « Vous », et
  // rien quand le serveur ne les joint pas (fil d equipe : « 0 participants » avant).
  const prenomsDuFil = filDeLaVille.estFil ? '' : sousTitreDesMembres({
    chat: chatData,
    meId: userData?.documentId,
    vous: t('conversation.header.you', 'Vous'),
  });
  const sousTitreDuFil = filDeLaVille.sousTitre || prenomsDuFil;
  // MSG1W §3.1 — le titre du fil et sa ligne (« … écrit » en cyan). §3.16 : dans un groupe, il
  // ouvre les infos du groupe.
  // @ts-ignore: FIXME: Baseline TS regression
  const membresDuFil = Array.isArray(chatData?.participants) ? chatData.participants : [];
  const libelleRetirer = t('conversation.group.remove', 'Retirer');
  const blocDuTitre = (
    <>
      <h1
        style={{
          color: PALETTE_DU_FIL.texte,
          fontFamily: 'Montserrat-Bold, sans-serif',
          fontSize: 16,
          lineHeight: '20px',
          margin: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {conversationName}
      </h1>
      <span
        style={{
          color: PALETTE_DU_FIL.texteDoux,
          fontSize: 12.5,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {libelleQuiEcrit ? (
          <span
            data-testid="MSG1W-qui-ecrit"
            style={{
              color: PALETTE_DU_FIL.accent,
              fontFamily: 'Montserrat-Bold, sans-serif',
            }}
          >
            {libelleQuiEcrit}
          </span>
        ) : null}
        {!libelleQuiEcrit && isChatLoading
          ? i18next.t(
            'conversation.web.loading.conversation',
            'Chargement de la conversation...',
          )
          : null}
        {!libelleQuiEcrit && !isChatLoading ? sousTitreDuFil : null}
      </span>
    </>
  );
  /** @type {import('react').CSSProperties} */
  const styleDuBoutonRond = {
    alignItems: 'center',
    background: PALETTE_DU_FIL.accent,
    border: 0,
    borderRadius: 999,
    color: PALETTE_DU_FIL.encre,
    cursor: 'pointer',
    display: 'flex',
    flexShrink: 0,
    height: 44,
    justifyContent: 'center',
    padding: 0,
    position: 'relative',
    width: 44,
  };
  const entreesDuMenuAjouter = [
    {
      action: handlePickImage,
      cle: 'photos',
      libelle: t('conversation.attachments.photos', 'Photos'),
    },
    {
      action: handlePickDocument,
      cle: 'document',
      libelle: t('conversation.attachments.document', 'Document'),
    },
    {
      action: () => setSondageOuvert(true),
      cle: 'poll',
      libelle: t('conversation.attachments.poll', 'Sondage'),
    },
    {
      action: () => setFenetre('evenement'),
      cle: 'event',
      libelle: t('conversation.attachments.event', 'Événement'),
    },
    {
      action: handleShareLocation,
      cle: 'location',
      libelle: t('conversation.attachments.location', 'Localisation'),
    },
    {
      action: () => {
        setContactChoisi('');
        setFenetre('contact');
      },
      cle: 'contact',
      libelle: t('conversation.attachments.contact', 'Contact'),
    },
    // MSG1W « convocation site B » — fil d equipe, entraineur de l equipe ou super-admin (1C).
    ...(peutConvoquer ? [{
      action: () => setDemandeConvocation({ mode: 'create' }),
      cle: 'convocation',
      libelle: t('conversationConvocation.entry', 'Convocation'),
    }] : []),
    // Un fil League : la proposition de creneau (le panneau permanent d avant).
    ...(isLeagueConversation ? [{
      action: () => setFenetre('proposition'),
      cle: 'proposal',
      libelle: i18next.t('conversation.web.proposal.title', 'Proposition de match'),
    }] : []),
  ];

  // MSG1W §3.5 — a droite du fil, il ne reste que « Dans ce canal » d un fil de la Ville :
  // partager, sondage et proposition League sont passes dans le « + » et ses fenetres. Sur un
  // telephone, la liste passe SOUS la messagerie, hors du cadre a hauteur d ecran.
  // R17-CANAUX — « Toute la ville » : pas de « Dans ce canal » (personne ne voit qui le lit).
  const panneauDeDroite = filDeLaVille.afficheMembres && filDeLaVille.membres ? (
    <aside
      style={{
        alignContent: 'start',
        display: 'grid',
        gap: 20,
        marginTop: isDesktop ? 0 : 20,
        minHeight: 0,
        overflowY: isDesktop ? 'auto' : 'visible',
      }}
    >
      {/* COLL-C4A2 — P3c-canal-ordi : « Dans ce canal », liste calculée, sans « Ajouter ». */}
      <section
        style={{
          background: panelBackground,
          border: `1px solid ${borderColor}`,
          borderRadius: 24,
          display: 'grid',
          gap: 14,
          padding: 22,
        }}
      >
        <h2
          style={{
            color: baseTextColor, fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 18, margin: 0,
          }}
        >
          {filDeLaVille.estCanal
            ? t('collectiviteCanaux.membres.titreCanal', 'Dans ce canal')
            : t('collectiviteCanaux.membres.titrePrivee', 'Dans cette conversation')}
        </h2>
        <ListeDesMembresDuFil
          espaceVille={route?.params?.espace === 'ville'}
          fil={filDeLaVille.membres}
        />
      </section>
    </aside>
  ) : null;

  let colonnesDuCadre = 'minmax(0, 1fr)';
  if (avecColonneDeLaVille) colonnesDuCadre = colonnesDeLaGrille;
  else if (avecColonneDesMessages && panneauDeDroite) colonnesDuCadre = colonnesDeLaGrille;
  else if (avecColonneDesMessages) colonnesDuCadre = 'minmax(280px, 360px) minmax(0, 1fr)';
  else if (panneauDeDroite) colonnesDuCadre = colonnesDeLaGrille;

  return (
    <ScreenContainer
      bgImage="bg2"
      contentWidth="full"
      responsivePadding
      // @ts-ignore: FIXME: Baseline TS regression
      style={{ paddingBottom: isDesktop ? 0 : 24 }}
    >
      <div
        ref={cadreRef}
        style={{
          color: baseTextColor,
          display: 'grid',
          gap: 16,
          // §3.11 — un canal en lecture seule n offre ni partage ni sondage : pas de panneau.
          gridTemplateColumns: colonnesDuCadre,
          // MSG1W §3.1 — LE CADRE A LA HAUTEUR DE L ECRAN : c est le fil qui defile ;
          // l en-tete et la saisie restent en place (README §3.1, « bloc fixe »).
          height: hauteurDuCadre || 'calc(100vh - 116px)',
          minHeight: 0,
        }}
      >
        {avecColonneDesMessages ? (
          <ColonneDesConversations
            chatId={chatId}
            gestes={{
              archiveChatAsync, pinChatAsync, unarchiveChatAsync, unpinChatAsync,
            }}
            navigation={navigation}
            t={t}
          />
        ) : null}
        {avecColonneDeLaVille ? (
          <aside
            style={{
              alignSelf: 'start',
              background: panelBackground,
              border: `1px solid ${borderColor}`,
              borderRadius: 24,
              maxHeight: '100%',
              overflowY: 'auto',
              padding: 12,
            }}
          >
            <ColonneDesFilsDeLaVille
              chatId={chatId}
              chats={filsDeLaColonne}
              collectiviteId={villeDuFil}
              navigation={navigation}
            />
          </aside>
        ) : null}
        <section
          style={{
            background: PALETTE_DU_FIL.fil,
            border: `1px solid ${PALETTE_DU_FIL.filet}`,
            borderRadius: isDesktop ? 20 : 16,
            display: 'grid',
            gridTemplateRows: 'auto minmax(0, 1fr) auto',
            minHeight: 0,
            minWidth: 0,
            overflow: 'hidden',
          }}
        >
          <header
            style={{
              alignItems: 'center',
              background: PALETTE_DU_FIL.barre,
              borderBottom: `1px solid ${PALETTE_DU_FIL.filet}`,
              boxSizing: 'border-box',
              display: 'flex',
              gap: 10,
              minHeight: 62,
              padding: '10px 14px',
            }}
          >
            {/* §3.13 — sur ordinateur, une liste est a gauche (Messages, ou les fils de la Ville) :
                pas de bouton retour. */}
            {avecColonneDesMessages || avecColonneDeLaVille ? null : (
              <button
                aria-label={t('common.back', 'Retour')}
                onClick={() => navigation.navigate(RouteNames.Chat)}
                style={{
                  alignItems: 'center',
                  background: 'transparent',
                  border: `1.5px solid ${PALETTE_DU_FIL.accent}`,
                  borderRadius: 999,
                  color: PALETTE_DU_FIL.accent,
                  cursor: 'pointer',
                  display: 'flex',
                  flexShrink: 0,
                  height: 40,
                  justifyContent: 'center',
                  padding: 0,
                  width: 40,
                }}
                type="button"
              >
                {DESSIN_RETOUR}
              </button>
            )}
            {/* COLL-C4A3 (planche 47) — un fil de la Ville porte son icône ou son écusson. */}
            <View testID="fil-de-la-ville-ecusson">
              <EcussonDuFil
                chat={chatData}
                espaceVille={route?.params?.espace === 'ville'}
                routeChatType={route?.params?.chatType || null}
                taille={38}
              />
            </View>
            {!filDeLaVille.estFil ? (
              <span
                aria-hidden="true"
                style={{
                  alignItems: 'center',
                  background: PALETTE_DU_FIL.bulleRecue,
                  borderRadius: '50%',
                  color: PALETTE_DU_FIL.texte,
                  display: 'inline-flex',
                  flexShrink: 0,
                  fontFamily: 'Montserrat-Bold, sans-serif',
                  fontSize: 14,
                  height: 38,
                  justifyContent: 'center',
                  width: 38,
                }}
              >
                {getInitials(conversationName)}
              </span>
            ) : null}
            {/* MSG1W §3.16 — toucher le titre d un groupe ouvre ses infos (README §3.16). */}
            {estUnGroupe ? (
              <button
                data-testid="MSG1W-titre-du-fil"
                onClick={() => setInfosOuvertes(true)}
                style={{
                  background: 'transparent',
                  border: 0,
                  cursor: 'pointer',
                  display: 'grid',
                  flex: 1,
                  gap: 2,
                  minWidth: 0,
                  padding: 0,
                  textAlign: 'left',
                }}
                type="button"
              >
                {blocDuTitre}
              </button>
            ) : (
              <div style={{ display: 'grid', flex: 1, gap: 2, minWidth: 0 }}>
                {blocDuTitre}
              </div>
            )}
            {/* COLL-C4A2 (regle du telephone) — un fil de la Ville : « Qui est dans ce canal »
                remplace le menu ⋮. Sur ordinateur, la colonne de droite montre ses membres. */}
            {filDeLaVille.afficheMembres && !isDesktop ? (
              <BoutonMembresDuFil
                estCanal={filDeLaVille.estCanal}
                onPress={filDeLaVille.ouvrirMembres}
              />
            ) : null}
            {filDeLaVille.estFil ? null : (
              <div ref={menuOptionsRef} style={{ position: 'relative' }}>
                <button
                  aria-expanded={menuOptionsOuvert}
                  aria-haspopup="menu"
                  aria-label={t('conversation.web.fil.options', 'Plus d’options')}
                  onClick={() => setMenuOptionsOuvert((ouvert) => !ouvert)}
                  style={{
                    alignItems: 'center',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: 0,
                    borderRadius: 999,
                    color: PALETTE_DU_FIL.texte,
                    cursor: 'pointer',
                    display: 'flex',
                    flexShrink: 0,
                    height: 40,
                    justifyContent: 'center',
                    padding: 0,
                    width: 40,
                  }}
                  type="button"
                >
                  <GlyphIcon color={PALETTE_DU_FIL.texte} name="dotsVertical" size={20} />
                </button>
                {menuOptionsOuvert ? (
                  <div
                    aria-label={t('conversation.web.fil.options', 'Plus d’options')}
                    role="menu"
                    style={{
                      background: PALETTE_DU_FIL.menu,
                      border: `1px solid ${PALETTE_DU_FIL.menuBord}`,
                      borderRadius: 16,
                      boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
                      display: 'grid',
                      minWidth: 230,
                      padding: 6,
                      position: 'absolute',
                      right: 0,
                      top: 46,
                      zIndex: 30,
                    }}
                  >
                    {entreesDuMenuOptions.map((/** @type {any} */ entree) => (
                      <button
                        className="MSG1W-ligne-menu"
                        disabled={entree.cle === 'bloquer' && (blocageEnCours || deblocageEnCours)}
                        key={entree.cle}
                        onClick={() => {
                          setMenuOptionsOuvert(false);
                          entree.action();
                        }}
                        role="menuitem"
                        style={{
                          background: 'transparent',
                          border: 0,
                          borderRadius: 10,
                          color: entree.cle === 'bloquer'
                            ? PALETTE_DU_FIL.danger
                            : PALETTE_DU_FIL.texte,
                          cursor: 'pointer',
                          fontFamily: 'Montserrat-Regular, sans-serif',
                          fontSize: 15,
                          minHeight: 44,
                          padding: '0 14px',
                          textAlign: 'left',
                        }}
                        type="button"
                      >
                        {entree.libelle}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </header>

          <div
            style={{
              // MSG1W (SPECS §1) — le motif sportif en filigrane (MSG1A, tuile de 240), derriere
              // le fil seulement, comme sur le telephone : il reste en place quand le fil defile.
              backgroundImage: adresseDuMotif ? `url("${adresseDuMotif}")` : undefined,
              backgroundRepeat: 'repeat',
              backgroundSize: '240px 240px',
              minHeight: 0,
              position: 'relative',
            }}
          >
            <div
              data-testid="MSG1W-fil"
              onScroll={(event) => {
                const fil = event.currentTarget;
                const distance = fil.scrollHeight - fil.scrollTop - fil.clientHeight;
                // Revenu en bas, il s y recolle ; il ne s en DECOLLE que par un geste (effet plus
                // haut) : un defilement programme (photo chargee au 1er rendu) ne compte pas.
                if (distance < 40) colleAuBasRef.current = true;
                setLoinDuBas(distance > 160 && !colleAuBasRef.current);
              }}
              ref={messagePaneRef}
              style={{
                // FINITIONS16 20 : une rangee d un seul message ne s etire plus en hauteur.
                alignContent: 'start',
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                overflowY: 'auto',
                padding: '8px 6px 18px',
              }}
            >
              <div
                ref={contenuDuFilRef}
                style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}
              >
                {clubDuFil ? (
                  <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0 6px' }}>
                    <span
                      data-testid="conversation-club-read-notice"
                      style={{
                        alignItems: 'center',
                        background: PALETTE_DU_FIL.noticeFond,
                        borderRadius: 8,
                        color: PALETTE_DU_FIL.noticeTexte,
                        display: 'inline-flex',
                        fontSize: 11.5,
                        gap: 6,
                        lineHeight: '15px',
                        maxWidth: 320,
                        padding: '6px 12px',
                        textAlign: 'center',
                      }}
                    >
                      <GlyphIcon color={PALETTE_DU_FIL.noticeTexte} name="lockShut" size={12} />
                      {t(
                        'conversation.clubReadNotice',
                        'Les conversations de ce club peuvent être consultées par son dirigeant.',
                      )}
                    </span>
                  </div>
                ) : null}
                {hasNextPage ? (
                  <button
                    onClick={() => fetchNextPage()}
                    style={{
                      background: 'transparent',
                      border: `1px solid ${borderColor}`,
                      borderRadius: 999,
                      color: baseTextColor,
                      cursor: 'pointer',
                      justifySelf: 'center',
                      padding: '10px 16px',
                    }}
                    type="button"
                  >
                    {isFetchingNextPage ? 'Chargement...' : i18next.t(
                      'conversation.web.loadEarlier',
                      'Afficher les messages precedents',
                    )}
                  </button>
                ) : null}

                {isMessagesLoading ? (
                  <div style={{ color: mutedTextColor }}>
                    {i18next.t('conversation.web.loading.messages', 'Chargement des messages...')}
                  </div>
                ) : null}

                {!isMessagesLoading && filDeLaVille.estQuitte ? (
                  <FilDeLaVilleQuitte
                    estCanal={filDeLaVille.estCanal}
                    estCanalVille={filDeLaVille.estCanalVille}
                    onRetour={() => navigation.navigate(RouteNames.Chat)}
                  />
                ) : null}
                {!isMessagesLoading && messagesError && !filDeLaVille.estQuitte ? (
                  <div style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: `1px solid ${borderColor}`,
                    borderRadius: 18,
                    color: mutedTextColor,
                    display: 'grid',
                    gap: 12,
                    padding: 18,
                  }}
                  >
                    <div>
                      {getErrorMessage(messagesError, i18next.t(
                        'conversation.web.loading.messagesError',
                        'Impossible de charger les messages de cette conversation.',
                      ))}
                    </div>
                    <button
                      onClick={() => refetchMessages()}
                      style={{
                        background: 'transparent',
                        border: `1px solid ${borderColor}`,
                        borderRadius: 999,
                        color: baseTextColor,
                        cursor: 'pointer',
                        justifySelf: 'start',
                        padding: '10px 14px',
                      }}
                      type="button"
                    >
                      {i18next.t('conversation.web.retry', 'Réessayer')}
                    </button>
                  </div>
                ) : null}

                {!isMessagesLoading && !messagesError && !messages.length && filDeLaVille.estFil ? (
                  <VideDuFilDeLaVille
                    chat={chatData}
                    clubsCount={filDeLaVille.clubsCount}
                    espaceVille={route?.params?.espace === 'ville'}
                  />
                ) : null}
                {filVideHorsVille ? (
                  <div style={{ color: mutedTextColor }}>
                    {filDeLaVille.videTitre ? (
                      <>
                        <strong
                          style={{ color: PALETTE_DU_FIL.texte, display: 'block', marginBottom: 6 }}
                        >
                          {filDeLaVille.videTitre}
                        </strong>
                        {filDeLaVille.videTexte}
                      </>
                    ) : i18next.t('conversation.web.empty', 'Aucun message pour le moment.')}
                  </div>
                ) : null}
                <style>{REACTION_HOVER_STYLE}</style>
                {!messagesError ? entreesDuFil.map((entree) => (entree.type === 'jour' ? (
                  <div
                    key={entree.cle}
                    style={{
                      display: 'flex', justifyContent: 'center', marginBottom: 4, marginTop: 16,
                    }}
                  >
                    <span
                      data-testid="MSG1W-puce-date"
                      style={{
                        backdropFilter: 'blur(12px)',
                        background: PALETTE_DU_FIL.puce,
                        border: `1px solid ${PALETTE_DU_FIL.filet}`,
                        borderRadius: 999,
                        color: PALETTE_DU_FIL.texte,
                        fontFamily: 'Montserrat-Bold, sans-serif',
                        fontSize: 12,
                        padding: '5px 12px',
                      }}
                    >
                      {libelleDuJour(entree.date, {
                        aujourdhui: libelleAujourdhui,
                        hier: libelleHier,
                        locale: i18next.language === 'en' ? 'en-GB' : 'fr-FR',
                      })}
                    </span>
                  </div>
                ) : renderMessageCard(entree))) : null}
                {quiEcrit.length ? (
                  <div
                    aria-label={libelleQuiEcrit}
                    role="status"
                    style={{ display: 'flex', marginTop: 10, paddingLeft: 8 }}
                  >
                    <span
                      style={{
                        alignItems: 'center',
                        background: PALETTE_DU_FIL.bulleRecue,
                        borderRadius: 18,
                        display: 'inline-flex',
                        gap: 4,
                        height: 34,
                        padding: '0 14px',
                      }}
                    >
                      {[0, 1, 2].map((point) => (
                        <span
                          className="MSG1W-point"
                          key={point}
                          style={{
                            animationDelay: `${point * 0.2}s`,
                            background: PALETTE_DU_FIL.texteDoux,
                            borderRadius: '50%',
                            display: 'inline-block',
                            height: 7,
                            width: 7,
                          }}
                        />
                      ))}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
            {loinDuBas ? (
              <button
                onClick={() => {
                  const fil = messagePaneRef.current;
                  // @ts-ignore: FIXME: Baseline TS regression
                  fil?.scrollTo?.({ behavior: 'smooth', top: fil.scrollHeight });
                }}
                style={{
                  alignItems: 'center',
                  background: PALETTE_DU_FIL.revenirEnBas,
                  border: 0,
                  borderRadius: 999,
                  bottom: 12,
                  boxShadow: '0 6px 18px rgba(0, 0, 0, 0.35)',
                  color: PALETTE_DU_FIL.texte,
                  cursor: 'pointer',
                  display: 'flex',
                  height: 40,
                  justifyContent: 'center',
                  padding: 0,
                  position: 'absolute',
                  right: 12,
                  width: 40,
                  zIndex: 3,
                }}
                type="button"
              >
                {DESSIN_VERS_LE_BAS}
                <span style={TEXTE_MASQUE}>
                  {i18next.t('conversation.web.fil.revenirEnBas', 'Revenir en bas')}
                </span>
              </button>
            ) : null}
          </div>

          {peutEcrire ? (
            <footer
              style={{
                background: PALETTE_DU_FIL.barre,
                borderTop: `1px solid ${PALETTE_DU_FIL.filet}`,
                display: 'grid',
                gap: 8,
                padding: '8px 12px 12px',
              }}
            >
              {replyTarget ? (
                <div
                  data-testid="MSG1W-barre-reponse"
                  style={{
                    alignItems: 'center',
                    background: PALETTE_DU_FIL.champ,
                    borderLeft: `4px solid ${couleurDeLaPersonne(replyTarget?.sender)}`,
                    borderRadius: 16,
                    display: 'flex',
                    gap: 10,
                    padding: '8px 10px 8px 12px',
                  }}
                >
                  <div
                    style={{
                      display: 'grid', flex: 1, gap: 2, minWidth: 0,
                    }}
                  >
                    <span
                      style={{
                        color: couleurDeLaPersonne(replyTarget?.sender),
                        fontFamily: 'Montserrat-Bold, sans-serif',
                        fontSize: 12.5,
                      }}
                    >
                      {getDisplayName(replyTarget?.sender)}
                    </span>
                    <span
                      style={{
                        color: PALETTE_DU_FIL.texteDoux,
                        fontSize: 13,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {String(replyTarget?.message || '').trim()
                        || t('conversation.web.fil.messagePartage', 'Message partagé')}
                    </span>
                  </div>
                  <button
                    aria-label={t('conversation.web.fil.annulerReponse', 'Annuler la réponse')}
                    onClick={() => setReplyTarget(null)}
                    style={{
                      alignItems: 'center',
                      background: PALETTE_DU_FIL.menuBord,
                      border: 0,
                      borderRadius: 999,
                      color: PALETTE_DU_FIL.texte,
                      cursor: 'pointer',
                      display: 'flex',
                      flexShrink: 0,
                      height: 28,
                      justifyContent: 'center',
                      padding: 0,
                      width: 28,
                    }}
                    type="button"
                  >
                    {DESSIN_FERMER}
                  </button>
                </div>
              ) : null}
              {isRecordingVoice ? (
                <div role="status" style={{ color: PALETTE_DU_FIL.danger, fontSize: 12.5 }}>
                  {i18next.t(
                    'conversation.web.voice.recording',
                    'Enregistrement en cours. Clique à nouveau pour envoyer la note vocale.',
                  )}
                </div>
              ) : null}
              <div style={{ alignItems: 'flex-end', display: 'flex', gap: 8 }}>
                <div ref={menuAjouterRef} style={{ position: 'relative' }}>
                  <button
                    aria-expanded={menuAjouterOuvert}
                    aria-haspopup="menu"
                    disabled={!canUseConversationActions}
                    onClick={() => setMenuAjouterOuvert((ouvert) => !ouvert)}
                    style={styleDuBoutonRond}
                    type="button"
                  >
                    <GlyphIcon color={PALETTE_DU_FIL.encre} name="plus2" size={22} />
                    <span style={TEXTE_MASQUE}>
                      {t('conversation.attachments.title', 'Ajouter')}
                    </span>
                  </button>
                  {menuAjouterOuvert ? (
                    <div
                      aria-label={t('conversation.attachments.title', 'Ajouter')}
                      role="menu"
                      style={{
                        background: PALETTE_DU_FIL.menu,
                        border: `1px solid ${PALETTE_DU_FIL.menuBord}`,
                        borderRadius: 16,
                        bottom: 54,
                        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
                        display: 'grid',
                        left: 0,
                        minWidth: 220,
                        padding: 6,
                        position: 'absolute',
                        zIndex: 30,
                      }}
                    >
                      {entreesDuMenuAjouter.map((/** @type {any} */ entree) => (
                        <button
                          className="MSG1W-ligne-menu"
                          key={entree.cle}
                          onClick={() => {
                            setMenuAjouterOuvert(false);
                            entree.action();
                          }}
                          role="menuitem"
                          style={{
                            alignItems: 'center',
                            background: 'transparent',
                            border: 0,
                            borderRadius: 10,
                            color: PALETTE_DU_FIL.texte,
                            cursor: 'pointer',
                            display: 'flex',
                            fontFamily: 'Montserrat-Regular, sans-serif',
                            fontSize: 15,
                            gap: 12,
                            minHeight: 48,
                            padding: '0 10px',
                            textAlign: 'left',
                          }}
                          type="button"
                        >
                          <span
                            aria-hidden="true"
                            style={{
                              alignItems: 'center',
                              background: 'rgba(1, 179, 244, 0.16)',
                              borderRadius: '50%',
                              display: 'inline-flex',
                              flexShrink: 0,
                              height: 34,
                              justifyContent: 'center',
                              width: 34,
                            }}
                          >
                            <IconeDuPlus cle={entree.cle} />
                          </span>
                          {entree.libelle}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <textarea
                  aria-label={placeholderDeLaSaisie}
                  onChange={(event) => setComposerText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      if (!isSending && composerText.trim()) {
                        handleSendText();
                      }
                    }
                  }}
                  placeholder={placeholderDeLaSaisie}
                  ref={saisieRef}
                  rows={1}
                  style={{
                    background: PALETTE_DU_FIL.champ,
                    border: `1px solid ${PALETTE_DU_FIL.champBord}`,
                    borderRadius: 22,
                    boxSizing: 'border-box',
                    color: PALETTE_DU_FIL.texte,
                    flex: 1,
                    fontFamily: 'Montserrat-Regular, sans-serif',
                    fontSize: 16,
                    lineHeight: '20px',
                    maxHeight: 140,
                    minHeight: 44,
                    minWidth: 0,
                    outline: 'none',
                    padding: '11px 16px',
                    resize: 'none',
                  }}
                  value={composerText}
                />
                {aDuTexte ? (
                  <button
                    aria-busy={isSending}
                    disabled={!canSendText}
                    onClick={handleSendText}
                    style={{
                      ...styleDuBoutonRond,
                      cursor: canSendText ? 'pointer' : 'not-allowed',
                      opacity: canSendText ? 1 : 0.6,
                    }}
                    type="button"
                  >
                    <GlyphIcon color={PALETTE_DU_FIL.encre} name="send" size={20} />
                    <span style={TEXTE_MASQUE}>Envoyer</span>
                  </button>
                ) : (
                  <button
                    disabled={micIndisponible}
                    onClick={handleVoiceNote}
                    style={{
                      ...styleDuBoutonRond,
                      background: isRecordingVoice ? PALETTE_DU_FIL.danger : PALETTE_DU_FIL.accent,
                      cursor: micIndisponible ? 'not-allowed' : 'pointer',
                      opacity: micIndisponible ? 0.6 : 1,
                    }}
                    title={isVoiceRecordingSupported ? undefined : i18next.t(
                      'conversation.web.voice.unsupported',
                      'Les notes vocales ne sont pas prises en charge par ce navigateur.',
                    )}
                    type="button"
                  >
                    <GlyphIcon
                      color={PALETTE_DU_FIL.encre}
                      name={isRecordingVoice ? 'stop' : 'microphone'}
                      size={20}
                    />
                    <span style={TEXTE_MASQUE}>
                      {isRecordingVoice
                        ? i18next.t('conversation.web.voice.stop', 'Arrêter la note vocale')
                        : 'Note vocale'}
                    </span>
                  </button>
                )}
              </div>
            </footer>
          ) : (
            <footer
              data-testid="MSG1W-lecture-seule"
              style={{
                alignItems: 'center',
                background: PALETTE_DU_FIL.barre,
                borderTop: `1px solid ${PALETTE_DU_FIL.filet}`,
                color: PALETTE_DU_FIL.texteDoux,
                display: 'flex',
                fontSize: 14,
                gap: 8,
                justifyContent: 'center',
                minHeight: 60,
                padding: '8px 12px 12px',
              }}
            >
              <GlyphIcon color={PALETTE_DU_FIL.texteDoux} name="lockShut" size={16} />
              {filDeLaVille.texteLectureSeule
                || t('conversation.readOnly', "Canal d'annonce (lecture seule)")}
            </footer>
          )}
        </section>

        {isDesktop ? panneauDeDroite : null}
      </div>
      {isDesktop ? null : panneauDeDroite}
      <PollCreationModal
        isVisible={sondageOuvert}
        onClose={() => setSondageOuvert(false)}
        onSubmit={envoyerLeSondage}
      />
      {fenetre === 'evenement' ? (
        <FenetreDuSite
          compacte={!isDesktop}
          idTitre="msg1w-titre-evenements"
          onFermer={() => setFenetre('')}
          titre={t('conversation.shareEvent.planningTitle', 'Événements de mon planning')}
        >
          {shareableEvents.length === 0 ? (
            <p style={{ color: PALETTE_DU_FIL.texteDoux, margin: 0, textAlign: 'center' }}>
              {t('conversation.shareEvent.empty', 'Aucun événement disponible.')}
            </p>
          ) : shareableEvents.map((evenement) => (
            <View key={`partage-${getEntityDocumentId(evenement)}`}>
              <EventCardNew
                item={evenement}
                mode="share"
                // La feuille du telephone ne branche que le toucher de la carte (partager).
                onDecline={() => {}}
                onJoin={() => {}}
                onLogin={() => {}}
                onParticipate={() => {}}
                onPress={(/** @type {any} */ choisi) => {
                  setFenetre('');
                  handleShareEvent(choisi);
                }}
              />
            </View>
          ))}
          <button
            onClick={() => {
              setFenetre('');
              navigation.navigate(RouteNames.ConversationPublicEventPicker, { chatId });
            }}
            style={STYLE_BOUTON_CONTOUR}
            type="button"
          >
            {t('conversation.shareEvent.sharePublicAction', 'Partager un événement public')}
          </button>
        </FenetreDuSite>
      ) : null}
      {fenetre === 'contact' ? (
        <FenetreDuSite
          compacte={!isDesktop}
          idTitre="msg1w-titre-contact"
          onFermer={() => setFenetre('')}
          titre={t('conversation.shareContact.title', 'Partager un contact')}
        >
          {shareableContacts.length === 0 ? (
            <p style={{ color: PALETTE_DU_FIL.texteDoux, margin: 0, textAlign: 'center' }}>
              {t('conversation.shareContact.empty', 'Aucun contact partageable dans ce chat.')}
            </p>
          ) : (
            <div
              aria-label={t('conversation.shareContact.title', 'Partager un contact')}
              role="radiogroup"
              style={{ display: 'grid', gap: 8 }}
            >
              {shareableContacts.map((/** @type {any} */ contact) => (
                <label
                  key={`contact-${contact.documentId}`}
                  style={{
                    alignItems: 'center',
                    border: `1px solid ${contactChoisi === contact.documentId
                      ? PALETTE_DU_FIL.accent
                      : PALETTE_DU_FIL.menuBord}`,
                    borderRadius: 12,
                    color: PALETTE_DU_FIL.texte,
                    cursor: 'pointer',
                    display: 'flex',
                    gap: 12,
                    padding: '10px 12px',
                  }}
                >
                  <input
                    checked={contactChoisi === contact.documentId}
                    name="msg1w-contact"
                    onChange={() => setContactChoisi(contact.documentId)}
                    type="radio"
                  />
                  <AvatarDuGroupe idMessage={`contact-${contact.documentId}`} personne={contact} />
                  <span style={{ display: 'grid', gap: 2 }}>
                    <span style={{ fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 14 }}>
                      {getDisplayName(contact)}
                    </span>
                    <span style={{ color: PALETTE_DU_FIL.texteDoux, fontSize: 12.5 }}>
                      {libelleDuRole(contact?.role?.name || contact?.role?.type, t, '')}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}
          <button
            disabled={!contactChoisi}
            onClick={() => {
              const contact = shareableContacts.find(
                (/** @type {any} */ personne) => personne.documentId === contactChoisi,
              );
              setFenetre('');
              if (contact) handleShareContact(contact);
            }}
            style={{ ...STYLE_BOUTON_PLEIN, opacity: contactChoisi ? 1 : 0.6 }}
            type="button"
          >
            {t('conversation.shareContact.send', 'Partager')}
          </button>
        </FenetreDuSite>
      ) : null}
      {fenetre === 'proposition' ? (
        <FenetreDuSite
          compacte={!isDesktop}
          idTitre="msg1w-titre-proposition"
          onFermer={() => setFenetre('')}
          titre={i18next.t('conversation.web.proposal.title', 'Proposition de match')}
        >
          <input
            aria-label="Date"
            onChange={(event) => setProposalDate(event.target.value)}
            style={STYLE_CHAMP_DE_FENETRE}
            type="date"
            value={proposalDate}
          />
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
            <input
              aria-label="Début"
              onChange={(event) => setProposalStartTime(event.target.value)}
              style={STYLE_CHAMP_DE_FENETRE}
              type="time"
              value={proposalStartTime}
            />
            <input
              aria-label="Fin"
              onChange={(event) => setProposalEndTime(event.target.value)}
              style={STYLE_CHAMP_DE_FENETRE}
              type="time"
              value={proposalEndTime}
            />
          </div>
          <input
            onChange={(event) => setProposalVenue(event.target.value)}
            placeholder="Lieu"
            style={STYLE_CHAMP_DE_FENETRE}
            value={proposalVenue}
          />
          <input
            onChange={(event) => setProposalAddress(event.target.value)}
            placeholder="Adresse"
            style={STYLE_CHAMP_DE_FENETRE}
            value={proposalAddress}
          />
          <button
            disabled={!canSubmitProposal}
            onClick={async () => {
              await handleSendProposal();
              setFenetre('');
            }}
            style={{ ...STYLE_BOUTON_PLEIN, opacity: canSubmitProposal ? 1 : 0.6 }}
            type="button"
          >
            {isSubmittingProposal ? 'Envoi...' : i18next.t(
              'conversation.web.proposal.send',
              'Envoyer la proposition',
            )}
          </button>
        </FenetreDuSite>
      ) : null}
      {messageDuMenu && menuDuMessage ? (
        <div
          ref={menuDuMessageRef}
          style={{
            display: 'grid',
            gap: 8,
            justifyItems: 'start',
            left: menuDuMessage.left,
            position: 'fixed',
            top: menuDuMessage.top,
            width: 252,
            zIndex: 1000,
          }}
        >
          <div
            aria-label={t('conversation.reactions.pick', 'Choisir une réaction')}
            data-testid="MSG1W-menu-reactions"
            role="group"
            style={{
              alignItems: 'center',
              background: PALETTE_DU_FIL.menu,
              border: `1px solid ${PALETTE_DU_FIL.menuBord}`,
              borderRadius: 999,
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.45)',
              display: 'flex',
              gap: 2,
              padding: '6px 8px',
            }}
          >
            {REACTION_EMOJIS.map((emoji) => (
              <button
                aria-label={emoji}
                aria-pressed={maReactionDuMenu === emoji}
                key={`menu-${emoji}`}
                onClick={() => {
                  fermerLeMenu(false);
                  handleToggleReaction(menuDuMessage.id, emoji);
                }}
                style={{
                  background: maReactionDuMenu === emoji
                    ? 'rgba(255, 255, 255, 0.18)'
                    : 'transparent',
                  border: 0,
                  borderRadius: 999,
                  cursor: 'pointer',
                  fontSize: 22,
                  height: 36,
                  lineHeight: 1,
                  padding: 0,
                  width: 36,
                }}
                type="button"
              >
                {emoji}
              </button>
            ))}
          </div>
          <div
            aria-label={t('conversation.actions.modalTitle', 'Actions du message')}
            onKeyDown={naviguerDansLeMenu}
            role="menu"
            style={{
              background: PALETTE_DU_FIL.menu,
              border: `1px solid ${PALETTE_DU_FIL.menuBord}`,
              borderRadius: 16,
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.45)',
              overflow: 'hidden',
              width: 236,
            }}
            tabIndex={-1}
          >
            {actionsDuMenu.map((action) => (
              <Fragment key={action.key}>
                {action.destructive ? (
                  <div
                    role="separator"
                    style={{ borderTop: `1px solid ${PALETTE_DU_FIL.menuBord}` }}
                  />
                ) : null}
                <button
                  className="MSG1W-ligne-menu"
                  onClick={() => lancerAction(action.key, messageDuMenu)}
                  role="menuitem"
                  style={{
                    alignItems: 'center',
                    background: 'transparent',
                    border: 0,
                    color: action.destructive ? PALETTE_DU_FIL.danger : PALETTE_DU_FIL.texte,
                    cursor: 'pointer',
                    display: 'flex',
                    fontFamily: 'Montserrat-Regular, sans-serif',
                    fontSize: 15.5,
                    gap: 12,
                    minHeight: 48,
                    outline: 'none',
                    padding: '0 16px',
                    textAlign: 'left',
                    width: '100%',
                  }}
                  type="button"
                >
                  {ICONES_DU_MENU[/** @type {keyof typeof ICONES_DU_MENU} */ (action.key)]}
                  {t(action.labelKey, action.fallback)}
                </button>
              </Fragment>
            ))}
          </div>
        </div>
      ) : null}
      {messageEnEdition ? (
        <div
          style={{
            alignItems: 'center',
            background: PALETTE_DU_FIL.voile,
            display: 'flex',
            inset: 0,
            justifyContent: 'center',
            position: 'fixed',
            zIndex: 1100,
          }}
        >
          <div
            aria-labelledby="msg1w-titre-edition"
            aria-modal="true"
            role="dialog"
            style={{
              background: PALETTE_DU_FIL.feuille,
              borderRadius: 20,
              boxSizing: 'border-box',
              display: 'grid',
              gap: 14,
              padding: 20,
              width: 'min(480px, calc(100vw - 32px))',
            }}
          >
            <h2
              id="msg1w-titre-edition"
              style={{
                color: PALETTE_DU_FIL.texte,
                fontFamily: 'Montserrat-Bold, sans-serif',
                fontSize: 18,
                margin: 0,
              }}
            >
              {t('conversation.actions.editModal.title', 'Modifier le message')}
            </h2>
            <textarea
              aria-label={t('conversation.actions.editModal.title', 'Modifier le message')}
              onChange={(event) => setTexteEnEdition(event.target.value)}
              placeholder={t('conversation.actions.editModal.placeholder', 'Modifier le texte...')}
              ref={champEditionRef}
              rows={4}
              style={{
                background: PALETTE_DU_FIL.champ,
                border: `1px solid ${PALETTE_DU_FIL.champBord}`,
                borderRadius: 14,
                boxSizing: 'border-box',
                color: PALETTE_DU_FIL.texte,
                fontFamily: 'Montserrat-Regular, sans-serif',
                fontSize: 15,
                lineHeight: '20px',
                outline: 'none',
                padding: '12px 14px',
                resize: 'vertical',
                width: '100%',
              }}
              value={texteEnEdition}
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setMessageEnEdition(null)}
                style={STYLE_BOUTON_CONTOUR}
                type="button"
              >
                {t('common.actions.cancel', 'Annuler')}
              </button>
              <button
                aria-busy={enregistrementEnCours}
                disabled={enregistrementEnCours}
                onClick={enregistrerLEdition}
                style={{ ...STYLE_BOUTON_PLEIN, opacity: enregistrementEnCours ? 0.6 : 1 }}
                type="button"
              >
                {t('common.actions.save', 'Enregistrer')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {messageASupprimer ? (
        <ConfirmationDuSite
          id="msg1w-suppression"
          libelleAction={t('common.actions.delete', 'Supprimer')}
          onAnnuler={() => setMessageASupprimer(null)}
          onConfirmer={confirmerLaSuppression}
          texte={t(
            'conversation.actions.deleteConfirm.description',
            'Ce message sera supprimé pour tous les participants.',
          )}
          titre={t('conversation.actions.deleteConfirm.title', 'Supprimer le message')}
        />
      ) : null}
      {demandeConvocation ? (
        <ConvocationWizard
          chatId={chatId}
          eventSummary={demandeConvocation.eventSummary}
          initialEventId={demandeConvocation.eventId}
          mode={demandeConvocation.mode}
          onClose={(/** @type {{ published?: boolean } | undefined} */ resultat) => {
            setDemandeConvocation(null);
            // La carte arrive par le temps reel ; le site relit aussi le fil, au cas ou.
            if (resultat?.published) {
              queryClient.invalidateQueries({ queryKey: ['chat-messages', chatId] });
            }
          }}
          startStep={demandeConvocation.startStep}
          teamId={getTeamIdOfChat(chatData)}
          teamName={chatData?.team?.name || ''}
          visible
        />
      ) : null}
      {adresseOuverte ? (
        <FenetreDuSite
          compacte
          idTitre="msg1w-titre-adresse"
          onFermer={() => setAdresseOuverte('')}
          titre={t('conversation.address.title', 'Adresse')}
        >
          <p style={{ color: PALETTE_DU_FIL.texteDoux, fontSize: 14, margin: 0 }}>
            {adresseOuverte}
          </p>
          <div style={{ display: 'grid', gap: 8 }}>
            {/* Sur ordinateur, les pages web des applis de cartes (Waze : son lien web). */}
            {[
              { cle: 'google', url: buildExternalMapLinks({ label: adresseOuverte })?.google },
              { cle: 'apple', url: buildExternalMapLinks({ label: adresseOuverte })?.apple },
              {
                cle: 'waze',
                url: `https://www.waze.com/ul?q=${encodeURIComponent(adresseOuverte)}&navigate=yes`,
              },
            ].map(({ cle, url }) => (
              <a
                href={url}
                key={cle}
                onClick={() => setAdresseOuverte('')}
                rel="noopener noreferrer"
                style={{
                  ...STYLE_BOUTON_CONTOUR,
                  alignItems: 'center',
                  display: 'flex',
                  justifyContent: 'center',
                  textDecoration: 'none',
                }}
                target="_blank"
              >
                {t('conversation.address.openIn', {
                  app: t(`externalMap.apps.${cle}`),
                  defaultValue: 'Ouvrir dans {{app}}',
                })}
              </a>
            ))}
            <button onClick={copierLAdresse} style={STYLE_BOUTON_CONTOUR} type="button">
              {t('conversation.address.copy', 'Copier l’adresse')}
            </button>
          </div>
        </FenetreDuSite>
      ) : null}
      {infosOuvertes ? (
        <FenetreDuSite
          compacte={!isDesktop}
          idTitre="msg1w-titre-infos"
          onFermer={() => {
            setInfosOuvertes(false);
            setNomEnEdition(null);
          }}
          titre={t('conversation.web.fil.infosDuGroupe', 'Infos du groupe')}
        >
          <div
            style={{
              display: 'grid', gap: 8, justifyItems: 'center', textAlign: 'center',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                alignItems: 'center',
                background: PALETTE_DU_FIL.bulleRecue,
                borderRadius: '50%',
                color: PALETTE_DU_FIL.texte,
                display: 'inline-flex',
                fontFamily: 'Montserrat-Bold, sans-serif',
                fontSize: 30,
                height: 92,
                justifyContent: 'center',
                width: 92,
              }}
            >
              {getInitials(conversationName)}
            </span>
            {nomEnEdition === null ? (
              <div style={{ alignItems: 'center', display: 'flex', gap: 8 }}>
                <span
                  style={{
                    color: PALETTE_DU_FIL.texte,
                    fontFamily: 'Montserrat-Bold, sans-serif',
                    fontSize: 22,
                  }}
                >
                  {conversationName}
                </span>
                {jeSuisAdmin ? (
                  <button
                    aria-label={t('conversation.web.fil.renommer', 'Renommer le groupe')}
                    onClick={() => setNomEnEdition(
                      String(chatData?.groupName || conversationName || ''),
                    )}
                    style={{
                      background: 'transparent',
                      border: 0,
                      color: PALETTE_DU_FIL.accent,
                      cursor: 'pointer',
                      padding: 4,
                    }}
                    type="button"
                  >
                    {DESSIN_MODIFIER}
                  </button>
                ) : null}
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 8, width: '100%' }}>
                <input
                  aria-label={t('conversation.group.nameLabel', 'Nom du groupe')}
                  onChange={(event) => setNomEnEdition(event.target.value)}
                  placeholder={t('conversation.group.namePlaceholder', 'Nom du groupe')}
                  style={STYLE_CHAMP_DE_FENETRE}
                  value={nomEnEdition}
                />
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                  <button
                    onClick={() => setNomEnEdition(null)}
                    style={STYLE_BOUTON_CONTOUR}
                    type="button"
                  >
                    {t('common.actions.cancel', 'Annuler')}
                  </button>
                  <button onClick={enregistrerLeNom} style={STYLE_BOUTON_PLEIN} type="button">
                    {t('conversation.group.saveName', 'Enregistrer le nom')}
                  </button>
                </div>
              </div>
            )}
            <span style={{ color: PALETTE_DU_FIL.texteDoux, fontSize: 14 }}>
              {t('conversation.web.fil.groupeMembres', {
                count: Array.isArray(chatData?.participants) ? chatData.participants.length : 0,
                defaultValue_one: 'Groupe · {{count}} membre',
                defaultValue_other: 'Groupe · {{count}} membres',
              })}
            </span>
          </div>
          {/* MSG1B (serveur) : photo du groupe, « Autorisations du groupe » et admins multiples
              viendront ICI, entre l en-tete et la liste. Rien n est invente avant leur contrat. */}
          <div style={{ display: 'grid', gap: 2 }}>
            {jeSuisAdmin ? (
              <button
                onClick={() => {
                  setInfosOuvertes(false);
                  navigation.navigate(RouteNames.NewConversation, {
                    chatId,
                    mode: 'add_group_members',
                  });
                }}
                style={{
                  alignItems: 'center',
                  background: 'transparent',
                  border: 0,
                  color: PALETTE_DU_FIL.accent,
                  cursor: 'pointer',
                  display: 'flex',
                  fontFamily: 'Montserrat-Bold, sans-serif',
                  fontSize: 15,
                  gap: 12,
                  minHeight: 62,
                  padding: '0 4px',
                  textAlign: 'left',
                }}
                type="button"
              >
                <span
                  style={{
                    alignItems: 'center',
                    background: PALETTE_DU_FIL.accent,
                    borderRadius: '50%',
                    display: 'inline-flex',
                    height: 42,
                    justifyContent: 'center',
                    width: 42,
                  }}
                >
                  <GlyphIcon color={PALETTE_DU_FIL.encre} name="plus2" size={22} />
                </span>
                {t('conversation.group.addMembers', 'Ajouter des membres')}
              </button>
            ) : null}
            {membresDuFil.map((/** @type {any} */ membre) => {
              const id = String(membre?.documentId || membre?.id || '');
              const estAdmin = adminsDuGroupe.includes(id);
              const estMoi = id === String(userData?.documentId || '');
              return (
                <div
                  data-testid={`MSG1W-membre-${id}`}
                  key={`membre-${id}`}
                  style={{
                    alignItems: 'center',
                    display: 'flex',
                    gap: 12,
                    minHeight: 62,
                    padding: '0 4px',
                  }}
                >
                  <AvatarDuGroupe idMessage={`membre-${id}`} personne={membre} />
                  <span style={{ color: PALETTE_DU_FIL.texte, flex: 1, fontSize: 15 }}>
                    {getDisplayName(membre)}
                  </span>
                  {estAdmin ? (
                    <span
                      style={{
                        border: '1px solid rgba(1, 179, 244, 0.5)',
                        borderRadius: 999,
                        color: PALETTE_DU_FIL.accent,
                        fontFamily: 'Montserrat-Bold, sans-serif',
                        fontSize: 11.5,
                        padding: '2px 8px',
                      }}
                    >
                      {t('conversation.group.admin', 'Admin')}
                    </span>
                  ) : null}
                  {jeSuisAdmin && !estMoi ? (
                    <button
                      aria-label={`${libelleRetirer} ${getDisplayName(membre)}`}
                      onClick={() => setMembreARetirer(membre)}
                      style={{
                        background: 'transparent',
                        border: `1px solid ${PALETTE_DU_FIL.menuBord}`,
                        borderRadius: 999,
                        color: PALETTE_DU_FIL.texteDoux,
                        cursor: 'pointer',
                        fontSize: 12.5,
                        padding: '4px 10px',
                      }}
                      type="button"
                    >
                      {t('conversation.group.remove', 'Retirer')}
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
          {/* Decision d Adel `quitter maintenant` : pour TOUT membre, admin ou non. */}
          <button
            onClick={() => setDepartAConfirmer(true)}
            style={STYLE_BOUTON_ROUGE_DES_INFOS}
            type="button"
          >
            {t('conversation.groupInfo.leave', 'Quitter le groupe')}
          </button>
          <button
            onClick={() => setAnnonce(texteDuSignalement)}
            style={STYLE_BOUTON_ROUGE_DES_INFOS}
            type="button"
          >
            {t('conversation.web.fil.signalerLeGroupe', 'Signaler le groupe')}
          </button>
        </FenetreDuSite>
      ) : null}
      {departAConfirmer ? (
        <ConfirmationDuSite
          id="msg1w-depart"
          libelleAction={t('conversation.groupInfo.leaveConfirmAction', 'Quitter')}
          onAnnuler={() => setDepartAConfirmer(false)}
          onConfirmer={quitterLeGroupe}
          titre={t('conversation.groupInfo.leaveConfirm', {
            defaultValue: 'Quitter le groupe « {{name}} » ? Tu ne recevras plus ses messages.',
            name: conversationName,
            ...SANS_ECHAPPEMENT,
          })}
        />
      ) : null}
      {membreARetirer ? (
        <ConfirmationDuSite
          id="msg1w-retrait"
          libelleAction={t('conversation.group.remove', 'Retirer')}
          onAnnuler={() => setMembreARetirer(null)}
          onConfirmer={retirerLeMembre}
          texte={t('conversation.group.removeConfirm', {
            defaultValue: 'Retirer {{member}} du groupe ?',
            member: getDisplayName(membreARetirer),
            ...SANS_ECHAPPEMENT,
          })}
          titre={t('conversation.group.removeTitle', 'Retirer un membre')}
        />
      ) : null}
      {blocageAConfirmer ? (
        <ConfirmationDuSite
          id="msg1w-blocage"
          libelleAction={t('userBlock.confirm.block', 'Bloquer')}
          onAnnuler={() => setBlocageAConfirmer(false)}
          onConfirmer={() => {
            setBlocageAConfirmer(false);
            if (autrePersonne) bloquer(autrePersonne);
          }}
          texte={t(
            'userBlock.confirm.messageNoName',
            // eslint-disable-next-line max-len -- une phrase ne se coupe pas
            'Cette personne ne pourra plus t’écrire ni ouvrir de discussion avec toi, et tu ne verras plus ses messages.',
          )}
          titre={t('userBlock.confirm.title', 'Bloquer cette personne ?')}
        />
      ) : null}
      <ApercuDImageDuSite onClose={fermerLImageEnGrand} uri={imageEnGrand} />
      {annonce ? (
        <div
          role="status"
          style={{
            background: PALETTE_DU_FIL.menu,
            border: `1px solid ${PALETTE_DU_FIL.menuBord}`,
            borderRadius: 999,
            bottom: 96,
            color: PALETTE_DU_FIL.texte,
            fontSize: 14,
            left: '50%',
            padding: '8px 16px',
            position: 'fixed',
            transform: 'translateX(-50%)',
            zIndex: 1200,
          }}
        >
          {annonce}
        </div>
      ) : null}
    </ScreenContainer>
  )
}

/**
 * 🧭 SMF (T20, 08/10) — `/messages` SUR ORDINATEUR : la colonne « Messages » a gauche (la MEME
 * que celle d un fil ouvert) et, a droite, la place du fil. La page du telephone (Messaging.js)
 * y montrait une 2e liste, differente (SITE_M14a). L aiguillage est dans Messaging.web.js.
 * @param {{ navigation: any }} props - La navigation.
 * @returns {import('react').ReactElement} La page.
 */
export function MessagesDuSite({ navigation }) {
  const { t } = useTranslation();
  const {
    archiveChatAsync, pinChatAsync, unarchiveChatAsync, unpinChatAsync,
  } = useMessaging();
  const cadreRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const hauteurDuCadre = useHauteurDuCadre(cadreRef, true, null);
  return (
    <ScreenContainer
      bgImage="bg2"
      contentWidth="full"
      responsivePadding
      // @ts-ignore: FIXME: Baseline TS regression
      style={{ paddingBottom: 0 }}
    >
      <div
        ref={cadreRef}
        style={{
          display: 'grid',
          gap: 16,
          gridTemplateColumns: 'minmax(280px, 360px) minmax(0, 1fr)',
          height: hauteurDuCadre || 'calc(100vh - 116px)',
          minHeight: 0,
        }}
      >
        <ColonneDesConversations
          chatId=""
          gestes={{
            archiveChatAsync, pinChatAsync, unarchiveChatAsync, unpinChatAsync,
          }}
          navigation={navigation}
          t={t}
        />
        <section
          data-testid="SMF-aucun-fil-choisi"
          style={{
            alignContent: 'center',
            background: PALETTE_DU_FIL.fil,
            border: `1px solid ${PALETTE_DU_FIL.filet}`,
            borderRadius: 20,
            display: 'grid',
            gap: 8,
            justifyItems: 'center',
            minHeight: 0,
            padding: 24,
            textAlign: 'center',
          }}
        >
          <GlyphIcon color={PALETTE_DU_FIL.texteDoux} name="envelope" size={40} />
          <h2
            style={{
              color: PALETTE_DU_FIL.texte,
              fontFamily: 'Montserrat-Bold, sans-serif',
              fontSize: 18,
              margin: 0,
            }}
          >
            {t('conversation.web.fil.aucunFilChoisi', 'Choisis une conversation')}
          </h2>
          <p style={{ color: PALETTE_DU_FIL.texteDoux, fontSize: 14, margin: 0 }}>
            {t(
              'conversation.web.fil.aucunFilChoisiAide',
              'Elle s’ouvrira ici, à côté de la liste.',
            )}
          </p>
        </section>
      </div>
    </ScreenContainer>
  );
}

export default Conversation
