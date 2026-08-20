import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { USER_ROLES } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import { getCurrentUserEventParticipationState, resolveRsvpAnswer } from '@/domains/event/participationState';
import useEvent from '@/domains/event/useEvent';
import { resolveClientResponderDecision, resolveParticipationFlow } from '@/domains/participation/participationFlow';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Tag from '@/components/atoms/tag/Tag';

/**
 * Component for rendering event participation answer buttons
 * @param {object} props
 * @param {FCEvent} props.event - The event data
 * @param {() => void} props.onJoin - Callback when user wants to join
 * @param {() => void} props.onParticipate - Callback when user participate on its team event
 * @param {() => void} props.onDecline - Callback when user declines
 * @param {() => void} [props.onAbout] - Callback when user wants to see details
 * @param {() => void} props.onLogin - Callback when user needs to login
 * @param {boolean} [props.hasAcceptedRequest]
 * @param {boolean} [props.hasPendingRequest]
 * @param {() => void} [props.onDeleteParticipation] - Callback to delete their participation
 * @param {() => void} [props.onEdit] - Callback when user wants to edit the event
 * @param {() => void} [props.onCancel] - Callback when user wants to cancel the event
 * @param {ReturnType<typeof resolveParticipationFlow>} [props.participationFlow]
 * @returns {import('react').ReactElement} Event answer buttons component
 */
