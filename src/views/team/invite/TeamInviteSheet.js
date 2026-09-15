/**
 * TeamInviteSheet.js — « Inviter dans l'équipe » : la feuille, et tout ce qu'elle décide.
 *
 * Sortie de TeamDetails.js (6 347 lignes) au lot INVIT2 : la feuille va grandir
 * (propositions, invitations envoyées, invitation par numéro) et chaque ajout
 * dans la fiche d'équipe coûtait une relecture de la fiche entière.
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
 *   3. la sortie (partager un lien) est AVANT la liste : atteignable sans défiler,
 *      quelle que soit la longueur de la liste.
 * ⚠️ Jest ne calcule aucune mise en page : c'est l'émulateur qui tranche.
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

import {
  describePersonName,
  describeTeamInvitationRefusal,
  selectInvitableCandidates,
} from '@/domains/team/teamInvitation';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import Input from '@/components/molecules/input/Input';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';

import { inviteToTeam } from '@/services/teamMembershipRequest/teamMembershipRequestService';

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
 * La feuille « Inviter dans l'équipe ».
 * @param {object} props - les propriétés.
 * @param {() => void} props.close - ferme la feuille.
 * @param {any} [props.clubData] - le club, déjà chargé par la fiche d'équipe.
 * @param {string} [props.currentUserId] - moi : on ne s'invite pas soi-même.
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
  isVisible,
  onShareLink,
  team,
  teamId,
}) {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = /** @type {any} */ (useTheme());
  const { t } = useTranslation();

  const [search, setSearch] = useState('');
  // Optimiste : l'état « Invitation envoyée » d'une personne invitée pendant
  // que la feuille est ouverte.
  const [invitedMemberIds, setInvitedMemberIds] = useState(/** @type {string[]} */ ([]));

  // Une feuille qu'on rouvre repart d'une recherche vide.
  useEffect(() => {
    if (isVisible) setSearch('');
  }, [isVisible]);

  // `inviteToTeam` poste sur POST /team-membership-requests/invite (lot P10) :
  // la ligne porte la personne INVITÉE et reste `pending` — personne n'entre
  // dans l'équipe sans avoir dit oui.
  const inviteMemberMutation = /** @type {any} */ (useMutation({
    mutationFn: (/** @type {any} */ payload = {}) => inviteToTeam({
      team: payload.teamId,
      user: payload.userId,
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
    },
  }));

  const selectionParams = useMemo(() => ({
    alreadyInvitedIds: invitedMemberIds,
    candidates: clubData?.members || [],
    currentUserId,
    players: team?.players || [],
    trainers: team?.trainers || [],
  }), [clubData?.members, currentUserId, invitedMemberIds, team?.players, team?.trainers]);

  const candidates = useMemo(
    () => selectInvitableCandidates({ ...selectionParams, search }),
    [search, selectionParams],
  );

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
    if (clubData?.membersAreHidden === true) {
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
  }, [clubData?.membersAreHidden, hasOtherClubMembers, search, t]);

  const handleInviteMember = (/** @type {any} */ candidate) => {
    const userId = String(candidate?.documentId || '').trim();
    const invitedTeamId = team?.documentId || teamId;
    if (!userId || !invitedTeamId || inviteMemberMutation.isPending) return;

    inviteMemberMutation.mutate({
      teamId: invitedTeamId,
      userId,
      userName: describePersonName(candidate, t('teamDetails.invite.someone', 'Cette personne')),
    });
  };

  return (
    <BottomModal
      close={close}
      isVisible={isVisible}
      maxContentHeightRatio={computeSheetCeiling()}
    >
      <View style={[Spaces.gap[16], Spaces.paddingBottom[16]]}>
        {/* Le titre est le PREMIER enfant du contenu : c'est ce qui le fait
            entrer dans la mesure de la feuille (voir l'en-tête du fichier). */}
        <Text style={[Fonts.h5Bold, Fonts.neutral00, Spaces.marginTop[12]]}>
          {t('teamDetails.invite.sheetTitle', 'Inviter dans l\'équipe')}
        </Text>

        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {t(
            'teamDetails.invite.sheetIntro',
            'Choisis une personne de ton club :'
            + ' elle reçoit une invitation, et c\'est elle qui accepte.',
          )}
        </Text>

        {/* LA SORTIE, AVANT LA LISTE : toujours atteignable sans défiler. */}
        <Button
          onPress={onShareLink}
          title={t('teamDetails.actions.shareInviteLink', 'Partager un lien d\'invitation')}
          variant="SecondaryLight"
        />

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

        {candidates.length ? (
          <View style={[Spaces.gap[8]]}>
            {candidates.map((/** @type {any} */ candidate) => (
              <View
                key={candidate.documentId}
                style={[
                  ApplicationStyle.borderRadius16,
                  Alignments.row,
                  Alignments.alignCenter,
                  Alignments.justifySpaceBetween,
                  Spaces.gap[12],
                  Spaces.padding[12],
                  { backgroundColor: withAlpha(Colors.neutral00, 0.04) },
                ]}
              >
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
                    {candidate?.role?.name ? (
                      <Text numberOfLines={1} style={[Fonts.p4, Fonts.neutral400]}>
                        {candidate.role.name}
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
                    disabled={inviteMemberMutation.isPending}
                    onPress={() => handleInviteMember(candidate)}
                    size="sm"
                    title={t('teamDetails.invite.action', 'Inviter')}
                    variant="Primary"
                  />
                )}
              </View>
            ))}
          </View>
        ) : (
          // ⛔ JAMAIS un vide muet : on dit pourquoi la liste est vide, et la
          // sortie est déjà au-dessus, dans la même feuille.
          <View style={[Spaces.gap[8]]}>
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{empty.message}</Text>
            <Text style={[Fonts.p3, Fonts.neutral300]}>{empty.explanation}</Text>
          </View>
        )}
      </View>
    </BottomModal>
  );
}

export default TeamInviteSheet;
