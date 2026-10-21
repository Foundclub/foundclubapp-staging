import { useNavigation, useRoute } from '@react-navigation/native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';

import {
  CONVERSATION_CLUB,
  CONVERSATION_LIBRE,
  estRefusDuFilDeLaVille,
} from '@/domains/collectivite/collectiviteCanaux';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Loader from '@/components/atoms/loader/Loader';
import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';
import ScreenContainer from '@/components/templates/ScreenContainer';
import { EcussonVille } from '@/views/collectivite/components/BlocDeLaVille';
import { FilDeLaVilleQuitte } from '@/views/collectivite/components/FilDeLaVille';

import { useMembresDuFil } from '@/services/collectivite/collectiviteCanauxQueries';

import { getErrorMessage } from '@/utils/errors/displayError';

/**
 * Une personne du fil : son nom, et sa fonction (« gestionnaire » ou « dirigeant »).
 * @param {{ espaceVille: boolean, membre: any }} props
 * @returns {import('react').ReactElement} La ligne.
 */
function LigneMembre({ espaceVille, membre }) {
  const { t } = useTranslation();
  const { Fonts } = useTheme();
  const nom = `${membre?.firstname || ''} ${membre?.lastname || ''}`.trim();
  let fonction = t('collectiviteCanaux.membres.dirigeant', 'dirigeant');
  if (membre?.fonction === 'gestionnaire') {
    fonction = t('collectiviteCanaux.membres.gestionnaire', 'gestionnaire');
  }
  // MSG-VILLE-NOUVELLE — une personne choisie par la Ville (membre d'un club, autre gestionnaire).
  if (membre?.fonction === 'membre') fonction = t('collectiviteCanaux.membres.membre', 'membre');
  let affiche = nom;
  if (membre?.estMoi) {
    affiche = espaceVille
      ? t('collectiviteCanaux.membres.moiVous', '{{nom}} (vous)', { nom, ...SANS_ECHAPPEMENT })
      : t('collectiviteCanaux.membres.moiToi', '{{nom}} (toi)', { nom, ...SANS_ECHAPPEMENT });
  }
  return (
    <View style={{ justifyContent: 'center', minHeight: 48 }} testID="canal-membre">
      <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{affiche}</Text>
      <Text style={[Fonts.p3, Fonts.neutral300]}>{fonction}</Text>
    </View>
  );
}

/**
 * La liste calculée d'un fil de la Ville : la Ville et ses gestionnaires, puis chaque club et
 * ses dirigeants, et la règle qui la tient. Sert l'écran « Dans ce canal » (téléphone) et la
 * colonne de droite de la conversation sur le site (P3c-canal-ordi).
 * @param {{ espaceVille?: boolean, fil: any }} props
 * @returns {import('react').ReactElement} La liste.
 */
export function ListeDesMembresDuFil({ espaceVille = false, fil }) {
  const { t } = useTranslation();
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const estPrivee = fil?.chat?.type === CONVERSATION_CLUB;
  // MSG-VILLE-NOUVELLE — la conversation ouverte par la Ville : la Ville, puis les choisis.
  const estLibre = fil?.chat?.type === CONVERSATION_LIBRE;
  const villeNom = String(fil?.collectivite?.name || '');
  let sousTitre = t(
    'collectiviteCanaux.membres.sousTitreCanal',
    'Dirigeants des clubs · {{ville}}',
    { ville: villeNom, ...SANS_ECHAPPEMENT },
  );
  let regle = t(
    'collectiviteCanaux.membres.regleCanal',
    // eslint-disable-next-line max-len
    'Un club rattaché y entre avec ses dirigeants ; un club détaché en sort. Les entraîneurs, les joueurs et les parents n’y sont pas.',
  );
  if (estPrivee) {
    sousTitre = t('collectiviteCanaux.membres.sousTitrePrivee', '{{club}} · {{ville}}', {
      club: String(fil?.club?.name || ''),
      ville: villeNom,
      ...SANS_ECHAPPEMENT,
    });
    regle = t(
      'collectiviteCanaux.membres.reglePrivee',
      'Seuls la Ville et les dirigeants de ce club lisent cette conversation.',
    );
  } else if (estLibre) {
    sousTitre = villeNom;
    regle = t(
      'collectiviteCanaux.membres.regleLibre',
      'Seules les personnes choisies par la Ville lisent cette conversation. Jamais un mineur.',
    );
  }
  return (
    <View style={{ gap: 8 }} testID="canal-membres-liste">
      <Text style={[Fonts.p3, Fonts.neutral300]} testID="canal-membres-sous-titre">
        {sousTitre}
      </Text>
      {(Array.isArray(fil?.groupes) ? fil.groupes : []).map((/** @type {any} */ groupe) => {
        const membres = Array.isArray(groupe?.membres) ? groupe.membres : [];
        return (
          <View key={`${groupe?.cle}-${groupe?.club?.documentId || 'ville'}`} style={{ gap: 4 }}>
            <View style={[Alignments.row, Alignments.alignCenter, { gap: 10, marginTop: 6 }]}>
              {groupe?.cle === 'ville'
                ? <EcussonVille nom={villeNom} taille={28} />
                : <ClubLogoMark club={groupe?.club} isNeutral name={groupe?.nom} size={28} />}
              <Text
                accessibilityRole="header"
                style={[
                  Fonts.p3Bold,
                  Fonts.neutral300,
                  { letterSpacing: 0.8, textTransform: 'uppercase' },
                ]}
              >
                {groupe?.nom}
              </Text>
            </View>
            {membres.length === 0 ? (
              <Text style={[Fonts.p3, Fonts.neutral300]}>
                {t(
                  'collectiviteCanaux.membres.aucunDirigeant',
                  'Aucun dirigeant sur l’app pour l’instant.',
                )}
              </Text>
            ) : membres.map((/** @type {any} */ membre, /** @type {number} */ index) => (
              <LigneMembre
                espaceVille={espaceVille}
                key={[membre?.fonction, membre?.lastname, membre?.firstname, index].join('-')}
                membre={membre}
              />
            ))}
          </View>
        );
      })}
      <View
        style={[
          Spaces.padding[16],
          { backgroundColor: withAlpha(Colors.neutral00, 0.06), borderRadius: 16, marginTop: 12 },
        ]}
      >
        <Text style={[Fonts.p3, Fonts.neutral100]} testID="canal-membres-regle">
          {regle}
        </Text>
      </View>
    </View>
  );
}

