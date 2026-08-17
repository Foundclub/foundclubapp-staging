import { useTranslation } from 'react-i18next';
import {
  Image, Linking, ScrollView, Text, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';

/**
 * S09 — l'ecran qui bloque une version trop ancienne.
 *
 * 📜 IL DIT POURQUOI, ET CE N'EST PAS DECORATIF : quelqu'un bloque sans
 * explication desinstalle. Le texte nomme la raison (des corrections sont
 * arrivees depuis), puis le geste (installer, rouvrir).
 *
 * 🔒 IL LAISSE UNE ISSUE : le second bouton mene au contact. Un cul-de-sac
 * total transformerait un incident de version en perte d'utilisateur.
 *
 * 🚪 Il ne se contourne pas : ce composant REMPLACE tout l'arbre de navigation
 * (voir `src/app/AppUpdateGate.js`). Il n'y a donc aucune pile a depiler, ni
 * par le bouton retour du telephone, ni par un geste de retour arriere.
 * @param {{
 *  contactUrl?: string | null;
 *  currentVersion?: string | null;
 *  minimumVersion?: string | null;
 *  onOpenUrl?: (url: string) => void;
 *  storeUrl?: string | null;
 * }} props
 * @returns {import('react').ReactElement}
 */
function AppUpdateRequiredScreen({
  contactUrl = null,
  currentVersion = null,
  minimumVersion = null,
  onOpenUrl,
  storeUrl = null,
} = {}) {
  const {
    Alignments, ApplicationStyle, Fonts, Images, Spaces,
  } = useTheme();
  const { t } = useTranslation();

  /** @type {import('react-native').ImageStyle} */
  const imageStyle = {
    height: 33,
    resizeMode: 'contain',
    width: 270,
  };

  /**
   * Ouvre une adresse, en laissant le test intercepter la sortie.
   * @param {string | null} url
   */
  const openUrl = (url) => {
    if (!url) return;
    if (typeof onOpenUrl === 'function') {
      onOpenUrl(url);
      return;
    }
    Linking.openURL(url);
  };

  const versionLine = [
    currentVersion
      ? t('appUpdateGate.installedVersion', {
        defaultValue: 'Version installée : {{version}}',
        version: currentVersion,
      })
      : null,
    minimumVersion
      ? t('appUpdateGate.requiredVersion', {
        defaultValue: 'Version demandée : {{version}}',
        version: minimumVersion,
      })
      : null,
  ].filter(Boolean).join(' · ');

  return (
    <View
      style={[
        Alignments.fill,
        ApplicationStyle.backgroundColor.primary900,
      ]}
    >
      <ScrollView
        contentContainerStyle={[
          Alignments.scrollSpaceBetween,
          Spaces.padding[24],
          Spaces.gap[24],
          Alignments.alignCenter,
        ]}
      >
        <View />
        <Image
          source={Images.logo}
          style={imageStyle}
        />
        <View style={[Alignments.justifyCenter, Alignments.alignCenter, Spaces.gap[12]]}>
          <Text style={[Fonts.h2Black, Fonts.neutral00]}>
            {t('appUpdateGate.title', 'Mise à jour nécessaire').toUpperCase()}
          </Text>
          <Text style={[Fonts.p1, Fonts.neutral00]}>
            {t(
              'appUpdateGate.why',
              'Cette version de FoundClub est trop ancienne. Des corrections importantes '
              + "sont arrivées depuis, et l'application ne peut plus fonctionner correctement "
              + 'avec celle-ci.',
            )}
          </Text>
          <Text style={[Fonts.p1, Fonts.neutral00]}>
            {t(
              'appUpdateGate.what',
              'Installe la dernière version depuis la boutique, puis rouvre FoundClub. '
              + 'Tes données et ton compte sont intacts.',
            )}
          </Text>
          {versionLine ? (
            <Text style={[Fonts.p3, Fonts.neutral00]}>
              {versionLine}
            </Text>
          ) : null}
        </View>
        <View style={[Alignments.fullWidth, Spaces.gap[12], Spaces.padding[24]]}>
          <Button
            accessibilityHint={t(
              'appUpdateGate.a11y.updateHint',
              "Ouvre la boutique d'applications de ce téléphone.",
            )}
            accessibilityLabel={t('appUpdateGate.actions.update', 'Mettre à jour')}
            disabled={!storeUrl}
            onPress={() => openUrl(storeUrl)}
            style={Alignments.fullWidth}
            title={t('appUpdateGate.actions.update', 'Mettre à jour')}
            variant="Primary"
          />
          <Button
            accessibilityHint={t(
              'appUpdateGate.a11y.contactHint',
              "Ouvre le site FoundClub pour joindre l'équipe.",
            )}
            accessibilityLabel={t('appUpdateGate.actions.contact', 'Un problème ? Nous contacter')}
            disabled={!contactUrl}
            onPress={() => openUrl(contactUrl)}
            style={Alignments.fullWidth}
            title={t('appUpdateGate.actions.contact', 'Un problème ? Nous contacter')}
            variant="Ghost"
          />
        </View>
      </ScrollView>
    </View>
  );
}

export default AppUpdateRequiredScreen;
