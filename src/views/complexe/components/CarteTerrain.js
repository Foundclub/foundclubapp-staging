import { useTranslation } from 'react-i18next';
import {
  Image, Text, TouchableOpacity, View,
} from 'react-native';

import { lignesDePrix, ligneTerrain, resumeOuverture } from '@/domains/complexe/complexeTerrain';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import { SvgIcon } from '@/components/atoms/SvgIcon/SvgIcon';
import PastilleMode from '@/views/complexe/components/PastilleMode';

import { resolveFacilityPlanningColor } from '@/utils/facilityPlanningColor';

const LISERE = 4;
const VIGNETTE = 56;

/**
 * LA CARTE D'UN TERRAIN, CÔTÉ GÉRANT — RESA-L5A1 (13/10/2026), planches E-G07 et P00 bloc 5 : la
 * carte des installations des Villes (`FacilityList.js`, liseré gauche à la couleur du planning)
 * avec la photo ou le pictogramme, « Foot à 5 · Extérieur · 10 joueurs », le mode, le prix
 * indicatif (« 60 € le créneau », jamais un total à payer) et les horaires d'ouverture — ou, en
 * orange, « Aucun créneau ouvert ». Un terrain coupé dit « Pas réservable ».
 * @param {object} props - Les propriétés.
 * @param {() => void} props.onOuvrir - Toucher la carte : la fiche du terrain (E-G08).
 * @param {() => void} [props.onPlus] - Le menu « … » ; sans lui, pas de bouton.
 * @param {any} props.terrain - Le terrain (`GET /complexes/:id/terrains`).
 * @returns {import('react').ReactElement} La carte.
 */
function CarteTerrain({ onOuvrir, onPlus = undefined, terrain }) {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images,
  } = useTheme();
  const nom = String(terrain?.name || '');
  const prix = lignesDePrix(t, {
    basePrice: terrain?.basePrice,
    capacity: terrain?.capacity,
    priceUnit: terrain?.priceUnit,
  });
  const ouverture = resumeOuverture(t, terrain?.slotPlan);
  const photo = Array.isArray(terrain?.photos)
    ? terrain.photos.find((/** @type {any} */ p) => p?.url)?.url
    : null;

  return (
    <View
      style={[
        ApplicationStyle.borderRadius24,
        {
          backgroundColor: withAlpha(Colors.primary800, 0.6),
          borderColor: withAlpha(Colors.neutral00, 0.13),
          borderLeftColor: resolveFacilityPlanningColor(terrain) || Colors.primary500,
          borderLeftWidth: LISERE,
          borderWidth: 1,
          gap: 10,
          padding: 16,
        },
      ]}
      testID={`carte-terrain-${terrain?.documentId}`}
    >
      <View style={[Alignments.row, { alignItems: 'flex-start', gap: 12 }]}>
        <TouchableOpacity
          accessibilityLabel={t('complexeGerant.terrain.ouvrirA11y', '{{nom}} : ouvrir la fiche', {
            nom,
            ...SANS_ECHAPPEMENT,
          })}
          accessibilityRole="button"
          onPress={onOuvrir}
          style={[Alignments.row, {
            alignItems: 'flex-start', flex: 1, gap: 12, minWidth: 0,
          }]}
        >
          <View
            style={[
              Alignments.alignCenter,
              Alignments.justifyCenter,
              {
                backgroundColor: withAlpha(Colors.primary500, 0.12),
                borderRadius: 12,
                height: VIGNETTE,
                overflow: 'hidden',
                width: VIGNETTE,
              },
            ]}
          >
            {photo ? (
              <Image
                resizeMode="cover"
                source={{ uri: photo }}
                style={{ height: VIGNETTE, width: VIGNETTE }}
              />
            ) : (
              <Image
                source={Images.stadium}
                style={[ApplicationStyle.icon20, ApplicationStyle.tintColor.primary200]}
              />
            )}
          </View>
          <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
            <Text numberOfLines={2} style={[Fonts.h5Bold, Fonts.neutral00]}>{nom}</Text>
            <Text style={[Fonts.p3, Fonts.neutral200]}>{ligneTerrain(t, terrain)}</Text>
          </View>
        </TouchableOpacity>
        {onPlus ? (
          <TouchableOpacity
            accessibilityLabel={t('complexeGerant.terrain.plusA11y', 'Plus d’actions : {{nom}}', {
              nom,
              ...SANS_ECHAPPEMENT,
            })}
            accessibilityRole="button"
            onPress={onPlus}
            style={[Alignments.alignCenter, Alignments.justifyCenter, { height: 44, width: 44 }]}
            testID={`carte-terrain-plus-${terrain?.documentId}`}
          >
            <SvgIcon color={Colors.primary200} height={20} name="dots-horizontal" width={20} />
          </TouchableOpacity>
        ) : null}
      </View>
      <View style={[Alignments.row, Alignments.wrap, { gap: 8 }]}>
        <PastilleMode mode={terrain?.bookingMode} />
        {prix ? (
          <View
            style={[
              Alignments.row,
              Alignments.alignCenter,
              {
                backgroundColor: withAlpha(Colors.neutral00, 0.06),
                borderRadius: 999,
                gap: 4,
                paddingHorizontal: 8,
                paddingVertical: 2,
              },
            ]}
          >
            <Image
              source={Images.euroCircle}
              style={[{ height: 12, width: 12 }, ApplicationStyle.tintColor.primary200]}
            />
            <Text style={[Fonts.p3Bold, Fonts.neutral100]}>{prix.principal}</Text>
          </View>
        ) : null}
      </View>
      {ouverture ? (
        <View style={[Alignments.row, { alignItems: 'flex-start', gap: 8 }]}>
          <Image
            source={Images.clock}
            style={[{ height: 14, marginTop: 2, width: 14 }, ApplicationStyle.tintColor.primary500]}
          />
          <Text style={[Fonts.p3, Fonts.neutral100, { flex: 1 }]}>{ouverture}</Text>
        </View>
      ) : (
        <View style={[Alignments.row, Alignments.alignCenter, { gap: 8 }]}>
          <Image
            source={Images.calendar}
            style={[{ height: 14, width: 14 }, ApplicationStyle.tintColor.warning500]}
          />
          <Text style={[Fonts.p3Bold, Fonts.warning500]}>
            {t('complexeGerant.terrain.aucunCreneau', 'Aucun créneau ouvert')}
          </Text>
        </View>
      )}
      {terrain?.isBookable === false ? (
        <View
          style={{
            alignSelf: 'flex-start',
            backgroundColor: withAlpha(Colors.primary200, 0.12),
            borderRadius: 999,
            paddingHorizontal: 8,
            paddingVertical: 2,
          }}
        >
          <Text style={[Fonts.p3Bold, Fonts.primary200]}>
            {t('complexeGerant.terrain.pasReservable', 'Pas réservable')}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export default CarteTerrain;
