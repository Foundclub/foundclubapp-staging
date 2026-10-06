import { useMutation, useQueryClient } from '@tanstack/react-query'
import i18next from 'i18next';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import { useWindowDimensions, View } from 'react-native'

import useAuth from '@/domains/auth/useAuth'
import { EMOJI_CATALOG } from '@/domains/messaging/emojiCatalog';
import { getConversationName } from '@/domains/messaging/messagingUseCases'
import {
  applyOptimisticPollVote,
  createPollComposition,
  getPollVoteCount,
} from '@/domains/messaging/pollUseCases'
import {
  getMyReactionEmoji,
  getReactionsForMessage,
  indexReactionsByMessage,
  REACTION_EMOJIS,
} from '@/domains/messaging/reactionUseCases';
import useMessaging from '@/domains/messaging/useMessaging'
import { BREAKPOINTS } from '@/responsive'
// eslint-disable-next-line max-len -- un chemin d'import ne se coupe pas
import CompositionMessageBubbleDuFil from '@/components/molecules/compositionMessageBubble/CompositionMessageBubbleDuFil';
import ScreenContainer from '@/components/templates/ScreenContainer'
// COLL-C4A2 (02/10) — les fils de la Ville (canal des dirigeants, conversation privee).
import { ListeDesMembresDuFil } from '@/views/collectivite/CollectiviteCanalMembres';
// COLL-C4A3 (03/10) — la colonne de gauche de la Ville et l'écusson de l'en-tête (planche 47).
import { ColonneDesFilsDeLaVille } from '@/views/collectivite/components/CanauxDeLaVille';
import {
  EcussonDuFil,
  FilDeLaVilleQuitte,
  useFilDeLaVille,
  VideDuFilDeLaVille,
} from '@/views/collectivite/components/FilDeLaVille';
import { RouteNames } from '@/navigation/routeNames'
import links from '@/platform/links'
import media from '@/platform/media'
import {
  useGetChatById,
  useGetChatMessageReactions,
  useGetChatMessages,
  useGetChats,
} from '@/services/chat/chatQueriesCompat';
const { openUrl } = links || {}
const { pickDocument, pickImage, recordVoiceNote } = media || {}
import { createChatMessage } from '@/services/chat/chatService'
import client from '@/services/client'
import { useGetEvents } from '@/services/event/eventQueries'
import {
  createLeagueProposal,
  respondToLeagueProposal,
} from '@/services/league/leagueMatchService'
import { createMessageReport } from '@/services/messageReport/messageReportService'
import useTheme from '@/theme/themeContext'
import {
  getDocumentDisplayName,
  isDocumentAttachment,
  isImageAttachment,
} from '@/utils/documentAttachment'
import { areSameEntityId, getEntityDocumentId } from '@/utils/entityId'
import { getImageUrl } from '@/utils/imageUrl'
import {
  buildCanonicalLeagueProposalPayload,
  buildLeagueProposalPayload,
} from '@/views/league/match/utils/proposalPayload'
import {
  buildLeagueLegalAcceptancePayload,
  LEAGUE_LEGAL_SCOPES,
} from '@/constants/leagueLegalAcceptance'

