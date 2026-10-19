import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { USER_ROLES } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import { isMatchEventType } from '@/domains/event/eventUseCases';
import { getCurrentUserEventParticipationState, resolveRsvpAnswer } from '@/domains/event/participationState';
import { isRsvpEnabled } from '@/domains/event/presenceRule';
import useEvent from '@/domains/event/useEvent';
import {
  resolveClientResponderDecision,
  resolveParticipationFlow,
  resolveParticipationOffer,
} from '@/domains/participation/participationFlow';
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
 * @param {boolean} [props.isFinished] - FINITIONS13-STATS (6) : le match est FINI, selon
 *   l horloge du serveur (la fiche le sait, `isMatchFinished`). Plus aucune reponse ne
 *   s offre, sauf « je passe en present » quand la fiche l ouvre.
 * @param {() => void} [props.onDeclareLatePresence] - POINTAGE : la porte « je passe
 *   en present » du « pas renseigne », apres coup. La fiche ne la donne que
 *   quand `canDeclareLatePresence` l ouvre (`domains/event/presenceRule.js`).
 * @param {ReturnType<typeof resolveParticipationFlow>} [props.participationFlow]
 * @param {'present' | 'absent' | ''} [props.submittingAnswer] - T2 : la réponse
 *   en cours d envoi. Elle allume le bouton correspondant et prend les deux, le
 *   temps de l aller-retour. ⛔ Ce n est PAS un état optimiste : rien n est
 *   affiché comme acquis avant que le serveur ait répondu.
 * @returns {import('react').ReactElement | null} Event answer buttons component — `null`
 *   quand l organisateur a decoche « Les participants repondent » (POINTAGE).
 */
