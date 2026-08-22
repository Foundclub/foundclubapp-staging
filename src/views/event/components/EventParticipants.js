// @ts-nocheck
import { useIsMutating } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image, Text, TouchableOpacity, View,
} from 'react-native';

import { REMIND_EVENT_MUTATION_KEY } from '@/domains/event/remindReport';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import SearchBar from '@/components/molecules/searchBar/SearchBar';

// import statique (pas require) : require n'existe pas sur le rendu web ESM.
import SHARE_ICON from '@/assets/icons/share2.png';

/**
 * @typedef {{
 *   id?: string | number;
 *   documentId?: string;
 *   firstname?: string;
 *   lastname?: string;
 *   email?: string;
 *   phone?: string;
 *   phoneNumber?: string;
 *   position?: string;
 *   avatar?: { url?: string };
 * }} User
 */
/**
 * @typedef {{ documentId?: string; user: User; sourceTeam?: { documentId?: string;
 *   name?: string }; participationStatus?: string; isActive?: boolean }} PendingParticipation
 */
/**
 * @typedef {object} ParticipationsByStatus
 * @property {User[]} participating
 * @property {User[]} missing
 * @property {User[]} notAnswered
 */
/**
 * @typedef {{
 *   arrivedAt?: string | null,
 *   attendanceStatus?: 'not_marked' | 'declared_late' | 'arrived_on_time' | 'arrived_late' | 'no_show' | null,
 *   countsInTeamStats?: {
 *     absence?: boolean,
 *     attendance?: boolean,
 *     late?: boolean,
 *     rsvpYes?: boolean,
 *   } | null,
 *   declaredAt?: string | null,
 *   declaredLateMinutes?: number | null,
 *   declarationSource?: string | null,
 *   finalOperationalStatus?: 'present' | 'late' | 'absent' | 'pending' | null,
 *   finalState?: 'declared_late' | 'arrived_on_time' | 'arrived_late' | 'no_show' | null,
 *   finalizedAt?: string | null,
 *   lateMinutes?: number | null,
 *   source?: string | null,
 *   manualOverride?: boolean,
 *   note?: string | null,
 *   rsvpStatus?: 'participating' | 'missing' | 'pending' | 'not_answered' | null,
 *   updatedBy?: { firstname?: string, lastname?: string } | null
 * }} AttendanceState
 */
/**
 * @typedef {{
 *   key: string;
 *   teamName: string;
 *   isHome?: boolean;
 *   isExternal?: boolean;
 *   allowCoachActions?: boolean;
 *   participating: User[];
 *   missing: User[];
 *   notAnswered: User[];
 *   pending?: PendingParticipation[];
 *   historical?: {
 *     participating?: User[];
 *     missing?: User[];
 *     pending?: PendingParticipation[];
 *   };
 * }} TeamParticipationSection
 */
/**
 * @typedef {object} EventParticipantsProps
 * @property {import('@/domains/event/types').FCEvent | undefined} event
 * @property {ParticipationsByStatus | undefined} participationsByStatus
 * @property {PendingParticipation[]} pendingParticipations
 * @property {TeamParticipationSection[]} [teamParticipationSections]
 * @property {TeamParticipationSection | null} [externalParticipationSection]
 * @property {{ participatingCount?: number; capacity?: number }} [participantsSummary]
 * @property {boolean} canEdit
 * @property {boolean} [canApprovePendingRequests]
 * @property {(user?: User) => void} handleUserPress
 * @property {() => void} handleRemindPlayers
 * @property {() => void} handleShare
 * @property {() => void} handleExportParticipants
 * @property {(participationId?: string, status?: 'accepted' | 'declined') => void} [handleUpdateParticipation]
 * @property {Record<string, AttendanceState>} [attendanceByUserId]
 * @property {Date | null | undefined} [eventStartAt]
 * @property {number | undefined} [nowMs]
 * @property {(user?: User) => void} [onCoachMarkArrival]
 * @property {(user?: User) => void} [onCoachEditLate]
 */

/**
 * @param {User | undefined} user
 * @returns {string}
 */
function getUserDisplayName(user) {
  const firstname = String(user?.firstname || '').trim();
  const lastname = String(user?.lastname || '').trim();
  const fullName = [firstname, lastname].filter(Boolean).join(' ').trim();
  if (fullName) return fullName;

  const username = String(user?.username || '').trim();
  if (username && !/^[+()\d\s-]{8,}$/.test(username)) return username;

  const phoneNumber = String(user?.phoneNumber || user?.phone || '').trim();
  if (phoneNumber) return phoneNumber;

  return 'Utilisateur';
}

const getStaffDisplayName = (user) => {
  const firstname = String(user?.firstname || '').trim();
  const lastname = String(user?.lastname || '').trim();
  return [firstname, lastname].filter(Boolean).join(' ').trim() || 'Staff';
};

/**
 * AE02 : reduit un texte a sa forme comparable — sans accent, sans casse.
 *
 * 🔤 Le motif est celui d `eventDisplayName.js:38-44`, RECOPIE et non importe :
 * la-bas c est un `const` de module qui n est pas exporte, et ce module parle
 * d adversaires de match, pas de participants. Trois lignes recopiees valent
 * mieux qu un export ouvert dans un fichier qui ne demandait rien.
 * @param {any} valeur - Le texte a reduire.
 * @returns {string} - Sa forme comparable.
 */
