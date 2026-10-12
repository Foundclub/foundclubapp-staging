import { useRoute } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  aujourdhui,
  avecMarqueUtf8,
  dimancheDe,
  dureeLisible,
  installationParDefaut,
  largeurBarre,
  lundiDecale,
  lundiDeMaintenant,
  nomDuFichierAffiche,
  nomDuFichierAfficheSaison,
  nomDuFichierExporte,
  PERIODES_CHIFFRES,
  phraseDelai,
  phraseDemandes,
  phraseSeancesDesClubs,
  phraseSeancesTenues,
  tauxLisible,
} from '@/domains/collectivite/collectiviteChiffres';
import { findManagedCollectivite } from '@/domains/collectivite/collectiviteDisplay';
import { formatPeriod } from '@/domains/seasonSlot/seasonSlotDisplay';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Loader from '@/components/atoms/loader/Loader';
import { SvgIcon } from '@/components/atoms/SvgIcon/SvgIcon';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import SegmentedControl from '@/components/molecules/segmentedControl/SegmentedControl';
import ScreenContainer from '@/components/templates/ScreenContainer';

import {
  useCollectiviteChiffres,
  useMyCollectivites,
} from '@/services/collectivite/collectiviteQueries';
import {
  getCollectiviteChiffresExport,
  requeteAfficheInstallation,
} from '@/services/collectivite/collectiviteService';

// Résolution par suffixe de plateforme (`.native.js` / `.web.js`), comme `downloadRemoteFile` :
// le contrôle de types ne voit aucun fichier à ce chemin exact.
// @ts-ignore -- cf. ci-dessus
import { downloadRemoteFile } from '@/platform/media/downloadRemoteFile';
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
 * Une sortie du panneau « Exporter le planning » (design P5v3, écran B : `.radio-row`).
 * @param {{
 *   coche: boolean, detail: string, inactif?: boolean, onPress: () => void, testID: string,
 *   titre: string,
 * }} props
 * @returns {import('react').ReactElement} La sortie.
 */
function ChoixDeSortie({
  coche, detail, inactif = false, onPress, testID, titre,
}) {
  const { Colors, Fonts, Spaces } = useTheme();
  return (
    <TouchableOpacity
      accessibilityRole="radio"
      accessibilityState={{ checked: coche, disabled: inactif }}
      disabled={inactif}
      onPress={onPress}
      style={[
        Spaces.padding[12],
        {
          borderColor: coche ? Colors.primary500 : withAlpha(Colors.neutral00, 0.12),
          borderRadius: 12,
          borderWidth: 1,
          gap: 2,
          opacity: inactif ? 0.5 : 1,
        },
      ]}
      testID={testID}
    >
      <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{titre}</Text>
      <Text style={[Fonts.p3, Fonts.neutral300]}>{detail}</Text>
    </TouchableOpacity>
  );
}

/**
 * Une puce de choix du panneau de l'affiche : une installation (COLL-AFFICHE), une période
 * (COLL-AFFICHE-2, « La semaine » / « La saison »).
 * @param {{ choisie: boolean, libelle: string, onPress: () => void, testID: string }} props
 * @returns {import('react').ReactElement} La puce.
 */
function PuceDeChoix({
  choisie, libelle, onPress, testID,
}) {
  const { Colors, Fonts } = useTheme();
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected: choisie }}
      onPress={onPress}
      style={{
        backgroundColor: choisie
          ? withAlpha(Colors.primary500, 0.22)
          : withAlpha(Colors.neutral00, 0.05),
        borderColor: choisie
          ? Colors.primary500
          : withAlpha(Colors.neutral00, 0.12),
        borderRadius: 999,
        borderWidth: 1,
        justifyContent: 'center',
        minHeight: 36,
        paddingHorizontal: 14,
      }}
      testID={testID}
    >
      <Text style={[Fonts.p3Bold, Fonts.neutral00]}>{libelle}</Text>
    </TouchableOpacity>
  );
}

/**
 * La flèche « Semaine précédente » / « Semaine suivante » de l'affiche (COLL-AFFICHE).
 * @param {{ etiquette: string, icone: string, onPress: () => void }} props
 * @returns {import('react').ReactElement} Le bouton.
 */