/**
 * 🏛️ « DANS CE CANAL » — COLL-C4A2 (02/10/2026), planche P3c-canal-tel écran 2 (et la colonne
 * de droite de P3c-canal-ordi) du design validé HY521H1 page 3.
 *
 * La liste SE CALCULE (le serveur la rend : `GET /chats/:id/collectivite-membres`) : les
 * gestionnaires de la Ville, puis chaque club rattaché et ses dirigeants. Ni « Ajouter » ni
 * « Retirer » : on ne la tient pas à la main. Un compte mixte y figure deux fois, une par rôle.
 * Des encadrants nommés (décision « nom B »), jamais un joueur, un parent ni un enfant.
 * Paramètres de route : `chatId`, et `espace: 'ville'` (la mairie : « vous »).
 * @returns {import('react').ReactElement} L'écran.
 */
function CollectiviteCanalMembres() {
  const { t } = useTranslation();
  const { Alignments, Fonts, Spaces } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const route = useRoute();
  const params = /** @type {{ chatId?: string, espace?: string } | undefined} */ (route?.params);
  const chatId = params?.chatId || null;
  const espaceVille = params?.espace === 'ville';
  const lecture = useMembresDuFil(chatId);
  const fil = lecture.data;
  const estPrivee = fil?.chat?.type === CONVERSATION_CLUB;

  useEffect(() => {
    if (!fil?.chat) return;
    navigation.setOptions?.({
      headerTitle: estPrivee
        ? t('collectiviteCanaux.membres.titrePrivee', 'Dans cette conversation')
        : t('collectiviteCanaux.membres.titreCanal', 'Dans ce canal'),
    });
  }, [estPrivee, fil?.chat, navigation, t]);

  let contenu;
  if (lecture.isLoading) {
    contenu = <Loader />;
  } else if (estRefusDuFilDeLaVille(lecture.error)) {
    contenu = <FilDeLaVilleQuitte onRetour={() => navigation.goBack()} />;
  } else if (lecture.error || !fil) {
    contenu = (
      <Text
        accessibilityRole="alert"
        style={[Fonts.p2, Fonts.neutral200]}
        testID="canal-membres-erreur"
      >
        {getErrorMessage(/** @type {any} */ (lecture.error))}
      </Text>
    );
  } else {
    contenu = <ListeDesMembresDuFil espaceVille={espaceVille} fil={fil} />;
  }

  return (
    <ScreenContainer
      bgImage="bg2"
      bottomInsetMode="screen"
      contentContainerStyle={[Spaces.paddingTop[0], Spaces.paddingBottom[24], Alignments.fill]}
    >
      <ScrollView
        contentContainerStyle={{ gap: 8, paddingBottom: 24, paddingTop: 12 }}
        showsVerticalScrollIndicator={false}
        style={[Alignments.fill]}
        testID="canal-membres"
      >
        {contenu}
      </ScrollView>
    </ScreenContainer>
  );
}

export default CollectiviteCanalMembres;
