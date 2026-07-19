// @ts-nocheck
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Checkbox from '@/components/atoms/checkbox/Checkbox';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';

import { celebrate } from '@/services/celebrations/celebrationRuntime';
import {
  approveEventTaskAssignment,
  assignEventTask,
  cancelEventTaskAssignment,
  rejectEventTaskAssignment,
} from '@/services/event/eventService';

const getUserKey = (user) => {
  if (user?.documentId) return `doc:${user.documentId}`;
  if (user?.id) return `id:${String(user.id)}`;
  return '';
};

const getUserDisplayName = (user) => (
  `${String(user?.firstname || '').trim()} ${String(user?.lastname || '').trim()}`.trim()
  || String(user?.username || '').trim()
  || 'Membre'
);

const getRoleLabel = (user) => (
  String(user?.role?.name || user?.role?.type || user?.role || '').trim()
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
  ...(Array.isArray(team?.members) ? team.members : []),
]);

const buildAudienceRoster = (audience) => {
  if (String(audience?.selectionMode || '').toUpperCase() === 'SELECTED_MEMBERS') {
    return Array.isArray(audience?.selectedMembers) ? audience.selectedMembers : [];
  }
  return buildRosterFromTeam(audience?.team);
};

const buildAssignableMembersForEvent = (event) => {
  const acceptedAudiences = Array.isArray(event?.teamAudiences)
    ? event.teamAudiences.filter((audience) => {
      if (!audience?.team) return false;
      if (String(audience?.audienceKind || '').toLowerCase() !== 'external_invited') return true;
      return String(audience?.status || '').toUpperCase() === 'ACCEPTED';
    })
    : [];

  return uniqueUsers([
    ...buildRosterFromTeam(event?.team),
    ...acceptedAudiences.flatMap((audience) => buildAudienceRoster(audience)),
    ...((Array.isArray(event?.invitedTeams) ? event.invitedTeams : []).flatMap((team) => buildRosterFromTeam(team))),
  ]);
};

const getAssignmentStatusLabel = (status) => {
  const normalizedStatus = String(status || '').toUpperCase();
  if (normalizedStatus === 'APPROVED') return 'Valide';
  if (normalizedStatus === 'PENDING') return 'En attente';
  if (normalizedStatus === 'REJECTED') return 'Refuse';
  if (normalizedStatus === 'CANCELLED') return 'Annule';
  return normalizedStatus || 'Inconnu';
};

const isTrainerForUser = (team, user) => {
  const userKey = getUserKey(user);
  if (!userKey) return false;
  return Array.isArray(team?.trainers) && team.trainers.some((trainer) => getUserKey(trainer) === userKey);
};

/**
 *
 * @param root0
 * @param root0.canManageEvent
 * @param root0.event
 * @param root0.userData
 */
