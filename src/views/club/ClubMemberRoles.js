import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  FlatList,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  buildMemberRoleChange,
  filterMembersByName,
  hasMemberRole,
  memberRoleChangeNeedsConfirmation,
  sortMembersForDisplay,
} from '@/domains/clubMemberRoles/clubMemberRoles';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import SearchBar from '@/components/molecules/searchBar/SearchBar';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import ScreenContainer from '@/components/templates/ScreenContainer';
import ClubStateView from '@/views/club/components/ClubStateView';

import {
  useClubMemberRoles,
  useUpdateClubMemberRole,
} from '@/services/club/clubMemberRolesQueries';

import { displayErrorAlert } from '@/utils/errors/displayError';

/**
 * LOT RÔLES (demande d'Adel du 2026-09-28) — « sélectionner chaque membre qui
 * appartient à un club et lui attribuer un rôle, surtout joueur ».
 *
 * Réservé au dirigeant du club (porte depuis le hub de la fiche club, et juge
 * serveur `is-club-manager`). Chaque membre se déplie sur trois rangées :
 * joueur de…, entraîneur de…, co-dirigeant. Un appui donne le rôle, un second
 * le retire ; les retraits et les promotions se confirment.
 */

/** @typedef {import('@/domains/clubMemberRoles/clubMemberRoles').MemberRoleChange} Change */
/** @typedef {import('@/domains/clubMemberRoles/clubMemberRoles').MemberRoleKind} RoleKind */
/** @typedef {{ documentId: string, name: string }} TeamRef */

/** @type {TeamRef[]} */
const EMPTY_TEAMS = [];

/**
 * Un paramètre de route exploitable, ou '' (un gabarit web « :clubId » n'en est pas un).
 * @param {unknown} value - Le paramètre brut.
 * @returns {string} La valeur nettoyée.
 */
const sanitizeRouteParam = (value) => {
  const normalizedValue = String(value || '').trim();
  if (!normalizedValue || normalizedValue.startsWith(':')) {
    return '';
  }
  return normalizedValue;
};

/** @typedef {import('@/domains/clubMemberRoles/clubMemberRoles').ClubMemberRoleRow} Row */

/**
 * Le nom affiché d'un membre.
 * @param {Row} member - Le membre.
 * @returns {string} Son nom affiché.
 */
const getMemberName = (member) => [member?.firstname, member?.lastname]
  .filter(Boolean)
  .join(' ')
  .trim();

/**
 * L'écran « Membres et rôles » du dirigeant.
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - Props de pile.
 * @returns {import('react').ReactElement} L'écran.
 */
