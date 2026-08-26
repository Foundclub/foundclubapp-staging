import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Checkbox from '@/components/atoms/checkbox/Checkbox';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';

import { getTeams } from '@/services/team/teamService';

import { useEventWizard } from '../EventWizardContext';
import useEventWizardAudiences, { getAudienceTeamId } from '../useEventWizardAudiences';
import EventWizardTeamCard from './EventWizardTeamCard';

const getUserDisplayName = (/** @type {any} */ user) => (
  `${String(user?.firstname || '').trim()} ${String(user?.lastname || '').trim()}`.trim()
  || String(user?.username || '').trim()
  || 'Membre'
);

const uniqueUsers = (/** @type {any[]} */ users = []) => {
  const map = new Map();
  users.forEach((user) => {
    const key = getAudienceTeamId(user);
    if (!key || map.has(key)) return;
    map.set(key, user);
  });
  return Array.from(map.values());
};

const buildRosterFromTeam = (/** @type {any} */ team) => uniqueUsers([
  ...(Array.isArray(team?.players) ? team.players : []),
  ...(Array.isArray(team?.trainers) ? team.trainers : []),
  ...(Array.isArray(team?.members) ? team.members : []),
]);

/**
 * INVITER DES MEMBRES D'UNE EQUIPE DE MON CLUB — S10-B (cadre d'Adel du
 * 2026-08-25 : « une SEULE etape pour choisir qui vient »).
 *
 * 🧭 Ce bloc vivait dans `EventWizardInvites`, un ecran a part qu'on ne
 * rejoignait qu'apres avoir tout regle. Il est desormais une SECTION de l'etape
 * « Participants » — le seul endroit ou l'on repond a « qui vient ? ». Ni la
 * donnee ni les gestes n'ont bouge : meme `teamAudiences`, meme feuille
 * « tout le groupe / certains membres », meme statut `ACCEPTED` (une equipe de
 * mon club embarque sans avoir a accepter).
 *
 * ⛔ AUCUN EXTERNE ICI. Les equipes d'un autre club se convient uniquement sur
 * un MATCH, depuis l'etape « Contre qui ? » — voir `EventWizardOpponentInvite`.
 * @param {{ surfaceStyle: any }} props La surface de carte de l'etape hote.
 * @returns {import('react').ReactElement} La section rendue.
 */
