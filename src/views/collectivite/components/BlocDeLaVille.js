import { useTranslation } from 'react-i18next';
import {
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { villeInitiale } from '@/domains/collectivite/collectiviteActualites';
import { formatCollectiviteOfferedBy } from '@/domains/subscription/subscriptionDecision';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import ActualiteCarte from '@/views/collectivite/components/ActualiteCarte';

import {
  useClubActualitesNotify,
  useClubCollectiviteActualites,
} from '@/services/collectivite/collectiviteActualiteQueries';

/**
 * L'écusson d'une Ville, faute de blason : son initiale (planche P3b-actu-tel, écran 5).
 * @param {{ nom: unknown, taille?: number }} props
 * @returns {import('react').ReactElement} L'écusson.
 */
export function EcussonVille({ nom, taille = 28 }) {
  const { Alignments, Colors, Fonts } = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        Alignments.alignCenter,
        Alignments.justifyCenter,
        {
          backgroundColor: withAlpha(Colors.primary500, 0.22),
          borderColor: withAlpha(Colors.primary500, 0.5),
          borderRadius: taille / 2,
          borderWidth: 1,
          height: taille,
          width: taille,
        },
      ]}
    >
      <Text style={[Fonts.p3Bold, Fonts.primary200]}>{villeInitiale(nom)}</Text>
    </View>
  );
}

/**
 * 📰 LE BLOC « DE LA VILLE DE … » DE LA FICHE DU CLUB — COLL-C4A (02/10/2026), planche
 * P3b-actu-tel, écran 5 ; décision d'Adel D68 (01/10).
 *
 * Dans l'onglet « Informations » d'un club rattaché, pour SES membres : la dernière actualité de
 * la Ville, en LECTURE SEULE (ni réponse, ni réaction), « Toutes les actualités de la Ville » (le
 * canal), et l'interrupteur « Me prévenir des actualités de la Ville », DÉSACTIVÉ par défaut :
 * le membre le trouve au moment où il lit une actualité, sans connaître les réglages.
 * Un dirigeant ou un entraîneur est prévenu d'office (D68) : pour lui, une phrase le dit.
 *
 * Rien ne s'affiche tant que le serveur n'a pas répondu, ni pour un club rattaché à personne.
 * La fiche du club passe SA navigation (`onOuvrirCanal`) : le bloc n'en prend pas une à part.
 * @param {{ clubId: string, encadrant?: boolean,
 *   onOuvrirCanal: (collectiviteId: string) => void }} props - `encadrant` : dirigeant ou
 *   entraîneur.
 * @returns {import('react').ReactElement | null} Le bloc.
 */
function BlocDeLaVille({ clubId, encadrant = false, onOuvrirCanal }) {
  const { t } = useTranslation();
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const lecture = useClubCollectiviteActualites(clubId);
  const interrupteur = useClubActualitesNotify(clubId);
  const donnees = lecture.data;
  const collectivite = donnees?.collectivite;
  if (!collectivite?.documentId) return null;

  const derniere = Array.isArray(donnees?.actualites) ? donnees.actualites[0] : null;
  const active = donnees?.notify === true;
  const titre = t('collectiviteActualites.bloc.titre', 'De {{ville}}', {
    ville: formatCollectiviteOfferedBy(collectivite.name),
  });
  const libelleInterrupteur = t(
    'collectiviteActualites.bloc.interrupteur',
    'Me prévenir des actualités de la Ville',
  );
  const ouvrirLeCanal = () => onOuvrirCanal?.(collectivite.documentId);

  return (
    <View
      accessibilityLabel={titre}
      style={[
        Spaces.padding[16],
        {
          backgroundColor: withAlpha(Colors.neutral00, 0.04),
          borderColor: withAlpha(Colors.neutral00, 0.09),
          borderRadius: 16,
          borderWidth: 1,
          gap: 8,
        },
      ]}
      testID="bloc-de-la-ville"
    >
      <View style={[Alignments.row, Alignments.alignCenter, { gap: 8 }]}>
        <EcussonVille nom={collectivite.name} />
        <Text accessibilityRole="header" style={[Fonts.p2Bold, Fonts.primary200, { flex: 1 }]}>
          {titre}
        </Text>
      </View>
      {derniere ? (
        <ActualiteCarte actualite={derniere} testID="bloc-de-la-ville-actualite" />
      ) : (
        <Text style={[Fonts.p3, Fonts.neutral300]} testID="bloc-de-la-ville-vide">
          {t('collectiviteActualites.bloc.vide', 'Aucune actualité de la Ville pour l’instant.')}
        </Text>
      )}
      <TouchableOpacity
        accessibilityRole="link"
        onPress={ouvrirLeCanal}
        style={{ alignSelf: 'flex-start', justifyContent: 'center', minHeight: 44 }}
        testID="bloc-de-la-ville-toutes"
      >
        <Text style={[Fonts.p2Bold, Fonts.primary500]}>
          {t('collectiviteActualites.bloc.toutes', 'Toutes les actualités de la Ville')}
        </Text>
      </TouchableOpacity>
      <View
        style={[
          Alignments.row,
          Alignments.alignCenter,
          {
            borderTopColor: withAlpha(Colors.neutral00, 0.1),
            borderTopWidth: 1,
            gap: 12,
            minHeight: 48,
            paddingTop: 8,
          },
        ]}
      >
        {encadrant ? (
          <Text
            style={[Fonts.p3, Fonts.neutral300, { flex: 1 }]}
            testID="bloc-de-la-ville-encadrant"
          >
            {t(
              'collectiviteActualites.bloc.encadrant',
              'Tu es prévenu de chaque actualité : dirigeants et entraîneurs le sont toujours.',
            )}
          </Text>
        ) : (
          <>
            <View style={{ flex: 1 }}>
              <Text style={[Fonts.p3Bold, Fonts.neutral00]}>{libelleInterrupteur}</Text>
              <Text style={[Fonts.p3, Fonts.neutral300]}>
                {t(
                  'collectiviteActualites.bloc.parDefaut',
                  'Désactivé par défaut. Tu peux l’activer quand tu veux.',
                )}
              </Text>
            </View>
            <Switch
              accessibilityLabel={libelleInterrupteur}
              accessibilityRole="switch"
              accessibilityState={{ checked: active, disabled: interrupteur.isPending }}
              disabled={interrupteur.isPending}
              onValueChange={(valeur) => interrupteur.mutate(valeur)}
              testID="bloc-de-la-ville-interrupteur"
              thumbColor={active ? Colors.primary500 : Colors.neutral300}
              trackColor={{ false: Colors.neutral500, true: withAlpha(Colors.primary500, 0.4) }}
              value={active}
            />
          </>
        )}
      </View>
    </View>
  );
}

export default BlocDeLaVille;
