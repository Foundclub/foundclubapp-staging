import { useTranslation } from 'react-i18next';
import {
  ScrollView, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Circle, Defs, LinearGradient, Rect, Stop,
} from 'react-native-svg';

import { getTourProfile } from '@/domains/tour/tourCatalog';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import { SvgIcon } from '@/components/atoms/SvgIcon/SvgIcon';

import { navigate as navigateRoot } from '@/navigation/navigationService';

import { useTour } from '@/context/useTour';

// T3-GUIDE-SITE : sur un grand écran, une colonne lisible plutôt que toute la largeur.
const FULL_SCREEN_MAX_WIDTH = 560;

/**
 * Anneau de jauge (04_COUCHE_VISUELLE §4) : piste, arc, pourcentage au centre.
 * @param {object} props - Propriétés.
 * @param {number} props.size - Diamètre.
 * @param {number} props.value - Jauge en %.
 * @returns {import('react').ReactElement} Anneau.
 */
function GaugeRing({ size, value }) {
  const { profileKey } = useTour();
  const { gaugeLabel, gaugeLabelKey } = /** @type {any} */ (getTourProfile(profileKey || 'coach'))
    || {};
  const { Colors, Fonts } = useTheme();
  const { t } = useTranslation();
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const arcColor = value >= 100 ? Colors.success500 : Colors.primary500;
  return (
    <View style={{
      alignItems: 'center', height: size, justifyContent: 'center', width: size,
    }}
    >
      <Svg height={size} style={{ position: 'absolute' }} width={size}>
        <Circle cx={size / 2} cy={size / 2} fill={Colors.primary800} r={radius} />
        <Circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          stroke={withAlpha(Colors.neutral00, 0.1)}
          strokeWidth={stroke}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          origin={`${size / 2}, ${size / 2}`}
          r={radius}
          rotation={-90}
          stroke={arcColor}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - (Math.min(100, value) / 100))}
          strokeLinecap="round"
          strokeWidth={stroke}
        />
      </Svg>
      <Text style={[Fonts.h3Black, { color: Colors.neutral00, fontSize: Math.round(size * 0.24) }]}>
        {`${value} %`}
      </Text>
      <Text style={[Fonts.p4Bold, { color: Colors.neutral200 }]}>
        {t(gaugeLabelKey || 'tourGuide.ringLabel', String(gaugeLabel || 'Équipe prête'))}
      </Text>
    </View>
  );
}

/**
 * Ligne de mission réutilisée par l'ouverture, le palier et la clôture.
 * @param {object} props - Propriétés.
 * @param {boolean} [props.done] - Mission faite.
 * @param {string} props.label - Libellé.
 * @param {string} props.marker - Numéro ou « + ».
 * @param {string} [props.right] - Texte à droite (« +25 % », « Passé »).
 * @param {boolean} [props.bonus] - Bonus.
 * @param {string | null} [props.detail] - Ligne sous le libellé (GUIDE-FINITIONS-2 n° 20).
 * @returns {import('react').ReactElement} Ligne.
 */
