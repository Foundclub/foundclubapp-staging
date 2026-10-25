import { useRoute } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import {
  aujourdhuiAParis,
  depuisJourIso,
  jourCourt,
  joursLisibles,
  messageDeRefusResa,
  motifDeLaFermeture,
  MOTIFS_DE_FERMETURE,
  regrouperFermetures,
  versJourIso,
} from '@/domains/complexe/complexeReservation';
import { texteHeure } from '@/domains/complexe/complexeTerrain';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import DatePickerInput from '@/components/molecules/datePickerInput/DatePickerInput';
import Input from '@/components/molecules/input/Input';
import ScreenContainer from '@/components/templates/ScreenContainer';
import BandeauComplexe from '@/views/complexe/components/BandeauComplexe';
import PastillesReservation from '@/views/complexe/components/PastillesReservation';

import {
  useApercuFermeture,
  useComplexeChoisi,
  useFermerTerrains,
  useFermetures,
  useModifierFermetures,
  useRouvrirFermetures,
  useTerrains,
} from '@/services/complexe/complexeQueries';

import { useIsDesktop } from '@/responsive';

/**
 * E-G10 — LES FERMETURES EXCEPTIONNELLES — RESA-L5A2 (14/10/2026), planche EG10 : l'écran de la
 * Ville (`CollectiviteFermeture`) repris pour un complexe. En haut, les fermetures à venir (une
 * ligne par geste : « 25/10 – 26/10 · Travaux », « Terrain 1, Terrain 2 », en cours ou à venir,
 * « Rouvrir ») ; puis « Nouvelle fermeture » : terrains (cases, « Tous »), du … au …, motif
 * (Travaux · Jour férié · Météo · Autre), mot aux joueurs ; dès que terrains et jours sont
 * choisis, le bloc
 * d'impact (« 4 réservations sont touchées. Elles seront annulées et les joueurs prévenus. »,
 * « Voir lesquelles ») ; « Fermer et prévenir », ou « Fermer » sans impact. UNE fermeture PAR
 * terrain (règle d'app du contrat L2A) ; le serveur annule les réservations touchées et prévient
 * leurs joueurs (N-19).
 * RESA-L5B-1, partie B (serveur RESA-L2C) : « Voir lesquelles » dit la source de chaque réservation
 * (App / Extérieur) et, s'il y en a une notée à l'extérieur, qu'il faut appeler le client.
 * Pas fait (dit dans le compte rendu du lot) : « 1 collecte en cours s'arrêtera » (collecte, lot
 * L3) ; modifier une fermeture (rouvrir puis refermer) ; le panneau à droite du planning sur
 * ordinateur (deux colonnes à la place).
 * Paramètres de route : `complexeId`, `terrainId` (le terrain coché d'avance, depuis E-G07 /
 * E-G09).
 * Caché par `COMPLEXES_GERANT`.
 * @returns {import('react').ReactElement} L'écran.
 */