const EMPTY_POLL_OPTIONS = ['', '', '']

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

  return {
    left: Math.max(8, Math.min(
      rect.right - largeur,
      window.innerWidth - largeur - 8,
    )),
    top: placeAuDessus
      ? rect.top - hauteur - 6
      : rect.bottom + 6,
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
`;

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
  } = useTheme()
  const {
    userData,
  } = useAuth()
  const {
    joinChat,
    leaveChat,
    reactToMessage,
    respondToProposal,
    retryFailedMessage: retryFailedMessageSansVoix,
    sendMessage: sendMessageSansVoix,
    sendReadReceipt,
    sendTypingStart,
    sendTypingStop,
    votePoll,
  } = useMessaging(chatId)

  const [composerText, setComposerText] = useState('')
  // COLL-C4A2 (02/10) — « Demander au club de compléter sa fiche » ouvre la conversation privée
  // avec une phrase prête à envoyer : on la relit, on l'envoie ou on la change.
  const brouillonDuFil = route?.params?.brouillon;
  useEffect(() => {
    if (brouillonDuFil) setComposerText((actuel) => actuel || String(brouillonDuFil));
  }, [brouillonDuFil]);
  const [replyTarget, setReplyTarget] = useState(null)
  const [isSending, setIsSending] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptions, setPollOptions] = useState(EMPTY_POLL_OPTIONS)
  const [allowMultipleVotes, setAllowMultipleVotes] = useState(false)
  const [isAnonymousPoll, setIsAnonymousPoll] = useState(false)
  const [proposalDate, setProposalDate] = useState('')
  const [proposalStartTime, setProposalStartTime] = useState('')
  const [proposalEndTime, setProposalEndTime] = useState('')
  const [proposalVenue, setProposalVenue] = useState('')
  const [proposalAddress, setProposalAddress] = useState('')
  const [isRecordingVoice, setIsRecordingVoice] = useState(false)
  const [isStoppingVoice, setIsStoppingVoice] = useState(false)
  const [isSubmittingPoll, setIsSubmittingPoll] = useState(false)
  const [isSubmittingProposal, setIsSubmittingProposal] = useState(false)
  const [reportedMessageId, setReportedMessageId] = useState('')
  // REACT-WEB — le message dont la barre de six emojis est ouverte, ou une chaine
  // vide. UN SEUL ETAT : un booleen « ouverte » doublé d un identifiant pourraient
  // se contredire, et deux barres s ouvrir en meme temps.
  const [reactionBarMessageId, setReactionBarMessageId] = useState('');
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
  const filDeLaVille = useFilDeLaVille({
    chatData,
    chatId,
    espaceVille: route?.params?.espace === 'ville',
    messagesError,
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
  const avecColonneDeLaVille = Boolean(
    isDesktop && route?.params?.espace === 'ville' && filDeLaVille.estFil && villeDuFil,
  );
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
  let colonnesDeLaGrille = isDesktop ? 'minmax(0, 1.5fr) minmax(320px, 420px)' : 'minmax(0, 1fr)';
  if (avecColonneDeLaVille) {
    colonnesDeLaGrille = 'minmax(240px, 300px) minmax(0, 1.5fr) minmax(280px, 380px)';
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

  const handleSubmitPoll = useCallback(async () => {
    const question = pollQuestion.trim()
    const options = pollOptions.map((option) => option.trim()).filter(Boolean)
    if (!question || options.length < 2) {
      window.alert(i18next.t(
        'conversation.web.poll.incomplete',
        'Ajoute une question et au moins deux options.',
      ))
      return
    }

    setIsSubmittingPoll(true)
    try {
      await sendChatPayload({
        composition: createPollComposition({
          allowMultipleVotes,
          createdBy: userData?.documentId || '',
          isAnonymous: isAnonymousPoll,
          options,
          question,
        }),
      })
      setPollQuestion('')
      setPollOptions(EMPTY_POLL_OPTIONS)
      setAllowMultipleVotes(false)
      setIsAnonymousPoll(false)
    } catch (error) {
      // @ts-ignore: FIXME: Baseline TS regression
      window.alert(error?.message || i18next.t(
        'conversation.web.poll.createError',
        'Impossible de créer ce sondage.',
      ))
    } finally {
      setIsSubmittingPoll(false)
    }
  }, [
    allowMultipleVotes,
    isAnonymousPoll,
    pollOptions,
    pollQuestion,
    sendChatPayload,
    userData?.documentId,
  ])

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

    try {
      if (status === 'accepted' && matchId) {
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
    requestWebLeagueLegalAcceptance,
    respondToProposal,
  ])

  // @ts-ignore: FIXME: Baseline TS regression
  const updatePollOption = useCallback((index, value) => {
    setPollOptions((current) => current.map((option, optionIndex) => (
      optionIndex === index ? value : option
    )))
  }, [])

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
  const validPollOptionCount = pollOptions.map((option) => option.trim()).filter(Boolean).length
  const canSubmitPoll = Boolean(pollQuestion.trim())
    && validPollOptionCount >= 2
    && canUseConversationActions
    && !isSubmittingPoll
    && !isUploading
    && !isRecordingVoice
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
              onClick={() => openUrl(attachmentUrl)}
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

  // @ts-ignore: FIXME: Baseline TS regression
  const renderComposition = useCallback((message, isMine = false) => {
    const composition = message?.composition
    if (!composition?.type) return null

    if (composition.type === 'poll') {
      const options = Array.isArray(composition?.options) ? composition.options : []
      return (
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 15 }}>
            {composition?.question || 'Sondage'}
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            // @ts-ignore: FIXME: Baseline TS regression
            {options.map((option) => (
              <button
                key={option?.id || option?.label}
                onClick={() => handleVoteOnPoll(message, option?.id)}
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${borderColor}`,
                  borderRadius: 12,
                  color: baseTextColor,
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                }}
                type="button"
              >
                <span>{option?.label || 'Option'}</span>
                <span style={{ color: mutedTextColor }}>
                  {getPollVoteCount(option)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )
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

    if (composition.type === 'contact_share') {
      const fullName = `${composition?.firstname || ''} ${composition?.lastname || ''}`.trim()
      return (
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 15 }}>
            {fullName || 'Contact partage'}
          </div>
          <div style={{ color: mutedTextColor, fontSize: 13 }}>
            {composition?.roleLabel || 'Membre FoundClub'}
          </div>
        </div>
      )
    }

    if (composition.type === 'location_share') {
      const shareUrl = composition?.lat && composition?.lng
        ? `https://www.google.com/maps?q=${composition.lat},${composition.lng}`
        : ''
      return (
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 15 }}>
            {composition?.label || 'Position partagee'}
          </div>
          <div style={{ color: mutedTextColor, fontSize: 13 }}>
            {composition?.address || ''}
          </div>
          {shareUrl ? (
            <button
              onClick={() => openUrl(shareUrl)}
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
              {i18next.t('conversation.web.openInMaps', 'Ouvrir dans Maps')}
            </button>
          ) : null}
        </div>
      )
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
        <CompositionMessageBubbleDuFil
          chatId={chatId}
          composition={composition}
          currentEvent={message?.event}
          isMe={isMine}
        />
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
    primaryColor,
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
  const handleToggleReaction = useCallback(async (messageDocumentId, emoji) => {
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

  // @ts-ignore: FIXME: Baseline TS regression
  const renderMessageCard = useCallback((message) => {
    // COLL-C4A2 — « … a rejoint le canal » n'a pas d'expéditeur : une ligne centrée, sans bulle.
    if (filDeLaVille.estLigneSysteme(message)) {
      return (
        <div
          key={getMessageId(message)}
          style={{
            color: mutedTextColor, fontSize: 13, justifySelf: 'center', textAlign: 'center',
          }}
        >
          {String(message?.message || '')}
        </div>
      );
    }
    // COLL-C4A2 — dans un fil de la Ville, qui écrit ET pour quel club.
    const senderName = filDeLaVille.nomDeLExpediteur(message) || getDisplayName(message?.sender);
    const isMine = areSameEntityId(message?.sender?.documentId, userData?.documentId)
    // FINITIONS16 20 (planche 47) : MON message dans un fil de la Ville dit au nom de qui il part.
    const maVoix = isMine && filDeLaVille.estFil
      ? String(message?.senderSignature?.nom || '').trim()
      : '';
    const attachments = Array.isArray(message?.attachments) ? message.attachments : []
    const shouldRenderAttachments = attachments.length > 0 && message?.composition?.type !== 'voice_note'
    const replyPreview = message?.replyTo
    const bubbleBackground = isMine ? 'rgba(1, 179, 244, 0.14)' : 'rgba(255, 255, 255, 0.04)'
    const messageReactions = getReactionsForMessage(
      reactionsByMessage,
      getMessageId(message),
    );
    const myReactionEmoji = getMyReactionEmoji(messageReactions, userData?.documentId);

    return (
      <div
        key={getMessageId(message)}
        style={{
          display: 'flex',
          justifyContent: isMine ? 'flex-end' : 'flex-start',
        }}
      >
        <div
          className="REACTWEB-hote"
          data-testid={`REACTWEB-bulle-${getMessageId(message)}`}
          style={{
            background: bubbleBackground,
            border: `1px solid ${isMine ? 'rgba(1, 179, 244, 0.28)' : borderColor}`,
            borderRadius: 22,
            color: baseTextColor,
            display: 'grid',
            gap: 12,
            maxWidth: 'min(720px, 100%)',
            padding: 18,
            // REACT-WEB — LE BOUTON EST POSE EN ABSOLU DANS CE CADRE, et c est ce qui
            // garantit qu une conversation garde exactement son allure : il n occupe
            // aucune place dans la grille, donc aucune bulle ne se decale, ni quand il
            // apparait, ni quand il disparait.
            position: 'relative',
            width: isDesktop ? 'auto' : '100%',
          }}
        >
          <button
            aria-expanded={reactionBarMessageId === getMessageId(message)}
            aria-haspopup="true"
            aria-label={i18next.t('conversation.reactions.add', 'Réagir à ce message')}
            className="REACTWEB-declencheur"
            data-testid={`REACTWEB-reagir-${getMessageId(message)}`}
            onClick={(event) => {
              reactionTriggerRef.current = event.currentTarget;
              if (reactionBarMessageId === getMessageId(message)) {
                setReactionBarMessageId('');
                return;
              }
              setReactionBarAnchor(getReactionBarAnchor(event.currentTarget));
              setReactionBarMessageId(getMessageId(message));
            }}
            style={{
              alignItems: 'center',
              background: panelBackground,
              border: `1px solid ${borderColor}`,
              borderRadius: 999,
              color: baseTextColor,
              cursor: 'pointer',
              display: 'flex',
              fontSize: 14,
              height: 28,
              justifyContent: 'center',
              lineHeight: 1,
              padding: 0,
              position: 'absolute',
              right: 10,
              top: 10,
              transition: 'opacity 120ms ease',
              width: 28,
              zIndex: 2,
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
          {!isMine || maVoix ? (
            <div style={{ color: mutedTextColor, fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 12 }}>
              {isMine ? maVoix : senderName}
            </div>
          ) : null}
          {replyPreview ? (
            <div style={{
              background: 'rgba(255,255,255,0.05)',
              borderLeft: `3px solid ${primaryColor}`,
              borderRadius: 12,
              display: 'grid',
              gap: 4,
              padding: '10px 12px',
            }}
            >
              <span style={{ color: mutedTextColor, fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 12 }}>
                {getDisplayName(replyPreview?.sender)}
              </span>
              <span style={{ color: mutedTextColor, fontSize: 13 }}>
                {String(replyPreview?.message || '').trim() || 'Message partagé'}
              </span>
            </div>
          ) : null}
          {String(message?.message || '').trim() ? (
            <div style={{ fontSize: 15, lineHeight: 1.5 }}>
              {String(message?.message || '').trim()}
            </div>
          ) : null}
          {shouldRenderAttachments ? renderAttachments(attachments) : null}
          {message?.composition ? renderComposition(message, isMine) : null}
          {messageReactions.length > 0 ? (
            <div
              data-testid={`MSGREACT-rangee-${getMessageId(message)}`}
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 6,
                justifyContent: isMine ? 'flex-end' : 'flex-start',
              }}
            >
              {messageReactions.map((reaction) => {
                const isMyReaction = Boolean(myReactionEmoji)
                  && reaction?.emoji === myReactionEmoji;
                return (
                  <span
                    key={`${getMessageId(message)}-${reaction?.emoji}`}
                    style={{
                      alignItems: 'center',
                      background: isMyReaction
                        ? 'rgba(1, 179, 244, 0.22)'
                        : 'rgba(255, 255, 255, 0.06)',
                      border: `1px solid ${isMyReaction ? primaryColor : 'transparent'}`,
                      borderRadius: 12,
                      display: 'inline-flex',
                      fontSize: 13,
                      gap: 4,
                      padding: '2px 8px',
                    }}
                    title={(Array.isArray(reaction?.users) ? reaction.users : [])
                      .map((user) => [user?.firstname, user?.lastname].filter(Boolean).join(' '))
                      .filter(Boolean)
                      .join(', ')}
                  >
                    <span>{reaction?.emoji}</span>
                    <span style={{ color: mutedTextColor }}>{String(reaction?.count ?? 0)}</span>
                  </span>
                );
              })}
            </div>
          ) : null}
          <div style={{
            alignItems: 'center',
            color: mutedTextColor,
            display: 'flex',
            flexWrap: 'wrap',
            fontSize: 12,
            gap: 10,
            justifyContent: 'space-between',
          }}
          >
            <span>
              {formatDay(message?.createdAt)}
              {' '}
              à
              {' '}
              {formatTime(message?.createdAt)}
              {message?.pending ? i18next.t('conversation.web.message.sending', ' • envoi...') : ''}
              {message?.failed ? i18next.t(
                'conversation.web.message.toResend',
                ' • à renvoyer',
              ) : ''}
            </span>
            <div style={{
              alignItems: 'center',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
            }}
            >
              {message?.failed ? (
                <button
                  onClick={() => handleRetryFailedMessage(message)}
                  style={{
                    background: 'transparent',
                    border: 0,
                    color: primaryColor,
                    cursor: 'pointer',
                    fontFamily: 'Montserrat-Bold, sans-serif',
                    padding: 0,
                  }}
                  type="button"
                >
                  Renvoyer
                </button>
              ) : null}
              {!isMine ? (
                <button
                  disabled={reportMessageMutation.isPending && reportedMessageId === getMessageId(message)}
                  onClick={() => handleReportMessage(message)}
                  style={{
                    background: 'transparent',
                    border: 0,
                    color: mutedTextColor,
                    cursor: reportMessageMutation.isPending ? 'wait' : 'pointer',
                    fontFamily: 'Montserrat-Bold, sans-serif',
                    padding: 0,
                  }}
                  type="button"
                >
                  {reportMessageMutation.isPending && reportedMessageId === getMessageId(message) ? 'Signalement...' : 'Signaler'}
                </button>
              ) : null}
              <button
                onClick={() => setReplyTarget(message)}
                style={{
                  background: 'transparent',
                  border: 0,
                  color: primaryColor,
                  cursor: 'pointer',
                  fontFamily: 'Montserrat-Bold, sans-serif',
                  padding: 0,
                }}
                type="button"
              >
                Répondre
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }, [
    baseTextColor,
    borderColor,
    filDeLaVille,
    handleReportMessage,
    handleRetryFailedMessage,
    handleToggleReaction,
    isDesktop,
    mutedTextColor,
    panelBackground,
    primaryColor,
    clavierOuvert,
    familleEmoji,
    reactionBarAnchor,
    reactionBarMessageId,
    reactionsByMessage,
    reportMessageMutation.isPending,
    renderAttachments,
    renderComposition,
    reportedMessageId,
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

  return (
    <ScreenContainer
      bgImage="bg2"
      contentWidth="full"
      responsivePadding
      // @ts-ignore: FIXME: Baseline TS regression
      style={{ paddingBottom: 32 }}
    >
      <div
        style={{
          color: baseTextColor,
          display: 'grid',
          gap: 24,
          gridTemplateColumns: colonnesDeLaGrille,
          minHeight: isDesktop ? 'calc(100vh - 120px)' : 'auto',
        }}
      >
        {avecColonneDeLaVille ? (
          <aside
            style={{
              alignSelf: 'start',
              background: panelBackground,
              border: `1px solid ${borderColor}`,
              borderRadius: 24,
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
            background: panelBackground,
            border: `1px solid ${borderColor}`,
            borderRadius: 28,
            display: 'grid',
            gridTemplateRows: 'auto minmax(0, 1fr) auto',
            minHeight: isDesktop ? 'calc(100vh - 120px)' : 0,
            overflow: 'hidden',
          }}
        >
          <header style={{ borderBottom: `1px solid ${borderColor}`, display: 'grid', gap: 10, padding: 24 }}>
            <div style={{ alignItems: 'center', display: 'flex', gap: 12, justifyContent: 'space-between' }}>
              <div style={{ alignItems: 'center', display: 'flex', gap: 12 }}>
                {/* COLL-C4A3 (planche 47) — un fil de la Ville porte son icône ou son écusson. */}
                <View testID="fil-de-la-ville-ecusson">
                  <EcussonDuFil
                    chat={chatData}
                    espaceVille={route?.params?.espace === 'ville'}
                    routeChatType={route?.params?.chatType || null}
                  />
                </View>
                <div style={{ display: 'grid', gap: 6 }}>
                  <span
                    style={{
                      color: mutedTextColor, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase',
                    }}
                  >
                    Messagerie
                  </span>
                  <h1
                    style={{
                      color: baseTextColor, fontFamily: 'Montserrat-Black, sans-serif', fontSize: 28, margin: 0,
                    }}
                  >
                    {conversationName}
                  </h1>
                </div>
              </div>
            </div>
            <div style={{ color: mutedTextColor, fontSize: 14 }}>
              {isChatLoading
                ? i18next.t(
                  'conversation.web.loading.conversation',
                  'Chargement de la conversation...',
                )
                : (filDeLaVille.sousTitre || `${
                  Array.isArray(chatData?.participants) ? chatData.participants.length : 0
                } participants`)}
            </div>
          </header>

          <div
            ref={messagePaneRef}
            style={{
              // FINITIONS16 20 : la rangee d un seul message ne s etire plus sur toute la hauteur.
              alignContent: 'start',
              display: 'grid',
              gap: 16,
              overflowY: 'auto',
              padding: 24,
            }}
          >
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
            {!isMessagesLoading && !messagesError && !messages.length && !filDeLaVille.estFil ? (
              <div style={{ color: mutedTextColor }}>
                {i18next.t('conversation.web.empty', 'Aucun message pour le moment.')}
              </div>
            ) : null}

            <style>{REACTION_HOVER_STYLE}</style>
            {!messagesError ? messages.map((message) => renderMessageCard(message)) : null}
          </div>

          <div style={{ borderTop: `1px solid ${borderColor}`, display: 'grid', gap: 14, padding: 20 }}>
            {replyTarget ? (
              <div style={{
                alignItems: 'center',
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${borderColor}`,
                borderRadius: 16,
                display: 'flex',
                gap: 12,
                justifyContent: 'space-between',
                padding: '12px 14px',
              }}
              >
                <div style={{ display: 'grid', gap: 4 }}>
                  <span style={{ color: mutedTextColor, fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 12 }}>
                    // @ts-ignore: FIXME: Baseline TS regression
                    Reponse a {getDisplayName(replyTarget?.sender)}
                  </span>
                  <span style={{ color: baseTextColor, fontSize: 13 }}>
                    // @ts-ignore: FIXME: Baseline TS regression
                    {String(replyTarget?.message || '').trim() || 'Message partagé'}
                  </span>
                </div>
                <button
                  onClick={() => setReplyTarget(null)}
                  style={{ background: 'transparent', border: 0, color: primaryColor, cursor: 'pointer' }}
                  type="button"
                >
                  Retirer
                </button>
              </div>
            ) : null}

            <textarea
              onChange={(event) => setComposerText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  if (!isSending && composerText.trim()) {
                    handleSendText()
                  }
                }
              }}
              placeholder={
                filDeLaVille.placeholder || t('conversation.placeholder', 'Ecris ton message...')
              }
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${borderColor}`,
                borderRadius: 20,
                color: baseTextColor,
                fontFamily: 'Montserrat-Regular, sans-serif',
                fontSize: 15,
                minHeight: 120,
                outline: 'none',
                padding: 16,
                resize: 'vertical',
                width: '100%',
              }}
              value={composerText}
            />

            <div style={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                <button
                  disabled={isStoppingVoice || (!isRecordingVoice && !isVoiceRecordingSupported) || isUploading || isSending || isSubmittingPoll || isSubmittingProposal}
                  onClick={handleVoiceNote}
                  style={{
                    background: isRecordingVoice ? primaryColor : 'transparent',
                    border: `1px solid ${isRecordingVoice ? primaryColor : borderColor}`,
                    borderRadius: 999,
                    color: isRecordingVoice ? '#001218' : baseTextColor,
                    cursor: (isStoppingVoice || (!isRecordingVoice && !isVoiceRecordingSupported) || isUploading || isSending || isSubmittingPoll || isSubmittingProposal) ? 'not-allowed' : 'pointer',
                    opacity: (isStoppingVoice || (!isRecordingVoice && !isVoiceRecordingSupported) || isUploading || isSending || isSubmittingPoll || isSubmittingProposal) ? 0.6 : 1,
                    padding: '10px 14px',
                  }}
                  type="button"
                >
                  {isStoppingVoice
                    ? 'Preparation...'
                    : (isRecordingVoice ? i18next.t(
                      'conversation.web.voice.stop',
                      'Arrêter la note vocale',
                    ) : 'Note vocale')}
                </button>
                <button onClick={handlePickImage} style={{ background: 'transparent', border: `1px solid ${borderColor}`, borderRadius: 999, color: baseTextColor, cursor: 'pointer', padding: '10px 14px' }} type="button">Image</button>
                <button onClick={handlePickDocument} style={{ background: 'transparent', border: `1px solid ${borderColor}`, borderRadius: 999, color: baseTextColor, cursor: 'pointer', padding: '10px 14px' }} type="button">Document</button>
              </div>
              <button
                disabled={!canSendText}
                onClick={handleSendText}
                style={{
                  background: primaryColor,
                  border: 0,
                  borderRadius: 999,
                  color: '#001218',
                  cursor: !canSendText ? 'not-allowed' : 'pointer',
                  fontFamily: 'Montserrat-Bold, sans-serif',
                  opacity: !canSendText ? 0.6 : 1,
                  padding: '12px 18px',
                }}
                type="button"
              >
                {isSending ? 'Envoi...' : 'Envoyer'}
              </button>
            </div>
            <div style={{ color: mutedTextColor, fontSize: 12 }}>
              {isRecordingVoice
                ? i18next.t(
                  'conversation.web.voice.recording',
                  'Enregistrement en cours. Clique à nouveau pour envoyer la note vocale.',
                )
                : (isVoiceRecordingSupported
                  ? i18next.t(
                    'conversation.web.voice.usesMic',
                    'Les notes vocales utilisent le microphone du navigateur.',
                  )
                  : i18next.t(
                    'conversation.web.voice.unsupported',
                    'Les notes vocales ne sont pas prises en charge par ce navigateur.',
                  ))}
            </div>
          </div>
        </section>

        <aside style={{ display: 'grid', gap: 20 }}>
          {/* COLL-C4A2 — P3c-canal-ordi : « Dans ce canal », liste calculée, sans « Ajouter ». */}
          {filDeLaVille.estFil && filDeLaVille.membres ? (
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
          ) : null}
          <section style={{ background: panelBackground, border: `1px solid ${borderColor}`, borderRadius: 24, display: 'grid', gap: 14, padding: 22 }}>
            <h2
              style={{
                color: baseTextColor, fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 18, margin: 0,
              }}
            >
              Partager
            </h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <button onClick={handleShareLocation} style={{ background: 'transparent', border: `1px solid ${borderColor}`, borderRadius: 999, color: baseTextColor, cursor: 'pointer', padding: '10px 14px' }} type="button">Position</button>
              <button onClick={handlePickImage} style={{ background: 'transparent', border: `1px solid ${borderColor}`, borderRadius: 999, color: baseTextColor, cursor: 'pointer', padding: '10px 14px' }} type="button">Photo</button>
              <button onClick={handlePickDocument} style={{ background: 'transparent', border: `1px solid ${borderColor}`, borderRadius: 999, color: baseTextColor, cursor: 'pointer', padding: '10px 14px' }} type="button">Fichier</button>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              <h3
                style={{
                  color: baseTextColor, fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 14, margin: 0,
                }}
              >
                Contacts
              </h3>
              {shareableContacts.length === 0 ? (
                <div style={{ color: mutedTextColor, fontSize: 13 }}>
                  {i18next.t(
                    'conversation.web.share.noContact',
                    'Aucun contact partageable dans cette conversation.',
                  )}
                </div>
              ) : shareableContacts.slice(0, 6).map((contact) => {
                const fullName = getDisplayName(contact)
                return (
                  <button
                    key={contact.documentId}
                    onClick={() => handleShareContact(contact)}
                    style={{
                      alignItems: 'center',
                      background: 'rgba(255,255,255,0.04)',
                      border: `1px solid ${borderColor}`,
                      borderRadius: 14,
                      color: baseTextColor,
                      cursor: 'pointer',
                      display: 'flex',
                      gap: 12,
                      padding: '10px 12px',
                      textAlign: 'left',
                    }}
                    type="button"
                  >
                    <span style={{
                      alignItems: 'center',
                      background: 'rgba(1, 179, 244, 0.14)',
                      borderRadius: '50%',
                      display: 'inline-flex',
                      height: 34,
                      justifyContent: 'center',
                      minWidth: 34,
                    }}
                    >
                      {getInitials(fullName)}
                    </span>
                    <span style={{ display: 'grid', gap: 4 }}>
                      <span style={{ fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 13 }}>{fullName}</span>
                      <span style={{ color: mutedTextColor, fontSize: 12 }}>{contact?.role?.name || contact?.role?.type || contact?.role || ''}</span>
                    </span>
                  </button>
                )
              })}
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              <h3
                style={{
                  color: baseTextColor, fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 14, margin: 0,
                }}
              >
                {i18next.t('conversation.web.share.events', 'Événements')}
              </h3>
              {shareableEvents.length === 0 ? (
                <div style={{ color: mutedTextColor, fontSize: 13 }}>
                  {i18next.t(
                    'conversation.web.share.noEvent',
                    'Aucun événement récent à partager.',
                  )}
                </div>
              ) : shareableEvents.slice(0, 6).map((event) => (
                <button
                  key={getEntityDocumentId(event)}
                  onClick={() => handleShareEvent(event)}
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: `1px solid ${borderColor}`,
                    borderRadius: 14,
                    color: baseTextColor,
                    cursor: 'pointer',
                    display: 'grid',
                    gap: 4,
                    padding: '10px 12px',
                    textAlign: 'left',
                  }}
                  type="button"
                >
                  <span style={{ fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 13 }}>{event?.name || 'Événement'}</span>
                  <span style={{ color: mutedTextColor, fontSize: 12 }}>
                    {formatDay(event?.date)}
                    {' '}
                    •
                    {' '}
                    {event?.team?.name || ''}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section style={{ background: panelBackground, border: `1px solid ${borderColor}`, borderRadius: 24, display: 'grid', gap: 12, padding: 22 }}>
            <h2
              style={{
                color: baseTextColor, fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 18, margin: 0,
              }}
            >
              Sondage
            </h2>
            <input onChange={(event) => setPollQuestion(event.target.value)} placeholder={i18next.t('conversation.web.poll.questionPlaceholder', 'Question du sondage')} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${borderColor}`, borderRadius: 14, color: baseTextColor, outline: 'none', padding: '12px 14px' }} value={pollQuestion} />
            {pollOptions.map((option, index) => (
              <input
                key={`poll-option-${index}`}
                onChange={(event) => updatePollOption(index, event.target.value)}
                placeholder={`Option ${index + 1}`}
                style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${borderColor}`, borderRadius: 14, color: baseTextColor, outline: 'none', padding: '12px 14px' }}
                value={option}
              />
            ))}
            <label style={{ alignItems: 'center', color: mutedTextColor, display: 'flex', gap: 8, fontSize: 13 }}>
              <input checked={allowMultipleVotes} onChange={(event) => setAllowMultipleVotes(event.target.checked)} type="checkbox" />
              Autoriser plusieurs votes
            </label>
            <label style={{ alignItems: 'center', color: mutedTextColor, display: 'flex', gap: 8, fontSize: 13 }}>
              <input checked={isAnonymousPoll} onChange={(event) => setIsAnonymousPoll(event.target.checked)} type="checkbox" />
              Sondage anonyme
            </label>
            <button
              disabled={!canSubmitPoll}
              onClick={handleSubmitPoll}
              style={{
                background: primaryColor,
                border: 0,
                borderRadius: 999,
                color: '#001218',
                cursor: !canSubmitPoll ? 'not-allowed' : 'pointer',
                fontFamily: 'Montserrat-Bold, sans-serif',
                opacity: !canSubmitPoll ? 0.6 : 1,
                padding: '12px 16px',
              }}
              type="button"
            >
              {isSubmittingPoll ? 'Envoi...' : i18next.t(
                'conversation.web.poll.send',
                'Envoyer le sondage',
              )}
            </button>
          </section>

          {isLeagueConversation ? (
            <section style={{ background: panelBackground, border: `1px solid ${borderColor}`, borderRadius: 24, display: 'grid', gap: 12, padding: 22 }}>
              <h2
                style={{
                  color: baseTextColor, fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 18, margin: 0,
                }}
              >
                {i18next.t('conversation.web.proposal.title', 'Proposition de match')}
              </h2>
              <input onChange={(event) => setProposalDate(event.target.value)} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${borderColor}`, borderRadius: 14, color: baseTextColor, outline: 'none', padding: '12px 14px' }} type="date" value={proposalDate} />
              <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
                <input onChange={(event) => setProposalStartTime(event.target.value)} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${borderColor}`, borderRadius: 14, color: baseTextColor, outline: 'none', padding: '12px 14px' }} type="time" value={proposalStartTime} />
                <input onChange={(event) => setProposalEndTime(event.target.value)} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${borderColor}`, borderRadius: 14, color: baseTextColor, outline: 'none', padding: '12px 14px' }} type="time" value={proposalEndTime} />
              </div>
              <input onChange={(event) => setProposalVenue(event.target.value)} placeholder="Lieu" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${borderColor}`, borderRadius: 14, color: baseTextColor, outline: 'none', padding: '12px 14px' }} value={proposalVenue} />
              <input onChange={(event) => setProposalAddress(event.target.value)} placeholder="Adresse" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${borderColor}`, borderRadius: 14, color: baseTextColor, outline: 'none', padding: '12px 14px' }} value={proposalAddress} />
              <button
                disabled={!canSubmitProposal}
                onClick={handleSendProposal}
                style={{
                  background: primaryColor,
                  border: 0,
                  borderRadius: 999,
                  color: '#001218',
                  cursor: !canSubmitProposal ? 'not-allowed' : 'pointer',
                  fontFamily: 'Montserrat-Bold, sans-serif',
                  opacity: !canSubmitProposal ? 0.6 : 1,
                  padding: '12px 16px',
                }}
                type="button"
              >
                {isSubmittingProposal ? 'Envoi...' : i18next.t(
                  'conversation.web.proposal.send',
                  'Envoyer la proposition',
                )}
              </button>
            </section>
          ) : null}
        </aside>
      </div>
    </ScreenContainer>
  )
}

export default Conversation
