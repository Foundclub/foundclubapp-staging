import {
  TouchableOpacity,
  View,
} from 'react-native';

/**
 * Small action button used to open a planning in fullscreen.
 * @param {{ borderColor: string, onPress: () => void }} props
 * @returns {import('react').ReactElement}
 */
function PlanningFullscreenButton({ borderColor, onPress }) {
  const cornerStyle = {
    borderColor,
    height: 7,
    position: 'absolute',
    width: 7,
  };

  return (
    <TouchableOpacity
      accessibilityLabel="Ouvrir le planning en plein ecran"
      accessibilityRole="button"
      onPress={onPress}
      style={{
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderColor,
        borderRadius: 14,
        borderWidth: 1,
        height: 42,
        justifyContent: 'center',
        width: 42,
      }}
    >
      <View style={{ height: 18, position: 'relative', width: 18 }}>
        <View
          style={[cornerStyle, {
            borderLeftWidth: 2,
            borderTopWidth: 2,
            left: 0,
            top: 0,
          }]}
        />
        <View
          style={[cornerStyle, {
            borderRightWidth: 2,
            borderTopWidth: 2,
            right: 0,
            top: 0,
          }]}
        />
        <View
          style={[cornerStyle, {
            borderBottomWidth: 2,
            borderLeftWidth: 2,
            bottom: 0,
            left: 0,
          }]}
        />
        <View
          style={[cornerStyle, {
            borderBottomWidth: 2,
            borderRightWidth: 2,
            bottom: 0,
            right: 0,
          }]}
        />
      </View>
    </TouchableOpacity>
  );
}

export default PlanningFullscreenButton;
