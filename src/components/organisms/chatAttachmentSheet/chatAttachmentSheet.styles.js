import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  actionButton: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    minHeight: 132,
    paddingHorizontal: 12,
    paddingVertical: 14,
    width: '48%',
  },
  actionIconCircle: {
    alignItems: 'center',
    borderRadius: 32,
    height: 64,
    justifyContent: 'center',
    marginBottom: 12,
    width: 64,
  },
  actionLabel: {
    textAlign: 'center',
  },
  actionReason: {
    marginTop: 6,
    textAlign: 'center',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  section: {
    gap: 14,
  },
  subtitle: {
    marginTop: 4,
  },
  title: {
    textAlign: 'center',
  },
});

export default styles;
