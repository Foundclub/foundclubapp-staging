import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';

/**
 * PAR-L5L6 (13/10, design parent E06) — « COMMENT ÇA MARCHE ? ».
 *
 * Les trois paragraphes qui chargeaient « Mes enfants » (capture S03 : « deux sections, trois
 * paragraphes ») partent ici, MOT POUR MOT : aucun texte neuf, sauf « ton enfant » à la place
 * du prénom — la feuille parle de tous les enfants, pas d'un seul.
 * @param {object} props - Les propriétés.
 * @param {() => void} props.onClose - Ferme la feuille.
 * @param {boolean} props.visible - La feuille est ouverte.
 * @returns {import('react').ReactElement} - La feuille.
 */
function CommentCaMarche({ onClose, visible }) {
  const { t } = useTranslation();
  const { Fonts } = useTheme();
  const paragraphe = [Fonts.p2, Fonts.neutral100];

  return (
    <BottomModal
      close={onClose}
      footerComponent={(
        <Button onPress={onClose} title={t('common.close', 'Fermer')} variant="Ghost" />
      )}
      isVisible={visible}
    >
      <View style={{ gap: 16 }} testID="my-children-help">
        <Text style={[Fonts.h3Bold, Fonts.neutral00]}>{t('myChildren.help.title')}</Text>
        <Text style={paragraphe}>{t('myChildren.screen.hint')}</Text>
        <Text style={paragraphe}>{t('myChildren.accounts.empty')}</Text>
        <View style={{ gap: 4 }}>
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{t('stRetours.parent.under13Title')}</Text>
          <Text style={paragraphe}>
            {t('stRetours.parent.under13Hint', {
              firstname: t('myChildren.help.yourChild'), ...SANS_ECHAPPEMENT,
            })}
          </Text>
        </View>
      </View>
    </BottomModal>
  );
}

export default CommentCaMarche;
