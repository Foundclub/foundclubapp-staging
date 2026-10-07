import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  bandeauMairie,
  categoryLabel,
  photosEtDocuments,
  publicationDateLabel,
} from '@/domains/collectivite/collectiviteActualites';
import { formatCollectiviteOfferedBy } from '@/domains/subscription/subscriptionDecision';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import { PetitePhoto } from '@/views/collectivite/components/ActualiteCarte';
import { EcussonVille } from '@/views/collectivite/components/BlocDeLaVille';

import {
  useCollectiviteActualites,
  useMarquerActualitesVues,
  useMesActualitesDeLaVille,
} from '@/services/collectivite/collectiviteActualiteQueries';

import { getItem, setItem } from '@/platform/storage';

/**
 * La forme du bandeau : une ligne d'étiquette, le titre, une ligne de précision, une flèche, et
 * la croix (44 px). Toute la carte est un lien, avec un libellé complet (planche, contrôle).
 * VILLE-T18D : la première photo de l'actualité, en petit, avant la flèche.
 * @param {{
 *   ferme: () => void, fermeture: boolean, libelleCroix: string, libelleLien: string,
 *   nomVille: string, ouvre: () => void, photo?: any, precision: string, testID: string,
 *   titre: string, etiquette: string,
 * }} props
 * @returns {import('react').ReactElement} Le bandeau.
 */
function FormeDuBandeau({
  etiquette, ferme, fermeture, libelleCroix, libelleLien, nomVille, ouvre, photo, precision,
  testID, titre,
}) {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images,
  } = useTheme();
  const ton = fermeture ? Colors.warning500 : Colors.primary500;
  return (
    <View
      style={[
        Alignments.row,
        Alignments.alignCenter,
        {
          backgroundColor: withAlpha(ton, 0.12),
          borderColor: withAlpha(ton, 0.5),
          borderRadius: 16,
          borderWidth: 1,
          gap: 4,
          paddingBottom: 12,
          paddingLeft: 12,
          paddingRight: 4,
          paddingTop: 12,
        },
      ]}
      testID={testID}
    >
      <TouchableOpacity
        accessibilityLabel={libelleLien}
        accessibilityRole="link"
        onPress={ouvre}
        style={[Alignments.row, Alignments.alignCenter, { flex: 1, gap: 12, minHeight: 44 }]}
        testID={`${testID}-ouvrir`}
      >
        <EcussonVille nom={nomVille} taille={36} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={[
              Fonts.p4Bold,
              { color: fermeture ? Colors.warning400 : Colors.primary200, letterSpacing: 0.8 },
            ]}
          >
            {etiquette.toUpperCase()}
          </Text>
          <Text numberOfLines={1} style={[Fonts.p2Bold, Fonts.neutral00]}>{titre}</Text>
          <Text style={[Fonts.p4, Fonts.neutral200]}>{precision}</Text>
        </View>
        {photo ? <PetitePhoto fichier={photo} taille={40} testID={`${testID}-photo`} /> : null}
        <Image
          source={Images.arrowRight}
          style={[ApplicationStyle.icon16, ApplicationStyle.tintColor.neutral200]}
        />
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityLabel={libelleCroix}
        accessibilityRole="button"
        onPress={ferme}
        style={[Alignments.alignCenter, Alignments.justifyCenter, { height: 44, width: 44 }]}
        testID={`${testID}-masquer`}
      >
        <Image
          source={Images.close}
          style={[ApplicationStyle.icon16, ApplicationStyle.tintColor.neutral200]}
        />
      </TouchableOpacity>
    </View>
  );
}

/**
 * 📰 LE BANDEAU « ACTUALITÉ DE LA VILLE » DE L'ACCUEIL D'UN MEMBRE — COLL-C4A (02/10/2026),
 * planche P3b-bandeau-tel (écrans 2 à 5 : dirigeant, entraîneur, joueur, parent).
 *
 * En tête de l'accueil, au-dessus de tout le reste : la plus récente actualité de la Ville de
 * moins de 7 jours que la personne n'a ni ouverte ni masquée — le SERVEUR la choisit
 * (`/collectivite-actualites/mine`, `bandeau`). UN seul bandeau, « et n autres ». Une
 * fermeture prend la couleur d'attention. L'appui ouvre le canal de la Ville ; la croix le masque.
 * Dans les deux cas il part, et ne revient qu'avec une nouvelle actualité. Ce n'est PAS une
 * notification : un joueur le voit même sans l'interrupteur D68.
 * @param {{ onOuvrir: (collectiviteId: string) => void }} props - L'accueil passe SA navigation.
 * @returns {import('react').ReactElement | null} Le bandeau, ou rien.
 */
