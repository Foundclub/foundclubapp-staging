import { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';

import {
  getSubscriptionEntryPeriod,
  getSubscriptionEntryScope,
  isPerLicenseeSubscriptionEntry,
} from '@/domains/subscription/subscriptionBilling';
import { useSubscriptionCatalog } from '@/domains/subscription/useSubscriptionCatalog';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

// C'est CETTE matrice qui porte le detail complet des trois offres : depuis L33,
// plus aucune liste de douze ✓ n'est repetee ailleurs. Chaque cellule vaut :
//   - une chaine  -> valeur litterale (« 1 », « Limités », « ∞ »)
//   - true        -> inclus (✓ vert)
//   - false       -> absent (tiret gris)
const COMPARISON_ROWS = [
  {
    club: 'Toutes', free: '1', label: 'Équipes couvertes', team: '1–3',
  },
  {
    club: '∞', free: 'Limités', label: 'Événements & matchs', team: '∞',
  },
  {
    club: '∞', free: 'Limitées', label: 'Annonces de recrutement', team: '∞',
  },
  {
    club: true, free: false, label: 'Composition & convocations', team: true,
  },
  {
    club: true, free: false, label: 'Cotisations de l\'équipe', team: true,
  },
  {
    club: true, free: false, label: 'Fiche club & rôles', team: false,
  },
  {
    club: true, free: false, label: 'Installations & réservations', team: false,
  },
  {
    club: true, free: false, label: 'Sponsors & partenaires', team: false,
  },
  {
    club: true, free: false, label: 'Cotisations du club', team: false,
  },
  {
    club: true, free: false, label: 'Certification du club', team: false,
  },
];

const COLUMN_WIDTH = 62;
const ROW_MIN_HEIGHT = 44;

/**
 * Prix d'appel mensuel d'une famille, tel que le rend le catalogue serveur.
 * Aucun prix n'est ecrit en dur : sans catalogue, l'en-tete n'annonce rien.
 * @param {any[]} entries
 * @param {'TEAM' | 'CLUB'} scopeType
 * @returns {string}
 */
const getStartingMonthlyPriceLabel = (entries, scopeType) => {
  const prices = entries
    .filter((entry) => getSubscriptionEntryScope(entry) === scopeType
      && getSubscriptionEntryPeriod(entry) === 'monthly'
      // S12-B — ⛔ LE PRIX AU LICENCIE N'EST PAS UN PRIX D'APPEL.
      // Il est UNITAIRE (0,25 EUR/mois par licencie) : le laisser entrer dans ce
      // `Math.min` faisait annoncer « Club : des 0,25 EUR » au lieu de 19,99 EUR
      // — un facteur 80 sur l'entete de la colonne la plus chere.
      && !isPerLicenseeSubscriptionEntry(entry))
    .map((entry) => Number(entry?.referencePriceEurCents))
    .filter((cents) => Number.isFinite(cents) && cents > 0);

  if (prices.length === 0) return '';
  return `dès ${(Math.min(...prices) / 100).toFixed(2).replace('.', ',')} €`;
};

/**
 * Ecran 3 du parcours Abonnement (L33) : COMPARER. Une matrice unique, ouverte
 * depuis le hub, avec un seul chemin de sortie vers le carrousel.
 * @param {{ navigation?: any }} props
 * @returns {import('react').ReactElement}
 */
function SubscriptionCompare({ navigation }) {
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();

  const catalogEntries = useSubscriptionCatalog().entries;

  const columns = useMemo(() => [
    { key: 'free', priceLabel: '0 €', title: 'Gratuit' },
    { key: 'team', priceLabel: getStartingMonthlyPriceLabel(catalogEntries, 'TEAM'), title: 'Équipe' },
    { key: 'club', priceLabel: getStartingMonthlyPriceLabel(catalogEntries, 'CLUB'), title: 'Club' },
  ], [catalogEntries]);

  /**
   * @param {string} columnKey
   * @returns {any}
   */
  const getColumnTitleColor = (columnKey) => {
    if (columnKey === 'club') return Colors.violet200;
    if (columnKey === 'team') return Colors.primary200;
    return Colors.neutral200;
  };

  /**
   * Cellule d'une ligne : ✓ vert, tiret gris, ou valeur litterale.
   * @param {string | boolean} value
   * @returns {import('react').ReactElement}
   */
  const renderCell = (value) => {
    if (value === true) {
      return <Text style={[Fonts.p3Bold, { color: Colors.success500 }]}>✓</Text>;
    }
    if (value === false) {
      return <Text style={[Fonts.p3, { color: Colors.neutral600 }]}>—</Text>;
    }
    return (
      <Text numberOfLines={2} style={[Fonts.p4Bold, Fonts.neutral100, Fonts.textCenter]}>
        {String(value)}
      </Text>
    );
  };

  return (
    <ScreenContainer
      bgImage="bg2"
      bottomInsetMode="screen"
      contentContainerStyle={[Spaces.paddingBottom[0], Spaces.paddingTop[0]]}
    >
      <View style={Alignments.fill}>
        <ScrollView
          contentContainerStyle={[Spaces.paddingBottom[24], Spaces.paddingTop[12]]}
          showsVerticalScrollIndicator={false}
          style={Alignments.fill}
        >
          <View
            style={{
              backgroundColor: withAlpha(Colors.primary800, 0.66),
              borderColor: withAlpha(Colors.neutral00, 0.12),
              borderRadius: 18,
              borderWidth: 1,
              overflow: 'hidden',
            }}
          >
            <View
              style={[
                Alignments.row,
                Spaces.padding[12],
                { alignItems: 'flex-end', backgroundColor: withAlpha(Colors.neutral00, 0.04) },
              ]}
            >
              <View style={Alignments.fill} />
              {columns.map((column) => (
                <View key={column.key} style={{ alignItems: 'center', width: COLUMN_WIDTH }}>
                  <Text style={[Fonts.p4Bold, { color: getColumnTitleColor(column.key) }]}>
                    {column.title}
                  </Text>
                  {column.priceLabel ? (
                    <Text numberOfLines={1} style={[Fonts.p4, Fonts.neutral400]}>
                      {`${column.priceLabel}/mois`}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>

            {COMPARISON_ROWS.map((row) => (
              <View
                key={row.label}
                style={[
                  Alignments.row,
                  Alignments.alignCenter,
                  Spaces.paddingHorizontal[12],
                  {
                    borderTopColor: withAlpha(Colors.neutral00, 0.06),
                    borderTopWidth: 1,
                    minHeight: ROW_MIN_HEIGHT,
                  },
                ]}
              >
                <Text style={[Alignments.fill, Fonts.p4Bold, Fonts.neutral100, Spaces.paddingRight[8]]}>
                  {row.label}
                </Text>
                {columns.map((column) => (
                  <View
                    key={column.key}
                    style={{ alignItems: 'center', justifyContent: 'center', width: COLUMN_WIDTH }}
                  >
                    {renderCell(row[column.key])}
                  </View>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>

        <View
          style={[
            Spaces.gap[8],
            Spaces.paddingTop[12],
            {
              borderTopColor: withAlpha(Colors.neutral00, 0.08),
              borderTopWidth: 1,
            },
          ]}
        >
          <Button
            onPress={() => navigation.navigate(RouteNames.SubscriptionOffers)}
            title="Voir les offres"
            variant="Primary"
          />
        </View>
      </View>
    </ScreenContainer>
  );
}

export default SubscriptionCompare;
