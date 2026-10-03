import { useRoute } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';

import {
  avecMarqueUtf8,
  dureeLisible,
  largeurBarre,
  nomDuFichierExporte,
  PERIODES_CHIFFRES,
  phraseDelai,
  phraseDemandes,
  phraseSeancesDesClubs,
  phraseSeancesTenues,
  tauxLisible,
} from '@/domains/collectivite/collectiviteChiffres';
import { findManagedCollectivite } from '@/domains/collectivite/collectiviteDisplay';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Loader from '@/components/atoms/loader/Loader';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import SegmentedControl from '@/components/molecules/segmentedControl/SegmentedControl';
import ScreenContainer from '@/components/templates/ScreenContainer';

import {
  useCollectiviteChiffres,
  useMyCollectivites,
} from '@/services/collectivite/collectiviteQueries';
import { getCollectiviteChiffresExport } from '@/services/collectivite/collectiviteService';

// Résolution par suffixe de plateforme (`.native.js` / `.web.js`), comme `downloadRemoteFile` :
// le contrôle de types ne voit aucun fichier à ce chemin exact.
// @ts-ignore -- cf. ci-dessus
import { saveTextFile } from '@/platform/media/saveTextFile';
import { useIsDesktop } from '@/responsive';

/**
 * « 2026-09-28 » => « 28/09/2026 ».
 * @param {unknown} jour - Un jour AAAA-MM-JJ.
 * @returns {string} Le jour, ou '' s il est illisible.
 */
const dateCourte = (jour) => {
  const texte = String(jour || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texte)) return '';
  return `${texte.slice(8, 10)}/${texte.slice(5, 7)}/${texte.slice(0, 4)}`;
};

/**
 * Un bloc de la page (design P5v3 : `.bloc`) : un titre, puis son contenu.
 * @param {{ children: import('react').ReactNode, testID: string, titre: string }} props
 * @returns {import('react').ReactElement} Le bloc.
 */
function BlocDeChiffres({ children, testID, titre }) {
  const { Colors, Fonts, Spaces } = useTheme();
  const isDesktop = useIsDesktop();
  return (
    <View
      style={[
        Spaces.padding[16],
        {
          backgroundColor: withAlpha(Colors.neutral00, 0.04),
          borderColor: withAlpha(Colors.neutral00, 0.09),
          borderRadius: 16,
          borderWidth: 1,
          flexBasis: isDesktop ? '45%' : 'auto',
          flexGrow: 1,
          gap: 10,
        },
      ]}
      testID={testID}
    >
      <Text accessibilityRole="header" style={[Fonts.p1Bold, Fonts.primary200]}>{titre}</Text>
      {children}
    </View>
  );
}

/**
 * Une ligne à barre (design P5v3 : `.barre`) : le nom, la barre, la durée.
 * @param {{
 *   accessibilityLabel: string, couleur: string, largeur: number, nom: string, valeur: string,
 * }} props
 * @returns {import('react').ReactElement} La ligne.
 */
function LigneABarre({
  accessibilityLabel, couleur, largeur, nom, valeur,
}) {
  const { Alignments, Colors, Fonts } = useTheme();
  const isDesktop = useIsDesktop();
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessible
      style={[Alignments.row, Alignments.alignCenter, { gap: 12, minHeight: 28 }]}
    >
      <Text
        numberOfLines={2}
        style={[Fonts.p2Bold, Fonts.neutral00, { width: isDesktop ? 170 : 120 }]}
      >
        {nom}
      </Text>
      <View
        style={{
          backgroundColor: withAlpha(Colors.neutral00, 0.08),
          borderRadius: 5,
          flex: 1,
          height: 10,
          overflow: 'hidden',
        }}
      >
        <View style={{
          backgroundColor: couleur, borderRadius: 5, height: '100%', width: `${largeur}%`,
        }}
        />
      </View>
      <Text style={[Fonts.p2Bold, Fonts.neutral00, { minWidth: 56, textAlign: 'right' }]}>
        {valeur}
      </Text>
    </View>
  );
}

