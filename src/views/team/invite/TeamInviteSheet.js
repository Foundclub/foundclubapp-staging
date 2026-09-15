/**
 * TeamInviteSheet.js — « Inviter dans l'équipe » : la feuille, et tout ce qu'elle décide.
 *
 * Sortie de TeamDetails.js (6 347 lignes) au lot INVIT2 : chaque ajout dans la
 * fiche d'équipe coûtait une relecture de la fiche entière.
 *
 * 🧨 LA GÉOMÉTRIE — signalement d'Adel du 15/09 (iPhone, build 1311) : feuille
 * coupée en bas, qui ne défile pas, bouton de partage inatteignable. Cause
 * (mémoire du projet, BottomModal, payée aux lots R5 · S2 · D19) : un
 * `headerComponent` n'entre PAS dans la mesure de la feuille. La zone défilante
 * vaut exactement son contenu — donc rien ne défile — et la feuille est plus
 * courte que ce contenu de la hauteur du titre. D'où les trois contraintes :
 *   1. le titre est le PREMIER ENFANT du contenu (aucun en-tête fixe) ;
 *   2. le plafond se calcule sur la FENÊTRE (le composant le mesure sur la dalle
 *      entière, barres système comprises) ;
 *   3. les SORTIES (lien, numéro, QR) sont AVANT la liste : atteignables sans
 *      défiler, quelle que soit la longueur de la liste.
 * ⚠️ Jest ne calcule aucune mise en page : c'est l'émulateur qui tranche.
 *
 * 🧠 CE QUI LA REND « INTELLIGENTE » (INVIT2, décisions d'Adel du 15/09) :
 *   - qui proposer, et POURQUOI (demande, candidature, autre équipe, club) ;
 *   - jamais une impasse : lien, numéro, QR sont toujours là ;
 *   - l'inviteur suit ce qu'il a envoyé : état, annuler, renvoyer.
 * Les lectures ne partent QUE feuille ouverte : le corps (`TeamInviteSheetBody`)
 * n'est rendu que par la feuille visible.
 */
import { useMutation } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Dimensions,
  Text,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import {
  describePersonName,
  describeTeamInvitationRefusal,
} from '@/domains/team/teamInvitation';
import {
  describeSentInviteState,
  describeSuggestionReason,
  isPlausibleInvitePhone,
  selectSheetSuggestions,
} from '@/domains/team/teamInviteSuggestions';
import { withAlpha } from '@/theme/colors';
import localeDesFormats from '@/theme/strings/localeDesFormats';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import Input from '@/components/molecules/input/Input';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';

import {
  useSentTeamInvites,
  useTeamInviteSuggestions,
} from '@/services/teamInvite/teamInviteQueries';
import {
  cancelTeamInvite,
  createTeamInviteLink,
  createTeamPhoneInvite,
} from '@/services/teamInvite/teamInviteService';
import {
  buildTeamInviteMessage,
  buildTeamInviteUrl,
  openInviteSms,
  shareExistingTeamInvite,
} from '@/services/teamInvite/teamInviteShare';
import {
  acceptTeamMembershipRequest,
  inviteToTeam,
} from '@/services/teamMembershipRequest/teamMembershipRequestService';

/**
 * La fraction de DALLE que la zone défilante peut occuper pour valoir 85 % de
 * la FENÊTRE. Sur un écran où les deux se valent, c'est 0,85.
 * @returns {number} la fraction à passer à `maxContentHeightRatio`.
 */
const computeSheetCeiling = () => {
  const screenHeight = Dimensions.get('screen').height;
  const windowHeight = Dimensions.get('window').height;
  return screenHeight > 0
    ? Math.min(0.85, (windowHeight / screenHeight) * 0.85)
    : 0.85;
};

/**
 * « 15/10 » (ou « 15/10 » en anglais britannique).
 * @param {string} iso - la date.
 * @returns {string} jour et mois.
 */
const formatDayMonth = (iso) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(localeDesFormats(), { day: '2-digit', month: '2-digit' });
};

