// @ts-nocheck
import { useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Checkbox from '@/components/atoms/checkbox/Checkbox';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import Input from '@/components/molecules/input/Input';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import SegmentedControl from '@/components/molecules/segmentedControl/SegmentedControl';

import { getClubs } from '@/services/club/clubService';
import { getTeams } from '@/services/team/teamService';

const KIND_OPTIONS = [
  { label: 'Interne', value: 'internal_invited' },
  { label: 'Externe', value: 'external_invited' },
];

const SELECTION_OPTIONS = [
  { label: 'Tous', value: 'ALL_MEMBERS' },
  { label: 'Choisis', value: 'SELECTED_MEMBERS' },
];

const createEmptyDraft = (audienceKind = 'internal_invited') => ({
  audienceKind,
  clubId: '',
  selectedMembers: [],
  selectionMode: 'ALL_MEMBERS',
  teamId: '',
});

const getDocumentId = (value) => String(value?.documentId || value?.id || value || '').trim();
const getAudienceKey = (audience) => `${String(audience?.audienceKind || 'audience')}:${getDocumentId(audience?.team) || 'team'}`;

const getUserKey = (user) => getDocumentId(user);

const getUserDisplayName = (user) => (
  `${String(user?.firstname || '').trim()} ${String(user?.lastname || '').trim()}`.trim()
  || String(user?.username || '').trim()
  || 'Membre'
);

const uniqueUsers = (users = []) => {
  const map = new Map();
  users.forEach((user) => {
    const key = getUserKey(user);
    if (!key || map.has(key)) return;
    map.set(key, user);
  });
  return Array.from(map.values());
};

const buildRosterFromTeam = (team) => uniqueUsers([
  ...(Array.isArray(team?.players) ? team.players : []),
  ...(Array.isArray(team?.trainers) ? team.trainers : []),
]);

const getAudienceLabel = (audience) => {
  const kind = String(audience?.audienceKind || '').toUpperCase();
  if (kind === 'EXTERNAL_INVITED') return 'Équipe externe';
  if (kind === 'INTERNAL_INVITED') return 'Équipe interne';
  return 'Organisateur';
};

const getAudienceStatusLabel = (status) => {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'PENDING') return 'PENDING';
  if (normalized === 'REFUSED') return 'REFUSED';
  if (normalized === 'CANCELLED') return 'CANCELLED';
  return 'ACCEPTED';
};

