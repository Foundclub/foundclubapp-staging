/**
 * SmsRepliCopie — CORR-MESSAGERIE point 61 (décision d'Adel « B », 30/10/2026).
 *
 * Sur le site, « envoyer par SMS » ouvre l'application SMS de l'ordinateur… quand il en a une.
 * Sinon rien ne s'ouvre, sans un mot, et l'invitation ne part pas. Le SMS reste ; sous lui,
 * « Rien ne s'est ouvert ? Copier le message » met le texte (lien compris) dans le
 * presse-papiers, pour WhatsApp, un e-mail ou un SMS. Sur téléphone, rien ne change.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';

import { copier } from '@/platform/share';

/**
 * @param {object} props - Les propriétés.
 * @param {string} [props.message] - Le texte du SMS ; vide : rien n'est rendu.
 * @param {string} [props.testID] - Le repère du bouton.
 * @returns {import('react').ReactElement | null} - Le repli, sur le site seulement.
 */
function SmsRepliCopie({ message = '', testID = 'sms-repli-copie' }) {
  const { t } = useTranslation();
  const { Fonts, Spaces } = useTheme();
  const [issue, setIssue] = useState('');
  if (Platform.OS !== 'web' || !message) return null;

  const copierLeMessage = async () => {
    setIssue((await copier(message)) ? 'copie' : 'echec');
  };

  return (
    <View style={[Spaces.gap[4]]}>
      <Button
        onPress={copierLeMessage}
        size="sm"
        testID={testID}
        title={t('smsRepliCopie.copier', 'Rien ne s’est ouvert ? Copier le message')}
        variant="Ghost"
      />
      {issue ? (
        <Text accessibilityLiveRegion="polite" style={[Fonts.p4, Fonts.neutral200]}>
          {issue === 'copie'
            ? t('smsRepliCopie.copie', 'Message copié : colle-le dans un SMS, WhatsApp ou un e-mail.')
            : t(
              'smsRepliCopie.echec',
              'La copie n’a pas marché sur ce navigateur : envoie l’invitation depuis ton téléphone.',
            )}
        </Text>
      ) : null}
    </View>
  );
}

export default SmsRepliCopie;
