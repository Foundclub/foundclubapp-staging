import { useEffect, useState } from 'react';
import {
  Modal, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { normalizeCandidateDates } from '@/domains/search/friendlyMatchFlow';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
// eslint-disable-next-line max-len -- chemin du selecteur de creneaux, partage avec le tunnel
import FriendlyMatchSlotEditor from '@/components/molecules/friendlyMatchSlotEditor/FriendlyMatchSlotEditor';

import { repostFriendlyMatchAd } from '@/services/friendlyMatch/friendlyMatchService';

import { createLogger } from '@/utils/logger/logger';

const logger = createLogger('friendly-match-repost');

/**
 * « Tu la reposte ? » — remettre en ligne une annonce expiree (§4.7).
 *
 * Le serveur remet `status` a `open`, efface la relance d expiration et
 * REMPLACE les dates candidates (friendly-match-workflow.ts:404-432) : la
 * feuille repart donc d une liste VIDE, pas des anciennes dates. Reproposer
 * des dates deja passees serait le seul moyen de se faire refuser.
 *
 * Une feuille, pas un ecran : un ecran de plus exigerait son motif web (L7).
 * @param {object} props
 * @param {any} props.ad
 * @param {() => void} props.onClose
 * @param {(ad: any) => void} props.onReposted
 * @param {boolean} props.visible
 * @returns {import('react').ReactElement}
 */
function FriendlyMatchRepostSheet({
  ad, onClose, onReposted, visible,
}) {
  const insets = useSafeAreaInsets();
  const {
    Alignments, Colors, Fonts, Spaces,
  } = /** @type {any} */ (useTheme());

  const [slots, setSlots] = useState(/** @type {any[]} */ ([]));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!visible) return;
    setSlots([]);
    setErrorMessage('');
  }, [visible]);

  const handleSubmit = async () => {
    if (slots.length === 0 || isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      const reposted = await repostFriendlyMatchAd(ad?.documentId || ad?.id, {
        candidateDates: slots,
      });
      onReposted(reposted);
    } catch (error) {
      // Le serveur refuse une annonce deja pourvue et des dates passees : son
      // message dit laquelle des deux, le notre ne le saurait pas.
      const message = /** @type {any} */ (error)?.message
        || "Impossible de reposter l'annonce.";
      logger.error('Repostage refuse', { error });
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View style={{
        backgroundColor: withAlpha(Colors.neutral900, 0.55),
        flex: 1,
        justifyContent: 'flex-end',
      }}
      >
        <View style={{
          backgroundColor: Colors.primary900,
          borderColor: withAlpha(Colors.primary500, 0.19),
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          borderWidth: 1,
          maxHeight: '90%',
          paddingBottom: insets.bottom + 16,
          paddingHorizontal: 20,
          paddingTop: 16,
        }}
        >
          <View style={[
            Alignments.row,
            Alignments.alignCenter,
            Alignments.justifySpaceBetween,
            Spaces.marginBottom[16],
          ]}
          >
            <Text style={[Fonts.h4, Fonts.neutral00]}>Reposter l’annonce</Text>
            <TouchableOpacity
              accessibilityLabel="Fermer"
              accessibilityRole="button"
              onPress={onClose}
              style={{
                alignItems: 'center', height: 44, justifyContent: 'center', width: 44,
              }}
            >
              <Text style={[Fonts.p1Bold, { color: Colors.neutral200 }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={[Spaces.gap[16], Spaces.paddingBottom[16]]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={[Fonts.p3, { color: Colors.neutral200 }]}>
              Tes dates sont passées. Propose-en de nouvelles : le reste de
              l’annonce ne bouge pas, et les propositions déjà reçues sont
              conservées.
            </Text>

            <FriendlyMatchSlotEditor
              emptyHint="Ajoute au moins une date à venir pour remettre l’annonce en ligne."
              onAdd={(slot) => setSlots(
                (previous) => normalizeCandidateDates([
                  ...previous.filter((/** @type {any} */ item) => item.date !== slot.date),
                  slot,
                ]),
              )}
              onRemove={(isoDay) => setSlots(
                (previous) => previous.filter((/** @type {any} */ item) => item.date !== isoDay),
              )}
              slots={slots}
            />

            {errorMessage ? (
              <View style={[Spaces.padding[16], {
                backgroundColor: withAlpha(Colors.error500, 0.12),
                borderColor: withAlpha(Colors.error500, 0.4),
                borderRadius: 12,
                borderWidth: 1,
              }]}
              >
                <Text style={[Fonts.p3Bold, { color: Colors.neutral00 }]}>{errorMessage}</Text>
              </View>
            ) : null}
          </ScrollView>

          <Button
            disabled={slots.length === 0 || isSubmitting}
            isLoading={isSubmitting}
            onPress={handleSubmit}
            title="Remettre en ligne"
            variant="Primary"
          />
        </View>
      </View>
    </Modal>
  );
}

export default FriendlyMatchRepostSheet;