function MissionRow({
  bonus, detail, done, label, marker, right,
}) {
  const { Colors, Fonts } = useTheme();
  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: done
          ? withAlpha(Colors.success500, 0.08)
          : withAlpha(Colors.neutral00, 0.04),
        borderColor: done ? withAlpha(Colors.success500, 0.35) : withAlpha(Colors.neutral00, 0.04),
        borderRadius: 14,
        borderWidth: 1,
        columnGap: 10,
        flexDirection: 'row',
        paddingHorizontal: 12,
        paddingVertical: 10,
      }}
    >
      <View
        style={{
          alignItems: 'center',
          backgroundColor: done ? Colors.success500 : withAlpha(Colors.neutral00, 0.06),
          borderRadius: 13,
          height: 26,
          justifyContent: 'center',
          width: 26,
        }}
      >
        {done ? (
          <SvgIcon color={Colors.primary900} height={12} name="check" width={12} />
        ) : (
          <Text style={[Fonts.p3Black, { color: bonus ? Colors.gold500 : Colors.primary500 }]}>
            {marker}
          </Text>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>{label}</Text>
        {detail ? <Text style={[Fonts.p3, { color: Colors.neutral200 }]}>{detail}</Text> : null}
      </View>
      {right ? (
        <Text style={[Fonts.p3Bold, { color: bonus ? Colors.gold500 : Colors.neutral400 }]}>
          {right}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Écrans plein cadre du guide : ouverture, palier, clôture.
 * @param {{ kind: 'closing' | 'milestone' | 'opening' }} props - Type d'écran.
 * @returns {import('react').ReactElement} Écran.
 */
function TourFullScreen({ kind }) {
  const { Colors, Fonts } = useTheme();
  const { t: translate } = useTranslation();
  const insets = useSafeAreaInsets();
  const {
    completeCurrentStep, created, finishGuide, flags, gauge, missions, missionStatus, pauseTour,
    profileKey,
  } = useTour();
  // Textes `tourCatalog.<profil>.*` : chaque guide a les siens (les replis sont ceux du coach).
  const guideKey = profileKey || 'coach';
  const guide = /** @type {any} */ (getTourProfile(guideKey));
  // Le repli écrit ci-dessous est celui du coach : un autre guide porte le sien, clé par clé.
  const t = (
    /** @type {string} */ key,
    /** @type {any} */ fallback,
    /** @type {any} */ values = undefined,
  ) => {
    const own = guide?.fullScreenTexts?.[key.replace(`tourCatalog.${guideKey}.`, '')];
    return /** @type {any} */ (translate)(key, own ?? fallback, values);
  };

  const essentials = missions.filter((/** @type {any} */ mission) => mission.locked);
  const bonuses = missions.filter((/** @type {any} */ mission) => !mission.locked);
  const name = flags?.firstName ? ` ${flags.firstName}` : '';
  // Missions refusées par l'écran (quota, club partenaire) : jamais « faites ».
  const blockedCount = essentials
    .filter((/** @type {any} */ mission) => missionStatus?.[mission.id] === 'blocked').length;
  // GUIDE-FINITIONS-3 R2-5 (A15, A23) : « Ton équipe est prête ! » et « Prêt·e pour
  // la séance » s'affichaient à 0 %, missions passées. Le titre dit ce qui est fait.
  const doneCount = essentials
    .filter((/** @type {any} */ mission) => missionStatus?.[mission.id] === 'done').length;
  let milestoneTitle = t(`tourCatalog.${guideKey}.palier.title`, 'Ton équipe est prête !');
  const isReady = guide?.readyNeedsAllMissions
    ? doneCount === essentials.length
    : missionStatus?.[guide?.keyMissionId] === 'done';
  if (!isReady) {
    milestoneTitle = doneCount > 0
      ? t(`tourCatalog.${guideKey}.palier.titlePartial`, 'Une partie est faite')
      : t(`tourCatalog.${guideKey}.palier.titleNone`, 'Aucune mission faite pour l’instant');
  }
  const closingTitle = doneCount === essentials.length
    ? t(`tourCatalog.${guideKey}.close.title`, 'Prêt·e pour la séance')
    : t(`tourCatalog.${guideKey}.close.titlePartial`, 'Le guide est fini');

  let content = null;
  let cta = null;
  if (kind === 'opening') {
    content = (
      <>
        <Text style={[Fonts.p3Black, {
          color: Colors.primary500,
          letterSpacing: 2,
          textTransform: 'uppercase',
        }]}
        >
          {t(`tourCatalog.${guideKey}.kicker`, 'Guide entraîneur·e')}
        </Text>
        <Text style={[Fonts.h1Black, { color: Colors.neutral00, fontSize: 27, lineHeight: 34 }]}>
          {t(`tourCatalog.${guideKey}.open.title`, 'Salut{{name}}, prêt·e pour ta première séance '
            + '?', { name, ...SANS_ECHAPPEMENT })}
        </Text>
        <View style={{ alignItems: 'center', columnGap: 16, flexDirection: 'row' }}>
          {/* FIN-GUIDE, point 1 : déjà coach d'une équipe, la mission 1 est validée d'emblée. */}
          <GaugeRing size={92} value={gauge} />
          <Text style={[Fonts.p2, { color: Colors.neutral200, flex: 1 }]}>
            {t(`tourCatalog.${guideKey}.open.gauge`, '{{count}} missions. Chacune fait monter ta '
              + 'jauge '
              + 'de 25 %.', { count: essentials.length })}
          </Text>
        </View>
        <View style={{ rowGap: 8 }}>
          {essentials.map((/** @type {any} */ mission, /** @type {number} */ index) => {
            const isDone = missionStatus?.[mission.id] === 'done';
            return (
              <MissionRow
                detail={isDone ? null : mission.openingDetail?.(flags)}
                done={isDone}
                key={mission.id}
                label={mission.title}
                marker={String(index + 1)}
                right={isDone ? undefined : '+25 %'}
              />
            );
          })}
        </View>
        <View style={{ columnGap: 8, flexDirection: 'row' }}>
          <View style={{
            backgroundColor: Colors.gold500, borderRadius: 4, height: 8, marginTop: 5, width: 8,
          }}
          />
          <Text style={[Fonts.p3, { color: Colors.neutral200, flex: 1 }]}>
            {flags?.hadClub
              ? t(
                `tourCatalog.${guideKey}.open.noteWithClub`,
                "Tout est réel : ton équipe, ton lien d'invitation, ta séance. "
                  + "Je t'accompagne à chaque étape.",
              )
              : t(
                `tourCatalog.${guideKey}.open.note`,
                "Tout est réel : ton club, ton équipe, ton lien d'invitation, ta séance. "
                  + "Je t'accompagne à chaque étape.",
              )}
          </Text>
        </View>
      </>
    );
    cta = (
      <>
        <Button
          onPress={() => completeCurrentStep()}
          title={t(`tourCatalog.${guideKey}.open.cta`, "C'est parti")}
          variant="Primary"
        />
        {/* GUIDE-RELANCE (décision d'Adel 5- A) : découvrir l'app seul ; le
            guide attend en pause (pastille de l'accueil et de Mon compte). */}
        <TouchableOpacity
          accessibilityRole="button"
          onPress={pauseTour}
          style={{ alignItems: 'center', justifyContent: 'center', minHeight: 44 }}
        >
          <Text style={[Fonts.p2Bold, { color: Colors.neutral200 }]}>
            {t(`tourCatalog.${guideKey}.open.later`, 'Plus tard')}
          </Text>
        </TouchableOpacity>
      </>
    );
  } else if (kind === 'milestone') {
    content = (
      <>
        <View style={{ alignItems: 'center' }}>
          <GaugeRing size={104} value={gauge} />
        </View>
        <Text style={[Fonts.h1Black, {
          color: Colors.neutral00,
          fontSize: 25,
          textAlign: 'center',
        }]}
        >
          {milestoneTitle}
        </Text>
        <Text style={[Fonts.p2, { color: Colors.neutral200, textAlign: 'center' }]}>
          {blockedCount > 0
            ? t(`tourCatalog.${guideKey}.palier.subtitlePartial`, '{{done}} missions sur '
              + '{{total}} : '
              + 'les autres attendent que l’app te le permette.', {
              done: essentials.length - blockedCount, total: essentials.length,
            })
            : t(
              `tourCatalog.${guideKey}.palier.subtitle`,
              '{{count}} missions sur {{count}}, l’essentiel est fait.',
              { count: essentials.length },
            )}
        </Text>
        <View style={{ rowGap: 8 }}>
          {essentials.map((/** @type {any} */ mission, /** @type {number} */ index) => (
            <MissionRow
              done={missionStatus?.[mission.id] !== 'blocked'}
              key={mission.id}
              label={mission.title}
              marker={String(index + 1)}
              right={missionStatus?.[mission.id] === 'blocked'
                ? t(`tourCatalog.${guideKey}.palier.blocked`, 'Plus tard')
                : undefined}
            />
          ))}
        </View>
        {bonuses.length > 0 ? (
          <View style={{ rowGap: 8 }}>
            <Text style={[Fonts.p3Black, {
              color: Colors.gold500,
              letterSpacing: 1,
              textTransform: 'uppercase',
            }]}
            >
              {t(`tourCatalog.${guideKey}.palier.bonus`, '{{count}} bonus · on te montre où ça se '
                + 'trouve', { count: bonuses.length })}
            </Text>
            {bonuses.map((/** @type {any} */ mission) => (
              <MissionRow
                bonus
                key={mission.id}
                label={mission.title}
                marker="+"
                right={mission.estimatedSeconds ? `~${mission.estimatedSeconds} s` : undefined}
              />
            ))}
            {/* GUIDE-FINITIONS-2 n° 29 : « Plus tard » dit où les retrouver. */}
            <Text style={[Fonts.p3, { color: Colors.neutral200 }]}>
              {t(
                `tourCatalog.${guideKey}.palier.laterHint`,
                'Plus tard ? Les bonus t’attendent dans Mon compte › Guide entraîneur·e.',
              )}
            </Text>
          </View>
        ) : null}
      </>
    );
    cta = (
      <>
        <Button
          onPress={() => completeCurrentStep()}
          title={t(`tourCatalog.${guideKey}.palier.continue`, 'Continuer')}
          variant="Primary"
        />
        {bonuses.length > 0 ? (
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => finishGuide({ later: true })}
            style={{ alignItems: 'center', justifyContent: 'center', minHeight: 44 }}
          >
            <Text style={[Fonts.p2Bold, { color: Colors.neutral200 }]}>
              {t(`tourCatalog.${guideKey}.palier.later`, 'Plus tard')}
            </Text>
          </TouchableOpacity>
        ) : null}
      </>
    );
  } else {
    const real = guide?.closingLines?.(t, { created, flags }) || [];
    content = (
      <>
        <View style={{ alignItems: 'center' }}>
          <GaugeRing size={104} value={gauge} />
        </View>
        <Text style={[Fonts.h1Black, {
          color: Colors.neutral00,
          fontSize: 26,
          textAlign: 'center',
        }]}
        >
          {closingTitle}
        </Text>
        <Text style={[Fonts.p2, { color: Colors.neutral200, textAlign: 'center' }]}>
          {t(`tourCatalog.${guideKey}.close.subtitle`, 'Bonne saison !')}
        </Text>
        <View style={{ rowGap: 8 }}>
          {real.map((/** @type {string} */ label) => (
            <View
              key={String(label)}
              style={{
                alignItems: 'center',
                columnGap: 10,
                flexDirection: 'row',
              }}
            >
              <SvgIcon color={Colors.primary500} height={14} name="check" width={14} />
              <Text style={[Fonts.p2Bold, { color: Colors.neutral00, flex: 1 }]}>{label}</Text>
              <Text style={[Fonts.p4Bold, { color: Colors.success500 }]}>
                {t(`tourCatalog.${guideKey}.close.real`, 'RÉEL')}
              </Text>
            </View>
          ))}
          {bonuses.map((/** @type {any} */ mission) => (
            <View
              key={mission.id}
              style={{
                alignItems: 'center',
                columnGap: 10,
                flexDirection: 'row',
              }}
            >
              <SvgIcon
                color={missionStatus?.[mission.id] === 'done' ? Colors.gold500 : Colors.neutral400}
                height={14}
                name={missionStatus?.[mission.id] === 'done' ? 'check' : 'close'}
                width={14}
              />
              <Text style={[Fonts.p2Bold, {
                color: Colors.neutral00,
                flex: 1,
              }]}
              >
                {mission.title}
              </Text>
              <Text style={[Fonts.p4Bold, { color: Colors.neutral400 }]}>
                {missionStatus?.[mission.id] === 'done'
                  ? t(`tourCatalog.${guideKey}.close.bonus`, 'BONUS')
                  : t(`tourCatalog.${guideKey}.close.skipped`, 'PASSÉ')}
              </Text>
            </View>
          ))}
        </View>
        {/* n° 29 : le match d'exemple de B2 n'a rien laissé. */}
        {missionStatus?.[guide?.exampleMissionId] === 'done' ? (
          <Text style={[Fonts.p3, { color: Colors.neutral200, textAlign: 'center' }]}>
            {t(
              `tourCatalog.${guideKey}.close.example`,
              'Le match d’exemple est effacé : rien n’a été envoyé.',
            )}
          </Text>
        ) : null}
        <Text style={[Fonts.p3, { color: Colors.neutral400, textAlign: 'center' }]}>
          {t(
            `tourCatalog.${guideKey}.close.footer`,
            'Retrouve ce guide dans Mon compte › Guide entraîneur·e.',
          )}
        </Text>
      </>
    );
    const offerRoute = guide?.closingOfferRoute?.(flags);
    cta = (
      <>
        <Button
          onPress={() => finishGuide()}
          title={t(`tourCatalog.${guideKey}.close.cta`, "Aller à l'accueil")}
          variant="Primary"
        />
        {offerRoute ? (
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => {
              finishGuide();
              navigateRoot(offerRoute);
            }}
            style={{ alignItems: 'center', justifyContent: 'center', minHeight: 44 }}
          >
            <Text style={[Fonts.p2Bold, { color: Colors.neutral200 }]}>
              {t(`tourCatalog.${guideKey}.close.offer`, 'Voir l’offre')}
            </Text>
          </TouchableOpacity>
        ) : null}
      </>
    );
  }

  return (
    <View style={{
      bottom: 0, left: 0, position: 'absolute', right: 0, top: 0,
    }}
    >
      <Svg height="100%" style={{ position: 'absolute' }} width="100%">
        <Defs>
          <LinearGradient id="tourFullScreen" x1="0" x2="0" y1="0" y2="1">
            <Stop offset="0" stopColor={Colors.primary900} stopOpacity={0.95} />
            <Stop offset="1" stopColor={Colors.primary800} stopOpacity={0.98} />
          </LinearGradient>
        </Defs>
        <Rect fill="url(#tourFullScreen)" height="100%" width="100%" x={0} y={0} />
      </Svg>
      <ScrollView
        contentContainerStyle={{
          alignSelf: 'center',
          maxWidth: FULL_SCREEN_MAX_WIDTH,
          paddingBottom: 16,
          paddingHorizontal: 22,
          paddingTop: Math.max(64, insets.top + 24),
          rowGap: 18,
          width: '100%',
        }}
      >
        {content}
      </ScrollView>
      <View style={{
        alignSelf: 'center',
        maxWidth: FULL_SCREEN_MAX_WIDTH,
        paddingBottom: Math.max(40, insets.bottom + 16),
        paddingHorizontal: 22,
        rowGap: 8,
        width: '100%',
      }}
      >
        {cta}
      </View>
    </View>
  );
}

export default TourFullScreen;
