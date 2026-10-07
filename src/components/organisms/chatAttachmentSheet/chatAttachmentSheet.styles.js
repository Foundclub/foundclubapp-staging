import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  // MSG1A (§3.5) — QUATRE COLONNES DE PASTILLES (le pack). WHATSAPP2 avait pose trois
  // colonnes de cartes pour que sept actions tiennent sans defiler (778 pt reclames pour
  // 627 offerts en deux colonnes) ; en quatre colonnes il ne reste que DEUX rangees : la
  // feuille raccourcit encore, la regle tient.
  actionButton: {
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 2,
    width: '25%',
  },
  actionIconCircle: {
    alignItems: 'center',
    borderRadius: 29,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  actionLabel: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 12.5,
    lineHeight: 16,
    textAlign: 'center',
  },
  actionReason: {
    marginTop: -4,
    textAlign: 'center',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    rowGap: 18,
  },
  section: {
    gap: 14,
    marginTop: 6,
  },
  subtitle: {
    marginTop: 4,
  },
  title: {
    textAlign: 'center',
  },
});

export default styles;
