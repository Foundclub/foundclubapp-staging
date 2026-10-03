import { useTranslation } from 'react-i18next';
import {
  Image, Text, TouchableOpacity, View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import { SvgIcon } from '@/components/atoms/SvgIcon/SvgIcon';
import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';

/**
 * 🆚 ST-MATCH (écran 1, design des statistiques validé le 02/10) — LE FACE-À-FACE DU MATCH.
 *
 * Sorti tel quel de `EventHeader.js` par ST-VUES3-ORDI (03/10) : le SITE
 * (`EventDetails.web.js`, planche P3-match-ordi) affiche le même encart que le téléphone,
 * avec les mêmes 7 états, les buteurs et l'auteur. ⛔ L'ÉCRAN fournit les lignes DÉJÀ
 * FILTRÉES selon le lecteur (`buildMatchHeaderScoreSummary`) : un visiteur ne les reçoit
 * pas, l'encart n'a donc rien à oublier de cacher (mineurs en U15).
 * @param {object} props - Les propriétés du composant.
 * @param {any} props.matchScoreSummary - Ce que l'encart dit, pour ce lecteur.
 * @param {any} [props.eventClub] - Le club de l'équipe (son écusson).
 * @param {string} [props.logoUrl] - Le logo du club.
 * @param {string} [props.clubName] - Le nom du club (le camp de gauche).
 * @param {string} [props.facilityName] - Le lieu, en pastille (téléphone).
 * @param {string} [props.accentColor] - La couleur du lieu.
 * @returns {import('react').ReactElement} L'encart.
 */
function MatchScoreEncart({
  accentColor = '',
  clubName = '',
  eventClub = null,
  facilityName = '',
  logoUrl = undefined,
  matchScoreSummary,
}) {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images, Spaces,
  } = useTheme();
  const { t } = useTranslation();

  // 🏁 N3 (D5) — l'écran fournit la DONNÉE (`opponentName`) ; l'encart, la MISE EN FORME.
  const opponentDisplayName = String(matchScoreSummary?.opponentName || '').trim();
  // ST-MATCH (écran 1, état 6) — l'attente du score officiel se dit en ORANGE, plus en or
  // (l'or est réservé à la League) ; les autres attentes, en gris.
  const statusLineColor = matchScoreSummary?.statusLine?.tone === 'warning'
    ? Colors.warning400
    : Colors.neutral300;

  return (
    <View style={[Alignments.fullWidth, Spaces.gap[16]]} testID="event-header-match-encart">
      <View
        style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}
        testID="event-header-face-a-face"
      >
        <View
          style={[Alignments.fill, Alignments.alignCenter, Spaces.gap[8]]}
          testID="event-header-camp-club"
        >
          <ClubLogoMark club={eventClub} logoUrl={logoUrl} name={clubName} size={44} />
          <Text numberOfLines={2} style={[Fonts.p2Bold, Fonts.neutral00, Fonts.textCenter]}>
            {clubName}
          </Text>
        </View>

        <View style={[Alignments.alignCenter, { minWidth: 88 }]} testID="event-header-score">
          <Text
            style={[
              matchScoreSummary.isScoreShown ? Fonts.h1Black : Fonts.h3Black,
              matchScoreSummary.isScoreShown ? Fonts.neutral00 : Fonts.neutral300,
            ]}
          >
            {matchScoreSummary.value}
          </Text>
          {matchScoreSummary.centerLabel ? (
            <Text style={[Fonts.p4Bold, Fonts.neutral300, Fonts.uppercase]}>
              {matchScoreSummary.centerLabel}
            </Text>
          ) : null}
        </View>

        {/* D9/D10 — la PRESENCE du rappel porte le droit. Un lecteur qui n'organise
            pas ne recoit pas `onNameOpponent` : aucun bouton n'est monte. Le camp
            « Nommer l'adversaire » prend la MEME emprise que l'autre camp (05C). */}
        {matchScoreSummary.onNameOpponent ? (
          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.8}
            onPress={matchScoreSummary.onNameOpponent}
            style={[
              ApplicationStyle.borderRadius16,
              Alignments.fill,
              Alignments.alignCenter,
              Alignments.justifyCenter,
              Spaces.gap[4],
              Spaces.paddingVertical[8],
              {
                borderColor: Colors.primary500,
                borderStyle: 'dashed',
                borderWidth: 1,
                minHeight: 92,
              },
            ]}
            testID="event-header-nommer-adversaire"
          >
            <Image
              source={Images.plus}
              style={[ApplicationStyle.icon20, ApplicationStyle.tintColor.primary500]}
            />
            <Text style={[Fonts.p3Bold, Fonts.primary500, Fonts.textCenter]}>
              {t('eventDetails.matchCard.nameOpponent', 'Nommer l\'adversaire')}
            </Text>
          </TouchableOpacity>
        ) : (
          <View
            style={[
              Alignments.fill,
              Alignments.alignCenter,
              Spaces.gap[8],
              // D10 — le POINTILLE dit « il manque quelque chose », sans un mot de plus.
              matchScoreSummary.awaitingOpponent
                ? [ApplicationStyle.borderRadius16, Spaces.paddingVertical[8], {
                  borderColor: withAlpha(Colors.neutral00, 0.24),
                  borderStyle: 'dashed',
                  borderWidth: 1,
                }]
                : null,
            ]}
            testID="event-header-camp-adversaire"
          >
            {opponentDisplayName ? (
              <ClubLogoMark name={opponentDisplayName} size={44} />
            ) : null}
            <Text
              numberOfLines={2}
              style={[
                Fonts.p2Bold,
                opponentDisplayName ? Fonts.neutral00 : Fonts.neutral300,
                Fonts.textCenter,
              ]}
            >
              {opponentDisplayName
                || t('eventDetails.matchCard.opponentToConfirm', 'Adversaire à confirmer')}
            </Text>
          </View>
        )}
      </View>

      {matchScoreSummary.onEnterScore ? (
        <Button
          onPress={matchScoreSummary.onEnterScore}
          title={t('stMatch.encart.enterScore', 'Saisir le score')}
          variant="Primary"
        />
      ) : null}

      {matchScoreSummary.statusLine ? (
        <View style={[Alignments.row, Alignments.justifyCenter, Spaces.gap[8]]}>
          <SvgIcon
            color={statusLineColor}
            height={14}
            name="clock-two-thirty"
            style={/** @type {any} */ (Spaces.marginTop[4])}
            width={14}
          />
          <Text
            style={[Fonts.p3, Fonts.textCenter, { color: statusLineColor, flexShrink: 1 }]}
            testID="event-header-match-attente"
          >
            {matchScoreSummary.statusLine.text}
          </Text>
        </View>
      ) : null}

      {matchScoreSummary.authorLine ? (
        <Text
          style={[Fonts.p3, Fonts.neutral300, Fonts.textCenter]}
          testID="event-header-match-auteur"
        >
          {matchScoreSummary.authorLine}
        </Text>
      ) : null}

      {matchScoreSummary.scorersLine ? (
        <View style={[Alignments.row, Alignments.justifyCenter, Spaces.gap[4]]}>
          <SvgIcon
            color={Colors.neutral300}
            height={14}
            name="soccer-ball"
            style={/** @type {any} */ (Spaces.marginTop[4])}
            width={14}
          />
          <Text
            style={[Fonts.p3, Fonts.neutral200, Fonts.textCenter, { flexShrink: 1 }]}
            testID="event-header-match-buteurs"
          >
            {matchScoreSummary.scorersLine}
          </Text>
        </View>
      ) : null}

      {matchScoreSummary.onSeeStats ? (
        <TouchableOpacity
          accessibilityRole="link"
          activeOpacity={0.8}
          onPress={matchScoreSummary.onSeeStats}
          style={[
            Alignments.row,
            Alignments.alignCenter,
            Alignments.selfCenter,
            Spaces.gap[8],
            { minHeight: 44 },
          ]}
          testID="event-header-voir-les-stats"
        >
          <Text style={[Fonts.p2Bold, Fonts.primary500]}>
            {t('stMatch.encart.seeMatchStats', 'Voir les stats du match')}
          </Text>
          <SvgIcon color={Colors.primary500} height={12} name="arrow-right" width={12} />
        </TouchableOpacity>
      ) : null}

      {facilityName ? (
        <View
          style={[
            ApplicationStyle.borderRadius100,
            Alignments.selfCenter,
            Spaces.paddingHorizontal[8],
            Spaces.paddingVertical[4],
            { backgroundColor: withAlpha(accentColor, 0.14) },
          ]}
        >
          <Text style={[Fonts.p4, Fonts.neutral00]}>
            {facilityName}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export default MatchScoreEncart;