const comparable = (valeur) => (valeur === null || valeur === undefined ? '' : String(valeur))
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

/**
 * AD06 (L3-B) : l heure d arrivee existait dans la reponse du serveur et
 * n etait affichee NULLE PART. On la rend en heure LOCALE courte (14:32).
 * Une valeur illisible rend une chaine vide : jamais « Invalid Date ».
 * @param {string | null | undefined} arrivedAt
 * @returns {string}
 */
const formatArrivalTime = (arrivedAt) => {
  if (!arrivedAt) return '';
  const date = new Date(arrivedAt);
  if (Number.isNaN(date.getTime())) return '';
  const heures = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${heures}:${minutes}`;
};

const resolveAttendanceBadge = ({
  allowLiveLate = false,
  attendance,
  colors,
  eventStartAt,
  nowMs,
  statusKind = 'participating',
  t = (/** @type {string} */ clef, /** @type {any} */ valeurParDefaut) => valeurParDefaut,
}) => {
  const normalizedAttendanceStatus = String(
    attendance?.attendanceStatus || attendance?.finalState || '',
  ).trim().toLowerCase();
  const normalizedRsvpStatus = String(attendance?.rsvpStatus || '').trim().toLowerCase();
  const hasArrived = Boolean(attendance?.arrivedAt);
  const lateMinutes = Math.max(0, Number(attendance?.lateMinutes || 0));
  const declaredLateMinutes = Math.max(0, Number(attendance?.declaredLateMinutes || 0));

  let runningLateMinutes = 0;
  if (!hasArrived && allowLiveLate && eventStartAt && typeof nowMs === 'number') {
    const eventStartMs = eventStartAt.getTime();
    if (!Number.isNaN(eventStartMs) && nowMs > eventStartMs) {
      runningLateMinutes = Math.max(0, Math.floor((nowMs - eventStartMs) / 60000));
    }
  }

  if (normalizedAttendanceStatus === 'no_show') {
    return {
      backgroundColor: `${colors.error500}18`,
      borderColor: `${colors.error500}36`,
      textColor: colors.error500,
      title: t('eventDetails.attendanceBadge.notMarked', 'Non pointé'),
      value: null,
    };
  }

  if (statusKind === 'missing' || normalizedRsvpStatus === 'missing') {
    return {
      backgroundColor: `${colors.error500}18`,
      borderColor: `${colors.error500}36`,
      textColor: colors.error300,
      title: 'Absent',
      value: null,
    };
  }

  if (statusKind === 'not_answered' || normalizedRsvpStatus === 'not_answered') {
    return {
      backgroundColor: `${colors.neutral300}12`,
      borderColor: `${colors.neutral300}24`,
      textColor: colors.neutral200,
      title: 'Sans réponse',
      value: null,
    };
  }

  if (hasArrived) {
    if (lateMinutes > 0) {
      return {
        backgroundColor: `${colors.warning500}18`,
        borderColor: `${colors.warning500}36`,
        textColor: colors.warning500,
        title: t('eventDetails.attendanceBadge.arrived', 'Arrivé'),
        value: `+${lateMinutes} min`,
      };
    }

    return {
      backgroundColor: `${colors.success500}18`,
      borderColor: `${colors.success500}36`,
      textColor: colors.success500,
      title: t('eventDetails.attendanceBadge.arrived', 'Arrivé'),
      value: null,
    };
  }

  if (normalizedAttendanceStatus === 'declared_late' || declaredLateMinutes > 0) {
    return {
      backgroundColor: `${colors.warning500}18`,
      borderColor: `${colors.warning500}36`,
      textColor: colors.warning500,
      title: t('eventDetails.attendanceBadge.declaredLate', 'Retard annoncé'),
      value: `+${declaredLateMinutes} min`,
    };
  }

  if (runningLateMinutes > 0) {
    return {
      backgroundColor: `${colors.warning500}18`,
      borderColor: `${colors.warning500}36`,
      textColor: colors.warning500,
      title: 'En attente',
      value: `+${runningLateMinutes} min`,
    };
  }

  return {
    backgroundColor: `${colors.neutral300}12`,
    borderColor: `${colors.neutral300}24`,
    textColor: colors.neutral200,
    title: 'En attente',
    value: null,
  };
};

/**
 * @param {EventParticipantsProps} props
 */
function EventParticipants({
  attendanceByUserId = {},
  canEdit,
  canApprovePendingRequests = canEdit,
  event,
  eventStartAt,
  externalParticipationSection = null,
  handleExportParticipants,
  handleRemindPlayers,
  handleShare,
  handleUpdateParticipation,
  handleUserPress,
  nowMs,
  onCoachEditLate,
  onCoachMarkArrival,
  participantsSummary,
  participationsByStatus,
  pendingParticipations,
  teamParticipationSections = [],
}) {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  // AC07 : le bouton se grise TANT QUE la relance est en vol. On lit l etat de
  // la mutation par sa clef plutot que par une prop : `EventDetails` n a rien a
  // faire descendre, et les deux boutons « Relancer » de cet ecran se grisent
  // ensemble — ils declenchent le meme envoi.
  const isReminding = useIsMutating({ mutationKey: REMIND_EVENT_MUTATION_KEY }) > 0;
  const areParticipantIdentitiesHidden = event?.participantIdentitiesHidden === true;
  // AE02 (1E partiel) — CHERCHER UN NOM.
  // La saisie vit ICI, en etat local : `EventDetails` est tenu par un autre lot
  // et ne peut recevoir aucune prop neuve. ⚠️ Saisie vide = l ecran STRICTEMENT
  // d avant — c est ce qui protege le filet d AD06, qui ne tape jamais rien.
  const [rechercheNom, setRechercheNom] = useState('');
  const rechercheComparable = comparable(rechercheNom);
  const rechercheActive = rechercheComparable.length > 0;

  /**
   * Ce nom est-il retenu par la recherche en cours ?
   * @param {User | undefined} personne - La personne a tester.
   * @returns {boolean} - Vrai si elle reste affichee.
   */
  const correspond = (personne) => !rechercheActive
    || comparable(getUserDisplayName(personne)).includes(rechercheComparable);

  /**
   * Filtre une liste de joueurs par la recherche en cours.
   * ⚠️ Au repos elle rend la liste D ORIGINE, telle quelle : pas de copie, donc
   * pas le moindre ecart de rendu quand la barre est vide.
   * @param {User[] | undefined} joueurs - La liste d origine.
   * @returns {User[] | undefined} - La liste filtree, ou l originale au repos.
   */
  const filtrerJoueurs = (joueurs) => (rechercheActive
    ? (joueurs || []).filter(correspond)
    : joueurs);

  /**
   * Filtre une liste de demandes de participation par la recherche en cours.
   * @param {PendingParticipation[] | undefined} demandes - La liste d origine.
   * @returns {PendingParticipation[] | undefined} - La liste filtree, ou l originale.
   */
  const filtrerDemandes = (demandes) => (rechercheActive
    ? (demandes || []).filter((demande) => correspond(demande?.user))
    : demandes);

  const renderParticipant = (player, options = {}) => {
    const userId = player?.documentId || '';
    const attendance = userId ? attendanceByUserId[userId] : null;
    return (
      <ParticipantItem
        allowLiveLate={Boolean(options.allowLiveLate)}
        attendance={attendance}
        canEdit={Boolean(options.showCoachActions)}
        eventStartAt={eventStartAt}
        key={`${options.keyPrefix || 'participant'}-${player.documentId || userId}`}
        nowMs={nowMs}
        onEditLate={onCoachEditLate}
        onMarkArrival={onCoachMarkArrival}
        onPress={handleUserPress}
        player={player}
        statusKind={options.statusKind || 'participating'}
        styles={{
          Alignments, ApplicationStyle, Colors, Fonts, Spaces,
        }}
        t={t}
      />
    );
  };

  const renderPendingCard = (participation, indexKey) => (
    <TouchableOpacity
      key={participation.documentId || `pending-${indexKey}`}
      onPress={() => handleUserPress(participation.user)}
      style={[
        ApplicationStyle.borderRadius24,
        Alignments.row,
        Alignments.fill,
        ApplicationStyle.backgroundColor.primary700,
        Spaces.padding[24],
        Spaces.gap[24],
      ]}
    >
      <View style={[Alignments.row, Spaces.gap[16], Alignments.alignCenter, Alignments.fill]}>
        <ProfileAvatar
          imageStyle={{ borderRadius: 40 }}
          imageUrl={participation.user.avatar?.url}
          name={getUserDisplayName(participation.user)}
          size={40}
          style={[ApplicationStyle.borderWidth1, ApplicationStyle.borderColor.neutral00, { borderRadius: 40 }]}
        />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={2} style={[Fonts.p1Bold, Fonts.neutral00, { flexShrink: 1 }]}>
            {getUserDisplayName(participation.user)}
          </Text>
          {participation?.sourceTeam?.name ? (
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              {participation.sourceTeam.name}
            </Text>
          ) : null}
        </View>
      </View>
      {canApprovePendingRequests ? (
        <View style={[Alignments.row, Spaces.gap[8], Alignments.justifyCenter]}>
          <Button
            icon="check"
            isOption
            onPress={() => handleUpdateParticipation && handleUpdateParticipation(participation.documentId, 'accepted')}
            variant="Primary"
          />
          <Button
            icon="close"
            isOption
            onPress={() => handleUpdateParticipation && handleUpdateParticipation(participation.documentId, 'declined')}
            variant="Secondary"
          />
        </View>
      ) : null}
    </TouchableOpacity>
  );

  const renderStatusGroup = (title, players, options = {}) => {
    // AD06 (L6-F) : un groupe vide rendait `null`, TITRE COMPRIS — un trou
    // dans l ecran. Il garde desormais son titre et dit POURQUOI il est
    // vide, en UNE ligne (pas `EmptyState`, qui est un bloc de page :
    // icone 80 px et 24 de marge, beaucoup trop gros dans une carte).
    // Sans message fourni, on garde le silence d avant : c est ce qui
    // laisse l historique invisible quand il est vide.
    if (!players?.length) {
      // AE02 : pendant une recherche, un groupe sans resultat DISPARAIT, titre
      // compris. Garder « Aucune absence signalée. » serait un mensonge : il y
      // a peut-etre des absents, ils ne portent juste pas le nom cherche.
      if (!options.emptyMessage || rechercheActive) return null;
      return (
        <>
          <Text style={[Fonts.h4Bold, Fonts.primary500]}>
            {title}
          </Text>
          <Text style={[Fonts.p3, Fonts.neutral300]}>
            {options.emptyMessage}
          </Text>
        </>
      );
    }
    return (
      <>
        <Text style={[Fonts.h4Bold, Fonts.primary500]}>
          {title}
        </Text>
        {players.map((player) => renderParticipant(player, options))}
      </>
    );
  };

  const getSectionBadgeMeta = (section) => {
    if (section.isExternal) {
      return {
        text: t('eventDetails.invitedTeams.externalBadge', 'Ouvert à tous'),
        textStyle: [Fonts.p4, Fonts.primary100],
      };
    }
    if (section.isHome) {
      return {
        text: t('eventDetails.invitedTeams.homeTeamBadge', 'Équipe organisatrice'),
        textStyle: [Fonts.p4, Fonts.primary500],
      };
    }
    return {
      text: t('eventDetails.invitedTeams.invitedTeamBadge', 'Équipe invitée'),
      textStyle: [Fonts.p4, Fonts.primary100],
    };
  };

  const renderTeamSection = (section) => {
    const pending = section.pending || [];
    const historical = section.historical || {};
    const historicalPending = historical.pending || [];
    const historicalParticipating = historical.participating || [];
    const historicalMissing = historical.missing || [];
    const hasHistorical = historicalPending.length
      || historicalParticipating.length
      || historicalMissing.length;

    const sectionBadge = getSectionBadgeMeta(section);

    return (
      <View
        key={section.key}
        style={[
          Spaces.gap[12],
          ApplicationStyle.backgroundColor.primary700,
          ApplicationStyle.borderRadius24,
          Spaces.padding[16],
        ]}
      >
        <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.gap[8]]}>
          <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
            {section.teamName}
          </Text>
          <Text style={sectionBadge.textStyle}>
            {sectionBadge.text}
          </Text>
        </View>

        {canApprovePendingRequests && pending.length > 0 ? (
          <View style={[Spaces.gap[12]]}>
            <Text style={[Fonts.p3Bold, Fonts.primary500]}>
              {t('eventDetails.fields.participationRequests')}
            </Text>
            {pending.map(renderPendingCard)}
          </View>
        ) : null}

        {renderStatusGroup(
          t('eventDetails.participationStatus.participating'),
          section.participating,
          {
            allowLiveLate: true,
            emptyMessage: t('eventDetails.emptyStates.noConfirmation'),
            keyPrefix: `${section.key}-present`,
            showCoachActions: section.allowCoachActions ?? canEdit,
            statusKind: 'participating',
          },
        )}

        {renderStatusGroup(
          t('eventDetails.participationStatus.missing'),
          section.missing,
          {
            allowLiveLate: false,
            emptyMessage: t('eventDetails.emptyStates.noAbsence'),
            keyPrefix: `${section.key}-missing`,
            statusKind: 'missing',
            statusLabel: t('eventDetails.participationStatus.missing'),
          },
        )}

        {section.notAnswered?.length ? (
          <>
            <View style={[Alignments.row, Alignments.alignCenter, Alignments.spaceBetween, Spaces.gap[16]]}>
              <Text style={[Fonts.h4Bold, Fonts.primary500]}>
                {t('eventDetails.participationStatus.notAnswered')}
              </Text>
              {canEdit ? (
                <Button isLoading={isReminding} isOption onPress={handleRemindPlayers} title={t('eventDetails.actions.remind')} variant="Primary" />
              ) : null}
            </View>
            {section.notAnswered.map((player) => renderParticipant(player, {
              allowLiveLate: false,
              keyPrefix: `${section.key}-not-answered`,
              statusKind: 'not_answered',
              statusLabel: t('eventDetails.participationStatus.notAnswered'),
            }))}
          </>
        ) : null}

        {section.notAnswered?.length ? null : renderStatusGroup(
          t('eventDetails.participationStatus.notAnswered'),
          [],
          { emptyMessage: t('eventDetails.emptyStates.allAnswered') },
        )}

        {hasHistorical ? (
          <View style={[Spaces.gap[8], Spaces.marginTop[8]]}>
            <Text style={[Fonts.p3Bold, Fonts.neutral300]}>
              {section.isExternal
                ? t('eventDetails.invitedTeams.externalHistoricalTitle', 'Historique participants externes')
                : t('eventDetails.invitedTeams.historicalTitle', 'Historique équipe retirée')}
            </Text>
            {historicalPending.length > 0 ? (
              <Text style={[Fonts.p4, Fonts.neutral300]}>
                {t('eventDetails.invitedTeams.historicalPending', '{{count}} réponse(s) en attente').replace('{{count}}', String(historicalPending.length))}
              </Text>
            ) : null}
            {historicalParticipating.map((player) => renderParticipant(player, {
              allowLiveLate: false,
              keyPrefix: `${section.key}-hist-present`,
              showCoachActions: false,
              statusKind: 'participating',
              statusLabel: t('eventDetails.participationStatus.participating'),
            }))}
            {historicalMissing.map((player) => renderParticipant(player, {
              allowLiveLate: false,
              keyPrefix: `${section.key}-hist-missing`,
              showCoachActions: false,
              statusKind: 'missing',
              statusLabel: t('eventDetails.participationStatus.missing'),
            }))}
          </View>
        ) : null}
      </View>
    );
  };

  const sectionsToRender = [
    ...(teamParticipationSections || []),
    ...(externalParticipationSection ? [externalParticipationSection] : []),
  ];
  const hasTeamSections = sectionsToRender.length > 0;

  /**
   * Compte les noms REELLEMENT rendus par une section d equipe.
   * Sert deux fois : decider si la barre de recherche a lieu d etre, et jeter
   * une section qui ne garde plus aucun nom une fois filtree.
   * ⛔ `historical.pending` n en est pas : il est rendu comme un COMPTE, pas
   * comme des noms — une section qui n aurait que lui serait une carte vide.
   * @param {TeamParticipationSection} item - La section a compter.
   * @returns {number} - Le nombre de noms affiches.
   */
  const compterNomsDeSection = (item) => {
    const historique = item?.historical || {};
    return (item?.participating?.length || 0)
      + (item?.missing?.length || 0)
      + (item?.notAnswered?.length || 0)
      + (historique.participating?.length || 0)
      + (historique.missing?.length || 0)
      + (canApprovePendingRequests ? (item?.pending?.length || 0) : 0);
  };

  /**
   * Compte les noms rendus par le chemin SANS equipes (et par le repli).
   * @param {ParticipationsByStatus | undefined} listes - Les 3 listes.
   * @param {User[] | undefined} repli - La liste de repli.
   * @param {PendingParticipation[] | undefined} demandes - Les demandes.
   * @returns {number} - Le nombre de noms affiches.
   */
  const compterNomsHorsEquipes = (listes, repli, demandes) => {
    const personnes = listes
      ? (listes.participating?.length || 0)
        + (listes.missing?.length || 0)
        + (listes.notAnswered?.length || 0)
      : (repli?.length || 0);
    return personnes + (canApprovePendingRequests ? (demandes?.length || 0) : 0);
  };

  /**
   * Applique la recherche a une section d equipe, liste par liste.
   * @param {TeamParticipationSection} item - La section d origine.
   * @returns {TeamParticipationSection} - La section filtree.
   */
  const filtrerSection = (item) => ({
    ...item,
    historical: {
      ...(item.historical || {}),
      missing: filtrerJoueurs(item.historical?.missing),
      participating: filtrerJoueurs(item.historical?.participating),
      pending: filtrerDemandes(item.historical?.pending),
    },
    missing: filtrerJoueurs(item.missing),
    notAnswered: filtrerJoueurs(item.notAnswered),
    participating: filtrerJoueurs(item.participating),
    pending: filtrerDemandes(item.pending),
  });

  // ⚠️ CE QUI EST FILTRE, ET CE QUI NE L EST PAS : seules les LISTES rendues
  // passent par la recherche. Les 3 compteurs et la barre de reponses, eux,
  // continuent de se calculer sur `sectionsToRender` — ils decrivent
  // l evenement, pas la saisie. Un coach qui cherche « Dupont » ne doit pas
  // voir « 1 présent » alors qu ils sont 14.
  const sectionsAffichees = rechercheActive
    ? sectionsToRender.map(filtrerSection).filter((item) => compterNomsDeSection(item) > 0)
    : sectionsToRender;
  const listesAffichees = rechercheActive && participationsByStatus
    ? {
      missing: filtrerJoueurs(participationsByStatus.missing),
      notAnswered: filtrerJoueurs(participationsByStatus.notAnswered),
      participating: filtrerJoueurs(participationsByStatus.participating),
    }
    : participationsByStatus;
  const demandesAffichees = filtrerDemandes(pendingParticipations);
  const repliAffiche = filtrerJoueurs(event?.participations);
  const participatingCount = Number(
    participantsSummary?.participatingCount ?? event?.participations?.length ?? 0,
  );
  const capacity = Number(participantsSummary?.capacity ?? event?.capacity ?? 0);
  const anonymizedPreviewCount = Math.min(participatingCount, 5);

  // AD06 (L3-A) — LES TROIS COMPTEURS.
  // `participantsSummary` ne porte que `participatingCount` et `capacity`
  // (EventDetails.js:1910) : ni les absents, ni les sans-reponse ne descendent
  // jusqu ici. On les compte donc sur les listes REELLEMENT rendues, ce qui
  // evite toute dependance croisee avec l ecran.
  const listesRendues = hasTeamSections
    ? sectionsToRender.reduce((total, item) => ({
      missing: total.missing + (item.missing?.length || 0),
      notAnswered: total.notAnswered + (item.notAnswered?.length || 0),
      participating: total.participating + (item.participating?.length || 0),
    }), { missing: 0, notAnswered: 0, participating: 0 })
    : {
      missing: participationsByStatus?.missing?.length || 0,
      notAnswered: participationsByStatus?.notAnswered?.length || 0,
      participating: participationsByStatus?.participating?.length || 0,
    };
  const hasRenderedLists = hasTeamSections || Boolean(participationsByStatus);
  const presentsCount = hasRenderedLists ? listesRendues.participating : participatingCount;
  const absentsCount = listesRendues.missing;
  // L effectif total est celui qu on rend a l ecran : l effectif d une equipe
  // n arrive pas jusqu a ce composant. « Sans reponse » se lit donc par
  // SOUSTRACTION, bornee a 0 — un resume serveur incoherent ne doit jamais
  // afficher un nombre negatif.
  const totalAttendu = presentsCount + absentsCount + listesRendues.notAnswered;
  const sansReponseCount = Math.max(0, totalAttendu - presentsCount - absentsCount);
  const reponsesRecues = presentsCount + absentsCount;
  const partReponses = totalAttendu > 0 ? Math.round((reponsesRecues / totalAttendu) * 100) : 0;

  // Ce que la recherche peut atteindre. 🪤 Le compte se fait sur les listes NON
  // filtrees : sinon la barre disparaitrait sur une saisie sans resultat, et
  // plus personne ne pourrait effacer sa saisie.
  const nombreDeNomsAffichables = hasTeamSections
    ? sectionsToRender.reduce((total, item) => total + compterNomsDeSection(item), 0)
    : compterNomsHorsEquipes(participationsByStatus, event?.participations, pendingParticipations);
  const nombreDeNomsRetenus = hasTeamSections
    ? sectionsAffichees.reduce((total, item) => total + compterNomsDeSection(item), 0)
    : compterNomsHorsEquipes(listesAffichees, repliAffiche, demandesAffichees);
  const barreDeRechercheVisible = !areParticipantIdentitiesHidden && nombreDeNomsAffichables > 0;
  const aucunResultat = rechercheActive && nombreDeNomsRetenus === 0;

  const renderCounterTile = (identifiant, libelle, valeur) => (
    <View
      key={identifiant}
      style={[
        Alignments.fill,
        Alignments.alignCenter,
        ApplicationStyle.borderRadius16,
        ApplicationStyle.backgroundColor.primary700,
        Spaces.paddingVertical[12],
        Spaces.paddingHorizontal[8],
        Spaces.gap[4],
      ]}
      testID={identifiant}
    >
      <Text style={[Fonts.h1Bold, Fonts.neutral00]}>
        {valeur}
      </Text>
      <Text numberOfLines={2} style={[Fonts.p3, Fonts.neutral200]}>
        {libelle}
      </Text>
    </View>
  );

  // La barre « N reponses sur M ». Elle vit ICI, pas dans `src/components/` :
  // 9 lots tournent en parallele et un composant partage neuf serait un
  // fichier-carrefour de plus. Le modele visuel est celui de
  // MatchStatsEditor.js:1421-1437, deja rendu ailleurs dans l app.
  // ⛔ `Stepper.js` ne pouvait pas servir : il rend `null` des que le
  // remplissage vaut 0, or c est justement l etat « 0 reponse » qu il faut voir.
  const renderResponsesBar = () => (
    <View style={[Spaces.gap[8]]}>
      <View style={[Alignments.rowBetween, Spaces.gap[8]]}>
        <Text style={[Fonts.p3, Fonts.neutral200]} testID="AD06-barre-legende">
          {t('eventDetails.participantsSummary.responses', '{{received}} réponses sur {{total}}')
            .replace('{{received}}', String(reponsesRecues))
            .replace('{{total}}', String(totalAttendu))}
        </Text>
        {/* AE02 (1A) : le chiffre etait DEJA calcule et ne servait que de
            largeur de barre (`width: ${partReponses}%`). Il vit dans SON noeud,
            jamais dans la legende : le selecteur de pastilles d AD06 attrape
            tout `Text` portant `textAlign: 'center'` + `color` dans le MEME
            objet de style, et compare en `toEqual` STRICT. Celui-ci n en porte
            aucun — c est ce qui garde AD06 vert. */}
        <Text style={[Fonts.p3Bold, Fonts.neutral00]} testID="AE02-pourcentage">
          {`${partReponses} %`}
        </Text>
      </View>
      <View
        style={{
          backgroundColor: 'rgba(255,255,255,0.08)',
          borderRadius: 999,
          height: 6,
          overflow: 'hidden',
        }}
        testID="AD06-barre-reponses"
      >
        <View
          style={{
            backgroundColor: Colors.success500,
            borderRadius: 999,
            height: '100%',
            width: `${partReponses}%`,
          }}
        />
      </View>
    </View>
  );

  const renderParticipationsContent = () => {
    if (areParticipantIdentitiesHidden) {
      return (
        <View
          style={[
            ApplicationStyle.backgroundColor.primary700,
            ApplicationStyle.borderRadius24,
            Spaces.padding[16],
            Spaces.gap[16],
          ]}
        >
          <Text style={[Fonts.p2, Fonts.neutral100]}>
            {participatingCount > 0
              ? `${participatingCount} participant${participatingCount > 1 ? 's' : ''}`
              : 'Aucun participant confirme pour le moment.'}
          </Text>

          {anonymizedPreviewCount > 0 ? (
            <View style={[Alignments.row, Spaces.gap[12]]}>
              {Array.from({ length: anonymizedPreviewCount }).map((_, index) => (
                <View
                  key={`participant-placeholder-${index + 1}`}
                  style={[
                    Alignments.alignCenter,
                    Alignments.justifyCenter,
                    {
                      backgroundColor: 'rgba(255,255,255,0.08)',
                      borderColor: 'rgba(255,255,255,0.16)',
                      borderRadius: 999,
                      borderWidth: 1,
                      height: 40,
                      width: 40,
                    },
                  ]}
                >
                  <Text style={[Fonts.p4Bold, Fonts.neutral200]}>?</Text>
                </View>
              ))}
            </View>
          ) : null}

          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {t(
              'eventDetails.participantsHiddenMessage',
              'Les identités des participants sont masquees par l organisateur.',
            )}
          </Text>
        </View>
      );
    }

    if (hasTeamSections) {
      return (
        <View style={[Spaces.gap[12]]}>
          {sectionsAffichees.map(renderTeamSection)}
        </View>
      );
    }

    if (participationsByStatus) {
      return (
        <>
          {renderStatusGroup(
            t('eventDetails.participationStatus.participating'),
            listesAffichees.participating || [],
            {
              allowLiveLate: true,
              emptyMessage: t('eventDetails.emptyStates.noConfirmation'),
              keyPrefix: 'legacy-present',
              showCoachActions: canEdit,
              statusKind: 'participating',
            },
          )}
          {renderStatusGroup(
            t('eventDetails.participationStatus.missing'),
            listesAffichees.missing || [],
            {
              allowLiveLate: false,
              emptyMessage: t('eventDetails.emptyStates.noAbsence'),
              keyPrefix: 'legacy-missing',
              statusKind: 'missing',
              statusLabel: t('eventDetails.participationStatus.missing'),
            },
          )}
          {(listesAffichees.notAnswered || []).length > 0 && (
            <>
              <View style={[Alignments.row, Alignments.alignCenter, Alignments.spaceBetween, Spaces.gap[16]]}>
                <Text style={[Fonts.h4Bold, Fonts.primary500]}>
                  {t('eventDetails.participationStatus.notAnswered')}
                </Text>
                {canEdit ? (
                  <Button isLoading={isReminding} isOption onPress={handleRemindPlayers} title={t('eventDetails.actions.remind')} variant="Primary" />
                ) : null}
              </View>
                {(listesAffichees.notAnswered || []).map((player) => renderParticipant(player, {
                allowLiveLate: false,
                keyPrefix: 'legacy-not-answered',
                statusKind: 'not_answered',
                statusLabel: t('eventDetails.participationStatus.notAnswered'),
              }))}
            </>
          )}
          {(listesAffichees.notAnswered || []).length > 0 ? null : renderStatusGroup(
            t('eventDetails.participationStatus.notAnswered'),
            [],
            { emptyMessage: t('eventDetails.emptyStates.allAnswered') },
          )}
        </>
      );
    }

    return (repliAffiche || []).map((player) => renderParticipant(player, {
      allowLiveLate: true,
      keyPrefix: 'fallback',
      showCoachActions: canEdit,
      statusKind: 'participating',
    }));
  };

  return (
    <View style={[Spaces.gap[16], Alignments.fill]}>
      {!hasTeamSections && canApprovePendingRequests && demandesAffichees?.length > 0 && (
        <View style={[Spaces.gap[16], Alignments.fill]}>
          <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
            {t('eventDetails.fields.participationRequests')}
          </Text>
          {demandesAffichees.map(renderPendingCard)}
        </View>
      )}

      <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter]}>
        <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
          {t('eventDetails.fields.participations')}
        </Text>
        <TouchableOpacity onPress={handleShare}>
          <Image resizeMode="contain" source={SHARE_ICON} style={{ height: 48, width: 48 }} />
        </TouchableOpacity>
      </View>

      {canEdit && (
        <TouchableOpacity onPress={handleExportParticipants} style={[{ alignSelf: 'flex-start' }, Spaces.marginTop[4]]}>
          <Text style={[Fonts.p2, Fonts.primary500, { textDecorationLine: 'underline' }]}>
            Exporter la liste (Excel/CSV)
          </Text>
        </TouchableOpacity>
      )}

      <View style={[Spaces.gap[12]]}>
        <View style={[Alignments.row, Spaces.gap[8]]}>
          {renderCounterTile(
            'AD06-tuile-participating',
            t('eventDetails.participationStatus.participating'),
            capacity ? `${presentsCount} / ${capacity}` : String(presentsCount),
          )}
          {renderCounterTile(
            'AD06-tuile-missing',
            t('eventDetails.participationStatus.missing'),
            String(absentsCount),
          )}
          {renderCounterTile(
            'AD06-tuile-notAnswered',
            t('eventDetails.participationStatus.notAnswered'),
            String(sansReponseCount),
          )}
        </View>
        {renderResponsesBar()}
      </View>

      {/* AE02 (1E partiel) : la barre se place SOUS les compteurs et AU-DESSUS
          des groupes — elle filtre la liste, pas le resume. `withCalendar` et
          `withFilter` a `false` donnent le champ nu a la loupe de la maquette.
          Elle ne rend AUCUN noeud `Text` : les temoins d ordre d AD06, qui
          lisent les textes rendus, ne la voient meme pas. */}
      {barreDeRechercheVisible ? (
        <SearchBar
          onChangeText={setRechercheNom}
          placeholder={t('eventDetails.participantsSearch.placeholder', 'Chercher un nom')}
          value={rechercheNom}
          withCalendar={false}
          withFilter={false}
        />
      ) : null}

      {aucunResultat ? (
        <Text style={[Fonts.p3, Fonts.neutral300]} testID="AE02-aucun-resultat">
          {t('eventDetails.participantsSearch.noResult', 'Aucun nom ne correspond')}
        </Text>
      ) : renderParticipationsContent()}
    </View>
  );
}

/**
 * @param {{
 * player: User,
 * attendance?: AttendanceState | null,
 * allowLiveLate?: boolean,
 * canEdit?: boolean,
 * eventStartAt?: Date | null,
 * nowMs?: number,
 * onPress: (user?: User) => void,
 * onMarkArrival?: (user?: User) => void,
 * onEditLate?: (user?: User) => void,
 * statusKind?: 'participating' | 'missing' | 'not_answered',
 * styles: any,
 * t: (clef: string, valeurParDefaut?: string) => string
 * }} props
 */
function ParticipantItem({
  allowLiveLate = false,
  attendance,
  canEdit = false,
  eventStartAt,
  nowMs,
  onEditLate,
  onMarkArrival,
  onPress,
  player,
  statusKind = 'participating',
  styles,
  t,
}) {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = styles;
  const badge = resolveAttendanceBadge({
    allowLiveLate,
    attendance,
    colors: Colors,
    eventStartAt,
    nowMs,
    statusKind,
    t,
  });
  const arrivalTime = formatArrivalTime(attendance?.arrivedAt);
  const hasStaffMeta = canEdit && (attendance?.note || attendance?.manualOverride || attendance?.updatedBy);
  const primaryCoachActionTitle = attendance?.arrivedAt ? 'Corriger' : 'Pointer l\'arrivée';

  return (
    <View
      style={[
        ApplicationStyle.borderRadius24,
        ApplicationStyle.backgroundColor.primary700,
        Alignments.fill,
        Spaces.padding[16],
        Spaces.gap[12],
      ]}
    >
      <TouchableOpacity
        disabled={player?.isAnonymous === true}
        onPress={() => {
          if (player?.isAnonymous === true) return;
          onPress(player);
        }}
        style={[
          Alignments.row,
          Alignments.alignCenter,
          Alignments.justifySpaceBetween,
          Spaces.gap[16],
        ]}
      >
        <View style={[Alignments.row, Spaces.gap[16], Alignments.alignCenter, { flex: 1 }]}>
          <ProfileAvatar
            imageStyle={{ borderRadius: 40 }}
            imageUrl={player?.avatar?.url}
            name={getUserDisplayName(player)}
            size={40}
            style={[ApplicationStyle.borderWidth1, ApplicationStyle.borderColor.neutral00, { borderRadius: 40 }]}
          />
          <Text numberOfLines={2} style={[Fonts.p1Bold, Fonts.neutral00, { flex: 1 }]}>
            {getUserDisplayName(player)}
          </Text>
        </View>
        <View
          style={[
            ApplicationStyle.borderRadius16,
            Alignments.alignCenter,
            {
              backgroundColor: badge.backgroundColor,
              borderColor: badge.borderColor,
              borderWidth: 1,
              minWidth: badge.value ? 132 : 96,
              paddingHorizontal: badge.value ? 14 : 12,
              paddingVertical: badge.value ? 8 : 6,
            },
          ]}
        >
          <Text style={[Fonts.p3, { color: badge.textColor, textAlign: 'center' }]}>
            {badge.title}
          </Text>
          {badge.value ? (
            <Text
              style={[Fonts.p3Bold, { color: badge.textColor, marginTop: 2, textAlign: 'center' }]}
            >
              {badge.value}
            </Text>
          ) : null}
          {arrivalTime ? (
            <Text
              style={[Fonts.p4, { color: badge.textColor, marginTop: 2, textAlign: 'center' }]}
            >
              {arrivalTime}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>

      {canEdit && (
        <View style={[Alignments.row, Spaces.gap[8], Alignments.justifyEnd]}>
          <Button
            onPress={() => onMarkArrival && onMarkArrival(player)}
            size="sm"
            title={primaryCoachActionTitle}
            variant="Primary"
          />
          <Button
            onPress={() => onEditLate && onEditLate(player)}
            size="sm"
            title="Modifier"
            variant="SecondaryLight"
          />
        </View>
      )}

      {hasStaffMeta ? (
        <View style={[Spaces.gap[4]]}>
          {attendance?.manualOverride ? (
            <Text style={[Fonts.p4, Fonts.warning500]}>
              Correction manuelle staff
            </Text>
          ) : null}
          {attendance?.updatedBy ? (
            <Text style={[Fonts.p4, Fonts.neutral300]}>
              Corrige par
              {' '}
              {getStaffDisplayName(attendance.updatedBy)}
            </Text>
          ) : null}
          {attendance?.note ? (
            <Text style={[Fonts.p4, Fonts.neutral200]}>
              {attendance.note}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export default EventParticipants;