/**
 * 🏛️ LES CHIFFRES DE LA VILLE — COLL-C5 (03/10/2026), design HY521H1, page 5, point E
 * (« P5v3-chiffres », écrans A et B). Ce que le service des sports doit pouvoir dire au conseil
 * municipal : qui utilise quoi, combien d'heures.
 *
 * Quatre blocs, dans l'ordre de la planche : les heures de séances par installation (et le taux
 * d'occupation), les heures par club, les séances tenues, les demandes. Trois périodes. Sur
 * ordinateur, deux colonnes. « Exporter le planning… » : « Un tableau pour le service », le CSV de
 * toutes les séances de la période, que le serveur fabrique.
 *
 * Les nombres viennent TELS QUELS de `GET /collectivites/:id/chiffres` (contrat de chaque nombre :
 * admin/docs/CONTRAT_CHIFFRES_VILLE.md) ; l'écran met en mots, il ne recalcule rien. 🔒 Aucune
 * personne : des installations, des clubs, des nombres.
 *
 * CE QUI MANQUE, NOMMÉ : « Une affiche pour l'installation » (PDF d'une semaine, écran B) n'est pas
 * construite — il lui faut un gabarit du service de rendu des affiches (question posée au chef).
 * @returns {import('react').ReactElement} L'écran.
 */
