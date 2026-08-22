import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';

/**
 * Le bloc « Postes recherchés » d'une détection.
 *
 * 🧪 N1 — PISTE ESSAYEE ET ABANDONNEE, notee pour ne pas la refaire :
 * `@param root0` n'a pas de type, et TypeScript refuse un nom qualifie
 * (`root0.xxx`) sans lui — d'ou un TS8032 par parametre. Poser
 * `@param {object} root0` supprime bien ces 9 erreurs, mais en cree DAVANTAGE
 * sur les proprietes destructurees : mesure reelle 5 411 -> 5 413. Le mieux
 * etait l'ennemi du bien ; la piste est fermee, elle demande de typer les 9
 * parametres, ce qui est un lot a part.
 * @param root0
 * @param root0.canEdit
 * @param root0.currentUserHasGenericParticipation
 * @param root0.currentUserSlotId
 * @param root0.currentUserSlotStatus
 * @param root0.isApplyingSlotId
 * @param {boolean} [root0.isDetection] - Vrai quand l'evenement EST une detection.
 *   C'est ce drapeau, et lui seul, qui autorise l'etat vide « Aucun poste
 *   recherche » : sans lui, zero poste rend `null`, comme avant N1.
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
  isDetection = false,
  onApply,
  onOpenSlot,
  slots = [],
}) {
  const { t } = useTranslation();
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Images,
    Spaces,
  } = useTheme();

  const summary = useMemo(() => {
    const totalPositions = slots.length;
    const totalRequested = slots.reduce((sum, slot) => sum + Number(slot?.quantity || 0), 0);
    const totalCandidates = slots.reduce((sum, slot) => sum + Number(slot?.candidatesCount || 0), 0);
    const totalOpen = slots.reduce((sum, slot) => sum + (slot?.isComplete ? 0 : 1), 0);

    return {
      totalCandidates,
      totalOpen,
      totalPositions,
      totalRequested,
    };
  }, [slots]);

  // 🧨 N1 (a) — LE BLOC QUI SE TAISAIT.
  //
  // Ce `return null` etait DOUBLE : l'ecran ne montait meme pas le composant
  // tant que `detectionSlots.length > 0` etait faux. Resultat, une detection
  // dont l'organisateur n'a pas encore saisi les postes n'affichait RIEN — et
  // personne ne pouvait savoir si c'etait un reglage manquant ou une seance
  // reellement ouverte a tous. La regle 5 du pack l'interdit : aucun bloc muet.
  //
  // 🔒 LE SILENCE RESTE LE DEFAUT. `isDetection` est une demande EXPLICITE de
  // l'ecran : tout autre appelant garde exactement l'ecran d'avant N1.
  if (!Array.isArray(slots) || slots.length === 0) {
    if (!isDetection) {
      return null;
    }

    return (
      <View
        style={[
          ApplicationStyle.card,
          Spaces.padding[16],
          Spaces.gap[4],
          Spaces.marginBottom[24],
        ]}
      >
        <Text style={[Fonts.h4Bold, Fonts.primary500]}>
          {t('eventDetails.detection.noSlots', 'Aucun poste recherché')}
        </Text>
        <Text style={[Fonts.p3, Fonts.neutral300]}>
          {t(
            'eventDetails.detection.noSlotsHint',
            'La séance est ouverte à tous les profils',
          )}
        </Text>
      </View>
    );
  }

  const renderMetricChip = (text, tone = 'default') => {
    let toneStyle = {
      backgroundColor: 'rgba(255,255,255,0.04)',
      borderColor: 'rgba(255,255,255,0.10)',
      textColor: Colors.neutral200,
    };

    if (tone === 'primary') {
      toneStyle = {
        backgroundColor: `${Colors.primary500}16`,
        borderColor: `${Colors.primary500}45`,
        textColor: Colors.primary500,
      };
    } else if (tone === 'warning') {
      toneStyle = {
        backgroundColor: `${Colors.gold500}18`,
        borderColor: `${Colors.gold500}45`,
        textColor: Colors.gold500,
      };
    }

    return (
      <View
        key={`${text}-${tone}`}
        style={[
          Spaces.paddingHorizontal[8],
          Spaces.paddingVertical[4],
          {
            backgroundColor: toneStyle.backgroundColor,
            borderColor: toneStyle.borderColor,
            borderRadius: 999,
            borderWidth: 1,
          },
        ]}
      >
        <Text style={[Fonts.p4Bold, { color: toneStyle.textColor }]}>
          {text}
        </Text>
      </View>
    );
  };

  return (
    <View style={[Spaces.gap[24], Spaces.marginBottom[24]]}>
      <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
        {t('eventDetails.detection.slotsTitle', 'Postes recherchés')}
      </Text>
      <View
        style={[
          ApplicationStyle.backgroundColor.primary900,
          ApplicationStyle.borderRadius24,
          ApplicationStyle.borderWidth1,
          {
            borderColor: 'rgba(1, 179, 244, 0.56)',
            padding: 20,
          },
          Spaces.gap[16],
        ]}
      >
        <View style={[Spaces.gap[12]]}>
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            Les joueurs choisissent un poste precis. Les places se remplissent quand tu valides les candidatures.
          </Text>
          <View style={[Alignments.row, { columnGap: 8, flexWrap: 'wrap', rowGap: 8 }]}>
            {renderMetricChip(`${summary.totalPositions} poste(s)`, 'primary')}
            {renderMetricChip(`${summary.totalRequested} place(s)`)}
            {renderMetricChip(`${summary.totalOpen} ouvert(s)`, summary.totalOpen > 0 ? 'primary' : 'warning')}
            {summary.totalCandidates > 0 ? renderMetricChip(`${summary.totalCandidates} candidature(s)`) : null}
          </View>
        </View>

        {slots.map((slot) => {
          const isCurrentUserSlot = currentUserSlotId === slot.documentId;
          const isDisabledByOtherSlot = Boolean(currentUserSlotId) && !isCurrentUserSlot;
          const isDisabledByGenericParticipation = !currentUserSlotId && currentUserHasGenericParticipation;

          let primaryTitle = 'Participer';
          let primaryDisabled = false;
          let primaryVariant = 'Primary';

          if (slot.isComplete && !isCurrentUserSlot) {
            primaryTitle = 'Poste complet';
            primaryDisabled = true;
            primaryVariant = 'SecondaryLight';
          } else if (isCurrentUserSlot) {
            primaryTitle = currentUserSlotStatus === 'accepted' ? 'Participation validée' : 'Demande envoyée';
            primaryDisabled = true;
            primaryVariant = 'SecondaryLight';
          } else if (isDisabledByOtherSlot) {
            primaryTitle = 'Déjà inscrit';
            primaryDisabled = true;
            primaryVariant = 'SecondaryLight';
          } else if (isDisabledByGenericParticipation) {
            primaryTitle = 'Participation existante';
            primaryDisabled = true;
            primaryVariant = 'SecondaryLight';
          }

          const SlotContainer = canEdit ? TouchableOpacity : View;

          return (
            <SlotContainer
              activeOpacity={canEdit ? 0.85 : 1}
              key={slot.documentId || `${slot.position}-${slot.quantity}`}
              onPress={canEdit ? () => onOpenSlot?.(slot) : undefined}
              style={[
                ApplicationStyle.card,
                {
                  padding: 16,
                },
                Spaces.gap[12],
                {
                  backgroundColor: 'rgba(1, 179, 244, 0.07)',
                  borderColor: slot.isComplete ? `${Colors.gold500}55` : 'rgba(1, 179, 244, 0.20)',
                  borderWidth: 1,
                },
              ]}
            >
              <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.gap[12]]}>
                <View style={{ flex: 1 }}>
                  <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{slot.position}</Text>
                </View>
                <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
                  <View
                    style={[
                      Spaces.paddingHorizontal[8],
                      Spaces.paddingVertical[4],
                      {
                        backgroundColor: slot.isComplete ? `${Colors.gold500}22` : `${Colors.primary500}18`,
                        borderColor: slot.isComplete ? `${Colors.gold500}45` : `${Colors.primary500}35`,
                        borderRadius: 999,
                        borderWidth: 1,
                      },
                    ]}
                  >
                    <Text style={[Fonts.p4Bold, { color: slot.isComplete ? Colors.gold500 : Colors.primary500 }]}>
                      {slot.isComplete ? 'Complet' : `${slot.remaining} restante(s)`}
                    </Text>
                  </View>

                  {canEdit ? (
                    <Image
                      source={Images.arrowRight}
                      style={{
                        height: 16,
                        tintColor: Colors.neutral300,
                        width: 16,
                      }}
                    />
                  ) : null}
                </View>
              </View>

              <View style={[Alignments.row, { columnGap: 8, flexWrap: 'wrap', rowGap: 8 }]}>
                {renderMetricChip(`${slot.acceptedCount}/${slot.quantity} valide`)}
                {renderMetricChip(`${slot.pendingCount} attente`)}
                {renderMetricChip(`${slot.candidatesCount} demande(s)`)}
              </View>

              {!canEdit ? (
                <View style={[
                  Alignments.row,
                  Alignments.justifyEnd,
                  Alignments.alignCenter,
                  {
                    columnGap: 8,
                    flexWrap: 'wrap',
                    paddingTop: 12,
                    rowGap: 10,
                  },
                ]}
                >
                  <View style={[Alignments.row, { columnGap: 8, flexWrap: 'wrap', rowGap: 8 }]}>
                    <Button
                      disabled={primaryDisabled}
                      isLoading={isApplyingSlotId === slot.documentId}
                      onPress={() => onApply?.(slot)}
                      size="sm"
                      title={primaryTitle}
                      variant={primaryVariant}
                    />

                    <Button
                      onPress={() => onOpenSlot?.(slot)}
                      size="sm"
                      title="Voir le poste"
                      variant="SecondaryLight"
                    />
                  </View>
                </View>
              ) : null}
            </SlotContainer>
          );
        })}
      </View>
    </View>
  );
}

export default EventDetectionSlots;
