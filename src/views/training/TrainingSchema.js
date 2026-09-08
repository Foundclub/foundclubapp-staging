import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Linking, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import { familleDuSchema } from '@/components/organisms/training/TrainingBlocks';
import TrainingSchemaImage from '@/components/organisms/training/TrainingSchemaImage';
import ScreenContainer from '@/components/templates/ScreenContainer';

/**
 * LE SCHÉMA EN GRAND — le dessin qu'on lit accroupi, les plots à la main.
 *
 * 🔎 POURQUOI UN ÉCRAN ENTIER POUR UN DESSIN. Ces schémas portent des cotes au
 * centimètre : « téléphone à 5,00 m du mur », « plots hauts SUR l'axe ballon → centre
 * du but ». Dans une carte de la largeur d'un téléphone, un « 5,00 m » fait deux
 * millimètres de haut : on ne le lit pas, donc on installe au jugé, donc la mesure ne
 * vaut plus rien. Le dessin doit pouvoir remplir l'écran.
 *
 * 🔄 ET IL DOIT POUVOIR PIVOTER. Un plan de terrain se lit accroupi, le téléphone
 * posé, en regardant alternativement le dessin et le sol. Un quart de tour aligne le
 * dessin sur ce qu'on a devant les yeux — c'est la seule raison du bouton, et c'est
 * pour ça qu'il ne sert à rien sur une position du corps.
 *
 * ⚠️ CE QUE CET ÉCRAN NE FAIT PAS, ET POURQUOI CE N'EST PAS UN OUBLI :
 *   · LE BOUTON « COTES » (masquer les mesures écrites sur le dessin) est
 *     IMPOSSIBLE tel quel : les cotes sont du texte À L'INTÉRIEUR du SVG, mêlé au
 *     tracé. Les masquer demanderait que le serveur les envoie dans un calque
 *     séparé — c'est-à-dire redessiner les 27 schémas.
 *   · LA CARTE DES ANGLES (« 90° au départ — genou, mesuré à la box ») n'a aucune
 *     donnée derrière : les angles sont noyés dans la prose du protocole, pas
 *     dans un champ. Inventer une carte vide serait pire que ne rien montrer.
 */

/** Les paliers de grossissement, du plus petit au plus grand. */
const PALIERS = [1, 1.5, 2, 3];

/**
 * L'écran lui-même.
 * @param {object} props
 * @param {Record<string, any>} props.navigation
 * @param {Record<string, any>} [props.route]
 * @returns {React.ReactElement} le schéma en grand, avec ses commandes
 */
