import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { formatEuros } from '@/domains/complexe/complexeTerrain';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import { useStatistiquesFidelite } from '@/services/complexe/complexeQueries';

/**
 * Le nom court d'un mois (« oct. »), du jour 15 pour éviter les bords de fuseau.
 * @param {string} cle - « 2026-10 ».
 * @returns {string} Le mois.
 */
const moisCourt = (cle) => {
  const date = new Date(`${cle}-15T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? cle : date.toLocaleDateString('fr-FR', { month: 'short' });
};

/**
 * « STATISTIQUES · FIDÉLITÉ » — FIDELITE (12/11/2026, D63, maquette « 237- ok ») : « Par mois »
 * (le mois en cours : bonus débloqués, utilisés, montant offert ou remisé ; les 6 derniers mois en
 * barres) et « Par client » (parties jouées ici, bonus débloqués et utilisés, montant). Serveur :
 * `GET /complexes/:id/fidelite/statistiques`. Monté seulement quand le gérant l'ouvre.
 * @param {object} props - Les propriétés.
 * @param {string | null | undefined} props.complexeId - Le complexe.
 * @returns {import('react').ReactElement} Les statistiques.
 */
function StatistiquesFidelite({ complexeId }) {
  const { t } = useTranslation();
  const { Alignments, Colors, Fonts } = useTheme();
  const lecture = useStatistiquesFidelite(complexeId);
  const [vue, setVue] = useState(/** @type {'clients' | 'mois'} */ ('mois'));
  const mois = Array.isArray(lecture.data?.mois) ? lecture.data.mois : [];
  const clients = Array.isArray(lecture.data?.clients) ? lecture.data.clients : [];
  const courant = mois.length ? mois[mois.length - 1] : null;
  const plusHaut = Math.max(1, ...mois.map((/** @type {any} */ m) => Number(m.debloques) || 0));
  const barre = (/** @type {string} */ couleur, /** @type {unknown} */ n) => ({
    backgroundColor: couleur, height: Math.max(2, (72 * (Number(n) || 0)) / plusHaut), width: 8,
  });
  const carte = {
    backgroundColor: withAlpha(Colors.primary700, 0.45),
    borderColor: withAlpha(Colors.primary500, 0.5),
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  };
  const onglet = (/** @type {'clients' | 'mois'} */ valeur, /** @type {string} */ libelle) => (
    <Text
      accessibilityRole="tab"
      accessibilityState={{ selected: vue === valeur }}
      onPress={() => setVue(valeur)}
      style={[Fonts.p2Bold, Fonts.textCenter, {
        backgroundColor: vue === valeur ? Colors.primary500 : 'transparent',
        borderRadius: 12,
        color: vue === valeur ? Colors.primary900 : Colors.primary200,
        flex: 1,
        paddingVertical: 12,
      }]}
      testID={`fidelite-stats-${valeur}`}
    >
      {libelle}
    </Text>
  );
  const tuile = (/** @type {string} */ valeur, /** @type {string} */ libelle) => (
    <View key={libelle} style={[carte, { flexBasis: 90, flexGrow: 1, gap: 2 }]}>
      <Text style={[Fonts.h3Bold, Fonts.neutral00]}>{valeur}</Text>
      <Text style={[Fonts.p3, Fonts.neutral200]}>{libelle}</Text>
    </View>
  );

  let contenu = null;
  if (lecture.isLoading) {
    contenu = (
      <Text style={[Fonts.p2, Fonts.neutral200]}>
        {t('fidelite.stats.chargement', 'Chargement…')}
      </Text>
    );
  } else if (vue === 'mois') {
    contenu = (
      <View style={{ gap: 12 }}>
        {courant ? (
          <View
            style={[Alignments.row, Alignments.wrap, { gap: 8 }]}
            testID="fidelite-stats-tuiles"
          >
            {tuile(String(courant.debloques), t('fidelite.stats.debloques', 'bonus débloqués'))}
            {tuile(String(courant.utilises), t('fidelite.stats.utilises', 'bonus utilisés'))}
            {tuile(
              formatEuros(Number(courant.montant) || 0),
              t('fidelite.stats.montant', 'offerts ou remisés'),
            )}
          </View>
        ) : null}
        <View style={[carte, { gap: 8 }]}>
          <Text style={[Fonts.p3Bold, Fonts.primary200, { letterSpacing: 0.5 }]}>
            {t('fidelite.stats.sixMois', '6 derniers mois').toUpperCase()}
          </Text>
          <View style={[Alignments.row, { alignItems: 'flex-end', gap: 8, height: 96 }]}>
            {mois.map((/** @type {any} */ m) => (
              <View
                accessibilityLabel={t(
                  'fidelite.stats.barre',
                  '{{mois}} : {{debloques}} débloqués, {{utilises}} utilisés',
                  {
                    debloques: m.debloques,
                    mois: moisCourt(m.mois),
                    utilises: m.utilises,
                    ...SANS_ECHAPPEMENT,
                  },
                )}
                key={m.mois}
                style={[Alignments.alignCenter, { flex: 1, gap: 4 }]}
              >
                <View style={[Alignments.row, { alignItems: 'flex-end', gap: 2, height: 72 }]}>
                  <View style={barre(Colors.primary500, m.debloques)} />
                  <View style={barre(Colors.success500, m.utilises)} />
                </View>
                <Text style={[Fonts.p3, Fonts.neutral200]}>{moisCourt(m.mois)}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  } else {
    contenu = (
      <View style={[carte, { gap: 12 }]} testID="fidelite-stats-liste-clients">
        <Text style={[Fonts.p3Bold, Fonts.primary200, { letterSpacing: 0.5 }]}>
          {t('fidelite.stats.plusFideles', 'Clients les plus fidèles').toUpperCase()}
        </Text>
        {clients.length ? clients.map((/** @type {any} */ c) => (
          <View
            key={c.documentId || c.nom}
            style={[Alignments.row, Alignments.alignCenter, { gap: 12 }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{String(c.nom || '')}</Text>
              <Text style={[Fonts.p3, Fonts.neutral200]}>
                {t(
                  'fidelite.stats.ligneClient',
                  '{{parties}} parties · bonus débloqués : {{debloques}}, utilisés : {{utilises}}',
                  {
                    debloques: c.debloques,
                    parties: c.parties,
                    utilises: c.utilises,
                    ...SANS_ECHAPPEMENT,
                  },
                )}
              </Text>
            </View>
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
              {formatEuros(Number(c.montant) || 0)}
            </Text>
          </View>
        )) : (
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            {t('fidelite.stats.aucunClient', 'Aucun client n’a encore joué chez toi.')}
          </Text>
        )}
      </View>
    );
  }

  return (
    <View style={{ gap: 12 }} testID="fidelite-statistiques">
      <View
        accessibilityRole="tablist"
        style={[Alignments.row, {
          borderColor: withAlpha(Colors.primary500, 0.4),
          borderRadius: 14,
          borderWidth: 1,
          padding: 4,
        }]}
      >
        {onglet('mois', t('fidelite.stats.parMois', 'Par mois'))}
        {onglet('clients', t('fidelite.stats.parClient', 'Par client'))}
      </View>
      {contenu}
    </View>
  );
}

export default StatistiquesFidelite;