function EventWizardInternalInvites({ surfaceStyle }) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { userData } = useAuth();
  const { state } = useEventWizard();
  const { internalAudiences, setInternalAudiences } = useEventWizardAudiences();

  const [availableTeams, setAvailableTeams] = useState(/** @type {any[]} */ ([]));
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetchError, setHasFetchError] = useState(false);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [activeTeamId, setActiveTeamId] = useState('');
  const [selectionMode, setSelectionMode] = useState('ALL_MEMBERS');
  const [selectedMemberIds, setSelectedMemberIds] = useState(/** @type {string[]} */ ([]));

  const selectedOrganizerTeamId = getAudienceTeamId(state.team);
  const clubId = getAudienceTeamId(state.team?.club) || getAudienceTeamId(userData?.club);

  const internalAudienceMap = useMemo(() => {
    const map = new Map();
    internalAudiences.forEach((/** @type {any} */ audience) => {
      const teamId = getAudienceTeamId(audience?.team);
      if (teamId) {
        map.set(teamId, audience);
      }
    });
    return map;
  }, [internalAudiences]);

  const loadClubTeams = useCallback(async () => {
    if (!clubId) {
      setAvailableTeams([]);
      setHasFetchError(false);
      return;
    }

    setIsLoading(true);
    setHasFetchError(false);
    try {
      const response = await getTeams({ clubId, pageSize: 100 });
      const allTeams = Array.isArray(response?.data) ? response.data : [];
      const inviteable = allTeams.filter(
        (/** @type {any} */ team) => team.documentId !== selectedOrganizerTeamId,
      );
      setAvailableTeams(inviteable);
    } catch (_error) {
      setHasFetchError(true);
      setAvailableTeams([]);
    } finally {
      setIsLoading(false);
    }
  }, [clubId, selectedOrganizerTeamId]);

  useEffect(() => {
    loadClubTeams();
  }, [loadClubTeams]);

  const teamsByOwnership = useMemo(() => {
    const myTeamIds = new Set(
      (userData?.trainedTeams || []).map((/** @type {any} */ team) => team.documentId),
    );
    /** @type {any[]} */
    const myTeams = [];
    /** @type {any[]} */
    const otherTeams = [];

    availableTeams.forEach((/** @type {any} */ team) => {
      if (myTeamIds.has(team.documentId)) {
        myTeams.push(team);
      } else {
        otherTeams.push(team);
      }
    });

    return { myTeams, otherTeams };
  }, [availableTeams, userData?.trainedTeams]);

  const activeTeam = useMemo(
    () => availableTeams.find(
      (/** @type {any} */ team) => getAudienceTeamId(team) === activeTeamId,
    ) || null,
    [activeTeamId, availableTeams],
  );
  const activeTeamRoster = useMemo(() => buildRosterFromTeam(activeTeam), [activeTeam]);
  const canSaveModalSelection = selectionMode === 'ALL_MEMBERS' || selectedMemberIds.length > 0;

  const buildAudienceSummary = (/** @type {any} */ audience) => {
    if (!audience) {
      return t(
        'eventWizard.steps.participants.internalInvitesTeamHint',
        'Appuie pour choisir les membres ou inviter toute l equipe.',
      );
    }
    if (audience.selectionMode === 'SELECTED_MEMBERS') {
      return t(
        'eventWizard.steps.participants.internalInvitesSelectedCount',
        '{{count}} membre(s) invites',
        { count: Array.isArray(audience.selectedMembers) ? audience.selectedMembers.length : 0 },
      );
    }
    return t(
      'eventWizard.steps.participants.internalInvitesAllMembers',
      'Tous les membres invites',
    );
  };

  const openTeamInviteModal = (/** @type {any} */ team) => {
    const teamId = getAudienceTeamId(team);
    const existingAudience = internalAudienceMap.get(teamId);
    let nextSelectionMode = 'SELECTED_MEMBERS';
    if (existingAudience) {
      nextSelectionMode = existingAudience.selectionMode === 'SELECTED_MEMBERS'
        ? 'SELECTED_MEMBERS'
        : 'ALL_MEMBERS';
    }
    setActiveTeamId(teamId);
    setSelectionMode(nextSelectionMode);
    setSelectedMemberIds(
      (Array.isArray(existingAudience?.selectedMembers) ? existingAudience.selectedMembers : [])
        .map((/** @type {any} */ member) => getAudienceTeamId(member))
        .filter(Boolean),
    );
    setIsTeamModalOpen(true);
  };

  const closeTeamInviteModal = () => {
    setIsTeamModalOpen(false);
    setActiveTeamId('');
    setSelectionMode('ALL_MEMBERS');
    setSelectedMemberIds([]);
  };

  const toggleMemberSelection = (/** @type {string} */ memberId) => {
    setSelectedMemberIds((current) => (
      current.includes(memberId)
        ? current.filter((item) => item !== memberId)
        : [...current, memberId]
    ));
  };

  const saveInternalAudience = () => {
    if (!activeTeam || !canSaveModalSelection) return;

    const teamId = getAudienceTeamId(activeTeam);
    const nextAudience = {
      audienceKind: 'internal_invited',
      selectedMembers: selectionMode === 'SELECTED_MEMBERS' ? selectedMemberIds : [],
      selectionMode,
      status: 'ACCEPTED',
      team: activeTeam,
    };

    setInternalAudiences([
      ...internalAudiences.filter(
        (/** @type {any} */ audience) => getAudienceTeamId(audience?.team) !== teamId,
      ),
      nextAudience,
    ]);
    closeTeamInviteModal();
  };

  const removeInternalAudience = () => {
    if (!activeTeam) return;
    const teamId = getAudienceTeamId(activeTeam);
    setInternalAudiences(internalAudiences.filter(
      (/** @type {any} */ audience) => getAudienceTeamId(audience?.team) !== teamId,
    ));
    closeTeamInviteModal();
  };

  const renderTeamCard = (/** @type {any} */ team) => {
    const audience = internalAudienceMap.get(getAudienceTeamId(team));
    return (
      <EventWizardTeamCard
        isSelected={Boolean(audience)}
        key={team.documentId}
        onPress={() => openTeamInviteModal(team)}
        selectionSummary={buildAudienceSummary(audience)}
        showSelectionIndicator
        team={team}
      />
    );
  };

  return (
    <View style={[ApplicationStyle.card, Spaces.padding[16], Spaces.gap[16], surfaceStyle]}>
      <View style={Spaces.gap[8]}>
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
          {t(
            'eventWizard.steps.participants.internalInvitesTitle',
            'Inviter des membres d une équipe de mon club',
          )}
        </Text>
        <Text style={[Fonts.p3, Fonts.neutral200, { lineHeight: 18 }]}>
          {t(
            'eventWizard.steps.participants.internalInvitesSubtitle',
            'Choisis une équipe, puis invite tout le groupe ou seulement les membres concernés.',
          )}
        </Text>
      </View>

      {isLoading ? (
        <ActivityIndicator
          accessibilityLabel={t('common.loading', 'Chargement...')}
          color={Colors.primary500}
          size="large"
        />
      ) : null}

      {!isLoading && hasFetchError ? (
        <View style={Spaces.gap[12]}>
          <Text style={[Fonts.p3, Fonts.neutral100]}>
            {t('eventWizard.errors.invitesFetch')}
          </Text>
          <Button
            onPress={loadClubTeams}
            title={t('common.retry', 'Recharger')}
            variant="Primary"
          />
        </View>
      ) : null}

      {!isLoading && !hasFetchError && availableTeams.length === 0 ? (
        <Text style={[Fonts.p3, Fonts.neutral200, { lineHeight: 18 }]}>
          {t('eventWizard.errors.noOtherTeams')}
        </Text>
      ) : null}

      {!isLoading && !hasFetchError && availableTeams.length > 0 ? (
        <View style={Spaces.gap[16]}>
          {teamsByOwnership.myTeams.length > 0 ? (
            <View style={Spaces.gap[12]}>
              <Text style={[Fonts.p3Bold, Fonts.neutral200]}>
                {t('eventWizard.steps.invites.myTeams')}
              </Text>
              {teamsByOwnership.myTeams.map(renderTeamCard)}
            </View>
          ) : null}

          {teamsByOwnership.otherTeams.length > 0 ? (
            <View style={Spaces.gap[12]}>
              <Text style={[Fonts.p3Bold, Fonts.neutral200]}>
                {t('eventWizard.steps.invites.otherTeams')}
              </Text>
              {teamsByOwnership.otherTeams.map(renderTeamCard)}
            </View>
          ) : null}
        </View>
      ) : null}

      {isTeamModalOpen ? (
        <BottomModal
          close={closeTeamInviteModal}
          isVisible
          snapPoints={['88%']}
          webPresentation="dialog"
        >
          <ScrollView
            contentContainerStyle={[Spaces.gap[16], Spaces.paddingBottom[24]]}
            showsVerticalScrollIndicator={false}
          >
            <View style={Spaces.gap[8]}>
              <Text style={[Fonts.h3, Fonts.neutral00]}>
                {activeTeam?.name || 'Equipe'}
              </Text>
              <Text style={[Fonts.p3, Fonts.neutral200]}>
                {t(
                  'eventWizard.steps.participants.internalInvitesModalHint',
                  'Choisis si tu invites tout le groupe ou seulement certains membres'
                  + ' à cet événement.',
                )}
              </Text>
            </View>

            <View style={Spaces.gap[8]}>
              <Button
                onPress={() => {
                  setSelectionMode('ALL_MEMBERS');
                  setSelectedMemberIds([]);
                }}
                title={t(
                  'eventWizard.steps.participants.internalInvitesAllAction',
                  'Inviter tous les membres',
                )}
                variant={selectionMode === 'ALL_MEMBERS' ? 'Primary' : 'Secondary'}
              />
              <Button
                onPress={() => setSelectionMode('SELECTED_MEMBERS')}
                title={t(
                  'eventWizard.steps.participants.internalInvitesSomeAction',
                  'Choisir certains membres',
                )}
                variant={selectionMode === 'SELECTED_MEMBERS' ? 'Primary' : 'Secondary'}
              />
            </View>

            {selectionMode === 'SELECTED_MEMBERS' ? (
              <View style={Spaces.gap[12]}>
                <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
                  {selectedMemberIds.length > 0
                    ? t(
                      'eventWizard.steps.participants.internalInvitesPickedCount',
                      '{{count}} membre(s) sélectionne(s)',
                      { count: selectedMemberIds.length },
                    )
                    : t(
                      'eventWizard.steps.participants.internalInvitesPickPrompt',
                      'Sélectionne les membres à inviter',
                    )}
                </Text>

                {activeTeamRoster.length > 0 ? (
                  <View style={Spaces.gap[8]}>
                    {activeTeamRoster.map((/** @type {any} */ member) => {
                      const memberId = getAudienceTeamId(member);
                      const checked = selectedMemberIds.includes(memberId);
                      return (
                        <TouchableOpacity
                          accessibilityRole="button"
                          key={memberId}
                          onPress={() => toggleMemberSelection(memberId)}
                          style={[
                            ApplicationStyle.card,
                            Alignments.row,
                            Alignments.alignCenter,
                            Spaces.gap[12],
                            Spaces.padding[12],
                            {
                              backgroundColor: `${Colors.primary800}A6`,
                              borderColor: checked ? Colors.primary500 : `${Colors.primary500}33`,
                              borderWidth: 1,
                            },
                          ]}
                        >
                          <Checkbox
                            disabled={false}
                            onValueChange={() => toggleMemberSelection(memberId)}
                            value={checked}
                          />
                          <ProfileAvatar
                            enablePreview={false}
                            imageUrl={member?.avatar?.url}
                            name={getUserDisplayName(member)}
                            size={32}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
                              {getUserDisplayName(member)}
                            </Text>
                            <Text style={[Fonts.p3, Fonts.neutral200]}>
                              {member?.role?.name || 'Membre'}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={[Fonts.p3, Fonts.neutral200]}>
                    {t(
                      'eventWizard.steps.participants.internalInvitesEmptyRoster',
                      'Aucun membre disponible pour cette équipe.',
                    )}
                  </Text>
                )}
              </View>
            ) : (
              <View
                style={[
                  ApplicationStyle.card,
                  Spaces.padding[16],
                  {
                    backgroundColor: `${Colors.primary500}12`,
                    borderColor: `${Colors.primary500}44`,
                    borderWidth: 1,
                  },
                ]}
              >
                <Text style={[Fonts.p3, Fonts.neutral100, { lineHeight: 18 }]}>
                  {t(
                    'eventWizard.steps.participants.internalInvitesAllHint',
                    'Tous les membres de cette équipe recevront cette invitation'
                    + ' et verront ensuite l événement dans leur planning.',
                  )}
                </Text>
              </View>
            )}

            <View style={[Alignments.row, Spaces.gap[8], Spaces.paddingTop[8]]}>
              {internalAudienceMap.has(activeTeamId) ? (
                <Button
                  onPress={removeInternalAudience}
                  style={{ borderColor: Colors.error500, flex: 1 }}
                  textStyle={{ color: Colors.error500 }}
                  title={t(
                    'eventWizard.steps.participants.internalInvitesRemove',
                    'Retirer cette invitation',
                  )}
                  variant="Secondary"
                />
              ) : null}
              <Button
                onPress={closeTeamInviteModal}
                style={{ flex: 1 }}
                title={t('common.actions.cancel', 'Annuler')}
                variant="Secondary"
              />
              <Button
                disabled={!canSaveModalSelection}
                onPress={saveInternalAudience}
                style={{ flex: 1 }}
                title={t('common.actions.save', 'Enregistrer')}
              />
            </View>
          </ScrollView>
        </BottomModal>
      ) : null}
    </View>
  );
}

export default EventWizardInternalInvites;
