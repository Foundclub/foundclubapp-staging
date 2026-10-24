import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image, Linking, Text, View,
} from 'react-native';

import {
  numeroLisible, prixDuCreneau, texteCreneau, texteJourLong,
} from '@/domains/complexe/reserverTerrain';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';

import { useIsDesktop } from '@/responsive';

const COPIE_MS = 2500;

/**
 * E-P06 — LA FEUILLE « TÉLÉPHONE SEULEMENT » — RESA-L6A (14/10/2026), planches EP06, RA2 (état 3)
 * et P00 (bloc 8) ; plan E-P06, A-G16, A-G24. Un terrain que le complexe ne prend qu'au téléphone :
 * son nom, le créneau touché rappelé (A-G24 : un terrain « téléphone » a lui aussi des créneaux à
 * heures précises), le texte et le numéro DU COMPLEXE (RG-TEL, jamais celui d'un joueur), « Appeler
 * le … » (lien `tel:`), « Fermer », et « une réservation par téléphone n'apparaît pas dans tes
 * réservations ». Sur ordinateur, on n'appelle pas : le numéro en grand et « Copier le numéro ».
 * Rien n'est enregistré dans l'app ; l'âge minimum ne s'applique pas (le complexe décide).
 * @param {object} props - Les propriétés.
 * @param {{ date: string, from: string, price?: any, to: string } | null} [props.creneau] - Le
 *   créneau touché, s'il y en a un.
 * @param {() => void} props.onFermer - Fermer la feuille.
 * @param {{ number?: string | null, text?: string | null } | null} props.telephone - Le numéro et
 *   le texte du terrain (`terrain.phone` des routes publiques).
 * @param {{ capacity?: number | null, name?: string | null } | null} props.terrain - Le terrain.
 * @param {boolean} props.visible - Ouverte.
 * @returns {import('react').ReactElement} La feuille.
 */
function FeuilleTelephone({
  creneau = null, onFermer, telephone, terrain, visible,
}) {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images,
  } = useTheme();
  const surOrdinateur = useIsDesktop();
  const [copie, setCopie] = useState(false);

  useEffect(() => {
    if (!copie) return undefined;
    const minuteur = setTimeout(() => setCopie(false), COPIE_MS);
    return () => clearTimeout(minuteur);
  }, [copie]);

  const numero = String(telephone?.number || '').trim();
  const lisible = numeroLisible(numero);
  const texteDuComplexe = String(telephone?.text || '').trim() || t(
    'reserverTerrain.telephone.texteParDefaut',
    'Ce terrain ne peut être réservé que par appel au',
  );
  const nom = String(terrain?.name || '');
  const prix = creneau ? prixDuCreneau(t, creneau.price, terrain?.capacity) : null;

  const appeler = () => {
    if (numero) Linking.openURL(`tel:${numero}`).catch(() => {});
  };
  const copier = async () => {
    try {
      // Sur ordinateur, le presse-papiers du navigateur (même motif que CollectiviteInviteClub).
      const presse = typeof navigator !== 'undefined' ? navigator?.clipboard : null;
      // BH16 P13-19 : sans presse-papiers, rien n'est copié ; on ne le prétend pas.
      if (typeof presse?.writeText !== 'function') {
        setCopie(false);
        return;
      }
      await presse.writeText(numero);
      setCopie(true);
    } catch (erreur) {
      setCopie(false);
    }
  };

  return (
    <BottomModal close={onFermer} isVisible={visible} webPresentation="dialog">
      <View style={{ gap: 14 }} testID="feuille-telephone">
        <View style={{ gap: 4 }}>
          <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00]}>
            {creneau
              ? t('reserverTerrain.telephone.terrainEtJour', '{{terrain}} · {{jour}}', {
                jour: texteJourLong(t, creneau.date),
                terrain: nom,
                ...SANS_ECHAPPEMENT,
              })
              : nom}
          </Text>
          {creneau ? (
            <Text style={[Fonts.p1Bold, Fonts.primary200]}>
              {texteCreneau(creneau.from, creneau.to)}
            </Text>
          ) : null}
          {prix ? (
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              {t('reserverTerrain.prix.surPlace', '{{prix}}, à régler sur place', {
                prix: prix.principal,
                ...SANS_ECHAPPEMENT,
              })}
            </Text>
          ) : null}
        </View>
        {surOrdinateur ? (
          <View style={{ gap: 6 }}>
            <Text style={[Fonts.p2, Fonts.neutral100]}>{texteDuComplexe}</Text>
            <Text selectable style={[Fonts.h2Black, Fonts.primary200, { letterSpacing: 1 }]}>
              {lisible}
            </Text>
          </View>
        ) : (
          <View
            style={[
              Alignments.row,
              {
                alignItems: 'flex-start',
                backgroundColor: withAlpha(Colors.primary500, 0.1),
                borderColor: withAlpha(Colors.primary500, 0.35),
                borderRadius: 16,
                borderWidth: 1,
                gap: 10,
                padding: 14,
              },
            ]}
          >
            <Image
              source={Images.phone}
              style={[ApplicationStyle.icon20, ApplicationStyle.tintColor.primary500]}
            />
            <Text style={[Fonts.p2Bold, Fonts.neutral00, { flex: 1 }]}>
              {t('reserverTerrain.telephone.texteEtNumero', '{{texte}} {{numero}}.', {
                numero: lisible,
                texte: texteDuComplexe,
                ...SANS_ECHAPPEMENT,
              })}
            </Text>
          </View>
        )}
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {creneau
            ? t(
              'reserverTerrain.telephone.mentionCreneau',
              'Demande ce créneau au complexe. '
                + 'Une réservation par téléphone n’apparaît pas dans tes réservations.',
            )
            : t(
              'reserverTerrain.telephone.mention',
              'Une réservation par téléphone n’apparaît pas dans tes réservations.',
            )}
        </Text>
        {copie ? (
          <Text accessibilityLiveRegion="polite" style={[Fonts.p2Bold, Fonts.success500]}>
            {t('reserverTerrain.telephone.copie', 'Numéro copié.')}
          </Text>
        ) : null}
        {surOrdinateur ? (
          <View style={[Alignments.row, { gap: 12 }]}>
            <View style={{ flex: 1 }}>
              <Button
                onPress={onFermer}
                title={t('reserverTerrain.telephone.fermer', 'Fermer')}
                variant="Ghost"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                onPress={copier}
                title={t('reserverTerrain.telephone.copier', 'Copier le numéro')}
                variant="Primary"
              />
            </View>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            <Button
              icon="phone"
              onPress={appeler}
              title={t('reserverTerrain.telephone.appeler', 'Appeler le {{numero}}', {
                numero: lisible,
                ...SANS_ECHAPPEMENT,
              })}
              variant="Primary"
            />
            <Button
              onPress={onFermer}
              title={t('reserverTerrain.telephone.fermer', 'Fermer')}
              variant="Ghost"
            />
          </View>
        )}
      </View>
    </BottomModal>
  );
}

export default FeuilleTelephone;
