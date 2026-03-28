import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import {
  formatAttachmentSize,
  getDocumentBadgeLabel,
  getDocumentDisplayName,
  getDocumentKind,
  getPrimaryDocumentAttachment,
} from '@/utils/documentAttachment';

const getKindAccentColor = (kind, Colors) => {
  switch (kind) {
    case 'doc':
      return Colors.primary500;
    case 'pdf':
      return Colors.error500;
    case 'xls':
      return Colors.success500;
    case 'zip':
      return Colors.warning500;
    default:
      return Colors.neutral300;
  }
};

/**
 * Document message bubble.
 * @param {object} props
 * @param {Array<any>} [props.attachments]
 * @param {string} [props.caption]
 * @param {boolean} [props.failed]
 * @param {boolean} [props.isMe]
 * @param {(attachment: any) => void} [props.onDownload]
 * @param {(attachment: any) => void} [props.onOpen]
 * @param {() => void} [props.onRetry]
 * @param {(attachment: any) => void} [props.onShare]
 * @param {boolean} [props.pending]
 * @returns {import('react').ReactElement | null}
 */
function DocumentMessageBubble({
  attachments = [],
  caption = '',
  failed = false,
  isMe = false,
  onDownload,
  onOpen,
  onRetry,
  onShare,
  pending = false,
}) {
  const { Colors, Fonts, Spaces } = useTheme();

  const documentAttachment = getPrimaryDocumentAttachment(attachments);
  if (!documentAttachment) return null;

  const badgeLabel = getDocumentBadgeLabel(documentAttachment);
  const displayName = getDocumentDisplayName(documentAttachment);
  const attachmentCount = Array.isArray(attachments)
    ? attachments.filter(Boolean).length
    : 0;
  const extraAttachmentCount = Math.max(0, attachmentCount - 1);
  const documentKind = getDocumentKind(documentAttachment);
  const accentColor = failed ? Colors.error500 : getKindAccentColor(documentKind, Colors);
  const metaParts = [
    badgeLabel,
    formatAttachmentSize(documentAttachment?.size),
  ].filter(Boolean);

  const handlePrimaryPress = () => {
    if (pending) return;
    if (failed) {
      onRetry?.();
      return;
    }
    onOpen?.(documentAttachment);
  };

  return (
    <View
      style={{
        alignSelf: isMe ? 'flex-end' : 'flex-start',
        maxWidth: '88%',
        minWidth: 220,
      }}
    >
      <TouchableOpacity
        activeOpacity={pending ? 1 : 0.92}
        disabled={pending}
        onPress={handlePrimaryPress}
        style={{
          backgroundColor: failed ? 'rgba(69, 16, 24, 0.96)' : 'rgba(10, 28, 38, 0.96)',
          borderColor: failed ? Colors.error500 : 'rgba(1,179,244,0.35)',
          borderRadius: 16,
          borderWidth: 1,
          opacity: pending ? 0.82 : 1,
          overflow: 'hidden',
        }}
      >
        <View style={{ gap: 12, paddingHorizontal: 14, paddingVertical: 14 }}>
          <View style={{ alignItems: 'flex-start', flexDirection: 'row', gap: 12 }}>
            <View
              style={{
                alignItems: 'center',
                backgroundColor: `${accentColor}1F`,
                borderColor: accentColor,
                borderRadius: 12,
                borderWidth: 1,
                height: 48,
                justifyContent: 'center',
                width: 48,
              }}
            >
              <Text style={[Fonts.p3Bold, { color: accentColor }]}>
                {badgeLabel}
              </Text>
            </View>

            <View style={{ flex: 1, gap: 5, minWidth: 0 }}>
              <Text
                numberOfLines={2}
                style={[
                  Fonts.p2Bold,
                  {
                    color: Colors.neutral00,
                    flexShrink: 1,
                  },
                ]}
              >
                {displayName}
              </Text>

              <Text
                numberOfLines={1}
                style={[Fonts.p4, { color: Colors.neutral300 }]}
              >
                {metaParts.join(' • ') || 'Fichier'}
              </Text>

              {extraAttachmentCount > 0 ? (
                <View
                  style={{
                    alignItems: 'center',
                    alignSelf: 'flex-start',
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    borderRadius: 999,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                  }}
                >
                  <Text style={[Fonts.p4Bold, { color: Colors.neutral200 }]}>
                    +
                    {extraAttachmentCount}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {pending ? (
            <View style={{ alignItems: 'center', flexDirection: 'row', gap: 8 }}>
              <ActivityIndicator color={Colors.primary500} size="small" />
              <Text style={[Fonts.p4, { color: Colors.neutral300 }]}>Envoi...</Text>
            </View>
          ) : null}
        </View>

        <View
          style={{
            borderTopColor: 'rgba(255,255,255,0.08)',
            borderTopWidth: 1,
            paddingHorizontal: 10,
            paddingVertical: 10,
          }}
        >
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              activeOpacity={0.88}
              disabled={pending}
              onPress={handlePrimaryPress}
              style={{
                alignItems: 'center',
                backgroundColor: failed ? 'rgba(244, 63, 94, 0.14)' : 'rgba(1,179,244,0.12)',
                borderColor: failed ? Colors.error500 : Colors.primary500,
                borderRadius: 10,
                borderWidth: 1,
                flex: 1,
                minWidth: 0,
                opacity: pending ? 0.6 : 1,
                paddingHorizontal: 8,
                paddingVertical: 11,
              }}
            >
              <Text
                adjustsFontSizeToFit
                minimumFontScale={0.85}
                numberOfLines={1}
                style={[Fonts.p4Bold, { color: failed ? Colors.error500 : Colors.primary500 }]}
              >
                {failed ? 'Réessayer' : 'Ouvrir'}
              </Text>
            </TouchableOpacity>

            {!failed && !pending ? (
              <>
                <TouchableOpacity
                  activeOpacity={0.88}
                  onPress={() => onDownload?.(documentAttachment)}
                  style={{
                    alignItems: 'center',
                    backgroundColor: 'rgba(255,255,255,0.04)',
                    borderColor: 'rgba(255,255,255,0.08)',
                    borderRadius: 10,
                    borderWidth: 1,
                    flex: 1,
                    minWidth: 0,
                    paddingHorizontal: 8,
                    paddingVertical: 11,
                  }}
                >
                  <Text
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                    numberOfLines={1}
                    style={[Fonts.p4Bold, { color: Colors.neutral100 }]}
                  >
                    Télécharger
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.88}
                  onPress={() => onShare?.(documentAttachment)}
                  style={{
                    alignItems: 'center',
                    backgroundColor: 'rgba(255,255,255,0.04)',
                    borderColor: 'rgba(255,255,255,0.08)',
                    borderRadius: 10,
                    borderWidth: 1,
                    flex: 1,
                    minWidth: 0,
                    paddingHorizontal: 8,
                    paddingVertical: 11,
                  }}
                >
                  <Text
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                    numberOfLines={1}
                    style={[Fonts.p4Bold, { color: Colors.neutral100 }]}
                  >
                    Partager
                  </Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>

      {caption ? (
        <View style={[Spaces.marginTop[6], { paddingHorizontal: 4 }]}>
          <Text style={[Fonts.p3, { color: Colors.neutral100 }]}>
            {caption}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export default DocumentMessageBubble;
