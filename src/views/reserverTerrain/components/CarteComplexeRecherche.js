import { useTranslation } from 'react-i18next';
import {
  Image, Text, TouchableOpacity, View,
} from 'react-native';

import { formatEuros, libelleSport, texteHeure } from '@/domains/complexe/complexeTerrain';
import { texteKilometres } from '@/domains/complexe/reserverTerrain';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import BadgeComplexe from '@/views/complexe/components/BadgeComplexe';
import LogoComplexe from '@/views/complexe/components/LogoComplexe';
import PuceChoix from '@/views/reserverTerrain/components/PuceChoix';

/** Les puces horaires montrées avant « + n » (planche EP01 rubrique 9 : 2 lignes au plus). */
const PUCES_MAX = 6;

/**
 * La part d'un joueur la plus basse parmi les créneaux libres (RA1 : « dès 6 €/joueur »).
 * @param {any[]} creneaux - Les créneaux de la carte.
 * @returns {number | null} Le prix, ou null.
 */
const partLaPlusBasse = (creneaux) => {
  const parts = creneaux
    .map((creneau) => Number(creneau?.price?.perPlayer))
    .filter((valeur) => Number.isFinite(valeur) && valeur > 0);
  return parts.length ? Math.min(...parts) : null;
};

/**
 * LA CARTE D'UN COMPLEXE DANS LA RECHERCHE — RESA-L6A (14/10/2026), planches EP01 (état 1) et RA1
 * (état 3) : le logo carré, le nom, la pastille « Complexe de réservation » (A-G05), la distance,
 * les sports, les prochains créneaux VRAIMENT libres en puces (RC-P01 : le serveur ne rend que
 * ceux-là), « dès 6 € par joueur », et « Téléphone seulement » si tous ses terrains le sont.
 * ⛔ Ni « Favori » ni les partenaires qui défilent : lots L4 (serveur) puis L6b.
 * RESA-CARTE (20/10) : `choisie`, la carte du complexe dont l'épingle est touchée (liseré cyan
 * plein, planches EP01 état 2 et OR2) ; `compacte`, celle posée EN BAS de la carte du téléphone
 * (planche EP01 état 2 : logo, nom, « 2,4 km · Foot à 5 · Padel », créneaux ; ni pastille ni
 * prix ; fond plein, la carte ne transparaît pas).
 * @param {object} props - Les propriétés.
 * @param {any} props.carte - Une carte de `GET /public-complexes`.
 * @param {boolean} [props.choisie] - Son épingle est la choisie.
 * @param {boolean} [props.compacte] - Posée sur la carte du téléphone.
 * @param {(creneau: any) => void} props.onCreneau - Toucher un créneau (E-P03).
 * @param {() => void} props.onOuvrir - Toucher la carte (E-P02).
 * @returns {import('react').ReactElement} La carte.
 */