function CollectiviteChiffres() {
  const { t } = useTranslation();
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const route = useRoute();
  const isDesktop = useIsDesktop();
  /** @typedef {{ collectiviteId?: string } | undefined} ParametresDesChiffres */
  const parametres = /** @type {ParametresDesChiffres} */ (route?.params);
  const collectiviteId = parametres?.collectiviteId || null;
  const [periode, setPeriode] = useState(/** @type {'semaine' | 'mois' | 'saison'} */ ('semaine'));
  const mine = useMyCollectivites();
  const collectivite = findManagedCollectivite(mine.data, collectiviteId);
  const chiffres = useCollectiviteChiffres(collectiviteId, periode);
  const data = /** @type {any} */ (chiffres.data) || null;

  const [exportOuvert, setExportOuvert] = useState(false);
  const [exportEtat, setExportEtat] = useState(
    /** @type {{ enCours: boolean, erreur: string | null, fichier: string | null }} */ ({
      enCours: false, erreur: null, fichier: null,
    }),
  );
  const ouvrirExport = () => {
    setExportEtat({ enCours: false, erreur: null, fichier: null });
    setExportOuvert(true);
  };
  const telecharger = async () => {
    const fichier = nomDuFichierExporte(collectivite?.name, periode, data?.from);
    setExportEtat({ enCours: true, erreur: null, fichier: null });
    try {
      const csv = await getCollectiviteChiffresExport(String(collectiviteId), periode);
      await saveTextFile({ contenu: avecMarqueUtf8(csv), fileName: fichier, mimeType: 'text/csv' });
      setExportEtat({ enCours: false, erreur: null, fichier });
    } catch {
      setExportEtat({
        enCours: false,
        erreur: t('collectiviteChiffres.export.erreur', 'Le tableau n’a pas pu être téléchargé.'),
        fichier: null,
      });
    }
  };

  const libellesPeriode = {
    mois: t('collectiviteChiffres.periodes.mois', 'Ce mois'),
    saison: t('collectiviteChiffres.periodes.saison', 'La saison'),
    semaine: t('collectiviteChiffres.periodes.semaine', 'Cette semaine'),
  };
  const intervalle = data?.from && data?.to
    ? t('collectiviteChiffres.periodes.intervalle', 'du {{from}} au {{to}}', {
      from: dateCourte(data.from),
      to: dateCourte(data.to),
      ...SANS_ECHAPPEMENT,
    })
    : libellesPeriode[periode];

  const renderInstallations = () => {
    const lignes = Array.isArray(data?.installations) ? data.installations : [];
    const maximum = Math.max(0, ...lignes.map((/** @type {any} */ l) => Number(l?.minutes) || 0));
    const tauxVille = data?.ville?.taux;
    return (
      <BlocDeChiffres
        testID="chiffres-installations"
        titre={t('collectiviteChiffres.installations.titre', 'Heures de séances, par installation')}
      >
        {lignes.length === 0 ? (
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            {t('collectiviteChiffres.installations.aucune', 'Aucune installation pour l’instant.')}
          </Text>
        ) : lignes.map((/** @type {any} */ ligne) => (
          <LigneABarre
            accessibilityLabel={t(
              'collectiviteChiffres.installations.a11y',
              '{{nom}} : {{heures}}, taux d’occupation {{taux}}',
              {
                heures: dureeLisible(ligne?.minutes),
                nom: ligne?.name,
                taux: tauxLisible(ligne?.taux),
                ...SANS_ECHAPPEMENT,
              },
            )}
            couleur={ligne?.planningColor || Colors.primary500}
            key={ligne?.documentId}
            largeur={largeurBarre(ligne?.minutes, maximum)}
            nom={ligne?.name}
            valeur={dureeLisible(ligne?.minutes)}
          />
        ))}
        <Text style={[Fonts.p3, Fonts.neutral300]}>
          {tauxVille === null || tauxVille === undefined
            ? t(
              'collectiviteChiffres.installations.tauxSansHoraires',
              'Taux d’occupation : — (horaires d’ouverture non renseignés).',
            )
            : t('collectiviteChiffres.installations.taux', 'Taux d’occupation : {{taux}}.', {
              taux: tauxLisible(tauxVille),
              ...SANS_ECHAPPEMENT,
            })}
        </Text>
      </BlocDeChiffres>
    );
  };

  const renderClubs = () => {
    const lignes = Array.isArray(data?.clubs) ? data.clubs : [];
    const maximum = Math.max(0, ...lignes.map((/** @type {any} */ l) => Number(l?.minutes) || 0));
    return (
      <BlocDeChiffres
        testID="chiffres-clubs"
        titre={t('collectiviteChiffres.clubs.titre', 'Heures, par club')}
      >
        {lignes.map((/** @type {any} */ ligne) => (
          <LigneABarre
            accessibilityLabel={`${ligne?.name} : ${dureeLisible(ligne?.minutes)}`}
            couleur={Colors.primary500}
            key={ligne?.documentId}
            largeur={largeurBarre(ligne?.minutes, maximum)}
            nom={ligne?.name}
            valeur={dureeLisible(ligne?.minutes)}
          />
        ))}
        <Text style={[Fonts.p3, Fonts.neutral300]}>{phraseSeancesDesClubs(t, data)}</Text>
      </BlocDeChiffres>
    );
  };

  const renderSeances = () => (
    <BlocDeChiffres
      testID="chiffres-seances"
      titre={t('collectiviteChiffres.seances.titre', 'Séances tenues')}
    >
      <Text style={[Fonts.p2, Fonts.neutral100]}>{phraseSeancesTenues(t, data?.seances)}</Text>
    </BlocDeChiffres>
  );

  const renderDemandes = () => (
    <BlocDeChiffres
      testID="chiffres-demandes"
      titre={t('collectiviteChiffres.demandes.titre', 'Demandes')}
    >
      <Text style={[Fonts.p2, Fonts.neutral100]}>{phraseDemandes(t, data?.demandes)}</Text>
      <Text style={[Fonts.p3, Fonts.neutral300]}>
        {phraseDelai(t, data?.demandes?.delaiMoyenJours)}
      </Text>
      <Text style={[Fonts.p3, Fonts.neutral300]}>
        {t(
          'collectiviteChiffres.demandes.unite',
          'Une demande « chaque semaine » compte une fois par date.',
        )}
      </Text>
    </BlocDeChiffres>
  );

  let contenu;
  if (chiffres.isLoading) {
    contenu = <Loader />;
  } else if (chiffres.error || !data) {
    contenu = (
      <View
        accessibilityRole="alert"
        style={[
          Spaces.padding[16],
          {
            backgroundColor: withAlpha(Colors.error500, 0.12),
            borderColor: withAlpha(Colors.error500, 0.4),
            borderRadius: 16,
            borderWidth: 1,
            gap: 8,
          },
        ]}
      >
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
          {t('collectiviteChiffres.erreur', 'Les chiffres n’ont pas pu être lus.')}
        </Text>
        <Button
          isOption
          onPress={() => chiffres.refetch?.()}
          size="sm"
          style={{ alignSelf: 'flex-start' }}
          title={t('collectiviteChiffres.reessayer', 'Réessayer')}
          variant="SecondaryLight"
        />
      </View>
    );
  } else {
    contenu = (
      <View style={[isDesktop ? Alignments.row : null, { flexWrap: 'wrap', gap: 16 }]}>
        {renderInstallations()}
        {renderClubs()}
        {renderSeances()}
        {renderDemandes()}
      </View>
    );
  }

  return (
    <ScreenContainer
      bgImage="bg2"
      bottomInsetMode="screen"
      contentContainerStyle={[Spaces.paddingTop[0], Spaces.paddingBottom[24], Alignments.fill]}
    >
      <ScrollView
        contentContainerStyle={{ gap: 16, paddingBottom: 24, paddingTop: 12 }}
        refreshControl={(
          <RefreshControl
            colors={[Colors.primary500]}
            onRefresh={() => chiffres.refetch?.()}
            refreshing={Boolean(chiffres.isRefetching)}
            tintColor={Colors.primary500}
          />
        )}
        showsVerticalScrollIndicator={false}
        style={[Alignments.fill]}
      >
        <View style={{ gap: 2 }}>
          <Text style={[Fonts.p3Bold, Fonts.primary200, { letterSpacing: 0.5 }]}>
            {t('collectiviteChiffres.surtitre', 'Planning')}
          </Text>
          <Text accessibilityRole="header" style={[Fonts.h2Black, Fonts.neutral00]}>
            {t('collectiviteChiffres.titre', 'Chiffres')}
          </Text>
        </View>
        <View
          style={[
            isDesktop ? Alignments.row : null,
            isDesktop ? Alignments.alignCenter : null,
            { gap: 12 },
          ]}
        >
          <View style={isDesktop ? { flex: 1 } : null}>
            <SegmentedControl
              onChange={(/** @type {string} */ valeur) => setPeriode(
                /** @type {'semaine' | 'mois' | 'saison'} */ (
                  PERIODES_CHIFFRES.includes(/** @type {any} */ (valeur)) ? valeur : 'semaine'
                ),
              )}
              options={PERIODES_CHIFFRES.map((valeur) => ({
                label: libellesPeriode[valeur],
                value: valeur,
              }))}
              value={periode}
            />
          </View>
          <Button
            isOption
            onPress={ouvrirExport}
            size="sm"
            style={{ alignSelf: isDesktop ? 'center' : 'flex-start' }}
            title={t('collectiviteChiffres.export.bouton', 'Exporter le planning…')}
            variant="SecondaryLight"
          />
        </View>
        {contenu}
      </ScrollView>
      <BottomModal
        close={() => setExportOuvert(false)}
        isVisible={exportOuvert}
        webPresentation="dialog"
      >
        <View style={[Spaces.paddingHorizontal[16], Spaces.paddingBottom[16], { gap: 12 }]}>
          <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00]}>
            {t('collectiviteChiffres.export.titre', 'Exporter le planning')}
          </Text>
          <Text style={[Fonts.p3Bold, Fonts.neutral300]}>
            {t('collectiviteChiffres.export.pourQuoi', 'Pour quoi faire')}
          </Text>
          <View
            accessibilityRole="radio"
            accessibilityState={{ checked: true }}
            style={[
              Spaces.padding[12],
              {
                borderColor: Colors.primary500,
                borderRadius: 12,
                borderWidth: 1,
                gap: 2,
              },
            ]}
          >
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
              {t('collectiviteChiffres.export.tableau', 'Un tableau pour le service')}
            </Text>
            <Text style={[Fonts.p3, Fonts.neutral300]}>
              {t(
                'collectiviteChiffres.export.tableauDetail',
                'Tableur · toutes les séances · {{periode}}',
                { periode: intervalle, ...SANS_ECHAPPEMENT },
              )}
            </Text>
          </View>
          <Text style={[Fonts.p3, Fonts.neutral300]}>
            {t(
              'collectiviteChiffres.export.prive',
              'On y lit le club et l’équipe, jamais le nom d’un membre.',
            )}
          </Text>
          {exportEtat.fichier ? (
            <Text
              accessibilityLiveRegion="polite"
              style={[Fonts.p3Bold, { color: Colors.success200 }]}
            >
              {t('collectiviteChiffres.export.ok', 'Tableau enregistré : {{fichier}}', {
                fichier: exportEtat.fichier,
                ...SANS_ECHAPPEMENT,
              })}
            </Text>
          ) : null}
          {exportEtat.erreur ? (
            <Text accessibilityRole="alert" style={[Fonts.p3Bold, { color: Colors.error300 }]}>
              {exportEtat.erreur}
            </Text>
          ) : null}
          <Button
            disabled={exportEtat.enCours || !data}
            isLoading={exportEtat.enCours}
            onPress={telecharger}
            title={t('collectiviteChiffres.export.telecharger', 'Télécharger')}
            variant="Primary"
          />
        </View>
      </BottomModal>
    </ScreenContainer>
  );
}

export default CollectiviteChiffres;
