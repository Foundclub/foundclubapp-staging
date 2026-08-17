import dayjs from 'dayjs';
import { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import 'dayjs/locale/fr';

import useTheme from '@/theme/themeContext';

import { getProposalLocationLabel } from '@/views/league/match/utils/proposalPayload';

const resolveAddressLabel = (address) => {
  if (!address) return '';
  if (typeof address === 'string') return address;
  if (typeof address === 'object') {
    return getProposalLocationLabel(address);
  }
  return '';
};

const STATUS_CONFIG = {
  accepted: {
    bg: 'rgba(76, 175, 80, 0.18)',
    border: 'rgba(76, 175, 80, 0.45)',
    colorToken: 'success500',
    label: 'Accepte',
  },
  declined: {
    bg: 'rgba(244, 67, 54, 0.18)',
    border: 'rgba(244, 67, 54, 0.45)',
    colorToken: 'error500',
    label: 'Refuse',
  },
  pending: {
    bg: 'rgba(212, 175, 55, 0.18)',
    border: 'rgba(212, 175, 55, 0.45)',
    colorToken: 'gold500',
    label: 'En attente',
  },
};

const getProposalMeta = ({ isMe, status }) => {
  if (status === 'accepted') {
    return {
      badgeLabel: 'Acceptee',
      title: isMe ? 'Ta proposition' : 'Proposition adverse',
    };
  }
  if (status === 'declined') {
    return {
      badgeLabel: 'Refusee',
      title: isMe ? 'Ta proposition' : 'Proposition adverse',
    };
  }
  if (isMe) {
    return {
      badgeLabel: 'En attente de réponse',
      title: 'Ta proposition',
    };
  }
  return {
    badgeLabel: 'En attente de ta réponse',
    title: 'Proposition adverse',
  };
};

const styles = StyleSheet.create({
  addressDot: {
    backgroundColor: '#ff4d4f',
    borderRadius: 3.5,
    height: 7,
    width: 7,
  },
  addressRow: {
    alignItems: 'center',
    backgroundColor: 'rgba(1, 179, 244, 0.1)',
    borderColor: 'rgba(1, 179, 244, 0.28)',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    width: '100%',
  },
  button: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  container: {
    borderRadius: 18,
    borderWidth: 1,
    marginVertical: 8,
    maxWidth: '90%',
    minWidth: 260,
    overflow: 'hidden',
    width: '100%',
  },
  content: {
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  fieldLabel: {
    minWidth: 48,
    paddingTop: 1,
  },
  fieldRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    width: '100%',
  },
  fieldValue: {
    flex: 1,
    marginLeft: 10,
  },
  footer: {
    alignItems: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 18,
    paddingVertical: 14,
    width: '100%',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    width: '100%',
  },
  headerTitle: {
    flex: 1,
    marginRight: 10,
  },
  separator: {
    alignSelf: 'stretch',
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  statusBadge: {
    borderRadius: 999,
    borderWidth: 1,
    flexShrink: 0,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
});

/**
 * La charge d'une bulle de proposition, telle que le serveur la pose.
 *
 * Les champs du haut sont ceux de LEAGUE ; ceux du bas ont été ajoutés par le
 * lot S03 pour le match amical, et restent absents ailleurs — d'où le `?`.
 * Les nommer ici est ce qui permet de les lire sans que le contrôle de types
 * proteste : `{object}` refusait TOUTE clé, y compris les cinq d'origine.
 * @typedef {{
 *   address?: any,
 *   addressObject?: any,
 *   date?: string,
 *   endDate?: string,
 *   status?: string,
 *   venue?: any,
 *   categoryLabel?: string,
 *   dateLabel?: string,
 *   hostTeamName?: string,
 *   levelLabel?: string,
 *   sectionLabel?: string,
 *   timeLabel?: string,
 * }} ProposalBubblePayload
 */

/**
 * Bubble to display a Match Proposal in chat.
 * @param {object} props
 * @param {ProposalBubblePayload} props.proposal
 * @param {boolean} [props.isHighlighted]
 * @param {boolean} [props.isMe]
 * @param {boolean} [props.allowResponseActions]
 * @param {Function} [props.onAccept]
 * @param {Function} [props.onCounter]
 * @param {Function} [props.onDecline]
 * @param {Function} [props.onViewMatch]
 * @param {string} [props.viewMatchLabel]
 * @returns {import('react').ReactElement | null}
 */
function ProposalMessageBubble({
  allowResponseActions = true,
  isHighlighted = false,
  isMe = false,
  onAccept,
  onCounter,
  onDecline,
  onViewMatch,
  proposal,
  viewMatchLabel = 'Voir la fiche match',
}) {
  const { Colors, Fonts } = useTheme();
  const [loading, setLoading] = useState(false);

  if (!proposal) return null;

  const {
    address,
    categoryLabel,
    date,
    dateLabel,
    endDate,
    hostTeamName,
    levelLabel,
    sectionLabel,
    status = 'pending',
    timeLabel,
    venue = 'Lieu à définir',
  } = proposal;

  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const statusColor = Colors[statusConfig.colorToken] || Colors.gold500;
  const proposalMeta = getProposalMeta({ isMe, status });
  const venueLabel = getProposalLocationLabel(venue) || 'Lieu à définir';
  const addressLabel = resolveAddressLabel(address) || getProposalLocationLabel(proposal?.addressObject);

  // S03 — quand le serveur envoie DÉJÀ la phrase (proposition de match amical),
  // c'est elle qui parle. Sinon on retombe sur le calcul d'origine, celui de
  // LEAGUE, qui reste inchangé.
  //
  // ⚠️ Ce n'est pas cosmétique : une proposition d'amical peut n'avoir AUCUNE
  // heure (le créneau est facultatif, §4.1). Le calcul de LEAGUE afficherait
  // alors « 00:00 -> --:-- », une heure qui n'existe pas. Le serveur, lui, dit
  // « horaire à convenir » — ce qui est la vérité.
  const formattedDate = dateLabel
    || (date ? dayjs(date).locale('fr').format('dddd D MMMM') : 'Date à définir');
  const formattedStartTime = date ? dayjs(date).format('HH:mm') : '--:--';
  const formattedEndTime = endDate ? dayjs(endDate).format('HH:mm') : '--:--';
  const timeRange = timeLabel || `${formattedStartTime} -> ${formattedEndTime}`;
  // Les lignes que seule une proposition d'amical porte. Absentes ailleurs :
  // rien ne s'affiche, et LEAGUE ne bouge pas d'un pixel.
  const extraRows = [
    // ⚠️ On nomme l'équipe qui reçoit, jamais « vous » : la bulle est lue par
    // les DEUX camps, et « chez vous » désignerait quelqu'un d'autre selon qui
    // regarde.
    { label: 'Qui reçoit', value: hostTeamName },
    { label: 'Niveau', value: levelLabel },
    { label: 'Catégorie', value: categoryLabel },
    { label: 'Section', value: sectionLabel },
  ].filter((row) => Boolean(row.value));
  // « Catégorie » est plus large que « Date » : sans une gouttière commune, les
  // valeurs partent en escalier. Appliquée SEULEMENT quand les lignes en plus
  // existent — une proposition LEAGUE garde exactement sa mise en page.
  const labelStyle = extraRows.length > 0 ? { minWidth: 76 } : null;

  const handleAction = async (actionFn) => {
    if (!actionFn || loading) return;
    setLoading(true);
    try {
      await actionFn();
    } finally {
      setLoading(false);
    }
  };

  const openMaps = () => {
    const addressToOpen = addressLabel || venueLabel;
    if (!addressToOpen) return;

    const encodedAddress = encodeURIComponent(addressToOpen);
    const nativeUrl = Platform.select({
      android: `geo:0,0?q=${encodedAddress}`,
      default: `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`,
      ios: `maps:0,0?q=${encodedAddress}`,
    });

    Linking.canOpenURL(nativeUrl)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(nativeUrl);
        }
        return Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`);
      })
      .catch(() => {
        Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`);
      });
  };

  return (
    <View
      style={[
        styles.container,
        {
          alignSelf: isMe ? 'flex-end' : 'flex-start',
          backgroundColor: 'rgba(20, 39, 52, 0.92)',
          borderColor: isHighlighted ? Colors.primary500 : 'rgba(212, 175, 55, 0.9)',
          shadowColor: isHighlighted ? Colors.primary500 : '#000',
          shadowOffset: { height: 10, width: 0 },
          shadowOpacity: isHighlighted ? 0.18 : 0,
          shadowRadius: 16,
        },
      ]}
    >
      <View style={styles.header}>
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.86}
          numberOfLines={1}
          style={[Fonts.p2Bold, styles.headerTitle, { color: Colors.neutral00 }]}
        >
          {proposalMeta.title}
        </Text>
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: 8 }}>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: statusConfig.bg,
                borderColor: statusConfig.border,
              },
            ]}
          >
            <Text style={[Fonts.p4Bold, { color: statusColor }]}>{proposalMeta.badgeLabel}</Text>
          </View>
        </View>
      </View>
      <View style={[styles.separator, { backgroundColor: Colors.neutral700 }]} />

      <View style={styles.content}>
        <View style={styles.fieldRow}>
          <Text style={[Fonts.p3, styles.fieldLabel, labelStyle, { color: Colors.neutral300 }]}>
            Date
          </Text>
          <Text style={[Fonts.p2Bold, styles.fieldValue, { color: Colors.neutral00 }]}>
            {formattedDate}
          </Text>
        </View>

        <View style={styles.fieldRow}>
          <Text style={[Fonts.p3, styles.fieldLabel, labelStyle, { color: Colors.neutral300 }]}>
            Heure
          </Text>
          <Text style={[Fonts.p2Bold, styles.fieldValue, { color: Colors.primary500 }]}>
            {timeRange}
          </Text>
        </View>

        <View style={styles.fieldRow}>
          <Text style={[Fonts.p3, styles.fieldLabel, labelStyle, { color: Colors.neutral300 }]}>
            Lieu
          </Text>
          <Text
            numberOfLines={2}
            style={[Fonts.p2Bold, styles.fieldValue, { color: Colors.neutral00 }]}
          >
            {venueLabel}
          </Text>
        </View>

        {extraRows.map((row) => (
          <View key={row.label} style={styles.fieldRow}>
            <Text style={[Fonts.p3, styles.fieldLabel, labelStyle, { color: Colors.neutral300 }]}>
              {row.label}
            </Text>
            <Text style={[Fonts.p2Bold, styles.fieldValue, { color: Colors.neutral00 }]}>
              {row.value}
            </Text>
          </View>
        ))}

        {addressLabel ? (
          <TouchableOpacity activeOpacity={0.85} onPress={openMaps} style={styles.addressRow}>
            <View style={styles.addressDot} />
            <Text
              numberOfLines={2}
              style={[Fonts.p2, {
                color: Colors.neutral100,
                flex: 1,
                marginLeft: 8,
              }]}
            >
              {addressLabel}
            </Text>
            <Text style={[Fonts.p4Bold, { color: Colors.primary500, marginLeft: 10 }]}>Voir le lieu</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {status === 'pending' && !allowResponseActions ? (
        <>
          <View style={[styles.separator, { backgroundColor: Colors.neutral700 }]} />
          <View style={styles.footer}>
            {loading ? (
              <ActivityIndicator color={Colors.primary500} />
            ) : (
              <TouchableOpacity
                onPress={() => handleAction(onViewMatch)}
                style={[
                  styles.button,
                  {
                    backgroundColor: 'rgba(1, 179, 244, 0.12)',
                    borderColor: Colors.primary500,
                  },
                ]}
              >
                <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>{viewMatchLabel}</Text>
              </TouchableOpacity>
            )}
          </View>
        </>
      ) : null}

      {status === 'pending' && allowResponseActions && !isMe ? (
        <>
          <View style={[styles.separator, { backgroundColor: Colors.neutral700 }]} />
          <View style={styles.footer}>
            {loading ? (
              <ActivityIndicator color={Colors.primary500} />
            ) : (
              <View style={{ alignSelf: 'stretch', gap: 10 }}>
                <View style={{ alignSelf: 'stretch', flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    onPress={() => handleAction(onAccept)}
                    style={[
                      styles.button,
                      {
                        backgroundColor: 'rgba(76, 175, 80, 0.15)',
                        borderColor: Colors.success500,
                      },
                    ]}
                  >
                    <Text style={[Fonts.p3Bold, { color: Colors.success500 }]}>Accepter</Text>
                  </TouchableOpacity>
                  {onCounter ? (
                    <TouchableOpacity
                      onPress={() => handleAction(onCounter)}
                      style={[
                        styles.button,
                        {
                          backgroundColor: 'rgba(1, 179, 244, 0.12)',
                          borderColor: Colors.primary500,
                        },
                      ]}
                    >
                      <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>Contre-proposer</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                <TouchableOpacity
                  onPress={() => handleAction(onDecline)}
                  style={[
                    styles.button,
                    {
                      backgroundColor: 'rgba(244, 67, 54, 0.08)',
                      borderColor: Colors.error500,
                      flex: undefined,
                    },
                  ]}
                >
                  <Text style={[Fonts.p3Bold, { color: Colors.error500 }]}>Refuser</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </>
      ) : null}

      {status === 'pending' && allowResponseActions && isMe ? (
        <>
          <View style={[styles.separator, { backgroundColor: Colors.neutral700 }]} />
          <View style={styles.footer}>
            <View style={{ gap: 10 }}>
              <Text style={[Fonts.p4, { color: Colors.neutral300, fontStyle: 'italic' }]}>
                En attente de la réponse adverse
              </Text>
              {onCounter ? (
                <TouchableOpacity
                  onPress={() => handleAction(onCounter)}
                  style={[
                    styles.button,
                    {
                      backgroundColor: 'rgba(1, 179, 244, 0.12)',
                      borderColor: Colors.primary500,
                    },
                  ]}
                >
                  <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>Contre-proposer</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </>
      ) : null}
    </View>
  );
}

export default ProposalMessageBubble;
