import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  // WHATSAPP2 — TROIS COLONNES, ET C'EST UNE MESURE QUI L'IMPOSE. En deux
  // colonnes, les sept actions faisaient quatre rangees : la feuille reclamait
  // 778 pt la ou un petit telephone n'en offre que 627. Elle defilait donc, et
  // son titre partait sous le bord haut (capture d'Adel, 23/09). En trois
  // colonnes il ne reste que trois rangees, et tout tient sans defiler.
  actionButton: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    minHeight: 120,
    paddingHorizontal: 6,
    paddingVertical: 12,
    width: '31.5%',
  },
  actionIconCircle: {
    alignItems: 'center',
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    marginBottom: 10,
    width: 56,
  },
  actionLabel: {
    textAlign: 'center',
  },
  actionReason: {
    marginTop: 6,
    textAlign: 'center',
  },
  actionsGrid: {
    columnGap: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    // 🧱 `flex-start` et PAS `space-between` : avec sept tuiles, la derniere
    // rangee n'en porte qu'une. `space-between` la laisserait collee a gauche
    // mais etirerait les autres rangees de facon irreguliere des qu'une action
    // est masquee (elles le sont sous condition).
    justifyContent: 'flex-start',
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
