import { useNavigation, useRoute } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  RefreshControl, ScrollView, Text, View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';
import SearchBar from '@/components/molecules/searchBar/SearchBar';
import ScreenContainer from '@/components/templates/ScreenContainer';
import BandeauComplexe from '@/views/complexe/components/BandeauComplexe';
import FeuillePartagerAnnonce from '@/views/complexe/components/FeuillePartagerAnnonce';
import LogoComplexe from '@/views/complexe/components/LogoComplexe';

import { RouteNames } from '@/navigation/routeNames';

import { useCanalDuComplexe, useComplexeChoisi } from '@/services/complexe/complexeQueries';

import { getServerErrorCode } from '@/utils/errors/displayError';
import { getZonedDateParts } from '@/utils/parisTime';

/**
 * « 02/10 », le jour de PARIS d'un instant.
 * @param {unknown} iso - L'instant.
 * @returns {string} Le jour, ou ''.
 */
const jourDe = (iso) => {
  const instant = new Date(String(iso || ''));
  if (!iso || Number.isNaN(instant.getTime())) return '';
  const parts = getZonedDateParts(instant);
  return `${String(parts.day).padStart(2, '0')}/${String(parts.month).padStart(2, '0')}`;
};

/**
 * Sans accent ni majuscule : la recherche d'un membre par son nom.
 * @param {unknown} texte - Le texte.
 * @returns {string} Le texte comparable.
 */
