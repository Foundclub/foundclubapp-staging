import { useQueryClient } from '@tanstack/react-query'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import { useWindowDimensions } from 'react-native'

import useAuth from '@/domains/auth/useAuth'
import { getConversationName } from '@/domains/messaging/messagingUseCases'
import {
  applyOptimisticPollVote,
  createPollComposition,
  getPollVoteCount,
} from '@/domains/messaging/pollUseCases'
import useMessaging from '@/domains/messaging/useMessaging'
import { BREAKPOINTS } from '@/responsive'
import ScreenContainer from '@/components/templates/ScreenContainer'
import { RouteNames } from '@/navigation/routeNames'
import { openUrl } from '@/platform/links'
import { pickDocument, pickImage, recordVoiceNote } from '@/platform/media'
import { useGetChatById, useGetChatMessages } from '@/services/chat/chatQueriesCompat'
import { createChatMessage } from '@/services/chat/chatService'
import client from '@/services/client'
import { useGetEvents } from '@/services/event/eventQueries'
import { confirmMatch, updateMatch } from '@/services/league/leagueMatchService'
import useTheme from '@/theme/themeContext'
import {
  getDocumentDisplayName,
  isDocumentAttachment,
  isImageAttachment,
} from '@/utils/documentAttachment'
import { areSameEntityId, getEntityDocumentId } from '@/utils/entityId'
import getImageUrl from '@/utils/imageUrl'
import { buildLeagueProposalPayload } from '@/views/league/match/utils/proposalPayload'

const EMPTY_POLL_OPTIONS = ['', '', '']

const formatDateTime = (value, options = {}) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('fr-FR', options)
}

const formatTime = (value) => formatDateTime(value, {
  hour: '2-digit',
  minute: '2-digit',
})

