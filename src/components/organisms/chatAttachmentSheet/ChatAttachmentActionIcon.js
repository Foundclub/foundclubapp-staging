import {
  Circle,
  Line,
  Path,
  Polyline,
  Rect,
  Svg,
} from 'react-native-svg';

/**
 * @typedef {'photos' | 'camera' | 'location' | 'contact' | 'document' | 'poll' | 'event'} ChatAttachmentActionKey
 */

/**
 * Vector icon set used by chat attachment actions.
 * @param {object} props
 * @param {ChatAttachmentActionKey | string} props.actionKey
 * @param {string} props.color
 * @param {number} [props.size]
 * @returns {import('react').ReactElement}
 */
function ChatAttachmentActionIcon({
  actionKey,
  color,
  size = 28,
}) {
  const strokeColor = color;
  const strokeWidth = 2;

  switch (actionKey) {
    case 'camera':
      return (
        <Svg height={size} viewBox="0 0 24 24" width={size}>
          <Path
            d="M4 9.5h16v9A2.5 2.5 0 0 1 17.5 21h-11A2.5 2.5 0 0 1 4 18.5v-9Z"
            fill="none"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
          <Path
            d="M8.2 9.5 9.4 7h5.2l1.2 2.5"
            fill="none"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
          <Circle
            cx="12"
            cy="14.5"
            fill="none"
            r="3.2"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
        </Svg>
      );
    case 'contact':
      return (
        <Svg height={size} viewBox="0 0 24 24" width={size}>
          <Circle
            cx="12"
            cy="8.5"
            fill="none"
            r="3.2"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
          <Path
            d="M5.5 18.5c1.8-3 4-4.2 6.5-4.2s4.7 1.2 6.5 4.2"
            fill="none"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
        </Svg>
      );
    case 'document':
      return (
        <Svg height={size} viewBox="0 0 24 24" width={size}>
          <Path
            d="M8 3.8h6.6L19 8.2v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z"
            fill="none"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
          <Polyline
            fill="none"
            points="14.6,3.8 14.6,8.4 19,8.4"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
          <Line
            fill="none"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
            x1="9.2"
            x2="15.8"
            y1="13"
            y2="13"
          />
          <Line
            fill="none"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
            x1="9.2"
            x2="14.2"
            y1="16"
            y2="16"
          />
        </Svg>
      );
    case 'event':
      return (
        <Svg height={size} viewBox="0 0 24 24" width={size}>
          <Rect
            fill="none"
            height="14"
            rx="2.5"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
            width="16"
            x="4"
            y="6.5"
          />
          <Line
            fill="none"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
            x1="4"
            x2="20"
            y1="10"
            y2="10"
          />
          <Line
            fill="none"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
            x1="8"
            x2="8"
            y1="4.5"
            y2="8"
          />
          <Line
            fill="none"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
            x1="16"
            x2="16"
            y1="4.5"
            y2="8"
          />
          <Rect fill={strokeColor} height="3.2" rx="0.8" width="3.2" x="8.2" y="12.4" />
        </Svg>
      );
    case 'location':
      return (
        <Svg height={size} viewBox="0 0 24 24" width={size}>
          <Path
            d="M12 21s6-5.8 6-11a6 6 0 1 0-12 0c0 5.2 6 11 6 11Z"
            fill="none"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
          <Circle
            cx="12"
            cy="10"
            fill="none"
            r="2.2"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
        </Svg>
      );
    case 'photos':
      return (
        <Svg height={size} viewBox="0 0 24 24" width={size}>
          <Rect
            fill="none"
            height="14"
            rx="2.5"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
            width="14"
            x="4"
            y="6"
          />
          <Path
            d="M6.5 16l3.3-3.3 2.4 2.4 2.8-2.8 2 2"
            fill="none"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
          <Circle
            cx="9.5"
            cy="10.5"
            fill="none"
            r="1.5"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
        </Svg>
      );
    case 'poll':
      return (
        <Svg height={size} viewBox="0 0 24 24" width={size}>
          <Line
            fill="none"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
            x1="9"
            x2="18.5"
            y1="7.8"
            y2="7.8"
          />
          <Line
            fill="none"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
            x1="9"
            x2="16"
            y1="12"
            y2="12"
          />
          <Line
            fill="none"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
            x1="9"
            x2="14"
            y1="16.2"
            y2="16.2"
          />
          <Circle
            cx="5.8"
            cy="7.8"
            fill="none"
            r="1.3"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
          <Circle
            cx="5.8"
            cy="12"
            fill="none"
            r="1.3"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
          <Circle
            cx="5.8"
            cy="16.2"
            fill="none"
            r="1.3"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
        </Svg>
      );
    default:
      return (
        <Svg height={size} viewBox="0 0 24 24" width={size}>
          <Circle
            cx="12"
            cy="12"
            fill="none"
            r="7.2"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
        </Svg>
      );
  }
}

export default ChatAttachmentActionIcon;