const comparable = (texte) => String(texte || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

/**
 * E-G12 — LE CANAL DU COMPLEXE, CÔTÉ GÉRANT — RESA-L5B-2 (20/10/2026), planche EG12 ; plan
 * :846-889 ; RG-CANAL, RC-T02, Q5, RG-MASSE ; serveur RESA-L4 (`GET /complexes/:id/canal`).
 * Le canal est un GROUPE de la messagerie, ouvert par le serveur, où seuls les gérants écrivent :
 * le gérant y écrit (texte, photo, sondage) par la conversation habituelle (« Écrire aux membres »,
 * `Conversation`) ; chaque message prévient les membres (N-30, avec la limite du serveur). Cet
 * écran en est l'entrée : « CANAL · <NOM> », le nombre de membres, la règle (« Tous les membres
 * seront prévenus. »), puis les MEMBRES (prénom + initiale, « Entré·e par une réservation · 02/10 »
 * ou « par les favoris » ; jamais un numéro, pas de « retirer » en V1) et leur recherche.
 * États : vide (« Ton canal est prêt… »), chargement, erreur, complexe suspendu (canal en pause).
 * Paramètre de route : `complexeId` (sinon SON complexe). Caché par `COMPLEXES_GERANT`.
 * @returns {import('react').ReactElement} L'écran.
 */
function ComplexeCanal() {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const route = useRoute();
  const params = /** @type {{ complexeId?: string } | undefined} */ (route?.params);
  const { complexe, complexeId } = useComplexeChoisi(params?.complexeId);
  const lecture = useCanalDuComplexe(complexeId);
  const [saisie, setSaisie] = useState('');
  // RESA-PARTAGER (A-G32, plan E-G12 :848) — « Partager une annonce » : la feuille, puis le
  // message « Annonce partagée dans ton canal. ».
  const [partageOuvert, setPartageOuvert] = useState(false);
  const [message, setMessage] = useState('');

  const carte = {
    backgroundColor: withAlpha(Colors.primary700, 0.45),
    borderColor: withAlpha(Colors.primary500, 0.5),
    borderRadius: 16,
    borderWidth: 1,
  };
  const nom = String(complexe?.name || '');
  const canal = lecture.data || null;
  const nombre = Number(canal?.membres) || 0;
  const membres = Array.isArray(canal?.liste) ? canal.liste : [];
  const cherche = comparable(saisie);
  const affiches = cherche
    ? membres.filter((/** @type {any} */ membre) => comparable(membre?.nom).includes(cherche))
    : membres;
  // RESA-FIN-SITE (21/10/2026) : `espace: 'complexe'` — sur le site, la conversation garde le menu
  // du complexe (AppShell, menuDuComplexe.ts) ; ailleurs, le paramètre ne change rien.
  const ecrire = () => {
    if (!canal?.chatId) return;
    navigation.navigate(RouteNames.Conversation, { chatId: canal.chatId, espace: 'complexe' });
  };

  const origineDe = (/** @type {any} */ membre) => {
    const jour = jourDe(membre?.depuis);
    if (membre?.via === 'reservation') {
      return t('complexeCanal.membres.parReservation', 'Entré·e par une réservation · {{jour}}', {
        jour, ...SANS_ECHAPPEMENT,
      });
    }
    if (membre?.via === 'favori') {
      return t('complexeCanal.membres.parFavori', 'Entré·e par les favoris · {{jour}}', {
        jour, ...SANS_ECHAPPEMENT,
      });
    }
    return '';
  };

  let corps;
  if (lecture.isLoading) {
    corps = (
      <View accessibilityState={{ busy: true }} style={{ gap: 12 }} testID="canal-squelette">
        {[120, 64, 64].map((hauteur, rang) => (
          <View
            // eslint-disable-next-line react/no-array-index-key -- des blocs vides, sans identité
            key={rang}
            style={[
              ApplicationStyle.borderRadius16,
              { backgroundColor: withAlpha(Colors.neutral00, 0.06), height: hauteur },
            ]}
          />
        ))}
      </View>
    );
  } else if (!canal) {
    const pause = getServerErrorCode(lecture.error) === 'COMPLEXE_CANAL_INACTIF';
    corps = (
      <View
        accessibilityRole="alert"
        style={[carte, Spaces.padding[16], {
          backgroundColor: withAlpha(pause ? Colors.warning500 : Colors.error500, 0.08),
          borderColor: withAlpha(pause ? Colors.warning500 : Colors.error500, 0.4),
          gap: 8,
        }]}
      >
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
          {pause
            ? t('complexeCanal.pause', 'Ton complexe est suspendu : son canal est en pause.')
            : t('complexeCanal.erreur', 'Impossible de charger ton canal.')}
        </Text>
        {pause ? null : (
          <View style={{ alignSelf: 'flex-start' }}>
            <Button
              onPress={() => lecture.refetch?.()}
              title={t('complexeGerant.accueil.reessayer', 'Réessayer')}
              variant="Secondary"
            />
          </View>
        )}
      </View>
    );
  } else {
    corps = (
      <View style={{ gap: 16 }}>
        <View style={[carte, Spaces.padding[16], { gap: 12 }]}>
          {nombre === 0 ? (
            <Text style={[Fonts.p2, Fonts.neutral00]} testID="canal-vide">
              {t(
                'complexeCanal.vide',
                'Ton canal est prêt. Écris ton premier message : il arrivera chez tous ceux qui '
                + 'réservent chez toi ou te mettent en favori.',
              )}
            </Text>
          ) : null}
          <View style={[Alignments.row, Alignments.alignCenter, { gap: 8 }]}>
            <GlyphIcon color={Colors.primary200} name="send" size={14} />
            <Text style={[Fonts.p3, Fonts.neutral200, { flex: 1 }]}>
              {t('complexeCanal.regle', 'Tous les membres seront prévenus.')}
            </Text>
          </View>
          <Button
            onPress={ecrire}
            title={t('complexeCanal.ecrire', 'Écrire aux membres')}
          />
          <View testID="canal-partager-annonce">
            <Button
              icon="share"
              iconPosition="before"
              onPress={() => {
                setMessage('');
                setPartageOuvert(true);
              }}
              title={t('complexeCanal.partager.titre', 'Partager une annonce')}
              variant="Secondary"
            />
          </View>
        </View>
        {membres.length ? (
          <View style={{ gap: 8 }} testID="canal-membres">
            <Text
              accessibilityRole="header"
              style={[Fonts.p3Bold, Fonts.primary200, { letterSpacing: 0.5 }]}
            >
              {t('complexeCanal.membres.titre', 'Membres').toUpperCase()}
            </Text>
            <SearchBar
              onChangeText={setSaisie}
              placeholder={t('complexeCanal.membres.chercher', 'Chercher un membre')}
              value={saisie}
              withCalendar={false}
              withFilter={false}
            />
            {affiches.map((/** @type {any} */ membre) => (
              <View
                key={membre.documentId}
                style={[Alignments.row, Alignments.alignCenter, { gap: 12, minHeight: 52 }]}
              >
                <View
                  style={[Alignments.alignCenter, Alignments.justifyCenter, {
                    backgroundColor: Colors.primary700, borderRadius: 999, height: 36, width: 36,
                  }]}
                >
                  <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
                    {String(membre.nom || '').split(/\s+/).map((mot) => mot.charAt(0)).join('')
                      .slice(0, 2)
                      .toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1, gap: 0 }}>
                  <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{String(membre.nom || '')}</Text>
                  <Text style={[Fonts.p3, Fonts.neutral200]}>{origineDe(membre)}</Text>
                </View>
              </View>
            ))}
            {nombre > membres.length ? (
              <Text style={[Fonts.p3, Fonts.neutral200]}>
                {t(
                  'complexeCanal.membres.plafond',
                  'Les {{affiches}} premiers membres sont affichés.',
                  { affiches: membres.length, ...SANS_ECHAPPEMENT },
                )}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <ScreenContainer
      bgImage="bg2"
      bottomInsetMode="screen"
      contentContainerStyle={[Spaces.paddingTop[0], Alignments.fill]}
    >
      <ScrollView
        contentContainerStyle={{
          alignSelf: 'center',
          gap: 16,
          maxWidth: 720,
          paddingBottom: 24,
          paddingTop: 12,
          width: '100%',
        }}
        keyboardShouldPersistTaps="handled"
        refreshControl={(
          <RefreshControl
            colors={[Colors.primary500]}
            onRefresh={() => lecture.refetch?.()}
            refreshing={Boolean(lecture.isRefetching)}
            tintColor={Colors.primary500}
          />
        )}
        showsVerticalScrollIndicator={false}
        style={[Alignments.fill]}
      >
        <View style={[Alignments.row, Alignments.alignCenter, { gap: 12 }]}>
          <LogoComplexe logo={complexe?.logo || null} nom={nom} taille={40} />
          <View style={{ flex: 1, gap: 0 }}>
            <Text accessibilityRole="header" style={[Fonts.p1Black, Fonts.neutral00]}>
              {t('complexeCanal.titre', 'Canal · {{nom}}', { nom, ...SANS_ECHAPPEMENT })
                .toUpperCase()}
            </Text>
            {canal ? (
              <Text style={[Fonts.p3, Fonts.primary200]}>
                {t('complexeCanal.nombre', '{{count}} membres', {
                  count: nombre,
                  defaultValue_one: '{{count}} membre',
                  defaultValue_other: '{{count}} membres',
                })}
              </Text>
            ) : null}
          </View>
        </View>
        {message ? <BandeauComplexe texte={message} ton="ok" /> : null}
        {corps}
      </ScrollView>
      {partageOuvert ? (
        <FeuillePartagerAnnonce
          complexeId={complexeId}
          onFait={(texte) => {
            setPartageOuvert(false);
            setMessage(texte);
          }}
          onFermer={() => setPartageOuvert(false)}
        />
      ) : null}
    </ScreenContainer>
  );
}

export default ComplexeCanal;
