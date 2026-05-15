// @ts-nocheck
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Alert, Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';

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

const isTrainerForUser = (team, user) => {
  const userKey = getUserKey(user);
  if (!userKey) return false;
  return Array.isArray(team?.trainers) && team.trainers.some((trainer) => getUserKey(trainer) === userKey);
};

function EventTasksSection({ canManageEvent = false, event, userData }) {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const queryClient = useQueryClient();
  const tasks = useMemo(() => (Array.isArray(event?.eventTasks) ? event.eventTasks : []), [event?.eventTasks]);
  const currentUserKey = getUserKey(userData);
  const hasCurrentUser = Boolean(currentUserKey);
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
    onError: (error) => Alert.alert('Erreur', error?.message || 'Impossible de rejoindre cette tache.'),
    onSuccess: refreshEvent,
  });
  const approveMutation = useMutation({
    mutationFn: ({ assignmentId }) => approveEventTaskAssignment(assignmentId),
    onError: (error) => Alert.alert('Erreur', error?.message || 'Impossible de valider cette assignation.'),
    onSuccess: refreshEvent,
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

  if (!tasks.length) return null;

  return (
    <View
      style={[ApplicationStyle.card, Spaces.padding[16], Spaces.gap[12], {
        backgroundColor: `${Colors.primary700}66`,
        borderColor: `${Colors.primary500}44`,
      }]}
    >
      <Text style={[Fonts.h4, Fonts.neutral00]}>Organisation de l&apos;evenement</Text>
      <View style={Spaces.gap[12]}>
        {tasks.map((task) => {
          const assignments = Array.isArray(task?.assignments) ? task.assignments : [];
          const approvedCount = assignments.filter((assignment) => String(assignment?.status || '').toUpperCase() === 'APPROVED').length;
          const pendingAssignments = assignments.filter((assignment) => String(assignment?.status || '').toUpperCase() === 'PENDING');
          const userAssignment = assignments.find((assignment) => getUserKey(assignment?.user) === currentUserKey) || null;
          const isFull = approvedCount >= Number(task?.requiredCount || 1);

          return (
            <View
              key={task.documentId || task.id || task.title}
              style={[ApplicationStyle.card, Spaces.padding[12], Spaces.gap[8], {
                backgroundColor: `${Colors.primary800}A6`,
                borderColor: `${Colors.primary500}33`,
              }]}
            >
              <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter]}>
                <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{task.title}</Text>
                <Text style={[Fonts.p3Bold, isFull ? Fonts.gold500 : Fonts.primary500]}>
                  {approvedCount}
                  {' / '}
                  {Number(task?.requiredCount || 1)}
                </Text>
              </View>
              {task.description ? (
                <Text style={[Fonts.p3, Fonts.neutral200]}>{task.description}</Text>
              ) : null}
              <Text style={[Fonts.p3, Fonts.neutral300]}>
                {String(task.validationMode || 'AUTO') === 'MANUAL' ? 'Validation manuelle' : 'Validation automatique'}
              </Text>
              {userAssignment ? (
                <Text style={[Fonts.p3Bold, Fonts.neutral100]}>
                  {'Votre statut: '}
                  {String(userAssignment.status || '').toUpperCase()}
                </Text>
              ) : null}
              <View style={[Alignments.row, Spaces.gap[8], { flexWrap: 'wrap' }]}>
                {!userAssignment && !isFull && hasCurrentUser ? (
                  <Button
                    disabled={assignMutation.isPending}
                    onPress={() => assignMutation.mutate({ taskId: task.documentId || task.id })}
                    title="Je m'assigne"
                    variant="Secondary"
                  />
                ) : null}
                {userAssignment && String(userAssignment.status || '').toUpperCase() === 'PENDING' ? (
                  <Button
                    disabled={cancelMutation.isPending}
                    onPress={() => cancelMutation.mutate({ assignmentId: userAssignment.documentId || userAssignment.id })}
                    title="Annuler"
                    variant="Secondary"
                  />
                ) : null}
              </View>
              {canModerateAssignments && pendingAssignments.length ? (
                <View style={Spaces.gap[8]}>
                  <Text style={[Fonts.p3Bold, Fonts.neutral100]}>Demandes en attente</Text>
                  {pendingAssignments.map((assignment) => (
                    <View
                      key={assignment.documentId || assignment.id || getUserKey(assignment?.user)}
                      style={[ApplicationStyle.card, Spaces.padding[12], Spaces.gap[8], {
                        backgroundColor: `${Colors.primary900}CC`,
                        borderColor: `${Colors.primary500}22`,
                      }]}
                    >
                      <Text style={[Fonts.p3, Fonts.neutral100]}>{getUserDisplayName(assignment?.user)}</Text>
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
  );
}

export default EventTasksSection;
