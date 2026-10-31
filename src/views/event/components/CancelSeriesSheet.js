import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';

/**
 * CORR-EVENEMENTS 119 (recette du site, décision A) — annuler une séance d'une série.
 *
 * Le téléphone pose la question par une alerte à trois choix ; le site n'avait qu'un
 * `window.confirm`, qui n'annulait que la séance sans le dire. Cette feuille reprend les
 * trois choix et les libellés du téléphone (`eventDetails.modals.recurrenceCancel`).
 * Elle n'appelle aucun service : `onChoose` reçoit la portée (`single`, `future`, `all`).
 */

/** Cible tactile minimale du projet. */
const MIN_TOUCH_TARGET = 44;

const CHOIX = [
  { cle: 'thisEvent', portee: 'single' },
  { cle: 'future', portee: 'future' },
  { cle: 'all', portee: 'all' },
];

/**
 * La feuille d'annulation d'une séance de série.
 * @param {object} props - Les propriétés du composant.
 * @param {boolean} [props.isPending] - Une annulation est-elle en cours.
 * @param {boolean} props.isVisible - La feuille est-elle ouverte.
 * @param {(portee: 'single' | 'future' | 'all') => void} props.onChoose - Annuler avec cette portée.
 * @param {() => void} props.onClose - Fermer sans rien annuler.
 * @returns {import('react').ReactElement | null} - La feuille.
 */
function CancelSeriesSheet({
  isPending = false, isVisible, onChoose, onClose,
}) {
  const { Fonts, Spaces } = useTheme();
  const { t } = useTranslation();

  if (!isVisible) return null;

  return (
    <BottomModal
      close={onClose}
      footerComponent={(
        <Button
          disabled={isPending}
          onPress={onClose}
          style={{ minHeight: MIN_TOUCH_TARGET }}
          title={t('eventDetails.modals.recurrenceCancel.actions.keep', 'Ne rien annuler')}
          variant="Ghost"
        />
      )}
      headerComponent={(
        <View style={[Spaces.gap[8]]}>
          <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
            {t('eventDetails.modals.recurrenceCancel.title')}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            {t('eventDetails.modals.recurrenceCancel.description')}
          </Text>
        </View>
      )}
      isVisible
      webPresentation="dialog"
    >
      <View style={[Spaces.gap[12], Spaces.paddingBottom[16]]}>
        {CHOIX.map(({ cle, portee }) => (
          <Button
            disabled={isPending}
            key={cle}
            onPress={() => onChoose(/** @type {'single' | 'future' | 'all'} */ (portee))}
            style={{ minHeight: MIN_TOUCH_TARGET }}
            title={t(`eventDetails.modals.recurrenceCancel.actions.${cle}`)}
            variant="Danger"
          />
        ))}
      </View>
    </BottomModal>
  );
}

export default CancelSeriesSheet;
