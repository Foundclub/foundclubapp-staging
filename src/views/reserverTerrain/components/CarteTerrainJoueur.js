import { useTranslation } from 'react-i18next';
import {
  Image, Text, View,
} from 'react-native';

import { ligneTerrain, texteHeure } from '@/domains/complexe/complexeTerrain';
import { lignesDuTerrainPublic } from '@/domains/complexe/reserverTerrain';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import PastilleMode from '@/views/complexe/components/PastilleMode';
import PuceChoix from '@/views/reserverTerrain/components/PuceChoix';

import { useCreneauxDuJour } from '@/services/complexe/complexeJoueurQueries';

const PUCES_MAX = 6;
const PHOTO = 120;

/**
 * LA CARTE D'UN TERRAIN, CÔTÉ JOUEUR — RESA-L6A (14/10/2026), planches EP02 (segment « Réserver »),
 * RA2 et P00 bloc 5 « Joueur » : la photo, « Terrain 1 · Foot à 5 · Extérieur · 10 joueurs », le
 * mode (Confirmation immédiate · Sur demande · Par téléphone), le prix indicatif au créneau ET par
 * joueur (A-G28, jamais un total à payer), les créneaux LIBRES du jour en puces, et « Voir les
 * créneaux ». Un terrain « par téléphone » montre aussi ses créneaux (A-G24) : en toucher un
 * ouvre la feuille d'appel ; « Réserver par téléphone » aussi.
 * @param {object} props - Les propriétés.
 * @param {string} props.date - Le jour des puces (aujourd'hui, à Paris).
 * @param {(creneau: any) => void} props.onCreneau - Toucher un créneau libre.
 * @param {() => void} props.onTelephone - « Réserver par téléphone ».
 * @param {() => void} props.onVoir - « Voir les créneaux ».
 * @param {string} props.slug - L'adresse publique du complexe.
 * @param {any} props.terrain - Le terrain (`GET /public-complexes/:slug/terrains`).
 * @returns {import('react').ReactElement} La carte.
 */
function CarteTerrainJoueur({
  date, onCreneau, onTelephone, onVoir, slug, terrain,
}) {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images,
  } = useTheme();
  const creneaux = useCreneauxDuJour(slug, terrain?.documentId, date);
  const nom = String(terrain?.name || '');
  const parTelephone = terrain?.bookingMode === 'telephone';
  const prix = lignesDuTerrainPublic(t, terrain);
  const photo = Array.isArray(terrain?.photos) ? terrain.photos.find(Boolean) : null;
  const libres = (Array.isArray(creneaux?.data?.slots) ? creneaux.data.slots : [])
    .filter((/** @type {any} */ creneau) => creneau?.state === 'libre')
    .slice(0, PUCES_MAX);

  return (
    <View
      style={[
        ApplicationStyle.borderRadius24,
        {
          backgroundColor: withAlpha(Colors.primary800, 0.6),
          borderColor: withAlpha(Colors.primary500, 0.24),
          borderWidth: 1,
          gap: 12,
          overflow: 'hidden',
          padding: 16,
        },
      ]}
      testID={`carte-terrain-joueur-${terrain?.documentId}`}
    >
      {photo ? (
        <Image
          accessibilityIgnoresInvertColors
          resizeMode="cover"
          source={{ uri: String(photo) }}
          style={{ borderRadius: 16, height: PHOTO, width: '100%' }}
        />
      ) : null}
      <View style={{ gap: 4 }}>
        <Text numberOfLines={2} style={[Fonts.h5Bold, Fonts.neutral00]}>{nom}</Text>
        <Text style={[Fonts.p3, Fonts.neutral200]}>{ligneTerrain(t, terrain)}</Text>
      </View>
      <View style={[Alignments.row, Alignments.wrap, Alignments.alignCenter, { gap: 8 }]}>
        <PastilleMode joueur mode={terrain?.bookingMode} />
      </View>
      {prix ? (
        <View style={[Alignments.row, { alignItems: 'flex-start', gap: 6 }]}>
          <Image
            source={Images.euroCircle}
            style={[{ height: 14, marginTop: 3, width: 14 }, ApplicationStyle.tintColor.primary200]}
          />
          <View style={{ flex: 1 }}>
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{prix.principal}</Text>
            <Text style={[Fonts.p3, Fonts.neutral100]}>{prix.secondaire}</Text>
          </View>
        </View>
      ) : null}
      {libres.length ? (
        <View style={[Alignments.row, Alignments.wrap, { gap: 8 }]}>
          {libres.map((/** @type {any} */ creneau) => (
            <PuceChoix
              accessibilityLabel={t(
                'reserverTerrain.recherche.creneauA11y',
                '{{terrain}}, {{heure}}',
                {
                  heure: texteHeure(creneau.from),
                  terrain: nom,
                  ...SANS_ECHAPPEMENT,
                },
              )}
              key={creneau.from}
              libelle={texteHeure(creneau.from)}
              onPress={() => onCreneau(creneau)}
              testID={`terrain-${terrain?.documentId}-creneau-${creneau.from}`}
            />
          ))}
        </View>
      ) : null}
      {parTelephone && libres.length ? (
        <Text style={[Fonts.p3Bold, Fonts.primary200]}>
          {t('reserverTerrain.complexe.toucheUnCreneau', 'Par téléphone : touche un créneau')}
        </Text>
      ) : null}
      {parTelephone ? (
        <Button
          icon="phone"
          onPress={onTelephone}
          title={t('reserverTerrain.complexe.reserverParTelephone', 'Réserver par téléphone')}
          variant="Secondary"
        />
      ) : (
        <Button
          accessibilityLabel={t(
            'reserverTerrain.complexe.voirLesCreneauxA11y',
            '{{nom}} : voir les créneaux',
            {
              nom,
              ...SANS_ECHAPPEMENT,
            },
          )}
          onPress={onVoir}
          title={t('reserverTerrain.complexe.voirLesCreneaux', 'Voir les créneaux')}
          variant="Secondary"
        />
      )}
    </View>
  );
}

export default CarteTerrainJoueur;
