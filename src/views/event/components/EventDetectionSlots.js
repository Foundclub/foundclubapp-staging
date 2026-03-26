import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';

/**
 *
 * @param root0
 * @param root0.canEdit
 * @param root0.currentUserHasGenericParticipation
 * @param root0.currentUserSlotId
 * @param root0.currentUserSlotStatus
 * @param root0.isApplyingSlotId
 * @param root0.onApply
 * @param root0.onOpenSlot
 * @param root0.slots
 */
function EventDetectionSlots({
  canEdit = false,
  currentUserHasGenericParticipation = false,
  currentUserSlotId = '',
  currentUserSlotStatus = '',
  isApplyingSlotId = '',
  onApply,
  onOpenSlot,
  slots = [],
}) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();

  if (!Array.isArray(slots) || slots.length === 0) {
    return null;
  }

  return (
    <View style={[Spaces.gap[12]]}>
      <Text style={[Fonts.h3Bold, Fonts.neutral00]}>Postes recherches</Text>
      <View
        style={[
          ApplicationStyle.backgroundColor.primary900,
          ApplicationStyle.borderRadius24,
          ApplicationStyle.borderColor.primary500,
          ApplicationStyle.borderWidth1,
          Spaces.padding[16],
          Spaces.gap[12],
        ]}
      >
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          Les joueurs candidatent sur un poste precis. Les places restantes sont calculees sur les candidatures acceptees.
        </Text>

        {slots.map((slot) => {
          const isCurrentUserSlot = currentUserSlotId === slot.documentId;
          const isDisabledByOtherSlot = Boolean(currentUserSlotId) && !isCurrentUserSlot;
          const isDisabledByGenericParticipation = !currentUserSlotId && currentUserHasGenericParticipation;

          let primaryTitle = `Postuler comme ${slot.position}`;
          let primaryDisabled = false;
          let primaryVariant = 'Primary';

          if (slot.isComplete && !isCurrentUserSlot) {
            primaryTitle = 'Poste complet';
            primaryDisabled = true;
            primaryVariant = 'SecondaryLight';
          } else if (isCurrentUserSlot) {
            primaryTitle = currentUserSlotStatus === 'accepted' ? 'Poste reserve' : 'Candidature envoyee';
            primaryDisabled = true;
            primaryVariant = 'SecondaryLight';
          } else if (isDisabledByOtherSlot) {
            primaryTitle = 'Candidature deja envoyee';
            primaryDisabled = true;
            primaryVariant = 'SecondaryLight';
          } else if (isDisabledByGenericParticipation) {
            primaryTitle = 'Participation deja enregistree';
            primaryDisabled = true;
            primaryVariant = 'SecondaryLight';
          }

          return (
            <View
              key={slot.documentId || `${slot.position}-${slot.quantity}`}
              style={[
                ApplicationStyle.card,
                Spaces.padding[14],
                Spaces.gap[10],
                {
                  backgroundColor: 'rgba(1, 179, 244, 0.06)',
                  borderColor: slot.isComplete ? `${Colors.gold500}55` : 'rgba(1, 179, 244, 0.20)',
                  borderWidth: 1,
                },
              ]}
            >
              <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.gap[12]]}>
                <View style={{ flex: 1 }}>
                  <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{slot.position}</Text>
                  <Text style={[Fonts.p3, Fonts.neutral200, Spaces.marginTop[4]]}>
                    {`${slot.acceptedCount}/${slot.quantity} places validees - ${slot.pendingCount} en attente`}
                  </Text>
                </View>
                <View
                  style={[
                    Spaces.paddingHorizontal[10],
                    Spaces.paddingVertical[6],
                    {
                      backgroundColor: slot.isComplete ? `${Colors.gold500}22` : `${Colors.primary500}18`,
                      borderRadius: 999,
                    },
                  ]}
                >
                  <Text style={[Fonts.p4Bold, { color: slot.isComplete ? Colors.gold500 : Colors.primary500 }]}>
                    {slot.isComplete ? 'Complet' : `${slot.remaining} restante(s)`}
                  </Text>
                </View>
              </View>

              <Text style={[Fonts.p3, Fonts.neutral200]}>
                {`${slot.candidatesCount} candidature(s) pour ce poste`}
              </Text>

              <View style={[Spaces.gap[8]]}>
                {!canEdit ? (
                  <Button
                    disabled={primaryDisabled}
                    isLoading={isApplyingSlotId === slot.documentId}
                    onPress={() => onApply?.(slot)}
                    title={primaryTitle}
                    variant={primaryVariant}
                  />
                ) : null}

                <Button
                  onPress={() => onOpenSlot?.(slot)}
                  title={canEdit ? 'Voir les candidatures' : 'Voir le poste'}
                  variant={canEdit ? 'Secondary' : 'SecondaryLight'}
                />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default EventDetectionSlots;
