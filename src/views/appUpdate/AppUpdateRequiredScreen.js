import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image, Linking, Platform, ScrollView, Text, View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';

/**
 * Le nom de la boutique, ecrit en toutes lettres — le pack l'exige : « nom du
 * store ecrit en toutes lettres selon la plateforme ». « Va sur le store » ne
 * dit a personne ou appuyer.
 * @param {(key: string, fallback: string) => string} t
 * @returns {string}
 */
const resolveStoreName = (t) => (
  Platform.OS === 'ios'
    ? t('appUpdateGate.stores.ios', "l'App Store")
    : t('appUpdateGate.stores.android', 'Google Play')
);

/**
 * S09 — l'ecran qui bloque une version trop ancienne. R3 l'habille (planches
 * A et B du pack).
 *
 * 📜 IL DIT POURQUOI, ET CE N'EST PAS DECORATIF : quelqu'un bloque sans
 * explication desinstalle. La pastille de version porte la raison — sans elle,
 * l'ecran ressemble a une panne de l'app.
 *
 * 🔒 IL LAISSE UNE ISSUE : le second bouton mene au contact. Le pack dessine
 * « une seule sortie » ; on garde volontairement celle-ci, parce qu'un
 * cul-de-sac total transforme un incident de version en perte d'utilisateur.
 * C'est la SEULE divergence assumee avec la planche A.
 *
 * 🚪 Il ne se contourne pas : ce composant REMPLACE tout l'arbre de navigation
 * (voir `src/app/AppUpdateGate.js`). Il n'y a donc aucune pile a depiler, ni
 * par le bouton retour du telephone, ni par un geste de retour arriere.
 * @param {{
 *  contactUrl?: string | null;
 *  currentVersion?: string | null;
 *  minimumVersion?: string | null;
 *  onOpenUrl?: (url: string) => void | Promise<void>;
 *  releaseNotes?: string[];
 *  storeUrl?: string | null;
 * }} props
 * @returns {import('react').ReactElement}
 */