const formatDay = (value) => formatDateTime(value, {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const getDisplayName = (user) => {
  const firstname = String(user?.firstname || '').trim()
  const lastname = String(user?.lastname || '').trim()
  const fullName = `${firstname} ${lastname}`.trim()
  return fullName || 'Membre'
}

const getInitials = (value) => String(value || '')
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part[0]?.toUpperCase() || '')
  .join('')

const flattenInfinitePages = (pages) => {
  if (!Array.isArray(pages)) return []
  const items = []
  pages.forEach((page) => {
    if (!Array.isArray(page?.data)) return
    page.data.forEach((item) => items.push(item))
  })
  return items
}

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

const getMessageId = (message) => String(
  message?.documentId
  || message?.id
  || message?._id
  || message?.clientMessageId
  || '',
).trim()

const sortMessagesAscending = (messages) => dedupeByDocumentId(messages)
  .sort((left, right) => {
    const leftTime = new Date(left?.createdAt || 0).getTime()
    const rightTime = new Date(right?.createdAt || 0).getTime()
    return leftTime - rightTime
  })

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

const buildEventShareComposition = (event) => {
  const eventDocumentId = getEntityDocumentId(event)
  return {
    eventDate: event?.date || null,
    eventDocumentId,
    eventName: event?.name || 'Evenement',
    eventPreview: event,
    locationLabel: event?.location?.label || event?.facility?.address || event?.facility?.name || '',
    teamName: event?.team?.name || '',
    type: 'event_share',
  }
}

const getErrorMessage = (error, fallback) => String(error?.message || fallback || 'Une erreur est survenue.')
  .trim()

const formatDurationLabel = (durationMs) => {
  const totalSeconds = Math.max(0, Math.round(Number(durationMs || 0) / 1000))
  if (!totalSeconds) return ''
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes > 0 ? `${minutes}:${String(seconds).padStart(2, '0')}` : `${seconds}s`
}

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
    isSocketConnected,
    joinChat,
    leaveChat,
    respondToProposal,
    sendMessage,
    sendReadReceipt,
    sendTypingStart,
    sendTypingStop,
    votePoll,
  } = useMessaging(chatId)

  const [composerText, setComposerText] = useState('')
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
  const { data: sharedEventsPages } = useGetEvents({
    excludeType: 'Reservation',
    myTeams: true,
    pageSize: 20,
    sort: 'date:asc',
  }, {
    enabled: Boolean(chatId),
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
    const participants = Array.isArray(chatData?.participants) ? chatData.participants : []
    return participants.filter((participant) => (
      participant?.documentId && participant.documentId !== userData?.documentId
    ))
  }, [chatData?.participants, userData?.documentId])

  const conversationName = useMemo(() => getConversationName({
    chatClub: chatData?.club,
    chatGroupName: chatData?.groupName,
    chatLeagueMatch: chatData?.league_match,
    chatMultisportClub: chatData?.multisportClub,
    chatParticipants: chatData?.participants,
    chatTeam: chatData?.team,
    chatType: chatData?.type,
    meId: userData?.documentId,
  }) || 'Conversation', [chatData, userData?.documentId])

  const latestMessageId = messages.length > 0 ? getMessageId(messages[messages.length - 1]) : ''
  const leagueMatchId = getEntityDocumentId(chatData?.league_match)
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

  useEffect(() => {
    if (!chatId) return undefined
    joinChat(chatId)
    return () => leaveChat(chatId)
  }, [chatId, joinChat, leaveChat])

  useEffect(() => () => {
    const recorder = voiceRecorderRef.current
    voiceRecorderRef.current = null
    if (recorder?.cancel) {
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

  const sendChatPayload = useCallback(async ({
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
    })
    await invalidateConversationQueries()
    setReplyTarget(null)
    if (trimmedMessage) {
      setComposerText('')
    }
    return getEntityDocumentId(response?.data || response)
  }, [chatId, invalidateConversationQueries, sendMessage, userData])

  const uploadAttachment = useCallback(async (file) => {
    const formData = new FormData()
    formData.append('files', file, file?.name || `upload-${Date.now()}`)
    const response = await client.post('/upload', formData)
    return Array.isArray(response?.data) ? response.data : []
  }, [])

  const sendPickedFile = useCallback(async (file) => {
    if (!file || !chatId) return

    setIsUploading(true)
    try {
      const uploadedFiles = await uploadAttachment(file)
      if (!uploadedFiles.length) {
        window.alert('Aucune piece jointe n a pu etre televersee.')
        return
      }

      const firstFile = uploadedFiles[0]
      const fallbackMessage = isImageAttachment(firstFile)
        ? composerText
        : (composerText || `Piece jointe : ${getDocumentDisplayName(firstFile)}`)

      await sendChatPayload({
        attachments: uploadedFiles,
        message: fallbackMessage,
        replyTo: replyTarget,
      })
    } catch (error) {
      window.alert(error?.message || 'Impossible d envoyer cette piece jointe.')
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
      window.alert(error?.message || 'Impossible de choisir une image.')
    }
  }, [sendPickedFile])

  const handlePickDocument = useCallback(async () => {
    try {
      const file = await pickDocument()
      if (file) {
        await sendPickedFile(file)
      }
    } catch (error) {
      window.alert(error?.message || 'Impossible de choisir un fichier.')
    }
  }, [sendPickedFile])

  const handleSendVoiceNote = useCallback(async (voiceNote) => {
    if (!voiceNote?.file || !chatId) return

    setIsUploading(true)
    try {
      const uploadedFiles = await uploadAttachment(voiceNote.file)
      if (!uploadedFiles.length) {
        window.alert('Aucune note vocale n a pu etre televersee.')
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
      window.alert(error?.message || 'Impossible d envoyer cette note vocale.')
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
        window.alert(error?.message || 'L enregistrement vocal n est pas disponible sur ce navigateur.')
      }
      return
    }

    const activeRecorder = voiceRecorderRef.current
    if (!activeRecorder?.stop) {
      voiceRecorderRef.current = null
      setIsRecordingVoice(false)
      return
    }

    setIsStoppingVoice(true)
    try {
      const result = await activeRecorder.stop()
      voiceRecorderRef.current = null
      setIsRecordingVoice(false)
      await handleSendVoiceNote(result)
    } catch (error) {
      if (error?.message !== 'VOICE_NOTE_RECORDING_CANCELLED') {
        window.alert(error?.message || 'Impossible de finaliser cette note vocale.')
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
      window.alert(error?.message || 'Impossible d envoyer le message.')
    } finally {
      setIsSending(false)
    }
  }, [chatId, composerText, replyTarget, sendChatPayload])

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
      window.alert(error?.message || 'Impossible de partager ce contact.')
    }
  }, [replyTarget, sendChatPayload])

  const handleShareEvent = useCallback(async (event) => {
    try {
      await sendChatPayload({
        composition: buildEventShareComposition(event),
        event: getEntityDocumentId(event),
        message: 'Partage',
        replyTo: replyTarget,
      })
    } catch (error) {
      window.alert(error?.message || 'Impossible de partager cet evenement.')
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
      window.alert('La geolocalisation n est pas disponible sur ce navigateur.')
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
        window.alert(error?.message || 'Impossible de partager votre position.')
      }
    }, (error) => {
      window.alert(error?.message || 'Impossible d acceder a votre position.')
    })
  }, [replyTarget, sendChatPayload])

  const handleSubmitPoll = useCallback(async () => {
    const question = pollQuestion.trim()
    const options = pollOptions.map((option) => option.trim()).filter(Boolean)
    if (!question || options.length < 2) {
      window.alert('Ajoutez une question et au moins deux options.')
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
      window.alert(error?.message || 'Impossible de creer ce sondage.')
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

  const handleVoteOnPoll = useCallback(async (message, optionId) => {
    const messageId = getMessageId(message)
    if (!messageId || !optionId) return

    queryClient.setQueriesData({ queryKey: ['chat-messages', chatId] }, (oldData) => {
      if (!oldData?.pages) return oldData
      return {
        ...oldData,
        pages: oldData.pages.map((page) => ({
          ...page,
          data: Array.isArray(page?.data)
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
      window.alert(error?.message || 'Impossible de sauvegarder ce vote.')
    }
  }, [chatId, invalidateConversationQueries, queryClient, userData?.documentId, votePoll])

  const handleSendProposal = useCallback(async () => {
    if (!proposalDate || !proposalStartTime) {
      window.alert('Choisissez une date et une heure pour la proposition.')
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
        venue: proposalVenue || 'Lieu a definir',
      }, chatData?.league_match?.location)

      if (leagueMatchId) {
        await updateMatch(leagueMatchId, payload.matchUpdate)
      }

      await sendChatPayload({
        composition: payload.message.composition,
        message: payload.message.message,
      })
    } catch (error) {
      window.alert(error?.message || 'Impossible d envoyer cette proposition.')
    } finally {
      setIsSubmittingProposal(false)
    }
  }, [
    chatData?.league_match?.location,
    leagueMatchId,
    proposalAddress,
    proposalDate,
    proposalEndTime,
    proposalStartTime,
    proposalVenue,
    sendChatPayload,
  ])

  const handleProposalResponse = useCallback(async (message, status) => {
    const messageId = getMessageId(message)
    const matchId = String(message?.composition?.matchId || leagueMatchId || '').trim()

    try {
      if (status === 'accepted' && matchId) {
        await confirmMatch(matchId)
      }
      await respondToProposal(messageId, status)
      await invalidateConversationQueries()
    } catch (error) {
      window.alert(error?.message || 'Impossible de repondre a cette proposition.')
    }
  }, [invalidateConversationQueries, leagueMatchId, respondToProposal])

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

  const renderStateCard = useCallback(({
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
        <h1 style={{ fontFamily: 'Montserrat-Black, sans-serif', fontSize: 28, margin: 0 }}>
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
          {actionLabel || 'R\u00E9essayer'}
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
                {isDocument ? 'Document' : attachment?.mime || 'Piece jointe'}
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

  const renderComposition = useCallback((message) => {
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
            Proposition de match
          </div>
          <div style={{ color: mutedTextColor, display: 'grid', fontSize: 13, gap: 4 }}>
            <span>{formatDay(composition?.date)}</span>
            <span>{composition?.venue || 'Lieu a definir'}</span>
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
            {composition?.eventName || 'Evenement'}
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
              Voir l evenement
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
              Ouvrir dans Maps
            </button>
          ) : null}
        </div>
      )
    }

    if (composition.type === 'voice_note') {
      const voiceAttachment = Array.isArray(message?.attachments)
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
              Le fichier audio n est pas disponible pour la lecture web.
            </div>
          )}
        </div>
      )
    }

    return (
      <div style={{ color: mutedTextColor, fontSize: 13 }}>
        Composition
        {' '}
        {composition.type}
      </div>
    )
  }, [
    baseTextColor,
    borderColor,
    handleProposalResponse,
    handleVoteOnPoll,
    mutedTextColor,
    navigation,
    primaryColor,
  ])

  const renderMessageCard = useCallback((message) => {
    const senderName = getDisplayName(message?.sender)
    const isMine = areSameEntityId(message?.sender?.documentId, userData?.documentId)
    const attachments = Array.isArray(message?.attachments) ? message.attachments : []
    const shouldRenderAttachments = attachments.length > 0 && message?.composition?.type !== 'voice_note'
    const replyPreview = message?.replyTo
    const bubbleBackground = isMine ? 'rgba(1, 179, 244, 0.14)' : 'rgba(255, 255, 255, 0.04)'

    return (
      <div
        key={getMessageId(message)}
        style={{
          display: 'flex',
          justifyContent: isMine ? 'flex-end' : 'flex-start',
        }}
      >
        <div
          style={{
            background: bubbleBackground,
            border: `1px solid ${isMine ? 'rgba(1, 179, 244, 0.28)' : borderColor}`,
            borderRadius: 22,
            color: baseTextColor,
            display: 'grid',
            gap: 12,
            maxWidth: 'min(720px, 100%)',
            padding: 18,
            width: isDesktop ? 'auto' : '100%',
          }}
        >
          {!isMine ? (
            <div style={{ color: mutedTextColor, fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 12 }}>
              {senderName}
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
                {String(replyPreview?.message || '').trim() || 'Message partage'}
              </span>
            </div>
          ) : null}
          {String(message?.message || '').trim() ? (
            <div style={{ fontSize: 15, lineHeight: 1.5 }}>
              {String(message?.message || '').trim()}
            </div>
          ) : null}
          {shouldRenderAttachments ? renderAttachments(attachments) : null}
          {message?.composition ? renderComposition(message) : null}
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
              a
              {' '}
              {formatTime(message?.createdAt)}
              {message?.pending ? ' • envoi...' : ''}
              {message?.failed ? ' • a renvoyer' : ''}
            </span>
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
              Repondre
            </button>
          </div>
        </div>
      </div>
    )
  }, [
    baseTextColor,
    borderColor,
    isDesktop,
    mutedTextColor,
    primaryColor,
    renderAttachments,
    renderComposition,
    userData?.documentId,
  ])

  if (!chatId) {
    return (
      <ScreenContainer
        bgImage="bg2"
        contentWidth="full"
        responsivePadding
        style={{ paddingBottom: 32 }}
      >
        {renderStateCard({
          actionLabel: 'Voir mes messages',
          description: 'Aucune conversation n a ete selectionnee. Revenez a la liste des messages puis ouvrez une discussion.',
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
        style={{ paddingBottom: 32 }}
      >
        {renderStateCard({
          description: 'Chargement de la conversation en cours...',
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
        style={{ paddingBottom: 32 }}
      >
        {renderStateCard({
          actionLabel: 'R\u00E9essayer',
          description: getErrorMessage(chatError, 'Impossible de charger cette conversation.'),
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
        style={{ paddingBottom: 32 }}
      >
        {renderStateCard({
          actionLabel: 'Retour a mes messages',
          description: 'Cette conversation est introuvable ou vous n y avez plus acces.',
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
      style={{ paddingBottom: 32 }}
    >
      <div
        style={{
          color: baseTextColor,
          display: 'grid',
          gap: 24,
          gridTemplateColumns: isDesktop ? 'minmax(0, 1.5fr) minmax(320px, 420px)' : 'minmax(0, 1fr)',
          minHeight: isDesktop ? 'calc(100vh - 120px)' : 'auto',
        }}
      >
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
              <div style={{ display: 'grid', gap: 6 }}>
                <span style={{ color: mutedTextColor, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Messagerie
                </span>
                <h1 style={{ fontFamily: 'Montserrat-Black, sans-serif', fontSize: 28, margin: 0 }}>
                  {conversationName}
                </h1>
              </div>
              <span style={{
                background: isSocketConnected ? 'rgba(39, 214, 163, 0.15)' : 'rgba(255, 161, 21, 0.12)',
                border: `1px solid ${isSocketConnected ? 'rgba(39, 214, 163, 0.3)' : 'rgba(255, 161, 21, 0.26)'}`,
                borderRadius: 999,
                color: isSocketConnected ? '#27d6a3' : '#ffa115',
                fontFamily: 'Montserrat-Bold, sans-serif',
                fontSize: 12,
                padding: '8px 12px',
              }}
              >
                {isSocketConnected ? 'Socket actif' : 'Mode HTTP'}
              </span>
            </div>
            <div style={{ color: mutedTextColor, fontSize: 14 }}>
              {isChatLoading
                ? 'Chargement de la conversation...'
                : `${Array.isArray(chatData?.participants) ? chatData.participants.length : 0} participants`}
            </div>
          </header>

          <div
            ref={messagePaneRef}
            style={{
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
                {isFetchingNextPage ? 'Chargement...' : 'Afficher les messages precedents'}
              </button>
            ) : null}

            {isMessagesLoading ? (
              <div style={{ color: mutedTextColor }}>Chargement des messages...</div>
            ) : null}

            {!isMessagesLoading && messagesError ? (
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
                <div>{getErrorMessage(messagesError, 'Impossible de charger les messages de cette conversation.')}</div>
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
                  R\u00E9essayer
                </button>
              </div>
            ) : null}

            {!isMessagesLoading && !messagesError && messages.length === 0 ? (
              <div style={{ color: mutedTextColor }}>Aucun message pour le moment.</div>
            ) : null}

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
                    Reponse a {getDisplayName(replyTarget?.sender)}
                  </span>
                  <span style={{ color: baseTextColor, fontSize: 13 }}>
                    {String(replyTarget?.message || '').trim() || 'Message partage'}
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
              placeholder={t('conversation.placeholder', 'Ecris ton message...')}
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
                    : (isRecordingVoice ? 'Arreter la note vocale' : 'Note vocale')}
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
                ? 'Enregistrement en cours. Cliquez a nouveau pour envoyer la note vocale.'
                : (isVoiceRecordingSupported
                  ? 'Les notes vocales utilisent le microphone du navigateur.'
                  : 'Les notes vocales ne sont pas prises en charge par ce navigateur.')}
            </div>
          </div>
        </section>

        <aside style={{ display: 'grid', gap: 20 }}>
          <section style={{ background: panelBackground, border: `1px solid ${borderColor}`, borderRadius: 24, display: 'grid', gap: 14, padding: 22 }}>
            <h2 style={{ fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 18, margin: 0 }}>Partager</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <button onClick={handleShareLocation} style={{ background: 'transparent', border: `1px solid ${borderColor}`, borderRadius: 999, color: baseTextColor, cursor: 'pointer', padding: '10px 14px' }} type="button">Position</button>
              <button onClick={handlePickImage} style={{ background: 'transparent', border: `1px solid ${borderColor}`, borderRadius: 999, color: baseTextColor, cursor: 'pointer', padding: '10px 14px' }} type="button">Photo</button>
              <button onClick={handlePickDocument} style={{ background: 'transparent', border: `1px solid ${borderColor}`, borderRadius: 999, color: baseTextColor, cursor: 'pointer', padding: '10px 14px' }} type="button">Fichier</button>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              <h3 style={{ fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 14, margin: 0 }}>Contacts</h3>
              {shareableContacts.length === 0 ? (
                <div style={{ color: mutedTextColor, fontSize: 13 }}>Aucun contact partageable dans cette conversation.</div>
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
              <h3 style={{ fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 14, margin: 0 }}>Evenements</h3>
              {shareableEvents.length === 0 ? (
                <div style={{ color: mutedTextColor, fontSize: 13 }}>Aucun evenement recent a partager.</div>
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
                  <span style={{ fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 13 }}>{event?.name || 'Evenement'}</span>
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
            <h2 style={{ fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 18, margin: 0 }}>Sondage</h2>
            <input onChange={(event) => setPollQuestion(event.target.value)} placeholder="Question du sondage" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${borderColor}`, borderRadius: 14, color: baseTextColor, outline: 'none', padding: '12px 14px' }} value={pollQuestion} />
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
              {isSubmittingPoll ? 'Envoi...' : 'Envoyer le sondage'}
            </button>
          </section>

          {isLeagueConversation ? (
            <section style={{ background: panelBackground, border: `1px solid ${borderColor}`, borderRadius: 24, display: 'grid', gap: 12, padding: 22 }}>
              <h2 style={{ fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 18, margin: 0 }}>Proposition de match</h2>
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
                {isSubmittingProposal ? 'Envoi...' : 'Envoyer la proposition'}
              </button>
            </section>
          ) : null}

          <section style={{ background: panelBackground, border: `1px solid ${borderColor}`, borderRadius: 24, color: mutedTextColor, display: 'grid', gap: 8, padding: 22 }}>
            <h2 style={{ color: baseTextColor, fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 18, margin: 0 }}>Parite web</h2>
            <div style={{ fontSize: 13, lineHeight: 1.5 }}>
              Texte, reponse, pieces jointes, partages, sondages et propositions utilisent deja les hooks, services et sockets partages. Les notes vocales passent par le micro du navigateur quand il est compatible.
            </div>
          </section>
        </aside>
      </div>
    </ScreenContainer>
  )
}

export default Conversation
