import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { messageDInvitation } from '@/domains/complexe/partieDuJoueur';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';

import { useLienDInvitation } from '@/services/complexe/complexeJoueurQueries';

import SharePlatform from '@/platform/share';

/**
 * « INVITER PAR LIEN » — RESA-L6B-2 (20/10/2026), planches EP07 état 4 et EP05, plan E-P07
 * (RG-LIEN, A-P05, RC-P06). À l'ouverture, le serveur rend le lien de la réservation (code opaque,
 * `POST …/lien {actif: true}`) ; puis le message prêt à envoyer, « Copier le lien », « Partager »
 * (la feuille du téléphone, ou celle du navigateur sur le site) et, sur E-P07, « Désactiver le
 * lien » (le code s'efface : l'ancien lien ne mène plus nulle part). Montée seulement quand on
 * l'ouvre : la fermer la démonte.
 * @param {object} props - Les propriétés.
 * @param {(fin?: { desactive?: boolean }) => void} props.close - Fermer (`desactive` : le lien
 *   vient d'être désactivé).
 * @param {{ complexe?: string | null, date?: string | null, from?: string | null,
 *   sport?: string | null }} props.partie - La partie (pour le message).
 * @param {string} props.reservationId - documentId de la réservation.
 * @param {boolean} [props.sansDesactiver] - E-P05 : pas de « Désactiver le lien ».
 * @returns {import('react').ReactElement} La feuille.
 */
function FeuilleInviterParLien({
  close, partie, reservationId, sansDesactiver = false,
}) {
  const { t } = useTranslation();
  const { Colors, Fonts } = useTheme();
  const lien = useLienDInvitation();
  const [url, setUrl] = useState(/** @type {string | null} */ (null));
  const [echec, setEchec] = useState(false);
  const [copie, setCopie] = useState(false);

  const demander = async () => {
    setEchec(false);
    try {
      const reponse = await lien.mutateAsync({ actif: true, reservationId });
      setUrl(reponse?.url ? String(reponse.url) : null);
      if (!reponse?.url) setEchec(true);
    } catch (_erreur) {
      setEchec(true);
    }
  };

  useEffect(() => {
    demander();
    // Une demande, à l'ouverture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const message = url ? messageDInvitation(t, { ...partie, url }) : '';
  const partager = async () => {
    if (!url) return;
    await SharePlatform.share({ message, url }).catch(() => undefined);
  };
  const copierLeLien = async () => {
    // La copie commune (src/platform/share : module natif au téléphone, navigateur sur le site).
    if (url) setCopie(await SharePlatform.copier(url));
  };
  const desactiver = async () => {
    try {
      await lien.mutateAsync({ actif: false, reservationId });
      close({ desactive: true });
    } catch (_erreur) {
      setEchec(true);
    }
  };

  return (
    <BottomModal close={() => close()} isVisible webPresentation="dialog">
      <View style={{ gap: 12 }}>
        <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00]}>
          {t('reserverTerrain.lien.titre', 'Inviter par lien')}
        </Text>
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          {t(
            'reserverTerrain.lien.explication',
            'Ceux qui ont le lien voient la partie ; pour répondre, il leur faut un compte.',
          )}
        </Text>
        {echec ? (
          <View accessibilityRole="alert" style={{ gap: 8 }}>
            <Text style={[Fonts.p2Bold, Fonts.error300]}>
              {t('reserverTerrain.lien.echec', 'Le lien n’a pas pu être créé.')}
            </Text>
            <Button
              onPress={demander}
              title={t('reserverTerrain.recherche.reessayer', 'Réessayer')}
              variant="Secondary"
            />
          </View>
        ) : null}
        {url ? (
          <>
            <View
              style={{
                backgroundColor: withAlpha(Colors.primary500, 0.1),
                borderColor: withAlpha(Colors.primary500, 0.45),
                borderRadius: 16,
                borderWidth: 1,
                padding: 12,
              }}
              testID="inviter-message"
            >
              <Text selectable style={[Fonts.p2, Fonts.neutral00]}>{message}</Text>
            </View>
            <Button
              onPress={copierLeLien}
              title={t('reserverTerrain.lien.copier', 'Copier le lien')}
              variant="Secondary"
            />
            {copie ? (
              <Text accessibilityLiveRegion="polite" style={[Fonts.p3Bold, Fonts.success500]}>
                {t('reserverTerrain.lien.copie', 'Lien copié')}
              </Text>
            ) : null}
            <Button
              icon="share"
              onPress={partager}
              title={t('reserverTerrain.lien.partager', 'Partager')}
              variant="Primary"
            />
            {!sansDesactiver ? (
              <TouchableOpacity
                accessibilityRole="button"
                onPress={desactiver}
                style={{ alignItems: 'center', justifyContent: 'center', minHeight: 44 }}
              >
                <Text style={[Fonts.p2Bold, Fonts.error300]}>
                  {t('reserverTerrain.lien.desactiver', 'Désactiver le lien')}
                </Text>
              </TouchableOpacity>
            ) : null}
          </>
        ) : null}
      </View>
    </BottomModal>
  );
}

export default FeuilleInviterParLien;
