import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Linking, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';
import { GRAS_FAMILLE, REGULIER_FAMILLE } from '@/components/molecules/bulleDuFil/typographieDuFil';

import { buildExternalMapLinks, listExternalMapApps } from '@/platform/maps/externalMap';

/**
 * MSG1A (§3.18) — LA FEUILLE D'UNE ADRESSE TOUCHEE DANS LE FIL (« comme WhatsApp ») :
 * ouvrir dans une application de cartes, ou copier l'adresse.
 *
 * Les applications proposees sont celles du TELEPHONE, pas une liste figee : on reprend
 * `listExternalMapApps` (Plans toujours sur iPhone ; Google Maps et Waze s'ils sont
 * installes ; l'appli de cartes d'Android), la meme regle que « Tu es convoque » et la
 * fiche de l'evenement. Le pack les montre toutes les trois parce qu'un navigateur ne
 * sait pas ce qui est installe.
 * @param {object} props
 * @param {{ label: string, latitude?: any, longitude?: any } | null} props.adresse - `null` : fermee.
 * @param {() => void} props.onClose
 * @param {(texte: string) => void} props.onCopy - Copie (et dit « Adresse copiee »).
 * @returns {import('react').ReactElement}
 */
function FeuilleDAdresse({ adresse, onClose, onCopy }) {
  const { Colors } = useTheme();
  const { t } = useTranslation();
  const [applis, setApplis] = useState(/** @type {{ key: string, url: string }[]} */ ([]));
  const liens = adresse ? buildExternalMapLinks(adresse) : null;

  useEffect(() => {
    let vivante = true;
    setApplis([]);
    const cible = adresse ? buildExternalMapLinks(adresse) : null;
    if (!cible) return undefined;
    listExternalMapApps(cible)
      .then((trouvees) => { if (vivante) setApplis(trouvees); })
      .catch(() => { if (vivante) setApplis([{ key: 'google', url: cible.google }]); });
    return () => { vivante = false; };
  }, [adresse]);

  const ouvrir = (/** @type {string} */ url) => {
    const secours = liens?.google || url;
    Promise.resolve()
      .then(() => Linking.openURL(url))
      .catch(() => Linking.openURL(secours))
      .catch(() => {});
    onClose();
  };

  const ligne = (
    /** @type {any} */ icone,
    /** @type {string} */ libelle,
    /** @type {() => void} */ onPress,
    /** @type {string} */ testID,
  ) => (
    <TouchableOpacity
      accessibilityRole="button"
      key={testID}
      onPress={onPress}
      style={[styles.ligne, { borderTopColor: withAlpha(Colors.neutral00, 0.07) }]}
      testID={testID}
    >
      <GlyphIcon
        color={icone === 'fileCopy' ? Colors.neutral00 : Colors.primary500}
        name={icone}
        size={20}
      />
      <Text style={[styles.ligneTexte, { color: Colors.neutral00 }]}>{libelle}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={Boolean(adresse)}
    >
      <Pressable
        accessibilityLabel={t('common.actions.close', 'Fermer')}
        onPress={onClose}
        style={[styles.voile, { backgroundColor: withAlpha(Colors.neutral900, 0.45) }]}
        testID="feuille-adresse-voile"
      >
        <Pressable
          onPress={() => {}}
          style={[styles.feuille, { backgroundColor: Colors.chatSheet }]}
          testID="feuille-adresse"
        >
          <View style={[styles.poignee, { backgroundColor: withAlpha(Colors.neutral00, 0.25) }]} />
          <View style={styles.entete}>
            <View style={[styles.rond, { backgroundColor: withAlpha(Colors.primary500, 0.14) }]}>
              <GlyphIcon color={Colors.primary500} name="locationPin" size={20} />
            </View>
            <View style={styles.enteteTextes}>
              <Text style={[styles.titre, { color: Colors.neutral00 }]}>
                {t('conversation.address.title', 'Adresse')}
              </Text>
              <Text style={[styles.adresse, { color: withAlpha(Colors.neutral00, 0.78) }]}>
                {adresse?.label || ''}
              </Text>
            </View>
          </View>
          {applis.map((appli) => ligne(
            'locationPin',
            t('conversation.address.openIn', {
              app: t(`externalMap.apps.${appli.key}`),
              defaultValue: 'Ouvrir dans {{app}}',
            }),
            () => ouvrir(appli.url),
            `feuille-adresse-${appli.key}`,
          ))}
          {ligne(
            'fileCopy',
            t('conversation.address.copy', 'Copier l’adresse'),
            () => { onCopy(adresse?.label || ''); onClose(); },
            'feuille-adresse-copier',
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  adresse: {
    fontFamily: REGULIER_FAMILLE,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
  },
  entete: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 14,
  },
  enteteTextes: {
    flex: 1,
    minWidth: 0,
  },
  feuille: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingBottom: 34,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  ligne: {
    alignItems: 'center',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 14,
    height: 54,
  },
  ligneTexte: {
    fontFamily: REGULIER_FAMILLE,
    fontSize: 15.5,
    lineHeight: 20,
  },
  poignee: {
    alignSelf: 'center',
    borderRadius: 3,
    height: 5,
    marginBottom: 14,
    width: 40,
  },
  rond: {
    alignItems: 'center',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  titre: {
    fontFamily: GRAS_FAMILLE,
    fontSize: 16,
    lineHeight: 20,
  },
  voile: {
    flex: 1,
    justifyContent: 'flex-end',
  },
});

export default FeuilleDAdresse;