function EventAnswerButtons({
  event,
  hasAcceptedRequest,
  hasPendingRequest,
  isFinished = false,
  onAbout,
  onCancel,
  onDeclareLatePresence,
  onDecline,
  onDeleteParticipation,
  onEdit,
  onJoin,
  onLogin,
  onParticipate,
  participationFlow,
  submittingAnswer = '',
}) {
  // hooks
  const { t } = useTranslation();
  const { Alignments, Fonts, Spaces } = useTheme();
  const { isParentMode, userData } = useAuth();
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
  // 🕐 T2/D5 — L ÉCRAN RÉPOND TOUT DE SUITE, MÊME QUAND LE SERVEUR TARDE.
  //
  // Constat d Adel : « ça ne met pas directement le statut, donc on ne sait
  // pas ». Entre l appui et la réponse du serveur, ces deux boutons ne
  // changeaient RIEN — le doute (« est-ce que ça a marché ? ») faisait
  // ré-appuyer. On allume celui qu on vient d appuyer, et on prend les deux.
  //
  // ⛔ PAS D ÉTAT OPTIMISTE : aucune des quatre surfaces de participation n en
  // a un (0 `onMutate` dans le dépôt). En inventer un ici ferait diverger cet
  // écran des trois autres. Le retour visuel suffit à lever le constat.
  const isSubmitting = Boolean(submittingAnswer);
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
  // COACH1 (decision d Adel du 2026-09-21, qui remplace Y07) — l encadrant
  // MEMBRE repond Present / Absent, comme un joueur : c est la regle de W01,
  // retablie. `isStaffOnly` (« d une equipe conviee, mais pas joueur ») ne
  // retire plus rien : sur un MATCH, il fait seulement dire a l entraineur que
  // repondre Present l inscrit dans l encadrement de la convocation.
  //
  // ⚠️ `showsOrganizerActions` N A JAMAIS RIEN GARDE : aucun des appelants de
  // production ne passe `onEdit` ET `onCancel` (EventDetails.js, EventCardNew.js,
  // EventCard.js — seul un test le fournit). On ne s appuie pas dessus.
  const { isStaffOnly, sourceTeam } = resolveClientResponderDecision(event, userData);
  const isConvenedMember = Boolean(sourceTeam);
  const showsOrganizerActions = Boolean(onEdit && onCancel);
  const canAnswerAsMember = isConvenedMember && !showsOrganizerActions;
  // FINITIONS16 · POINT 1 (T15) — la MEME regle que le site (`EventDetails.web.js`).
  const participationOffer = resolveParticipationOffer({
    isConvenedMember: canAnswerAsMember,
    isParentMode,
    user: userData,
  });

  // 🏁 FINITIONS13-STATS (6, T13) — SOUS UN MATCH FINI, PLUS DE REPONSE. Hugo lisait
  // « Je participe ! » et « Annuler ma participation » sous le match du 3 oct. termine ; le
  // serveur refuse toute reponse apres coup (`validateDateIsInFuture`). Seule la porte
  // « je passe en present » (POINTAGE, reponse B) reste, quand la fiche l ouvre.
  if (isFinished && !onDeclareLatePresence) return null;

  // If user is a player — or a member of a convened team — show the answer buttons
  if (participationOffer === 'answer') {
    // 🚫 POINTAGE (decision d Adel du 29/09) — « LES PARTICIPANTS REPONDENT »
    // DECOCHEE : la rangee disparait, sans motif de refus. Rien a expliquer :
    // l organisateur a choisi qu on ne reponde pas. Une personne du dehors
    // (non conviee) garde sa demande de participation, comme au serveur.
    if (isConvenedMember && !isRsvpEnabled(event)) return null;

    // 🙋 POINTAGE (« reponse B ») — APRES COUP, LE « PAS RENSEIGNE » PEUT
    // PASSER PRESENT. La fiche ne tend cette porte que quand elle est ouverte.
    if (onDeclareLatePresence) {
      return (
        <View style={[Alignments.fullWidth, Spaces.gap[12]]}>
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {t('eventList.info.notReported')}
          </Text>
          <Button
            disabled={isSubmitting}
            isLoading={submittingAnswer === 'present'}
            onPress={onDeclareLatePresence}
            style={Alignments.fullWidth}
            title={t('eventList.actions.declareLatePresence')}
            variant="Primary"
          />
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
                disabled={dailyRsvpStatus === 'present' || isSubmitting}
                isLoading={submittingAnswer === 'present'}
                onPress={onParticipate}
                style={Alignments.fullWidth}
                title={t('eventList.actions.present')}
                variant={dailyRsvpStatus === 'present' ? 'SecondaryLight' : 'Primary'}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                disabled={dailyRsvpStatus === 'absent' || isSubmitting}
                isLoading={submittingAnswer === 'absent'}
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
          {/* R4 (DECISION D ADEL DU 2026-08-24) — UN SEUL BOUTON, ET IL MARQUE ABSENT.

              Cet etat en portait DEUX pour un seul geste : « Annuler ma
              participation », qui remettait « sans reponse », et « Absent·e »,
              qui creait la ligne 'missing'. Adel l a dit en recette : c est un
              doublon, et « Absent·e » se lit comme un ETAT (« je suis absent »)
              alors que c est une action. Il n en reste qu un.

              🎯 CE BOUTON NE DECIDE PLUS DE CE QU IL FAIT. Effacer la reponse
              ou marquer absent se tranche dans `resolveOwnAnswerAction`
              (`views/event/ownAnswerAction.js`) : un seul endroit, teste, que
              la fiche ET la carte de liste consultent. Le libelle ne peut donc
              plus promettre autre chose que ce que le geste fait.

              ⛔ Surtout pas `onDecline` ici : il agit SANS confirmation
              (`EventDetails.js:2866`), et ce bouton en demande une depuis
              toujours. La porte `onDeleteParticipation` est celle qui
              confirme. */}
          {onDeleteParticipation && (
            <Button
              onPress={onDeleteParticipation}
              style={Alignments.fullWidth}
              title={t('eventDetails.actions.cancelResponse')}
              variant="SecondaryLight"
            />
          )}
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
      // D5 (retour de recette du 2026-08-24) — OUVRIR UNE SEANCE NE DOIT PAS
      // RETIRER SES BOUTONS A CELUI QUI EST DEJA CONVIE.
      //
      // 📏 CE QU ADEL A VU : la MEME seance, passee de « privee » a
      // « ouverte », remplace Present / Absent par un « Participer » gris ET
      // MUET. Le mecanisme, parce qu il n est pas devinable : la rangee de
      // reponse etait reservee a `sessionStatus === 'closed'` ; ailleurs, tout
      // le monde tombait sur « Participer », que `canEventBeJoined` eteint des
      // que `capacity > 0` pour qui n a pas le role « Joueur » — et la phrase
      // d a-cote exigeait `!canAct`, qui valait `true`. Bouton eteint, pas un
      // mot.
      //
      // 🎯 Etre CONVIE decide de la rangee de reponse. Que la seance accepte du
      // monde EN PLUS ne change rien pour ceux qui sont deja attendus.
      const isClosedSession = event?.sessionStatus?.toLowerCase() === 'closed';

      if (isClosedSession || canAnswerAsMember) {
        if (!resolvedParticipationFlow?.canAct) {
          return (
            <View style={[Alignments.fullWidth, Spaces.gap[16]]}>
              <Tag
                text={t('eventList.info.restrictedEvent', 'Accès réservé')}
                textStyle={Fonts.p1Bold}
              />
              {/* ⛔ JAMAIS MUET : quand le flux sait POURQUOI il refuse, il le
                  dit. Une porte fermee sans motif se lit comme une panne. */}
              {resolvedParticipationFlow?.blockedReason ? (
                <Text style={[Fonts.p4, Fonts.neutral300]}>
                  {resolvedParticipationFlow.blockedReason}
                </Text>
              ) : null}
              {onAbout ? (
                <Button
                  onPress={onAbout}
                  style={Alignments.fullWidth}
                  title={t('common.actions.seeMore', 'Voir le détail')}
                  variant="SecondaryLight"
                />
              ) : null}
            </View>
          );
        }

        const answerRow = (
          <View style={[Alignments.row, Alignments.fullWidth, Spaces.gap[12]]}>
            <View style={{ flex: 1 }}>
              <Button
                disabled={isSubmitting}
                isLoading={submittingAnswer === 'present'}
                onPress={onParticipate}
                style={Alignments.fullWidth}
                title={t('eventList.actions.present')}
                variant="Primary"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                disabled={isSubmitting}
                isLoading={submittingAnswer === 'absent'}
                onPress={onDecline}
                style={Alignments.fullWidth}
                title={t('eventList.actions.absent')}
                variant="Secondary"
              />
            </View>
          </View>
        );

        // COACH1 — sur un MATCH, se convoquer = repondre Present : l entraineur
        // apparait alors dans l encadrement de la convocation publiee. Sans
        // cette phrase, rien ne le lui disait. Le coach-joueur n est pas
        // `isStaffOnly` : il se convoque comme un joueur, il ne la lit pas.
        if (!isStaffOnly || !isMatchEventType(event?.type?.name)) return answerRow;

        return (
          <View style={[Alignments.fullWidth, Spaces.gap[8]]}>
            {answerRow}
            <Text style={[Fonts.p4, Fonts.neutral300]}>
              {t('eventList.info.staffJoinsConvocation')}
            </Text>
          </View>
        );
      }

      const canJoinEvent = canEventBeJoined({
        capacity: event?.capacity,
        participations: event?.participations,
        userId: userData?.documentId,
        userRole: userData?.role,
      });
      const isEventFull = Boolean(event?.capacity)
        && (event?.participations?.length || 0) >= Number(event.capacity);

      // ⛔ PAS DE BOUTON ETEINT SANS MOTIF (suite de D5). A cet endroit,
      // `canEventBeJoined` ne refuse plus que sur la jauge : la reponse deja
      // donnee est traitee bien plus haut, et qui n est pas « Joueur » n arrive
      // ici que s il est convie — auquel cas il a la rangee ci-dessus.
      // 🔒 On ne l ecrit QUE si on peut le prouver (`isEventFull`) : un motif
      // invente serait pire que le silence d avant.
      let joinBlockedReason = '';
      if (!resolvedParticipationFlow?.canAct) {
        joinBlockedReason = resolvedParticipationFlow?.blockedReason || '';
      } else if (!canJoinEvent && isEventFull) {
        joinBlockedReason = t('eventList.info.eventFull', 'Cet événement est complet.');
      }

      return (
        <View style={[Alignments.fullWidth, Spaces.gap[12]]}>
          <Button
            disabled={!resolvedParticipationFlow?.canAct || !canJoinEvent}
            onPress={onJoin}
            style={Alignments.fullWidth}
            title={resolvedParticipationFlow?.actionLabel || t('eventList.actions.join')}
            variant="Primary"
          />
          {joinBlockedReason ? (
            <Text style={[Fonts.p4, Fonts.neutral300]}>
              {joinBlockedReason}
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

  // 👪 FINITIONS13-STATS (6, T13) — UN COMPTE CONNECTE N EST PAS UN VISITEUR. Papa Test
  // (role Parent), sur la page du match de son fils, lisait « Participer » : cette branche, celle
  // du visiteur NON connecte, ouvrait… la connexion. Connecte, ni joueur ni encadrant : rien.
  // 👪 PAR-L11b (13/10) — un parent n a rien a repondre POUR LUI : son bloc « Inscrire mes enfants »
  // vit a part (EventChildRegistration.js), jamais dans cette rangee.
  if (participationOffer === 'none' || participationOffer === 'children') return null;

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