/**
 * Le corps de la feuille. Rendu seulement quand la feuille l'est.
 * @param {object} props - voir `TeamInviteSheet`.
 * @param {any} [props.clubData] - le club.
 * @param {string} [props.currentUserId] - moi.
 * @param {string} [props.inviterName] - mon prénom.
 * @param {boolean} props.isVisible - la feuille est-elle ouverte ?
 * @param {() => void} props.onShareLink - le partage d'un lien.
 * @param {any} [props.team] - l'équipe.
 * @param {string} [props.teamId] - l'identifiant de la route.
 * @returns {import('react').ReactElement} le contenu.
 */
function TeamInviteSheetBody({
  clubData,
  currentUserId,
  inviterName,
  isVisible,
  onShareLink,
  team,
  teamId,
}) {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = /** @type {any} */ (useTheme());
  const { t } = useTranslation();
  const invitedTeamId = String(team?.documentId || teamId || '').trim();

  const [search, setSearch] = useState('');
  // Optimiste : l'état « Invitation envoyée » d'une personne invitée pendant
  // que la feuille est ouverte.
  const [invitedMemberIds, setInvitedMemberIds] = useState(/** @type {string[]} */ ([]));
  const [isPhoneFormOpen, setIsPhoneFormOpen] = useState(false);
  const [phoneFirstname, setPhoneFirstname] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [qrCodeValue, setQrCodeValue] = useState('');

  // Une feuille qu'on rouvre repart d'une recherche vide.
  useEffect(() => {
    if (isVisible) setSearch('');
  }, [isVisible]);

  const readOptions = { enabled: isVisible };
  const suggestionsQuery = /** @type {any} */ (
    useTeamInviteSuggestions(invitedTeamId, readOptions)
  );
  const sentQuery = /** @type {any} */ (useSentTeamInvites(invitedTeamId, readOptions));

  const refreshLists = () => {
    suggestionsQuery?.refetch?.();
    sentQuery?.refetch?.();
  };

  // `inviteToTeam` poste sur POST /team-membership-requests/invite (lot P10) :
  // la ligne porte la personne INVITÉE et reste `pending` — personne n'entre
  // dans l'équipe sans avoir dit oui.
  const inviteMemberMutation = /** @type {any} */ (useMutation({
    // Un seul message par geste : la feuille dit elle-meme ce qui ne va pas.
    meta: { preventToastError: true },
    mutationFn: (/** @type {any} */ payload = {}) => inviteToTeam({
      team: payload.teamId,
      user: payload.userId,
      ...(payload.sourceApplication ? { sourceApplication: payload.sourceApplication } : {}),
    }),
    onError: (/** @type {any} */ echecInvitation) => {
      // 🗣️ Le serveur refuse en ANGLAIS : `describeTeamInvitationRefusal` est le
      // seul endroit qui traduit.
      Alert.alert(
        t('teamDetails.invite.errorTitle', 'Invitation impossible'),
        describeTeamInvitationRefusal(echecInvitation),
      );
    },
    onSuccess: (/** @type {any} */ _data, /** @type {any} */ variables) => {
      const invitedId = String(variables?.userId || '').trim();
      if (invitedId) {
        setInvitedMemberIds((previous) => (
          previous.includes(invitedId) ? previous : [...previous, invitedId]
        ));
      }
      Alert.alert(
        t('teamDetails.invite.sentTitle', 'Invitation envoyée'),
        t(
          'teamDetails.invite.sentMessage',
          '{{name}} va recevoir une notification. Elle rejoindra l\'équipe si elle accepte.',
          { name: variables?.userName || t('teamDetails.invite.someone', 'Cette personne') },
        ),
      );
      refreshLists();
    },
  }));

  // Accepter une DEMANDE (la personne a déjà dit oui en demandant) : route du
  // staff `accept`, qui la fait entrer.
  const acceptRequestMutation = /** @type {any} */ (useMutation({
    // Un seul message par geste : la feuille dit elle-meme ce qui ne va pas.
    meta: { preventToastError: true },
    mutationFn: (/** @type {any} */ payload = {}) => acceptTeamMembershipRequest(payload.requestId),
    onError: () => {
      Alert.alert(
        t('teamInviteSheet.acceptError.title', 'Impossible d\'accepter'),
        t(
          'teamInviteSheet.acceptError.body',
          'La demande n\'a pas pu être acceptée. Réessaie dans un instant.',
        ),
      );
    },
    onSuccess: (/** @type {any} */ _data, /** @type {any} */ variables) => {
      Alert.alert(
        t('teamInviteSheet.accepted.title', 'Demande acceptée'),
        t('teamInviteSheet.accepted.body', '{{name}} fait maintenant partie de l\'équipe.', {
          ...SANS_ECHAPPEMENT,
          name: variables?.userName || t('teamDetails.invite.someone', 'Cette personne'),
        }),
      );
      refreshLists();
    },
  }));

  const phoneInviteMutation = /** @type {any} */ (useMutation({
    // Un seul message par geste : la feuille dit elle-meme ce qui ne va pas.
    meta: { preventToastError: true },
    mutationFn: () => createTeamPhoneInvite({
      firstname: phoneFirstname.trim(),
      phoneNumber: phoneNumber.trim(),
      teamId: invitedTeamId,
    }),
    onError: (/** @type {any} */ error) => {
      const byCode = {
        TEAM_INVITE_DAILY_LIMIT: t(
          'teamInviteSheet.phone.errors.dailyLimit',
          'Tu as atteint la limite de 20 invitations par numéro sur 24 heures. Réessaie demain.',
        ),
        TEAM_INVITE_FIRSTNAME_REQUIRED: t(
          'teamInviteSheet.phone.errors.firstname',
          'Indique le prénom de la personne.',
        ),
        TEAM_INVITE_PHONE_INVALID: t(
          'teamInviteSheet.phone.errors.phone',
          'Ce numéro de téléphone n\'est pas valide.',
        ),
      };
      Alert.alert(
        t('teamDetails.invite.errorTitle', 'Invitation impossible'),
        byCode[String(error?.code || '')] || describeTeamInvitationRefusal(error),
      );
    },
    onSuccess: async (/** @type {any} */ result) => {
      if (result?.alreadyMember) {
        Alert.alert(
          t('teamInviteSheet.phone.alreadyMember.title', 'Déjà dans l\'équipe'),
          t(
            'teamInviteSheet.phone.alreadyMember.body',
            'Cette personne fait déjà partie de l\'équipe.',
          ),
        );
        return;
      }
      const code = String(result?.invite?.code || '');
      const url = buildTeamInviteUrl({ code, teamId: invitedTeamId }) || '';
      const message = buildTeamInviteMessage({
        clubName: team?.club?.name,
        inviterName,
        teamName: team?.name,
        url,
      });
      const number = phoneNumber.trim();
      setIsPhoneFormOpen(false);
      setPhoneFirstname('');
      setPhoneNumber('');
      refreshLists();
      // Le lien part DEPUIS le téléphone du staff : l'app n'envoie pas de SMS.
      // S'il a déjà un compte, la personne reçoit aussi une notification.
      await openInviteSms({ message, phoneNumber: number, url });
    },
  }));

  const qrLinkMutation = /** @type {any} */ (useMutation({
    // Un seul message par geste : la feuille dit elle-meme ce qui ne va pas.
    meta: { preventToastError: true },
    mutationFn: () => createTeamInviteLink(invitedTeamId),
    onError: () => {
      // Sans réseau, le QR porte le lien sans code : il ouvre l'équipe, en demande.
      setQrCodeValue(buildTeamInviteUrl({ teamId: invitedTeamId }) || '');
    },
    onSuccess: (/** @type {any} */ link) => {
      const url = buildTeamInviteUrl({ code: String(link?.code || ''), teamId: invitedTeamId });
      setQrCodeValue(url || '');
    },
  }));

  const cancelMutation = /** @type {any} */ (useMutation({
    // Un seul message par geste : la feuille dit elle-meme ce qui ne va pas.
    meta: { preventToastError: true },
    mutationFn: (/** @type {any} */ item) => cancelTeamInvite({ id: item.id, type: item.type }),
    onError: () => {
      Alert.alert(
        t('teamInviteSheet.cancelError.title', 'Impossible d\'annuler'),
        t('teamInviteSheet.cancelError.body', 'Cette invitation n\'est peut-être plus en attente.'),
      );
    },
    onSuccess: () => refreshLists(),
  }));

  const serverSuggestions = Array.isArray(suggestionsQuery?.data)
    ? suggestionsQuery.data
    : undefined;

  const suggestions = useMemo(() => selectSheetSuggestions({
    clubMembers: clubData?.members || [],
    currentUserId,
    invitedIds: invitedMemberIds,
    search,
    serverSuggestions,
    team,
  }), [clubData?.members, currentUserId, invitedMemberIds, search, serverSuggestions, team]);

  // Y a-t-il quelqu'un d'autre que moi au club ? C'est ce qui sépare « le club
  // est vide » de « tout le club est déjà dans l'équipe ».
  const hasOtherClubMembers = useMemo(() => (clubData?.members || []).some(
    (/** @type {any} */ member) => {
      const id = String(member?.documentId || '').trim();
      return Boolean(id) && id !== String(currentUserId || '').trim();
    },
  ), [clubData?.members, currentUserId]);

  // ⚖️ Quatre vides différents, quatre phrases différentes. « Personne d'autre
  // dans ton club » était VRAI mais inutile quand tout le club est déjà dans
  // l'équipe : il faisait croire à un club vide (constat d'Adel, 15/09).
  const empty = useMemo(() => {
    const linkExplanation = t(
      'teamDetails.invite.emptyExplanation',
      'Tu peux inviter directement les personnes déjà rattachées à ton club.'
      + ' Pour quelqu\'un d\'un autre club, envoie-lui plutôt un lien d\'invitation :'
      + ' il·elle pourra demander à rejoindre l\'équipe.',
    );
    if (clubData?.membersAreHidden === true && !serverSuggestions) {
      return {
        explanation: linkExplanation,
        message: t(
          'teamDetails.invite.emptyHidden',
          'Ce club masque ses membres : impossible de les proposer ici.',
        ),
      };
    }
    if (search.trim()) {
      return {
        explanation: linkExplanation,
        message: t('teamDetails.invite.emptySearch', 'Personne de ce nom dans ton club.'),
      };
    }
    if (hasOtherClubMembers) {
      return {
        explanation: t(
          'teamInviteSheet.empty.allInTeamExplanation',
          'Pour faire venir quelqu\'un de nouveau, partage-lui un lien d\'invitation'
          + ' juste au-dessus.',
        ),
        message: t('teamInviteSheet.empty.allInTeam', 'Tout ton club est déjà dans l\'équipe.'),
      };
    }
    return {
      explanation: linkExplanation,
      message: t(
        'teamDetails.invite.emptyClub',
        'Personne d\'autre dans ton club pour l\'instant.',
      ),
    };
  }, [clubData?.membersAreHidden, hasOtherClubMembers, search, serverSuggestions, t]);

  const handleInviteMember = (/** @type {any} */ candidate) => {
    const userId = String(candidate?.documentId || '').trim();
    if (!userId || !invitedTeamId || inviteMemberMutation.isPending) return;

    inviteMemberMutation.mutate({
      sourceApplication: candidate?.applicationId,
      teamId: invitedTeamId,
      userId,
      userName: describePersonName(candidate, t('teamDetails.invite.someone', 'Cette personne')),
    });
  };

  const handleAcceptRequest = (/** @type {any} */ candidate) => {
    if (!candidate?.requestId || acceptRequestMutation.isPending) return;
    acceptRequestMutation.mutate({
      requestId: candidate.requestId,
      userName: describePersonName(candidate, t('teamDetails.invite.someone', 'Cette personne')),
    });
  };

  const handleSendPhoneInvite = () => {
    if (phoneInviteMutation.isPending) return;
    if (!phoneFirstname.trim()) {
      Alert.alert(
        t('teamDetails.invite.errorTitle', 'Invitation impossible'),
        t('teamInviteSheet.phone.errors.firstname', 'Indique le prénom de la personne.'),
      );
      return;
    }
    if (!isPlausibleInvitePhone(phoneNumber)) {
      Alert.alert(
        t('teamDetails.invite.errorTitle', 'Invitation impossible'),
        t('teamInviteSheet.phone.errors.phone', 'Ce numéro de téléphone n\'est pas valide.'),
      );
      return;
    }
    phoneInviteMutation.mutate();
  };

  const handleToggleQr = () => {
    if (qrCodeValue) {
      setQrCodeValue('');
      return;
    }
    if (!qrLinkMutation.isPending) qrLinkMutation.mutate();
  };

  // Renvoyer = repartager le lien de CETTE invitation (son code) : la personne
  // visée reste reconnue quand elle l'ouvre. L'app ne garde pas le numéro.
  const handleResendPhone = (/** @type {any} */ item) => {
    shareExistingTeamInvite({
      clubName: team?.club?.name,
      code: String(item?.shareCode || ''),
      inviterName,
      teamId: invitedTeamId,
      teamName: team?.name,
    }).catch(() => undefined);
  };

  const sentInvites = Array.isArray(sentQuery?.data) ? sentQuery.data : [];

  const rowStyle = [
    ApplicationStyle.borderRadius16,
    Alignments.row,
    Alignments.alignCenter,
    Alignments.justifySpaceBetween,
    Spaces.gap[12],
    Spaces.padding[12],
    { backgroundColor: withAlpha(Colors.neutral00, 0.04) },
  ];

  return (
    <View style={[Spaces.gap[16], Spaces.paddingBottom[16]]}>
      {/* Le titre est le PREMIER enfant du contenu : c'est ce qui le fait
          entrer dans la mesure de la feuille (voir l'en-tête du fichier). */}
      <Text style={[Fonts.h5Bold, Fonts.neutral00, Spaces.marginTop[12]]}>
        {t('teamDetails.invite.sheetTitle', 'Inviter dans l\'équipe')}
      </Text>

      <Text style={[Fonts.p3, Fonts.neutral200]}>
        {t(
          'teamInviteSheet.intro',
          'Invite une personne de la liste, ou envoie un lien : la personne verra qui l\'invite'
          + ' et dans quelle équipe, et c\'est elle qui accepte.',
        )}
      </Text>

      {/* LES SORTIES, AVANT LA LISTE : toujours atteignables sans défiler. */}
      <Button
        onPress={onShareLink}
        title={t('teamDetails.actions.shareInviteLink', 'Partager un lien d\'invitation')}
        variant="SecondaryLight"
      />
      <View style={[Alignments.row, Spaces.gap[8]]}>
        <View style={[Alignments.fill]}>
          <Button
            onPress={() => setIsPhoneFormOpen((open) => !open)}
            size="sm"
            title={t('teamInviteSheet.phone.open', 'Par numéro')}
            variant="Ghost"
          />
        </View>
        <View style={[Alignments.fill]}>
          <Button
            isLoading={qrLinkMutation.isPending}
            onPress={handleToggleQr}
            size="sm"
            title={qrCodeValue
              ? t('teamInviteSheet.qr.hide', 'Masquer le QR code')
              : t('teamInviteSheet.qr.show', 'Montrer un QR code')}
            variant="Ghost"
          />
        </View>
      </View>

      {isPhoneFormOpen ? (
        <View
          style={[
            Spaces.gap[8],
            Spaces.padding[12],
            ApplicationStyle.borderRadius16,
            { backgroundColor: withAlpha(Colors.neutral00, 0.04) },
          ]}
        >
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
            {t('teamInviteSheet.phone.title', 'Inviter quelqu\'un qui n\'a pas l\'app')}
          </Text>
          <Input
            autoCapitalize="words"
            onChangeText={setPhoneFirstname}
            placeholder={t('teamInviteSheet.phone.firstnamePlaceholder', 'Prénom')}
            value={phoneFirstname}
          />
          <Input
            keyboardType="phone-pad"
            onChangeText={setPhoneNumber}
            placeholder={t('teamInviteSheet.phone.numberPlaceholder', 'Numéro de téléphone')}
            textContentType="telephoneNumber"
            value={phoneNumber}
          />
          <Text style={[Fonts.p4, Fonts.neutral300]}>
            {t(
              'teamInviteSheet.phone.privacy',
              'Un SMS part de ton téléphone avec le lien.'
              + ' Quand la personne crée son compte avec ce numéro, l\'invitation l\'attend.'
              + ' Le prénom et le numéro sont effacés à sa réponse, ou au bout de 30 jours.',
            )}
          </Text>
          <Button
            isLoading={phoneInviteMutation.isPending}
            onPress={handleSendPhoneInvite}
            size="sm"
            title={t('teamInviteSheet.phone.send', 'Envoyer l\'invitation')}
            variant="Primary"
          />
        </View>
      ) : null}

      {qrCodeValue ? (
        <View
          style={[
            Alignments.alignCenter,
            Spaces.gap[8],
            Spaces.padding[12],
            ApplicationStyle.borderRadius16,
            { backgroundColor: Colors.neutral00 },
          ]}
        >
          <QRCode
            backgroundColor={Colors.neutral00}
            color={Colors.primary900}
            size={168}
            value={qrCodeValue}
          />
          <Text style={[Fonts.p4, { color: Colors.primary900 }]}>
            {t(
              'teamInviteSheet.qr.caption',
              'Fais scanner ce code : la personne verra qui l\'invite.',
            )}
          </Text>
        </View>
      ) : null}

      <View
        style={{
          backgroundColor: withAlpha(Colors.neutral00, 0.08),
          height: 1,
        }}
      />

      <Input
        autoCapitalize="none"
        autoCorrect={false}
        enterKeyHint="search"
        icon="search"
        onChangeText={setSearch}
        placeholder={t('teamDetails.invite.searchPlaceholder', 'Rechercher un membre du club')}
        value={search}
      />

      {suggestions.length ? (
        <View style={[Spaces.gap[8]]}>
          {suggestions.map((/** @type {any} */ candidate) => {
            const reasonText = describeSuggestionReason(candidate, formatDayMonth);
            const isRequest = candidate?.reason === 'requested' && Boolean(candidate?.requestId);
            return (
              <View key={candidate.documentId} style={rowStyle}>
                <View
                  style={[
                    Alignments.row,
                    Alignments.alignCenter,
                    Spaces.gap[12],
                    { flex: 1 },
                  ]}
                >
                  <ProfileAvatar
                    imageStyle={{ borderRadius: 36 }}
                    imageUrl={candidate?.avatar?.url}
                    size={36}
                  />
                  <View style={[Alignments.fill]}>
                    <Text numberOfLines={1} style={[Fonts.p2Bold, Fonts.neutral00]}>
                      {describePersonName(candidate)}
                    </Text>
                    {reasonText ? (
                      <Text numberOfLines={2} style={[Fonts.p4, Fonts.neutral400]}>
                        {reasonText}
                      </Text>
                    ) : null}
                  </View>
                </View>
                {candidate.hasPendingInvitation ? (
                  <Text style={[Fonts.p4Bold, Fonts.primary500]}>
                    {t('teamDetails.invite.sentBadge', 'Invitation envoyée')}
                  </Text>
                ) : (
                  <Button
                    disabled={isRequest
                      ? acceptRequestMutation.isPending
                      : inviteMemberMutation.isPending}
                    onPress={() => (isRequest
                      ? handleAcceptRequest(candidate)
                      : handleInviteMember(candidate))}
                    size="sm"
                    title={isRequest
                      ? t('teamInviteSheet.acceptRequest', 'Accepter')
                      : t('teamDetails.invite.action', 'Inviter')}
                    variant="Primary"
                  />
                )}
              </View>
            );
          })}
        </View>
      ) : (
        // ⛔ JAMAIS un vide muet : on dit pourquoi la liste est vide, et les
        // sorties sont déjà au-dessus, dans la même feuille.
        <View style={[Spaces.gap[8]]}>
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{empty.message}</Text>
          <Text style={[Fonts.p3, Fonts.neutral300]}>{empty.explanation}</Text>
        </View>
      )}

      {sentInvites.length ? (
        <View style={[Spaces.gap[8]]}>
          <Text style={[Fonts.p1Bold, Fonts.neutral00, Spaces.marginTop[8]]}>
            {t('teamInviteSheet.sent.title', 'Invitations envoyées')}
          </Text>
          {sentInvites.map((/** @type {any} */ item) => {
            const name = String(item?.name || '').trim()
              || t('teamInviteSheet.sent.unnamed', 'Invitation par numéro');
            const label = item?.phoneHint
              ? t('teamInviteSheet.sent.nameWithHint', '{{name}} · •• {{hint}}', {
                ...SANS_ECHAPPEMENT,
                hint: item.phoneHint,
                name,
              })
              : name;
            return (
              <View key={`${item.type}-${item.id}`} style={rowStyle}>
                <View style={[Alignments.fill]}>
                  <Text numberOfLines={1} style={[Fonts.p2Bold, Fonts.neutral00]}>{label}</Text>
                  <Text numberOfLines={1} style={[Fonts.p4, Fonts.neutral400]}>
                    {describeSentInviteState(item, formatDayMonth)}
                  </Text>
                </View>
                {item?.canCancel ? (
                  <View style={[Alignments.row, Spaces.gap[8]]}>
                    {item.type === 'phone' ? (
                      <Button
                        onPress={() => handleResendPhone(item)}
                        size="sm"
                        title={t('teamInviteSheet.sent.resend', 'Renvoyer')}
                        variant="Ghost"
                      />
                    ) : null}
                    <Button
                      disabled={cancelMutation.isPending}
                      onPress={() => cancelMutation.mutate(item)}
                      size="sm"
                      title={t('teamInviteSheet.sent.cancel', 'Annuler')}
                      variant="Ghost"
                    />
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

/**
 * La feuille « Inviter dans l'équipe ».
 * @param {object} props - les propriétés.
 * @param {() => void} props.close - ferme la feuille.
 * @param {any} [props.clubData] - le club, déjà chargé par la fiche d'équipe.
 * @param {string} [props.currentUserId] - moi : on ne s'invite pas soi-même.
 * @param {string} [props.inviterName] - mon prénom, pour le message envoyé.
 * @param {boolean} props.isVisible - la feuille est-elle ouverte ?
 * @param {() => void} props.onShareLink - ouvre le partage d'un lien d'invitation.
 * @param {any} [props.team] - l'équipe.
 * @param {string} [props.teamId] - l'identifiant de la route, si l'équipe n'est pas encore là.
 * @returns {import('react').ReactElement} la feuille.
 */
function TeamInviteSheet({
  close,
  clubData,
  currentUserId,
  inviterName,
  isVisible,
  onShareLink,
  team,
  teamId,
}) {
  return (
    <BottomModal
      close={close}
      isVisible={isVisible}
      maxContentHeightRatio={computeSheetCeiling()}
    >
      <TeamInviteSheetBody
        clubData={clubData}
        currentUserId={currentUserId}
        inviterName={inviterName}
        isVisible={isVisible}
        onShareLink={onShareLink}
        team={team}
        teamId={teamId}
      />
    </BottomModal>
  );
}

export default TeamInviteSheet;