function EventTasksSection({ canManageEvent = false, event, userData }) {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const queryClient = useQueryClient();
  const [activeManagerTaskId, setActiveManagerTaskId] = useState('');
  const [selectedManagerMemberIds, setSelectedManagerMemberIds] = useState([]);
  const [isAssignMembersModalOpen, setIsAssignMembersModalOpen] = useState(false);

  const tasks = useMemo(() => (Array.isArray(event?.eventTasks) ? event.eventTasks : []), [event?.eventTasks]);
  const currentUserKey = getUserKey(userData);
  const hasCurrentUser = Boolean(currentUserKey);
  const assignableMembers = useMemo(() => buildAssignableMembersForEvent(event), [event]);
  const canCurrentUserSelfAssign = useMemo(
    () => hasCurrentUser && assignableMembers.some((member) => getUserKey(member) === currentUserKey),
    [assignableMembers, currentUserKey, hasCurrentUser],
  );

  const canModerateAssignments = useMemo(() => {
    if (canManageEvent) return true;
    if (isTrainerForUser(event?.team, userData)) return true;
    const acceptedAudienceTeams = Array.isArray(event?.teamAudiences)
      ? event.teamAudiences
        .filter((audience) => String(audience?.status || '').toUpperCase() === 'ACCEPTED')
        .map((audience) => audience?.team)
      : [];
    return acceptedAudienceTeams.some((team) => isTrainerForUser(team, userData));
  }, [canManageEvent, event?.team, event?.teamAudiences, userData]);

  const refreshEvent = () => {
    queryClient.invalidateQueries({ queryKey: ['event', event?.documentId] });
  };

  const assignMutation = useMutation({
    mutationFn: ({ taskId }) => assignEventTask(taskId, { userId: userData?.documentId }),
    onError: (error) => Alert.alert('Erreur', error?.message || 'Impossible de rejoindre cette tâche.'),
    onSuccess: (result, variables) => {
      const task = tasks.find((item) => String(item?.documentId || item?.id || '') === String(variables?.taskId || ''));
      const status = String(result?.data?.status || result?.status || '').toUpperCase();
      celebrate(status === 'APPROVED' ? 'event_task_assignment_validated' : 'event_task_volunteer_sent', {
        assignmentId: result?.data?.documentId || result?.documentId || null,
        eventId: event?.documentId,
        taskId: variables?.taskId,
        taskTitle: task?.title || 'cette tâche',
      });
      refreshEvent();
    },
  });
  const managerAssignMutation = useMutation({
    mutationFn: ({ taskId, userIds }) => Promise.all(
      userIds.map((userId) => assignEventTask(taskId, { userId })),
    ),
    onError: (error) => Alert.alert('Erreur', error?.message || 'Impossible d assigner ces membres à la tâche.'),
    onSuccess: () => {
      celebrate('event_task_members_assigned', {
        count: selectedManagerMemberIds.length,
        eventId: event?.documentId,
        taskId: activeManagerTask?.documentId || activeManagerTask?.id || null,
        taskTitle: activeManagerTask?.title || 'cette tâche',
      });
      setIsAssignMembersModalOpen(false);
      setActiveManagerTaskId('');
      setSelectedManagerMemberIds([]);
      refreshEvent();
    },
  });
  const approveMutation = useMutation({
    mutationFn: ({ assignmentId }) => approveEventTaskAssignment(assignmentId),
    onError: (error) => Alert.alert('Erreur', error?.message || 'Impossible de valider cette assignation.'),
    onSuccess: (result) => {
      celebrate('event_task_assignment_validated', {
        assignmentId: result?.data?.documentId || result?.documentId || null,
        eventId: event?.documentId,
        taskId: result?.data?.task?.documentId || result?.task?.documentId || null,
        taskTitle: result?.data?.task?.title || result?.task?.title || 'cette tâche',
      });
      refreshEvent();
    },
  });
  const rejectMutation = useMutation({
    mutationFn: ({ assignmentId }) => rejectEventTaskAssignment(assignmentId, {}),
    onError: (error) => Alert.alert('Erreur', error?.message || 'Impossible de refuser cette assignation.'),
    onSuccess: refreshEvent,
  });
  const cancelMutation = useMutation({
    mutationFn: ({ assignmentId }) => cancelEventTaskAssignment(assignmentId),
    onError: (error) => Alert.alert('Erreur', error?.message || 'Impossible d annuler cette assignation.'),
    onSuccess: refreshEvent,
  });

  const activeManagerTask = useMemo(
    () => tasks.find((task) => String(task?.documentId || task?.id || '') === activeManagerTaskId) || null,
    [activeManagerTaskId, tasks],
  );

  const activeTaskAssignmentsByUserKey = useMemo(() => {
    const map = new Map();
    const assignments = Array.isArray(activeManagerTask?.assignments) ? activeManagerTask.assignments : [];
    assignments.forEach((assignment) => {
      const key = getUserKey(assignment?.user);
      if (!key) return;
      map.set(key, assignment);
    });
    return map;
  }, [activeManagerTask?.assignments]);

  const activeApprovedCount = useMemo(
    () => (Array.isArray(activeManagerTask?.assignments)
      ? activeManagerTask.assignments.filter((assignment) => String(assignment?.status || '').toUpperCase() === 'APPROVED').length
      : 0),
    [activeManagerTask?.assignments],
  );

  const activeRemainingSlots = Math.max(0, Number(activeManagerTask?.requiredCount || 1) - activeApprovedCount);

  const activeAssignableCandidates = useMemo(() => assignableMembers.filter((member) => {
    const assignment = activeTaskAssignmentsByUserKey.get(getUserKey(member));
    const status = String(assignment?.status || '').toUpperCase();
    return status !== 'APPROVED' && status !== 'PENDING';
  }), [activeTaskAssignmentsByUserKey, assignableMembers]);

  const openAssignMembersModal = (task) => {
    setActiveManagerTaskId(String(task?.documentId || task?.id || ''));
    setSelectedManagerMemberIds([]);
    setIsAssignMembersModalOpen(true);
  };

  const closeAssignMembersModal = () => {
    setIsAssignMembersModalOpen(false);
    setActiveManagerTaskId('');
    setSelectedManagerMemberIds([]);
  };

  const toggleManagerMemberSelection = (memberId) => {
    setSelectedManagerMemberIds((current) => {
      if (current.includes(memberId)) {
        return current.filter((value) => value !== memberId);
      }
      if (current.length >= activeRemainingSlots) {
        Alert.alert('Tâche complète', 'Retire un membre ou choisis une autre tâche avant de continuer.');
        return current;
      }
      return [...current, memberId];
    });
  };

  const confirmManagerAssignments = () => {
    if (!activeManagerTask || selectedManagerMemberIds.length === 0 || managerAssignMutation.isPending) {
      return;
    }
    managerAssignMutation.mutate({
      taskId: activeManagerTask.documentId || activeManagerTask.id,
      userIds: selectedManagerMemberIds,
    });
  };

  if (!tasks.length) return null;

  return (
    <>
      <View
        style={[ApplicationStyle.card, Spaces.padding[16], Spaces.gap[12], {
          backgroundColor: `${Colors.primary700}66`,
          borderColor: `${Colors.primary500}44`,
        }]}
      >
        <View style={Spaces.gap[8]}>
          <Text style={[Fonts.h4, Fonts.neutral00]}>Tâches annexes</Text>
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            Les membres peuvent se proposer, et les encadrants peuvent assigner directement les bonnes personnes.
          </Text>
        </View>

        <View style={Spaces.gap[12]}>
          {tasks.map((task) => {
            const assignments = Array.isArray(task?.assignments) ? task.assignments : [];
            const approvedAssignments = assignments.filter((assignment) => String(assignment?.status || '').toUpperCase() === 'APPROVED');
            const pendingAssignments = assignments.filter((assignment) => String(assignment?.status || '').toUpperCase() === 'PENDING');
            const userAssignment = assignments.find((assignment) => getUserKey(assignment?.user) === currentUserKey) || null;
            const approvedCount = approvedAssignments.length;
            const isFull = approvedCount >= Number(task?.requiredCount || 1);

            return (
              <View
                key={task.documentId || task.id || task.title}
                style={[ApplicationStyle.card, Spaces.padding[16], Spaces.gap[12], {
                  backgroundColor: `${Colors.primary800}A6`,
                  borderColor: `${Colors.primary500}33`,
                }]}
              >
                <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.gap[12]]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{task.title}</Text>
                    <Text style={[Fonts.p3, Fonts.neutral300]}>
                      {String(task.validationMode || 'AUTO') === 'MANUAL' ? 'Volontariat avec validation manuelle' : 'Validation automatique'}
                    </Text>
                  </View>
                  <View
                    style={{
                      backgroundColor: isFull ? `${Colors.gold500}22` : `${Colors.primary500}18`,
                      borderColor: isFull ? `${Colors.gold500}66` : `${Colors.primary500}55`,
                      borderRadius: 16,
                      borderWidth: 1,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                    }}
                  >
                    <Text style={[Fonts.p3Bold, isFull ? Fonts.gold500 : Fonts.primary500]}>
                      {approvedCount}
                      {' / '}
                      {Number(task?.requiredCount || 1)}
                    </Text>
                  </View>
                </View>

                {task.description ? (
                  <Text style={[Fonts.p3, Fonts.neutral200]}>{task.description}</Text>
                ) : null}

                {approvedAssignments.length > 0 ? (
                  <View style={Spaces.gap[8]}>
                    <Text style={[Fonts.p3Bold, Fonts.neutral100]}>Affectations confirmées</Text>
                    <View style={[Alignments.row, Spaces.gap[8], { flexWrap: 'wrap' }]}>
                      {approvedAssignments.map((assignment) => (
                        <View
                          key={assignment.documentId || assignment.id || getUserKey(assignment?.user)}
                          style={{
                            backgroundColor: `${Colors.primary500}18`,
                            borderColor: `${Colors.primary500}44`,
                            borderRadius: 999,
                            borderWidth: 1,
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                          }}
                        >
                          <Text style={[Fonts.p4Bold, Fonts.neutral00]}>{getUserDisplayName(assignment?.user)}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : (
                  <Text style={[Fonts.p3, Fonts.neutral300]}>
                    Personne n est encore confirme sur cette tâche.
                  </Text>
                )}

                {userAssignment ? (
                  <Text style={[Fonts.p3Bold, Fonts.neutral100]}>
                    {'Ton statut : '}
                    {getAssignmentStatusLabel(userAssignment.status)}
                  </Text>
                ) : null}

                <View style={[Alignments.row, Spaces.gap[8], { flexWrap: 'wrap' }]}>
                  {!userAssignment && !isFull && canCurrentUserSelfAssign ? (
                    <Button
                      disabled={assignMutation.isPending}
                      onPress={() => assignMutation.mutate({ taskId: task.documentId || task.id })}
                      title={String(task.validationMode || 'AUTO') === 'MANUAL' ? 'Je me porte volontaire' : "Je m'assigne"}
                      variant="Secondary"
                    />
                  ) : null}

                  {userAssignment && String(userAssignment.status || '').toUpperCase() === 'PENDING' ? (
                    <Button
                      disabled={cancelMutation.isPending}
                      onPress={() => cancelMutation.mutate({ assignmentId: userAssignment.documentId || userAssignment.id })}
                      title="Annuler ma demande"
                      variant="Secondary"
                    />
                  ) : null}

                  {canModerateAssignments ? (
                    <Button
                      disabled={isFull}
                      onPress={() => openAssignMembersModal(task)}
                      title="Assigner des membres"
                      variant="Secondary"
                    />
                  ) : null}
                </View>

                {canModerateAssignments && pendingAssignments.length ? (
                  <View style={Spaces.gap[8]}>
                    <Text style={[Fonts.p3Bold, Fonts.neutral100]}>Volontaires en attente</Text>
                    {pendingAssignments.map((assignment) => (
                      <View
                        key={assignment.documentId || assignment.id || getUserKey(assignment?.user)}
                        style={[ApplicationStyle.card, Spaces.padding[12], Spaces.gap[8], {
                          backgroundColor: `${Colors.primary900}CC`,
                          borderColor: `${Colors.primary500}22`,
                        }]}
                      >
                        <Text style={[Fonts.p3Bold, Fonts.neutral100]}>{getUserDisplayName(assignment?.user)}</Text>
                        <Text style={[Fonts.p4, Fonts.neutral300]}>{getRoleLabel(assignment?.user)}</Text>
                        <View style={[Alignments.row, Spaces.gap[8], { flexWrap: 'wrap' }]}>
                          <Button
                            disabled={approveMutation.isPending}
                            onPress={() => approveMutation.mutate({ assignmentId: assignment.documentId || assignment.id })}
                            title="Valider"
                          />
                          <Button
                            disabled={rejectMutation.isPending}
                            onPress={() => rejectMutation.mutate({ assignmentId: assignment.documentId || assignment.id })}
                            title="Refuser"
                            variant="Secondary"
                          />
                        </View>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      </View>

      {isAssignMembersModalOpen ? (
        <BottomModal close={closeAssignMembersModal} isVisible snapPoints={['88%']} webPresentation="dialog">
          <ScrollView contentContainerStyle={[Spaces.gap[16], Spaces.paddingBottom[24]]} showsVerticalScrollIndicator={false}>
            <View style={Spaces.gap[8]}>
              <Text style={[Fonts.h3, Fonts.neutral00]}>
                {activeManagerTask?.title || 'Assigner des membres'}
              </Text>
              <Text style={[Fonts.p3, Fonts.neutral200]}>
                Sélectionne un ou plusieurs membres pour les affecter directement à cette tâche.
              </Text>
            </View>

            <View
              style={[ApplicationStyle.card, Spaces.padding[16], Spaces.gap[8], {
                backgroundColor: `${Colors.primary500}12`,
                borderColor: `${Colors.primary500}33`,
              }]}
            >
              <Text style={[Fonts.p3Bold, Fonts.neutral100]}>
                {activeRemainingSlots > 0
                  ? `${activeRemainingSlots} place(s) restante(s)`
                  : 'Cette tâche est déjà complété'}
              </Text>
              <Text style={[Fonts.p4, Fonts.neutral300]}>
                {selectedManagerMemberIds.length > 0
                  ? `${selectedManagerMemberIds.length} membre(s) prêt(s) à être assignes`
                  : 'Choisis les personnes à ajouter.'}
              </Text>
            </View>

            {activeAssignableCandidates.length > 0 ? (
              <View style={Spaces.gap[8]}>
                {activeAssignableCandidates.map((member) => {
                  const memberId = String(member?.documentId || member?.id || '');
                  const checked = selectedManagerMemberIds.includes(memberId);
                  return (
                    <TouchableOpacity
                      activeOpacity={0.9}
                      key={memberId}
                      onPress={() => toggleManagerMemberSelection(memberId)}
                      style={[
                        Alignments.row,
                        Alignments.alignCenter,
                        Spaces.gap[12],
                        {
                          backgroundColor: `${Colors.primary800}A6`,
                          borderColor: checked ? Colors.primary500 : `${Colors.primary500}33`,
                          borderRadius: 16,
                          borderWidth: 1,
                          padding: 12,
                        },
                      ]}
                    >
                      <Checkbox onValueChange={() => toggleManagerMemberSelection(memberId)} value={checked} />
                      <ProfileAvatar
                        enablePreview={false}
                        imageUrl={member?.avatar?.url}
                        size={40}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={[Fonts.p3Bold, Fonts.neutral00]}>{getUserDisplayName(member)}</Text>
                        <Text style={[Fonts.p4, Fonts.neutral300]}>{getRoleLabel(member)}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <View style={[ApplicationStyle.card, Spaces.padding[16], {
                backgroundColor: `${Colors.primary800}A6`,
                borderColor: `${Colors.primary500}22`,
              }]}
              >
                <Text style={[Fonts.p3, Fonts.neutral200]}>
                  Aucun membre supplémentaire n est disponible pour cette tâche pour le moment.
                </Text>
              </View>
            )}

            <View style={[Alignments.row, Spaces.gap[8], Spaces.paddingTop[8]]}>
              <Button onPress={closeAssignMembersModal} style={{ flex: 1 }} title="Annuler" variant="Secondary" />
              <Button
                disabled={selectedManagerMemberIds.length === 0 || managerAssignMutation.isPending || activeRemainingSlots === 0}
                isLoading={managerAssignMutation.isPending}
                onPress={confirmManagerAssignments}
                style={{ flex: 1 }}
                title="Assigner"
              />
            </View>
          </ScrollView>
        </BottomModal>
      ) : null}
    </>
  );
}

export default EventTasksSection;
