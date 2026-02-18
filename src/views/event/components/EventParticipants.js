
import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import useTheme from '@/theme/themeContext';
import Button from '@/components/atoms/button/Button';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import { useTranslation } from 'react-i18next';

const SHARE_ICON = require('@/assets/icons/share2.png');

/** @typedef {import('@/domains/auth/types').User} User */
/** @typedef {{ documentId?: string; user: User }} PendingParticipation */
/**
 * @typedef {object} ParticipationsByStatus
 * @property {User[]} participating
 * @property {User[]} missing
 * @property {User[]} notAnswered
 */
/**
 * @typedef {object} EventParticipantsProps
 * @property {import('@/domains/event/types').FCEvent | undefined} event
 * @property {ParticipationsByStatus | undefined} participationsByStatus
 * @property {PendingParticipation[]} pendingParticipations
 * @property {boolean} canEdit
 * @property {(user?: User) => void} handleUserPress
 * @property {() => void} handleRemindPlayers
 * @property {() => void} handleShare
 * @property {() => void} handleExportParticipants
 * @property {(participationId?: string, status?: 'accepted' | 'declined') => void} [handleUpdateParticipation]
 */

/**
 * @param {EventParticipantsProps} props
 */
const EventParticipants = ({ 
  event, 
  participationsByStatus, 
  pendingParticipations,
  canEdit, 
  handleUserPress, 
  handleRemindPlayers, 
  handleShare,
  handleExportParticipants,
  handleUpdateParticipation
}) => {
  const { ApplicationStyle, Fonts, Spaces, Alignments } = useTheme();
  const { t } = useTranslation();

  return (
    <View style={[Spaces.gap[16], Alignments.fill]}>
      
      {/* Pending Requests (Trainers Only) */}
      {canEdit && pendingParticipations?.length > 0 && (
        <View style={[Spaces.gap[16], Alignments.fill]}>
          <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
            {t('eventDetails.fields.participationRequests')}
          </Text>
          {pendingParticipations.map((/** @type {PendingParticipation} */ participation) => (
            <TouchableOpacity
              key={participation.documentId}
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
                  imageUrl={participation.user.avatar?.url}
                  size={40}
                  style={[ApplicationStyle.borderWidth1, ApplicationStyle.borderColor.neutral00, { borderRadius: 40 }]}
                  imageStyle={{ borderRadius: 40 }}
                />
                <Text numberOfLines={2} style={[Fonts.p1Bold, Fonts.neutral00, { flexShrink: 1 }]}>
                  {`${participation.user.firstname} ${participation.user.lastname}`}
                </Text>
              </View>
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
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Header with Title and Share */}
      <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter]}>
        <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
          {t('eventDetails.fields.participations')}
          <Text>
             {` :  ${event?.participations?.length || 0} ${event?.capacity ? ' / ' : ''} ${event?.capacity || ''}`}
          </Text>
        </Text>
        <TouchableOpacity onPress={handleShare}>
           <Image source={SHARE_ICON} style={{ height: 48, width: 48 }} resizeMode="contain" />
        </TouchableOpacity>
      </View>

      {/* Export Link */}
      {canEdit && (
        <TouchableOpacity onPress={handleExportParticipants} style={[{ alignSelf: 'flex-start' }, Spaces.marginTop[4]]}>
          <Text style={[Fonts.p2, Fonts.primary500, { textDecorationLine: 'underline' }]}>
            Exporter la liste (Excel/CSV)
          </Text>
        </TouchableOpacity>
      )}

      {/* Lists */}
      {participationsByStatus ? (
        <>
          {/* Participating */}
          {participationsByStatus.participating.length > 0 && (
            <>
              <Text style={[Fonts.h4Bold, Fonts.primary500]}>
                {t('eventDetails.participationStatus.participating')}
              </Text>
              {participationsByStatus.participating.map((/** @type {User} */ player) => (
                <ParticipantItem 
                  key={player.documentId} 
                  player={player} 
                  onPress={handleUserPress} 
                  styles={{ ApplicationStyle, Alignments, Spaces, Fonts }} 
                />
              ))}
            </>
          )}

          {/* Missing */}
          {participationsByStatus.missing.length > 0 && (
             <>
              <Text style={[Fonts.h4Bold, Fonts.primary500]}>
                {t('eventDetails.participationStatus.missing')}
              </Text>
              {participationsByStatus.missing.map((/** @type {User} */ player) => (
                <ParticipantItem 
                   key={player.documentId} 
                   player={player} 
                   onPress={handleUserPress}
                   styles={{ ApplicationStyle, Alignments, Spaces, Fonts }}
                />
              ))}
             </>
          )}

          {/* Not Answered */}
          {participationsByStatus.notAnswered.length > 0 && (
             <>
               <View style={[Alignments.row, Alignments.alignCenter, Alignments.spaceBetween, Spaces.gap[16]]}>
                 <Text style={[Fonts.h4Bold, Fonts.primary500]}>
                   {t('eventDetails.participationStatus.notAnswered')}
                 </Text>
                 <Button isOption onPress={handleRemindPlayers} title={t('eventDetails.actions.remind')} variant="Primary" />
               </View>
               {participationsByStatus.notAnswered.map((/** @type {User} */ player) => (
                  <ParticipantItem 
                     key={player.documentId} 
                     player={player} 
                     onPress={handleUserPress}
                     styles={{ ApplicationStyle, Alignments, Spaces, Fonts }}
                  />
               ))}
             </>
          )}
        </>
      ) : (
         /* Fallback for simple view (e.g. non-trainers seeing just list) */
         event?.participations?.map((/** @type {User} */ player) => (
             <ParticipantItem 
                key={player.documentId} 
                player={player} 
                onPress={handleUserPress}
                styles={{ ApplicationStyle, Alignments, Spaces, Fonts }}
             />
         ))
      )}
    </View>
  );
};

/**
 * @param {{ player: User; onPress: (user?: User) => void; styles: any }} props
 */
const ParticipantItem = ({ player, onPress, styles }) => {
  const { ApplicationStyle, Alignments, Spaces, Fonts } = styles;
  return (
    <TouchableOpacity
      onPress={() => onPress(player)}
      style={[
        ApplicationStyle.borderRadius24,
        ApplicationStyle.backgroundColor.primary700,
        Alignments.row,
        Alignments.alignCenter,
        Alignments.fill,
        Alignments.justifySpaceBetween,
        Spaces.padding[16],
        Spaces.gap[16],
      ]}
    >
      <View style={[Alignments.row, Spaces.gap[16], Alignments.alignCenter, { flex: 0.7 }]}>
        <ProfileAvatar
          imageUrl={player?.avatar?.url}
          size={40}
          style={[ApplicationStyle.borderWidth1, ApplicationStyle.borderColor.neutral00, { borderRadius: 40 }]}
          imageStyle={{ borderRadius: 40 }}
        />
        <Text numberOfLines={2} style={[Fonts.p1Bold, Fonts.neutral00]}>
          {`${player.firstname} ${player.lastname}`}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

export default EventParticipants;