function AppUpdateRequiredScreen({
  contactUrl = null,
  currentVersion = null,
  minimumVersion = null,
  onOpenUrl,
  releaseNotes = [],
  storeUrl = null,
} = {}) {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const [openFailed, setOpenFailed] = useState(false);

  /** @type {import('react-native').ImageStyle} */
  const imageStyle = {
    height: 33,
    resizeMode: 'contain',
    width: 270,
  };

  /** @type {import('react-native').ViewStyle} */
  const badgeStyle = {
    backgroundColor: withAlpha(Colors.primary500, 0.12),
    borderColor: withAlpha(Colors.primary500, 0.32),
    borderWidth: 1,
    height: 96,
    width: 96,
  };

  /** @type {import('react-native').ViewStyle} */
  const chipStyle = {
    backgroundColor: withAlpha(Colors.neutral00, 0.06),
    borderColor: withAlpha(Colors.neutral00, 0.1),
    borderWidth: 1,
  };

  /** @type {import('react-native').ViewStyle} */
  const chipDotStyle = {
    backgroundColor: Colors.warning500,
    height: 6,
    width: 6,
  };

  /** @type {import('react-native').ViewStyle} */
  const notesCardStyle = {
    backgroundColor: withAlpha(Colors.primary700, 0.6),
    borderColor: withAlpha(Colors.neutral00, 0.08),
    borderWidth: 1,
  };

  /** @type {import('react-native').TextStyle} */
  const notesTitleStyle = {
    letterSpacing: 2,
    textTransform: 'uppercase',
  };

  /**
   * Ouvre une adresse, en laissant le test intercepter la sortie.
   *
   * 🏪 STORE INJOIGNABLE : `Linking.openURL` rejette quand aucune application
   * ne sait ouvrir l'adresse. Le pack demande alors une ligne factuelle sous le
   * bouton — pas un toast : l'ecran est deja minimal, et un message qui
   * s'efface tout seul sur un ecran sans autre issue ne se relit pas.
   * @param {string | null} url
   * @returns {Promise<void>}
   */
  const openUrl = async (url) => {
    if (!url) return;
    setOpenFailed(false);
    try {
      if (typeof onOpenUrl === 'function') {
        await onOpenUrl(url);
        return;
      }
      await Linking.openURL(url);
    } catch (_error) {
      setOpenFailed(true);
    }
  };

  // La pastille du pack : « Version 3.2 requise · tu es en 3.0.1 ». Quand une
  // seule des deux versions est connue, on retombe sur la ligne simple plutot
  // que d'afficher un libelle a trou.
  const versionLine = (minimumVersion && currentVersion)
    ? t('appUpdateGate.versionChip', {
      current: currentVersion,
      defaultValue: 'Version {{minimum}} requise · tu es en {{current}}',
      minimum: minimumVersion,
    })
    : [
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

  // 🧾 Jamais de carte vide : sans nouveautes, la planche A s'affiche telle quelle.
  const notes = Array.isArray(releaseNotes)
    ? releaseNotes.filter((note) => typeof note === 'string' && note.trim().length > 0)
    : [];

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
        <Image
          source={Images.logo}
          style={imageStyle}
        />
        <View style={[Alignments.justifyCenter, Alignments.alignCenter, Spaces.gap[16]]}>
          <View
            style={[
              badgeStyle,
              ApplicationStyle.borderRadius32,
              Alignments.alignCenter,
              Alignments.justifyCenter,
            ]}
          >
            <GlyphIcon color={Colors.primary500} name="arrowDownToBracket" size={42} />
          </View>
          <Text style={[Fonts.h2Black, Fonts.neutral00, Fonts.textCenter]}>
            {t('appUpdateGate.title', 'Une mise à jour est disponible')}
          </Text>
          <Text style={[Fonts.p1, Fonts.neutral300, Fonts.textCenter]}>
            {t(
              'appUpdateGate.why',
              "Télécharge la nouvelle version de FoundClub pour continuer à profiter de l'app.",
            )}
          </Text>
          <Text style={[Fonts.p3, Fonts.neutral400, Fonts.textCenter]}>
            {t('appUpdateGate.what', 'Tes données et ton compte sont intacts.')}
          </Text>
          {versionLine ? (
            <View
              style={[
                chipStyle,
                ApplicationStyle.borderRadius100,
                Alignments.row,
                Alignments.alignCenter,
                Spaces.gap[8],
                Spaces.paddingVertical[8],
                Spaces.paddingHorizontal[12],
              ]}
            >
              <View style={[chipDotStyle, ApplicationStyle.borderRadius100]} />
              <Text style={[Fonts.p3Bold, Fonts.neutral300]}>
                {versionLine}
              </Text>
            </View>
          ) : null}
          {notes.length ? (
            <View
              style={[
                notesCardStyle,
                ApplicationStyle.borderRadius16,
                Alignments.fullWidth,
                Spaces.padding[16],
                Spaces.gap[12],
              ]}
            >
              <Text style={[Fonts.label, Fonts.neutral500, notesTitleStyle]}>
                {t('appUpdateGate.releaseNotesTitle', 'Dans cette version')}
              </Text>
              {notes.map((note) => (
                <View
                  key={note}
                  style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}
                >
                  <Image
                    source={Images.check}
                    style={[ApplicationStyle.icon16, { tintColor: Colors.success500 }]}
                  />
                  <Text style={[Fonts.p3, Fonts.neutral00, Alignments.grow1]}>
                    {note}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
        <View style={[Alignments.fullWidth, Spaces.gap[12]]}>
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
          {openFailed ? (
            <Text style={[Fonts.p3, Fonts.error500, Fonts.textCenter]}>
              {t('appUpdateGate.storeUnreachable', "Impossible d'ouvrir le store. Réessaie.")}
            </Text>
          ) : (
            <Text style={[Fonts.p3, Fonts.neutral400, Fonts.textCenter]}>
              {t('appUpdateGate.redirectNotice', {
                defaultValue: 'Tu seras redirigé·e vers {{store}}.',
                store: resolveStoreName(t),
              })}
            </Text>
          )}
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