function ComplexeFermetures() {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const route = useRoute();
  const params = /** @type {{ complexeId?: string, terrainId?: string } | undefined} */ (
    route?.params
  );
  const { complexe, complexeId } = useComplexeChoisi(params?.complexeId);
  const surOrdinateur = useIsDesktop();
  const terrainsLus = useTerrains(complexeId);
  const terrains = Array.isArray(terrainsLus.data) ? terrainsLus.data : [];
  const tousLesIds = terrains.map((terrain) => String(terrain.documentId));
  const lecture = useFermetures(complexeId, tousLesIds);
  const fermer = useFermerTerrains();
  const rouvrir = useRouvrirFermetures();
  const modifier = useModifierFermetures();

  const [choisis, setChoisis] = useState(/** @type {string[]} */ (
    params?.terrainId ? [params.terrainId] : []
  ));
  const [du, setDu] = useState('');
  const [au, setAu] = useState('');
  const [motif, setMotif] = useState('');
  const [mot, setMot] = useState('');
  const [voir, setVoir] = useState(false);
  const [message, setMessage] = useState('');
  const [erreur, setErreur] = useState('');
  const [aRouvrir, setARouvrir] = useState(/** @type {any} */ (null));
  // RESA-FIN-APP-2 (plan E-G10 §4) : la ligne en cours de modification ; le formulaire est le même.
  const [enEdition, setEnEdition] = useState(/** @type {any} */ (null));

  const debut = versJourIso(du);
  const fin = versJourIso(au);
  const dates = debut && fin ? { endDate: fin, startDate: debut } : null;
  const terrainsChoisis = tousLesIds.filter((id) => choisis.includes(id));
  const apercu = useApercuFermeture(complexeId, terrainsChoisis, dates);
  const touchees = apercu.data;
  const pret = terrainsChoisis.length > 0 && Boolean(dates) && debut <= fin && Boolean(motif);
  const fermetures = Array.isArray(lecture.data) ? lecture.data : [];
  const lignes = regrouperFermetures(t, fermetures, terrains, aujourdhuiAParis());
  const nomDuTerrain = (/** @type {string} */ id) => String(
    terrains.find((terrain) => terrain.documentId === id)?.name || '',
  );

  const carte = {
    backgroundColor: withAlpha(Colors.primary700, 0.45),
    borderColor: withAlpha(Colors.primary500, 0.5),
    borderRadius: 16,
    borderWidth: 1,
  };
  const legende = (/** @type {string} */ texte) => (
    <Text style={[Fonts.p3Bold, Fonts.primary200, { letterSpacing: 0.5 }]}>
      {texte.toUpperCase()}
    </Text>
  );
  const caseACocher = (
    /** @type {string} */ cle,
    /** @type {string} */ libelle,
    /** @type {boolean} */ coche,
    /** @type {() => void} */ onPress,
  ) => (
    <TouchableOpacity
      accessibilityRole="checkbox"
      accessibilityState={{ checked: coche }}
      key={cle}
      onPress={onPress}
      style={[
        Alignments.justifyCenter,
        {
          backgroundColor: coche ? withAlpha(Colors.primary500, 0.2) : 'transparent',
          borderColor: coche ? Colors.primary500 : withAlpha(Colors.primary500, 0.4),
          borderRadius: 999,
          borderWidth: 1,
          minHeight: 44,
          paddingHorizontal: 14,
        },
      ]}
      testID={cle}
    >
      <Text style={[Fonts.p3Bold, coche ? Fonts.neutral00 : Fonts.primary200]}>{libelle}</Text>
    </TouchableOpacity>
  );

  const viderLeFormulaire = () => {
    setDu('');
    setAu('');
    setMotif('');
    setMot('');
    setVoir(false);
    setEnEdition(null);
  };
  const commencerLaModification = (/** @type {any} */ ligne) => {
    setMessage('');
    setErreur('');
    setChoisis(ligne.terrainIds);
    setDu(depuisJourIso(ligne.debut));
    setAu(depuisJourIso(ligne.fin));
    setMotif(motifDeLaFermeture(t, ligne));
    setMot(String(ligne.message || ''));
    setVoir(false);
    setEnEdition(ligne);
  };

  // RESA-FIN-APP-2 — « Modifier » : chaque fermeture du geste prend les jours, le motif, le mot.
  const modifierLesJours = async (
    /** @type {any} */ choix,
    /** @type {string} */ texteDuMot,
  ) => {
    if (!dates || !enEdition) return;
    const avecMot = texteDuMot ? { message: texteDuMot } : {};
    const motEfface = !texteDuMot && enEdition.message ? { message: null } : {};
    try {
      const bilan = await modifier.mutateAsync({
        fermeture: {
          ...dates, ...choix.corps(t), ...avecMot, ...motEfface,
        },
        fermetureIds: enEdition.ids,
      });
      const jours = joursLisibles(debut, fin);
      setMessage(bilan?.annulees
        ? t(
          'complexeReservations.fermetures.modifieEtPrevenu',
          'Modifié : {{jours}}. {{count}} joueurs prévenus.',
          {
            count: bilan.annulees,
            defaultValue_one: 'Modifié : {{jours}}. {{count}} joueur prévenu.',
            defaultValue_other: 'Modifié : {{jours}}. {{count}} joueurs prévenus.',
            jours,
            ...SANS_ECHAPPEMENT,
          },
        )
        : t('complexeReservations.fermetures.modifie', 'Modifié : {{jours}}.', {
          jours, ...SANS_ECHAPPEMENT,
        }));
      if (bilan?.echecs?.length) {
        setErreur(t(
          'complexeReservations.fermetures.erreurModifier',
          'La fermeture n’a pas pu être modifiée.',
        ));
        // BH16 P13-15 : un échec garde le formulaire, pour réessayer.
        return;
      }
      viderLeFormulaire();
    } catch (refus) {
      setErreur(messageDeRefusResa(t, refus, t(
        'complexeReservations.fermetures.erreurModifier',
        'La fermeture n’a pas pu être modifiée.',
      )));
    }
  };

  // ── Fermer ─────────────────────────────────────────────────────────────────────────────
  const fermerLesJours = async () => {
    const choix = MOTIFS_DE_FERMETURE.find((option) => option.cle === motif);
    if (!pret || !choix || !dates) return;
    setErreur('');
    setMessage('');
    const texteDuMot = mot.replace(/\s+/g, ' ').trim();
    if (enEdition) {
      await modifierLesJours(choix, texteDuMot);
      return;
    }
    try {
      const bilan = await fermer.mutateAsync({
        fermeture: { ...dates, ...choix.corps(t), ...(texteDuMot ? { message: texteDuMot } : {}) },
        terrainIds: terrainsChoisis,
      });
      const jours = joursLisibles(debut, fin);
      const echecs = bilan?.echecs || [];
      // BH16 P13-15 : rien de fermé ⇒ pas de « Fermé » ; un échec garde le formulaire, avec les
      // seuls terrains à refaire.
      const rienDeFerme = echecs.length > 0 && echecs.length >= terrainsChoisis.length;
      if (!rienDeFerme) setMessage(bilan?.annulees
        ? t(
          'complexeReservations.fermetures.fermeEtPrevenu',
          'Fermé : {{jours}}. {{count}} joueurs prévenus.',
          {
            count: bilan.annulees,
            defaultValue_one: 'Fermé : {{jours}}. {{count}} joueur prévenu.',
            defaultValue_other: 'Fermé : {{jours}}. {{count}} joueurs prévenus.',
            jours,
            ...SANS_ECHAPPEMENT,
          },
        )
        : t(
          'complexeReservations.fermetures.ferme',
          'Fermé : {{jours}}.',
          { jours, ...SANS_ECHAPPEMENT },
        ));
      if (echecs.length) {
        const restes = echecs.map((/** @type {any} */ echec) => nomDuTerrain(echec.id));
        setErreur(t(
          'complexeReservations.fermetures.pasFerme',
          'Pas fermé : {{terrains}}. Réessaie pour eux.',
          {
            terrains: restes.join(', '),
            ...SANS_ECHAPPEMENT,
          },
        ));
        setChoisis(echecs.map((/** @type {any} */ echec) => echec.id));
        return;
      }
      viderLeFormulaire();
    } catch (refus) {
      setErreur(messageDeRefusResa(t, refus, t(
        'complexeReservations.fermetures.erreurFermer',
        'La fermeture n’a pas pu être posée.',
      )));
    }
  };

  const confirmerRouvrir = async () => {
    if (!aRouvrir) return;
    setErreur('');
    try {
      await rouvrir.mutateAsync(aRouvrir.ids);
      setMessage(t(
        'complexeReservations.fermetures.rouvert',
        'Rouvert : les créneaux sont libres.',
      ));
      setARouvrir(null);
    } catch (refus) {
      setErreur(messageDeRefusResa(t, refus, t(
        'complexeReservations.fermetures.erreurRouvrir',
        'La fermeture n’a pas pu être rouverte.',
      )));
      setARouvrir(null);
    }
  };

  // ── La liste à venir ───────────────────────────────────────────────────────────────────
  // RESA-FIN-APP-2 (plan E-G10 §5) : en cours, à venir, ou rouverte.
  const etatDeLaLigne = (/** @type {any} */ ligne) => {
    if (ligne.rouverte) {
      return {
        couleur: Colors.neutral200,
        texte: t('complexeReservations.fermetures.rouverte', 'Rouverte'),
      };
    }
    if (ligne.enCours) {
      return {
        couleur: Colors.warning500,
        texte: t('complexeReservations.fermetures.enCours', 'En cours'),
      };
    }
    return {
      couleur: Colors.primary200,
      texte: t('complexeReservations.fermetures.aVenir', 'À venir'),
    };
  };
  let liste;
  if (lecture.isLoading || terrainsLus.isLoading) {
    liste = (
      <View
        accessibilityState={{ busy: true }}
        style={[
          ApplicationStyle.borderRadius16,
          { backgroundColor: withAlpha(Colors.neutral00, 0.06), height: 96 },
        ]}
      />
    );
  } else if (lecture.error) {
    liste = (
      <View
        accessibilityRole="alert"
        style={[carte, Spaces.padding[16], {
          backgroundColor: withAlpha(Colors.error500, 0.08),
          borderColor: withAlpha(Colors.error500, 0.4),
          gap: 8,
        }]}
      >
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
          {t('complexeReservations.fermetures.erreur', 'Impossible de charger les fermetures.')}
        </Text>
        <View style={{ alignSelf: 'flex-start' }}>
          <Button
            onPress={() => lecture.refetch?.()}
            title={t('complexeGerant.accueil.reessayer', 'Réessayer')}
            variant="Secondary"
          />
        </View>
      </View>
    );
  } else if (!lignes.length) {
    liste = (
      <Text style={[Fonts.p2, Fonts.neutral200]}>
        {t('complexeReservations.fermetures.vide', 'Aucune fermeture prévue.')}
      </Text>
    );
  } else {
    liste = (
      <View style={{ gap: 12 }}>
        {lignes.map((ligne) => (
          <View key={ligne.cle} style={[carte, Spaces.padding[16], { gap: 8 }]}>
            <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
              {`${joursLisibles(ligne.debut, ligne.fin)} · ${ligne.motif}`}
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral100]}>{ligne.terrains.join(', ')}</Text>
            <View
              style={[
                Alignments.row, Alignments.alignCenter, { gap: 8, justifyContent: 'space-between' },
              ]}
            >
              <Text style={[Fonts.p3Bold, { color: etatDeLaLigne(ligne).couleur }]}>
                {etatDeLaLigne(ligne).texte}
              </Text>
              {ligne.rouverte ? null : (
                <View style={[Alignments.row, { gap: 8 }]}>
                  <View testID={`fermeture-modifier-${ligne.cle}`}>
                    <Button
                      onPress={() => commencerLaModification(ligne)}
                      size="sm"
                      title={t('complexeReservations.fermetures.modifier', 'Modifier')}
                      variant="Ghost"
                    />
                  </View>
                  <View testID={`fermeture-rouvrir-${ligne.cle}`}>
                    <Button
                      onPress={() => setARouvrir(ligne)}
                      size="sm"
                      title={t('complexeReservations.fermetures.rouvrir', 'Rouvrir')}
                      variant="Secondary"
                    />
                  </View>
                </View>
              )}
            </View>
          </View>
        ))}
      </View>
    );
  }

  // ── Le bloc d'impact ───────────────────────────────────────────────────────────────────
  let impact = null;
  if (terrainsChoisis.length && dates && touchees) {
    impact = touchees.count ? (
      <View
        style={[carte, Spaces.padding[16], {
          backgroundColor: withAlpha(Colors.warning500, 0.1),
          borderColor: withAlpha(Colors.warning500, 0.5),
          gap: 6,
        }]}
      >
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
          {t('complexeReservations.fermetures.touchees', '{{count}} réservations sont touchées.', {
            count: touchees.count,
            defaultValue_one: '{{count}} réservation est touchée.',
            defaultValue_other: '{{count}} réservations sont touchées.',
            ...SANS_ECHAPPEMENT,
          })}
        </Text>
        <Text style={[Fonts.p2, Fonts.neutral100]}>
          {t('complexeReservations.fermetures.toucheesDit', {
            count: touchees.count,
            defaultValue_one: 'Elle sera annulée et les joueurs prévenus.',
            defaultValue_other: 'Elles seront annulées et les joueurs prévenus.',
          })}
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ expanded: voir }}
          onPress={() => setVoir(!voir)}
          style={[Alignments.justifyCenter, { alignSelf: 'flex-start', minHeight: 44 }]}
          testID="fermeture-voir-lesquelles"
        >
          <Text style={[Fonts.p2Bold, Fonts.primary500]}>
            {t('complexeReservations.fermetures.voirLesquelles', 'Voir lesquelles')}
          </Text>
        </TouchableOpacity>
        {voir ? (touchees.items || []).map((/** @type {any} */ item) => (
          <View
            key={item.documentId}
            style={[Alignments.row, Alignments.wrap, Alignments.alignCenter, { gap: 8 }]}
            testID={`fermeture-touchee-${item.documentId}`}
          >
            <Text style={[Fonts.p3, Fonts.neutral100, { flexShrink: 1 }]}>
              {[
                jourCourt(item.date),
                texteHeure(item.from),
                nomDuTerrain(item.terrainId),
                item.label,
              ].filter(Boolean).join(' · ')}
            </Text>
            {item.source ? <PastillesReservation sansEtat source={item.source} statut="" /> : null}
          </View>
        )) : null}
        {voir && (touchees.items || []).some((/** @type {any} */ item) => (
          item.source === 'exterieur'
        )) ? (
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {t(
              'complexeReservations.fermetures.exterieurAppeler',
              // eslint-disable-next-line max-len
              'Une réservation « extérieur » n’a personne à prévenir dans l’app : appelle le client.',
            )}
          </Text>
          ) : null}
        {voir && touchees.count > (touchees.items || []).length ? (
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {t('complexeReservations.fermetures.etDautres', 'et d’autres…')}
          </Text>
        ) : null}
      </View>
    ) : (
      <View style={[carte, Spaces.padding[16], { gap: 4 }]}>
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
          {t('complexeReservations.fermetures.aucuneTouchee', 'Aucune réservation touchée.')}
        </Text>
        <Text style={[Fonts.p2, Fonts.neutral100]}>
          {t('complexeReservations.fermetures.personne', 'Personne à prévenir.')}
        </Text>
      </View>
    );
  }

  // ── Le formulaire ──────────────────────────────────────────────────────────────────────
  let titreDuBouton = touchees?.count
    ? t('complexeReservations.fermetures.fermerEtPrevenir', 'Fermer et prévenir')
    : t('complexeReservations.fermetures.fermer', 'Fermer');
  if (enEdition) {
    titreDuBouton = t('complexeReservations.fermetures.enregistrerModification', 'Enregistrer');
  }
  const tousCoches = terrains.length > 0 && terrainsChoisis.length === terrains.length;
  const formulaire = (
    <View style={{ gap: 16 }}>
      <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00]}>
        {enEdition
          ? t('complexeReservations.fermetures.modifierTitre', 'Modifier la fermeture')
          : t('complexeReservations.fermetures.nouvelle', 'Nouvelle fermeture')}
      </Text>
      <View style={{ gap: 8 }}>
        {legende(t('complexeReservations.fermetures.terrains', 'Terrains concernés'))}
        <View style={[Alignments.row, Alignments.wrap, { gap: 8 }]}>
          {caseACocher(
            'fermeture-terrain-tous',
            t('complexeReservations.fermetures.tous', 'Tous'),
            tousCoches,
            () => setChoisis(tousCoches ? [] : tousLesIds),
          )}
          {terrains.map((terrain) => {
            const id = String(terrain.documentId);
            const coche = choisis.includes(id);
            return caseACocher(
              `fermeture-terrain-${id}`,
              String(terrain.name || ''),
              coche,
              () => setChoisis(coche ? choisis.filter((autre) => autre !== id) : [...choisis, id]),
            );
          })}
        </View>
      </View>
      <View style={[Alignments.row, { gap: 12 }]}>
        <View style={{ flex: 1 }}>
          <DatePickerInput
            label={t('complexeReservations.fermetures.du', 'Du')}
            minimumDate={new Date()}
            onChange={(/** @type {string} */ valeur) => {
              setDu(valeur);
              if (!au || versJourIso(au) < versJourIso(valeur)) setAu(valeur);
            }}
            value={du}
          />
        </View>
        <View style={{ flex: 1 }}>
          <DatePickerInput
            label={t('complexeReservations.fermetures.au', 'Au')}
            minimumDate={new Date()}
            onChange={(/** @type {string} */ valeur) => setAu(valeur)}
            value={au}
          />
        </View>
      </View>
      <View style={{ gap: 8 }}>
        {legende(t('complexeReservations.fermetures.motif', 'Motif'))}
        <View style={[Alignments.row, Alignments.wrap, { gap: 8 }]}>
          {MOTIFS_DE_FERMETURE.map((option) => caseACocher(
            `fermeture-motif-${option.cle}`,
            option.texte(t),
            motif === option.cle,
            () => setMotif(option.cle),
          ))}
        </View>
      </View>
      <Input
        label={t('complexeReservations.fermetures.mot', 'Mot aux joueurs (facultatif)')}
        onChangeText={setMot}
        placeholder={t('complexeReservations.fermetures.motExemple', 'Ex. : réfection du gazon')}
        value={mot}
      />
      {impact}
      <View testID="fermeture-fermer">
        <Button
          disabled={!pret || Boolean(fermer.isPending || modifier.isPending)}
          isLoading={Boolean(fermer.isPending || modifier.isPending)}
          onPress={fermerLesJours}
          title={titreDuBouton}
        />
      </View>
      {enEdition ? (
        <Button
          onPress={viderLeFormulaire}
          title={t(
            'complexeReservations.fermetures.annulerModification',
            'Annuler la modification',
          )}
          variant="Ghost"
        />
      ) : null}
    </View>
  );

  const aVenir = (
    <View style={{ gap: 12 }}>
      {legende(t('complexeReservations.fermetures.aVenirTitre', 'À venir'))}
      {liste}
    </View>
  );

  return (
    <ScreenContainer
      bgImage="bg2"
      bottomInsetMode="screen"
      contentContainerStyle={[Spaces.paddingTop[0], Alignments.fill]}
    >
      <ScrollView
        contentContainerStyle={{ gap: 16, paddingBottom: 24, paddingTop: 12 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={[Alignments.fill]}
      >
        <View style={{ gap: 4 }}>
          <Text style={[Fonts.p3Bold, Fonts.primary500, { letterSpacing: 0.6 }]}>
            {String(complexe?.name || '').toUpperCase()}
          </Text>
          <Text
            accessibilityRole="header"
            style={[Fonts.h2Black, Fonts.neutral00, { letterSpacing: 1 }]}
          >
            {t('complexeReservations.fermetures.titre', 'Fermetures').toUpperCase()}
          </Text>
        </View>
        {message ? <BandeauComplexe texte={message} ton="ok" /> : null}
        {erreur ? <BandeauComplexe texte={erreur} ton="erreur" /> : null}
        {surOrdinateur ? (
          <View style={[Alignments.row, { alignItems: 'flex-start', gap: 24 }]}>
            <View style={{ flex: 1 }}>{aVenir}</View>
            <View style={{ flex: 1 }}>{formulaire}</View>
          </View>
        ) : (
          <>
            {aVenir}
            {formulaire}
          </>
        )}
      </ScrollView>
      <BottomModal
        close={() => setARouvrir(null)}
        isVisible={Boolean(aRouvrir)}
        webPresentation="dialog"
      >
        <View style={{ gap: 16 }}>
          <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00]}>
            {aRouvrir ? t(
              'complexeReservations.fermetures.rouvrirQuestion',
              'Rouvrir {{terrains}} : {{jours}} ?',
              {
                jours: joursLisibles(aRouvrir.debut, aRouvrir.fin),
                terrains: aRouvrir.terrains.join(', '),
                ...SANS_ECHAPPEMENT,
              },
            ) : ''}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            {t(
              'complexeReservations.fermetures.rouvrirDit',
              'Les créneaux redeviennent libres. Les réservations annulées ne reviennent pas.',
            )}
          </Text>
          <View testID="fermeture-confirmer-rouvrir">
            <Button
              isLoading={Boolean(rouvrir.isPending)}
              onPress={confirmerRouvrir}
              title={t('complexeReservations.fermetures.rouvrir', 'Rouvrir')}
            />
          </View>
          <Button
            onPress={() => setARouvrir(null)}
            title={t('complexeReservations.feuille.annuler', 'Annuler')}
            variant="Ghost"
          />
        </View>
      </BottomModal>
    </ScreenContainer>
  );
}

export default ComplexeFermetures;