function EventAnswerButtons({
  event,
  hasAcceptedRequest,
  hasPendingRequest,
  onAbout,
  onCancel,
  onDecline,
  onDeleteParticipation,
  onEdit,
  onJoin,
  onLogin,
  onParticipate,
  participationFlow,
}) {
  // hooks
  const { t } = useTranslation();
  const { Alignments, Fonts, Spaces } = useTheme();
  const { userData } = useAuth();
  const { canEventBeJoined, haveIAlreadyAnsweredNo, haveIAlreadyJoined } = useEvent();

  // Check participation status
  const alreadyJoined = haveIAlreadyJoined({
    participations: event?.participations,
    userId: userData?.documentId,
  });

  const alreadyMissing = haveIAlreadyAnsweredNo({
    missings: event?.missings,
    userId: userData?.documentId,
  });
  const resolvedParticipationFlow = participationFlow || resolveParticipationFlow(event, {
    participationState: {
      hasAcceptedRequest,
      hasPendingRequest,
      isMissing: alreadyMissing,
      isParticipating: alreadyJoined,
    },
    user: userData,
  });
  // Derive ici plutot que recu en prop : les trois ecrans qui montent ce composant
  // (les deux cartes et le detail) transportent tous `event.participationRequests`,
  // et aucun ne savait dire « refusee ». Une seule source, trois trous fermes.
  const ownAnswer = getCurrentUserEventParticipationState({
    missings: event?.missings,
    participationRequests: event?.participationRequests,
    participations: event?.participations,
    user: userData,
  });
  const declinedAnswer = ownAnswer?.requestStatus === 'declined' ? ownAnswer.activeRequest : null;
  const isStageDayEvent = String(event?.eventFormat || '').trim().toLowerCase() === 'stage_day';
  // T02 — CETTE ECHELLE A DEUX LECTEURS DEPUIS LE 2026-08-17, elle ne vit donc
  // plus ici : le bandeau de l'accueil doit afficher le meme etat que cette
  // fiche, et deux echelles ecrites separement finissent toujours par diverger.
  // Les entrees sont RIGOUREUSEMENT celles d'avant — meme ordre, memes quatre
  // drapeaux : le rendu ne bouge pas d'un pixel.
  const dailyRsvpStatus = resolveRsvpAnswer({
    hasAcceptedRequest,
    hasPendingRequest,
    isMissing: alreadyMissing,
    isParticipating: alreadyJoined,
  });

  // W01 — QUI VOIT « PRESENT » / « ABSENT » : QUI FAIT PARTIE DE L EQUIPE.
  //
  // Le serveur accepte la reponse d un entraineur ou d un dirigeant MEMBRE
  // depuis le lot U02 ; ce composant, lui, ouvrait la rangee de reponse au seul
  // intitule `player`. Un encadrant convoque n avait donc AUCUN bouton — le
  // « bouton gris » du constat d Adel. On reutilise la meme fonction que la
  // regle partagee (`resolveClientSourceTeamForUser`) : une seule definition de
  // « membre » dans l app, celle que le serveur applique.
  //
  // ⛔ Un organisateur garde ses commandes : quand l appelant fournit
  // `onEdit` ET `onCancel`, c est qu il monte ce composant pour PILOTER
  // l evenement, pas pour y repondre. La branche du bas reste la sienne.
  //
  // Y07 (GO Adel du 2026-08-20) — MEMBRE, OUI ; REPONDEUR, NON.
  // Seuls les JOUEURS repondent. `resolveClientResponderDecision` est le miroir
  // du serveur (`event-audience.ts:819`) : `isStaffOnly` veut dire « d une
  // equipe conviee, mais pas joueur ». Le coach-joueur, lui, est dans
  // `team.players` : il repond comme avant, sans exception ecrite nulle part.
  //
  // ⚠️ `showsOrganizerActions` N A JAMAIS RIEN GARDE : aucun des appelants de
  // production ne passe `onEdit` ET `onCancel` (EventDetails.js:4591,
  // EventCardNew.js:606, EventCard.js:224 — seul un test le fournit). On ne
  // s appuie pas dessus, on le laisse tel quel : ce n est pas le sujet de Y07.
  const { isStaffOnly, sourceTeam } = resolveClientResponderDecision(event, userData);
  const isConvenedMember = Boolean(sourceTeam);
  const showsOrganizerActions = Boolean(onEdit && onCancel);
  const canAnswerAsMember = isConvenedMember && !showsOrganizerActions;

  // If user is a player — or a member of a convened team — show the answer buttons
  if (userData?.role?.name === USER_ROLES.player || canAnswerAsMember) {
    // Y07 — UN ENCADRANT LIT UNE PHRASE. ⛔ Jamais un bouton eteint, jamais rien.
    //
    // Le defaut d origine — « le bouton gris » du constat d Adel — se fabriquait
    // 120 lignes plus bas : `disabled` y appelle `canEventBeJoined` SANS lui
    // passer `type`, or cette fonction exige le role Joueur des que
    // `capacity > 0` ; et la phrase d a-cote exige `!canAct`, qui valait `true`.
    // Un bouton eteint, et muet. On sort AVANT d y arriver.
    //
    // 🔒 Le garde-fou de la sortie : une reponse DEJA ENREGISTREE continue de
    // s afficher. Y07 retire le droit de repondre, il n efface aucune reponse
    // posee avant lui — l encadrant qui avait dit « present » le voit toujours.
    const hasOwnAnswer = Boolean(
      alreadyJoined || alreadyMissing || hasAcceptedRequest || hasPendingRequest,
    );
    if (isStaffOnly && !hasOwnAnswer) {
      return (
        <View style={[Alignments.fullWidth, Spaces.gap[12]]}>
          <Text style={[Fonts.p4, Fonts.neutral300]}>
            {t('eventList.info.staffDoesNotRsvp')}
          </Text>
          {onAbout ? (
            <Button
              onPress={onAbout}
              style={Alignments.fullWidth}
              title={t('common.actions.seeMore', 'Voir le detail')}
              variant="SecondaryLight"
            />
          ) : null}
        </View>
      );
    }

    if (isStageDayEvent && dailyRsvpStatus) {
      let statusLabel = '';
      if (dailyRsvpStatus === 'present') statusLabel = t('eventList.info.alreadyJoined');
      if (dailyRsvpStatus === 'absent') statusLabel = t('eventList.info.alreadyMissing');

      return (
        <View style={[Alignments.fullWidth, Spaces.gap[12]]}>
          {statusLabel ? (
            <Tag
              text={statusLabel}
              textStyle={Fonts.p1Bold}
            />
          ) : null}
          <View style={[Alignments.row, Alignments.fullWidth, Spaces.gap[12]]}>
            <View style={{ flex: 1 }}>
              <Button
                disabled={dailyRsvpStatus === 'present'}
                onPress={onParticipate}
                style={Alignments.fullWidth}
                title={t('eventList.actions.present')}
                variant={dailyRsvpStatus === 'present' ? 'SecondaryLight' : 'Primary'}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                disabled={dailyRsvpStatus === 'absent'}
                onPress={onDecline}
                style={Alignments.fullWidth}
                title={t('eventList.actions.absent')}
                variant={dailyRsvpStatus === 'absent' ? 'SecondaryLight' : 'Secondary'}
              />
            </View>
          </View>
        </View>
      );
    }

    if (alreadyJoined || hasAcceptedRequest || hasPendingRequest) {
      return (
        <View style={[Alignments.fullWidth, Spaces.gap[16]]}>
          <Tag
            text={hasPendingRequest ? t('eventList.info.pendingRequest') : t('eventList.info.alreadyJoined')}
            textStyle={Fonts.p1Bold}
          />
          {onDeleteParticipation && (
            <Button
              onPress={onDeleteParticipation}
              style={Alignments.fullWidth}
              title={t('eventDetails.actions.cancelResponse')}
              variant="SecondaryLight"
            />
          )}
          {/* AA01 — LE RETOUR DE LA BASCULE, DANS L AUTRE SENS.
              Un membre qui avait dit « present » n avait plus qu un bouton :
              « Annuler ma participation », qui le ramene a « sans reponse ».
              Pour se declarer absent il fallait DEUX gestes, et le premier
              effacait sa reponse entre-temps — exactement ce que le constat
              d Adel du 2026-08-20 reproche a l autre sens.
              🔒 Reserve au MEMBRE d une equipe conviee : `POST /events/:id/missing`
              exige une equipe source (`event.ts:3068`) et refuserait un
              participant venu du dehors. */}
          {canAnswerAsMember ? (
            <Button
              onPress={onDecline}
              style={Alignments.fullWidth}
              title={t('eventList.actions.absent')}
              variant="Secondary"
            />
          ) : null}
        </View>
      );
    }

    if (alreadyMissing) {
      return (
        <View style={[Alignments.fullWidth, Spaces.gap[16]]}>
          <Tag
            text={t('eventList.info.alreadyMissing')}
            textStyle={Fonts.p1Bold}
          />
          {onDeleteParticipation && (
            <Button
              onPress={onDeleteParticipation}
              style={Alignments.fullWidth}
              title={t('eventDetails.actions.editResponse')}
              variant="SecondaryLight"
            />
          )}
        </View>
      );
    }

    const answerChoicesNode = (() => {
      if (event?.sessionStatus?.toLowerCase() === 'closed') {
        if (!resolvedParticipationFlow?.canAct) {
          return (
            <View style={[Alignments.fullWidth, Spaces.gap[16]]}>
              <Tag
                text={t('eventList.info.restrictedEvent', 'Accès réserve')}
                textStyle={Fonts.p1Bold}
              />
              {onAbout ? (
                <Button
                  onPress={onAbout}
                  style={Alignments.fullWidth}
                  title={t('common.actions.seeMore', 'Voir le detail')}
                  variant="SecondaryLight"
                />
              ) : null}
            </View>
          );
        }

        return (
          <View style={[Alignments.row, Alignments.fullWidth, Spaces.gap[12]]}>
            <View style={{ flex: 1 }}>
              <Button
                onPress={onParticipate}
                style={Alignments.fullWidth}
                title={t('eventList.actions.present')}
                variant="Primary"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                onPress={onDecline}
                style={Alignments.fullWidth}
                title={t('eventList.actions.absent')}
                variant="Secondary"
              />
            </View>
          </View>
        );
      }

      return (
        <View style={[Alignments.fullWidth, Spaces.gap[12]]}>
          <Button
            disabled={!resolvedParticipationFlow?.canAct || !canEventBeJoined({
              capacity: event?.capacity,
              participations: event?.participations,
              userId: userData?.documentId,
              userRole: userData?.role,
            })}
            onPress={onJoin}
            style={Alignments.fullWidth}
            title={resolvedParticipationFlow?.actionLabel || t('eventList.actions.join')}
            variant="Primary"
          />
          {!resolvedParticipationFlow?.canAct && resolvedParticipationFlow?.blockedReason ? (
            <Text style={[Fonts.p4, Fonts.neutral300]}>
              {resolvedParticipationFlow.blockedReason}
            </Text>
          ) : null}
        </View>
      );
    })();

    // Un refus ne se voyait NULLE PART : ni acceptee, ni en attente, ni absente,
    // la demande refusee remettait le joueur devant le bouton de depart, et il
    // redemandait en boucle. On le dit, avec le motif du staff quand il existe,
    // et on laisse les choix de reponse dessous : savoir ne doit pas bloquer.
    if (declinedAnswer) {
      return (
        <View style={[Alignments.fullWidth, Spaces.gap[12]]}>
          <Tag
            text={t('eventList.info.declinedRequest')}
            textStyle={Fonts.p1Bold}
          />
          {declinedAnswer.reason ? (
            <Text style={[Fonts.p4, Fonts.neutral300]}>
              {declinedAnswer.reason}
            </Text>
          ) : null}
          {answerChoicesNode}
        </View>
      );
    }

    return answerChoicesNode;
  }

  // If user is a coach or president, show edit and cancel buttons if provided
  if (userData?.role?.name === USER_ROLES.coach
     || userData?.role?.name === USER_ROLES.president) {
    if (onEdit && onCancel) {
      return (
        <View style={[Alignments.fullWidth, Spaces.gap[16]]}>
          <Button
            onPress={onEdit}
            title={t('eventDetails.actions.edit')}
            variant="Primary"
          />
          <Button
            onPress={onCancel}
            title={t('eventDetails.actions.cancelEvent')}
            variant="SecondaryLight"
          />
        </View>
      );
    }
    if (onAbout) {
      return (
        <Button
          onPress={onAbout}
          style={Alignments.fullWidth}
          title={t('eventList.actions.about')}
          variant="Primary"
        />
      );
    }
    return <View />;
  }

  // For non-logged in users, show login button
  return (
    <Button
      onPress={onLogin}
      style={Alignments.fullWidth}
      title={t('eventList.actions.join')}
      variant="Primary"
    />
  );
}

export default EventAnswerButtons;