function EventTeamAudiencesEditor({
  allowedAudienceKinds = ['internal_invited', 'external_invited'],
  availableTeams = [],
  clubId = '',
  currentTeamId = '',
  editable = true,
  emptyStateText = 'Aucune invitation avancée pour le moment.',
  onChange,
  title = "Invitations d'équipe",
  value = [],
}) {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [editingKey, setEditingKey] = useState('');
  const [internalTeams, setInternalTeams] = useState([]);
  const [externalClubs, setExternalClubs] = useState([]);
  const [externalTeams, setExternalTeams] = useState([]);
  const [internalSearch, setInternalSearch] = useState('');
  const [externalSearch, setExternalSearch] = useState('');
  const [clubSearch, setClubSearch] = useState('');
  const [isLoadingExternalClubs, setIsLoadingExternalClubs] = useState(false);
  const [isLoadingExternalTeams, setIsLoadingExternalTeams] = useState(false);
  const normalizedAllowedKinds = useMemo(() => {
    const nextKinds = Array.isArray(allowedAudienceKinds)
      ? allowedAudienceKinds.filter((kind) => kind === 'internal_invited' || kind === 'external_invited')
      : [];
    return nextKinds.length ? nextKinds : ['internal_invited', 'external_invited'];
  }, [allowedAudienceKinds]);
  const defaultAudienceKind = normalizedAllowedKinds[0] || 'internal_invited';
  const [draft, setDraft] = useState(() => createEmptyDraft(defaultAudienceKind));

  const audiences = useMemo(() => (Array.isArray(value) ? value : []), [value]);
  const visibleAudiences = useMemo(
    () => audiences.filter((audience) => normalizedAllowedKinds.includes(audience?.audienceKind || 'internal_invited')),
    [audiences, normalizedAllowedKinds],
  );
  const kindOptions = useMemo(
    () => KIND_OPTIONS.filter((option) => normalizedAllowedKinds.includes(option.value)),
    [normalizedAllowedKinds],
  );
  const showKindSelector = kindOptions.length > 1;
  const internalTeamList = useMemo(
    () => (Array.isArray(availableTeams) ? availableTeams : [])
      .filter((team) => getDocumentId(team) !== getDocumentId(currentTeamId)),
    [availableTeams, currentTeamId],
  );

  useEffect(() => {
    setInternalTeams(internalTeamList);
  }, [internalTeamList]);

  const selectedTeam = useMemo(
    () => [...internalTeams, ...externalTeams].find((team) => getDocumentId(team) === getDocumentId(draft.teamId)) || null,
    [draft.teamId, externalTeams, internalTeams],
  );
  const roster = useMemo(() => buildRosterFromTeam(selectedTeam), [selectedTeam]);
  const filteredTeams = useMemo(() => {
    const pool = draft.audienceKind === 'external_invited' ? externalTeams : internalTeams;
    const term = String(
      draft.audienceKind === 'external_invited'
        ? externalSearch
        : internalSearch,
    ).trim().toLowerCase();
    if (!term) return pool;
    return pool.filter((team) => {
      const haystack = [
        team?.name,
        team?.section?.name,
        team?.category?.name,
        team?.level?.name,
        team?.club?.name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [draft.audienceKind, externalSearch, externalTeams, internalSearch, internalTeams]);
  const isEditMode = Boolean(editingKey);
  const canSave = Boolean(draft.teamId)
    && (draft.selectionMode !== 'SELECTED_MEMBERS' || draft.selectedMembers.length > 0);
  const teamAvailabilityMessage = useMemo(() => {
    if (draft.audienceKind === 'external_invited' && isLoadingExternalTeams) {
      return 'Chargement des équipes...';
    }
    return 'Aucune équipe disponible.';
  }, [draft.audienceKind, isLoadingExternalTeams]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (draft.audienceKind !== 'external_invited' || !normalizedAllowedKinds.includes('external_invited')) {
        setExternalClubs([]);
        return;
      }

      const query = String(clubSearch || '').trim();
      if (query.length < 2) {
        setExternalClubs([]);
        return;
      }

      setIsLoadingExternalClubs(true);
      try {
        const response = await getClubs({
          includeMultisport: false,
          name: query,
          pageSize: 8,
        });
        const clubs = Array.isArray(response?.data) ? response.data : [];
        if (!cancelled) {
          setExternalClubs(clubs.filter((club) => getDocumentId(club) !== getDocumentId(clubId)));
        }
      } catch (_error) {
        if (!cancelled) setExternalClubs([]);
      } finally {
        if (!cancelled) setIsLoadingExternalClubs(false);
      }
    };

    const timer = setTimeout(run, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [clubId, clubSearch, draft.audienceKind, normalizedAllowedKinds]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (draft.audienceKind !== 'external_invited' || !normalizedAllowedKinds.includes('external_invited')) {
        setExternalTeams([]);
        return;
      }

      const selectedClub = externalClubs.find((club) => getDocumentId(club) === getDocumentId(draft.clubId));
      if (!selectedClub?.documentId) {
        setExternalTeams([]);
        return;
      }

      setIsLoadingExternalTeams(true);
      try {
        const response = await getTeams({ clubId: selectedClub.documentId, pageSize: 100 });
        const teams = Array.isArray(response?.data) ? response.data : [];
        if (!cancelled) {
          setExternalTeams(teams);
        }
      } catch (_error) {
        if (!cancelled) setExternalTeams([]);
      } finally {
        if (!cancelled) setIsLoadingExternalTeams(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [draft.audienceKind, draft.clubId, externalClubs, normalizedAllowedKinds]);

  const resetDraft = () => {
    setDraft(createEmptyDraft(defaultAudienceKind));
    setEditingKey('');
    setClubSearch('');
    setExternalSearch('');
    setExternalTeams([]);
    setIsOpen(false);
  };

  const openDraft = (audience = null) => {
    if (!editable) return;
    setIsOpen(true);
    setInternalSearch('');
    setExternalSearch('');

    if (!audience) {
      setEditingKey('');
      setClubSearch('');
      setDraft(createEmptyDraft(defaultAudienceKind));
      return;
    }

    const audienceClub = audience?.team?.club || null;
    setEditingKey(getAudienceKey(audience));
    setDraft({
      audienceKind: audience.audienceKind === 'external_invited' ? 'external_invited' : 'internal_invited',
      clubId: getDocumentId(audienceClub),
      selectedMembers: (Array.isArray(audience?.selectedMembers) ? audience.selectedMembers : [])
        .map((member) => getDocumentId(member))
        .filter(Boolean),
      selectionMode: audience.selectionMode === 'SELECTED_MEMBERS' ? 'SELECTED_MEMBERS' : 'ALL_MEMBERS',
      teamId: getDocumentId(audience?.team),
    });
    setClubSearch(String(audienceClub?.name || '').trim());
    if (audienceClub) {
      setExternalClubs([audienceClub]);
    }
  };

  const saveDraft = () => {
    if (!canSave || !selectedTeam) return;

    const normalizedAudience = {
      audienceKind: draft.audienceKind,
      selectedMembers: draft.selectionMode === 'SELECTED_MEMBERS' ? draft.selectedMembers : [],
      selectionMode: draft.selectionMode,
      status: draft.audienceKind === 'external_invited' ? 'PENDING' : 'ACCEPTED',
      team: selectedTeam,
    };

    const nextAudiences = audiences.filter((item) => getAudienceKey(item) !== editingKey);
    const duplicateIndex = nextAudiences.findIndex((item) => getAudienceKey(item) === getAudienceKey(normalizedAudience));
    if (duplicateIndex >= 0) {
      nextAudiences.splice(duplicateIndex, 1, normalizedAudience);
    } else {
      nextAudiences.push(normalizedAudience);
    }

    onChange?.(nextAudiences);
    resetDraft();
  };

  const removeAudience = (audienceKey) => {
    if (!editable) return;
    onChange?.(audiences.filter((item) => getAudienceKey(item) !== audienceKey));
  };

  const toggleMember = (memberId) => {
    setDraft((current) => ({
      ...current,
      selectedMembers: current.selectedMembers.includes(memberId)
        ? current.selectedMembers.filter((item) => item !== memberId)
        : [...current.selectedMembers, memberId],
    }));
  };

  return (
    <View style={[ApplicationStyle.card, Spaces.padding[16], Spaces.gap[12], { backgroundColor: `${Colors.primary700}66` }]}>
      <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter]}>
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{title}</Text>
        {editable ? (
          <Button onPress={() => openDraft(null)} title="Ajouter" variant="Secondary" />
        ) : null}
      </View>

      {visibleAudiences.length ? (
        <View style={Spaces.gap[12]}>
          {visibleAudiences.map((audience) => {
            const audienceKey = getAudienceKey(audience);
            const team = audience?.team;
            const selectedMembers = Array.isArray(audience?.selectedMembers) ? audience.selectedMembers : [];
            return (
              <View
                key={audienceKey}
                style={[ApplicationStyle.card, Spaces.padding[12], Spaces.gap[8], {
                  backgroundColor: `${Colors.primary800}A6`,
                  borderColor: `${Colors.primary500}33`,
                }]}
              >
                <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, { gap: 8 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[Fonts.p3Bold, Fonts.neutral00]}>{team?.name || 'Equipe'}</Text>
                    <Text style={[Fonts.p3, Fonts.neutral200]}>
                      {getAudienceLabel(audience)}
                      {' '}
                      -
                      {' '}
                      {audience?.selectionMode === 'SELECTED_MEMBERS'
                        ? `${selectedMembers.length} membre(s)`
                        : 'Tous les membres'}
                    </Text>
                  </View>
                  <Text style={[Fonts.p3Bold, audience?.status === 'PENDING' ? Fonts.gold500 : Fonts.primary500]}>
                    {getAudienceStatusLabel(audience?.status)}
                  </Text>
                </View>
                {editable ? (
                  <View style={[Alignments.row, Spaces.gap[8], { flexWrap: 'wrap' }]}>
                    <Button onPress={() => openDraft(audience)} title="Modifier" variant="Secondary" />
                    <Button onPress={() => removeAudience(audienceKey)} title="Supprimer" variant="Secondary" />
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : (
        <Text style={[Fonts.p3, Fonts.neutral200]}>{emptyStateText}</Text>
      )}

      {isOpen ? (
        <BottomModal close={resetDraft} isVisible snapPoints={['88%']} webPresentation="dialog">
          <ScrollView contentContainerStyle={Spaces.gap[16]} showsVerticalScrollIndicator={false}>
            <View style={Spaces.gap[8]}>
              <Text style={[Fonts.h3, Fonts.neutral00]}>
                {isEditMode ? 'Modifier linvitation' : 'Nouvelle invitation'}
              </Text>
              <Text style={[Fonts.p3, Fonts.neutral200]}>
                Choisis une équipe, puis décide si tu invites tout le monde ou seulement certains membres.
              </Text>
            </View>

            {showKindSelector ? (
              <SegmentedControl
                onChange={(audienceKind) => setDraft((current) => ({
                  ...current,
                  audienceKind,
                  clubId: audienceKind === 'internal_invited' ? '' : current.clubId,
                  selectedMembers: [],
                  teamId: '',
                }))}
                options={kindOptions}
                value={draft.audienceKind}
              />
            ) : null}

            {draft.audienceKind === 'external_invited' ? (
              <View style={Spaces.gap[12]}>
                <Input
                  label="Rechercher un club"
                  onChangeText={setClubSearch}
                  placeholder="Nom du club"
                  value={clubSearch}
                />
                {isLoadingExternalClubs ? (
                  <Text style={[Fonts.p3, Fonts.neutral200]}>Recherche en cours...</Text>
                ) : null}
                {externalClubs.length ? (
                  <View style={Spaces.gap[8]}>
                    {externalClubs.map((club) => {
                      const selected = getDocumentId(club) === getDocumentId(draft.clubId);
                      return (
                        <TouchableOpacity
                          key={club.documentId}
                          onPress={() => setDraft((current) => ({
                            ...current,
                            clubId: club.documentId,
                            selectedMembers: [],
                            teamId: '',
                          }))}
                          style={[ApplicationStyle.card, Spaces.padding[12], {
                            backgroundColor: selected ? `${Colors.primary500}22` : `${Colors.primary800}A6`,
                            borderColor: selected ? Colors.primary500 : `${Colors.primary500}33`,
                            borderRadius: 16,
                          }]}
                        >
                          <Text style={[Fonts.p3Bold, Fonts.neutral00]}>{club?.name || 'Club'}</Text>
                          <Text style={[Fonts.p3, Fonts.neutral200]}>{club?.city || club?.address?.city || ''}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : null}
                {!externalClubs.length && clubSearch.trim().length >= 2 ? (
                  <Text style={[Fonts.p3, Fonts.neutral200]}>Aucun club trouve.</Text>
                ) : null}
              </View>
            ) : null}

            <Input
              label="Rechercher une équipe"
              onChangeText={draft.audienceKind === 'external_invited' ? setExternalSearch : setInternalSearch}
              placeholder="Nom de lequipe"
              value={draft.audienceKind === 'external_invited' ? externalSearch : internalSearch}
            />

            <View style={Spaces.gap[8]}>
              {filteredTeams.length ? filteredTeams.map((team) => {
                const teamId = getDocumentId(team);
                const selected = teamId === getDocumentId(draft.teamId);
                return (
                  <TouchableOpacity
                    key={teamId}
                    onPress={() => setDraft((current) => ({
                      ...current,
                      selectedMembers: [],
                      teamId,
                    }))}
                    style={[ApplicationStyle.card, Spaces.padding[12], {
                      backgroundColor: selected ? `${Colors.primary500}22` : `${Colors.primary800}A6`,
                      borderColor: selected ? Colors.primary500 : `${Colors.primary500}33`,
                      borderRadius: 16,
                    }]}
                  >
                    <Text style={[Fonts.p3Bold, Fonts.neutral00]}>{team?.name || 'Equipe'}</Text>
                    <Text style={[Fonts.p3, Fonts.neutral200]}>
                      {[team?.club?.name, team?.section?.name, team?.category?.name, team?.level?.name]
                        .filter(Boolean)
                        .join(' - ')}
                    </Text>
                  </TouchableOpacity>
                );
              }) : (
                <Text style={[Fonts.p3, Fonts.neutral200]}>{teamAvailabilityMessage}</Text>
              )}
            </View>

            <SegmentedControl
              onChange={(selectionMode) => setDraft((current) => ({
                ...current,
                selectedMembers: selectionMode === 'SELECTED_MEMBERS' ? current.selectedMembers : [],
                selectionMode,
              }))}
              options={SELECTION_OPTIONS}
              value={draft.selectionMode}
            />

            {draft.selectionMode === 'SELECTED_MEMBERS' ? (
              <View style={Spaces.gap[12]}>
                <Text style={[Fonts.p3Bold, Fonts.neutral00]}>Membres sélectionnés</Text>
                {roster.length ? (
                  <View style={Spaces.gap[8]}>
                    {roster.map((member) => {
                      const memberId = getUserKey(member);
                      const checked = draft.selectedMembers.includes(memberId);
                      return (
                        <TouchableOpacity
                          key={memberId}
                          onPress={() => toggleMember(memberId)}
                          style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12], {
                            backgroundColor: `${Colors.primary800}A6`,
                            borderColor: checked ? Colors.primary500 : `${Colors.primary500}33`,
                            borderRadius: 16,
                            borderWidth: 1,
                            padding: 12,
                          }]}
                        >
                          <Checkbox onValueChange={() => toggleMember(memberId)} value={checked} />
                          <ProfileAvatar
                            enablePreview={false}
                            imageUrl={member?.avatar?.url}
                            name={getUserDisplayName(member)}
                            size={36}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={[Fonts.p3Bold, Fonts.neutral00]}>{getUserDisplayName(member)}</Text>
                            <Text style={[Fonts.p3, Fonts.neutral200]}>{member?.role?.name || 'Membre'}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={[Fonts.p3, Fonts.neutral200]}>Aucun membre disponible pour cette équipe.</Text>
                )}
              </View>
            ) : null}

            <View style={[Alignments.row, Spaces.gap[8], Spaces.paddingBottom[12]]}>
              <Button onPress={resetDraft} style={{ flex: 1 }} title="Annuler" variant="Secondary" />
              <Button disabled={!canSave} onPress={saveDraft} style={{ flex: 1 }} title="Enregistrer" />
            </View>
          </ScrollView>
        </BottomModal>
      ) : null}
    </View>
  );
}

export default EventTeamAudiencesEditor;