function BoutonDeSemaine({ etiquette, icone, onPress }) {
  const { Alignments, Colors } = useTheme();
  return (
    <TouchableOpacity
      accessibilityLabel={etiquette}
      accessibilityRole="button"
      onPress={onPress}
      style={[
        Alignments.center,
        {
          borderColor: withAlpha(Colors.neutral00, 0.12),
          borderRadius: 12,
          borderWidth: 1,
          height: 44,
          width: 44,
        },
      ]}
    >
      <SvgIcon color={Colors.neutral00} height={14} name={icone} width={14} />
    </TouchableOpacity>
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
 * COLL-AFFICHE (03/10/2026, décision d'Adel « affiche A ») — l'autre sortie de l'écran B, « Une
 * affiche pour l'installation » : le PDF du planning d'UNE installation pour UNE semaine, que le
 * serveur fabrique (`GET /collectivites/:id/chiffres/affiche`, contrat §7 bis). Elle vient en
 * premier, cochée, comme sur la planche ; on choisit l'installation et la semaine, puis
 * « Télécharger ». COLL-AFFICHE-2 (03/10, « saison A ») : ou TOUTE LA SAISON (« La saison » : la
 * semaine type et ce qui change dans l'année, sans flèches de semaine).
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
    /** @type {{ enCours: boolean, erreur: string | null, ok: string | null }} */ ({
      enCours: false, erreur: null, ok: null,
    }),
  );
  // COLL-AFFICHE (03/10) — la sortie choisie, l'installation et le lundi de la semaine.
  const [sortie, setSortie] = useState(/** @type {'affiche' | 'tableau'} */ ('affiche'));
  const [installationChoisie, setInstallationChoisie] = useState(
    /** @type {string | null} */ (null),
  );
  const [lundi, setLundi] = useState(/** @type {string | null} */ (null));
  // COLL-AFFICHE-2 (03/10) — l'affiche d'une semaine, ou de toute la saison.
  const [etendue, setEtendue] = useState(/** @type {'semaine' | 'saison'} */ ('semaine'));
  // 🎨 FINITIONS13-COLL (04/10) — le message d'un téléchargement parle de CE choix : changer de
  // sortie, d'installation, de période ou de semaine l'efface (tournée T12, CAF_4b : « Affiche
  // enregistrée » restait sous « Un tableau pour le service »).
  const choisir = (/** @type {() => void} */ geste) => {
    geste();
    setExportEtat((avant) => (avant.ok || avant.erreur
      ? { enCours: avant.enCours, erreur: null, ok: null }
      : avant));
  };
  const installations = Array.isArray(data?.installations) ? data.installations : [];
  const installation = installations.find(
    (/** @type {any} */ i) => i?.documentId === installationChoisie,
  ) || null;
  const ouvrirExport = () => {
    setExportEtat({ enCours: false, erreur: null, ok: null });
    // L'affiche d'abord, comme la planche, sur l'installation la plus utilisée ; le tableau seul
    // s'il n'y a aucune installation. La semaine : celle des chiffres (lue à Paris par le
    // serveur) quand la page lit une semaine, sinon celle où l'on est.
    const parDefaut = installationParDefaut(data?.installations);
    setSortie(parDefaut ? 'affiche' : 'tableau');
    setInstallationChoisie(parDefaut?.documentId || null);
    setLundi((periode === 'semaine' && lundiDecale(data?.from)) || lundiDeMaintenant());
    setEtendue('semaine');
    setExportOuvert(true);
  };
  const telechargerTableau = async () => {
    const fichier = nomDuFichierExporte(collectivite?.name, periode, data?.from);
    setExportEtat({ enCours: true, erreur: null, ok: null });
    try {
      const csv = await getCollectiviteChiffresExport(String(collectiviteId), periode);
      await saveTextFile({ contenu: avecMarqueUtf8(csv), fileName: fichier, mimeType: 'text/csv' });
      setExportEtat({
        enCours: false,
        erreur: null,
        ok: t('collectiviteChiffres.export.ok', 'Tableau enregistré : {{fichier}}', {
          fichier,
          ...SANS_ECHAPPEMENT,
        }),
      });
    } catch {
      setExportEtat({
        enCours: false,
        erreur: t('collectiviteChiffres.export.erreur', 'Le tableau n’a pas pu être téléchargé.'),
        ok: null,
      });
    }
  };
  // Le PDF vient d'une route GARDÉE : `downloadRemoteFile` le rapatrie avec le jeton du compte.
  const telechargerAffiche = async () => {
    if (!installation) return;
    // La saison : celle d'aujourd'hui, comme le serveur (aucune date envoyée).
    const saison = etendue === 'saison';
    if (!saison && !lundi) return;
    const fichier = saison
      ? nomDuFichierAfficheSaison(installation.name, aujourdhui())
      : nomDuFichierAffiche(installation.name, String(lundi));
    setExportEtat({ enCours: true, erreur: null, ok: null });
    try {
      const { headers, url } = requeteAfficheInstallation(
        String(collectiviteId),
        saison
          ? { installation: installation.documentId, periode: 'saison' }
          : { installation: installation.documentId, semaine: String(lundi) },
      );
      await downloadRemoteFile({
        fileName: fichier, headers, mimeType: 'application/pdf', url,
      });
      setExportEtat({
        enCours: false,
        erreur: null,
        ok: t('collectiviteChiffres.affiche.ok', 'Affiche enregistrée : {{fichier}}', {
          fichier,
          ...SANS_ECHAPPEMENT,
        }),
      });
    } catch {
      setExportEtat({
        enCours: false,
        erreur: t('collectiviteChiffres.affiche.erreur', 'L’affiche n’a pas pu être téléchargée.'),
        ok: null,
      });
    }
  };
  const telecharger = () => (sortie === 'affiche' ? telechargerAffiche() : telechargerTableau());

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
    // VILLE-T18B (e) (07/10) — sans horaires (retirés, décision d'Adel), pas de taux : la page dit
    // ce qui se mesure sans eux, comme l'accueil de la Ville. Plus de renvoi vers un champ retiré.
    const seancesDeLaPeriode = lignes.reduce(
      (/** @type {number} */ somme, /** @type {any} */ l) => somme + (Number(l?.seances) || 0),
      0,
    );
    const sansTaux = (/** @type {unknown} */ taux) => taux === null || taux === undefined;
    let phraseSansHoraires = t(
      'collectiviteChiffres.clubs.aucune',
      'Aucune séance sur la période.',
    );
    if (seancesDeLaPeriode > 0) {
      phraseSansHoraires = t('collectiviteChiffres.installations.reservees', {
        count: seancesDeLaPeriode,
        defaultValue_one: '{{count}} séance · {{duree}} réservées sur la période.',
        defaultValue_other: '{{count}} séances · {{duree}} réservées sur la période.',
        duree: dureeLisible(data?.ville?.minutes),
        ...SANS_ECHAPPEMENT,
      });
    }
    // 🕛 VILLE-TAUX-24H (12/10, Adel « Sur 24 h ») : sans horaires, le serveur compte la capacité
    // sur 24 h par jour et pose `sur24h` sur la ligne ; la phrase du taux le dit.
    const mesurees = lignes.filter(
      (/** @type {any} */ l) => typeof l?.capaciteMinutes === 'number',
    );
    const sur24h = mesurees.filter((/** @type {any} */ l) => l?.sur24h === true).length;
    let phraseTaux = t('collectiviteChiffres.installations.taux', 'Taux d’occupation : {{taux}}.', {
      taux: tauxLisible(tauxVille),
      ...SANS_ECHAPPEMENT,
    });
    if (sur24h === mesurees.length && sur24h > 0) {
      phraseTaux = t(
        'collectiviteChiffres.installations.taux24h',
        'Taux d’occupation : {{taux}}, calculé sur 24 h par jour.',
        { taux: tauxLisible(tauxVille), ...SANS_ECHAPPEMENT },
      );
    } else if (sur24h > 0) {
      phraseTaux = t(
        'collectiviteChiffres.installations.taux24hSansHoraires',
        'Taux d’occupation : {{taux}}, calculé sur 24 h par jour '
          + 'pour les installations sans horaires.',
        { taux: tauxLisible(tauxVille), ...SANS_ECHAPPEMENT },
      );
    }
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
            accessibilityLabel={sansTaux(ligne?.taux)
              ? t(
                'collectiviteChiffres.installations.a11ySansTaux',
                '{{nom}} : {{heures}} réservées',
                { heures: dureeLisible(ligne?.minutes), nom: ligne?.name, ...SANS_ECHAPPEMENT },
              )
              : t(
                ligne?.sur24h === true
                  ? 'collectiviteChiffres.installations.a11ySur24h'
                  : 'collectiviteChiffres.installations.a11y',
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
          {sansTaux(tauxVille) ? phraseSansHoraires : phraseTaux}
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
          <ChoixDeSortie
            coche={sortie === 'affiche'}
            detail={installation
              ? t(
                etendue === 'saison'
                  ? 'collectiviteChiffres.affiche.detailSaison'
                  : 'collectiviteChiffres.affiche.detail',
                etendue === 'saison'
                  ? 'PDF · la saison · {{installation}}'
                  : 'PDF · une semaine · {{installation}}',
                { installation: installation.name, ...SANS_ECHAPPEMENT },
              )
              : t(
                'collectiviteChiffres.affiche.sansInstallation',
                'PDF · une semaine · aucune installation pour l’instant',
              )}
            inactif={installations.length === 0}
            onPress={() => choisir(() => setSortie('affiche'))}
            testID="export-affiche"
            titre={t('collectiviteChiffres.affiche.titre', 'Une affiche pour l’installation')}
          />
          <ChoixDeSortie
            coche={sortie === 'tableau'}
            detail={t(
              'collectiviteChiffres.export.tableauDetail',
              'Tableur · toutes les séances · {{periode}}',
              { periode: intervalle, ...SANS_ECHAPPEMENT },
            )}
            onPress={() => choisir(() => setSortie('tableau'))}
            testID="export-tableau"
            titre={t('collectiviteChiffres.export.tableau', 'Un tableau pour le service')}
          />
          {sortie === 'affiche' && installation ? (
            <View style={{ gap: 8 }}>
              <Text style={[Fonts.p3Bold, Fonts.neutral300]}>
                {t('collectiviteChiffres.affiche.installation', 'Installation')}
              </Text>
              <View style={[Alignments.row, { flexWrap: 'wrap', gap: 8 }]}>
                {installations.map((/** @type {any} */ i) => (
                  <PuceDeChoix
                    choisie={i?.documentId === installationChoisie}
                    key={i?.documentId}
                    libelle={i?.name}
                    onPress={() => choisir(() => setInstallationChoisie(i?.documentId))}
                    testID={`affiche-installation-${i?.documentId}`}
                  />
                ))}
              </View>
              <Text style={[Fonts.p3Bold, Fonts.neutral300]}>
                {t('collectiviteChiffres.affiche.periode', 'Période')}
              </Text>
              <View style={[Alignments.row, { flexWrap: 'wrap', gap: 8 }]}>
                <PuceDeChoix
                  choisie={etendue === 'semaine'}
                  libelle={t('collectiviteChiffres.affiche.laSemaine', 'La semaine')}
                  onPress={() => choisir(() => setEtendue('semaine'))}
                  testID="affiche-periode-semaine"
                />
                <PuceDeChoix
                  choisie={etendue === 'saison'}
                  libelle={t('collectiviteChiffres.affiche.laSaison', 'La saison')}
                  onPress={() => choisir(() => setEtendue('saison'))}
                  testID="affiche-periode-saison"
                />
              </View>
              {etendue === 'semaine' ? (
                <>
                  <Text style={[Fonts.p3Bold, Fonts.neutral300]}>
                    {t('collectiviteChiffres.affiche.semaine', 'Semaine')}
                  </Text>
                  <View style={[Alignments.row, Alignments.alignCenter, { gap: 8 }]}>
                    <BoutonDeSemaine
                      etiquette={t(
                        'collectiviteChiffres.affiche.semainePrecedente',
                        'Semaine précédente',
                      )}
                      icone="arrow-left"
                      onPress={() => choisir(() => setLundi((l) => lundiDecale(l, -1)))}
                    />
                    <View
                      style={[
                        Alignments.row,
                        Alignments.alignCenter,
                        {
                          borderColor: withAlpha(Colors.neutral00, 0.12),
                          borderRadius: 12,
                          borderWidth: 1,
                          flex: 1,
                          gap: 8,
                          minHeight: 44,
                          paddingHorizontal: 12,
                        },
                      ]}
                    >
                      <SvgIcon color={Colors.primary200} height={14} name="calendar" width={14} />
                      <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                        {lundi ? formatPeriod(lundi, dimancheDe(lundi), { withYear: false }) : ''}
                      </Text>
                    </View>
                    <BoutonDeSemaine
                      etiquette={t(
                        'collectiviteChiffres.affiche.semaineSuivante',
                        'Semaine suivante',
                      )}
                      icone="arrow-right"
                      onPress={() => choisir(() => setLundi((l) => lundiDecale(l, 1)))}
                    />
                  </View>
                </>
              ) : null}
            </View>
          ) : null}
          <Text style={[Fonts.p3, Fonts.neutral300]}>
            {t(
              'collectiviteChiffres.export.prive',
              'On y lit le club et l’équipe, jamais le nom d’un membre.',
            )}
          </Text>
          {exportEtat.ok ? (
            <Text
              accessibilityLiveRegion="polite"
              style={[Fonts.p3Bold, { color: Colors.success200 }]}
            >
              {exportEtat.ok}
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
