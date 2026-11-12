import { useTranslation } from 'react-i18next';
import {
  Image, Text, View,
} from 'react-native';

import { formatEuros, ligneTerrain, texteHeure } from '@/domains/complexe/complexeTerrain';
import { lignesDuTerrainPublic } from '@/domains/complexe/reserverTerrain';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import PastilleMode from '@/views/complexe/components/PastilleMode';
import PuceChoix from '@/views/reserverTerrain/components/PuceChoix';

import { useCreneauxDuJour } from '@/services/complexe/complexeJoueurQueries';

import texteInsecable from '@/utils/texteInsecable';

// RESA-JOUEUR-2 (E-P02, maquette « 232- ok ») : 3 raccourcis au plus (avant : 6 puces) et la
// photo à 150 px (avant : 120).
const PUCES_MAX = 3;
const PHOTO = 150;

/**
 * Le prix d'un créneau tel que la carte l'écrit : par joueur pour un terrain au joueur, sinon
 * celui du créneau.
 * @param {any} creneau - Le créneau lu.
 * @returns {number | null} Le montant, ou null.
 */
const prixDuRaccourci = (creneau) => {
  const prix = creneau?.price;
  const montant = prix?.unit === 'joueur' && Number.isFinite(Number(prix?.perPlayer))
    ? Number(prix.perPlayer)
    : Number(prix?.amount);
  return prix && Number.isFinite(montant) ? montant : null;
};

/**
 * LA CARTE D'UN TERRAIN, CÔTÉ JOUEUR — RESA-L6A (14/10/2026), planches EP02 (segment « Réserver »),
 * RA2 et P00 bloc 5 « Joueur » : la photo, « Terrain 1 · Foot à 5 · Extérieur · 10 joueurs », le
 * mode (Confirmation immédiate · Sur demande · Par téléphone), le prix indicatif au créneau ET par
 * joueur (A-G28, jamais un total à payer), les créneaux LIBRES du jour en puces, et « Voir les
 * créneaux ». Un terrain « par téléphone » montre aussi ses créneaux (A-G24) : en toucher un
 * ouvre la feuille d'appel ; « Réserver par téléphone » aussi.
 * RESA-JOUEUR-2 (11/11/2026, E-P02) : la photo à 150 px avec « N photos », « Dès … » en tête de
 * ligne, et « Libres aujourd'hui » : 3 raccourcis au plus, l'heure de départ et son prix.
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
  const toutesLesPhotos = Array.isArray(terrain?.photos) ? terrain.photos.filter(Boolean) : [];
  const photo = toutesLesPhotos[0] || null;
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
        <View>
          <Image
            accessibilityIgnoresInvertColors
            resizeMode="cover"
            source={{ uri: String(photo) }}
            style={{ borderRadius: 16, height: PHOTO, width: '100%' }}
            testID={`carte-terrain-photo-${terrain?.documentId}`}
          />
          {toutesLesPhotos.length > 1 ? (
            <View
              style={{
                backgroundColor: withAlpha(Colors.neutral900, 0.6),
                borderRadius: 999,
                bottom: 8,
                paddingHorizontal: 10,
                paddingVertical: 4,
                position: 'absolute',
                right: 8,
              }}
            >
              <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
                {t('reserverTerrain.complexe.nombreDePhotos', '{{nombre}} photos', {
                  nombre: toutesLesPhotos.length,
                })}
              </Text>
            </View>
          ) : null}
        </View>
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
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
              {/* « Dès 6 € par joueur » : en tête de ligne, la majuscule. */}
              {prix.principal.charAt(0).toLocaleUpperCase('fr-FR') + prix.principal.slice(1)}
            </Text>
            <Text style={[Fonts.p3, Fonts.neutral100]}>{prix.secondaire}</Text>
          </View>
        </View>
      ) : null}
      {libres.length ? (
        <Text style={[Fonts.p3Bold, Fonts.neutral200]}>
          {t('reserverTerrain.complexe.libresAujourdhui', 'Libres aujourd’hui')}
        </Text>
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
              key={creneau.startsAt || creneau.from}
              libelle={prixDuRaccourci(creneau) === null
                ? texteHeure(creneau.from)
                : t('reserverTerrain.complexe.raccourci', '{{heure}} · {{prix}}', {
                  heure: texteHeure(creneau.from),
                  prix: formatEuros(Number(prixDuRaccourci(creneau))),
                  ...SANS_ECHAPPEMENT,
                })}
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
          title={texteInsecable(t('reserverTerrain.complexe.reserverParTelephone', 'Réserver par téléphone'))}
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