function CarteComplexeRecherche({
  carte, choisie = false, compacte = false, onCreneau, onOuvrir,
}) {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images,
  } = useTheme();
  const nom = String(carte?.name || '');
  const creneaux = Array.isArray(carte?.slots) ? carte.slots : [];
  const montres = creneaux.slice(0, PUCES_MAX);
  const enPlus = Math.max(0, Number(carte?.freeSlotsCount || creneaux.length) - montres.length);
  const sports = (Array.isArray(carte?.sports) ? carte.sports : [])
    .map((/** @type {string} */ sport) => libelleSport({ name: sport }))
    .filter(Boolean)
    .join(' · ');
  const part = partLaPlusBasse(creneaux);
  const distance = texteKilometres(carte?.distanceKm);

  return (
    <View
      style={[
        ApplicationStyle.borderRadius24,
        {
          backgroundColor: withAlpha(Colors.primary800, compacte ? 0.97 : 0.6),
          borderColor: choisie ? Colors.primary500 : withAlpha(Colors.primary500, 0.24),
          borderWidth: 1,
          gap: compacte ? 8 : 12,
          padding: compacte ? 12 : 16,
        },
      ]}
      testID={`carte-complexe-${carte?.slug}`}
    >
      <TouchableOpacity
        accessibilityLabel={t(
          'reserverTerrain.recherche.voirLeComplexe',
          '{{nom}} : voir le complexe',
          {
            nom,
            ...SANS_ECHAPPEMENT,
          },
        )}
        accessibilityRole="button"
        onPress={onOuvrir}
        style={[Alignments.row, { alignItems: 'flex-start', gap: 12 }]}
      >
        <LogoComplexe logo={carte?.logo || null} nom={nom} taille={compacte ? 40 : 48} />
        {compacte ? (
          <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
            <Text numberOfLines={1} style={[Fonts.p1Bold, Fonts.neutral00]}>{nom}</Text>
            <Text numberOfLines={2} style={[Fonts.p3, Fonts.neutral200]}>
              {[distance, sports].filter(Boolean).join(' · ')}
            </Text>
          </View>
        ) : (
          <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
            <Text numberOfLines={2} style={[Fonts.h5Bold, Fonts.neutral00]}>{nom}</Text>
            <View style={[Alignments.row, Alignments.wrap, Alignments.alignCenter, { gap: 8 }]}>
              <BadgeComplexe />
              {distance ? <Text style={[Fonts.p3Bold, Fonts.neutral100]}>{distance}</Text> : null}
            </View>
            {sports ? <Text style={[Fonts.p3, Fonts.neutral200]}>{sports}</Text> : null}
          </View>
        )}
      </TouchableOpacity>
      {montres.length ? (
        <View style={[Alignments.row, Alignments.wrap, { gap: 8 }]}>
          {montres.map((/** @type {any} */ creneau) => (
            <PuceChoix
              accessibilityLabel={t(
                'reserverTerrain.recherche.creneauA11y',
                '{{terrain}}, {{heure}}',
                {
                  heure: texteHeure(creneau.from),
                  terrain: String(creneau?.terrain?.name || ''),
                  ...SANS_ECHAPPEMENT,
                },
              )}
              key={`${creneau?.terrain?.documentId}-${creneau.from}`}
              libelle={texteHeure(creneau.from)}
              onPress={() => onCreneau(creneau)}
            />
          ))}
          {enPlus ? (
            <PuceChoix
              accessibilityLabel={t(
                'reserverTerrain.recherche.plusDeCreneaux',
                '{{nombre}} créneaux de plus',
                {
                  nombre: enPlus,
                },
              )}
              libelle={`+ ${enPlus}`}
              onPress={onOuvrir}
            />
          ) : null}
        </View>
      ) : null}
      {(part !== null && !compacte) || carte?.phoneOnly ? (
        <View style={[Alignments.row, Alignments.wrap, Alignments.alignCenter, { gap: 12 }]}>
          {part !== null && !compacte ? (
            <View style={[Alignments.row, Alignments.alignCenter, { gap: 4 }]}>
              <Image
                source={Images.euroCircle}
                style={[{ height: 12, width: 12 }, ApplicationStyle.tintColor.primary200]}
              />
              <Text style={[Fonts.p3Bold, Fonts.neutral100]}>
                {t('reserverTerrain.recherche.desParJoueur', 'dès {{prix}} par joueur', {
                  prix: formatEuros(part),
                  ...SANS_ECHAPPEMENT,
                })}
              </Text>
            </View>
          ) : null}
          {carte?.phoneOnly ? (
            <View style={[Alignments.row, Alignments.alignCenter, { gap: 4 }]}>
              <Image
                source={Images.phone}
                style={[{ height: 12, width: 12 }, ApplicationStyle.tintColor.primary200]}
              />
              <Text style={[Fonts.p3Bold, Fonts.primary200]}>
                {t('reserverTerrain.recherche.telephoneSeulement', 'Téléphone seulement')}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export default CarteComplexeRecherche;