function TrainingSchema({ navigation, route }) {
  const { Colors, Fonts, Spaces } = useTheme();
  const { t } = useTranslation();

  const svg = route?.params?.svg;
  const titre = route?.params?.title || '';
  const legende = route?.params?.caption || '';
  const video = route?.params?.video || null;

  const [pivote, setPivote] = useState(false);
  const [palier, setPalier] = useState(0);

  const famille = useMemo(() => familleDuSchema(svg), [svg]);
  const xml = typeof svg === 'string' && svg.includes('<svg') ? svg : null;

  const agrandir = useCallback(() => {
    setPalier((n) => Math.min(PALIERS.length - 1, n + 1));
  }, []);

  return (
    <ScreenContainer bgImage="bg2" bottomInsetMode="screen">
      <View style={[Spaces.gap[12], { flex: 1 }]}>
        {/* ─── L'EN-TÊTE ────────────────────────────────────────────────────
            La famille en petit, le nom en gras, et une croix carrée à droite.
            L'écran est un cul-de-sac volontaire : on l'ouvre, on regarde, on
            ferme. Une flèche de retour ambigüe ferait hésiter. */}
        <View style={{ alignItems: 'flex-start', flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[Fonts.caption, {
              color: famille === 'field' ? Colors.primary400 : Colors.neutral400,
            }]}
            >
              {t(`training.schema.family.${famille}`)}
            </Text>
            <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>{titre}</Text>
          </View>
          <TouchableOpacity
            accessibilityLabel={t('training.schema.close')}
            accessibilityRole="button"
            onPress={() => navigation.goBack()}
            style={{
              alignItems: 'center',
              borderColor: withAlpha(Colors.primary500, 0.3),
              borderRadius: 8,
              borderWidth: 1,
              height: 44,
              justifyContent: 'center',
              width: 44,
            }}
          >
            <Text style={[Fonts.p2, { color: Colors.neutral00 }]}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* ─── LE DESSIN ────────────────────────────────────────────────────
            🎨 LE FOND RESTE BLANC, et c'est délibéré. Les 27 dessins réels ont
            un fond blanc EN DUR et leur titre écrit à l'intérieur de l'image :
            posés sur le fond sombre de l'app, ils apparaîtraient comme une dalle
            blanche mal détourée. On assume la dalle, on la cadre proprement. */}
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
          maximumZoomScale={4}
          minimumZoomScale={1}
          style={{
            backgroundColor: Colors.neutral00,
            borderRadius: 10,
            flex: 1,
          }}
        >
          {xml ? (
            <TrainingSchemaImage
              rotate={pivote ? '90deg' : '0deg'}
              scale={PALIERS[palier]}
              xml={xml}
            />
          ) : (
            <Text style={[Fonts.p3, { color: Colors.neutral900, padding: 16 }]}>
              {t('training.schema.missing')}
            </Text>
          )}
        </ScrollView>

        {Boolean(legende) && (
          <Text style={[Fonts.caption, { color: Colors.neutral300 }]}>{legende}</Text>
        )}

        {/* ─── LES COMMANDES ───────────────────────────────────────────────── */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {/* ⚠️ « Pivoter » est ÉTEINT sur une position du corps : faire tourner
              quelqu'un debout ne rend pas le dessin plus lisible, ça le rend
              faux. Un bouton qui ne sert à rien mais qu'on peut appuyer coûte
              plus cher qu'un bouton éteint. */}
          <TouchableOpacity
            accessibilityLabel={t('training.schema.rotate')}
            accessibilityRole="button"
            accessibilityState={{ disabled: famille !== 'field', selected: pivote }}
            disabled={famille !== 'field'}
            onPress={() => setPivote((v) => !v)}
            style={{
              alignItems: 'center',
              backgroundColor: pivote ? Colors.primary500 : 'transparent',
              borderColor: withAlpha(Colors.primary500, famille === 'field' ? 0.5 : 0.15),
              borderRadius: 8,
              borderWidth: 1,
              flex: 1,
              justifyContent: 'center',
              minHeight: 44,
            }}
          >
            <Text style={[Fonts.p3, {
              color: famille === 'field' ? Colors.neutral00 : Colors.neutral500,
            }]}
            >
              {t('training.schema.rotate')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityLabel={t('training.schema.zoomIn')}
            accessibilityRole="button"
            onPress={agrandir}
            style={{
              alignItems: 'center',
              borderColor: withAlpha(Colors.primary500, 0.5),
              borderRadius: 8,
              borderWidth: 1,
              flex: 1,
              justifyContent: 'center',
              minHeight: 44,
            }}
          >
            <Text style={[Fonts.p3, { color: Colors.neutral00 }]}>
              {t('training.schema.zoomIn')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityLabel={t('training.schema.reset')}
            accessibilityRole="button"
            onPress={() => { setPalier(0); setPivote(false); }}
            style={{
              alignItems: 'center',
              borderColor: withAlpha(Colors.primary500, 0.5),
              borderRadius: 8,
              borderWidth: 1,
              flex: 1,
              justifyContent: 'center',
              minHeight: 44,
            }}
          >
            <Text style={[Fonts.p3, { color: Colors.neutral00 }]}>
              {t('training.schema.reset')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Le bouton de la vidéo du geste reste VISIBLE mais éteint quand aucune
            vidéo n'est rattachée : le cacher ferait croire que ce test n'en a
            jamais, alors que d'autres en ont. */}
        <TouchableOpacity
          accessibilityLabel={t('training.schema.video')}
          accessibilityRole="button"
          accessibilityState={{ disabled: !video }}
          disabled={!video}
          onPress={() => video && Linking.openURL(video).catch(() => {})}
          style={{
            alignItems: 'center',
            borderColor: withAlpha(Colors.primary500, video ? 0.5 : 0.15),
            borderRadius: 8,
            borderWidth: 1,
            justifyContent: 'center',
            minHeight: 44,
          }}
        >
          <Text style={[Fonts.p3, { color: video ? Colors.neutral00 : Colors.neutral500 }]}>
            {t('training.schema.video')}
          </Text>
        </TouchableOpacity>

        <Text style={[Fonts.caption, { color: Colors.neutral400 }]}>
          {t(`training.schema.hint.${famille}`)}
        </Text>
      </View>
    </ScreenContainer>
  );
}

export default TrainingSchema;