function ClubMemberRoles({ route }) {
  const clubId = sanitizeRouteParam(route?.params?.clubId);
  const { t } = useTranslation();
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const [query, setQuery] = useState('');
  const [openMemberId, setOpenMemberId] = useState('');

  const {
    data,
    error,
    isLoading,
    refetch,
  } = useClubMemberRoles(clubId);
  const updateMutation = useUpdateClubMemberRole(clubId);

  /** @type {TeamRef[]} */
  const teams = data?.teams || EMPTY_TEAMS;
  const teamNameById = useMemo(
    () => new Map(teams.map((team) => [team.documentId, team.name])),
    [teams],
  );
  const members = useMemo(
    () => filterMembersByName(sortMembersForDisplay(data?.members), query),
    [data?.members, query],
  );
  // ÉCRAN 2 — le lecteur lui-même, s'il encadre : c'est lui que la carte
  // « Tu joues aussi ? » met joueur d'une équipe, sans rien lui retirer.
  /** @type {Row | null} */
  const self = useMemo(
    () => (Array.isArray(data?.members) ? data.members : [])
      .find((/** @type {Row} */ member) => member?.isSelf) || null,
    [data?.members],
  );
  const showsSelfPlayerCard = Boolean(self) && teams.length > 0 && (
    self?.isManager === true || self?.roleKey === 'coach' || self?.roleKey === 'president'
  );

  const describeRoles = useCallback((/** @type {Row} */ member) => {
    const teamNames = (/** @type {string[]} */ ids) => (ids || [])
      .map((id) => teamNameById.get(id))
      .filter(Boolean)
      .join(', ');
    const lines = [];
    if (member?.isManager) lines.push(t('clubMemberRoles.roles.manager', 'Dirigeant'));
    if (member?.trainerTeamIds?.length) {
      lines.push(t('clubMemberRoles.roles.coachOf', 'Coach / Prof · {{teams}}', {
        teams: teamNames(member.trainerTeamIds),
        ...SANS_ECHAPPEMENT,
      }));
    }
    if (member?.playerTeamIds?.length) {
      lines.push(t('clubMemberRoles.roles.playerOf', 'Pratiquant / Joueur · {{teams}}', {
        teams: teamNames(member.playerTeamIds),
        ...SANS_ECHAPPEMENT,
      }));
    }
    if (lines.length) return lines.join('  ·  ');
    return t('clubMemberRoles.roles.none', 'Aucun rôle d\'équipe');
  }, [t, teamNameById]);

  const submitChange = useCallback((/** @type {Change} */ change) => {
    updateMutation.mutate(change, {
      onError: (/** @type {any} */ mutationError) => displayErrorAlert(mutationError),
    });
  }, [updateMutation]);

  const confirmationText = useCallback((
    /** @type {Change} */ change,
    /** @type {Row} */ member,
  ) => {
    const values = {
      name: getMemberName(member) || t('clubMemberRoles.fallbacks.member', 'Ce membre'),
      team: teamNameById.get(String(change.teamDocumentId || ''))
        || t('clubMemberRoles.fallbacks.team', 'cette équipe'),
      ...SANS_ECHAPPEMENT,
    };
    const key = `${change.role}.${change.action}`;
    /** @type {Record<string, string[]>} */
    const texts = {
      'coach.add': [
        t('clubMemberRoles.confirm.coachAdd.title', 'Nommer entraîneur ?'),
        t(
          'clubMemberRoles.confirm.coachAdd.message',
          '{{name}} deviendra entraîneur de {{team}}. Son compte prendra le rôle Coach / Prof.',
          values,
        ),
      ],
      'coach.remove': [
        t('clubMemberRoles.confirm.coachRemove.title', 'Retirer l\'entraîneur ?'),
        t(
          'clubMemberRoles.confirm.coachRemove.message',
          '{{name}} ne sera plus entraîneur de {{team}}. Son compte et son historique restent.',
          values,
        ),
      ],
      'manager.add': [
        t('clubMemberRoles.confirm.managerAdd.title', 'Nommer co-dirigeant ?'),
        t(
          'clubMemberRoles.confirm.managerAdd.message',
          '{{name}} deviendra dirigeant du club : il pourra tout gérer, comme toi.',
          values,
        ),
      ],
      'manager.remove': [
        t('clubMemberRoles.confirm.managerRemove.title', 'Retirer le co-dirigeant ?'),
        t(
          'clubMemberRoles.confirm.managerRemove.message',
          '{{name}} ne sera plus dirigeant du club. Son compte, ses équipes et son '
            + 'historique restent.',
          values,
        ),
      ],
      'player.remove': [
        t('clubMemberRoles.confirm.playerRemove.title', 'Retirer le joueur ?'),
        t(
          'clubMemberRoles.confirm.playerRemove.message',
          '{{name}} ne sera plus joueur de {{team}}. Son compte et son historique restent.',
          values,
        ),
      ],
    };
    if (member?.isSelf && key === 'player.remove') {
      return [
        t('clubMemberRoles.confirm.selfPlayerRemove.title', 'Ne plus jouer ?'),
        t(
          'clubMemberRoles.confirm.selfPlayerRemove.message',
          'Tu ne seras plus joueur de {{team}}. Ton historique reste.',
          values,
        ),
      ];
    }
    return texts[key] || [t('common.actions.confirm', 'Confirmer'), ''];
  }, [t, teamNameById]);

  const handleToggle = useCallback((
    /** @type {Row} */ member,
    /** @type {RoleKind} */ role,
    /** @type {string} */ teamId = '',
  ) => {
    if (updateMutation.isPending) return;
    const change = buildMemberRoleChange(member, role, teamId);
    if (!memberRoleChangeNeedsConfirmation(change, member)) {
      submitChange(change);
      return;
    }
    const [title, message] = confirmationText(change, member);
    Alert.alert(title, message, [
      { style: 'cancel', text: t('common.actions.cancel', 'Annuler') },
      {
        onPress: () => submitChange(change),
        style: change.action === 'remove' ? 'destructive' : 'default',
        text: t('clubMemberRoles.confirm.action', 'Confirmer'),
      },
    ]);
  }, [confirmationText, submitChange, t, updateMutation.isPending]);

  const renderChip = useCallback((
    /** @type {{ checked: boolean, label: string, onPress: () => void, testID: string }} */ {
      checked, label, onPress, testID,
    },
  ) => (
    <TouchableOpacity
      accessibilityLabel={label}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled: updateMutation.isPending }}
      disabled={updateMutation.isPending}
      key={testID}
      onPress={onPress}
      style={[
        ApplicationStyle.borderRadius12,
        ApplicationStyle.borderWidth1,
        Spaces.paddingHorizontal[12],
        Spaces.paddingVertical[8],
        checked
          ? ApplicationStyle.backgroundColor.primary500
          : ApplicationStyle.backgroundColor.transparent,
        { borderColor: Colors.primary500 },
      ]}
      testID={testID}
    >
      <Text style={[Fonts.p3Bold, checked ? Fonts.primary900 : Fonts.neutral00]}>
        {label}
      </Text>
    </TouchableOpacity>
  ), [
    ApplicationStyle.backgroundColor.primary500,
    ApplicationStyle.backgroundColor.transparent,
    ApplicationStyle.borderRadius12,
    ApplicationStyle.borderWidth1,
    Colors.primary500,
    Fonts.neutral00,
    Fonts.p3Bold,
    Fonts.primary900,
    Spaces.paddingHorizontal,
    Spaces.paddingVertical,
    updateMutation.isPending,
  ]);

  const renderTeamRow = useCallback((
    /** @type {Row} */ member,
    /** @type {RoleKind} */ role,
    /** @type {string} */ title,
  ) => (
    <View style={[Spaces.gap[8]]}>
      <Text style={[Fonts.p3, Fonts.neutral200]}>{title}</Text>
      {/* ROLES2 — cases EMPILÉES, chacune sur toute la largeur. Sur Android 16, une
          case rétrécie à la largeur MESURÉE de son texte perdait le nom de
          l'équipe (dessiné plus large, il passait sur une ligne invisible). */}
      <View style={[Spaces.gap[8]]}>
        {teams.map((team) => renderChip({
          checked: hasMemberRole(member, role, team.documentId),
          label: role === 'player'
            ? t('clubMemberRoles.chips.playerOf', 'Pratiquant / Joueur de {{team}}', {
              team: team.name,
              ...SANS_ECHAPPEMENT,
            })
            : t('clubMemberRoles.chips.coachOf', 'Coach / Prof de {{team}}', {
              team: team.name,
              ...SANS_ECHAPPEMENT,
            }),
          onPress: () => handleToggle(member, role, team.documentId),
          testID: `member-role-${member.documentId}-${role}-${team.documentId}`,
        }))}
      </View>
    </View>
  ), [
    Fonts.neutral200,
    Fonts.p3,
    Spaces.gap,
    handleToggle,
    renderChip,
    t,
    teams,
  ]);

  const renderMemberActions = useCallback((/** @type {Row} */ member) => {
    // Un compte Parent ou SuperAdmin ne change pas de rôle par cette porte
    // (refus serveur MEMBER_ROLE_PROTECTED_ACCOUNT) : on n'en propose que la place de joueur.
    const canHoldStaffRoles = member.roleKey !== 'parent' && member.roleKey !== 'superAdmin';
    return (
      <View style={[Spaces.gap[16], Spaces.marginTop[16]]}>
        {teams.length === 0 ? (
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            {t('clubMemberRoles.empty.teams', 'Ce club n\'a pas encore d\'équipe.')}
          </Text>
        ) : null}
        {teams.length
          ? renderTeamRow(
            member,
            'player',
            t('clubMemberRoles.sections.player', 'Pratiquant / Joueur de'),
          )
          : null}
        {teams.length && canHoldStaffRoles
          ? renderTeamRow(member, 'coach', t('clubMemberRoles.sections.coach', 'Coach / Prof de'))
          : null}
        {canHoldStaffRoles && !(member.isSelf && member.isManager) ? (
          <View style={[Spaces.gap[8]]}>
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              {t('clubMemberRoles.sections.manager', 'Direction du club')}
            </Text>
            <View>
              {renderChip({
                checked: member.isManager === true,
                label: t('clubMemberRoles.chips.manager', 'Co-dirigeant'),
                onPress: () => handleToggle(member, 'manager'),
                testID: `member-role-${member.documentId}-manager`,
              })}
            </View>
          </View>
        ) : null}
      </View>
    );
  }, [
    Fonts.neutral200,
    Fonts.p2,
    Fonts.p3,
    Spaces.gap,
    Spaces.marginTop,
    handleToggle,
    renderChip,
    renderTeamRow,
    t,
    teams.length,
  ]);

  const renderSelfPlayerCard = () => {
    if (!showsSelfPlayerCard || !self) return null;
    return (
      <View
        style={[
          ApplicationStyle.backgroundColor.primary700,
          ApplicationStyle.borderRadius24,
          ApplicationStyle.borderWidth1,
          Spaces.gap[12],
          Spaces.padding[16],
          { borderColor: Colors.primary500 },
        ]}
        testID="self-player-card"
      >
        <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
          {t('clubMemberRoles.selfCard.title', 'Tu joues aussi ?')}
        </Text>
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          {t(
            'clubMemberRoles.selfCard.description',
            'Mets-toi joueur d\'une équipe : tu seras convoqué comme les autres et tu '
              + 'répondras présent ou absent. Tu gardes tous tes droits.',
          )}
        </Text>
        {/* ROLES2 — empilées, comme les cases des membres (voir plus haut). */}
        <View style={[Spaces.gap[8]]}>
          {teams.map((team) => renderChip({
            checked: hasMemberRole(self, 'player', team.documentId),
            label: t('clubMemberRoles.selfCard.chip', 'Je joue en {{team}}', {
              team: team.name,
              ...SANS_ECHAPPEMENT,
            }),
            onPress: () => handleToggle(self, 'player', team.documentId),
            testID: `self-player-${team.documentId}`,
          }))}
        </View>
        {self.playerTeamIds?.length ? (
          <Text style={[Fonts.p3, Fonts.primary100]} testID="self-player-mode-hint">
            {t(
              'clubMemberRoles.selfCard.modeHint',
              'Pour voir l\'app comme un joueur de ton équipe : Accueil, puis '
                + '« Voir l\'app en joueur ».',
            )}
          </Text>
        ) : null}
      </View>
    );
  };

  const renderItem = useCallback((/** @type {{ item: Row }} */ { item }) => {
    const name = getMemberName(item) || t('clubMemberRoles.fallbacks.member', 'Ce membre');
    const isOpen = openMemberId === item.documentId;
    return (
      <View
        style={[
          ApplicationStyle.backgroundColor.primary700,
          ApplicationStyle.borderRadius24,
          ApplicationStyle.borderWidth1,
          Spaces.marginBottom[12],
          Spaces.padding[16],
          { borderColor: isOpen ? Colors.primary500 : `${Colors.primary500}33` },
        ]}
      >
        <TouchableOpacity
          accessibilityLabel={t('clubMemberRoles.a11y.openMember', 'Gérer les rôles de {{name}}', {
            name,
            ...SANS_ECHAPPEMENT,
          })}
          accessibilityRole="button"
          accessibilityState={{ expanded: isOpen }}
          onPress={() => setOpenMemberId(isOpen ? '' : item.documentId)}
          style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12]]}
          testID={`member-row-${item.documentId}`}
        >
          <ProfileAvatar
            enablePreview={false}
            imageUrl={item.avatarUrl || undefined}
            name={name}
            size={40}
          />
          <View style={[Alignments.fill, Spaces.gap[4]]}>
            <Text numberOfLines={1} style={[Fonts.p1Bold, Fonts.neutral00]}>
              {item.isSelf
                ? t('clubMemberRoles.self', '{{name}} (toi)', { name, ...SANS_ECHAPPEMENT })
                : name}
            </Text>
            <Text numberOfLines={2} style={[Fonts.p3, Fonts.primary100]}>
              {describeRoles(item)}
            </Text>
          </View>
        </TouchableOpacity>
        {isOpen ? renderMemberActions(item) : null}
      </View>
    );
  }, [
    Alignments.alignCenter,
    Alignments.fill,
    Alignments.row,
    ApplicationStyle.backgroundColor.primary700,
    ApplicationStyle.borderRadius24,
    ApplicationStyle.borderWidth1,
    Colors.primary500,
    Fonts.neutral00,
    Fonts.p1Bold,
    Fonts.p3,
    Fonts.primary100,
    Spaces.gap,
    Spaces.marginBottom,
    Spaces.padding,
    describeRoles,
    openMemberId,
    renderMemberActions,
    t,
  ]);

  if (!clubId) {
    return (
      <ClubStateView
        description={t(
          'clubMemberRoles.state.missingClub.description',
          'Impossible d\'ouvrir les membres sans club valide. Reviens à la fiche du club.',
        )}
        title={t('clubMemberRoles.state.missingClub.title', 'Club introuvable')}
      />
    );
  }

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[Alignments.fill, Spaces.paddingBottom[24]]}
    >
      <WithDataWrapper
        error={error?.message}
        isLoading={isLoading}
        onRetry={refetch}
        wrapperStyle={[Alignments.fill]}
      >
        <FlatList
          data={members}
          keyExtractor={(item) => item.documentId}
          ListEmptyComponent={(
            <Text style={[Fonts.p2, Fonts.neutral200, Fonts.textCenter, Spaces.marginTop[24]]}>
              {query
                ? t('clubMemberRoles.empty.search', 'Aucun membre ne correspond à cette recherche.')
                : t('clubMemberRoles.empty.members', 'Aucun membre dans ce club pour le moment.')}
            </Text>
          )}
          ListHeaderComponent={(
            <View style={[Spaces.gap[12], Spaces.marginBottom[16]]}>
              {renderSelfPlayerCard()}
              <Text style={[Fonts.p2, Fonts.neutral200]}>
                {t(
                  'clubMemberRoles.intro',
                  // eslint-disable-next-line max-len
                  'Touche un membre pour lui donner un rôle : pratiquant / joueur ou coach / prof d\'une équipe, ou co-dirigeant. Un membre peut en cumuler plusieurs.',
                )}
              </Text>
              <SearchBar
                onChangeText={setQuery}
                placeholder={t('clubMemberRoles.search', 'Rechercher un membre')}
                value={query}
              />
            </View>
          )}
          renderItem={renderItem}
        />
      </WithDataWrapper>
    </ScreenContainer>
  );
}

export default ClubMemberRoles;
