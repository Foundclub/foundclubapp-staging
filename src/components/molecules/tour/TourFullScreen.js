import { useTranslation } from 'react-i18next';
import {
  ScrollView, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Circle, Defs, LinearGradient, Rect, Stop,
} from 'react-native-svg';

import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import { SvgIcon } from '@/components/atoms/SvgIcon/SvgIcon';

import { useTour } from '@/context/useTour';

/**
 * Anneau de jauge (04_COUCHE_VISUELLE §4) : piste, arc, pourcentage au centre.
 * @param {object} props - Propriétés.
 * @param {number} props.size - Diamètre.
 * @param {number} props.value - Jauge en %.
 * @returns {import('react').ReactElement} Anneau.
 */
function GaugeRing({ size, value }) {
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
        {t('tourGuide.ringLabel', 'Équipe prête')}
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
 * @returns {import('react').ReactElement} Ligne.
 */
function MissionRow({
  bonus, done, label, marker, right,
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
      <Text style={[Fonts.p2Bold, { color: Colors.neutral00, flex: 1 }]}>{label}</Text>
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
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const {
    completeCurrentStep, created, finishGuide, flags, gauge, missions, missionStatus,
  } = useTour();

  const essentials = missions.filter((/** @type {any} */ mission) => mission.locked);
  const bonuses = missions.filter((/** @type {any} */ mission) => !mission.locked);
  const name = flags?.firstName ? ` ${flags.firstName}` : '';

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
          {t('tourCatalog.coach.kicker', 'Guide entraîneur·e')}
        </Text>
        <Text style={[Fonts.h1Black, { color: Colors.neutral00, fontSize: 27, lineHeight: 34 }]}>
          {t('tourCatalog.coach.open.title', 'Salut{{name}}, prêt·e pour ta première séance '
            + '?', { name, ...SANS_ECHAPPEMENT })}
        </Text>
        <View style={{ alignItems: 'center', columnGap: 16, flexDirection: 'row' }}>
          <GaugeRing size={92} value={0} />
          <Text style={[Fonts.p2, { color: Colors.neutral200, flex: 1 }]}>
            {t('tourCatalog.coach.open.gauge', '{{count}} missions. Chacune fait monter ta jauge '
              + 'de 25 %.', { count: essentials.length })}
          </Text>
        </View>
        <View style={{ rowGap: 8 }}>
          {essentials.map((/** @type {any} */ mission, index) => (
            <MissionRow
              key={mission.id}
              label={mission.title}
              marker={String(index + 1)}
              right="+25 %"
            />
          ))}
        </View>
        <View style={{ columnGap: 8, flexDirection: 'row' }}>
          <View style={{
            backgroundColor: Colors.gold500, borderRadius: 4, height: 8, marginTop: 5, width: 8,
          }}
          />
          <Text style={[Fonts.p3, { color: Colors.neutral200, flex: 1 }]}>
            {flags?.hadClub
              ? t(
                'tourCatalog.coach.open.noteWithClub',
                "Tout est réel : ton équipe, ton lien d'invitation, ta séance. "
                  + "Je t'accompagne à chaque étape.",
              )
              : t(
                'tourCatalog.coach.open.note',
                "Tout est réel : ton club, ton équipe, ton lien d'invitation, ta séance. "
                  + "Je t'accompagne à chaque étape.",
              )}
          </Text>
        </View>
      </>
    );
    cta = (
      <Button
        onPress={() => completeCurrentStep()}
        title={t('tourCatalog.coach.open.cta', "C'est parti")}
        variant="Primary"
      />
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
          {t('tourCatalog.coach.palier.title', 'Ton équipe est prête !')}
        </Text>
        <Text style={[Fonts.p2, { color: Colors.neutral200, textAlign: 'center' }]}>
          {t('tourCatalog.coach.palier.subtitle', '{{count}} missions sur {{count}}, l’essentiel '
            + 'est fait.', { count: essentials.length })}
        </Text>
        <View style={{ rowGap: 8 }}>
          {essentials.map((/** @type {any} */ mission, index) => (
            <MissionRow done key={mission.id} label={mission.title} marker={String(index + 1)} />
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
              {t('tourCatalog.coach.palier.bonus', '{{count}} bonus · on te montre où ça se '
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
          </View>
        ) : null}
      </>
    );
    cta = (
      <>
        <Button
          onPress={() => completeCurrentStep()}
          title={t('tourCatalog.coach.palier.continue', 'Continuer')}
          variant="Primary"
        />
        {bonuses.length > 0 ? (
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => finishGuide({ later: true })}
            style={{ alignItems: 'center', justifyContent: 'center', minHeight: 44 }}
          >
            <Text style={[Fonts.p2Bold, { color: Colors.neutral200 }]}>
              {t('tourCatalog.coach.palier.later', 'Plus tard')}
            </Text>
          </TouchableOpacity>
        ) : null}
      </>
    );
  } else {
    const real = [
      created?.['club.joined']
        ? t('tourCatalog.coach.close.club', '{{club}} rejoint', {
          club: created['club.joined'].clubName
            || t('tourCatalog.coach.close.yourClub', 'Ton club'),
          ...SANS_ECHAPPEMENT,
        })
        : null,
      created?.['team.created']
        ? t('tourCatalog.coach.close.team', '{{team}} créée', {
          team: created['team.created'].teamName
            || t('tourCatalog.coach.close.yourTeam', 'Ton équipe'),
          ...SANS_ECHAPPEMENT,
        })
        : null,
      created?.['team.invite.shared']
        ? t('tourCatalog.coach.close.link', "Lien d'invitation partagé")
        : null,
      created?.['event.created']
        ? t('tourCatalog.coach.close.sessions', '{{count}} séance(s) '
          + 'programmée(s)', { count: Number(created['event.created'].occurrences) || 1 })
        : null,
      created?.['friendlyMatch.ad.published']
        ? t('tourCatalog.coach.close.friendly', 'Annonce de match amical publiée')
        : null,
    ].filter(Boolean);
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
          {t('tourCatalog.coach.close.title', 'Prêt·e pour la séance')}
        </Text>
        <Text style={[Fonts.p2, { color: Colors.neutral200, textAlign: 'center' }]}>
          {t('tourCatalog.coach.close.subtitle', 'Bonne saison !')}
        </Text>
        <View style={{ rowGap: 8 }}>
          {real.map((label) => (
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
                {t('tourCatalog.coach.close.real', 'RÉEL')}
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
                  ? t('tourCatalog.coach.close.bonus', 'BONUS')
                  : t('tourCatalog.coach.close.skipped', 'PASSÉ')}
              </Text>
            </View>
          ))}
        </View>
        <Text style={[Fonts.p3, { color: Colors.neutral400, textAlign: 'center' }]}>
          {t('tourCatalog.coach.close.footer', 'Retrouve ce guide dans Mon compte.')}
        </Text>
      </>
    );
    cta = (
      <Button
        onPress={() => finishGuide()}
        title={t('tourCatalog.coach.close.cta', "Aller à l'accueil")}
        variant="Primary"
      />
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
          paddingBottom: 16,
          paddingHorizontal: 22,
          paddingTop: Math.max(64, insets.top + 24),
          rowGap: 18,
        }}
      >
        {content}
      </ScrollView>
      <View style={{
        paddingBottom: Math.max(40, insets.bottom + 16),
        paddingHorizontal: 22,
        rowGap: 8,
      }}
      >
        {cta}
      </View>
    </View>
  );
}

export default TourFullScreen;