export function BandeauActualiteMembre({ onOuvrir }) {
  const { t } = useTranslation();
  const lecture = useMesActualitesDeLaVille();
  const vues = useMarquerActualitesVues();
  const bandeau = lecture.data?.bandeau;
  const actualite = bandeau?.actualite;
  if (!actualite?.documentId) return null;

  const nomVille = String(actualite.collectivite?.name || '');
  const collectiviteId = String(actualite.collectivite?.documentId || '');
  const autres = Number.isInteger(bandeau.autres) ? bandeau.autres : 0;
  const fermeture = actualite.category === 'fermeture';
  const date = publicationDateLabel(t, actualite.publishedAt);
  const etiquette = fermeture
    ? t('collectiviteActualites.bandeau.fermeture', '{{type}} · {{ville}}', {
      type: categoryLabel(t, 'fermeture'),
      ville: nomVille,
      ...SANS_ECHAPPEMENT,
    })
    : t('collectiviteActualites.bandeau.etiquette', 'Actualité de la Ville');
  let precision = t('collectiviteActualites.bandeau.precision', '{{ville}} · {{date}}', {
    date,
    ville: nomVille,
    ...SANS_ECHAPPEMENT,
  });
  if (autres === 1) {
    precision = t('collectiviteActualites.bandeau.etUneAutre', '{{date}} · et 1 autre', {
      date,
      ...SANS_ECHAPPEMENT,
    });
  } else if (autres > 1) {
    precision = t('collectiviteActualites.bandeau.etAutres', '{{date}} · et {{nombre}} autres', {
      date,
      nombre: autres,
      ...SANS_ECHAPPEMENT,
    });
  }
  const marquer = () => vues.mutate([collectiviteId]);
  return (
    <FormeDuBandeau
      etiquette={etiquette}
      ferme={marquer}
      fermeture={fermeture}
      libelleCroix={autres > 0
        ? t('collectiviteActualites.bandeau.masquerTout', 'Masquer ces actualités')
        : t('collectiviteActualites.bandeau.masquer', 'Masquer cette actualité')}
      libelleLien={t(
        'collectiviteActualites.bandeau.lien',
        'Actualité de {{ville}} : {{titre}}. Ouvrir',
        {
          titre: actualite.title,
          ville: formatCollectiviteOfferedBy(nomVille),
          ...SANS_ECHAPPEMENT,
        },
      )}
      nomVille={nomVille}
      ouvre={() => {
        marquer();
        onOuvrir(collectiviteId);
      }}
      photo={photosEtDocuments(actualite.attachments).photos[0]}
      precision={precision}
      testID="bandeau-actualite-ville"
      titre={String(actualite.title || '')}
    />
  );
}

/**
 * 📰 LE BANDEAU DE LA MAIRIE — « Votre actualité · en ligne » (planche P3b-bandeau-tel,
 * écran 1) : sa dernière actualité, en ligne depuis moins de 7 jours, confirme ce que les clubs
 * voient. Il mène à « Actualités de la Ville ». La croix le masque jusqu'à la suivante.
 * ponytail: retenu sur l'appareil (comme le guide des premiers pas de l'accueil) ; voie de
 * sortie : la route `mine/seen` du serveur, si les agents changent souvent d'appareil.
 * @param {{ collectiviteId: string, nomVille: string, onOuvrir: () => void,
 *   userId?: string | null }} props
 * @returns {import('react').ReactElement | null} Le bandeau, ou rien.
 */
export function BandeauActualiteMairie({
  collectiviteId, nomVille, onOuvrir, userId,
}) {
  const { t } = useTranslation();
  const actualites = useCollectiviteActualites(collectiviteId);
  const cle = `coll-c4a:bandeau-masque:${userId || 'anonyme'}:${collectiviteId}`;
  const [masquee, setMasquee] = useState(() => {
    try {
      return getItem(cle) || null;
    } catch {
      return null;
    }
  });
  const actualite = bandeauMairie(actualites.data, masquee);
  if (!actualite) return null;

  const masquer = () => {
    try {
      setItem(cle, String(actualite.documentId));
    } catch {
      // Sans stockage : le bandeau part pour cette visite seulement.
    }
    setMasquee(String(actualite.documentId));
  };
  const nombre = Number.isInteger(actualite.recipients?.clubsCount)
    ? actualite.recipients.clubsCount
    : 0;
  const date = publicationDateLabel(t, actualite.publishedAt);
  return (
    <FormeDuBandeau
      etiquette={t('collectiviteActualites.bandeau.mairieEtiquette', 'Votre actualité · en ligne')}
      ferme={masquer}
      fermeture={actualite.category === 'fermeture'}
      libelleCroix={t('collectiviteActualites.bandeau.mairieMasquer', 'Masquer ce bandeau')}
      libelleLien={t(
        'collectiviteActualites.bandeau.mairieLien',
        'Votre actualité en ligne : {{titre}}. Ouvrir',
        { titre: actualite.title, ...SANS_ECHAPPEMENT },
      )}
      nomVille={nomVille}
      ouvre={onOuvrir}
      photo={photosEtDocuments(actualite.attachments).photos[0]}
      precision={nombre === 1
        ? t('collectiviteActualites.bandeau.mairiePrecisionUn', 'Depuis {{date}}, pour 1 club', {
          date,
          ...SANS_ECHAPPEMENT,
        })
        : t(
          'collectiviteActualites.bandeau.mairiePrecision',
          'Depuis {{date}}, pour les {{nombre}} clubs',
          { date, nombre, ...SANS_ECHAPPEMENT },
        )}
      testID="bandeau-actualite-mairie"
      titre={String(actualite.title || '')}
    />
  );
}
