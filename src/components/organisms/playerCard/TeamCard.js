// @ts-nocheck
/**
 * TeamCard — variante EQUIPE (Strategie 9). Destination repo :
 * app/src/components/organisms/playerCard/TeamCard.js
 *
 * Zone visuelle = grille de "dos floques" (jamais de visages, defaut mineurs).
 * Bloc "RECRUTE · SÉANCES D'ESSAI" liste les postes des detections liees
 * (recruitment-ad). Consomme le modele de domains/playerCard/teamCardModel.
 */
import { forwardRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import BackJerseyFallback from './BackJerseyFallback';
import { CARD_FORMATS, RARITY_THEME } from './PlayerCard';

const FIELD_DASH = '—';
const CARD_BASE_WIDTH = 360;

/**
 * @param {object} props
 * @param {object} props.model modele buildTeamCardModel()
 * @param {'square'|'story'} [props.format]
 * @param {number} [props.scale]
 * @param {object} [props.labels] libelles i18n injectes
 */
const TeamCard = forwardRef(({
  format = 'square', labels = {}, model, scale = 1,
}, ref) => {
  const fmt = CARD_FORMATS[format] || CARD_FORMATS.square;
  const rarity = RARITY_THEME[model?.rarity] || RARITY_THEME.common;
  const width = CARD_BASE_WIDTH * scale;
  const backs = Array.isArray(model?.backs) ? model.backs : [];
  const backSize = (width - 28 - 16) / 3; // 3 colonnes, gap 8

  const infoRows = [
    { label: labels.sport || 'Sport', value: model?.sport || FIELD_DASH },
    { label: labels.roster || 'Effectif', value: model?.rosterCount != null ? String(model.rosterCount) : FIELD_DASH },
    { label: labels.city || 'Ville', value: model?.city || FIELD_DASH },
  ];

  return (
    <View
      collapsable={false}
      ref={ref}
      style={[
        styles.card,
        {
          aspectRatio: fmt.width / fmt.height,
          borderColor: rarity.accent,
          shadowColor: rarity.accent,
          width,
        },
      ]}
    >
      <View pointerEvents="none" style={styles.foil} />

      <View style={styles.topRow}>
        <View style={[styles.crest, { borderColor: rarity.accent }]}>
          <Text style={[styles.crestText, { color: rarity.accent }]}>
            {(model?.teamName || 'FC').slice(0, 2)}
          </Text>
        </View>
        <View style={[styles.rarityChip, { backgroundColor: rarity.glow, borderColor: rarity.accent }]}>
          <Text style={[styles.rarityText, { color: rarity.accent }]}>
            {labels.teamChip || 'ÉQUIPE'}
          </Text>
        </View>
      </View>

      {/* Grille de dos floques */}
      <View style={styles.backsGrid}>
        {backs.length ? backs.map((b) => (
          <View key={`${b.name}-${b.number}`} style={{ height: backSize, marginBottom: 8, width: backSize }}>
            <BackJerseyFallback
              accent={rarity.accent}
              compact
              name={b.name}
              number={b.number}
              size={backSize}
            />
          </View>
        )) : (
          <Text style={styles.historyMeta}>{labels.rosterEmpty || 'Effectif à compléter'}</Text>
        )}
      </View>

      {/* Identite equipe */}
      <Text numberOfLines={1} style={styles.name}>{model?.teamName || FIELD_DASH}</Text>
      <Text
        numberOfLines={1}
        style={[styles.club, { color: model?.hasClub ? '#e9f7ff' : rarity.accent }]}
      >
        {model?.hasClub ? model.clubName : (labels.noClub || 'SANS CLUB')}
      </Text>

      <View style={styles.infoGrid}>
        {infoRows.map((row) => (
          <View key={row.label} style={styles.infoCell}>
            <Text style={styles.infoLabel}>{row.label}</Text>
            <Text numberOfLines={1} style={styles.infoValue}>{row.value}</Text>
          </View>
        ))}
      </View>

      {/* Bloc RECRUTE (detections / seances d'essai) */}
      {model?.isRecruiting ? (
        <View style={styles.recruitBlock}>
          <Text style={[styles.recruitTitle, { color: rarity.accent }]}>
            {labels.recruitTitle || 'RECRUTE · SÉANCES D\'ESSAI'}
          </Text>
          <View style={styles.recruitRow}>
            {(model.recruitingNeeds || []).slice(0, 4).map((need) => (
              <View key={`${need.audienceType}-${need.label}`} style={[styles.recruitChip, { borderColor: `${rarity.accent}66` }]}>
                <Text style={styles.recruitChipText}>
                  {need.quantity > 1 ? `${need.quantity}× ` : ''}
                  {need.label}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.footer}>
        <View style={styles.qrBox}>
          {model?.qrUrl ? (
            <QRCode backgroundColor="#ffffff" color="#0c2733" size={48 * scale} value={model.qrUrl} />
          ) : (
            <Text style={styles.qrPlaceholder}>QR</Text>
          )}
        </View>
        <Text style={styles.brand}>FoundClub</Text>
      </View>
    </View>
  );
});

TeamCard.displayName = 'TeamCard';

const styles = StyleSheet.create({
  backsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-start', marginBottom: 10,
  },
  brand: {
    color: '#e9f7ff', fontSize: 16, fontWeight: '800', letterSpacing: 1,
  },
  card: {
    backgroundColor: '#0c2733', borderRadius: 20, borderWidth: 2, elevation: 8, overflow: 'hidden', padding: 14, shadowOpacity: 0.6, shadowRadius: 16,
  },
  club: {
    fontSize: 13, fontWeight: '700', letterSpacing: 1, marginBottom: 8,
  },
  crest: {
    alignItems: 'center', borderRadius: 12, borderWidth: 2, height: 44, justifyContent: 'center', width: 44,
  },
  crestText: { fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  foil: {
    backgroundColor: 'rgba(255,255,255,0.04)', height: '160%', left: '-30%', position: 'absolute', top: '-30%', transform: [{ rotate: '115deg' }], width: '40%',
  },
  footer: {
    alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 'auto',
  },
  historyMeta: { color: '#8fb2c2', fontSize: 11 },
  infoCell: { marginBottom: 6, width: '33%' },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  infoLabel: {
    color: '#7f9aa8', fontSize: 9, letterSpacing: 0.5, textTransform: 'uppercase',
  },
  infoValue: { color: '#fff', fontSize: 13, fontWeight: '700' },
  name: {
    color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: 0.5,
  },
  qrBox: {
    alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 8, height: 56, justifyContent: 'center', overflow: 'hidden', padding: 3, width: 56,
  },
  qrPlaceholder: { color: '#0c2733', fontSize: 12, fontWeight: '800' },
  rarityChip: {
    borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 5,
  },
  rarityText: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  recruitBlock: {
    borderTopColor: 'rgba(255,255,255,0.08)', borderTopWidth: 1, marginBottom: 10, paddingTop: 8,
  },
  recruitChip: {
    borderRadius: 999, borderWidth: 1, marginBottom: 6, marginRight: 6, paddingHorizontal: 10, paddingVertical: 4,
  },
  recruitChipText: { color: '#eaf7ff', fontSize: 11, fontWeight: '700' },
  recruitRow: { flexDirection: 'row', flexWrap: 'wrap' },
  recruitTitle: {
    fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 6,
  },
  topRow: {
    alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10,
  },
});

export default TeamCard;
