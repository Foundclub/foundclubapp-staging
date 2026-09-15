export default {
  addClubManager: {
    alerts: {
      alreadyExist: {
        actions: {
          addToClub: 'Ajouter à la section',
          cancel: 'Annuler',
        },
        // eslint-disable-next-line max-len
        description: "Le détenteur de ce numéro de téléphone utilise déjà l'application sous le nom de {{firstname}} {{lastname}}. Veux-tu l'ajouter comme dirigeant à cette section ?",
        title: 'Un utilisateur existe déjà avec ce numéro de téléphone.',
      },
      alreadyInClub: {
        // eslint-disable-next-line max-len
        description: "Un utilisateur du nom de {{firstname}} {{lastname}} est déjà membre d'un autre club.",
        title: "Impossible d'ajouter ce dirigeant à la section",
      },
      success: {
        description: 'Le dirigeant {{managerName}} a bien été ajouté à cette section.',
        title: 'Ajout réussi !',
      },
    },
    titles: {
      main: 'Ajouter un dirigeant',
    },
  },
  addCoach: {
    actions: {
      invite: 'Inviter',
      save: 'Envoyer l\'invitation',
    },
    alerts: {
      alreadyExist: {
        actions: {
          addToClub: 'Ajouter au club',
          cancel: 'Annuler',
        },
        description: "Le détenteur de ce numéro de téléphone utilise l'application sous le nom de {{firstname}} {{lastname}}. Veux-tu l'ajouter à ton club ?",
        title: 'Un utilisateur existe déjà avec ce numéro de téléphone.',
      },
      alreadyInClub: {
        description: "Un utilisateur du nom de {{firstname}} {{lastname}} est déjà membre d'un autre club.",
        title: "Impossible d'ajouter cet·te entraîneur·e à l'équipe",
      },
      success: {
        description: "L'entraîneur·e {{trainerName}} a bien été ajouté·e à ton club.",
        title: 'Ajout réussi !',
      },
    },
    errors: {
      linkManager: "Impossible d'ajouter ce dirigeant à la section pour le moment.",
      linkTrainer: "Impossible d'ajouter cet entraîneur au club pour le moment.",
    },
    fallbacks: {
      clubName: 'Club',
      coachName: 'coach',
      inviteFirstname: 'Coach',
      managerName: 'dirigeant',
    },
    fields: {
      birthdate: {
        label: 'Date de naissance — optionnelle',
        placeholder: 'JJ/MM/AAAA',
      },
      firstname: {
        label: 'Prénom',
        placeholder: 'Luc',
      },
      lastname: {
        label: 'Nom',
        placeholder: 'Harne',
      },
      phoneNumber: {
        label: 'Numéro de téléphone — requis',
        placeholder: '+33612345678',
      },
      role: {
        label: 'Rôle',
      },
    },
    hints: {
      invitation: 'Une invitation SMS lui sera envoyée pour rejoindre le club.',
    },
    roles: {
      manager: 'Dirigeant·e',
      trainer: 'Entraîneur·e',
    },
    state: {
      loadError: {
        description: 'Impossible de charger ce club pour le moment.',
        retry: 'Réessayer',
        title: 'Ajout indisponible',
      },
      loading: {
        // eslint-disable-next-line max-len
        managerDescription: "Nous récupérons les informations de la section pour préparer l'ajout du dirigeant.",
        managerTitle: 'Chargement de la section',
        // eslint-disable-next-line max-len
        trainerDescription: "Nous récupérons les informations du club pour préparer l'ajout du coach.",
        trainerTitle: 'Chargement du club',
      },
      missingClub: {
        // eslint-disable-next-line max-len
        description: "Impossible d'ouvrir ce formulaire sans club valide. Reviens à la fiche club puis relance l'ajout.",
        title: 'Club introuvable',
      },
      notFound: {
        description: "Ce club est introuvable ou n'est plus accessible.",
        refresh: 'Actualiser',
      },
    },
    subtitles: {
      avatar: "Ajoute une photo de profil pour que l'on puisse reconnaître l'entraîneur·e facilement.",
      birthdate: "Renseigne la date de naissance de l'entraîneur·e.",
      name: "Renseigne le nom et prénom de l'entraîneur·e.",
    },
    titles: {
      birthdate: 'Quelle est sa date de naissance ?',
      main: 'Ajouter un·e entraîneur·e',
      name: "Comment s'appelle l'entraîneur·e ?",
    },
  },
  addSponsor: {
    actions: {
      save: 'Ajouter le partenaire',
    },
    errors: {
      save: "Impossible d'enregistrer ce sponsor pour le moment.",
    },
    fields: {
      link: {
        label: 'Lien vers le site du partenaire',
        placeholder: 'https://www.nike.com',
      },
      logo: 'Logo du partenaire',
      title: {
        label: 'Nom du partenaire',
        placeholder: 'Nike',
      },
    },
    hints: {
      visibility: 'Il apparaîtra sur les cartes équipe, les annonces et la page du club.',
    },
    state: {
      loadError: {
        clubDescription: 'Impossible de charger ce club pour le moment.',
        multisportDescription: 'Impossible de charger cette structure multisport pour le moment.',
        retry: 'Réessayer',
        title: 'Ajout indisponible',
      },
      loading: {
        clubDescription: 'Nous récupérons les informations du club.',
        multisportDescription: 'Nous récupérons les informations de ta structure multisport.',
        title: 'Chargement du contexte',
      },
      missingContext: {
        // eslint-disable-next-line max-len
        description: "Impossible d'ouvrir l'ajout de sponsor sans club ou structure multisport valide.",
        title: 'Contexte introuvable',
      },
      notFound: {
        clubDescription: "Ce club est introuvable ou n'est plus accessible.",
        clubTitle: 'Club introuvable',
        // eslint-disable-next-line max-len
        multisportDescription: "Cette structure multisport est introuvable ou n'est plus accessible.",
        multisportTitle: 'Structure introuvable',
        refresh: 'Actualiser',
      },
    },
    title: 'Ajouter un partenaire',
  },
  adminClaimDetail: {
    accept: 'Accepter',
    acceptRequest: 'Accepter la demande',
    adminNote: {
      label: 'Note admin (optionnelle)',
      placeholder: 'Ajoute un contexte visible par le demandeur',
    },
    affiliationRequest: 'Demande affiliation',
    back: 'Retour',
    cancel: 'Annuler',
    claimedClub: 'Club revendique',
    clubToOnboard: 'Club à onboarder',
    confirm: {
      // eslint-disable-next-line max-len
      acceptBody: "Veux-tu vraiment accepter cette demande ? L'utilisateur deviendra propriétaire du club.",
      processBody: 'Traiter cette demande superadmin ?',
      rejectBody: 'Veux-tu rejeter cette demande ?',
      title: 'Confirmer',
    },
    decline: 'Refuser',
    errorTitle: 'Erreur',
    fields: {
      comment: 'Commentaire:',
      initialSearch: 'Recherche initiale:',
      name: 'Nom:',
      phone: 'Telephone:',
      screen: 'Ecran:',
      target: 'Cible:',
    },
    forClub: 'Pour le club :',
    managerToContact: 'Dirigeant à contacter',
    process: 'Traiter',
    processing: 'Traitement...',
    processRequest: 'Traiter la demande',
    requester: 'Demandeur',
    screenTitle: 'Detail demande',
    states: {
      errorDescription: 'Impossible de charger cette demande.',
      errorTitle: 'Chargement impossible',
      loadingDescription: 'Nous chargeons le detail de la demande.',
      loadingTitle: 'Chargement de la demande',
      missingId: "L'identifiant de la demande est absent de l'URL.",
      notFound: 'Demande introuvable',
      retry: 'Réessayer',
      unavailable: "La demande demandée n'existe pas ou n'est plus accessible.",
    },
    success: {
      accepted: 'Demande acceptée.',
      declined: 'Demande refusée.',
      processed: 'Demande traitee.',
      rejected: 'Demande rejetée.',
    },
    successTitle: 'Succès',
    userFallback: 'Utilisateur',
  },
  adminClaimList: {
    accept: 'Accepter',
    decline: 'Refuser',
    empty: {
      hint: 'Les revendications et demandes superadmin apparaîtront ici.',
      title: 'Aucune demande en attente',
    },
    interest: {
      hint: 'Ce club n’est pas encore sur FoundClub. Personne n’a rien à traiter ici.',
      many: '{{peopleCount}} personnes intéressées par ce club',
      one: '1 personne intéressée par ce club',
    },
    interestsBadge: 'INTÉRÊTS',
    notSpecified: 'non précisé',
    process: 'Traiter',
    screenTitle: 'Revendications et demandes',
    states: {
      errorDescription: 'Impossible de charger les demandes admin.',
      errorTitle: 'Chargement impossible',
      loadingDescription: 'Nous chargeons les revendications et demandes en attente.',
      loadingTitle: 'Chargement des demandes',
      retry: 'Réessayer',
    },
    subtitle: {
      claim: 'Revendique: {{clubName}}',
      clubCreation: 'Club à onboarder: {{clubName}}',
      search: 'Recherche: {{clubName}}',
    },
    unknownClub: 'Club inconnu',
    unknownClubLower: 'club inconnu',
    userFallback: 'Utilisateur',
    waitingPlayers: '{{waitingPlayersCount}} joueurs attendent ce club',
  },
  adminClubContentModel: {
    tabs: {
      geo: 'Géolocalisation',
      history: 'Historique',
      info: 'Informations',
      media: 'Médias',
      overview: "Vue d'ensemble",
      requests: 'Demandes',
    },
  },
  adminClubContentService: {
    galleryError: "Impossible d'ouvrir la galerie.",
  },
  adminClubDetail: {
    actions: 'Actions',
    actionsTitle: 'Actions Club',
    add: 'Ajouter',
    auditReasonPlaceholder: "Raison d'audit",
    badges: {
      notVerified: 'Non certifié',
      partner: 'Partenaire',
      reservationOff: 'Pas réservation',
      reservationOn: 'Réservation active',
      standard: 'Standard',
      verified: 'Certifié',
    },
    cancel: 'Annuler',
    danger: {
      deleteClub: 'Supprimer ce club',
      // eslint-disable-next-line max-len
      description: 'Suppression definitive du club dans le Content Manager. Cette action doit être utilisée avec prudence.',
    },
    delete: {
      confirm: 'Confirmer la suppression',
      description: 'Cette action est irreversible. Ajoute une raison pour l audit.',
      reasonPlaceholder: 'Raison obligatoire',
      title: 'Supprimer le club',
    },
    deleteFailed: 'Suppression impossible',
    duplicate: 'Dupliquer le club',
    edit: 'Modifier',
    errorTitle: 'Erreur',
    history: {
      // eslint-disable-next-line max-len
      description: 'Les actions sensibles passent par les mutations SuperAdmin et alimentent l audit backend.',
      title: 'Historique',
    },
    info: {
      createdAt: 'Creation',
      name: 'Nom',
      parentMultisport: 'Multisport parent',
      partnership: 'Partenariat',
      phone: 'Telephone',
      reservation: 'Reservation',
      // eslint-disable-next-line max-len
      subscriptionsNote: 'Les abonnements, entitlements et capacités Team sont pilotes depuis les opérations abonnements, plus depuis la fiche club.',
      updatedAt: 'Dernière mise à jour',
      verified: 'Club certifié',
    },
    itemsCount: 'element(s)',
    location: {
      address: 'Adresse',
      city: 'Ville',
    },
    media: {
      editSponsors: 'Modifier les sponsors',
      noLogo: 'Aucun logo',
      noSponsor: 'Aucun sponsor configure.',
      replaceLogo: 'Remplacer le logo',
    },
    moreItems: 'autres éléments',
    no: 'Non',
    noLocation: 'Aucune information de localisation',
    noRequest: 'Aucune demande liée.',
    openDanger: 'Ouvrir la Danger zone',
    reasonRequiredMessage: "Ajoute une raison d'au moins 3 caractères.",
    reasonRequiredTitle: 'Raison requise',
    relationFailed: 'Relation impossible',
    relations: {
      activities: 'Activites',
      events: 'Evenements',
      facilities: 'Terrains',
      members: 'Membres',
      parentMultisport: 'Club multisport parent',
      requests: 'Demandes',
      teams: 'Equipes',
    },
    relationSearchPlaceholder: 'Rechercher une entrée',
    remove: 'Retirer',
    search: 'Rechercher',
    searchFailed: 'Recherche impossible',
    states: {
      back: 'Retour',
      errorDescription: 'Impossible de charger ce club.',
      errorTitle: 'Chargement impossible',
      loadingDescription: 'Nous chargeons la fiche Club depuis le Content Manager.',
      loadingTitle: 'Chargement du club',
      missingId: "L'identifiant club est absent de l'URL.",
      notFoundDescription: "Le club demande n'existe pas ou n'est plus accessible.",
      notFoundTitle: 'Club introuvable',
      retry: 'Reessayer',
    },
    stats: {
      events: 'Evenements',
      facilities: 'Terrains',
      members: 'Membres',
      requests: 'Demandes',
      sponsors: 'Sponsors',
      teams: 'Equipes',
    },
    syncing: 'Synchronisation...',
    unnamedClub: 'Club sans nom',
    unverifiedMessage: 'Le club n’est plus certifié.',
    unverifiedTitle: 'Certification retirée',
    unverify: 'Retirer la vérif.',
    verifiedMessage: 'Le club est maintenant certifié.',
    verifiedTitle: 'Club certifié',
    verify: 'Vérifier le club',
    yes: 'Oui',
  },
  adminClubForm: {
    addActivity: 'Ajouter une activité',
    cancel: 'Annuler',
    changeLogo: 'Changer logo',
    choose: 'Choisir',
    chooseParent: 'Choisir le parent multisport',
    createClub: 'Créer le club',
    fields: {
      addressDetails: 'Détails adresse',
      addressJson: 'Adresse JSON',
      addressLabel: 'Adresse affichée',
      city: 'Ville',
      clubPartner: 'Club partenaire',
      clubVerified: 'Club certifié',
      name: 'Nom du club',
      phone: 'Téléphone',
      postcode: 'Code postal',
      reservationProvider: 'Fournisseur de réservation',
    },
    hideAdvancedAddress: 'Masquer JSON avancé',
    invalidJsonMessage: 'Le champ adresse JSON doit contenir un objet JSON valide.',
    invalidJsonTitle: 'JSON invalide',
    keepEditing: "Continuer l'édition",
    leave: 'Quitter',
    nameRequiredMessage: 'Le nom du club est obligatoire.',
    nameRequiredTitle: 'Nom requis',
    no: 'Non',
    reasonPlaceholder: 'Raison de modification',
    relations: {
      activities: 'Activités',
      parentMultisport: 'Club multisport parent',
    },
    remove: 'Retirer',
    removeLogo: 'Retirer logo',
    save: 'Sauvegarder',
    saveFailed: 'Sauvegarde impossible',
    search: 'Rechercher',
    searchFailed: 'Recherche impossible',
    sections: {
      address: 'Adresse',
      identity: 'Identité',
      relations: 'Relations principales',
      status: 'Statut et gouvernance',
      // eslint-disable-next-line max-len
      statusNote: 'Cette fiche pilote le partenariat, la vérification et la réservation. Les abonnements et la couverture Team se gerent dans les opérations abonnements.',
    },
    showAdvancedAddress: 'Adresse JSON avancée',
    sponsor: {
      add: 'Ajouter un sponsor',
      link: 'Lien',
      remove: 'Supprimer sponsor',
      title: 'Titre',
    },
    states: {
      errorDescription: 'Impossible de charger ce club.',
      errorTitle: 'Chargement impossible',
      loadingDescription: 'Nous préparons le formulaire Club.',
      loadingTitle: 'Chargement du club',
      retry: 'Réessayer',
      wizardDescription: 'Nous ouvrons le tunnel de création du club.',
      wizardTitle: 'Ouverture du tunnel',
    },
    subtitle: 'Formulaire dédié compatible Content Manager.',
    title: {
      create: 'Créer un club',
      duplicate: 'Dupliquer le club',
      edit: 'Modifier le club',
    },
    unsavedMessage: 'Quitter sans sauvegarder ?',
    unsavedTitle: 'Modifications non sauvegardées',
    uploadFailed: 'Upload impossible',
    yes: 'Oui',
  },
  adminClubList: {
    actionFailedTitle: 'Action impossible',
    badges: {
      notVerified: 'Non certifié',
      partner: 'Partenaire',
      reservation: 'Réservation',
      standard: 'Standard',
      verified: 'Certifié',
    },
    bulk: {
      delete: 'Supprimer',
      partnerOff: 'Partenaire non',
      partnerOn: 'Partenaire oui',
      reservationOff: 'Résa non',
      reservationOn: 'Résa oui',
    },
    cancel: 'Annuler',
    cancelSelection: 'Annuler sélection',
    cityPlaceholder: 'Filtrer la page par ville ou code postal',
    confirm: 'Confirmer',
    create: 'Créer',
    dangerDescription: 'Cette action sera appliquée aux clubs sélectionnés et auditée.',
    dangerTitle: 'Action SuperAdmin',
    emptyDescription: 'Ajuste la recherche ou les filtres.',
    emptySelectionMessage: 'Sélectionne au moins un club.',
    emptySelectionTitle: 'Sélection vide',
    emptyTitle: 'Aucun club trouvé',
    filters: {
      all: 'Tous',
      no: 'Non',
      partnership: 'Partenariat',
      reservation: 'Réservation',
      sort: 'Tri',
      yes: 'Oui',
    },
    reasonPlaceholder: 'Raison obligatoire',
    reasonRequiredMessage: 'Ajoute une raison d’au moins 3 caractères.',
    reasonRequiredTitle: 'Raison requise',
    searchPlaceholder: 'Rechercher un club...',
    selectAll: 'Tout',
    selectedClubs: 'clubs sélectionnés',
    selection: 'Sélection',
    sort: {
      created: 'Créés',
      partner: 'Partenaires',
      updated: 'MAJ',
    },
    states: {
      errorDescription: 'Impossible de charger les clubs.',
      errorTitle: 'Chargement impossible',
      loadingDescription: 'Nous chargeons la console Club depuis le moteur SuperAdmin.',
      loadingTitle: 'Chargement des clubs',
      retry: 'Réessayer',
    },
    syncing: ' • synchronisation...',
    title: 'Gestion Clubs',
    totalContentManager: 'clubs dans le Content Manager',
    totalDisplayed: 'clubs affichés',
    unnamedClub: 'Club sans nom',
  },
  adminClubOnboardingList: {
    badge: 'CLUB A ONBOARDER',
    clubNotSpecified: 'Club non précisé',
    decline: 'Refuser',
    empty: {
      hint: 'Les formulaires de clubs à onboarder apparaîtront ici.',
      title: 'Aucune demande en attente',
    },
    managerToContact: 'Dirigeant à contacter',
    phone: 'Telephone:',
    process: 'Traiter',
    requester: 'Demandeur',
    screenTitle: 'Clubs à onboarder',
    states: {
      errorDescription: "Impossible de charger les demandes d'onboarding.",
      errorTitle: 'Chargement impossible',
      loadingDescription: "Nous chargeons les demandes d'onboarding club.",
      loadingTitle: 'Chargement des onboardings',
      retry: 'Réessayer',
    },
    userFallback: 'Utilisateur',
    viewDetails: 'Voir detail',
  },
  adminClubWizardActivities: {
    loadError: 'Impossible de charger les activités.',
    loading: 'Chargement des activités...',
    next: 'Suivant',
    // eslint-disable-next-line max-len
    noneSelected: 'Aucune activité sélectionnée pour le moment. Tu peux continuer et compléter plus tard.',
    retry: 'Reessayer',
    searchLabel: 'Rechercher une activité',
    searchPlaceholder: 'Football, basket, handball...',
    selectedCount: '{{count}} activité(s) sélectionnée(s)',
    // eslint-disable-next-line max-len
    subtitle: "Comme pour le tunnel équipe, on choisit d'abord le profil sportif. Sélectionne une ou plusieurs activités pour rendre le club exploitable tout de suite.",
    title: 'Activités sportives',
  },
  adminClubWizardAddress: {
    addressLabel: 'Adresse principale',
    addressPlaceholder: 'Rechercher une adresse',
    detailsLabel: 'Precision / complement',
    detailsPlaceholder: 'Ex: entrée stade, batiment, gymnase...',
    next: 'Suivant',
    noCity: 'Ville non remontee',
    // eslint-disable-next-line max-len
    optionalHint: 'Cette étape reste facultative, mais une adresse nette aide beaucoup pour les recherches, la cartographie et les futures équipes du club.',
    remove: 'Retirer cette adresse',
    selected: 'Adresse sélectionnée',
    // eslint-disable-next-line max-len
    subtitle: "Positionne le club comme dans les autres tunnels FoundClub. Une recherche d'adresse remplit automatiquement la ville, le code postal et les coordonnees.",
    title: 'Adresse du club',
  },
  adminClubWizardBusiness: {
    next: 'Suivant',
    no: 'Non',
    partner: {
      // eslint-disable-next-line max-len
      hint: 'Signal commercial et interne uniquement. Ce statut n ouvre aucun droit produit a lui seul.',
      label: 'Club partenaire',
    },
    reservation: {
      hint: 'Active si le club peut proposer des installations et des réservations.',
      label: 'Fournisseur de réservation',
    },
    // eslint-disable-next-line max-len
    subtitle: 'On fixe ici le partenariat, la vérification et la réservation. Les abonnements et la capacité Équipe se pilotent ensuite depuis les opérations abonnements.',
    title: 'Statut et gouvernance',
    verified: {
      // eslint-disable-next-line max-len
      hint: 'Badge public et legitimite dirigeant. A activer seulement après review claim, migration approuvee ou action superadmin auditée.',
      label: 'Club certifié',
    },
    yes: 'Oui',
  },
  adminClubWizardContact: {
    emailError: 'Renseigne un email valide ou laisse le champ vide.',
    // eslint-disable-next-line max-len
    hint: 'Tu pourras toujours revenir dans la fiche club pour compléter ou corriger ces informations.',
    next: 'Suivant',
    phoneLabel: 'Telephone',
    // eslint-disable-next-line max-len
    subtitle: 'Ajoute un email et un numéro de téléphone pour que la fiche club soit exploitable des la création. Ces champs restent optionnels.',
    title: 'Contact principal',
  },
  adminClubWizardIdentity: {
    changeLogo: 'Changer le logo',
    importLogo: 'Importer un logo',
    // eslint-disable-next-line max-len
    nameHint: 'Le nom du club est le seul champ obligatoire du tunnel. Les autres étapes servent à construire une fiche complète, comme pour le wizard équipe.',
    nameLabel: 'Nom du club',
    namePlaceholder: 'Ex: FC FoundClub Paris',
    next: 'Suivant',
    removeLogo: 'Retirer le logo',
    // eslint-disable-next-line max-len
    subtitle: 'Donne une identité claire au club. Tu pourras enrichir le reste du dossier ensuite et garder un recap avant création.',
    title: 'Identité du club',
    uploadError: 'Upload impossible',
  },
  adminClubWizardMultisport: {
    next: 'Suivant',
    none: 'Aucun parent multisport sélectionne.',
    remove: 'Retirer le rattachement',
    search: 'Rechercher',
    searchError: 'Recherche impossible',
    searchLabel: 'Rechercher un club multisport',
    searchPlaceholder: 'Nom du multisport',
    selected: 'Parent sélectionne',
    // eslint-disable-next-line max-len
    subtitle: 'Si le club appartient a une structure multisport, rattache-le ici. Sinon laisse simplement cette étape vide.',
    title: 'Rattachement multisport',
  },
  adminClubWizardRecap: {
    auditReason: {
      label: "Raison d'audit",
      placeholder: 'Ex: Création initiale dans le dashboard admin',
    },
    create: 'Créer le club',
    createError: 'Création impossible',
    edit: 'Modifier',
    incomplete: 'Des informations restent à compléter',
    ready: 'Prêt à créer',
    sections: {
      activities: 'Activites',
      address: 'Adresse',
      identity: 'Identite',
      logoImported: 'Logo importe',
      missingName: 'Nom manquant',
      noActivity: 'Aucune activité sélectionnée',
      noAddress: 'Adresse non renseignée',
      noCity: 'Ville non renseignée',
      noEmail: 'Email non renseigne',
      noLogo: 'Pas de logo',
      noMultisport: 'Aucun parent multisport',
      noPhone: 'Téléphone non renseigne',
      noSponsor: 'Aucun sponsor',
      notVerified: 'Club non certifié',
      partner: 'Club partenaire',
      reservationOff: 'Pas réservation',
      reservationOn: 'Réservation active',
      standard: 'Club standard',
      status: 'Statut',
      subscriptionsNote: 'Abonnements et capacité Équipe geres depuis les opérations abonnements',
      verified: 'Club certifié',
    },
    // eslint-disable-next-line max-len
    subtitle: 'Tu retrouves ici tout le tunnel avant enregistrement. Le club pourra toujours être edite après création, mais la base sera propre des le depart.',
    title: 'Recapitulatif',
    unnamedClub: 'Club sans nom',
  },
  adminClubWizardSponsors: {
    add: 'Ajouter un sponsor',
    empty: 'Aucun sponsor ajoute pour le moment.',
    invalid: 'Chaque sponsor ajoute doit avoir au minimum un titre.',
    linkLabel: 'Lien',
    next: 'Suivant',
    remove: 'Supprimer ce sponsor',
    // eslint-disable-next-line max-len
    subtitle: 'Ajoute des sponsors si tu veux préparer la fiche club tout de suite. Cette étape reste optionnelle.',
    titleLabel: 'Titre',
    titlePlaceholder: 'Nom du sponsor',
  },
  adminDashboard: {
    billing: {
      receivedOn: 'Recu le',
    },
    call: {
      action: 'Appeler',
      missingNumberMessage: 'Aucun numéro de téléphone exploitable sur cette détection.',
      missingNumberTitle: 'Numéro manquant',
      unavailable: 'Appel indisponible',
    },
    cancel: 'Annuler',
    card: {
      openHint: 'Ouvrir {{title}}',
    },
    cards: {
      activeNonVerifiedClubs: 'Clubs non certifiés actifs',
      alertMeta: 'Alerte',
      autoAffiliatedCoaches: 'Coachs auto-affilies',
      claims: 'Revendications',
      clubOnboarding: 'Clubs à onboarder',
      contentExplorer: 'Explorer CM',
      contentMeta: 'Contenus',
      detectionsPending: 'A vérifier',
      detectionsPublished: 'Publiées sur 30 jours',
      eventsToday: 'Événements du jour',
      featuredRequests: 'Demandes à la une',
      individualExceptions: 'Exceptions individuelles',
      leagueDisputes: 'Litiges League',
      managementMeta: 'Gestion',
      partnerClubs: 'Clubs partenaires',
      popupCampaigns: 'Campagnes pop-up',
      reports: 'Signalements',
      revenue: 'CA par mois',
      teamsCreated: 'Équipes créées',
      teamsWithFirstEvent: 'Équipes avec 1er event',
      toHandleMeta: 'A traiter',
      users: 'Utilisateurs',
      usersWithClub: 'Utilisateurs avec club',
      usersWithoutClub: 'Utilisateurs sans club',
    },
    claim: {
      proofMissing: 'Preuve non renseignée',
      reason: 'Motif:',
    },
    close: 'Fermer',
    clubMissing: 'Club non renseigne',
    create: 'Creer',
    detectionQueue: {
      // eslint-disable-next-line max-len
      description_one: '{{count}} detection dans la file. Tu peux ouvrir la fiche, appeler le coach et noter la vérification.',
      // eslint-disable-next-line max-len
      description_other: '{{count}} detections dans la file. Tu peux ouvrir la fiche, appeler le coach et noter la vérification.',
      empty: 'Aucune détection en attente',
      emptyDescription: 'La file est vide pour le moment.',
      title: 'File de vérification détection',
    },
    entitlement: {
      correct: 'Corriger',
      sourceSlot: 'Slot source:',
      team: 'Equipe',
      unknownScope: 'Scope inconnu',
    },
    firstEvent: {
      badge: '1er event',
      createdOn: 'Cree le',
      defaultName: 'Evenement',
      organizer: 'Organisateur:',
    },
    firstEvents: {
      // eslint-disable-next-line max-len
      description: 'Surveille les équipes qui viennent de créer leur premier événement pour detecter les structures à relancer.',
      empty: 'Aucun premier événement récent',
      emptyDescription: 'Les nouveaux signaux d activation d équipe apparaîtront ici.',
      title: 'Premiers événements d équipe',
    },
    generate: 'Generer',
    generating: 'Generation...',
    governance: {
      adsCount_one: '{{count}} annonce',
      adsCount_other: '{{count}} annonces',
      allow: 'Autoriser',
      allowed: 'Publication autorisee',
      autoAffiliated: 'Auto-affilie',
      blocked: 'Publication bloquée',
      // eslint-disable-next-line max-len
      coachesDescription_one: '{{count}} coach rattaches a un club non partenaire. Autorise individuellement ceux qui peuvent publier.',
      // eslint-disable-next-line max-len
      coachesDescription_other: '{{count}} coachs rattaches a un club non partenaire. Autorise individuellement ceux qui peuvent publier.',
      // eslint-disable-next-line max-len
      disabledDescription: "Les coachs de clubs non certifiés restent bloqués tant qu'aucune exception superadmin n'est accordée.",
      // eslint-disable-next-line max-len
      enabledDescription: 'Les coachs rattaches a un club non certifié peuvent publier leurs événements et annonces.',
      eventsCount_one: '{{count}} event',
      eventsCount_other: '{{count}} events',
      internalNote: 'Note interne',
      label: 'Gouvernance',
      noCoaches: 'Aucun coach non certifié',
      noCoachesDescription: 'Les nouvelles affiliations auto-assignees apparaîtront ici.',
      nonVerifiedCoaches: 'Coachs non certifiés',
      openGlobal: 'Publication ouverte (global)',
      overrideFailedMessage: 'Impossible de mettre à jour cette autorisation coach.',
      overrideFailedTitle: 'Autorisation impossible',
      removeOverride: 'Retirer l exception',
      title: 'Publication coachs non certifiés',
      updateFailedMessage: 'Impossible de mettre à jour la publication des coachs non certifiés.',
      updateFailedTitle: 'Mise à jour impossible',
    },
    legacy: {
      defaultName: 'Club legacy',
      maxTeams_one: 'Legacy {{count}} equipe',
      maxTeams_other: 'Legacy {{count}} equipes',
      noDocumentId: 'Sans documentId',
      partner: 'Partenaire',
      targetedDryRun: 'Dry-run cible',
      toMigrate: 'A migrer',
    },
    legacyMigration: {
      analysed_one: '{{count}} club analyse.',
      analysed_other: '{{count}} clubs analyses.',
      applied: 'Migration executee',
      applyFailed: 'Migration impossible',
      clubLabel: 'Club documentId optionnel',
      description: 'Lance un dry-run global ou cible un club precis avant l apply réel.',
      failedMessage: 'Impossible d executer la migration legacy.',
      previewed: 'Preview terminée',
      previewFailed: 'Preview impossible',
      targetClub: 'Club cible: {{documentId}}\n',
      title: 'Migration legacy',
    },
    manualEntitlement: {
      auditedMessage: 'La mutation manuelle a bien été auditée.',
      capabilityPlaceholder: '* ou capability précise',
      correctedTitle: 'Entitlement corrige',
      correctTitle: 'Corriger un entitlement',
      createdTitle: 'Entitlement crée',
      datesLabel: 'StartsAt / EndsAt / raison',
      // eslint-disable-next-line max-len
      description: 'Scope, capability et subscription restent alignes avec la source de verite backend.',
      endsAtPlaceholder: 'endsAt ISO optionnel',
      failedMessage: 'Impossible de sauvegarder cet entitlement.',
      failedTitle: 'Enregistrement impossible',
      scopeLabel: 'Scope / statut',
      startsAtPlaceholder: 'startsAt ISO optionnel',
      title: 'Entitlement manuel',
    },
    manualSubscription: {
      createdMessage: 'La subscription manuelle a été enregistrée et auditée.',
      createdTitle: 'Subscription créée',
      creating: 'Creation...',
      // eslint-disable-next-line max-len
      description: 'Crée une subscription auditée pour support, migration ciblee ou intervention superadmin.',
      failedMessage: 'Impossible de créer cette subscription manuelle.',
      failedTitle: 'Création impossible',
      payerLabel: 'Payeur user documentId',
      productLabel: 'Provider productId / transactionId / raison',
      providerLabel: 'Provider / statut / periode',
      title: 'Subscription manuelle',
      transactionPlaceholder: 'providerTransactionId (optionnel)',
    },
    open: 'Ouvrir',
    partialDashboard: 'Certaines tuiles admin sont temporairement indisponibles.',
    partner: {
      notVerified: 'Non certifié',
      verified: 'Certifié',
    },
    phoneMissing: 'Téléphone non renseigne',
    quota: {
      lastUsed: 'Dernier usage:',
      remaining: 'reste',
    },
    reasonPlaceholder: 'reason obligatoire',
    refresh: 'Rafraîchir',
    revenue: {
      paying_one: '{{count}} payant',
      paying_other: '{{count}} payants',
      trial_one: '{{count}} essai',
      trial_other: '{{count}} essais',
      unavailable: 'indisponible',
    },
    review: {
      action: 'Traiter',
      internalNotes: 'Notes internes',
      notesPlaceholder: 'Appel effectue, identité vérifiée, contact club, etc.',
      pending: 'En attente',
      pendingBadge: 'En attente',
      rejected: 'Rejetee',
      rejectedBadge: 'Rejetee',
      save: 'Enregistrer',
      title: 'Traiter la vérification',
      verified: 'Verifiee',
      verifiedBadge: 'Verifiee',
    },
    saving: 'Enregistrement...',
    sections: {
      kpis: 'KPIs détection et acquisition',
      overview: 'Pilotage general',
    },
    states: {
      errorDescription: 'Impossible de charger les indicateurs admin.',
      errorTitle: 'Chargement impossible',
      loadingDescription: "Nous synchronisons les indicateurs d'administration.",
      loadingTitle: 'Chargement du dashboard admin',
      retry: 'Reessayer',
    },
    subscription: {
      noTransaction: 'Sans transaction',
      payer: 'Payeur: {{name}}',
      payerMissing: 'Payeur non renseigne',
    },
    subscriptionOps: {
      billingFailed: 'billing KO',
      claimsToReview: 'Claims à revoir',
      // eslint-disable-next-line max-len
      description: 'Pilote la migration legacy, les subscriptions manuelles, les entitlements et les signaux billing depuis le même back-office.',
      freeQuotas: 'Quotas free',
      legacyCandidates: 'Clubs legacy candidats',
      noBillingEvents: 'Aucun billing event en preview',
      noClaims: 'Aucun claim en preview',
      noEntitlements: 'Aucun entitlement à afficher',
      noLegacyCandidates: 'Aucun candidat legacy',
      noQuotas: 'Aucun quota en preview',
      noSubscriptions: 'Aucune subscription à afficher',
      recentEntitlements: 'Entitlements récents',
      recentSubscriptions: 'Subscriptions recentes',
    },
    // eslint-disable-next-line max-len
    subtitle: 'Pilote les demandes, les alertes, les détections et les événements sensibles depuis un seul espace.',
    teamSync: {
      confirm: 'Resynchroniser',
      confirmMessage: 'Cela va recalculer les entitlements TEAM de la subscription {{plan}}.',
      confirmTitle: 'Resynchroniser les droits Team ?',
      doneMessage_one: '{{count}} slot resynchronise.',
      doneMessage_other: '{{count}} slots resynchronises.',
      doneTitle: 'Resync terminée',
      failedMessage: 'Impossible de resynchroniser cette subscription.',
      failedTitle: 'Resync impossible',
    },
    testTools: {
      // eslint-disable-next-line max-len
      description: 'Crée un tournoi sandbox avec équipes, effectifs fictifs, poules et matchs pour valider le flux de bout en bout.',
      label: 'Outils de test',
      title: 'Tournoi fictif complet',
    },
    testTournament: {
      // eslint-disable-next-line max-len
      confirmMessage: 'Cela crée un tournoi autonome [TEST] avec 8 équipes, des joueurs fictifs, des poules et des matchs brouillons. En production, cette action est bloquée sauf flag explicite.',
      confirmTitle: 'Générer un tournoi fictif ?',
      createdMessage: '{{name}} est prêt avec {{teams}} équipes.{{warnings}}',
      createdTitle: 'Tournoi fictif crée',
      defaultName: 'Le tournoi de test',
      failedMessage: 'Impossible de générer le tournoi fictif.',
      failedTitle: 'Génération impossible',
      warnings: '\n\nAttention: {{list}}',
    },
    title: 'Dashboard Admin',
    unknownClub: 'Club inconnu',
    unknownDate: 'Date inconnue',
    unknownPlan: 'Plan inconnu',
    unknownProvider: 'provider inconnu',
    unknownTeam: 'Équipe inconnue',
    unknownUser: 'Utilisateur inconnu',
    verification: {
      failedMessage: 'Impossible de mettre à jour cette vérification.',
      failedTitle: 'Vérification impossible',
    },
  },
  adminEvents: {
    title: 'Modération Événements',
    today: "Aujourd'hui",
  },
  adminLeagueDisputes: {
    count: 'match(es) en litige',
    disputeTag: '(litige)',
    empty: 'Aucun litige actif.',
    errorTitle: 'Erreur',
    invalidScores: 'Les scores doivent être des entiers positifs.',
    loading: 'Chargement...',
    reasonPlaceholder: 'Raison de résolution',
    refresh: 'Rafraîchir',
    resolve: 'Résoudre ce litige',
    resolved: 'Litige résolu.',
    resolveError: 'Impossible de resoudre le litige.',
    resolving: 'Résolution...',
    states: {
      errorDescription: 'Impossible de charger les litiges League.',
      errorTitle: 'Chargement impossible',
      loadingDescription: 'Nous chargeons les litiges League.',
      loadingTitle: 'Chargement des litiges',
      retry: 'Réessayer',
    },
    submissionA: 'Soumission A:',
    submissionB: 'Soumission B:',
    successTitle: 'Succès',
    title: 'Litiges League',
  },
  adminNotificationsHealth: {
    actions: {
      purgeDead: 'Purger dead non-prod',
      retryLastFailure: 'Relancer dernier échec',
      title: 'Actions de test',
    },
    // eslint-disable-next-line max-len
    description: "Verifie la configuration push, la queue d'envoi et les abonnements multi-comptes sans exposer les secrets.",
    failures: {
      empty: 'Aucun échec récent.',
      noDetail: 'Sans erreur détaillée',
      title: 'Derniers echecs',
    },
    metrics: {
      failed: 'Echouees',
      multiAccount: 'Multi-comptes',
      orphaned: 'Orphelins',
      pending: 'En attente',
      sending: 'Envoi',
      sent: 'Envoyees',
      subscriptions: 'Abonnements',
    },
    no: 'Non',
    runtime: {
      cronActive: 'Cron actif',
      cronLeader: 'Leader cron',
      environment: 'Environnement',
      firebaseConfig: 'Config Firebase',
      firebaseProject: 'Projet Firebase',
    },
    states: {
      errorDescription: 'Impossible de charger le diagnostic notifications.',
      errorTitle: 'Diagnostic indisponible',
      loadingDescription: "Nous lisons l'état runtime push, la queue et les installations.",
      loadingTitle: 'Diagnostic notifications',
      retry: 'Reessayer',
    },
    tokens: {
      allSubscribed: 'Tous les comptes locaux detectes sur cet appareil sont abonnés.',
      deviceInstallations: 'Installations detectees pour cet appareil',
      linkedAccounts: 'compte(s) lie(s)',
      masked: 'token masque',
      noneForAccount: "Aucune installation push n'est encore abonnee pour ton compte courant.",
      quickActions: 'Actions rapides',
      subscribedLocal: 'compte(s) local(aux) abonnes sur cet appareil.',
      subscriptionsCount: 'abonnement(s)',
      // eslint-disable-next-line max-len
      unsubscribedLocal: 'compte(s) local(aux) connecte(s) ne sont pas encore abonnes sur cet appareil.',
    },
    withWarning: ' avec avertissement',
    yes: 'Oui',
  },
  adminPopupCampaignDetail: {
    actions: {
      archive: 'Archiver',
      close: 'Fermer',
      duplicate: 'Dupliquer',
      editDraft: 'Modifier le brouillon',
      pause: 'Mettre en pause',
      preview: 'Prévisualiser',
      publish: 'Publier',
    },
    alerts: {
      archiveError: 'Archivage impossible',
      duplicateError: 'Duplication impossible',
      pauseError: 'Pause impossible',
      publishError: 'Publication impossible',
    },
    content: {
      noEyebrow: 'Sans eyebrow',
      title: 'Contenu',
    },
    states: {
      errorDescription: 'Impossible de charger cette campagne.',
      errorTitle: 'Chargement impossible',
      loadingDescription: 'Nous préparons le détail de la campagne pop-up.',
      loadingTitle: 'Chargement de la campagne',
      retry: 'Réessayer',
    },
    stats: {
      primaryClick: 'Clic primaire',
      secondaryClick: 'Clic secondaire',
      title: 'Statistiques',
      usersReached: 'Utilisateurs vus',
    },
    summary: {
      allUsers: 'Tous les utilisateurs authentifiés',
      immediate: 'immédiat',
      noEnd: 'sans fin',
      priority: 'Priorité',
      status: 'Statut',
      template: 'Modèle',
      title: 'Résumé',
      window: 'Fenêtre',
    },
  },
  adminPopupCampaignForm: {
    actionType: 'Type d’action',
    active: 'Actif',
    addImage: 'Ajouter une image',
    buttonLabel: 'Label bouton',
    buttonLabelPlaceholder: 'Ex: Ouvrir',
    close: 'Fermer',
    createDraft: 'Créer le brouillon',
    editTitle: 'Éditer la campagne',
    fields: {
      body: 'Corps',
      bodyPlaceholder: 'Message principal affiché dans le popup',
      endAt: 'Fin (ISO, optionnel)',
      eyebrowPlaceholder: 'Ex: Nouvelle fonctionnalité',
      internalName: 'Nom interne',
      priority: 'Priorité (10-59)',
      startAt: 'Début (ISO, optionnel)',
      subtitle: 'Sous-titre',
      subtitlePlaceholder: 'Texte secondaire optionnel',
      targetClubs: 'Clubs ciblés (documentIds csv)',
      targetMultisportClubs: 'Multisports ciblés (documentIds csv)',
      targetPlatforms: 'Plateformes ciblées (csv)',
      targetRoles: 'Rôles ciblés (csv)',
      targetUsers: 'Utilisateurs ciblés (documentIds csv)',
      template: 'Modèle',
      title: 'Titre',
      titlePlaceholder: 'Titre visible du popup',
      tone: 'Ton',
    },
    galleryError: "Impossible d'ouvrir la galerie.",
    galleryTitle: 'Galerie',
    inactive: 'Inactif',
    newTitle: 'Nouvelle campagne',
    noImage: 'Aucune image liée.',
    preview: 'Prévisualiser',
    previewTitle: 'Prévisualisation',
    primaryAction: 'Action principale',
    replaceImage: "Remplacer l'image",
    saveDraft: 'Enregistrer le brouillon',
    saveFailed: 'Enregistrement impossible',
    secondaryAction: 'Action secondaire',
    states: {
      errorDescription: 'Impossible de charger ce brouillon.',
      errorTitle: 'Chargement impossible',
      loadingDescription: 'Nous chargeons le brouillon de campagne.',
      loadingTitle: 'Chargement du brouillon',
      openDetail: 'Ouvrir le détail',
      // eslint-disable-next-line max-len
      publishedDescription: 'Cette campagne a déjà été publiée. Duplique-la depuis le détail pour la modifier.',
      publishedTitle: 'Brouillon non éditable',
      retry: 'Réessayer',
    },
    target: {
      default: 'Cible',
      recruitmentAd: 'Annonce documentId',
      url: 'URL cible',
    },
    targetPlaceholder: 'documentId ou URL',
    uploadFailed: 'Upload impossible',
    uploadNoFile: 'Le serveur n’a renvoyé aucun fichier.',
  },
  adminPopupCampaignList: {
    allUsers: 'Tous les utilisateurs authentifiés',
    clicks: 'Clics',
    create: 'Créer une campagne',
    empty: {
      hint: 'Ajuste les filtres ou crée une première campagne pop-up.',
      title: 'Aucune campagne',
    },
    filters: {
      all: 'Tous',
    },
    priority: '| Priorité',
    searchPlaceholder: 'Rechercher par nom interne ou titre',
    states: {
      errorDescription: 'Impossible de charger les campagnes pop-up.',
      errorTitle: 'Chargement impossible',
      loadingDescription: 'Nous préparons la liste des campagnes pop-up.',
      loadingTitle: 'Chargement des campagnes',
      retry: 'Réessayer',
    },
    subtitle: 'Crée, planifie et pilote les pop-ups in-app diffusés à l’ouverture.',
    title: 'Campagnes pop-up',
  },
  adminReports: {
    by: 'Par',
    empty: {
      hint: 'Aucun element ne correspond aux filtres actuels.',
      title: 'Aucun signalement à traiter',
    },
    filters: {
      all: 'Tous',
      events: 'Evenements',
      rejected: 'Refuses',
      resolved: 'Resolus',
    },
    noDetail: 'Signalement sans detail.',
    openConversation: 'Ouvrir la conversation',
    openEvent: "Ouvrir l'événement",
    shownCount: 'signalement(s) affiche(s)',
    source: {
      event: 'Evenement',
    },
    states: {
      errorDescription: 'Impossible de charger les signalements admin.',
      errorTitle: 'Chargement impossible',
      loadingDescription: 'Nous récupérons les signalements événements et messages.',
      loadingTitle: 'Chargement des signalements',
      retry: 'Réessayer',
    },
    status: {
      pending: 'En attente',
      rejected: 'Refuse',
      resolved: 'Resolu',
    },
    statusLabel: 'Statut',
    targetUnavailable: 'Cible indisponible',
    title: 'Signalements',
    unknownDate: 'Date inconnue',
    unknownUser: 'Utilisateur inconnu',
  },
  adminRevenue: {
    alreadyPartner: 'Déjà partenaire',
    billingEmpty: 'Aucun billing event trouve.',
    billingError: 'Impossible de charger les billing events.',
    billingLoading: 'Chargement des billing events...',
    cancel: 'Annuler',
    claimsEmpty: 'Aucun claim en attente.',
    claimsToReview: 'Claims à revoir',
    filters: {
      all: 'Tous',
    },
    legacyClub: 'Club legacy',
    legacyEmpty: 'Aucun club legacy dans l aperçu.',
    legacyMaxTeams: 'Legacy max equipes:',
    legacySubscription: 'Legacy abonnement:',
    legacyToMigrate: 'Legacy à migrer',
    migrationRequired: 'Migration requise',
    monetization: 'Monetisation',
    pagination: {
      next: 'Suivant',
      previous: 'Précédent',
      summary: 'Page {{currentPage}} / {{pageCount}} • {{total}} au total',
    },
    pills: {
      active: '{{total}} actifs',
      paying: '{{total}} payants',
      trial: '{{total}} essais',
    },
    receivedAt: 'Reçu le {{date}}',
    reconcile: 'Reconcilier',
    // eslint-disable-next-line max-len
    reconcileConfirmMessage: 'Cela relance immédiatement la réconciliation des abonnements (expirations, grace periods, droits).',
    reconcileConfirmTitle: 'Réconcilier maintenant ?',
    reconciledMessage: 'Les abonnements et les droits ont été recalculés.',
    reconciledTitle: 'Réconciliation terminée',
    reconcileFailedMessage: 'Impossible de lancer la réconciliation.',
    reconcileFailedTitle: 'Réconciliation impossible',
    reconcileNow: 'Réconcilier maintenant',
    reconciling: 'Reconciliation...',
    requiredReason: 'Raison obligatoire',
    retriedMessage: 'L événement a été rejoue depuis son payload.',
    retriedTitle: 'Billing event rejoue',
    retry: 'Rejouer',
    retryFailedMessage: 'Impossible de rejouer ce billing event.',
    retryFailedTitle: 'Rejeu impossible',
    retryModal: {
      reasonPlaceholder: 'Motif du rejeu (correction webhook, incident résolu...)',
      retrying: 'Rejeu...',
      title: 'Rejouer le billing event',
    },
    searchPlaceholder: 'Rechercher un payeur, un plan...',
    states: {
      errorDescription: 'Impossible de charger les opérations abonnements.',
      errorTitle: 'Chargement impossible',
      loadingDescription: 'Nous chargeons le pilotage abonnements depuis le backend.',
      loadingTitle: 'Chargement des abonnements',
      refresh: 'Rafraichir',
    },
    stats: {
      billingFailed: 'Billing KO',
    },
    statusAction: 'Statut...',
    statusChangeFailedMessage: 'Impossible de changer le statut de cet abonnement.',
    statusChangeFailedTitle: 'Changement impossible',
    statusModal: {
      confirm: 'Confirmer',
      reasonPlaceholder: 'Motif du changement (support, fraude, regularisation...)',
      saving: 'Enregistrement...',
      title: 'Changer le statut',
    },
    statusUpdatedMessage: 'Le statut et les droits associes ont été recalculés.',
    statusUpdatedTitle: 'Statut mis à jour',
    subscribers: 'Abonnés',
    subscriptionsEmpty: 'Aucun abonne trouve.',
    subscriptionsError: 'Impossible de charger les abonnés.',
    subscriptionsLoading: 'Chargement des abonnés...',
    // eslint-disable-next-line max-len
    subtitle: 'Cette vue suit maintenant les subscriptions, entitlements, claims et incidents billing cote serveur. Les anciens champs club ne servent plus de référence métier ici.',
    title: 'Pilotage abonnements',
    tryAgain: 'Réessayer',
    unknownClub: 'Club inconnu',
    unknownEvent: 'Event inconnu',
    unknownPeriod: 'période inconnue',
    unknownPlan: 'Plan inconnu',
    unknownProvider: 'provider inconnu',
    unknownUser: 'Utilisateur inconnu',
  },
  adminService: {
    badges: {
      claim: 'REVENDICATION',
      clubCreation: 'CRÉATION DE CLUB',
      clubNotFound: 'CLUB INTROUVABLE',
      teamNotFound: 'ÉQUIPE INTROUVABLE',
    },
    reports: {
      conversationFallback: 'Conversation',
      conversationWith: 'Conversation avec {{person}}',
      eventFallback: "Signalement d'événement",
      eventTargetFallback: 'Evenement',
      messageFallback: 'Signalement de message',
    },
    unknownUser: 'Utilisateur inconnu',
  },
  adminStack: {
    titles: {
      claimDetail: 'Détail Demande',
      claims: 'Revendications',
      clubDetail: 'Détail Club',
      clubEdit: 'Édition Club',
      clubOnboarding: 'Clubs à onboarder',
      contentExplorer: 'Explorer CM',
      entries: 'Entrées',
      entryDetail: 'Détail',
      entryEdit: 'Edition',
      events: 'Événements',
      featuredRequests: 'Demandes à la une',
      leagueDisputes: 'Litiges League',
      popupCampaignDetail: 'Détail campagne',
      popupCampaignEdit: 'Éditer campagne',
      popupCampaigns: 'Campagnes pop-up',
      reports: 'Signalements',
      revenue: 'Revenus',
      userDetail: 'Détail Utilisateur',
      users: 'Utilisateurs',
    },
  },
  adminUserDetail: {
    accountStatus: 'Statut du Compte',
    active: '✓ Actif',
    blocked: '✕ Bloqué',
    cancel: 'Annuler',
    club: 'Club Associé',
    confirmSave: 'Veux-tu sauvegarder les modifications ?',
    confirmTitle: 'Confirmer',
    contact: 'Contacter',
    delete: 'Supprimer',
    deleteAccount: 'Supprimer le compte',
    deletedMessage: "L'utilisateur a été anonymisé et bloqué.",
    deletedTitle: 'Compte supprimé',
    // eslint-disable-next-line max-len
    deleteMessage: 'Le compte sera anonymisé et bloqué définitivement. Cette action est irréversible.',
    deleteTitle: 'Supprimer ce compte ?',
    deleting: 'Suppression…',
    errorTitle: 'Erreur',
    infoTitle: 'Info',
    missingDocumentId: 'Document ID utilisateur introuvable pour ouvrir la conversation.',
    openChatError: "Impossible d'ouvrir la conversation.",
    role: 'Rôle',
    save: 'Sauvegarder',
    selfChat: 'Tu ne peux pas créer une conversation avec ton propre compte.',
    states: {
      back: 'Retour',
      errorDescription: 'Impossible de charger cet utilisateur.',
      errorTitle: 'Chargement impossible',
      loadingDescription: 'Nous chargeons la fiche utilisateur.',
      loadingTitle: 'Chargement du profil admin',
      missingId: "L'identifiant utilisateur est absent de l'URL.",
      notFoundDescription: "Le compte demande n'existe pas ou n'est plus accessible.",
      notFoundTitle: 'Utilisateur introuvable',
      retry: 'Réessayer',
    },
    successTitle: 'Succès',
    updated: 'Utilisateur mis à jour',
  },
  adminUserList: {
    empty: {
      hint: 'Les utilisateurs apparaîtront ici',
      title: 'Aucun utilisateur trouvé',
      trySearch: 'Essaie une autre recherche',
    },
    filterByRole: 'Filtrer sur le role {{label}}',
    openProfile: 'Ouvrir la fiche de {{name}}',
    roles: {
      clubManager: 'Dirigeant',
      coach: 'Entraineur',
      none: 'Sans rôle',
      player: 'Joueur',
    },
    searchPlaceholder: 'Rechercher un utilisateur...',
    sortHint: 'Trier par date d inscription',
    sortNewest: '↓ Derniers inscrits',
    sortOldest: '↑ Plus anciens',
    states: {
      errorDescription: 'Impossible de charger les utilisateurs.',
      errorTitle: 'Chargement impossible',
      loadingDescription: 'Nous chargeons la liste des utilisateurs.',
      loadingTitle: 'Chargement des utilisateurs',
      retry: 'Réessayer',
    },
    title: 'Gestion Utilisateurs',
    unnamed: 'Personne sans nom',
  },
  adminWaitingPlayers: {
    interestsBadge: 'INTÉRÊTS',
  },
  adWizardAudienceType: {
    coach: {
      // eslint-disable-next-line max-len
      description: "Publie une annonce dédiée a un rôle d'encadrement: entraîneur principal, adjoint, préparateur physique ou autre besoin staff.",
      title: 'Je recrute un entraîneur',
    },
    // eslint-disable-next-line max-len
    footnote: 'Le tunnel adapte ensuite automatiquement les etapes, les libelles et l’affichage final de l’annonce.',
    next: 'Suivant',
    players: {
      // eslint-disable-next-line max-len
      description: 'Publie une annonce par poste recherche, avec le volume de recrutement et les informations sportives de l’équipe.',
      title: 'Je recrute des joueurs',
    },
    quotaLabel: 'Annonces',
    subtitle: 'Choisis si tu publies une annonce pour recruter des joueurs ou un entraîneur.',
    title: "Type d'annonce",
  },
  adWizardCoachProfile: {
    availabilityLabel: 'Disponibilités attendues',
    availabilityPlaceholder: 'Ex. Mardi et jeudi soir, match le week-end',
    certificationsHelper: 'Separer chaque certification par une virgule.',
    certificationsLabel: 'Certifications souhaitées',
    certificationsPlaceholder: 'Ex. BMF, BPJEPS, expérience formation jeunes',
    coachRoles: {
      assistant: 'Entraîneur adjoint',
      fitness: 'Préparateur physique',
      goalkeeper: 'Entraîneur gardiens',
      main: 'Entraîneur principal',
      other: 'Autre rôle',
      teamManager: 'Team manager',
      videoAnalyst: 'Analyste vidéo',
    },
    engagement: {
      expenses: 'Indemnise',
      salaried: 'Salarie',
      toBeDefined: 'A définir',
      volunteer: 'Benevole',
    },
    engagementLabel: "Type d'engagement *",
    engagementPlaceholder: 'Sélectionner un cadre',
    experience: {
      confirmed: 'Confirme',
      expert: 'Experimente',
      junior: 'Junior',
      qualified: 'Diplome',
    },
    experienceLabel: 'Expérience attendue *',
    experiencePlaceholder: "Sélectionner un niveau d'expérience",
    next: 'Suivant',
    quantityLabel: 'Nombre de profils recherches',
    roleLabel: 'Rôle principal *',
    roleOtherLabel: 'Précise le rôle',
    roleOtherPlaceholder: 'Ex. Responsable gardiens, coordinateur sportif...',
    rolePlaceholder: 'Sélectionner un rôle',
    subtitle: 'Définis le rôle encadrement recherche et le cadre de la mission.',
    title: 'Profil entraîneur recherche',
  },
  adWizardDescription: {
    context: {
      location: 'Lieu : {{location}}',
      positions_one: '{{count}} poste sélectionné',
      positions_other: '{{count}} postes sélectionnés',
      role: 'Rôle : {{role}}',
      team: 'Équipe : {{team}}',
      title: "Contexte de l'annonce",
    },
    missions: {
      body: 'Décris ce que tu attends concretement du futur entraîneur.',
      // eslint-disable-next-line max-len
      placeholder: 'Ex. Préparation des séances, accompagnement le week-end, lien avec les joueurs et coordination avec le reste du staff.',
      title: 'Missions principales',
    },
    need: {
      body: 'Quelques lignes suffisent pour donner envie aux bons profils de candidater.',
      // eslint-disable-next-line max-len
      bodyCoach: 'Quelques lignes suffisent pour expliquer le contexte et donner envie aux bons profils coach de candidater.',
      canSkip: 'Tu peux aussi continuer sans description.',
      optional: 'Optionnel',
      // eslint-disable-next-line max-len
      placeholder: 'Ex. Nous recherchons un gardien expérimenté pour notre équipe U20 qui evolue en régional. Entraînements les mardis et jeudis soir, ambiance serieuse et bienveillante.',
      // eslint-disable-next-line max-len
      placeholderCoach: 'Ex. Nous recherchons un entraîneur adjoint pour accompagner notre groupe senior régional. Projet formateur, équipe staff engagee, rythme de deux séances par semaine.',
      ready: 'Ta description est prête à être publiée.',
      title: 'Présente ton besoin',
    },
    next: 'Suivant',
    subtitle: 'Ajoute quelques détails pour rendre ton annonce plus claire et plus attractive.',
    // eslint-disable-next-line max-len
    subtitleCoach: 'Ajoute une presentation du besoin et les missions pour attirer les bons profils coach.',
    tips: {
      coach1: 'Précise le projet sportif et la place du rôle dans le staff.',
      coach2: 'Indique le rythme attendu des entraînements et des matchs.',
      coach3: 'Explique le cadre de mission et les responsabilités principales.',
      coach4: 'Mentionne les qualites humaines ou diplomes qui feront la difference.',
      players1: "Précise l'intensité ou le niveau de jeu attendu.",
      players2: 'Indique les horaires et le rythme des entraînements.',
      players3: "Mentionne si une séance d'essai ou une détection est prévue.",
      players4: "Décris l'ambiance et le projet sportif de l'équipe.",
      title: 'Idées à inclure',
    },
    title: 'Description',
    titleCoach: 'Description et missions',
  },
  adWizardInfo: {
    form: {
      category: 'Catégorie *',
      categoryPlaceholder: 'Sélectionner une catégorie',
      level: 'Niveau minimum recherché *',
      levelHelper: 'Définis le niveau minimum attendu pour candidater.',
      levelPlaceholder: 'Sélectionner un niveau',
      section: 'Section *',
      sectionPlaceholder: 'Sélectionner une section',
    },
    next: 'Suivant',
    profile: {
      body: 'Affine la cible de ton annonce avec les bons repères sportifs.',
      // eslint-disable-next-line max-len
      bodyCoach: 'Précise le sport, la section, la catégorie et le niveau de référence de ton besoin staff.',
      title: 'Profil recherche',
      titleCoach: 'Contexte du rôle recherche',
    },
    required: {
      // eslint-disable-next-line max-len
      body: 'Complète la section, la catégorie et le niveau minimum pour qualifier clairement ton annonce.',
      title: 'Profil requis',
    },
    sportUndefined: 'Non défini',
    subtitle: 'Précise la cible sportive recherchee avant de passer au lieu de publication.',
    subtitleCoach: 'Précise le cadre sportif dans lequel tu recherches un profil coach.',
    taxonomy: {
      // eslint-disable-next-line max-len
      errorBody: "Tu peux réessayer pour récupérer toutes les références, ou continuer avec les informations déjà préremplies depuis l'équipe.",
      errorTitle: "Certaines options n'ont pas pu être chargées",
      loading: 'Chargement des sections, catégories et niveaux disponibles.',
      retry: 'Réessayer',
    },
    team: {
      change: 'Choisir une autre équipe',
      clubMissing: 'Club non renseigné',
      selected: 'Équipe sélectionnée',
    },
    teamSummary: {
      category: 'Catégorie',
      item: '{{label}} : {{value}}',
      level: 'Niveau',
      section: 'Section',
    },
    title: 'Ciblage sportif',
  },
  adWizardLocation: {
    hint: 'Sélectionne une installation du club ou saisis une adresse extérieure pour continuer.',
    next: 'Suivant',
    required: {
      body: 'Sélectionne une installation du club ou saisis une adresse pour continuer.',
      title: 'Lieu requis',
    },
    // eslint-disable-next-line max-len
    subtitle: 'Sélectionne une installation du club ou renseigne une adresse claire pour situer ton annonce.',
    title: 'Lieu de publication',
  },
  adWizardPositions: {
    bulk: {
      // eslint-disable-next-line max-len
      body: 'Le compteur met à jour toute la liste instantanément. 0 réinitialise la sélection globale.',
      title: 'Appliquer à tous les postes',
      unit: 'joueurs par poste',
    },
    chips: {
      players_one: '{{count}} joueur',
      players_other: '{{count}} joueurs',
      positions_one: '{{count}} poste',
      positions_other: '{{count}} postes',
    },
    list: {
      empty: "Aucun poste n'est actuellement défini pour ce sport.",
      enable: 'Activer',
      quantity_one: '{{count}} joueur recherché',
      quantity_other: '{{count}} joueurs recherchés',
      selectedTitle: 'Postes actifs',
    },
    next: 'Suivant',
    noPositions: {
      body: '{{sport}} ne nécessite pas de préciser des postes.',
      continue: 'Tu peux passer directement à la suite de ton annonce.',
      subtitle: 'Ce sport ne se joue pas par postes.',
    },
    subtitle: 'Définis les postes à ouvrir et le volume de recrutement associé.',
    summary: {
      configured_one: '{{count}} poste configuré',
      configured_other: '{{count}} postes configurés',
      none: 'Aucun poste sélectionné',
      noneHint: 'Active des postes ci-dessous ou applique un volume à tous les postes.',
      players_one: '{{count}} joueur recherché sur cette annonce.',
      players_other: '{{count}} joueurs recherchés sur cette annonce.',
    },
    title: 'Postes recherchés',
  },
  adWizardRecap: {
    adType: {
      coach: 'Annonce entraîneur',
      detection: 'Annonce liée à une détection',
      season: 'Annonce saisonnière',
    },
    beforePublish: {
      // eslint-disable-next-line max-len
      body: "L'annonce sera visible par les joueurs correspondant au profil recherche. Plus tes informations sont precises, plus la mise en relation sera pertinente.",
      // eslint-disable-next-line max-len
      bodyCoach: "L'annonce sera visible dans le flux recrutement avec un badge entraîneur. Plus le rôle, les missions et le cadre sont precis, plus les candidatures seront pertinentes.",
      title: 'Avant publication',
    },
    coachRole: {
      missing: 'À completer',
      otherMissing: 'À preciser',
    },
    counts: {
      players_one: '{{count}} joueur',
      players_other: '{{count}} joueurs',
      positions_one: '{{count}} poste',
      positions_other: '{{count}} postes',
      roles_one: '{{count}} role',
      roles_other: '{{count}} roles',
    },
    incomplete: {
      body: 'Il manque encore {{items}} avant de publier cette annonce.',
      title: 'Récapitulatif incomplet',
    },
    location: {
      address: 'Adresse',
      eyebrow: 'Lieu',
      facility: 'Installation sélectionnée',
      place: 'Lieu',
      title: 'Lieu de publication',
    },
    missing: {
      category: 'une catégorie',
      coachProfile: 'un profil entraîneur complet',
      location: 'un lieu',
      minLevel: 'un niveau minimum',
      position: 'au moins un poste',
      section: 'une section',
      team: 'une équipe',
    },
    needs: {
      addPosition: "Ajoute au moins un poste pour publier l'annonce.",
      coachSummary_one: '{{count}} profil coach recherche pour le rôle {{role}}.',
      coachSummary_other: '{{count}} profils coach recherches pour le rôle {{role}}.',
      eyebrow: 'Besoins',
      noPositions: "Aucun poste n'à encore été ajouté.",
      playerSummary_one: '{{count}} joueur recherché sur {{positions}}.',
      playerSummary_other: '{{count}} joueurs recherchés sur {{positions}}.',
      title: 'Postes recherchés',
      titleCoach: 'Rôle recherche',
    },
    overview: {
      location: 'Lieu',
      positions: 'Postes',
      profile: 'Profil',
      progress: '{{done}} / 4 informations clés prêtes à publier',
      ready: 'Prêt à publier',
      role: 'Role',
      team: 'Équipe',
      title: "Vue d'ensemble",
    },
    paywallContext: 'Ton annonce de recrutement',
    section: {
      edit: 'Modifier',
    },
    sportUndefined: 'Non défini',
    structure: {
      eyebrow: 'Équipe qui recrute',
      noTeam: 'Aucune équipe sélectionnée',
      profile: 'Profil',
      sport: 'Sport',
      title: 'Structure',
    },
    submit: {
      errorBody: "Impossible de créer l'annonce. Vérifie les informations puis réessaie.",
      errorTitle: 'Publication impossible',
      failedTitle: "La publication n'a pas abouti",
      label: "Publier l'annonce",
    },
    subtitle: "Vérifie l'ensemble du brief avant de publier ton annonce.",
    targeting: {
      adType: "Type d'annonce",
      eventFallback: 'Événement',
      eyebrow: 'Publication',
      linkedDetection: 'Détection liée',
      profile: 'Profil',
      sport: 'Sport',
      title: 'Ciblage sportif',
      validation: 'Validation',
    },
    text: {
      eyebrow: "Texte de l'annonce",
      noDescription: "Aucune description personnalisée n'a été ajoutée.",
      noMissions: 'Aucune mission détaillée n à encore été ajoutée.',
      title: 'Description',
      titleCoach: 'Description et missions',
    },
    title: 'Récapitulatif',
    toComplete: 'À compléter',
    toSpecify: 'À préciser',
    validation: {
      auto: 'Validation automatique',
      direct: 'Publication directe',
      manual: 'Validation manuelle',
    },
  },
  adWizardTeam: {
    available_one: '{{count}} équipe disponible',
    available_other: '{{count}} équipes disponibles',
    empty: {
      body: 'Tu dois être associé à une équipe pour créer une annonce de recrutement.',
      subtitle: "Tu n'as pas d'équipe associée",
      title: 'Créer une annonce',
    },
    subtitle: "Sélectionne l'équipe qui recrute",
    title: 'Pour quelle équipe ?',
  },
  adWizardValidation: {
    detectionBadge: 'Annonce liée à une détection',
    eventFallback: 'Événement',
    // eslint-disable-next-line max-len
    intro: 'Ce réglage détermine la manière dont les candidatures seront acceptées sur cette annonce.',
    modes: {
      auto: {
        eyebrow: 'Fluide',
        helper: 'Idéal si tes critères sont déjà très précis.',
        highlight1: 'Réponse immédiate',
        highlight2: 'Parcours plus rapide',
        label: 'Automatique',
        summary: 'Les joueurs compatibles sont acceptés sans attendre une validation manuelle.',
      },
      manual: {
        eyebrow: 'Contrôle',
        helper: 'Recommandé si tu souhaites valider chaque profil.',
        highlight1: 'Validation capitaine',
        highlight2: 'Tri avant confirmation',
        label: 'Manuelle',
        summary: "Tu confirmes chaque candidature avant qu'elle ne rejoigne l'événement.",
      },
    },
    next: 'Suivant',
    reminder: {
      body: "Tu pourras toujours consulter les profils reçus ensuite dans le détail de l'annonce.",
      title: 'À retenir',
    },
    subtitle: 'Choisis comment les candidatures liées à cette détection seront traitées.',
    title: 'Mode de validation',
  },
  APIerrors: {
    // Authentication errors
    AUTHENTICATION_FAILED: "Échec d'authentification.",
    INVALID_TOKEN: "Jeton d'authentification invalide.",
    MISSING_TOKEN: "Jeton d'authentification manquant.",
    OTP_ERROR: 'Une erreur est survenue lors de la connexion OTP',

    // Authorization errors
    FORBIDDEN: 'Accès refusé.',
    // Repli quand un écran n'héberge pas encore la feuille de vente : le refus est bien un
    // refus d'abonnement, pas un refus de droits — les deux ne se disent pas pareil.
    SUBSCRIPTION_PERMISSION_DENIED: "Cette action nécessite une offre FoundClub active. Rends-toi dans Mon abonnement pour l'activer.",
    UNAUTHORIZED: "Tu n'es pas autorisé·e à effectuer cette action.",

    // Validation errors
    INVALID_FIELD_FORMAT: 'Format de champ invalide.',
    MISSING_REQUIRED_FIELD: 'Un champ obligatoire est manquant.',
    VALIDATION_ERROR: 'Erreur de validation.',

    // User errors
    EMAIL_TAKEN: 'Cette adresse email est déjà utilisée.',
    PHONE_NUMBER_TAKEN: 'Ce numéro de téléphone est déjà utilisé.',
    USER_ALREADY_EXISTS: 'Cet utilisateur existe déjà.',
    USER_NOT_FOUND: 'Utilisateur introuvable.',
    USERNAME_TAKEN: "Ce nom d'utilisateur est déjà utilisé.",

    // Club errors
    CLUB_DELETE_ERROR: 'Erreur lors de la suppression du club.',
    CLUB_IMPORT_ERROR: "Erreur lors de l'import des données du club.",
    CLUB_NOT_FOUND: 'Club introuvable.',
    CLUB_SPONSOR_ERROR: 'Erreur concernant le partenaire du club.',
    CLUB_UPDATE_ERROR: 'Erreur lors de la mise à jour du club.',
    // TRIO — LES DEUX REFUS DU CLUB SANS DIRIGEANT. Sans ces deux clefs, l'app
    // ne trouvait rien à traduire, retombait sur le statut 403 et affichait
    // « Ton compte n'a pas encore de rôle » — faux, et il envoyait la personne
    // chercher un problème qui n'existe pas. Le serveur les pose dans
    // `resolveOrphanClubJoinRefusal` (admin, club-membership-request.ts).
    CLUB_WITHOUT_MANAGER_IS_PARTNER: 'Ce club utilise déjà FoundClub, mais il n’a plus '
      + 'de dirigeant. Contacte-nous pour qu’on te confie sa gestion.',
    CLUB_WITHOUT_MANAGER_NOT_CLAIMABLE: 'Ce club n’a aucun dirigeant pour valider ta demande. '
      + 'Seul un entraîneur ou un dirigeant peut le rejoindre directement : vérifie ton rôle dans '
      + 'ton profil, puis réessaie.',
    USER_NOT_IN_CLUB: "L'utilisateur n'est pas membre du club.",

    // Membership request errors
    MEMBERSHIP_REQUEST_ALREADY_PROCESSED: "La demande d'adhésion a déjà été traitée.",
    MEMBERSHIP_REQUEST_NOT_PENDING: "La demande d'adhésion n'est pas en attente.",
    MEMBERSHIP_REQUEST_REFUSED: "La demande d'adhésion a été refusée.",

    // Sport errors
    SPORT_DELETE_ERROR: 'Erreur lors de la suppression du sport.',

    // Trainer errors
    NOT_A_TRAINER: "L'utilisateur n'est pas un·e entraîneur·e.",
    // TRIO — la clef ne bouge pas, la phrase si : le serveur pose ce MEME code
    // pour un dirigeant déjà affilié (admin, trainer-management.ts, « Manager is
    // already associated with a club »). L'appeler « entraîneur·e » nommait le
    // mauvais rôle, et la phrase ne disait pas comment s'en sortir.
    TRAINER_ALREADY_IN_CLUB: 'Tu fais déjà partie d’un club. '
      + 'Quitte-le depuis sa fiche avant de rejoindre celui-ci.',
    TRAINER_HAS_TEAMS: "L'entraîneur·e est associé·e à des équipes.",
    TRAINER_IS_UNIQUE_TEAM_TRAINER: "L'entraîneur·e est le/la seul·e entraîneur·e de l'équipe.",
    TRAINER_NOT_FOUND: 'Entraîneur·e introuvable.',
    TRAINER_NOT_IN_CLUB: "L'entraîneur·e n'est pas membre du club.",

    // Team errors
    CLUB_MAX_TEAM_NUMBER_REACHED: 'Le nombre maximum d\'équipes pour ce club a été atteint.',
    TEAM_CLUB_REQUIRED: 'Un club est requis pour chaque équipe.',
    TEAM_MEMBER_POLICY_ERROR: 'Pour effectuer cette action, tu dois être membre de l\'équipe.',
    TEAM_PLAYER_REMOVE_ERROR: 'Erreur lors de la suppression du/de la joueur·se de l\'équipe.',
    TEAM_TRAINER_CONNECT_REQUIRED: 'La connexion avec l\'entraîneur·e est requise.',
    TEAM_TRAINER_REMOVE_ERROR: 'Erreur lors de la suppression de l\'entraîneur·e de l\'équipe.',
    TEAM_TRAINER_REQUIRED: 'Au moins un·e entraîneur·e est requis·e pour chaque équipe.',
    TEAM_TRAINER_SET_REQUIRED: 'Une équipe d\'entraîneur·e·s est requise.',

    // Department errors
    DEPARTMENT_IMPORT_ERROR: 'Erreur lors de l\'import des données du département.',
    DEPARTMENT_REQUIRED: 'Le département est requis.',

    // Event errors
    EVENT_ALREADY_MISSING: 'Tu as déjà répondu absent à cet événement.',
    EVENT_AUDIENCE_NOT_TARGETED: "Cet événement ne convie qu'une partie de ton équipe.",
    EVENT_CANCEL_ERROR: "Erreur lors de l'annulation de l'événement.",
    EVENT_CAPACITY_ERROR: "La capacité maximale de l'événement est atteinte.",
    EVENT_CREATE_ERROR: "Erreur lors de la création de l'événement.",
    EVENT_DATE_ERROR: "La date de l'événement est invalide.",
    EVENT_DATE_PAST: "La date ou l'heure de l'événement est déjà passée.",
    EVENT_FIND_ERROR: "Erreur lors de la recherche de l'événement.",
    EVENT_INVALID_TIME_RANGE: "L'heure de fin doit être après l'heure de début.",
    EVENT_IS_NOT_ACTIVE_ERROR: "L'événement n'est pas actif.",
    EVENT_LOCATION_REQUIRED: 'Un lieu est requis pour créer un événement.',
    EVENT_MISSING_ERROR: "Erreur lors de la réponse à l'événement.",
    EVENT_PARTICIPATION_ACCEPT_ERROR: "Erreur lors de l'acceptation de la participation.",
    EVENT_PARTICIPATION_ALREADY_TREATED: 'La demande de participation a déjà été traitée.',
    EVENT_PARTICIPATION_CREATE_ERROR: 'Erreur lors de la création de la participation.',
    EVENT_PARTICIPATION_REFUSE_ERROR: 'Erreur lors du refus de la participation.',
    EVENT_SLOT_CONFLICT: 'Un conflit de créneau a été détecté pour ce lieu.',
    EVENT_UPDATE_ERROR: "Erreur lors de la mise à jour de l'événement.",
    EVENT_USER_ALREADY_IN_EVENT_ERROR: "L'utilisateur est déjà inscrit à cet événement.",
    // W01 — le serveur n envoie ce code que pour UNE raison : ne faire partie
    // d aucune des equipes conviees (`event-rsvp.ts:101`, `event.ts:3052`,
    // `event-participation.ts:436`). Depuis le lot U02 un encadrant MEMBRE est
    // accepte : lui dire « pas joueur de l equipe » nommait son role au lieu de
    // son appartenance, et lui faisait croire que son compte lui interdisait de
    // repondre. Meme cle, meme place — seule la phrase change.
    EVENT_USER_NOT_PLAYER_OF_TEAM_ERROR: "Cet événement est réservé aux équipes conviées, et tu n'es membre d'aucune d'elles.",

    // Event participation request errors
    EVENT_PARTICIPATION_ALREADY_HAS_A_REQUEST_POLICY_ERROR: 'Une demande de participation existe déjà pour cet événement.',
    EVENT_PARTICIPATION_DELETE_ERROR: 'Erreur lors de la suppression de la participation à l\'événement.',
    EVENT_PARTICIPATION_REQUEST_ALREADY_EXISTS: 'Une demande de participation existe déjà.',
    EVENT_PARTICIPATION_REQUEST_NOT_FOUND: 'Demande de participation introuvable.',
    EVENT_PARTICIPATION_REQUEST_POLICY_ERROR: 'Violation de la politique concernant les demandes de participation.',
    EVENT_PLAYER_POLICY_ERROR: 'Violation de la politique concernant les joueur·se·s.',

    // Chat errors
    CHAT_ID_NOT_PROVIDED: 'ID de chat non fourni.',
    FAILED_TO_ACCESS_CHAT: 'Impossible d\'accéder au chat.',
    FAILED_TO_JOIN_CHAT: 'Impossible de rejoindre le chat.',
    FAILED_TO_SEND_MESSAGE: 'Impossible d\'envoyer le message.',
    MESSAGE_TOO_LONG: 'Le message est trop long.',
    // CONVAVERT — LE REFUS DU GARDE-FOU DES MINEURS, ENFIN LISIBLE.
    // Le serveur pose ce code pour les deux ages (moins de 13 ans sans le
    // compte du parent, et 13-17 ans hors encadrants du club) avec une phrase
    // francaise DEJA adaptee a celui qu il refuse. Cette clef est le repli :
    // elle sert quand le message du serveur ne remonte pas, et surtout elle
    // empeche le refus de retomber sur le « Accès refusé. » du statut 403.
    MINOR_DIRECT_CHAT_FORBIDDEN: 'Discussion privée impossible : un mineur ne peut '
      + 'échanger en privé '
      + "qu'avec son parent ou les encadrants de son club.",
    RATE_LIMIT_EXCEEDED: 'Limite de taux dépassée.',
    USER_NOT_PARTICIPANT_OF_CHAT: 'L\'utilisateur·rice n\'est pas participant·e du chat.',

    // Server errors
    DATABASE_ERROR: 'Erreur de base de données.',
    INTERNAL_SERVER_ERROR: 'Erreur interne du serveur.',

    // File upload errors
    FILE_TOO_LARGE: 'Fichier trop volumineux.',
    FILE_UPLOAD_ERROR: 'Erreur lors du téléchargement du fichier.',
    INVALID_FILE_TYPE: 'Type de fichier invalide.',

    // Policy errors
    // AB05 — CES QUATRE-LÀ AFFICHAIENT LEUR PROPRE CODE À L'ÉCRAN.
    // Leur « traduction » était le nom de la constante, en majuscules :
    // `CHAT_NOT_FOUND_POLICY_ERROR` s'affichait tel quel dans la fenêtre
    // d'erreur. Ce n'est pas une phrase, c'est une fuite de plomberie —
    // et c'est la seule famille de messages creux que ce lot répare, parce
    // qu'elle est la seule qui ne demande aucune enquête par appelant.
    // Chaque phrase dit ce qui manque, côté serveur, à l'endroit exact où le
    // refus est posé.
    //   `is-message-sender.ts` : le message n'existe pas, OU il n'est pas de toi
    CHAT_MESSAGE_NOT_FOUND_POLICY_ERROR: 'Ce message n’existe plus, ou il n’est pas de toi.',
    //   `can-report-message.ts` : le message signalé est introuvable
    CHAT_MESSAGE_REPORT_NOT_FOUND_POLICY_ERROR: 'Ce message n’existe plus : il a peut-être été supprimé.',
    //   `can-access-chat.ts` : la conversation est introuvable ou fermée pour toi
    CHAT_NOT_FOUND_POLICY_ERROR: 'Cette conversation n’existe plus, ou tu n’en fais plus partie.',
    //   `is-club-manager-create.ts` : la demande est partie SANS club (le code
    //   n'est posé que dans ce cas-là — le refus de droit, lui, sort en 403 nu)
    CLUB_MANAGER_CREATE_POLICY_ERROR: 'Cette action n’a pas pu identifier le club concerné. Réessaie depuis la fiche du club.',
    CLUB_MANAGER_POLICY_ERROR: 'Violation de la politique concernant les dirigeant·e·s du club.',
    CLUB_MEMBER_POLICY_ERROR: 'Violation de la politique concernant les membres du club.',
    CLUB_STAFF_CREATE_POLICY_ERROR: 'Violation de la politique de création de personnel du club.',
    CLUB_STAFF_POLICY_ERROR: 'Violation de la politique concernant le personnel du club.',
    error: 'Erreur',
    EVENT_TRAINER_CREATE_POLICY_ERROR: "Violation de la politique de création d'événements par les entraîneur·e·s.",
    EVENT_TRAINER_POLICY_ERROR: 'Violation de la politique concernant les entraîneur·e·s et les événements.',
    generic: 'Une erreur est survenue. Merci de réessayer plus tard.',
    HAD_PENDING_MEMBERSHIP_REQUEST_POLICY_ERROR: "Tu as déjà une demande d'adhésion en attente.",
    MANAGER_TRAINER_CLUB_POLICY_ERROR: 'Violation de la politique concernant les entraîneur·e·s et dirigeant·e·s du club.',
    MANAGER_WITH_CLUB_POLICY_ERROR: 'Violation de la politique concernant les dirigeant·e·s avec club.',
    phoneNumberAlreadyUsed: 'Ce numéro est déjà utilisé par {{firstname}} {{lastname}}.',
    phoneNumberAlreadyUsedWithClub: 'Ce numéro est déjà utilisé par un·e entraîneur·e qui appartient à un club.',
    'Request failed with status code 404': 'La ressource demandée est introuvable.',
    schemaMismatch: 'Un problème est survenu lors de la récupération des informations.'
      + ' Merci de vérifier que ton application est à jour ou réessayer plus tard.',
    TEAM_MANAGER_POLICY_ERROR: 'Violation de la politique concernant les gestionnaires d\'équipe.',
    TEAM_TRAINER_CREATE_POLICY_ERROR: 'Violation de la politique de création d\'événements par les entraîneur·e·s.',
    title: 'Erreur',
    UNIQUE_CLUB_CHAT_POLICY_ERROR: 'Violation de la politique concernant les discussions de club.',
    UNIQUE_TEAM_CHAT_POLICY_ERROR: 'Violation de la politique concernant les discussions d\'équipe.',
    UNIQUE_WHISPER_CHAT_POLICY_ERROR: 'Violation de la politique concernant les discussions privées.',
    unknown: 'Une erreur inconnue est survenue.',
    USER_NOT_FOUND_POLICY_ERROR: 'Violation de la politique concernant les utilisateurs introuvables.',
  },
  app: {
    bootError: {
      eyebrow: 'Crash précédent',
      title: 'FoundClub a détecté un crash précédent',
    },
  },
  appUpdateGate: {
    a11y: {
      contactHint: "Ouvre le site FoundClub pour joindre l'équipe.",
      laterHint: 'Ferme ce message et continue dans FoundClub.',
      updateHint: "Ouvre la boutique d'applications de ce téléphone.",
    },
    actions: {
      contact: 'Un problème ? Nous contacter',
      later: 'Plus tard',
      update: 'Mettre à jour',
    },
    installedVersion: 'Version installée : {{version}}',
    recommended: {
      description: 'Mets à jour FoundClub pour profiter des dernières nouveautés '
        + 'et corrections.',
      title: 'Une mise à jour est disponible',
      version: 'Version {{version}}',
    },
    // 🔤 ⛔ NE PLUS UTILISER redirectNotice NI stores.* POUR CETTE PHRASE.
    // Recette du 2026-08-26 : « vers l'App Store » passe par {{store}}, et
    // i18next ECHAPPE les valeurs interpolees ⇒ l'ecran affichait
    // « vers l&#39;App Store ». Les deux clefs completes ci-dessous n'ont AUCUNE
    // interpolation, donc plus rien a echapper. Les deux clefs historiques
    // restent la (aucune clef ne se supprime) mais ne sont plus lues.
    redirectNotice: 'Tu seras redirigé·e vers {{store}}.',
    redirectNoticeAndroid: 'Tu seras redirigé·e vers Google Play.',
    redirectNoticeIos: "Tu seras redirigé·e vers l'App Store.",
    releaseNotesTitle: 'Dans cette version',
    requiredVersion: 'Version demandée : {{version}}',
    stores: {
      android: 'Google Play',
      ios: "l'App Store",
    },
    storeUnreachable: "Impossible d'ouvrir le store. Réessaie.",
    title: 'Une mise à jour est disponible',
    versionChip: 'Version {{minimum}} requise · tu es en {{current}}',
    what: 'Tes données et ton compte sont intacts.',
    why: 'Télécharge la nouvelle version de FoundClub pour continuer à profiter '
      + "de l'app.",
  },
  assignCoachTeams: {
    actions: {
      assignSelected: 'Assigner aux équipes sélectionnées',
      createTeam: 'Créer une équipe',
    },
    alerts: {
      success: {
        message: '{{trainerName}} a été assigné aux équipes sélectionnées.',
        title: 'Assignation terminée',
        trainerFallback: "L'entraîneur",
      },
    },
    badges: {
      alreadyAssigned: 'Déjà assigné',
    },
    empty: {
      message: 'Aucune équipe pour le moment.',
    },
    errors: {
      assign: "Impossible d'assigner l'entraîneur aux équipes sélectionnées.",
      noTeamSelected: 'Sélectionne au moins une équipe.',
      trainerNotFound: 'Impossible de retrouver cet entraîneur. Merci de réessayer.',
    },
    fallbacks: {
      team: 'Équipe',
    },
    header: {
      hint: 'Cochez une ou plusieurs équipes, puis valide.',
      title: 'Assigner un entraîneur',
      userFallback: 'Utilisateur',
    },
    selection: {
      many: '{{teamCount}} équipes sélectionnées',
      none: 'Aucune équipe sélectionnée',
      one: '1 équipe sélectionnée',
    },
    state: {
      missingClub: {
        // eslint-disable-next-line max-len
        description: "Impossible d'ouvrir cette assignation sans club valide. Reviens à la demande d'adhésion puis relance l'action.",
        title: 'Club introuvable',
      },
      missingCoach: {
        // eslint-disable-next-line max-len
        description: "Impossible de retrouver le coach à assigner. Reviens à la demande puis relance l'assignation.",
        title: 'Coach introuvable',
      },
    },
  },
  authWeb: {
    errors: {
      browserRequired: 'Le navigateur est requis pour initialiser le reCAPTCHA.',
      firebaseNotConfigured: 'Firebase Web n est pas configure pour cette application.',
    },
  },
  bookingCalendar: {
    availableSlots: 'Créneaux disponibles -',
    chooseDate: 'Choisir une date',
    noSlots: 'Aucun créneau disponible pour cette date',
    slot: {
      allowAndNotify: 'Autorise et notifier',
      full: 'Complet',
      pending: 'Demande en attente',
      remaining: '{{remaining}} dispo',
    },
    title: 'Réservation',
    web: {
      bookingName: 'Nom de la réservation',
      chooseFacility: 'Choisir une installation',
      chooseSlot: 'Choisis un créneau',
      confirm: 'Confirmer la réservation',
      confirmedPlayers: 'Joueurs déjà confirmés',
      creating: 'Création…',
      duration: 'Durée',
      durationAfterSlot: 'La durée sera disponible dès qu’un créneau sera choisi.',
      errors: {
        availability: 'Impossible de charger les disponibilités.',
        create: 'Impossible de créer cette réservation.',
        facilities: 'Impossible de charger les installations.',
        incomplete: 'Choisis une installation, un créneau et une durée.',
      },
      eyebrow: 'Réservations',
      finalize: 'Finalise ta réservation du {{date}}.',
      loadingAvailability: 'Chargement des disponibilités…',
      maxDuration: 'Durée max',
      mode: {
        private: 'Privé',
        privateDescription: 'Tu privatises tout le terrain pour ton groupe.',
        shared: 'Partagé',
        sharedDescription: 'Tu ouvres la réservation à d’autres joueurs.',
      },
      noFacility: 'Aucune installation reservable n est disponible pour le moment.',
      noSlot: 'Aucun créneau disponible pour cette date.',
      pickFacilityFirst: 'Choisis une installation pour voir ses créneaux disponibles.',
      refresh: 'Rafraîchir les disponibilités',
      selectFacilityFirst: 'Sélectionne d’abord une installation.',
      selectSlot: 'Sélectionne un créneau disponible pour configurer la réservation.',
      slotsOf: 'Créneaux du',
      // eslint-disable-next-line max-len
      subtitle: 'Sélectionne une installation, un créneau disponible et configure ta réservation directement depuis le web.',
      summary: {
        price: 'Prix estimé',
        slot: 'Créneau',
      },
      targetPlayers: 'Objectif total de joueurs',
      title: 'Réserver une installation',
    },
  },
  bookingConfigModal: {
    back: '← Retour',
    booking: 'Réservation...',
    confirm: 'Confirmer la réservation',
    next: 'Suivant',
    private: {
      description: 'Je réserve le terrain pour mon groupe',
      title: '🔒 PRIVATISER',
      totalPrice: 'Prix total:',
    },
    selectedSlot: 'Créneau sélectionné :',
    shared: {
      currentPlayers: 'Tu es combien ?',
      description: 'Je cherche des joueurs pour compléter',
      missingPlayers_one: 'Il manque {{count}} joueur',
      missingPlayers_other: 'Il manque {{count}} joueurs',
      pricePerPlayer: '{{price}}€/joueur',
      targetPlayers: 'Joueurs recherchés :',
      title: '👥 MATCH OUVERT',
    },
    slotCount_one: '({{count}} créneau)',
    slotCount_other: '({{count}} créneaux)',
  },
  bookingModal: {
    // eslint-disable-next-line max-len
    overflowAutoApprovedMessage: 'Le créneau dépasse la capacité habituelle, mais cette installation est configuree en "Autorise et notifier". Les dirigeants ont été prevenus.',
    overflowAutoApprovedTitle: 'Réservation confirmée',
    // eslint-disable-next-line max-len
    overflowRequestCreatedMessage: 'Le créneau est déjà complet. Ta réservation a été envoyée aux dirigeants pour arbitrage.',
    overflowRequestCreatedTitle: "Demande d'exception envoyée",
  },
  bootGate: {
    reload: 'Recharger',
    // eslint-disable-next-line max-len
    subtitle: "La configuration réseau de ce build est invalide. L'app est bloquée proprement pour éviter un crash au démarrage.",
    title: 'Configuration invalide',
  },
  bootRequestGuard: {
    // eslint-disable-next-line max-len
    blocked: "Appels de démarrage suspendus {{seconds}}s après une rafale d'échecs réseau ({{path}}).",
    noSession: "Appel ignoré : {{path}} exige une session et aucun jeton n'est disponible.",
  },
  celebrationCatalog: {
    attendanceOnTimeStreak: {
      body_one: 'Tu enchaines {{count}} entrainement. Continue comme ca.',
      body_other: 'Tu enchaines {{count}} entrainements. Continue comme ca.',
      title: 'Série sans retard',
    },
    attendancePresenceStreak: {
      body_one: 'Tu enchaines {{count}} presence. Continue comme ca.',
      body_other: 'Tu enchaines {{count}} presences. Continue comme ca.',
      title: 'Série de présences',
    },
    clubLicenseeQuotaApproaching: {
      // eslint-disable-next-line max-len
      body_one: "{{club}} n'a plus que {{count}} place sur les {{total}} licenciés de son abonnement.",
      // eslint-disable-next-line max-len
      body_other: "{{club}} n'a plus que {{count}} places sur les {{total}} licenciés de son abonnement.",
      title: 'Bientôt au complet',
    },
    clubLicenseeQuotaReached: {
      body: '{{club}} a atteint ses {{total}} licenciés. Les nouvelles adhésions sont en pause.',
      title: 'Plafond de licenciés atteint',
    },
    clubMemberMilestone: {
      body: '{{club}} atteint {{total}} membres.',
      title: 'Nouveau cap franchi',
    },
    clubMembershipConfirmed: {
      body: 'Bienvenue dans {{club}}.',
      title: 'Adhésion confirmée',
    },
    clubMembershipRequestSent: {
      body: 'Ta demande pour rejoindre {{club}} a bien été prise en compte.',
      title: 'Demande envoyée',
    },
    eventBatchCreated: {
      body: '{{total}} événements sont maintenant enregistres.',
      title: 'Événements créés',
    },
    eventConvocationPublished: {
      body: "La composition d'équipes pour {{team}} est prête.",
      title: "Composition d'équipes publiée",
    },
    eventCreated: {
      body: '{{event}} est bien enregistre.',
      title: 'Événement crée',
    },
    eventExternalTeamAccepted: {
      body: '{{team}} rejoint {{event}}.',
      title: 'Équipe externe confirmée',
    },
    eventParticipationConfirmed: {
      body: 'Tu es bien confirmé pour {{event}}.',
      title: 'Participation confirmée',
    },
    eventParticipationRequestSent: {
      body: 'Ta demande pour {{event}} a bien été envoyée.',
      title: 'Participation envoyée',
    },
    eventPublished: {
      body: '{{event}} est maintenant visible pour les joueurs concernés.',
      title: 'Événement publie',
    },
    eventResponsesComplete: {
      body: 'Tous les joueurs de {{team}} ont répondu pour {{event}}.',
      title: 'Réponses completes',
    },
    eventRsvpPresent: {
      body: 'Ta réponse pour {{event}} a bien été enregistrée.',
      title: 'Présence confirmée',
    },
    eventTaskAssignmentValidated: {
      body: 'Tu es confirmé sur {{task}}.',
      title: 'Tâche validée',
    },
    eventTaskMembersAssigned: {
      body_one: '{{count}} membre assigne(s) a {{task}}.',
      body_other: '{{count}} membres assigne(s) a {{task}}.',
      title: 'Affectation terminée',
    },
    eventTasksCovered: {
      body: 'Toutes les tâches de {{event}} sont maintenant couvertes.',
      title: 'Organisation complète',
    },
    eventTaskVolunteerSent: {
      body: 'Ta proposition pour {{task}} a bien été prise en compte.',
      title: 'Volontariat enregistre',
    },
    eventUpdated: {
      body: '{{event}} a été mis à jour.',
      title: 'Mise à jour enregistrée',
    },
    eyebrows: {
      attendance: 'ASSIDUITE',
      callUp: 'CONVOCATION',
      event: 'EVENEMENT',
      events: 'EVENEMENTS',
      license: 'LICENCE',
      lineup: 'COMPOSITION',
      organisation: 'ORGANISATION',
      participation: 'PARTICIPATION',
      presence: 'PRESENCE',
      subscription: 'ABONNEMENT',
      team: 'EQUIPE',
    },
    fallbacks: {
      externalTeamCap: 'Une équipe externe',
      theEvent: "l'evenement",
      theEventCap: "L'evenement",
      theOpponent: "l'adversaire",
      thisClub: 'ce club',
      thisEvent: 'cet événement',
      thisTask: 'cette tâche',
      thisTeam: 'cette équipe',
      yourClub: 'ton club',
      yourClubCap: 'Ton club',
      yourEventCap: 'Ton événement',
      yourLicense: 'ta licence',
      yourMatch: 'ton match',
      yourSquadCap: 'Ta squad',
      yourTaskToday: 'ta mission du jour',
      yourTeam: 'ton équipe',
      yourTeamCap: 'Ton équipe',
    },
    generic: {
      body: 'Une nouvelle étape est franchie.',
      eyebrow: 'FELICITATIONS',
      title: 'Bravo',
    },
    leagueFirstVictory: {
      body: '{{team}} signe sa première victoire League.',
      title: 'Première victoire',
    },
    leagueMatchFound: {
      body: '{{team}} a maintenant un adversaire.',
      title: 'Match trouve',
    },
    leagueMatchValidated: {
      body: 'Le résultat de {{match}} est maintenant valide.',
      title: 'Score valide',
    },
    leagueProposalAccepted: {
      body: 'Le match contre {{opponent}} est confirmé.',
      title: 'Proposition acceptée',
    },
    leagueQuorumReached: {
      body: '{{team}} à son effectif pour jouer.',
      title: 'Quorum atteint',
    },
    leagueVictoryStreak: {
      body_one: 'Tu enchaines {{count}} victoire. Continue comme ca.',
      body_other: 'Tu enchaines {{count}} victoires. Continue comme ca.',
      title: 'Série de victoires',
    },
    leagueWeekendWin: {
      body: '{{team}} a gagne ce week-end contre {{opponent}}.',
      title: 'Victoire du week-end',
    },
    licenseAvailable: {
      body: 'La licence officielle est maintenant disponible dans ton espace.',
      title: 'Licence disponible',
    },
    licensePaymentConfirmed: {
      body: 'Le paiement de {{license}} a bien été confirmé.',
      title: 'Paiement confirme',
    },
    officialLicenseUploaded: {
      body: 'La copie officielle est disponible pour le membre concerne.',
      title: 'Licence officielle ajoutée',
    },
    teamCreated: {
      body: '{{team}} est prête à accueillir ses membres.',
      title: 'Équipe créée',
    },
    teamMembershipConfirmed: {
      body: 'Tu fais maintenant partie de {{team}}.',
      title: 'Adhésion confirmée',
    },
    teamMembershipRequestSent: {
      body: 'Ta demande pour rejoindre {{team}} a bien été envoyée.',
      title: 'Demande envoyée',
    },
  },
  club: {
    fields: {
      address: {
        label: 'Adresse',
        placeholder: 'Adresse du club',
      },
      email: {
        label: 'Email',
        placeholder: 'Email du club',
      },
      name: {
        label: 'Nom',
        placeholder: 'Nom du club',
      },
      phoneNumber: {
        label: 'Téléphone',
        placeholder: 'Téléphone du club',
      },
    },
  },
  clubAffiliationOutcome: {
    thisClub: 'ce club',
  },
  clubCard: {
    multisportBadge: 'OMNISPORT',
    recruitingBadge: 'RECRUTE',
    sectionsCount_one: '{{count}} section',
    sectionsCount_other: '{{count}} sections',
    stats: {
      ads: 'Annonces',
      members: 'Membres',
      teams: 'Équipes',
    },
  },
  clubCertification: {
    certified: 'Certifié',
    notCertified: 'Non certifié',
  },
  clubDetails: {
    a11y: {
      callClub: 'Appeler le club au {{phoneNumber}}',
      deleteSponsor: 'Supprimer le sponsor {{sponsorName}}',
      emailClub: 'Envoyer un e-mail a {{email}}',
    },
    actions: {
      // S02 — la VALEUR change, la clef reste (aucune clef n'est supprimee de ce
      // fichier). « Me prévenir dès qu’une équipe existe » decrivait ce que fait
      // l'AUTRE bouton : ce bouton-ci, lui, ouvre le formulaire « je suis deja
      // dans ce club, faites-le venir ». Les deux disaient la meme chose, et
      // c'est ce que « très nul » designait (Adel, 2026-08-16).
      bringClubOver: 'C’est mon club',
      claimClub: "C'est mon club",
      // S02 — la SECONDE porte. Elle dit ce que la personne OBTIENT (on la
      // previent), pas ce qu'elle declare : c'est ce qui la rend impossible a
      // confondre avec « C’est mon club » juste au-dessus.
      clubArrivalInterest: 'Prévenez-moi quand ce club arrive',
      clubArrivalInterestPending: 'Tu seras prévenu·e',
      contactTrainers: 'Contacter les entraîneur·e·s',
      createTeam: 'Créer une équipe',
      delete: 'Supprimer',
      editInfo: 'Modifier',
      join: "C'est mon club !",
      joinAsMyClub: "C'est mon club !",
      joinClubMember: 'Je fais partie de ce club',
      // PARENT P2 -- la porte du parent. Le prenom n'apparait QUE s'il n'y a
      // QU'UN enfant concerne : avec deux, en nommer un serait faux, la
      // demande ne porte pas l'enfant.
      joinForChild: 'Demander à rejoindre au nom de {{firstname}}',
      joinForChildren: 'Demander à rejoindre pour mes enfants',
      joinPoster: 'Affiche — Rejoindre le club',
      leave: 'Quitter le club',
      manageClub: 'Je dirige ce club',
      manageJoinRequests: 'Voir les demandes d\'affiliation',
      myTeam: 'Mon équipe',
      playAtClub: 'Je joue dans ce club',
      requestJoin: 'Demander à rejoindre ce club',
      requestPending: 'Demande en attente',
    },
    activities: {
      addConfirm: 'Ajouter',
    },
    // AFFIL (2026-08-28) — LES TROIS ISSUES D'UNE DEMANDE D'AFFILIATION, ET
    // ELLES NE SE RESSEMBLENT PAS. Devenir dirigeant sur-le-champ, attendre
    // qu'un dirigeant valide, et partir en verification chez un administrateur
    // sont trois choses differentes ; l'app les disait pareil, et depuis
    // l'onboarding elle n'en disait aucune (constat d'Adel du 28/08).
    // La phrase du SERVEUR gagne quand il en envoie une (`meta.affiliation`) :
    // ces valeurs sont le repli. Table : `services/requests/clubAffiliationOutcome.js`.
    affiliation: {
      autoAffiliated: {
        description: 'Tu es maintenant dirigeant de {{club}}.',
        title: 'C’est fait !',
      },
      pendingAdminReview: {
        description: 'Ta demande de gestion de {{club}} est partie.'
          + ' Tu n’es pas encore dirigeant : un administrateur FoundClub doit la valider.',
        title: 'Demande envoyée',
      },
      pendingManagerReview: {
        description: 'Ta demande est partie. Un dirigeant de {{club}} doit la valider.',
        title: 'Demande envoyée',
      },
      unknown: {
        description: 'Ta demande est partie.',
        title: 'Demande envoyée',
      },
    },
    alerts: {
      // AFFIL A1 — le club SANS dirigeant : ce qui va se passer est une
      // AFFILIATION, pas une verification. Promettre une verification, c'est
      // promettre autre chose que ce que fait le bouton.
      claimClub: {
        // eslint-disable-next-line max-len
        confirmDescription: 'Veux-tu demander la gestion de ce club ? Une vérification sera effectuée.',
        confirmDirectAffiliation: 'Ce club n’a aucun dirigeant :'
          + ' tu en deviendras le dirigeant tout de suite.',
        confirmTitle: 'Tu diriges ce club ?',
      },
      // S02 — la 2e porte parle de CE QU'ON FAIT DE L'INTERET : on previent la
      // personne, et le club voit combien de gens l'attendent. Rien n'est promis
      // d'autre : elle n'est rattachee a rien, et le texte le dit.
      clubArrivalInterest: {
        alreadySentDescription: 'On sait déjà que tu attends ce club.'
          + ' On te prévient dès qu’il arrive.',
        alreadySentTitle: 'Tu es déjà sur la liste',
        description: 'On te prévient dès que ce club arrive sur FoundClub.'
          + ' Tu n’es rattaché·e à rien pour le moment.',
        error: 'Impossible d’enregistrer ton intérêt pour le moment.',
        title: 'C’est noté',
      },
      clubPartnerRequest: {
        // eslint-disable-next-line max-len
        description: "Nous allons contacter le dirigeant de ce club pour l'aider à rejoindre FoundClub.",
        error: "Impossible d'envoyer cette demande pour le moment.",
        invalidEmail: "L'adresse email du dirigeant est invalide.",
        missingContact: 'Ajoute au moins un numéro de téléphone ou un email.',
        missingName: 'Ajoute le prénom et le nom du dirigeant.',
        title: 'Demande envoyée',
      },
      deleteActivity: {
        description: 'Es-tu sûr de vouloir continuer ?',
        title: 'Supprimer le sport {{activityName}} ?',
      },
      deleteManager: {
        actions: {
          cancel: 'Annuler',
          confirm: 'Retirer',
        },
        // eslint-disable-next-line max-len
        description: 'Ce dirigeant ne sera plus rattaché à cette section. Tu pourras le réajouter plus tard si besoin.',
        error: 'Impossible de retirer ce dirigeant pour le moment.',
        title: 'Retirer ce dirigeant ?',
      },
      deleteSponsor: {
        actions: {
          cancel: 'Annuler',
          confirm: 'Supprimer',
        },
        description: 'Es-tu sûr·e de vouloir continuer ?',
        title: 'Tu es sur le point de supprimer le partenaire {{sponsorName}}.',
      },
      deleteTrainer: {
        actions: {
          cancel: 'Annuler',
          confirm: 'Supprimer',
        },
        description: 'Le compte ne sera pas supprimé, mais l\'entraîneur·e ne sera plus lié·e au club. Es-tu sûr·e de vouloir continuer ?',
        error: 'Impossible de retirer cet entraîneur pour le moment.',
        title: 'Tu es sur le point de supprimer cet·te entraîneur·e.',
      },
      inviteTrainer: {
        message: 'Bonjour {{coachName}} !'
          + '\nTu as été désigné·e comme entraîneur·e dans le club {{clubName}}.'
          + "\nTélécharge l'application Found Club pour finaliser la création de ton compte"
          + ' et commencer à gérer tes équipes et tes événements.',
        title: 'Bienvenue sur Found Club !',
      },
      joinClub: {
        actions: {
          ok: 'OK',
        },
        description: 'Ton dirigeant·e va recevoir ta demande et la traiter dès que possible.',
        title: "Ta demande d'adhésion a bien été envoyée",
      },
      leave: {
        actions: {
          cancel: 'Annuler',
          confirm: 'Quitter le club',
        },
        description: "Tu ne seras plus lié·e à ce club ni à ses équipes en tant qu'encadrant·e. Es-tu sûr·e de vouloir continuer ?",
        error: 'Impossible de quitter ce club pour le moment.',
        title: 'Quitter le club ?',
      },
      myClub: {
        actions: {
          cancel: 'Annuler',
          confirm: 'Contacter Found Club',
        },
        description: 'Contacte nos équipes pour accéder aux fonctionnalités réservées aux dirigeant·e·s et aux entraîneur·e·s du club.',
        title: 'Tu es dirigeant·e de ce club ?',
      },
      playerNoTeamRequest: {
        alreadySentDescription: 'Tu attends déjà ce club. On te prévient dès qu’une équipe y est créée.',
        alreadySentTitle: 'Demande déjà envoyée',
        description: 'On a bien noté que tu attends ce club. On te prévient dès qu’une équipe y est créée.',
        error: "Impossible d'envoyer ta demande pour le moment.",
        title: 'Demande envoyée',
      },
      playerTeamJoin: {
        confirmation: 'Une demande sera envoyée pour rejoindre {{teamName}}.',
        description: 'Ta demande pour rejoindre {{teamName}} a été envoyée.',
        error: "Impossible d'envoyer ta demande pour le moment.",
        noTeams: 'Aucune équipe n’est disponible dans ce club pour le moment.',
        title: 'Choisir cette équipe ?',
      },
      update: {
        error: 'Impossible de mettre à jour ce club pour le moment.',
      },
      // V01 — le même geste sur un club QUI EST déjà là. On ne peut pas lui
      // promettre « on te prévient quand il arrive » : il est arrivé. Ce qui
      // l'attend, ce sont des dirigeants qui vont lire son intérêt.
      wholeClubInterest: {
        description: 'Les dirigeants du club ont reçu ton intérêt et pourront te répondre.'
          + ' Tu n’es rattaché·e à rien pour le moment.',
      },
    },
    // 👶 PARENT P3 — une place demandee POUR un enfant, dans une equipe du club.
    childInterest: {
      alreadyPlaced: 'Ton enfant a déjà une équipe.',
      alreadySentShort: 'Demande envoyée',
      cardHint: 'Les responsables accepteront ou refuseront la demande.',
      confirmDescription: 'Les responsables de {{teamName}} verront son prénom et son âge,'
        + ' et pourront accepter ou refuser.',
      confirmTitle: 'Demander une place pour {{firstname}} ?',
      pickerDescription: 'Choisis l’équipe. Ses responsables verront le prénom et l’âge'
        + ' de ton enfant, et pourront accepter ou refuser.',
      pickerTitle: 'Une place pour ton enfant',
      pickerTitleNamed: 'Une place pour {{firstname}}',
      sendAction: 'Demander une place',
      sentDescription: 'Les responsables de {{teamName}} vont examiner la demande pour'
        + ' {{firstname}}. Tu recevras leur réponse.',
      sentTitle: 'Demande envoyée',
    },
    clubInterest: {
      alreadyMember: 'Tu es déjà rattaché à ce club.',
      alreadySent: 'Intérêt déjà envoyé.',
      alreadySentDescription: 'Le staff de cette équipe a déjà reçu ton intérêt.',
      alreadySentShort: 'Intérêt déjà envoyé',
      alreadySentTitle: 'Intérêt déjà envoyé',
      button: 'Intéressé par le club',
      cardHint: 'Le staff pourra répondre avec un message ou ouvrir une conversation.',
      confirmDescription: 'Le staff de {{teamName}} verra ton profil et pourra te répondre.',
      confirmTitle: 'Envoyer ton intérêt ?',
      error: "Impossible d'envoyer ton intérêt pour le moment.",
      // eslint-disable-next-line max-len
      forbidden: "Ton compte n'a pas encore l'autorisation d'envoyer un intérêt. Réessaie dans quelques instants.",
      noTeams: "Aucune équipe n'est disponible dans ce club pour le moment.",
      // eslint-disable-next-line max-len
      pickerDescription: 'Sélectionne une équipe, ou le club en général, pour signaler ton intérêt sans créer de demande d’adhésion.',
      pickerTitle: 'Qu’est-ce qui t’intéresse ?',
      sendAction: 'Envoyer mon intérêt',
      sentDescription: 'Le staff de {{teamName}} a reçu ton intérêt et pourra te répondre.',
      sentTitle: 'Intérêt envoyé',
      teamNotFound: "Cette équipe n'est plus disponible.",
      // eslint-disable-next-line max-len
      wholeClubHint: 'Les dirigeants du club recevront ton intérêt et pourront te répondre ou ouvrir une conversation.',
      wholeClubOption: 'Le club en général',
    },
    clubPartnerRequest: {
      clubLabel: 'Club concerne',
      // eslint-disable-next-line max-len
      description: "Ton club n'est pas encore partenaire FoundClub. Ajoute les coordonnées du dirigeant pour que nous puissions le contacter et lui donner accès au classement, au calendrier et aux statistiques directement dans l'application.",
      fields: {
        holderEmail: 'Email du dirigeant',
        holderFirstname: 'Prénom du dirigeant',
        holderLastname: 'Nom du dirigeant',
        holderPhone: 'Téléphone du dirigeant',
      },
      submit: 'Envoyer la demande',
      title: 'Je dirige ce club',
    },
    clubSelector: {
      title: 'Choisir un club',
    },
    facilities: {
      nameFallback: 'Installation',
    },
    // E17 -- on EXPLIQUE l'absence de la porte au lieu de la faire
    // disparaitre sans un mot.
    hints: {
      teenAsksAlone: 'À partir de 13 ans, ton enfant fait sa demande'
        + ' lui-même depuis son propre compte.',
    },
    hub: {
      coach: 'entraîneur',
      coachs: 'entraîneurs',
      groups: {
        manage: 'Gérer',
        membership: 'Adhésions',
      },
      membership: {
        coachAllowed: 'Délégation',
        ownerOnly: 'Dirigeant',
      },
      owner: 'dirigeant',
      owners: 'dirigeants',
      rows: {
        membershipRequests: "Demandes d'adhésion",
        staff: 'Staff',
      },
    },
    membersHidden: {
      // eslint-disable-next-line max-len
      description: '{{count}} membres sont rattachés à ce club, mais leurs identités ne sont pas visibles publiquement.',
      title: 'Membres masqués par le club',
    },
    playerNoTeamRequest: {
      clubLabel: 'Club que tu attends',
      coachSectionNotice: 'Tu peux laisser vide : ta demande part quand même. Si tu donnes un contact, on le prévient que c’est toi qui nous as transmis ses coordonnées, et on l’efface s’il nous le demande.',
      coachSectionTitle: 'Tu connais ton coach ou un dirigeant ? (facultatif)',
      description: 'Ton club est bien là, mais personne n’y a encore créé d’équipe. Dis-nous que tu l’attends : on contacte le club pour qu’il rejoigne FoundClub, et on te prévient dès qu’une équipe existe.',
      fields: {
        coachContact: 'Contact du coach (téléphone ou e-mail)',
        coachContactPlaceholder: 'Ex: 06 12 34 56 78 ou coach@club.fr',
        coachName: 'Nom de ton coach ou dirigeant',
        coachNamePlaceholder: 'Ex: Karim Benali',
      },
      // S02 — meme motif que `actions.bringClubOver` : ce bouton VALIDE le
      // formulaire de « C’est mon club ». Promettre ici « je te préviens » le
      // rendait indiscernable de la seconde porte.
      submit: 'Envoyer ma demande',
      title: 'Ce club n’a pas encore d’équipe sur FoundClub',
    },
    playerTeamPicker: {
      description: 'Sélectionne ton équipe dans ce club pour envoyer une demande d’affiliation.',
      selectAction: 'Choisir',
      title: 'Choisir mon équipe',
    },
    // AB05 — CE QUE DIT LA FENETRE QUAND « C’EST MON CLUB » EST REFUSÉ.
    // Adel, 2026-08-20 : « il y a écrit "Accès refusé" sans expliquer pourquoi ».
    // « Accès refusé » est un statut HTTP traduit, pas un motif : le filet global
    // le fabrique pour TOUT 403, donc il ne peut rien apprendre à personne.
    // Chaque phrase ci-dessous dit la RAISON puis la SORTIE, et jamais un code.
    // La table qui les choisit vit dans `services/requests/clubAffiliationRefusal.js`.
    refusal: {
      alreadyAsked: 'Tu as déjà demandé ce club. Un administrateur FoundClub est en train de regarder ta demande.',
      clubGone: 'Ce club n’existe plus. Reviens à la recherche pour en trouver un autre.',
      noRole: 'Ton compte n’a pas encore de rôle. Termine ton inscription pour pouvoir dire qu’un club est le tien.',
      sessionExpired: 'Ta session a expiré. Reconnecte-toi, puis renvoie ta demande.',
      // ⛔ Le repli ne PRÉTEND RIEN SAVOIR : il dit ce qui s’est passé (rien
      // n’est parti) et quoi faire. « Une erreur est survenue » ne fait ni l’un
      // ni l’autre.
      unknown: 'Ta demande n’est pas partie. Réessaie dans un instant.',
    },
    state: {
      backToClubs: 'Retour aux clubs',
      loadError: {
        fallback: 'Réessaie dans quelques instants.',
        title: 'Impossible de charger le club',
      },
      loading: 'Chargement du club...',
      notFound: {
        description: 'Le lien est peut-être obsolète ou le club a été supprimé.',
        missingIdDescription: 'Aucun identifiant de club n a été fourni.',
        missingIdTitle: 'Club introuvable',
        title: 'Ce club est introuvable',
      },
      retry: 'Réessayer',
    },
    switchClub: {
      errorFallback: 'Impossible de changer de club pour le moment.',
      errorTitle: 'Erreur',
    },
    tabs: {
      info: 'Informations',
      planning: 'Planning',
    },
    titles: {
      activities: 'Sports',
      coachs: 'Nos entraîneur·e·s',
      members: 'Membres',
      owners: 'Nos dirigeant·e·s',
      sponsors: 'Nos partenaires',
      teams: 'Nos équipes',
    },
  },
  clubEdit: {
    errors: {
      updateFallback: 'Impossible de mettre à jour ce club pour le moment.',
    },
    membership: {
      // eslint-disable-next-line max-len
      description: 'Choisis si toutes les demandes doivent être traitées par le dirigeant, ou si les entraîneurs peuvent être autorisés à gérer celles de leur équipe.',
      mode: {
        coachAllowed: "Délégation à l'entraîneur",
        // eslint-disable-next-line max-len
        coachAllowedDescription: 'Le dirigeant peut déléguer équipe par équipe aux entraîneurs autorisés, tout en gardant une vue complète.',
        ownerOnly: 'Gestion par le dirigeant',
        // eslint-disable-next-line max-len
        ownerOnlyDescription: "Le dirigeant garde la main sur toutes les demandes d'adhésion des équipes du club.",
      },
      title: "Demandes d'adhésion aux équipes",
    },
    publicMembers: {
      // eslint-disable-next-line max-len
      description: 'Choisis si les membres du club peuvent apparaître publiquement sur la page du club.',
      switchLabel: 'Afficher les membres publiquement',
      title: 'Visibilité des membres',
    },
    state: {
      backToClubs: 'Retour aux clubs',
      loadError: {
        fallback: 'Réessaie dans quelques instants.',
        title: 'Impossible de charger le club',
      },
      loading: 'Chargement du club...',
      notFound: {
        description: 'Le lien est peut-être obsolète ou le club a été supprimé.',
        missingIdDescription: 'Aucun identifiant de club n a été fourni.',
        missingIdTitle: 'Club introuvable',
        title: 'Ce club est introuvable',
      },
      retry: 'Réessayer',
    },
    teamCreation: {
      coachAllowed: {
        // eslint-disable-next-line max-len
        description: 'Désactive si tu préfères créer toi-même toutes les équipes du club. Les équipes déjà créées ne changent pas.',
        switchLabel: 'Mes entraîneur·es peuvent créer des équipes',
      },
      requiresValidation: {
        // eslint-disable-next-line max-len
        description: "L'équipe est bien créée, mais elle n'apparaît dans le club qu'une fois que tu l'as validée.",
        switchLabel: 'Leurs équipes doivent être validées par moi',
      },
      title: "Création d'équipes",
    },
    title: 'Modifier le club',
  },
  clubFacilityPlanningContainer: {
    events_one: '{{count}} événement',
    events_other: '{{count}} événements',
  },
  clubFilters: {
    actions: {
      apply: 'Appliquer les filtres',
      clear: 'Effacer les filtres',
    },
    fields: {
      activity: {
        error: 'Impossible de charger la liste des sports pour le moment.',
        label: 'Sport',
        placeholder: 'Sélectionner une activité',
      },
      city: {
        label: 'Ville',
        placeholder: 'Marseille',
      },
      radius: {
        label: 'Dans un rayon autour de : ',
      },
    },
  },
  clubFiltersSheet: {
    allCities: 'Toutes les villes',
    allSports: 'Tous les sports',
  },
  clubInterestRequestService: {
    presets: {
      full: {
        label: 'Équipe complète',
        message: "L'équipe est complété pour le moment, on garde ton profil pour la suite.",
      },
      profile: {
        label: 'Compléter le profil',
        message: 'Peux-tu compléter ton profil et preciser ton poste/niveau ?',
      },
      thanks: {
        label: 'Merci, on revient vers toi',
        message: 'Merci pour ton intérêt, on revient vers toi rapidement.',
      },
      trial: {
        label: 'Proposer un essai',
        message: 'On peut te proposer un essai, envoie-nous tes disponibilités.',
      },
    },
  },
  clubLicenseCampaignSettings: {
    actions: {
      edit: 'Modifier',
    },
    amountField: {
      currency: 'Devise',
      defaultPrice: 'Prix par défaut ({{currency}})',
      hint: 'Saisis simplement un montant, par exemple `250` ou `250,00`.',
    },
    audience: {
      acceptedParticipants: 'Participants acceptés de l événement',
      addRule: '+ Ajouter une règle',
      advancedFilters: {
        categories: 'Categories',
        // eslint-disable-next-line max-len
        description: 'Cette campagne utilise des filtres qui ne sont plus proposés aux nouvelles campagnes. Ils restent modifiables ici.',
        levels: 'Niveaux',
        sections: 'Sections',
        title: 'Filtres avancés',
      },
      amountPerMember: 'MONTANT PAR MEMBRE ({{currency}})',
      concernedToday_one: '{{count}} membre concerné aujourd hui',
      concernedToday_other: '{{count}} membres concernés aujourd hui',
      exemption: 'Exemption',
      noTeams: 'Aucune équipe dans ce club pour le moment.',
      peopleConcerned_one: '{{count}} personne concernée.',
      peopleConcerned_other: '{{count}} personnes concernées.',
      // eslint-disable-next-line max-len
      perPersonNotice: 'La sélection personne par personne demande une évolution du serveur : tout le rôle est concerné pour l instant.',
      role: 'RÔLE CONCERNÉ',
      specialRatesHeader_one: 'TARIFS SPÉCIAUX · {{count}} RÈGLE',
      specialRatesHeader_other: 'TARIFS SPÉCIAUX · {{count}} RÈGLES',
      targetLocked: 'Cible verrouillée sur les participants acceptés de l événement.',
      teamsChecked: '{{teamCount}} équipe(s) cochée(s).',
      wholeClub: 'Tout le club',
      // eslint-disable-next-line max-len
      wholeClubHint: 'Désactive pour cibler un rôle : dirigeants, entraîneurs, ou joueurs par équipes.',
      wholeClubSummary: 'La campagne concernera tout le club.',
    },
    campaignType: {
      equipment: 'Équipement',
      internship: 'Stage',
      license: 'Licence',
      membership: 'Adhésion',
      other: 'Autre',
      tournament: 'Tournoi',
    },
    documentEditor: {
      description: 'Description / consigne',
      descriptionPlaceholder: 'Document officiel, date de moins de 12 mois...',
      dueDate: 'Date limite de dépôt',
      dueDatePlaceholder: 'Sélectionner une date',
      formats: 'Formats acceptes',
      manualApproval: 'Validation manuelle',
      name: 'Nom du document',
      namePlaceholder: 'Certificat medical',
      remove: 'Retirer ce document',
      required: 'Document obligatoire',
      signature: 'Signature demandée',
    },
    documents: {
      add: '+ Demander un document',
      empty: 'Aucun document demandé. Cette étape est facultative.',
    },
    documentSummary: {
      beforeDate: 'avant le {{date}}',
      manualApproval: 'validation manuelle',
      optional: 'Facultatif',
      required: 'Obligatoire',
      signature: 'signature',
    },
    errors: {
      amountRequired: {
        message: 'Le montant par membre doit être supérieur à 0.',
        title: 'Montant obligatoire',
      },
      helloAssoNotReady: 'HelloAsso non prêt',
      incompleteDocument: {
        // eslint-disable-next-line max-len
        draftNames: 'Chaque document commence par un nom. Vide complètement les brouillons inutilisés ou renseigne leur nom.',
        existingNames: 'Renseigne le nom des documents existants avant d enregistrer.',
        title: 'Document incomplet',
      },
      incompletePricingRule: {
        message: 'Complète chaque règle de prix avant de sauvegarder la campagne.',
        title: 'Règle tarifaire incomplète',
      },
      incompleteReminders: {
        message: 'Choisis au moins un statut à relancer automatiquement.',
        title: 'Relances incomplètes',
      },
      incompleteSpecialRate: {
        message: 'Complète ou retire chaque tarif spécial avant de continuer.',
        title: 'Tarif spécial incomplet',
      },
      incompleteTarget: {
        message: 'Choisis au moins un rôle ou une équipe, ou repasse la campagne sur tout le club.',
        title: 'Cible incomplète',
      },
      invalidInstallments: {
        message: 'Le nombre d échéances doit être supérieur ou égal à 1.',
        title: 'Échéancier invalide',
      },
      invalidPeriod: {
        message: 'La date de fin doit être égale ou postérieure à la date de début.',
        title: 'Période invalide',
      },
      missingDate: {
        end: 'Sélectionne une date de fin.',
        start: 'Sélectionne une date de début.',
        title: 'Date manquante',
      },
      missingLink: {
        beforeContinue: 'Ajoute le lien externe du club avant de continuer.',
        beforePublish: 'Ajoute le lien externe du club avant publication.',
        title: 'Lien manquant',
      },
      missingName: {
        message: 'Donne un nom à la campagne avant de continuer.',
        title: 'Nom manquant',
      },
      missingPayment: {
        message: 'Active au moins un moyen de paiement avant de terminer le tunnel.',
        title: 'Paiement manquant',
      },
      missingSeason: {
        message: 'Renseigne la saison de la campagne.',
        title: 'Saison manquante',
      },
    },
    identity: {
      customDates: 'Dates libres',
      description: 'Description visible',
      endDate: 'Date de fin',
      name: 'Nom',
      nameHint: 'Pré-rempli selon le type — modifiable librement.',
      namePlaceholder: 'Cotisation licences 2026/2027',
      period: 'PÉRIODE',
      seasonDetected: 'Saison actuelle détectée — proposée par défaut.',
      seasonOption: 'Saison {{season}}',
      seasonToKeep: 'Saison à conserver',
      startDate: 'Date de début',
      type: 'TYPE',
    },
    installmentFrequency: {
      custom: 'Libre',
      monthly: 'Mensuelle',
      quarterly: 'Trimestrielle',
      weekly: 'Hebdomadaire',
    },
    installments: {
      autoGenerated: 'généré automatiquement',
      singlePayment: 'Paiement en une fois',
    },
    loadError: {
      // eslint-disable-next-line max-len
      description: 'Impossible de charger la campagne. Le formulaire n est pas ouvert pour éviter d ecraser ses paramètres.',
      retry: 'Réessayer',
      title: 'Paramètres indisponibles',
    },
    loading: {
      description: 'On récupère la campagne avant d afficher le formulaire.',
      title: 'Chargement des paramètres',
    },
    payment: {
      cash: 'Espèces',
      cheque: 'Chèque',
      externalLink: {
        hint: 'Le club encaisse sur sa propre page de paiement.',
        label: 'Lien externe du club',
      },
      filledCount: '{{filledCount}} renseignée(s)',
      helloAsso: {
        connected: 'Compte du club connecté ✓ — géré dans Réglages du club',
        label: 'HelloAsso (en ligne)',
        toConnect: 'À connecter dans Réglages du club, depuis l écran Cotisations',
      },
      installments: {
        adjust: 'Ajuster l échéancier',
        count_one: '{{count}} échéance',
        count_other: '{{count}} échéances',
        label: 'Paiement en plusieurs fois',
      },
      instructions: 'Consignes de paiement',
    },
    pricingRuleEditor: {
      amount: 'Montant (EUR)',
      category: 'Catégorie concernee',
      label: 'Libellé interne',
      labelPlaceholder: 'Tarif joueurs seniors',
      level: 'Niveau concerne',
      priority: 'Priorite',
      remove: 'Retirer cette règle',
      roles: 'Rôles concernés',
      ruleType: 'Type de règle',
      section: 'Section concernee',
      team: 'Équipe concernee',
      waiver: 'Exoneration automatique',
    },
    pricingRuleType: {
      category: 'Categorie',
      level: 'Niveau',
      role: 'Role',
      section: 'Section',
      team: 'Equipe',
    },
    reminderPreview: {
      // eslint-disable-next-line max-len
      defaultTemplate: 'Bonjour {{firstname}}, il te reste {{amountRemaining}} à régler pour {{campaignName}} avant le {{dueDate}}.',
      sampleCampaignName: 'Cotisation FoundClub',
    },
    reminders: {
      adjustFrequency: 'Ajuster la cadence',
      auto: 'Relancer automatiquement',
      daysBefore: '{{days}} jours avant l échéance',
      first: 'Première',
      frequency: 'Cadence',
      frequencySummary: 'Tous les {{days}} jours · {{max}} max',
      message: 'Message de relance',
      messagePlaceholder: 'Rappel: ta cotisation reste à régler.',
      noStatus: 'Aucun statut',
      onDueDate: 'Le jour de l échéance',
      preview: 'Aperçu du message',
      statuses: 'Statuts',
      stopHint: 'Arrêt dès que c est payé.',
    },
    reminderStatus: {
      manualReview: 'À valider',
      overdue: 'En retard',
      partial: 'Partiel',
      pending: 'À payer',
    },
    review: {
      advancedOptions: 'Options avancées',
      amount: 'Montant',
      amountPerMember: '{{amount}} par membre',
      audience: {
        eventParticipants: 'Participants de l événement',
        label: 'Public',
        memberCount_one: '{{count}} membre',
        memberCount_other: '{{count}} membres',
        players: 'Joueurs · {{teamCount}} équipe(s)',
        selection: 'Sélection',
        wholeClub: 'Tout le club · {{suffix}}',
      },
      autoReminders: 'Relances auto',
      disabled: 'Désactivées',
      documentCount: '{{documentCount}} document(s)',
      enabled: 'Activées',
      installmentPlan: 'Échéancier',
      instructions: 'Consignes',
      internalNote: 'Note interne',
      methods: 'Moyens',
      multisportCollection: 'Encaissement multisport',
      multisportHint: 'Les paiements en ligne passent par le compte central du multisport.',
      noDocuments: 'Aucun',
      noMethod: 'Aucun moyen actif',
      none: 'Aucune',
      // eslint-disable-next-line max-len
      noParentMultisport: 'Aucun multisport parent n est rattaché à ce club. Le paiement central ne pourra pas être validé.',
      overdueAfter: 'Marquer en retard après le (optionnel)',
      period: 'Période',
      requestedDocuments: 'Pièces demandées',
      ruleCount: '{{ruleCount}} règle(s)',
      scheduleOpening: 'Programmer l ouverture (optionnel)',
      singlePrice: 'Prix unique',
      specialRates: 'Tarifs spéciaux',
      toFill: 'À renseigner',
      type: 'Type',
    },
    reviewSection: {
      editA11y: 'Modifier {{title}}',
    },
    save: {
      draft: {
        message: 'Le brouillon est sauvegarde. Tu pourras le reprendre avant publication.',
        title: 'Brouillon enregistre',
      },
      failed: {
        message: 'Impossible de sauvegarder cette campagne pour le moment.',
        title: 'Campagne impossible',
      },
      opened: {
        // eslint-disable-next-line max-len
        message: 'La campagne est ouverte et les membres concernés sont synchronises automatiquement.',
        title: 'Campagne ouverte',
      },
      partial: {
        // eslint-disable-next-line max-len
        message: 'La campagne est sauvee, mais certains documents ou providers demandent une vérification.',
        title: 'Campagne enregistrée partiellement',
      },
      progress: {
        attachments: 'Documents et tarifs en cours d envoi...',
        campaign: 'Enregistrement de la campagne...',
        template: 'Envoi du modèle à télécharger...',
      },
      scheduled: {
        message: 'La campagne est publiée et s ouvrira automatiquement à sa date de début.',
        title: 'Campagne programmee',
      },
    },
    selectionGroup: {
      empty: 'Aucune option disponible pour ce filtre.',
    },
    sheet: {
      cancel: 'Annuler',
      done: 'Terminé',
    },
    sheets: {
      description: {
        // eslint-disable-next-line max-len
        hint: 'Choisis un modèle pour pré-remplir le texte, puis ajuste-le. Appuie une deuxième fois pour le retirer.',
        label: 'Texte visible par les membres',
        placeholder: 'Informations visibles par les membres',
        template: 'Modèle {{number}}',
      },
      documentRequest: {
        title: 'Document demandé',
      },
      installments: {
        allowOnlineSplit: 'Autoriser le fractionnement en ligne',
        count: 'Nombre d échéances',
        frequency: 'Fréquence',
        memberChooses: 'Le membre choisit son nombre d échéances',
        onlineRequired: 'Paiement en ligne obligatoire',
        preview: 'Aperçu de l échéancier',
        regenerate: 'Régénérer depuis le montant',
        total: 'Total',
      },
      internalNote: {
        note: 'Note {{number}}',
        visibility: 'Visible uniquement en gestion',
      },
      paymentInstructions: {
        bankTransfer: 'Virement',
        bankTransferPlaceholder: 'IBAN, référence à indiquer...',
        card: 'Carte au club',
        cardPlaceholder: 'Terminal, permanences...',
        cashPlaceholder: 'Lieu, horaires, personne à contacter...',
        chequePlaceholder: 'Ordre, dépôt, référence...',
      },
      reminderTiming: {
        everyDays: 'Tous les (jours)',
        firstReminderFrom: 'Première relance à partir du (optionnel)',
        maximum: 'Maximum',
        onDueDate: 'Relance le jour de l échéance',
        resumeAfter: 'Reprendre X jours après l échéance',
        startBefore: 'Commencer X jours avant l échéance',
        statuses: 'STATUTS À RELANCER',
      },
    },
    specialRate: {
      defaultLabel: 'Tarif spécial',
      defaultScope: 'Cible',
    },
    status: {
      filled: 'Renseignée',
      toFill: 'À remplir',
    },
    steps: {
      audience: {
        subtitle: 'Qui paie, et combien. Le montant est obligatoire.',
        title: 'Public & tarif',
      },
      documents: {
        subtitle: 'Les pièces à fournir. Étape facultative.',
        title: 'Documents',
      },
      identity: {
        subtitle: 'Nom, type et saison — le reste a des défauts sûrs.',
        title: 'Identité',
      },
      payment: {
        subtitle: 'Comment les membres peuvent régler.',
        title: 'Paiement',
      },
      reminders: {
        subtitle: 'On relance tant que ce n est pas payé.',
        title: 'Relances',
      },
      review: {
        subtitle: 'Relis, corrige, puis ouvre — tout reste modifiable après.',
        title: 'Récapitulatif',
      },
    },
    suggestionCard: {
      selected: 'Sélectionnée',
    },
    suggestions: {
      descriptions: {
        equipment: {
          // eslint-disable-next-line max-len
          one: 'Cette campagne concerne les équipements pour la saison {{season}}. Merci de finaliser ton règlement dans les délais indiques par le club.',
          three: 'Cette cotisation couvre les équipements prévus pour la saison {{season}}.',
          // eslint-disable-next-line max-len
          two: 'Retrouve ici les informations de paiement liées aux équipements de la saison {{season}}.',
        },
        internship: {
          // eslint-disable-next-line max-len
          one: 'Cette campagne concerne la participation au stage {{season}}. Merci de suivre les modalités de paiement indiquées par le club.',
          three: 'Cette cotisation permet de confirmer l inscription au stage {{season}}.',
          two: 'Retrouve ici les informations de règlement pour le stage de la saison {{season}}.',
        },
        license: {
          // eslint-disable-next-line max-len
          one: 'Cette campagne concerne les licences pour la saison {{season}}. Merci de compléter ton dossier et ton paiement dans les délais.',
          three: 'Cette cotisation permet de finaliser la licence pour la saison {{season}}.',
          // eslint-disable-next-line max-len
          two: 'Retrouve ici les informations de paiement et les documents à fournir pour la licence {{season}}.',
        },
        membership: {
          // eslint-disable-next-line max-len
          one: 'Cette campagne concerne les adhésions pour la saison {{season}}. Merci de compléter ton dossier et ton règlement.',
          three: "Cette cotisation permet de valider l'adhésion à la saison {{season}}.",
          two: 'Retrouve ici les informations nécessaires pour régler ton adhésion {{season}}.',
        },
        other: {
          // eslint-disable-next-line max-len
          one: 'Merci de retrouver ici toutes les informations utiles pour cette campagne {{season}}.',
          three: 'Merci de compléter ton règlement selon les consignes indiquées par le club.',
          // eslint-disable-next-line max-len
          two: 'Cette campagne regroupe les modalités de paiement et les informations visibles par les membres.',
        },
        tournament: {
          // eslint-disable-next-line max-len
          one: 'Cette campagne concerne la participation au tournoi {{season}}. Merci de suivre les modalités indiquées pour valider ton inscription.',
          three: 'Cette cotisation permet de confirmer la participation au tournoi {{season}}.',
          two: 'Retrouve ici les informations de règlement pour le tournoi {{season}}.',
        },
      },
      names: {
        equipment: {
          one: 'Cotisation équipements {{season}}',
          three: 'Équipements {{season}}',
          two: 'Campagne équipements {{season}}',
        },
        internship: {
          one: 'Participation stage {{season}}',
          three: 'Stage {{season}}',
          two: 'Campagne stage {{season}}',
        },
        license: {
          one: 'Cotisation licences {{season}}',
          three: 'Licences {{season}}',
          two: 'Campagne licences {{season}}',
        },
        membership: {
          one: 'Cotisation adhésions {{season}}',
          three: 'Adhésions {{season}}',
          two: 'Campagne adhésion {{season}}',
        },
        other: {
          one: 'Cotisation {{season}}',
          three: 'Paiement {{season}}',
          two: 'Campagne {{season}}',
        },
        tournament: {
          one: 'Participation tournoi {{season}}',
          three: 'Tournoi {{season}}',
          two: 'Campagne tournoi {{season}}',
        },
      },
      notes: {
        equipment: {
          // eslint-disable-next-line max-len
          one: 'Suivi interne {{season}} : vérifier les tailles, les stocks et les règlements avant de lancer la commande équipement.',
          // eslint-disable-next-line max-len
          three: 'Note staff : centraliser ici les cas particuliers, remises et commandes à confirmer.',
          // eslint-disable-next-line max-len
          two: 'Campagne équipement {{season}} : valider les paiements reçus avant remise des articles.',
        },
        internship: {
          // eslint-disable-next-line max-len
          one: 'Suivi stage {{season}} : vérifier les dossiers complets, les paiements reçus et les places restantes.',
          // eslint-disable-next-line max-len
          three: 'Note équipe : suivre ici les exemptions, paiements manuels et confirmations de participation.',
          // eslint-disable-next-line max-len
          two: 'Campagne stage {{season}} : relancer les familles en attente avant validation finale.',
        },
        license: {
          // eslint-disable-next-line max-len
          one: 'Suivi licences {{season}} : vérifier les documents manquants et relancer avant validation finale.',
          // eslint-disable-next-line max-len
          three: 'Note dirigeants : utiliser cet espace pour les cas particuliers, exemptions et relances prioritaires.',
          // eslint-disable-next-line max-len
          two: 'Campagne licences {{season}} : rapprocher les paiements manuels chaque semaine et signaler les dossiers incomplets.',
        },
        membership: {
          // eslint-disable-next-line max-len
          one: 'Suivi adhésions {{season}} : vérifier les paiements reçus et les demandes en attente de validation.',
          three: 'Note gestion : confirmer chaque adhésion après reception du règlement complet.',
          // eslint-disable-next-line max-len
          two: 'Campagne adhésions {{season}} : noter ici les cas particuliers, remises et suivis à faire avec les familles.',
        },
        other: {
          // eslint-disable-next-line max-len
          one: 'Suivi interne {{season}} : centraliser ici les points de vigilance et les relances à effectuer.',
          three: 'Rappel gestion : vérifier les dossiers incomplets avant clôture de la campagne.',
          // eslint-disable-next-line max-len
          two: 'Note staff : utiliser cet espace pour les exceptions, paiements manuels et commentaires de suivi.',
        },
        tournament: {
          // eslint-disable-next-line max-len
          one: 'Suivi tournoi {{season}} : vérifier les inscriptions, paiements reçus et confirmations avant clôture.',
          // eslint-disable-next-line max-len
          three: 'Note organisation : centraliser les suivis de paiement et de validation dans cet espace.',
          // eslint-disable-next-line max-len
          two: 'Campagne tournoi {{season}} : noter ici les équipes à relancer et les cas particuliers à traiter.',
        },
      },
    },
    targetRoles: {
      clubManagers: 'Dirigeants',
      coaches: 'Entraîneurs',
      players: 'Joueurs',
    },
    template: {
      add: 'Ajouter un modèle',
      heading: 'MODÈLE À TÉLÉCHARGER',
      none: 'Aucun modèle',
      // eslint-disable-next-line max-len
      notice: 'Facultatif. Ce fichier est visible et téléchargeable par tous les membres concernés par la campagne — n y mets aucune pièce personnelle.',
      remove: 'Retirer le modèle',
      replace: 'Remplacer le modèle',
      unavailable: {
        message: 'Ce fichier n a pas pu être lu.',
        title: 'Modèle indisponible',
      },
      view: 'Voir le modèle',
    },
    wizard: {
      newCampaign: 'Nouvelle campagne',
      next: 'Suivant',
      open: 'Ouvrir la campagne',
      save: 'Enregistrer',
      saveDraft: 'Enregistrer en brouillon',
      schedule: 'Programmer la campagne',
      skipStep: 'Passer cette étape',
    },
  },
  clubLicenseMemberDetail: {
    actionModal: {
      amountPlaceholder: 'Montant en euros',
      noteOptional: 'Note optionnelle',
      paymentMethod: 'Moyen de paiement',
      reasonMissing: 'Explique en un mot ce qui ne va pas : le membre recevra ce motif.',
      reasonRequired: 'Motif obligatoire',
      submit: 'Valider',
    },
    actions: {
      changeAmount: 'Modifier le montant',
      markDue: 'À payer',
      markPaid: 'A payé',
      remind: 'Relancer',
      title: 'Actions',
      waive: 'Exempter la cotisation',
    },
    alerts: {
      approveDocument: {
        confirm: 'Accepter',
        errorFallback: 'Le serveur a refusé cette acceptation. Réessaie dans un instant.',
        errorTitle: 'Document non accepté',
        message: 'Confirmer que ce document est conforme ?',
        successMessage: 'Le membre est prévenu que sa pièce est conforme.',
        successTitle: 'Document accepté',
      },
      approvePayment: {
        message: 'Confirmer que le club a bien reçu ce paiement ?',
        title: 'Valider le paiement déclare',
      },
      document: {
        downloadFailedFallback: 'Le document n a pas pu être enregistré sur ton téléphone.',
        downloadFailedTitle: 'Téléchargement impossible',
        unavailableMessage: 'Aucun fichier exploitable n est rattaché à ce dépôt.',
        unavailableTitle: 'Document indisponible',
      },
      officialLicense: {
        // eslint-disable-next-line max-len
        addedMessage: 'La licence officielle est maintenant disponible pour les personnes autorisées.',
        addedTitle: 'Licence ajoutée',
        chooseImage: 'Choisir une image',
        chooseImageFailed: 'La photo n a pas pu être choisie.',
        importFile: 'Importer un fichier',
        importFileFailed: 'Le fichier n a pas pu être choisi.',
        pickMessage: 'Choisis une source pour importer la licence officielle.',
        takePhoto: 'Prendre une photo',
        takePhotoFailed: 'La photo n a pas pu être prise.',
        uploadFailedTitle: 'Upload impossible',
      },
      receipt: {
        message: 'Le reçu est maintenant rattache à ce paiement.',
        title: 'Reçu génère',
      },
      reminderSent: 'Relance envoyée',
      replaceRequest: {
        fallback: 'Le serveur a refusé cette demande de remplacement.',
        title: 'Demande non envoyée',
      },
      setBackToDue: {
        errorFallback: 'Le serveur a refusé ce changement.',
        errorTitle: 'Remise à payer impossible',
        messageAmount: '{{memberName}} devra régler {{amount}}. ',
        messageExemption: 'L exemption est annulée, les relances redeviennent possibles, ',
        messageNotice: 'et la personne en est prévenue.',
        successMessageEnd: 'et tu peux de nouveau relancer.',
        successMessageStart: '{{memberName}} n est plus exempté·e : le reste à payer est rétabli ',
        successTitle: 'Cotisation à payer',
        title: 'Remettre cette cotisation à payer ?',
      },
    },
    buttons: {
      approve: 'Valider',
      cancel: 'Annuler',
      reject: 'Rejeter',
    },
    coachView: {
      // eslint-disable-next-line max-len
      description: 'Les validations de paiement, exemptions et modifications de montant sont réservées aux dirigeants.',
      title: 'Vue entraîneur',
    },
    documents: {
      accept: 'Accepter ce document',
      descriptionCoach: 'Statut des pièces rattachées à cette cotisation.',
      descriptionManager: 'Valide ou redemande les pièces fournies par le membre.',
      download: 'Télécharger',
      dueBefore: 'A remettre avant {{dueDate}}',
      emptyDescription: 'Aucune pièce n est demandée pour cette campagne.',
      emptyTitle: 'Pas de documents',
      fallbackName: 'Document',
      noDeadline: 'Pas de date limite définie',
      noneSubmitted: 'Aucun document déposé',
      open: 'Ouvrir le document',
      optionalSuffix: ' - Facultatif',
      requestReplacement: 'Demander un remplacement',
      requiredSuffix: ' - Obligatoire',
      title: 'Documents',
    },
    error: {
      description: 'Impossible de charger cette fiche cotisation pour le moment.',
      retry: 'Réessayer',
      title: 'Fiche indisponible',
    },
    header: {
      noTeam: 'Sans équipe',
    },
    history: {
      date: 'Date',
      emptyDescription: 'Aucun paiement n est encore rattache à cette cotisation.',
      emptyTitle: 'Aucun historique',
      generateReceipt: 'Générer un reçu',
      method: 'Methode',
      paymentFallback: 'Paiement',
      receiptNumber: 'Recu {{receiptNumber}}',
      refund: 'Rembourser',
      refundLine: 'Remboursement {{amount}} - {{status}}',
      title: 'Historique',
    },
    lastUpdated: 'Dernière mise à jour {{date}}',
    loading: {
      description: 'On récupère la cotisation et les droits associes.',
      title: 'Chargement de la fiche',
    },
    memberFallback: 'Membre',
    metrics: {
      paid: 'Paye',
      remaining: 'Reste',
      total: 'Total',
    },
    modalTitles: {
      recordPayment: 'Valider un paiement',
      refund: 'Rembourser le paiement',
      reject: 'Rejeter la déclaration',
      requestNewDocument: 'Demander un nouveau document',
      reviewDocument: 'Revoir le document',
    },
    notFound: {
      description: 'Cette cotisation est introuvable ou n est plus accessible.',
      title: 'Cotisation introuvable',
    },
    officialLicense: {
      add: 'Ajouter la licence',
      descriptionCoach: 'Consulte la licence officielle de cet adherent si elle est disponible.',
      descriptionManager: 'Ajoute ou remplace la licence officielle de cet adherent.',
      download: 'Télécharger la licence',
      none: 'Aucune licence officielle n est encore disponible.',
      open: 'Ouvrir la licence',
      replace: 'Remplacer la licence',
      title: 'Licence officielle',
    },
    paymentStatus: {
      cancelled: 'Annule',
      confirmed: 'Valide',
      failed: 'Echoue',
      manualReview: 'A valider',
      partiallyRefunded: 'Remboursement partiel',
      pending: 'En attente',
      refunded: 'Rembourse',
      rejected: 'Rejete',
    },
    pendingPayments: {
      declaredAmount: 'Montant déclare',
      descriptionCoach: 'Déclarations en attente de validation par un dirigeant.',
      // eslint-disable-next-line max-len
      descriptionManager: 'Ces déclarations viennent du joueur ou d un payeur externe et doivent être controlees.',
      noMethod: 'Méthode non précisée',
      noReference: 'Aucune référence fournie.',
      titleCoach: 'Paiements declares',
      titleManager: 'Paiements à valider',
    },
    receipts: {
      amount: 'Montant',
      emptyDescription: 'Les reçus apparaîtront ici après validation des paiements.',
      emptyTitle: 'Aucun reçu',
      issued: 'Emission',
      number: 'Numero',
      title: 'Recus',
    },
    schedule: {
      title: 'Echeancier',
    },
  },
  clubLicensePayments: {
    alerts: {
      approvePayment: {
        message: 'Confirmer que le club a bien reçu ce paiement ?',
        title: 'Valider le paiement déclare',
      },
    },
    buttons: {
      approve: 'Valider',
      cancel: 'Annuler',
      reject: 'Rejeter',
    },
    card: {
      declared: 'Declare',
      noTeam: 'Sans équipe',
      openMember: 'Ouvrir la fiche membre',
      reference: 'Reference',
    },
    empty: {
      description: 'Aucune déclaration de paiement n attend de validation.',
      title: 'Tout est propre',
    },
    error: {
      description: 'Impossible de charger les paiements à valider.',
      retry: 'Réessayer',
      title: 'Paiements indisponibles',
    },
    header: {
      subtitle: 'Controle les déclarations externes avant de les passer en encaisse.',
      title: 'Paiements à valider',
    },
    list: {
      title: 'A traiter',
    },
    loading: {
      description: 'On charge les déclarations en attente.',
      title: 'Chargement',
    },
    memberFallback: 'Membre',
    metrics: {
      amount: 'Montant',
      declarations: 'Declarations',
      records: 'Dossiers',
    },
    rejectModal: {
      reasonRequired: 'Motif obligatoire',
      title: 'Rejeter la déclaration',
    },
    restricted: {
      description: 'La validation des paiements est réservée aux dirigeants.',
      title: 'Action réservée',
    },
  },
  clubLicenses: {
    actions: {
      archive: 'Archiver',
      cancel: 'Annuler',
      close: 'Fermer',
      delete: 'Supprimer',
      duplicate: 'Dupliquer',
      edit: 'Modifier',
      end: 'Clore',
      open: 'Ouvrir',
      pause: 'Mettre en pause',
      remind: 'Relancer',
      reopen: 'Reouvrir',
      resume: 'Reprendre',
      settings: 'Parametres',
    },
    alerts: {
      bulkReminder: {
        failedMessage: "Les relances n'ont pas pu être envoyées.",
        message: 'Envoyer une relance aux cotisations en attente, partielles ou en retard ?',
        // eslint-disable-next-line max-len
        sentMessage: 'Les membres en attente, en paiement partiel ou en retard ont reçu une relance.',
        sentTitle: 'Relances envoyées',
        title: 'Relancer les non-payeurs',
      },
      deleteCampaign: {
        canArchive: "Tu peux l'archiver : elle sort de la liste, et rien n'est perdu.",
        closeFirst: "Clos-la d'abord, puis archive-la : elle sortira de la liste sans rien perdre.",
        doneNoFees: '« {{name}} » est supprimée. Elle ne portait aucune cotisation.',
        doneTitle: 'Campagne supprimée',
        doneWithFeesEnd_one: 'cotisation.',
        doneWithFeesEnd_other: 'cotisations.',
        doneWithFeesStart: '« {{name}} » est supprimée, avec ses {{fees}} ',
        lostFees_one: ', avec ses {{count}} cotisation.',
        lostFees_other: ', avec ses {{count}} cotisations.',
        messageIrreversible: 'Cette action est irréversible.',
        messageNoPayment: "\n\nAucun paiement n'a été encaissé : rien d'autre ne sera perdu. ",
        messageStart: '« {{name}} » sera définitivement supprimée{{lostFees}}',
        refusedEnd: "On ne supprime pas une campagne qui porte de l'argent.\n\n{{nextStep}}",
        refusedMembers_one: 'auprès de {{count}} membre. ',
        refusedMembers_other: 'auprès de {{count}} membres. ',
        refusedStart: '« {{name}} » a déjà encaissé {{amount}} ',
        title: 'Supprimer cette campagne ?',
      },
      deleteDraft: {
        doneEnd: 'aucune cotisation ne disparaît avec lui.',
        doneStart: "« {{name}} » est supprimé. Un brouillon n'ayant jamais été ouvert, ",
        doneTitle: 'Brouillon supprimé',
        message: 'Supprimer definitivement cette campagne non lancée ?',
        nameFallback: 'Ce brouillon',
        title: 'Supprimer le brouillon',
      },
      deleteFailedMessage: 'La suppression a échoué.',
      deleteFailedTitle: 'Suppression impossible',
      duplicate: {
        doneMessageEnd: "« {{name}} » n'a pas bougé.",
        doneMessageStart: "« {{copyName}} » t'attend en brouillon, à ouvrir quand tu veux. ",
        doneTitle: 'Copie créée',
        failedMessage: "La copie n'a pas pu être créée.",
        failedTitle: 'Duplication impossible',
        message: 'Créer une copie en brouillon avec les mêmes réglages ?',
        pending: 'Duplication en cours...',
        title: 'Dupliquer la campagne',
      },
      noCampaign: {
        message: 'Crée ou ouvre une campagne pour consulter les membres relies à ces indicateurs.',
        title: 'Aucune campagne disponible',
      },
      reminderFailedTitle: 'Relance impossible',
      restricted: {
        remindMessage: 'Seuls les dirigeants peuvent envoyer une relance individuelle.',
        setBackToDueMessage: 'Seuls les dirigeants peuvent remettre une cotisation à payer.',
        title: 'Action réservée',
      },
      setBackToDue: {
        doneMessage: '{{memberName}} doit de nouveau régler sa cotisation.',
        doneTitle: 'Cotisation à payer',
        failedMessage: 'La cotisation n a pas pu être remise à payer.',
        failedTitle: 'Geste impossible',
        // eslint-disable-next-line max-len
        message: '{{memberName}} devra de nouveau régler cette cotisation. L exemption sera retirée.',
        title: 'Remettre à payer',
      },
      singleReminder: {
        failedMessage: 'La relance n a pas pu être envoyée.',
        message: 'Envoyer une relance individuelle a {{memberName}} ?',
        sentMessage: '{{memberName}} a bien été relance.',
        sentTitle: 'Relance envoyée',
        title: 'Relancer ce membre',
      },
    },
    assignment: {
      markPaid: 'A payé',
      noTeam: 'Sans équipe',
      remaining: 'reste',
      setBackToDue: 'À payer',
    },
    campaignActions: {
      manage: 'Gérer la campagne',
      manageWith: '{{action}} la campagne',
    },
    campaignCard: {
      collected: 'Encaissé',
      collectedValue: '{{paid}} sur {{expected}}',
      current: 'Suivi actuel',
      documentsCount_one: '{{count}} demandé',
      documentsCount_other: '{{count}} demandés',
      membersValue: '{{total}} · {{overdue}} en retard',
      moreActionsHint: 'Dupliquer, mettre en pause ou modifier cette campagne.',
      moreActionsLabel: 'Autres actions pour la campagne {{name}}',
      nameFallback: 'Campagne',
      noDocuments: 'Aucun demandé',
      perMember: ' · {{amount}} par membre',
      selected: 'Campagne ouverte',
      toConfigure: 'A configurer',
      untitled: 'sans nom',
      viewDetails: 'Voir le détail',
    },
    campaigns: {
      count: 'Campagnes · {{campaigns}}',
      new: 'Nouvelle campagne',
      newHint: 'Ouvre le tunnel de creation d une campagne de cotisation.',
      newTile: '+ Nouvelle campagne',
      others: 'Autres campagnes',
    },
    campaignStatus: {
      active: 'Ouverte',
      archived: 'Archivée',
      closed: 'Terminée',
      draft: 'Brouillon',
      paused: 'En pause',
      scheduled: 'Programmée',
    },
    campaignTypes: {
      equipment: 'Equipement',
      internship: 'Stage',
      license: 'Licence',
      membership: 'Adhesion',
      other: 'Autre',
      tournament: 'Tournoi',
    },
    dashboard: {
      tracking: 'Suivi de campagne',
      viewAll: 'Voir toutes les campagnes',
    },
    documents: {
      dueBefore: 'avant le {{date}}',
      fallbackName: 'Document',
      required: 'obligatoire',
    },
    documentsTab: {
      missing: {
        description: 'Dossiers encore incomplets à traiter en priorité.',
        title: 'Documents manquants',
      },
      missingCount: 'Manquants: {{missing}}',
      missingLabel: 'Manquant',
      noMissing: 'Aucun document manquant dans cet aperçu.',
      noRequested: 'Aucun document demande.',
      noReview: 'Aucun document n attend de vérification dans cet aperçu.',
      remaining: '{{amount}} restant',
      requested: {
        description: 'Pièces exigees par la campagne et état global des dossiers membres.',
        title: 'Documents demandes',
      },
      review: {
        description: 'Membres dont les documents ont besoin d une action humaine.',
        title: 'Dossiers à vérifier',
      },
      status: {
        description: 'Vue d ensemble des statuts documentaires des membres sur cette campagne.',
        title: 'État des dossiers',
      },
      submittedCount: 'Deposes: {{submitted}}',
      toCheck: 'Document à vérifier',
      toReplaceCount: 'A remplacer: {{toReplace}}',
      validatedCount: 'Valides: {{validated}}',
    },
    documentStatus: {
      missing: 'Document manquant',
      none: 'Aucun document',
      refused: 'Document refuse',
      submitted: 'Document déposé',
      toReplace: 'Document à remplacer',
      validated: 'Document valide',
    },
    emptyStates: {
      // eslint-disable-next-line max-len
      coachDescription: 'Vue limitée aux équipes que tu entraines. Les actions financieres restent réservées aux dirigeants.',
      coachTitle: 'Vue entraîneur',
      errorDescription: 'Impossible de charger la campagne ou les cotisations pour le moment.',
      errorTitle: 'Cotisations indisponibles',
      // eslint-disable-next-line max-len
      noCampaignDescription: 'Un dirigeant doit d abord créer et activer une campagne de cotisation.',
      noCampaignTitle: 'Aucune campagne active',
      retry: 'Réessayer',
    },
    errors: {
      switchClub: 'Impossible de changer de club pour le moment.',
      title: 'Erreur',
    },
    filterModal: {
      apply: 'Appliquer',
      // eslint-disable-next-line max-len
      description: 'Affiche seulement les cotisations qui t interessent, par équipe, rôle, catégorie, niveau ou état documentaire.',
      reset: 'Reinitialiser',
      title: 'Filtrer les membres',
    },
    filters: {
      all: 'Tous',
    },
    header: {
      campaignFallbackTitle: 'Campagne cotisation',
      chooseClub: 'Choisir un club',
      detailSubtitle: 'Detail complet de la campagne {{name}}.',
      selectedFallback: 'selectionnee',
      title: 'Cotisations',
    },
    helloAsso: {
      checkFailedMessage: 'La vérification HelloAsso a échoué.',
      checkFailedTitle: 'Vérification HelloAsso impossible',
      connected: 'Connecté ✓',
      readyTitle: 'HelloAsso prêt',
      settingsHint: 'Connecte le compte HelloAsso du club, une fois pour toutes.',
      settingsTitle: 'Réglages du club — HelloAsso',
      toCheckTitle: 'HelloAsso à vérifier',
      toConnect: 'À connecter',
    },
    helloAssoReadiness: {
      checkoutFailed: 'Test checkout en erreur',
      credentialsMissing: 'Configuration incomplète',
      disabled: 'Desactive',
      oauthFailed: 'OAuth en erreur',
      pending: 'A vérifier',
      ready: 'Pret',
      webhookPending: 'Webhook à confirmer',
      webhookStale: 'Webhook à vérifier',
    },
    helloAssoSheet: {
      clientIdEnter: 'Renseigne le client id',
      clientIdKeep: 'Laisser vide pour conserver l identifiant actuel',
      clientSecretEnter: 'Renseigne le client secret',
      clientSecretKeep: 'Laisser vide pour conserver le secret actuel',
      environmentLabel: 'Environnement',
      environmentPlaceholder: 'production ou sandbox',
      // eslint-disable-next-line max-len
      intro: 'À renseigner une seule fois pour le club. Toutes les campagnes s y connectent ensuite d un simple interrupteur.',
      slugLabel: 'Slug organisation',
      slugPlaceholder: 'mon-club',
      verify: 'Vérifier la connexion',
    },
    installmentFrequency: {
      custom: 'Libre',
      monthly: 'Mensuelle',
      quarterly: 'Trimestrielle',
      weekly: 'Hebdo',
    },
    installments: {
      single: 'Paiement en une fois',
      summary: '{{installments}} échéance(s) - {{frequency}}',
    },
    lifecycle: {
      archive: {
        description: 'La campagne restera consultable dans les archives.',
        doneEnd: 'dans les archives.',
        doneStart: "sort de la liste. Rien n'est perdu : elle reste consultable ",
        doneTitle: 'Campagne archivée',
        failedTitle: 'Archivage impossible',
        pending: 'Archivage en cours...',
        title: 'Archiver la campagne',
      },
      close: {
        // eslint-disable-next-line max-len
        description: 'Les relances et les paiements resteront visibles, mais la campagne passe en fin de cycle.',
        doneEnd: 'les paiements déjà encaissés et les relances restent consultables.',
        doneStart: "passe en fin de cycle. Plus aucun membre n'y sera ajouté ; ",
        doneTitle: 'Campagne close',
        failedTitle: 'Clôture impossible',
        pending: 'Clôture en cours...',
        title: 'Clore la campagne',
      },
      doneMessage: '« {{name}} » {{description}}',
      launch: {
        // eslint-disable-next-line max-len
        description: 'La campagne devient active et synchronise automatiquement les membres concernés.',
        doneEnd: 'y sont ajoutés automatiquement.',
        doneStart: 'est ouverte. Les joueurs peuvent payer, et les membres concernés ',
        doneTitle: 'Campagne ouverte',
        failedTitle: 'Ouverture impossible',
        pending: 'Ouverture en cours, les membres sont ajoutés...',
        title: 'Ouvrir la campagne',
      },
      nameFallback: 'Cette campagne',
      openAgainStart: 'est de nouveau ouverte. Les joueurs peuvent payer, et les membres ',
      pause: {
        // eslint-disable-next-line max-len
        description: 'La campagne reste visible, mais bloque les ajouts auto, les relances et les paiements membres.',
        doneEnd: 'Tu peux la reprendre quand tu veux.',
        doneMiddle: "automatiques s'arrêtent et aucun membre n'y sera ajouté. ",
        doneStart: 'est en pause : les joueurs ne peuvent plus payer, les relances ',
        doneTitle: 'Campagne en pause',
        failedTitle: 'Mise en pause impossible',
        pending: 'Mise en pause en cours...',
        title: 'Mettre la campagne en pause',
      },
      reopen: {
        description: 'La campagne redevient active et resynchronise les membres concernés.',
        doneEnd: 'concernés y sont rajoutés automatiquement.',
        doneTitle: 'Campagne réouverte',
        failedTitle: 'Réouverture impossible',
        pending: 'Réouverture en cours, les membres sont ajoutés...',
        title: 'Reouvrir la campagne',
      },
      resume: {
        // eslint-disable-next-line max-len
        description: 'La campagne redevient active et resynchronise automatiquement les membres éligibles.',
        doneEnd: 'éligibles y sont rajoutés automatiquement.',
        doneTitle: 'Campagne reprise',
        failedTitle: 'Reprise impossible',
        pending: 'Reprise en cours...',
        title: 'Reprendre la campagne',
      },
      serverRefused: 'Le serveur a refusé ce changement.',
    },
    list: {
      empty: 'Aucune cotisation pour ces filtres ou cette recherche.',
    },
    member: {
      fallbackName: 'Membre',
    },
    memberFilters: {
      category: 'Categorie',
      level: 'Niveau',
      role: 'Role',
      section: 'Section',
      team: 'Equipe',
    },
    memberList: {
      inViewSummary: '{{members}} membre(s) dans cette vue.',
      previewShort: 'Aperçu sur {{loaded}} membre(s) sur {{total}}.',
      previewSuffix: ' - apercu sur {{loaded}}/{{total}}',
      // eslint-disable-next-line max-len
      previewSummary: 'Aperçu sur {{loaded}} membre(s) sur {{total}}. Affine avec la recherche ou les filtres.',
      quickView: 'Vue rapide: {{view}}',
      shownSummary: '{{shown}} membre(s) affiche(s){{preview}}.',
      status: 'Statut: {{status}}',
    },
    members: {
      filters: 'Filtres',
      filtersCount: 'Filtres ({{active}})',
      reset: 'Réinitialiser',
      searchPlaceholder: 'Rechercher un membre',
    },
    overview: {
      audience: 'Public concerne',
      collection: 'Encaissement: {{owner}}',
      currency: 'Devise: {{currency}}',
      defaultAmount: 'Montant par défaut: {{amount}}',
      dueDate: 'Échéance: {{date}}',
      info: {
        // eslint-disable-next-line max-len
        description: 'Retrouve ici l identité, la période et le positionnement de la campagne sélectionnée.',
        title: 'Informations de campagne',
      },
      internalNote: 'Note interne',
      moreRules: '+ {{more}} autre(s) règle(s)',
      noDescription: 'Aucune description visible pour les membres.',
      noFilter: 'Aucun filtre défini',
      noMethod: 'Aucun moyen active',
      noPricingRule: 'Aucune règle tarifaire speciale.',
      onlinePayment: 'Paiement en ligne {{requirement}}',
      optional: 'optionnel',
      paymentLink: 'Lien de paiement: {{url}}',
      paymentMethods: 'Moyens de paiement',
      payments: {
        // eslint-disable-next-line max-len
        description: 'Moyens de paiement autorises, gestion du paiement en ligne et organisation des échéances.',
        title: 'Paiements et échéancier',
      },
      pendingPayments: 'Paiements à valider ({{pending}})',
      period: 'Du {{start}} au {{end}}',
      pricing: {
        description: 'Montant de référence, ciblage des membres et règles tarifaires associées.',
        title: 'Tarification et public',
      },
      pricingRules: 'Règles tarifaires',
      season: 'Saison: {{season}}',
      status: 'Statut: {{status}}',
      unknownStatus: 'Inconnu',
    },
    paymentOwner: {
      club: 'Club',
      platform: 'Plateforme',
      section: 'Section',
    },
    payments: {
      channels: {
        description: 'Résumé des moyens actifs sur cette campagne.',
        title: 'Canaux actifs',
      },
      declarations: '{{declarations}} déclaration(s) - {{amount}}',
      description: 'Pilote les encaissements et les dossiers à valider pour cette campagne.',
      loadedEnd: 'chargés : d autres équipes peuvent exister.',
      loadedStart: 'Seuls les {{loaded}} premiers membres sont ',
      noOverdue: 'Aucun impaye en retard dans cet aperçu.',
      noReviews: 'Aucune déclaration de paiement n attend ici pour le moment.',
      noTeam: 'Aucune équipe n apparaît encore dans cette campagne.',
      openValidations: 'Ouvrir les validations',
      overdue: {
        description: 'Membres avec reste à payer déjà en retard.',
        title: 'Impayes prioritaires',
      },
      paidStat: 'Payees',
      remainingWithReminder: '{{amount}} restant{{reminder}}',
      remindedOn: ' - relance le {{date}}',
      reviews: {
        description: 'Déclarations externes qui attendent une validation dirigeant.',
        title: 'Paiements à valider maintenant',
      },
      settings: 'Régler les paiements',
      settleForTeam: 'Régler pour {{team}}',
      title: 'Pilotage des paiements',
      // eslint-disable-next-line max-len
      whoBody: 'Toi, toujours. Tu peux aussi confier l encaissement a un entraîneur, équipe par équipe : le réglage vit dans la fiche de l équipe, section « Encaissement des cotisations ».',
      whoTitle: 'Qui peut valider les paiements ?',
    },
    pricing: {
      ruleFallback: 'Règle tarifaire',
      waiver: 'Exoneration',
    },
    quickFilters: {
      expected: 'Attendu',
      overdue: 'Retards',
      paid: 'Encaisse',
      remaining: 'Reste',
    },
    reminders: {
      noTargetStatus: 'Aucun statut cible',
    },
    remindersTab: {
      activity: {
        // eslint-disable-next-line max-len
        description: 'Tu peux lancer une relance groupée ou suivre l intensité des rappels déjà envoyés.',
        title: 'Activité de relance',
      },
      lastReminder: 'Derniere relance:',
      membersReminded: 'Membres relances',
      noAutomation: 'Aucune relance automatique configuree.',
      none: 'Aucune',
      noPriority: 'Aucun membre prioritaire à relancer dans cet aperçu.',
      priority: {
        description: 'Membres qui devraient être consideres en priorité pour une relance.',
        title: 'A relancer maintenant',
      },
      priorityHelper: '{{amount}} restant - {{status}}{{reminders}}',
      priorityLabel: 'A relancer',
      reminderCount: ' - {{reminders}} relance(s)',
      settings: {
        description: 'Automatisation, statuts cibles et historique agrégé des relances.',
        title: 'Configuration des relances',
      },
      settingsButton: 'Régler les relances',
    },
    reminderTiming: {
      daysAfter: '{{days}} j après échéance',
      daysBefore: '{{days}} j avant échéance',
      disabled: 'Relances auto désactivées',
      every: 'Toutes les {{days}} j',
      mainDueDate: 'Échéance principale: {{date}}',
      maxCount: '{{max}} relance(s) max',
      onDueDate: 'Le jour de l échéance',
    },
    roles: {
      coach: 'Entraîneur·e',
      manager: 'Dirigeant',
      player: 'Joueur',
      superAdmin: 'Super admin',
    },
    setup: {
      // eslint-disable-next-line max-len
      intro: 'Configure les règles de cotisation du club, puis publie la campagne. Les membres éligibles seront synchronises automatiquement des qu elle devient active.',
      step1: {
        description: 'Choisis la saison, le montant par défaut et les règles de relance.',
        title: 'Définir la campagne',
      },
      step2: {
        // eslint-disable-next-line max-len
        description: 'Active les paiements acceptes: espece, chèque, virement, HelloAsso intègre ou lien externe.',
        title: 'Configurer les moyens de paiement',
      },
      step3: {
        // eslint-disable-next-line max-len
        description: 'La campagne s applique automatiquement aux membres qui correspondent aux criteres.',
        title: 'Synchronisation auto des membres',
      },
      title: 'Avant de suivre les paiements',
    },
    setupFooter: {
      continue: 'Continuer',
      hint: 'Continue le paramétrage des cotisations du club.',
      label: 'Continuer le paramétrage',
    },
    signalCard: {
      openMember: 'Ouvrir la fiche membre',
    },
    statCard: {
      hint: 'Ouvre les membres pour le bloc {{label}}.',
    },
    status: {
      manualReview: 'A valider',
      overdue: 'En retard',
      paid: 'Payee',
      partial: 'Partiel',
      pending: 'En attente',
      waived: 'Exemptee',
    },
    summary: {
      collectedOf: ' encaissés sur ',
      expected: ' attendus',
      noOverdue: 'Aucun retard',
      overdueCount_one: '{{count}} retard',
      overdueCount_other: '{{count}} retards',
      progressLabel: 'Progression des encaissements',
      progressValue: '{{percent}} % encaissés',
      remaining: 'Reste ',
    },
    tabs: {
      documents: 'Documents',
      members: 'Membres',
      overview: 'Vue d ensemble',
      payments: 'Paiements',
      reminders: 'Relances',
    },
    target: {
      allMembers: 'Tous les membres du club',
      categories: '{{categories}} catégorie(s)',
      levels: '{{levels}} niveau(x)',
      sections: '{{sections}} section(s)',
      teams: '{{teams}} équipe(s)',
    },
    values: {
      notSpecified: 'Non renseignée',
    },
  },
  clubList: {
    actions: {
      createClub: 'Ajouter mon club',
    },
    fields: {
      search: 'Rechercher',
      training: 'Entraînement',
    },
    noData: 'Aucun club ne correspond à la recherche.',
    search: {
      placeholder: 'Nom du club',
    },
    title: 'Trouver mon club',
  },
  clubListContent: {
    loading: {
      description: 'Nous chargeons les clubs correspondant à ta recherche.',
      title: 'Chargement des clubs',
    },
    refreshing: 'Actualisation des clubs...',
    relevanceReason: 'Tri pertinence: {{reason}}',
    sortedByRelevance: 'Trie par pertinence',
    viewport: {
      count: '{{total}}{{plus}} clubs dans la zone visible',
      exit: 'Quitter',
      followsMap: 'La liste suit la zone actuellement choisie sur la carte.',
      zoomToLoadAll: 'Zoome sur la carte pour charger tout le catalogue local.',
      zoomToRefine: 'Zoome pour affiner la recherche.',
    },
    zoomRequired: {
      // eslint-disable-next-line max-len
      description: 'La zone visible est trop large pour charger une liste fiable. Zoome puis relance la vue liste.',
      title: 'Zoome pour affiner la recherche',
    },
  },
  clubMembershipRequestList: {
    actions: {
      accept: 'Accepter',
      reject: 'Refuser',
    },
    alerts: {
      trainerAdded: {
        assignNow: 'Assigner maintenant',
        // eslint-disable-next-line max-len
        message: "{{trainerLabel}} a bien été ajouté à ton club.\n\nVeux-tu l'assigner à une équipe maintenant ?",
        title: 'Entraîneur ajouté',
      },
    },
    badges: {
      pending: 'En attente',
    },
    errors: {
      accept: 'Impossible de valider la demande pour le moment.',
      load: 'Impossible de charger les demandes du club pour le moment.',
      loadTitle: 'Chargement impossible',
      missingClubBody: "Impossible d'ouvrir ces demandes sans identifiant de club.",
      missingClubTitle: 'Club introuvable',
      missingRequester: 'Impossible de traiter cette demande. Demande au joueur de renvoyer sa demande.',
      reject: 'Impossible de refuser la demande pour le moment.',
    },
    fields: {
      accepted: 'Demande acceptée',
      claimAccepted: '{{firstname}} a bien été ajouté·e comme dirigeant·e du club.',
      claimAcceptedTitle: 'Dirigeant ajouté',
      claimPendingVerification: 'Revendication en cours de vérification FoundClub',
      pending: "{{firstname}} s'est signalé·e comme entraîneur·e de cette équipe",
      pendingClaim: '{{firstname}} souhaite revendiquer la gestion de ce club.',
      rejected: 'Demande refusée',
    },
    noData: 'Aucune demande d\'affiliation en attente',
    onboarding: {
      description: "Traite ici les demandes d'adhésion au club et assigne les profils valides.",
      title: 'Demandes club',
    },
    title: 'Demandes d\'affiliation',
  },
  clubScope: {
    toggle: {
      backToMultisport: 'Retour multisport',
      hint: 'Basculer entre le contexte multisport et la section active.',
      multisportActive: 'Mode multisport',
      sectionActive: 'Mode section',
      sectionMode: 'Passer en mode section',
    },
  },
  clubScopeContext: {
    errors: {
      switchSection: 'Impossible de basculer sur cette section pour le moment.',
    },
  },
  clubSelector: {
    activeClub: 'Club actif',
    switchClub: 'Basculer',
    title: 'Mes clubs',
  },
  clubService: {
    errors: {
      createClubFailed: 'Impossible de créer le club.',
    },
  },
  clubStack: {
    headers: {
      assignToTeam: 'Assigner a une équipe',
      facilities: 'Installations',
      feeCampaign: 'Campagne cotisation',
      feePayments: 'Paiements cotisations',
      fees: 'Cotisations',
      feeSettings: 'Paramètres cotisations',
      memberFee: 'Cotisation membre',
    },
  },
  clubWizard: {
    activities: {
      empty: 'Aucun sport ne correspond.',
      searchLabel: 'Rechercher un sport',
      searchPlaceholder: 'Football, basket…',
      subtitle: 'Sélectionne les sports pratiqués dans ton club (tu pourras en ajouter plus tard).',
      title: 'Quels sports pratiques-tu ?',
    },
    address: {
      label: 'Adresse du club',
      placeholder: 'Rue, ville…',
      subtitle: 'Recherche l\'adresse de ton club. Elle le rend visible sur la carte et près des joueurs.',
      title: 'Où se trouve ton club ?',
    },
    contact: {
      alsoDirector: 'Je suis aussi dirigeant de ce club',
      alsoDirectorSubtitle: 'Coche si tu gères aussi le club (et pas seulement une équipe).',
      emailInvalid: 'Adresse email invalide.',
      emailLabel: 'Email du club (facultatif)',
      emailPlaceholder: 'contact@club.fr',
      phoneLabel: 'Téléphone du club (facultatif)',
      phonePlaceholder: '0612345678',
      skip: 'Passer cette étape',
      subtitle: 'Ces coordonnées aident les joueurs à contacter ton club. Tu peux les ajouter plus tard.',
      title: 'Coordonnées du club',
    },
    name: {
      duplicateHint: 'C\'est peut-être l\'un de ceux-ci ?',
      label: 'Nom du club',
      placeholder: 'FC Marseille',
      subtitle: 'Donne le nom officiel de ton club. On vérifie au passage qu\'il n\'existe pas déjà.',
      title: 'Quel est le nom de ton club ?',
    },
    recap: {
      address: 'Adresse',
      create: 'Créer mon club',
      createAnyway: 'Créer quand même',
      duplicateHint: 'Rejoins-le s\'il s\'agit du tien, ou touche « Créer quand même » si c\'est un autre club.',
      duplicateTitle: 'Un club très proche existe déjà',
      email: 'Email',
      error: 'Impossible de créer le club.',
      missing: 'Renseigne au moins le nom et l\'adresse du club.',
      name: 'Nom',
      phone: 'Téléphone',
      sports: 'Sports',
      subtitle: 'Vérifie les informations avant de créer ton club.',
      successDescription: 'Ton club est en ligne. Notre équipe le vérifiera prochainement.',
      successTitle: 'Club créé !',
      title: 'Récapitulatif',
    },
  },
  cmDashboard: {
    notFound: {
      backToClubs: 'Retour aux clubs',
      message: 'Le lien est peut-être obsolète ou cet espace a été supprimé.',
      missingIdMessage: 'Aucun identifiant multisport n a été fourni.',
      missingIdTitle: 'Club multisport introuvable',
      retry: 'Réessayer',
      title: 'Cet espace multisport est introuvable',
    },
  },
  cmLicensesDashboard: {
    actions: {
      resync: 'Resynchroniser',
    },
    alerts: {
      allReady: {
        message: 'Toutes les sections visibles ont déjà une campagne pour cette saison.',
        title: 'Campagnes déjà pretes',
      },
      amountRequired: {
        message: 'Indique un montant par défaut avant de créer les campagnes manquantes.',
        title: 'Montant requis',
      },
      bulkCreate: {
        confirm: 'Creer',
        message: '{{sectionCount}} section(s) recevront une campagne {{seasonLabel}}.',
        title: 'Créer les campagnes manquantes',
      },
      bulkCreated: {
        message: '{{created}} créée(s), {{skipped}} ignoree(s), {{errors}} erreur(s).',
        title: 'Campagnes créées',
      },
      cancel: 'Annuler',
      noCampaign: {
        message: 'Crée au moins une campagne avant de relancer une synchronisation de secours.',
        title: 'Aucune campagne',
      },
      resync: {
        // eslint-disable-next-line max-len
        message: 'Opération de maintenance: les cotisations manquantes seront rattachées sans dupliquer les dossiers déjà existants.',
        title: 'Resynchroniser les campagnes',
      },
      resyncDone: {
        message: '{{created}} créée(s), {{skipped}} déjà existante(s).',
        title: 'Synchronisation terminée',
      },
    },
    bulk: {
      amountPlaceholder: 'Montant par défaut pour les campagnes manquantes',
      createMissing: 'Créer manquantes',
      dueDatePlaceholder: 'Date limite optionnelle YYYY-MM-DD',
    },
    fallback: {
      member: 'Membre',
      section: 'Section',
    },
    filters: {
      active: 'Actives',
      all: 'Toutes',
      closed: 'Cloturees',
      drafts: 'Brouillons',
      searchPlaceholder: 'Rechercher une section ou un paiement',
      seasonPlaceholder: 'Saison',
      title: 'Filtres et création globale',
    },
    header: {
      // eslint-disable-next-line max-len
      subtitle: 'Pilote les campagnes de toutes les sections, les restes à payer et les validations en attente.',
      title: 'Cotisations multisport',
    },
    reviewCard: {
      approve: 'Valider',
      details: 'Detail',
      noTeam: 'Sans équipe',
      reject: 'Rejeter',
      toApprove: 'à valider',
    },
    reviews: {
      empty: {
        description: 'Les déclarations manuelles ou externes en attente apparaîtront ici.',
        title: 'Aucun paiement en attente',
      },
      title: 'Paiements à valider',
    },
    sectionCard: {
      centralCollection: ' - encaissement central',
      helloAssoToCheck: 'à vérifier',
      members: 'Licencies',
      noCampaign: 'Aucune campagne',
      settings: 'Reglages',
      setUp: 'Configurer',
      toApprove: 'A valider ({{pendingCount}})',
    },
    sections: {
      empty: {
        description: 'Aucune section ne correspond aux filtres choisis.',
        title: 'Aucune section',
      },
      loading: 'Chargement des sections...',
      title: 'Sections',
    },
    stats: {
      collected: 'Encaisse',
      expected: 'Attendu',
      remaining: 'Reste',
      toApprove: 'A valider',
    },
  },
  cmMembersScreen: {
    filters: {
      allSections: 'Toutes les sections',
    },
    header: {
      title: 'Membres ({{total}})',
    },
    tabs: {
      all: 'Tous',
      clubManagers: 'Dirigeants',
      coaches: 'Entraîneur·e·s',
      players: 'Joueurs',
    },
  },
  cmTeamsScreen: {
    filters: {
      all: 'Toutes',
    },
    header: {
      title: 'Équipes ({{total}})',
    },
    search: {
      placeholder: 'Rechercher une équipe...',
    },
  },
  comingSoonLeagueScreen: {
    back: 'Retour',
    backHint: 'Retourne vers FoundClub classique',
    backToClassic: 'Retour à FoundClub classique',
    badge: 'Accès League fermé',
    countdown: {
      days: 'Jours',
      hours: 'Heures',
      seconds: 'Secondes',
    },
    countdownTitle: 'Compte à rebours avant ouverture',
    subtitle: 'Le mode League est momentanément fermé. FoundClub classique reste disponible.',
    title: 'Found Club League arrive bientôt.',
  },
  common: {
    accept: 'Accepter',
    // VA1 — un refus du serveur (403) se dit, il ne se déguise pas en liste vide.
    accessReserved: {
      description: "Tu n'as pas accès à cette partie : elle est réservée aux membres.",
      title: 'Accès réservé',
    },
    actions: {
      askLater: 'Plus tard',
      back: 'Retour',
      cancel: 'Annuler',
      confirm: 'Confirmer',
      continueLater: 'Continuer plus tard',
      create: 'Créer',
      delete: 'Supprimer',
      edit: 'Modifier',
      later: 'Plus tard',
      login: 'Se connecter',
      next: 'Continuer',
      ok: 'OK',
      openInGps: 'Ouvrir dans le GPS',
      photoFromCamera: 'Prendre une photo',
      photoFromGallery: 'Choisir depuis la galerie',
      retry: 'Réessayer',
      save: 'Enregistrer',
      search: 'Rechercher',
      seeMore: 'Voir le detail',
    },
    all: 'Tous',
    back: 'Retour',
    cancelMatch: 'Annuler le match',
    chat: 'Conversation',
    close: 'Fermer',
    club: 'Club',
    confirmation: 'Confirmation',
    delete: 'Supprimer',
    edit: 'Modifier',
    error: 'Erreur',
    errorOccurred: 'Une erreur est survenue.',
    errors: {
      error: 'Erreur',
      generic: 'Une erreur est survenue',
    },
    finish: 'Terminer',
    ignore: 'Ignorer',
    info: 'Info',
    later: 'Plus tard',
    list: 'Liste',
    loading: 'Chargement...',
    map: 'Carte',
    member: 'Membre',
    messages: {
      loading: 'Chargement...',
      noData: 'Aucune donnée disponible',
    },
    next: 'Suivant',
    ok: 'OK',
    open: 'Ouvrir',
    openInGps: 'Ouvrir dans le GPS',
    previous: 'Précédent',
    refuse: 'Refuser',
    reject: 'Refuser',
    search: 'Rechercher un sport...',
    selected: 'Sélectionnée',
    send: 'Envoyer',
    skip: 'Passer',
    start: 'Démarrer la discussion',
    success: 'Succès',
    teams: 'Équipes',
    user: 'Utilisateur',
    validate: 'Valider',
    view: 'Voir',
  },
  competitiveHero: {
    currentLevel: 'Niveau actuel',
    leaguePoints: 'POINTS LEAGUE',
    maxDivision: 'Division max',
    myTeam: 'Mon équipe',
    pointsToPromotion: 'points pour la promotion',
    prestigeDivision: 'Division 1 prestige.',
    seasonLabel: '| Saison:',
  },
  composition: {
    shareTitle: 'Partager la composition',
  },
  compositionMessageBubble: {
    locationNotSpecified: 'Lieu non précisé',
    matchLineUp: 'Composition du match',
    onTheBench: 'Sur le banc',
    onThePitch: 'Sur le terrain',
    otherTeams_one: '+ {{count}} autre équipe dans cette composition',
    otherTeams_other: '+ {{count}} autre équipes dans cette composition',
    tapToSeeTheLine: 'Appuyer pour voir la composition',
    team: 'Equipe',
    teamLineUpPublished: "Composition d'équipes publiée",
  },
  // C-C — ECRAN 11 du pack composition : la compo type d'une équipe.
  compoTemplate: {
    actions: {
      duplicate: 'Dupliquer',
      save: 'Enregistrer la compo type',
    },
    alerts: {
      error: {
        save: 'Impossible d’enregistrer la compo type.',
        title: 'Erreur',
      },
      saved: {
        message: 'La compo type pré-remplira le terrain à la prochaine convocation.',
        title: 'Compo type enregistrée',
      },
    },
    apply: {
      subtitle: 'La compo type pré-remplit le terrain — il ne reste '
        + 'qu’à ajuster les convoqués du jour.',
      title: 'Appliquer à un match',
    },
    bench: {
      empty: 'Tout le monde est sur le terrain.',
      title: 'Non placés · {{count}}',
    },
    defaultChip: 'Par défaut',
    emptyField: 'Glisse un joueur sur le terrain pour commencer.',
    sources: {
      last: 'Dernier',
      new: 'Nouvelle compo',
      template: 'Compo type',
    },
    subtitle: 'modèle réutilisable',
    title: 'Compo type',
    tokenOnBench: '{{name}}, pas encore placé',
    tokenOnField: '{{name}}, sur le terrain',
    unavailable: {
      // ⚠️ Mesuré le 2026-08-15 : aucune route d'équipe ne rend la dernière
      // composition publiée. La cascade du serveur est attachée à un ÉVÉNEMENT.
      noLastMatch: 'La compo du dernier match se retrouve depuis '
        + 'l’événement, pas depuis l’équipe.',
      noTemplate: 'Cette équipe n’a pas encore de compo type.',
    },
  },
  // C-C — ECRAN 12 du pack composition : le mur payant, en écran plein.
  compositionPaywall: {
    actions: {
      compare: 'Comparer les offres',
      subscribe: 'Passer à l’offre Équipe',
    },
    benefits: {
      autoSplit: 'Répartition automatique sur les détections',
      field: 'Terrain interactif sur les 5 sports',
      responses: 'Réponses présent / absent centralisées',
      template: 'Compo type réutilisable par équipe',
      twoTaps: 'Composition et convocations en 2 taps',
    },
    subtitle: 'Composition réservée',
    text: 'Prépare tes compos, convoque tes joueurs et suis leurs réponses '
      + '— sans quitter FOUNDCLUB.',
    title: 'Offre Équipe',
    wall: 'La composition d’équipe est réservée à l’offre Équipe.',
  },
  contactShareBubble: {
    member: 'Membre',
    title: 'Contact partagé',
    viewProfile: 'Voir le profil',
  },
  conversation: {
    actions: {
      copy: 'Copier',
      copySuccess: {
        description: 'Le message a été copié.',
        title: 'Copié',
      },
      copyUnavailable: 'Le presse-papiers est indisponible sur cette build.',
      delete: 'Supprimer',
      deleteConfirm: {
        description: 'Ce message sera supprimé pour tous les participants.',
        title: 'Supprimer le message',
      },
      deleteError: 'Impossible de supprimer ce message.',
      edit: 'Modifier',
      editModal: {
        addFile: 'Ajouter un fichier',
        addMedia: 'Ajouter un média',
        attachmentFallback: 'Pièce jointe',
        attachments: 'Pièces jointes',
        noAttachments: 'Aucune pièce jointe',
        placeholder: 'Modifier le texte...',
        takePhoto: 'Prendre une photo',
        title: 'Modifier le message',
      },
      manageGroup: 'Gérer le groupe',
      modalTitle: 'Actions du message',
      reply: 'Répondre',
      report: 'Signaler',
    },
    attachmentErrors: {
      addFailed: "Impossible d'ajouter cette pièce jointe.",
      invalidFormat: 'Format de pièce jointe invalide.',
      invalidSession: 'Session invalide. Reconnecte-te puis réessaie.',
      noneSent: "Aucune pièce jointe n'a pu être envoyée.",
      readFailed: 'Impossible de lire ce fichier.',
      sendFailed: "Impossible d'envoyer cette pièce jointe.",
      tooLarge: 'La pièce jointe est trop volumineuse pour être envoyée.',
      unstableConnection: 'Connexion instable. Vérifie ton réseau puis réessaie.',
      unsupportedType: 'Type de fichier non pris en charge.',
      voiceFileEmpty: 'Le fichier audio local est vide.',
      voiceModuleUnavailable: 'Le module vocal n est pas disponible sur cette build.',
      // eslint-disable-next-line max-len
      voiceNotRecognised: 'La note vocale a bien été enregistrée, mais le serveur n a pas reconnu le fichier audio. Réessaie.',
      voiceSocketUnavailable: 'Socket chat indisponible avant la création du message.',
      voiceUploadFailed: 'Upload audio incomplet. Aucun fichier exploitable reçu.',
    },
    attachments: {
      camera: 'Caméra',
      captionPlaceholder: 'Ajouter une légende',
      contact: 'Contact',
      createPoll: 'Créer un sondage',
      document: 'Document',
      documentDisabled: 'Indisponible sur cette build',
      event: 'Événement',
      location: 'Localisation',
      noContact: 'Aucun contact partageable',
      openErrorDescription: 'Le document n a pas pu être ouvert.',
      openErrorTitle: 'Ouverture impossible',
      photos: 'Photos',
      pickFile: 'Envoyer un fichier',
      pickMedia: 'Envoyer un média',
      poll: 'Sondage',
      previewTitle: 'Photo prête à envoyer',
      previewWithCaption: 'La légende sera envoyée avec la photo.',
      previewWithoutCaption: "Ajoute une légende puis confirme l'envoi.",
      shareErrorDescription: 'Le document n a pas pu être partage.',
      shareErrorTitle: 'Partage impossible',
      shareUnavailableDescription: 'Ce document ne peut pas être partage pour le moment.',
      subtitle: 'Partage du contenu dans cette conversation',
      takePhoto: 'Prendre une photo',
      title: 'Ajouter',
      unavailable: 'Bientôt disponible',
      unavailableDescription: 'Ce document ne peut pas être ouvert pour le moment.',
      unavailableTitle: 'Fichier indisponible',
    },
    banner: {
      errorFallback: 'Une erreur est survenue.',
      errorTitle: 'Erreur',
      infoTitle: 'Information',
      successTitle: 'Succès',
    },
    calendar: {
      action: 'Agenda',
      body: 'Match confirme. Tu peux l ajouter à ton agenda.',
      eventDetails: 'Match confirme depuis la messagerie League',
      eventTitle: 'Match FoundClub League',
      openError: "Impossible d'ouvrir ton agenda.",
      title: 'Match confirme',
    },
    calendarFormat: {
      lastDay: '[Hier]',
      lastWeek: '[La semaine dernière] dddd',
      nextDay: '[Demain]',
      sameDay: "[Aujourd'hui]",
    },
    // CONVAVERT (C4) — l'avertissement permanent en tête de fil. Il ne
    // s'affiche QUE sur un fil rattaché à un club (fil de club, fil d'équipe) :
    // ailleurs, aucun dirigeant ne peut lire, et la phrase serait fausse.
    clubReadNotice: 'Les conversations de ce club peuvent être consultées par son dirigeant.',
    connectionUnavailable: 'Connexion messagerie indisponible. Réessaie dans quelques secondes.',
    // eslint-disable-next-line max-len
    connectionUnavailableReconnect: 'Connexion messagerie indisponible. Réessaie quand la conversation est reconnectée.',
    documentActions: {
      download: 'Télécharger',
      open: 'Ouvrir',
      share: 'Partager',
      title: 'Actions du document',
    },
    edit: {
      emptyMessage: 'Le message ne peut pas être vide.',
      error: 'Impossible de modifier ce message.',
    },
    empty: {
      body: 'Envoie le premier message pour lancer la conversation.',
      title: 'Aucun message pour le moment',
    },
    eventFallback: 'Événement',
    friendly: {
      matchConfirmedTitle: 'Match confirmé',
      matchCreated: 'Le match est créé : il apparaît dans le planning des deux équipes.',
    },
    group: {
      addMembers: 'Ajouter des membres',
      admin: 'Admin',
      invalidName: 'Entre un nom de groupe valide.',
      member: 'Membre',
      members: 'Membres',
      nameLabel: 'Nom du groupe',
      namePlaceholder: 'Nom du groupe',
      remove: 'Retirer',
      removeConfirm: 'Retirer {{member}} du groupe ?',
      removeError: 'Impossible de retirer ce membre.',
      removeTitle: 'Retirer un membre',
      renamed: 'Nom du groupe mis à jour.',
      renameError: 'Impossible de mettre à jour le nom du groupe.',
      saveName: 'Enregistrer le nom',
      thisMember: 'ce membre',
      title: 'Gestion du groupe',
    },
    league: {
      cancelBody: 'Cette action annulera le match et supprimera la conversation.',
      cancelError: "Impossible d'annuler le match.",
      cancelTeamError: "Impossible d'identifier ton équipe pour l'annulation.",
      cancelTitle: 'Annuler le match ?',
      openMatchLabel: 'Ouvrir le match League',
      opponent: 'Adversaire',
      sendProposalLabel: 'Envoyer une proposition League',
      teamA: 'Équipe A',
    },
    messagePlaceholder: 'Message',
    modals: {
      actions: {
        cancel: 'Annuler',
        report: 'Signaler le message',
        seeUser: 'Voir le profil',
      },
      reportMessage: {
        description: 'Dis-nous ce qui ne va pas. Notre équipe relira ce message.',
        fields: {
          reason: {
            label: 'Motif du signalement',
            placeholder: 'Explique en quelques mots ce qui pose problème.',
          },
        },
        title: 'Signaler ce message',
      },
      reportSuccess: {
        description: 'Merci de ton retour, nous allons traiter ta demande dans les plus brefs délais.',
        title: 'Ton signalement a bien été envoyé',
      },
    },
    negotiation: {
      banner: {
        historyBelow: 'Retrouve l historique de l organisation dans le fil ci-dessous.',
        proposalBelow: 'La proposition détaillée reste visible dans le fil ci-dessous.',
      },
      compact: {
        accepted: 'Retrouve les détails confirms dans la fiche match.',
        declined: 'La négociation continue dans le fil de discussion.',
        default: 'La discussion dans le chat reste l espace principal pour organiser ce match.',
        received: 'Réponds directement depuis la proposition dans le fil.',
        sent: 'Suis la réponse adverse directement dans le fil.',
      },
      dateToBeDefined: 'Date à définir',
      helper: {
        accepted: 'Retrouve les détails confirms sur la fiche match.',
        declined: 'Poursuis la négociation pour trouver un nouveau créneau.',
        // eslint-disable-next-line max-len
        default: 'La conversation avec l adversaire reste l espace principal pour conclure ce match.',
        received: 'Consulte la proposition puis acceptes, refuse ou contre-propose.',
        sent: 'Suis la réponse adverse depuis le chat ou la fiche match.',
      },
      status: {
        accepted: 'Proposition acceptée',
        active: 'Négociation active',
        declined: 'Proposition refusée',
        received: 'Proposition reçue',
        sent: 'Proposition envoyée',
      },
      title: {
        accepted: 'Le match est en bonne voie',
        active: 'Organisation du match en cours',
        declined: 'Une nouvelle proposition est attendue',
        received: 'Une proposition attend ta réponse',
        sent: 'Ta proposition attend une réponse',
      },
      venueToBeDefined: 'Lieu à définir',
    },
    picker: {
      cameraOpenError: "Impossible d'ouvrir la camera",
      cameraPermissionError: 'Impossible de vérifier la permission caméra.',
      fileDisabled: 'Le sélecteur de fichier est temporairement désactive sur cette build.',
      fileRetrieveError: 'Impossible de récupérer ce fichier.',
      fileSelectError: 'Impossible de sélectionner un fichier.',
      fileUnavailable: 'Le sélecteur de fichier est indisponible sur cette build.',
      galleryError: "Impossible d'ouvrir la galerie.",
      photoError: 'Impossible de prendre la photo.',
      selectionError: 'Erreur lors de la sélection',
    },
    placeholder: 'Ecris ton message...',
    poll: {
      bubble: {
        anonymousBadge: 'Sondage anonyme',
        detailsHint: 'Appuie sur une option pour voter ou modifier ton vote. '
          + 'Appuie à nouveau pour le retirer, ou ouvre la carte pour les détails.',
        questionFallback: 'Question',
        selectedBadge: 'Ton vote',
      },
      common: {
        member: 'Membre',
        vote: 'vote',
      },
      details: {
        anonymousHint: 'Ce sondage est anonyme. Les votants ne sont pas affichés.',
        anonymousVotes: 'Votes anonymes',
        createdBy: 'Créé par',
        date: 'Date',
        infoTitle: 'Informations du sondage',
        notFound: 'Ce sondage est introuvable ou a été supprimé.',
        noVotes: 'Aucun vote pour cette option.',
        syncInProgress: 'Le sondage est en cours de synchronisation.',
        syncTitle: 'Information',
        title: 'Détail du sondage',
        visibleVotes: 'Votes visibles',
        voteCount: 'Nombre de votes',
        voteHint: 'Sélectionne une option pour voter ou modifier ton vote. '
          + 'Appuie à nouveau dessus pour retirer ton vote. '
          + "Le detail des votants s'affiche quand le sondage n'est pas anonyme.",
        votesByOption: 'Votes par option',
      },
      errors: {
        chatMissing: 'Conversation introuvable.',
        createFailed: 'Impossible de créer ce sondage.',
        duplicateOptions: 'Chaque option doit être différente.',
        incomplete: 'Le sondage est incomplet.',
        minOptions: 'Ajoute au moins deux options.',
        optionAlreadyUsed: 'Cette option est déjà utilisée.',
        questionRequired: 'Ajoute une question pour ton sondage.',
        sendUnavailable: 'Connexion messagerie indisponible. Réessaie dans quelques secondes.',
        voteSave: 'Impossible de sauvegarder ce vote.',
      },
      footer: {
        mode: 'mode',
      },
      form: {
        addOption: '+ Ajouter une option',
        addOptionA11y: 'Ajouter une option',
        allowMultipleVotes: 'Autoriser plusieurs votes',
        allowMultipleVotesA11y: 'Autoriser plusieurs votes',
        allowMultipleVotesHint: 'Active cette option pour permettre à chacun de voter pour plusieurs réponses.',
        isAnonymous: 'Sondage anonyme',
        isAnonymousA11y: 'Sondage anonyme',
        isAnonymousDisabledHint: 'Les membres pourront voir qui a voté pour chaque option.',
        isAnonymousEnabledHint: 'Les votes restent anonymes pour les autres membres.',
        optionPlaceholder: 'Option {{index}}',
        optionsLabel: 'Options',
        questionLabel: 'Question',
        questionPlaceholder: 'Ex: Quel créneau te convient ?',
        removeOptionA11y: 'Supprimer l option {{index}}',
        submit: 'Envoyer le sondage',
        subtitle: 'Pose une question, ajoute des options et lance le vote.',
      },
      modes: {
        multiple: 'multiple',
        single: 'unique',
      },
      visibility: {
        anonymous: 'anonyme',
        visible: 'visible',
      },
    },
    proposal: {
      declinedTitle: 'Proposition refusée',
      declineSent: 'Ton refus a été envoyé.',
      matchNotFound: 'Impossible de retrouver le match associe.',
      matchValidated: 'Le match est validé !',
      notFound: 'Impossible de retrouver la proposition.',
      replyError: 'Une erreur est survenue lors de la réponse.',
      sendError: "Impossible d'envoyer la proposition.",
      sent: 'Ta proposition a été envoyée !',
    },
    readOnly: "Canal d'annonce (lecture seule)",
    reload: 'Recharger la conversation',
    reply: {
      replyingTo: 'Répondre a',
    },
    replyPreview: {
      defaultAuthor: 'Membre',
      defaultText: 'Message',
      label: 'Réponse à',
    },
    report: {
      // eslint-disable-next-line max-len
      contactSupport: 'Pour signaler ce match ou cet utilisateur, merci de contacter le support via les paramètres.',
      title: 'Signaler',
    },
    reservation: {
      joined: 'Réservation rejointe.',
    },
    sending: 'Envoi en cours...',
    shareContact: {
      empty: 'Aucun contact partageable dans ce chat.',
      send: 'Partager',
      title: 'Partager un contact',
    },
    shareEvent: {
      empty: 'Aucun événement disponible.',
      planningTitle: 'Événements de mon planning',
      publicEmpty: 'Aucun événement public disponible.',
      publicPickerTitle: 'Partager un événement public',
      searchPlaceholder: 'Rechercher un événement',
      sharePublicAction: 'Partager un événement public',
      title: 'Partager un événement',
    },
    shareLocation: {
      placeholder: 'Rechercher une adresse',
      send: 'Partager',
      title: 'Partager une localisation',
    },
    typing: {
      named_one: '{{names}} écrit...',
      named_other: '{{names}} écrivent...',
      someone: "Quelqu'un écrit...",
    },
    viewMatch: 'Voir la fiche match',
    voice: {
      captionPlaceholder: 'Ajouter un message (optionnel)',
      draftReady: 'Brouillon vocal',
      draftReadyHint: 'Note vocale prête. Ajoute un message puis envoie.',
      draftWithoutText: 'Ajoute un message optionnel puis appuie sur Envoyer.',
      draftWithText: 'Le texte sera envoyé avec la note vocale.',
      emptyErrorDescription: "Aucun son exploitable n'a été capturé. Réessaie.",
      hint: 'Glisser gauche pour annuler, glisser haut pour verrouiller.',
      hintShort: 'Maintiens appuyé pour enregistrer',
      locked: 'Note vocale verrouillée',
      lockedHint: 'Enregistrement verrouillé. Touche envoyer ou annuler.',
      permissionDescription: 'Autorise le micro pour envoyer des notes vocales.',
      permissionTitle: 'Micro requis',
      recording: 'Enregistrement vocal',
      sendErrorDescription: 'Impossible d\'envoyer la note vocale. Réessaie.',
      sendErrorTitle: 'Envoi impossible',
      sending: 'Envoi en cours...',
      stopErrorDescription: 'Impossible de finaliser l\'enregistrement vocal. Réessaie.',
      unavailableDescription: 'Le module vocal n\'est pas disponible sur cette build.',
      unavailableTitle: 'Vocal indisponible',
    },
    web: {
      attachment: {
        label: 'Pièce jointe',
        noneUploaded: 'Aucune pièce jointe n a pu être televersee.',
        sendError: 'Impossible d envoyer cette pièce jointe.',
      },
      empty: 'Aucun message pour le moment.',
      // eslint-disable-next-line max-len
      footerNote: 'Texte, réponse, pièces jointes, partages, sondages et propositions utilisent déjà les hooks, services et sockets partages. Les notes vocales passent par le micro du navigateur quand il est compatible.',
      league: {
        // eslint-disable-next-line max-len
        legalConfirm: "FoundClub League met en relation les équipes mais n'organise pas la rencontre. Confirmes-tu accepter les risques sportifs, vérifier ton assurance et respecter les règles du lieu ?",
      },
      loadEarlier: 'Afficher les messages precedents',
      loading: {
        conversation: 'Chargement de la conversation...',
        conversationError: 'Impossible de charger cette conversation.',
        conversationInProgress: 'Chargement de la conversation en cours...',
        messages: 'Chargement des messages...',
        messagesError: 'Impossible de charger les messages de cette conversation.',
      },
      location: {
        accessError: 'Impossible d acceder à ta position.',
        shareError: 'Impossible de partager ta position.',
        unavailable: 'La geolocalisation n est pas disponible sur ce navigateur.',
      },
      message: {
        sendError: 'Impossible d envoyer le message.',
        sending: ' • envoi...',
        toResend: ' • à renvoyer',
      },
      noChat: {
        // eslint-disable-next-line max-len
        body: 'Aucune conversation n a été sélectionnée. Reviens à la liste des messages puis ouvre une discussion.',
        cta: 'Voir mes messages',
      },
      notFound: {
        body: "Cette conversation est introuvable ou tu n'y as plus accès.",
        cta: 'Retour à mes messages',
      },
      openInMaps: 'Ouvrir dans Maps',
      picker: {
        fileError: 'Impossible de choisir un fichier.',
        imageError: 'Impossible de choisir une image.',
      },
      poll: {
        createError: 'Impossible de créer ce sondage.',
        incomplete: 'Ajoute une question et au moins deux options.',
        questionPlaceholder: 'Question du sondage',
        send: 'Envoyer le sondage',
        voteError: 'Impossible de sauvegarder ce vote.',
      },
      proposal: {
        incomplete: 'Proposition League incomplète. Recharge la conversation avant de répondre.',
        pickDate: 'Choisis une date et une heure pour la proposition.',
        replyError: 'Impossible de répondre à cette proposition.',
        send: 'Envoyer la proposition',
        sendError: 'Impossible d envoyer cette proposition.',
        title: 'Proposition de match',
      },
      report: {
        confirm: 'Signaler ce message à la moderation FoundClub ?',
        error: 'Impossible de signaler ce message pour le moment.',
        sent: 'Signalement envoyé. Merci, notre équipe va vérifier ce message.',
      },
      retry: 'Réessayer',
      share: {
        contactError: 'Impossible de partager ce contact.',
        eventError: 'Impossible de partager cet événement.',
        events: 'Événements',
        noContact: 'Aucun contact partageable dans cette conversation.',
        noEvent: 'Aucun événement récent à partager.',
      },
      viewEvent: 'Voir l événement',
      voice: {
        finalizeError: 'Impossible de finaliser cette note vocale.',
        noneUploaded: 'Aucune note vocale n a pu être televersee.',
        playbackUnavailable: 'Le fichier audio n est pas disponible pour la lecture web.',
        recording: 'Enregistrement en cours. Clique à nouveau pour envoyer la note vocale.',
        sendError: 'Impossible d envoyer cette note vocale.',
        stop: 'Arrêter la note vocale',
        unavailable: 'L enregistrement vocal n est pas disponible sur ce navigateur.',
        unsupported: 'Les notes vocales ne sont pas prises en charge par ce navigateur.',
        usesMic: 'Les notes vocales utilisent le microphone du navigateur.',
      },
    },
  },
  conversationPublicEventPicker: {
    eventFallback: 'Événement',
    web: {
      dateToConfirm: 'Date à confirmer',
      empty: {
        body: 'Aucun événement public ne correspond à cette recherche pour le moment.',
        title: 'Aucun événement disponible',
      },
      error: 'Impossible de charger les événements publics.',
      loading: 'Chargement des evenements…',
      minChars: 'Saisis au moins 2 caractères pour lancer une recherche précise.',
      share: 'Partager dans la conversation',
      subtitle: 'Recherche un événement public et partage-le directement dans cette conversation.',
      title: 'Partager un événement public',
      unknownTeam: 'Équipe inconnue',
      viewDetails: 'Voir le detail',
    },
  },
  createAdModal: {
    cancel: 'Annuler',
    errors: {
      generic: "Une erreur est survenue lors de la création de l'annonce.",
      noPosition: 'Merci de sélectionner un poste.',
      noTeam: 'Tu dois être associé à une équipe pour créer une annonce.',
    },
    fields: {
      allLevels: 'Tous',
      minLevel: 'Niveau minimum',
      position: 'Poste recherché *',
      quantity: 'Nombre de joueurs recherchés',
      validationMode: 'Mode de validation',
    },
    noTeam: {
      description: 'Tu dois être associé à une équipe pour créer une annonce de recrutement.',
      title: '⚠️ Aucune équipe',
    },
    submit: "Créer l'annonce",
    teamLabel: '📋 Équipe:',
    teamUnspecified: 'Non spécifié',
    title: {
      default: 'Créer une annonce',
      event: "Recruter pour l'événement",
    },
    validationMode: {
      auto: 'Automatique',
      manual: 'Manuelle',
    },
  },
  createClubRequest: {
    actions: {
      create: 'Ajouter le club',
      ok: 'OK',
    },
    alerts: {
      description: "L'équipe Found Club va examiner ta demande et te recontacter dans les plus brefs délais.",
      title: 'Ta demande de création de club a bien été envoyée',
    },
    fields: {
      clubName: {
        label: 'Nom du club',
        placeholder: 'FC Marseille',
      },
      holderFirstname: {
        label: 'Prénom du responsable',
        placeholder: 'Luc',
      },
      holderLastname: {
        label: 'Nom du responsable',
        placeholder: 'Harne',
      },
      holderPhone: {
        label: 'Numéro de téléphone du responsable',
        placeholder: '0612345678',
      },
    },
    title: 'Ajouter un club',
  },
  createSquadWizard: {
    errors: {
      generic: 'Erreur: {{message}}',
      genericWithDetails: 'Erreur: {{message}}\n{{details}}',
      invalidAddress: 'Adresse invalide: sélectionne une adresse avec des coordonnées.',
      nameTaken: "Ce nom d'équipe est déjà pris. Merci de en choisir un autre.",
      noSession: 'Session introuvable. Recharge la page avant de créer une squad.',
      sourceTeamRequired: "Sélectionne l'équipe source pour créer une squad Football a 11.",
    },
    noUser: {
      description: 'Recharge la page pour recuperer ta session avant de créer une squad.',
      title: 'Préparation du wizard',
    },
  },
  datePickerInput: {
    cancel: 'Annuler',
  },
  dateTimeSelector: {
    select: 'Sélectionner',
  },
  detection: {
    // Les 3 ecrans empruntaient `matchComposition.board.alerts.*`, dont les textes
    // disent « convocation » et « composition » — deux mots que le pack interdit
    // en detection (§6). Elle a donc ses propres alertes, et son propre mot :
    // une detection produit une REPARTITION.
    alerts: {
      error: {
        publish: 'Impossible de publier cette répartition.',
        save: 'Impossible d’enregistrer cette répartition.',
        title: 'Erreur',
      },
      ok: 'OK',
      published: {
        // ⚠️ Le mot « convocation » est interdit en détection (règle du pack §6),
        // et une détection ne passe JAMAIS par le canal d’une équipe : ses
        // candidats n’y sont pas. Chacun reçoit une notification personnelle.
        message: 'Chaque joueur est prévenu de son équipe.',
        ok: 'Voir la détection',
        title: 'Équipes publiées',
      },
      saved: {
        message: 'Les équipes sont gardées en brouillon. Personne n’a été prévenu.',
        title: 'Répartition enregistrée',
      },
    },
    squad: {
      actions: {
        manual: 'Manuel',
        next: 'Continuer',
      },
      checkIn: {
        empty: 'Personne d’inscrit à pointer pour le moment.',
        subtitle: 'Sur {{count}} inscrits, rarement {{count}} se présentent. '
          + 'Générer avant le pointage produit des équipes fausses.',
        title: 'Pointer les présents d’abord',
      },
      checkInList: {
        markAll: 'Tout pointer',
        markNone: 'Tout dépointer',
        title: 'Pointage · {{present}}/{{total}}',
      },
      intro: {
        subtitle: 'Choisis comment ils entrent dans la répartition — '
          + 'c’est ce qui change le plus le résultat.',
        title_one: '{{count}} joueur de {{teamName}} est inscrit à cette détection.',
        title_other: '{{count}} joueurs de {{teamName}} sont inscrits à cette détection.',
      },
      meta: {
        member: 'Membre de {{teamName}}',
        positionToDefine: 'Poste à définir',
        requestedPosition: 'Demande : {{position}}',
      },
      modes: {
        excluded: {
          subtitle: 'Ils ne sont pas répartis du tout. Utile quand ils encadrent la séance.',
          title: 'Les sortir de la répartition',
        },
        grouped: {
          subtitle: 'Les membres de l’équipe forment une équipe verrouillée. '
            + 'Les candidats sont répartis dans les autres.',
          title: 'Garder l’équipe groupée',
        },
        mix: {
          subtitle: 'Membres et candidats sont mélangés dans toutes les équipes.',
          title: 'Mélanger tout le monde',
        },
      },
      next: 'Ensuite',
      preview: {
        excluded: '{{candidates}} candidats répartis. '
          + 'Les {{members}} membres de {{teamName}} restent en dehors.',
        grouped: '{{members}} membres de {{teamName}} forment une équipe. '
          + 'Les {{candidates}} candidats se répartissent dans les autres.',
        mix: '{{total}} joueurs mélangés, membres et candidats confondus.',
        withCheckIn: 'Seuls les joueurs pointés à l’arrivée seront répartis.',
      },
      previewTitle: 'Aperçu',
      progress: 'Étape {{current}}/{{total}}',
      sectionTitle: 'Comment les traiter',
      subtitle: 'Détection · {{registered}} inscrits · {{members}} de {{teamName}}',
      title: 'Membres de l’équipe',
    },
    teams: {
      auto: {
        actions: {
          generate: 'Générer la répartition',
          manual: 'Manuel',
        },
        chip: 'Auto',
        perTeam: '{{registered}} inscrits · ~{{perTeam}} joueurs par équipe',
        positions: {
          candidates_one: '{{count}} candidat',
          candidates_other: '{{count}} candidats',
          missing_one: '{{count}} manquant',
          missing_other: '{{count}} manquants',
          onePerTeam: '1 par équipe',
          title: 'Postes recherchés · {{count}}',
        },
        preview: {
          empty: 'Personne à répartir : pointe d’abord les présents.',
          text: '{{teams}} équipes de ~{{perTeam}} joueurs. {{unassigned}} non affectés.',
        },
        previewTitle: 'Aperçu',
        splitBy: {
          subtitle: 'Chaque joueur est placé sur le poste '
            + 'qu’il a demandé en candidatant à la détection.',
          title: 'Séparer par poste recherché',
        },
        subtitle: 'Détection · {{sport}} · {{registered}} inscrits',
        teamCount: 'équipes',
        title: 'Répartition',
      },
      board: {
        actions: {
          publish_one: 'Publier l’équipe',
          publish_other: 'Publier les {{count}} équipes',
          rotation: 'Faire tourner',
          save: 'Enregistrer',
        },
        addTeam: '+ Équipe',
        chips: {
          placed: '{{placed}}/{{slots}} placés',
          splitByPosition: 'Par poste recherché',
          swap: 'Glisse pour échanger',
        },
        relaunch: 'Relancer',
        subtitle_one: '{{count}} équipe générée · {{sport}}',
        subtitle_other: '{{count}} équipes générées · {{sport}}',
        teamTab: '{{name}} · {{count}}',
        title: 'Détection',
        tokenOnField: '{{name}}, sur le terrain de {{team}}',
        tokenUnassigned: '{{name}}, non affecté',
        unassigned: {
          empty: 'Tout le monde a une équipe.',
          hint: 'Glisse pour placer',
          title: 'Non affectés · {{count}}',
        },
      },
      manual: {
        actions: {
          auto: 'Auto',
          field: 'Placer sur le terrain',
        },
        bibs: {
          bleu: 'Bleu',
          jaune: 'Jaune',
          rouge: 'Rouge',
          vert: 'Vert',
        },
        empty: 'Personne à répartir : pointe d’abord les présents.',
        hint: 'Appuie sur un joueur pour l’ajouter à {{bib}}. Appuie encore pour le retirer.',
        remaining_one: '{{count}} restant',
        remaining_other: '{{count}} restants',
        subtitle: 'Détection · {{count}} présents',
        title: 'Équipes à la main',
        unassigned: 'Non affectés · {{count}}',
      },
      rotation: {
        actions: {
          nextRound: 'Lancer la manche {{count}}',
          teams_one: 'Voir l’équipe',
          teams_other: 'Voir les {{count}} équipes',
        },
        bib: 'Chasuble {{bib}}',
        chips: {
          onField: '{{count}} sur le terrain',
          round: 'Manche {{current}} / {{total}}',
        },
        // Le pack veut « qui n’a pas assez joué » lisible d’un coup d’œil :
        // c’est la raison d’être d’une détection, chaque joueur doit avoir eu
        // sa chance.
        lowPlaytime: '{{name}} n’a joué que {{count}} minutes',
        playtime: '{{count}} min',
        rotationBand: {
          empty: 'Toute l’équipe est sur le terrain.',
          hint: 'Temps de jeu cumulé',
          title: 'Rotation · {{count}}',
        },
        subtitle: 'Détection · {{sport}}',
        subtitleWithField: 'Détection · {{sport}} · {{field}}',
        title: 'Équipe {{bib}}',
        tokenInRotation: '{{name}}, en rotation, {{count}} minutes de jeu',
        tokenOnField: '{{name}}, sur le terrain, {{count}} minutes de jeu',
      },
    },
  },
  documentAttachment: {
    file: 'Fichier',
    fileCount: '{{total}} fichiers',
    fileLower: 'fichier',
  },
  documentMessageBubble: {
    download: 'Télécharger',
    file: 'Fichier',
    open: 'Ouvrir',
    retry: 'Réessayer',
    sending: 'Envoi...',
    share: 'Partager',
  },
  downloadRemoteFile: {
    errors: {
      empty: 'Le fichier telecharge est vide.',
      http: 'Le serveur a refuse le fichier ({{code}}).',
      noUrl: 'Aucune adresse de fichier a telecharger.',
    },
  },
  endMatchScreen: {
    alerts: {
      actionImpossible: 'Action impossible',
      awaitingOpponent: 'Ton score est en attente de validation par le capitaine adverse.',
      disputeOpened: 'Litige ouvert',
      enterScores: 'Merci de saisir les scores.',
      errorTitle: 'Erreur',
      invalidPadel: 'Score padel invalide',
      noShowCamera: 'Pour un no-show, la preuve doit venir de la caméra.',
      // eslint-disable-next-line max-len
      nowDisputed: 'Le score est maintenant en litige. Tu pourras confirmer ou fournir des détails si besoin.',
      opponentIncomplete: 'Le score adverse est incomplet.',
      saved: 'Le score a été enregistré.',
      savedButDisputed: 'Le score a été enregistré mais est passé en litige.',
      scoreSaved: 'Score enregistré',
      sendError: "Impossible d'envoyer le score.",
      sent: 'Le score a bien été envoyé.',
    },
    blockReason: {
      beforeStart: "Le score sera disponible à l'heure de début du match + 1 minute.",
      // eslint-disable-next-line max-len
      default: "Le score ne peut pas être saisi à ce stade. Vérifie que l'heure de début du match est dépassée.",
      noVenue: "Le score est verrouillé tant qu'un terrain n'est pas confirmé.",
    },
    closed: {
      matchmaking: 'Recherche de match fermée',
      platform: 'Found Club League fermée',
    },
    dispute: {
      comment: 'Commentaire (optionnel)',
      commentPlaceholder: 'Explique brièvement le problème',
      hint: 'Active en cas de désaccord. Preuve optionnelle sauf no-show (caméra obligatoire).',
      importGallery: 'Importer depuis la galerie',
      noShowLive: 'Pour un no-show, seule une preuve prise en direct est acceptée.',
      question: 'Y a-t-il un litige ?',
      title: 'Gestion du litige',
      type: 'Type de litige',
    },
    disputeTypes: {
      incident: 'Incident terrain',
      scoreMismatch: 'Score contesté',
    },
    guided: {
      hint: 'Utilise les boutons ci-dessus pour confirmer ou contester le score adverse.',
      title: 'En attente de ta décision',
    },
    headerTitle: 'Saisir le score',
    hero: {
      closed: {
        helper: 'Le score sera saisissable une fois la fenêtre de validation ouverte.',
        label: 'Fenêtre fermée',
      },
      opponent: {
        helper: 'Le capitaine adverse a déjà proposé un score. Confirme-le ou ouvre un litige.',
        label: 'Score adverse reçu',
      },
      own: {
        helper: 'Ton dernière saisie est enregistrée. Tu peux encore la relire.',
        label: 'Saisie en cours',
      },
      todo: {
        helper: 'Renseigne le score final puis valide ou ouvre un litige si nécessaire.',
        label: 'Score à saisir',
      },
    },
    manual: {
      addDecidingSet: 'Ajouter un set décisif',
      decidingSet: 'Set décisif',
      padelHint: 'Saisis les jeux de chaque set. Le vainqueur doit gagner 2 sets.',
      removeDecidingSet: 'Retirer le set décisif',
      setNumber: 'Set {{number}}',
      title: 'Saisie du score final',
    },
    opponent: {
      confirm: 'Confirmer le score',
      dispute: 'Contester le score',
      hint: "Confirme ce score si tu es d'accord, sinon ouvre un litige.",
      title: 'Score saisi par le capitaine adverse',
    },
    own: {
      canCorrect: "Tu peux encore corriger ta saisie tant que le match n'est pas validé.",
      // eslint-disable-next-line max-len
      pending: 'En attente de validation adverse. Sans réponse, ce score sera validé automatiquement dans',
      title: 'Score déjà saisi',
    },
    proof: {
      added: 'Preuve ajoutée',
      cameraError: 'Impossible de prendre la photo',
      pickError: 'Impossible de sélectionner une image',
      takePhoto: 'Prendre une photo',
      takePhotoCamera: 'Prendre une photo (caméra)',
    },
    relaunch: {
      errorFallback: 'Relance impossible.',
      errorTitle: 'Relance impossible',
      noLocation: 'Aucune localisation validée trouvée. Configure la base de ta squad.',
      noSlot: 'Aucun créneau disponible pour relancer une recherche.',
      noSquad: "Impossible d'identifier ta squad.",
      successBody: "La recherche d'un nouvel adversaire a été lancée.",
      successTitle: 'Recherche relancée',
    },
    side: {
      away: 'EXTERIEUR',
      home: 'DOMICILE',
    },
    states: {
      errorDescription: 'Impossible de charger ce match League.',
      errorTitle: 'Chargement impossible',
      loadingDescription: 'Nous chargeons les données du match avant la saisie du score.',
      loadingTitle: 'Chargement du match',
      missingId: "Aucun identifiant de match n'a été fourni pour ouvrir cette saisie de score.",
      notFound: 'Match introuvable',
      retry: 'Réessayer',
      unavailable: "Le match demandé est introuvable ou n'est plus accessible.",
    },
    submit: {
      correct: 'Corriger le score',
      sending: 'Envoi en cours...',
      validate: 'Valider le score',
    },
    teamAFallback: 'Équipe A',
    teamBFallback: 'Équipe B',
  },
  errorPage: {
    action: 'Recharger la page',
    subtitle: 'Une erreur est survenue.',
    title: 'Oups !',
  },
  errorWrapper: {
    retry: 'Réessayer',
  },
  event: {
    shareChatAccessibilityHint: 'Partager l’événement dans cette conversation',
    shareChatCardHint: 'Partage direct FoundClub',
    shareChatType: {
      club: 'Club',
      group: 'Groupe',
      multisport: 'Omnisport',
      team: 'Équipe',
      whisper: 'Privé',
    },
    shareCloseA11y: 'Fermer le partage',
    sharedEvent: 'Événement partagé',
    shareEyebrow: 'Diffusion',
    shareInChat: 'Partager dans une conversation',
    shareInChatError: "Impossible de partager l'événement pour le moment.",
    shareInChatHint: 'Envoi direct dans FoundClub.',
    // eslint-disable-next-line max-len
    shareInChatSuccessDescription: 'Ton événement a bien été partage. Appuie sur OK pour ouvrir la conversation.',
    shareInChatSuccessTitle: 'Événement partage',
    shareLinkLabel: 'Voir la fiche FoundClub',
    shareMessage: 'Découvre cet événement :',
    shareNoChatAvailable: 'Aucune conv disponible.',
    shareNoChatAvailableHint: 'Rejoins ou crée une conversation pour partager cet événement ici.',
    shareOutsideHint: 'SMS, mail ou application externe',
    shareOutsideLabel: 'Lien externe',
    shareSubtitle: 'Choisis un canal pour envoyer cette fiche rapidement.',
    shareTitle: "Partager l'événement",
    shareViaOther: 'Partager via... (SMS, Mail)',
  },
  eventCampaignDefaults: {
    description: {
      acceptedParticipants: 'Les cotisations seront générées pour les participants acceptes.',
      withEvent: 'Campagne liée a l événement {{eventName}}. ',
      withoutEvent: 'Campagne liée a un événement. ',
    },
    name: {
      withEvent: 'Participation {{typeLabel}} - {{eventName}}',
      withoutEvent: 'Participation {{typeLabel}}',
    },
    typeLabels: {
      event: 'evenement',
      internship: 'stage',
      tournament: 'tournoi',
    },
  },
  eventCardNew: {
    book: 'Réserver',
    booking: 'RÉSERVATION',
    detectionTrial: 'DÉTECTION / ESSAI',
    event: 'ÉVÉNEMENT',
    full: '✅ Complet',
    invitedTeams: 'équipes invitées: {{teams}}',
    lastMinute: '🔥 Dernière minute',
    locationNotSet: 'Lieu non défini',
    missingPlayers_one: 'Il manque {{count}} joueur {{countSuffix}}',
    missingPlayers_other: 'Il manque {{count}} joueurs {{countSuffix}}',
    // eslint-disable-next-line max-len
    openToExternalPlayersExternal: 'Ouvert aux joueurs externes · {{externalLimit}} places externes',
    openTraining: 'Entraînement OUVERT',
    playersWanted: '👥 Joueurs recherchés',
    positionsWanted: 'Postes recherchés : {{positions}}',
    teamsUnit: ' équipes',
    tournament: 'TOURNOI',
    training: 'ENTRAINEMENT',
    trainingCamp: 'STAGE',
  },
  eventDetails: {
    absenceConfirmed: 'Absence confirmée',
    absenceRecorded: 'Absence enregistrée',
    absencesMissing: 'Absences / manques',
    aClubTeam: 'une équipe club',
    actions: {
      accept: 'Accepter',
      cancelEvent: 'Annuler l\'événement',
      cancelResponse: 'Annuler ma participation',
      edit: 'Modifier l\'événement',
      editResponse: 'Modifier ma réponse',
      join: 'Participer',
      refuse: 'Refuser',
      remind: 'Relancer',
    },
    addATeamNameBefore: 'Ajoute un nom d équipe avant de continuer.',
    // eslint-disable-next-line max-len
    aDraftAlreadyExistsResume: 'Un brouillon existe déjà. Reprends-le, ajuste les équipes puis publie la version finale.',
    allowed: 'Autorisees',
    allowedSingular: 'Autorise',
    anErrorOccurred: 'Une erreur est survenue.',
    // eslint-disable-next-line max-len
    announceTheEstimatedDelayYou: 'Annonce le retard estime. Tu confirmeras ensuite ton arrivée réelle.',
    answerExpected: 'Réponse attendue',
    answerMyInvitation: 'Répondre à mon invitation',
    approve: 'Valider',
    approved: 'Validee',
    approved2: 'validee(s)',
    approvedPending: '{{accepted}} validée(s) · {{pending}} en attente',
    archived: 'Archivee',
    arrivalAlreadyRecorded: 'Arrivée déjà enregistrée.',
    // eslint-disable-next-line max-len
    arrivalNotConfirmed: "Ton arrivée n'a pas été confirmée avant la fin du match. Un coach doit corriger ta présence avant de débloquer ton retour post-match.",
    arrivalStatus: "Statut d'arrivée",
    assignmentS: 'affectation(s)',
    attendanceActions: {
      edit: 'Modifier',
      late: 'En retard',
      onTime: "À l'heure",
    },
    attendanceBadge: {
      arrived: 'Arrivé',
      declaredLate: 'Retard annoncé',
      early: 'min en avance',
      late: 'min de retard',
      notMarked: 'Non pointé',
      saidYes: 'Prévu à l’heure',
      selfArrived: 'Je suis arrivé·e',
      toMark: 'À pointer',
    },
    attendanceCall: {
      actions: {
        everyoneHere: 'Tout le monde est là',
        markAll: 'Tout pointer',
        unmarkAll: 'Tout dépointer',
      },
      answers: {
        no: 'Absent·e·s',
        none: 'Sans réponse',
        yes: 'Présent·e·s',
      },
      before: {
        alreadySignalled: 'DÉJÀ SIGNALÉ',
        expected: 'attendus',
        explain: "L'appel est ouvert dès la création de l'événement"
          + ' et se ferme 2 h après la fin.',
        opensAt: 'Ouvre à',
        title: "Faire l'appel",
      },
      bulk: {
        allMarked: 'Tout le monde est pointé.',
        allRefused: "Personne n'a été pointé : le serveur a refusé pour la même raison.",
        partial: 'pointé·e·s, le reste a été refusé.',
        windowClosed: "Personne n'a été pointé : l'appel n'est pas ouvert en ce moment.",
      },
      close: {
        arrivedLate: 'Arrivé·e·s en retard',
        confirm: 'Clôturer',
        confirmLabel: "Clôturer l'appel maintenant",
        keepGoing: "Continuer l'appel",
        marked: 'pointés',
        neverSeen: 'jamais vus',
        serverWill: 'Le serveur les passera en « Non pointé » après la fin du match, vers',
        stillCorrect: "Tu pourras encore corriger jusqu'à",
        title: "CLÔTURER L'APPEL",
      },
      closed: {
        explain: "L'appel est clos. Il restait ouvert jusqu'à 2 h après la fin du match.",
        since: 'Fermé depuis',
      },
      correct: {
        changeTime: "Changer l'heure d'arrivée",
        clearNote: 'Annuler la note du staff',
        close: 'Fermer',
        unmark: 'Dépointer — remettre en attente',
      },
      errors: {
        generic: "Impossible d'enregistrer le pointage. Réessaie dans un instant.",
        windowClosed: "L'appel est fermé. Il reste ouvert jusqu'à 2 h"
          + " après la fin de l'événement.",
      },
      footer: {
        close: "Clôturer l'appel",
        markSomeone: 'Pointe au moins une personne',
        outOf: 'sur',
      },
      header: {
        markedOf: 'pointé sur',
        open: 'Ouvert',
        title: 'APPEL',
      },
      late: {
        cancel: 'Annuler',
        custom: 'Autre heure',
        customPlaceholder: "Heure d'arrivée (HH:MM)",
        minutes: 'min',
        note: 'Note du staff (optionnel)',
        onTime: "À l'heure",
        onTimePreview: "Arrivé à l'heure",
        preview: 'Arrivé',
        previewAt: 'à',
        question: 'Arrivé avec combien de retard ?',
        submit: 'Enregistrer',
        title: 'RETARD CONSTATÉ',
      },
      markedSection: 'DÉJÀ POINTÉS',
      presence: {
        arrived: 'Arrivé·e·s',
        late: 'En retard',
        waiting: 'En attente',
      },
      row: {
        absentState: 'Absent',
        anonymous: 'Participant·e',
        arrived: 'Arrivé',
        arrivedLate: 'Arrivé',
        correct: 'Corriger',
        declaredLate: 'Retard annoncé',
        lateFor: 'Retard pour',
        lateState: 'En retard',
        markedByYou: 'Pointé par toi à',
        markHere: 'Là',
        noAnswer: 'Sans réponse',
        noShow: 'Non pointé',
        onTimeState: "À l'heure",
        saidNo: 'a dit absent',
        saidYes: 'a dit présent',
      },
      tabs: {
        expected: 'Attendus',
        unanswered: 'Sans réponse',
      },
      unanswered: {
        explain: 'Si tu les pointes, ils passent en Présent·e et Arrivé·e en même temps.',
        title: "Ils n'ont jamais répondu",
      },
    },
    automatic: 'Automatique',
    available: 'Disponible',
    book: 'Reserver',
    campaignAlreadyLinked: 'Campagne déjà liée',
    cancel: 'Annuler',
    cancelling: 'Annulation...',
    cancelMyRequest: 'Annuler ma demande',
    capacity: 'Capacite',
    checkInTheArrival: "Pointer l'arrivée",
    checkInTheArrivalAnd: "Pointe l'arrivée et ajuste le retard si nécessaire.",
    checkInToCorrect: 'Pointage à corriger',
    // eslint-disable-next-line max-len
    checkYourSubscriptionToSee: 'Consulte ton abonnement pour voir les offres FoundClub, tes quotas restants et les droits qui se debloquent ensuite.',
    chooseAPosition: 'Choisir un poste',
    chooseATeamToRegister: 'Choisis une équipe à inscrire :\n{{optionsText}}',
    chooseWhereYouWantTo: 'Choisis ou tu souhaites mettre cet événement en avant.',
    // eslint-disable-next-line max-len
    chooseWhetherYouCreateYour: 'Choisis si tu créés ton équipe éphémère ou si tu rejoins une équipe déjà inscrite.',
    chosenPosition: 'Poste choisi : {{position}}.',
    chosenTeam: 'Équipe choisie : {{teamName}}.',
    closeTheTrainingSession: 'Fermer l entraînement',
    coachRating: 'Note coach',
    coachSIndividualFeedback: 'Retour individuel du coach',
    competitionInDraft: 'Compétition en brouillon',
    competitionPublished: 'Compétition publiée',
    completePlayingTimeAndYour: 'Complète le temps de jeu et les stats clés de ton équipe.',
    compoReminder: {
      action: 'Préparer la convocation',
      draftAction: 'Continuer mes convocations',
      draftTitle: 'Tes convocations sont commencées',
      offerAction: 'Voir l’offre Équipe',
      offerTitle: 'La convocation est incluse dans l’offre Équipe',
      title: 'Ce match n’a pas encore de convocation',
    },
    compositionSource: {
      defaultComposition: 'Composition type',
    },
    confirmOpening: 'Confirmer l ouverture',
    continue: 'Continuer',
    convocation: {
      bench: 'Sur le banc',
      called: 'Convoqués',
      notPublished: 'La composition n’est pas encore publiée.',
      starters: 'Sur le terrain',
    },
    correctTheDelay: 'Corriger le retard',
    createAnotherCampaign: 'Créer une autre campagne',
    createAnyway: 'Créer quand même',
    createATeam: 'Créer une équipe',
    createATeamForThe: 'Créer une équipe pour le tournoi',
    createATeamForThis: 'Créer une équipe pour ce tournoi',
    createMyTeam: 'Créer mon équipe',
    // eslint-disable-next-line max-len
    createSeveralTeamsByHand: 'Crée plusieurs équipes à la main ou génère-les automatiquement, puis publie la version finale.',
    decline: 'Refuser',
    declined: 'Refusee',
    declineTheRequest: 'Refuser la demande ?',
    detection: {
      candidateAccept: 'Accepter',
      candidateAppliedFor: 'A postulé au poste : {{position}}',
      candidateDecline: 'Refuser',
      candidateFallbackName: 'Candidat·e',
      candidateInvite: 'Inviter dans l’équipe',
      candidateInviteNoTeam: 'Cet événement n’est rattaché à aucune équipe :'
        + ' il n’y a nulle part où inviter cette personne.',
      candidateInviteSoon: 'L’invitation arrive bientôt.',
      candidateNoPosition: 'Inscription hors annonce, sans poste',
      candidateReviewEmpty: 'Pas encore de retour du staff.',
      candidateReviewError: 'Impossible de lire le retour pour le moment.',
      candidateReviewLoading: 'Chargement du retour…',
      candidateReviewTitle: 'Retour individuel',
      candidateReviewUnavailable: 'Le retour individuel n’existe que pour les candidatures'
        + ' passées par une annonce.',
      candidateStatusAccepted: 'Retenu·e sur ce poste',
      candidateStatusDeclined: 'Refusé·e',
      candidateStatusPending: 'Demande à traiter',
      candidateStatusTitle: 'Statut',
      candidateStatusUnknown: 'Inscrit·e à la séance',
      groupParticipants: 'Participants retenus',
      groupPending: 'Demandes à traiter',
      noParticipantYet: 'Personne n’est encore retenu·e sur ce poste.',
      noPositionGroup: 'Sans poste précisé',
      noSlots: 'Aucun poste recherché',
      noSlotsHint: 'La séance est ouverte à tous les profils',
      noSpecificPositionAction: 'Participer sans poste',
      noSpecificPositionHint: 'Tu rejoins la séance sans viser un poste en particulier.'
        + ' Le staff te placera sur place.',
      noSpecificPositionTitle: 'Sans poste précis',
      positionFilled: '{{accepted}}/{{quantity}} retenu·e·s',
      slotsTitle: 'Postes recherchés',
      tileApplication: 'candidature à voir',
      tileApplications: 'candidatures à voir',
      tileOpenPosition: 'poste ouvert',
      tileOpenPositions: 'postes ouverts',
    },
    detectionSplit: {
      blockedUntilSplit: 'Génère d’abord la répartition, à l’étape 2.',
      generate: 'Générer la répartition',
      openBoard: 'Placer sur le terrain',
      openRotation: 'Faire tourner',
      staffOnlyHint: 'Le staff répartit les candidats en équipes et gère leur temps de jeu.',
      staffOnlyTitle: 'Réservé au staff de la séance',
      stepAttendance: 'Pointer les présent·e·s',
      stepAttendanceCount: '{{pointed}} pointé·e·s sur {{total}}',
      stepAttendanceEmpty: 'Aucun candidat inscrit pour l’instant',
      stepBoard: 'Placer sur le terrain',
      stepBoardHint: 'Après la répartition',
      stepDone: 'Fait',
      stepRotation: 'Faire tourner',
      stepRotationHint: 'Temps de jeu par joueur · plancher 5 min',
      stepSplit: 'Répartir en équipes',
      stepSplitDone: 'Réparti·e·s en {{count}} équipes',
      stepSplitHint: 'Séparer par poste recherché',
      title: 'LE CHEMIN COMPLET',
    },
    disabled: 'Desactivees',
    draft: 'Brouillon',
    edit: 'Modifier',
    editTheSettings: 'Modifier les paramètres',
    editUnsupported: {
      description: "Ce type d'événement ne se modifie pas encore depuis cette fiche.",
      title: 'Modification limitée',
    },
    emptyStates: {
      allAnswered: 'Tout le monde a répondu.',
      noAbsence: 'Aucune absence signalée.',
      noConfirmation: 'Personne n\'a encore confirmé sa présence.',
    },
    endOfMatchStats: 'Stats de fin de match',
    // eslint-disable-next-line max-len
    enterYourIndividualFeedbackThen: 'Renseigne ton retour individuel, puis ajoute une note sur 10.',
    eventAttendance: 'Présence événement',
    eventCampaign: 'Campagne événement',
    eventCreatedCheckTheLast: 'Événement crée. Vérifie les derniers détails avant de le partager.',
    eventFallback: 'Evenement',
    eventNotFound: 'Événement introuvable',
    expectedPlayers: 'Joueurs attendus',
    export: {
      cancel: 'Annuler',
      columns: {
        email: 'E-mail',
        firstname: 'Prénom',
        lastname: 'Nom',
        phone: 'Téléphone',
        position: 'Poste',
        scope: 'Portée',
        status: 'Statut',
        team: 'Équipe',
      },
      columnsTitle: 'Ce que le fichier contient',
      confirm: 'Télécharger le fichier',
      count: 'Le fichier contiendra {{count}} personnes.',
      personalDataWarning: 'Ce fichier contient des données personnelles',
      removeContacts: 'Retirer e-mails et téléphones',
      title: 'Exporter la liste',
    },
    exportError: 'Impossible de sortir la liste des participants.',
    exporting: 'Nous préparons la liste des participants...',
    exportSuccess: 'La liste des participants est téléchargée.',
    // eslint-disable-next-line max-len
    externalPlayersCanJoinAccording: 'Les joueurs externes peuvent rejoindre selon le quota et le mode de validation choisis.',
    externalPlayersMax: 'joueurs externes max',
    externalRequests: 'Demandes extérieures',
    externalRequestsAreApprovedBy: 'Les demandes extérieures sont validées par toi.',
    externalSpots: 'Places externes',
    externalSpotsSetting: '{{limit}} place(s) externes - validation {{mode}}',
    featuredInMyClub: 'À la une dans mon club',
    featuredInTheMultisportClub: 'À la une dans le club multisport',
    featuredPublicly: 'À la une publique',
    featuredRequest: {
      alreadyFeatured: 'Déjà à la une',
      available: 'Disponible',
      error: 'Impossible d’envoyer la demande de mise à la une.',
      rejected: 'Refusée, tu peux redemander',
      success: {
        message: 'Ta demande de mise à la une a été envoyée pour validation.',
        title: 'Demande envoyée',
      },
    },
    featureIt: 'Mettre à la une',
    fees: 'Cotisations',
    fields: {
      description: 'Description',
      participationRequests: 'Demandes de participation',
      participations: 'Participants',
    },
    fillIn: 'Renseigner',
    // eslint-disable-next-line max-len
    finaliseTheTeamsAndSettings: 'Finalise les équipes et les paramètres avant de lancer le tournoi.',
    followMyRequest: 'Suivre ma demande',
    foundclubEvent: 'Événement FoundClub',
    freeOrNotSet: 'Gratuit ou non défini',
    fromTeam: 'Depuis {{teamName}}',
    full: 'Complet',
    header: {
      invitedTeams: 'Équipes invitées',
      tournamentFallback: 'Tournoi',
    },
    iDonTKnow: 'Je ne sais pas',
    iLlBeLate: 'Je serai en retard',
    iMAbsent: 'Je suis absent',
    iMIn: 'Je participe !',
    iMPresent: 'Je suis présent',
    individualFeedback: 'Retour individuel',
    invitationS: 'invitation(s)',
    invitedTeam: 'Équipe invitée',
    invitedTeams: {
      externalBadge: 'Ouvert à tous',
      externalHistoricalTitle: 'Historique participants externes',
      historicalPending: '{{count}} réponse(s) en attente',
      historicalTitle: 'Historique équipe retirée',
      homeTeamBadge: 'Équipe organisatrice',
      invitedTeamBadge: 'équipe invitée',
    },
    invitedTeams2: 'Équipes invitées',
    join: 'Rejoindre',
    joinAnExistingTeam: 'Rejoindre une équipe existante',
    joinTheTournament: 'Participer au tournoi',
    joinThisEvent: 'Rejoindre cet événement',
    lastMatch: 'Dernier match',
    // eslint-disable-next-line max-len
    lastSavedExternalSpotsSetting: 'Dernier reglage mémorise: {{limit}} place(s) externes - validation {{mode}}',
    lastSavedSetting: 'Dernier reglage mémorise: {{quotaLine}}',
    late: {
      helper: "0 = a l'heure. Ajuste la valeur si nécessaire avant validation.",
      minutesInvalid: 'Le retard doit être un nombre positif.',
      minutesLabel: 'Minutes de retard',
      playerLabel: 'Joueur',
      selfOnTime: "Arrivée enregistrée a l'heure.",
    },
    // eslint-disable-next-line max-len
    lateArrivalReportedMinConfirm: 'Retard signale : +{{declaredLateMinutes}} min. Confirme ton arrivée une fois sur place.',
    later: 'Plus tard',
    lineUpPublished: 'Composition publiée',
    linkCopiedToTheClipboard: 'Lien copie dans le presse-papiers.',
    linkedFees: 'Cotisations liées',
    loadingCampaigns: 'Chargement des campagnes...',
    loadingFailed: 'Chargement impossible',
    loadingTheEvent: 'Chargement de l événement...',
    locationUnknown: 'Lieu à confirmer',
    manageMyRegisteredTeam: 'Gérer mon équipe inscrite',
    manageMyTeam: 'Gérer mon équipe',
    manageMyTournamentTeam: 'Gérer mon équipe tournoi',
    managePanel: {
      campaign: 'Cotisation',
      campaignAlreadyLinked: 'Cet événement a déjà une cotisation',
      cancel: 'Annuler',
      closeTraining: 'Fermer l\'entraînement',
      detectionSwitch: 'Faire venir des joueurs',
      // eslint-disable-next-line max-len
      detectionSwitchNote: 'L’affiche sert à attirer des gens de l’extérieur : on ne publie donc pas l’heure et le lieu d’un entraînement. Pour ouvrir une séance à de nouveaux joueurs, crée une détection / séance d’essai.',
      detectionTeamsBoard: 'Placer les équipes sur les terrains',
      detectionTeamsBoardHint: 'Répartis d’abord les équipes depuis « Répartition ».',
      edit: 'Modifier',
      feature: 'À la une',
      lineup: 'Convocation',
      lineupDetection: 'Répartition',
      openTraining: 'Ouvrir l\'entraînement',
      poster: "Voir l'affiche",
      title: 'Gérer l\'événement',
      tournamentSettings: 'Réglages tournoi',
    },
    manageTheTeamLineUp: "Gérer la composition d'équipes",
    manageTheTournament: 'Gérer le tournoi',
    manual: 'Manuelle',
    matchCard: {
      nameOpponent: 'Nommer l\'adversaire',
      nameOpponentHint: 'Il apparaîtra sur la carte du match, face à ton club.',
      opponentPlaceholder: 'Nom de l\'équipe adverse',
      opponentToConfirm: 'Adversaire à confirmer',
      saveOpponentFailed: 'Impossible d\'enregistrer le nom de l\'adversaire pour le moment.',
      verdict: {
        draw: 'Nul',
        loss: 'Défaite',
        win: 'Victoire',
      },
    },
    matchScore: {
      bothRequired: 'Les deux scores sont obligatoires.',
      error: 'Le score n’a pas pu être enregistré. Réessaie.',
      lockedHint: 'Ce score vient de la source officielle : il ne se modifie pas ici.',
      savedMessage: 'Le score du match est enregistré.',
      savedTitle: 'Score enregistré',
      submit: 'Valider le score',
      them: 'Eux',
      title: 'Score du match',
      us: 'Nous',
    },
    matchScore2: 'Score du match',
    matchStats: 'Stats du match',
    maxTeams: 'Max equipes:',
    member: 'Membre',
    menu: {
      campaign: 'Créer la cotisation de cet événement',
      cancel: 'Prévenir les participant·e·s et annuler',
      detectionTeamsBoard: 'Les terrains de la détection',
      edit: 'Date, lieu, description',
      feature: 'Proposer cet événement à la une',
      lineup: 'Choisir et convoquer les joueur·se·s',
      lineupDetection: 'Répartir les joueur·se·s sur les terrains',
      poster: 'Voir et partager l’affiche',
      tournamentSettings: 'Format, équipes et terrains',
      trainingVisibility: 'Accueillir des joueur·se·s de l’extérieur',
    },
    minBeforeTheStartOf: "{{earlyMinutes}} min avant le début de l'événement.",
    mixedClubs: 'Mix clubs:',
    modals: {
      accept: {
        title: 'Es-tu sûr·e de vouloir accepter cette demande ?',
      },
      actions: {
        cancel: 'Annuler',
        confirm: 'Confirmer',
        report: 'Signaler',
      },
      cancelEvent: {
        description: 'Une fois annulé, l\'événement ne sera plus visible par les participant·e·s.',
        title: 'Es-tu sûr·e de vouloir annuler cet événement ?',
      },
      declareMissing: {
        description: 'Tu ne seras plus compté·e présent·e : tu passeras chez les absent·e·s.'
          + ' Tu pourras revenir sur ta réponse.',
        title: 'Me déclarer absent·e',
      },
      deleteParticipation: {
        actions: {
          cancel: 'Non, retour',
          confirm: 'Oui, annuler',
        },
        description: 'Es-tu sûr·e de vouloir annuler ta participation à cet événement ?',
        title: 'Annuler ma participation',
      },
      editResponse: {
        description: "En modifiant ta réponse tu indiques ta participation à l'événement",
        title: 'Modifier ma réponse',
      },
      recurrenceCancel: {
        actions: {
          all: 'Tous les événements',
          future: 'Cet événement et les suivants',
          thisEvent: 'Cet événement',
        },
        description: 'Cet événement fait partie d\'une série. Que veux-tu annuler ?',
        title: 'Annulation d un événement récurrent',
      },
      refuse: {
        fields: {
          reason: {
            label: 'Raison du refus',
            optionalHint: 'Ce champ est optionnel.',
            placeholder: 'Il faut avoir plus de 16 ans.',
          },
        },
        title: 'Es-tu sûr·e de vouloir refuser cette demande ?',
      },
      remindSuccess: {
        description: 'Les joueur·se·s vont recevoir une notification pour leur rappeler de répondre à l\'événement.',
        title: 'Ton relance a bien été envoyée',
      },
      reportEvent: {
        description: 'Merci de nous indiquer la raison pour laquelle tu signales cet événement.',
        fields: {
          reason: {
            label: 'Raison du signalement',
            placeholder: 'Cet événement est inapproprié.',
          },
        },
        title: 'Signaler un événement',
      },
      reportSuccess: {
        description: 'Merci de ton retour, nous allons traiter ta demande dans les plus brefs délais.',
        title: 'Ton signalement a bien été envoyé',
      },
    },
    myCoachFeedback: 'Mon retour coach',
    myPostMatchFeedback: 'Mon retour post-match',
    myStats: 'Mes stats',
    myStatus: 'Mon statut',
    myTeam: 'Mon équipe',
    myTournamentAnswer: 'Ma réponse au tournoi',
    newLineUp: 'Nouvelle composition',
    nextAction: {
      action: 'Faire l’appel',
      done: 'Appel terminé',
      expectedOne: '{{count}} attendu',
      expectedOther: '{{count}} attendus',
      opensAt: 'Ouvre à {{time}}',
      opensSoon: 'Pas encore ouvert',
      title: 'Faire l’appel',
      window: 'L’appel est ouvert dès la création de l’événement, '
        + 'et se ferme 2 h après la fin.',
    },
    nextStep: 'Suite logique',
    noAnswer: 'Aucune réponse',
    noClubTeamAvailableTo: 'Aucune équipe club disponible à inscrire.',
    noConfirmedParticipantYet: 'Aucun participant confirme pour le moment.',
    noInvitedTeam: 'Aucune équipe invitée.',
    noLineUpPublishedYet: 'Aucune composition publiée pour le moment.',
    noOpenTournamentTeamCan: 'Aucune équipe tournoi ouverte ne peut être rejointe pour le moment.',
    noPendingRequest: 'Aucune demande en attente.',
    notAllowed: 'Non autorise',
    noTeamIsRegisteredFor: 'Aucune équipe n est encore inscrite sur ce tournoi.',
    noTeamIsRegisteredYet: 'Aucune équipe n est encore inscrite.',
    noTeamOpenToRequests: 'Aucune équipe ouverte aux demandes n est disponible pour le moment.',
    nothingReported: 'Aucun signalement',
    notInvolved: 'Non concerne',
    // eslint-disable-next-line max-len
    noTournamentTeamAcceptsNew: 'Aucune équipe tournoi n accepte de nouvelles demandes pour le moment.',
    notSet: 'Non défini',
    notSetFeminine: 'Non définie',
    notSharedYet: 'Pas encore partage',
    officialScore: 'Score officiel',
    // eslint-disable-next-line max-len
    okToCreateTheTeams: 'OK pour créer les équipes automatiquement ? Clique sur Annuler pour passer en mode manuel.',
    open: 'Ouvrir',
    open2: 'Libre',
    openTeams: 'Équipes ouvertes',
    openTheCalendar: 'Ouvrir le calendrier',
    openTheTeam: 'Ouvrir l équipe',
    openTheTrainingSession: 'Ouvrir l entraînement',
    // eslint-disable-next-line max-len
    openTheTrainingSessionTo: 'Ouvre l entraînement pour accueillir des joueurs externes sans compter les membres de tes équipes.',
    openTraining: {
      cardClosedMeaning: 'Réservé à ton équipe : personne de l’extérieur ne peut s’inscrire.',
      cardClosedTitle: 'Entraînement privé',
      cardOpenMeaning: 'Ouvert aux joueur·se·s de l’extérieur, en plus de ton équipe.',
      cardOpenTitle: 'Entraînement ouvert',
      goToExternals: 'Voir les participants externes',
      goToPending: 'Voir les demandes',
      // S11-bis (GO Adel 25/08) — le raccourci sur la carte privee.
      openCta: 'Ouvrir l’entraînement au public',
      pendingSuffix: '{{pending}} demande(s) à vérifier',
      publicLine: 'Accueille {{quota}} joueur·se·s de l’extérieur · {{taken}} place(s) prise(s)',
      seatsLeft: '{{left}} place(s) externe(s) restante(s) sur {{quota}}',
      validationAuto: 'Validation automatique : les demandes sont acceptées toutes seules.',
      validationManual: 'Validation manuelle : c’est toi qui acceptes chaque demande.',
    },
    openTraining2: 'Entraînement ouvert',
    optional: 'Facultatif',
    organisingClub: 'Club organisateur:',
    organisingTeam: 'Équipe organisatrice',
    participants: 'Participants',
    participantsFilter: {
      absent: 'Absents',
      all: 'Tous',
      empty: 'Personne dans ce groupe',
      notAnswered: 'Sans réponse',
      present: 'Présents',
    },
    participantsHiddenMessage: 'Les identités des participants sont masquees par l organisateur.',
    // eslint-disable-next-line max-len
    participantsIdentitiesAreHiddenBy: 'Les identités des participants sont masquees par l organisateur.',
    participantsPayment: {
      manualReview: 'À valider',
      overdue: 'En retard',
      paid: 'Payée',
      partial: 'Partiel',
      pending: 'En attente',
      waived: 'Exemptée',
    },
    participantsSearch: {
      noResult: 'Aucun nom ne correspond',
      placeholder: 'Chercher un nom',
    },
    participantsSummary: {
      nextReminder: 'Prochaine relance possible le {{date}}',
      responses: '{{received}} réponses sur {{total}}',
    },
    participationStatus: {
      missing: 'Absent·e·s',
      notAnswered: 'Sans réponse',
      participating: 'Présent·e·s',
    },
    participationSuccess: 'Ta participation est enregistrée.',
    paymentCampaignsLinkedToThis: 'Campagnes de paiement rattachées à cet événement.',
    pending: 'En attente',
    pendingLower: 'en attente',
    pendingRequests: 'Demandes en attente',
    perParticipant: 'par participant',
    playersFeeling: 'Ressenti joueurs',
    points: 'Points',
    position: 'Poste',
    positionFull: 'Poste complet',
    postMatch: {
      actionDone: 'Voir les stats du match',
      actionResponses: 'Voir les retours',
      actionReview: 'Mettre à jour',
      actionScore: 'Enregistrer le score',
      actionStats: 'Saisir les stats',
      complete: 'C’est complet',
      header: 'APRÈS LE MATCH',
      responsesCount: '{{received}} sur {{total}} ont répondu',
      responsesNone: 'Personne n’a encore répondu',
      responsesTitle: 'Retours des joueurs',
      scoreManual: 'saisi à la main',
      scoreOfficial: 'score officiel',
      scoreRecordedBy: 'saisi par {{name}} à {{time}}',
      scoreRecordedByMe: 'saisi par toi à {{time}}',
      scoreTitle: 'Score',
      scoreTodo: 'À enregistrer',
      statsSubtitle: 'Buteurs, passeurs, temps de jeu',
      statsTitle: 'Statistiques de l’équipe',
      step: 'Étape {{n}} sur 3',
    },
    presenceConfirmed: 'Présent confirmé',
    present: 'Présent',
    present2: 'presents',
    pricePerson: 'Prix / personne',
    privateTraining: 'Entraînement prive',
    publication: 'Publication',
    published: 'Publié',
    publishedOn: 'Publie le',
    quickInfo: 'Infos rapides',
    registerAClubTeam: 'Inscrire une équipe du club',
    registerMyTeam: 'Inscrire mon équipe',
    registrationsToCheck_one: '{{count}} inscription à vérifier',
    registrationsToCheck_other: '{{count}} inscriptions à vérifier',
    reload: 'Recharger',
    remindSheet: {
      antiSpamHint: 'Une personne relancée il y a moins de 48 h ne recevra rien de plus.',
      close: 'Fermer',
      confirm: 'Relancer {{count}} personne·s',
      failedBody: 'Personne n’a été prévenu : réessaie dans un instant.',
      failedTitle: 'La relance n’a pas pu partir',
      indicative: 'Chiffre indicatif : le serveur écarte les personnes déjà relancées.',
      nobody: 'Tout le monde a répondu : il n’y a personne à relancer.',
      teamCount: '{{count}} sans réponse',
      teamFailed: 'échec',
      teamReminded: '{{count}} relancé·e·s',
      title: 'Relancer les sans-réponse',
      unnamedTeam: 'Équipe',
    },
    removedTeam: 'Équipe retirée',
    reportFinalised: 'Rapport finalise',
    reportFinalisedOn: 'Rapport finalise le {{date}}',
    // eslint-disable-next-line max-len
    reportYourDelayBeforeArriving: "Signale ton retard avant d'arriver. Tu confirmeras ensuite ton arrivée réelle.",
    requestS: 'demande(s)',
    requestSent: 'Demande envoyée',
    resetTheCheckIn: 'Réinitialiser le pointage',
    resume: 'Reprendre',
    runTheCompetition: 'Piloter la compétition',
    saveMyDelay: 'Enregistrer mon retard',
    saving: 'Enregistrement...',
    // eslint-disable-next-line max-len
    sayHowManyExternalSpots: 'Indique combien de places externes tu veux ouvrir pour cet entraînement.',
    // eslint-disable-next-line max-len
    scheduleResultsAndStandingsAre: 'Calendrier, résultats et classement sont prêts à être pilotés.',
    scoreToComplete: 'Score à compléter',
    scoreWaitingToSync: 'Score en attente de synchronisation',
    seeAllMyPendingMatches: 'Voir tous mes matchs en attente',
    seeMyCallUp: 'Voir ma convocation',
    seeMyPlanning: 'Voir mon planning',
    seeMyRegisteredTeam: 'Voir mon équipe inscrite',
    seeMySubscription: 'Voir mon abonnement',
    seeMyTeam: 'Voir mon équipe',
    seeMyTournamentTeam: 'Voir mon équipe tournoi',
    seeTheCompetition: 'Voir la compétition',
    seeTheFoundclubPage: 'Voir la fiche FoundClub',
    seeThePublishedLineUp: 'Voir la composition publiée',
    seeTheScheduleTheTeams: 'Consulte le déroulé, les équipes et les résultats du tournoi.',
    seeTheTeamLineUp: "Voir la composition d'équipes",
    seeTheTournament: 'Voir le tournoi',
    seeTheTrainingCamp: 'Voir le stage',
    // eslint-disable-next-line max-len
    selectAClubTeamThe: 'Sélectionne une équipe club. L application creera une équipe éphémère de tournoi sans toucher à ton effectif permanent.',
    // eslint-disable-next-line max-len
    selectATournamentTeamThat: 'Sélectionne une équipe tournoi qui accepte actuellement de nouvelles demandes.',
    selectThePositionYouWant: 'Sélectionne le poste auquel tu veux participer.',
    sending: 'Envoi...',
    sendMyRequest: 'Envoyer ma demande',
    sendTheRequest: 'Envoyer la demande',
    sent: 'Envoye',
    // eslint-disable-next-line max-len
    setHowManyExternalPlayers: 'Définis combien de joueurs externes peuvent rejoindre cet entraînement.',
    share: 'Partager',
    sharing: 'Partage...',
    signInToAnswerThis: 'Connecte-toi pour répondre à cet événement.',
    signInToTakePart: 'Se connecter pour participer',
    sourceTeam: 'Équipe source',
    sourceTeam2: 'Equipe source:',
    squadSize: 'Effectif:',
    staffNote: 'Note staff',
    stage: {
      day: 'Jour',
      hours: 'Horaires',
      hoursEmpty: 'Variables',
      legend: 'présent·e·s · absent·e·s · sans réponse',
      mainPlace: 'Lieu principal',
      noDays: 'Aucune journée de stage n’est encore disponible.',
      period: 'Période',
      periodEmpty: 'Non renseignée',
      placeEmpty: 'À définir',
      today: 'AUJOURD’HUI',
    },
    stageLicense: {
      allPaid: 'Tout le monde a réglé sa cotisation.',
      body: 'Sur {{total}} inscrit·e·s, {{unpaid}} n’ont pas réglé les {{amount}} du stage',
      collected: '{{paid}} reçus sur {{expected}} attendus',
      confirmBody: 'Envoyer une relance aux cotisations en attente, partielles ou en retard ?',
      confirmSend: 'Envoyer',
      confirmTitle: 'Relancer les impayés',
      errorBody: 'Rien n’a été envoyé.',
      errorTitle: 'Relance impossible',
      generate: 'Mettre à jour les affectations',
      inactive: 'La campagne n’est pas active : aucune relance ne peut partir.',
      kicker: 'PROCHAINE ACTION',
      remind: 'Relancer {{count}} impayés',
      sentBody: 'Les impayés ont reçu un rappel.',
      sentTitle: 'Relances envoyées',
      title: 'Relancer {{count}} impayés',
      withoutAssignment: '{{count}} inscrit·e·s sans cotisation',
    },
    standaloneTournament: 'Tournoi autonome',
    startBySavingTheMatch: 'Commence par enregistrer le score du match.',
    statsWillBeAvailableAt: 'Les stats seront disponibles à la fin du match.',
    status: 'Statut:',
    syncedAutomaticallyFromTheOfficial: 'Synchronise automatiquement depuis la source officielle',
    tabs: {
      callUp: 'Convocation',
      detectionCandidates: 'Candidats',
      detectionSplit: 'Répartition',
      overview: 'Aperçu',
      people: 'Personnes',
      stageDays: 'Jours',
      teams: 'Équipes',
    },
    takePart: 'Participer',
    teamApproval: 'Validation des equipes:',
    teamFallback: 'Equipe',
    teamLineUp: "Composition d'equipes",
    teamLineUpPublished: "Composition d'équipes publiée",
    teamName: 'Nom de l équipe',
    teamReport: 'Bilan équipe',
    teamS: 'equipe(s)',
    teams: 'Équipes',
    teamSPublished: '{{publishedCompositionTeamCount}} équipe(s) publiée(s)',
    teamSPublished2: 'equipe(s) publiee(s)',
    teamToCreate: 'Équipe à créer : {{teamName}}.',
    temporaryTeam: 'Équipe éphémère',
    temporaryTeams: 'Equipes ephemeres:',
    theCoachHasnTLeft: "Le coach n'a pas encore laisse d'avis individuel pour ce match.",
    theCoachPublishedIndividualFeedback: 'Le coach a publié un retour individuel pour ton match.',
    // eslint-disable-next-line max-len
    theEventIsOverAnd: "L'événement est terminé et aucune arrivée n'a été confirmée. Un coach doit corriger le pointage si besoin.",
    // eslint-disable-next-line max-len
    theMatchIsOverSave: 'Le match est terminé. Enregistre d abord le score puis complète les statistiques de ton équipe.',
    // eslint-disable-next-line max-len
    theOfficialScoreChangedAfter: 'Le score officiel a changé après la première publication. Une mise à jour est requise.',
    // eslint-disable-next-line max-len
    theOfficialScoreChangedCheck: 'Le score officiel a changé. Vérifie puis republie cette version.',
    // eslint-disable-next-line max-len
    theOfficialScoreChangedCheck2: 'Le score officiel a changé. Vérifie les lignes puis republie ce rapport.',
    theRequesterWillBeNotified: 'Le demandeur sera notifié du refus.',
    // eslint-disable-next-line max-len
    theScoreIsReadyYou: 'Le score est prêt. Tu peux maintenant compléter le temps de jeu et les stats clés de ton équipe.',
    theScoreIsSavedFrom: 'Le score s’enregistre depuis l’application mobile.',
    theStartHasPassedReport: 'Le début est passé. Signale ton retard ou confirme ton arrivée.',
    theTeamLineUpIs: "La composition d'équipes est encore en cours de chargement.",
    theTeamSMatch10: 'Le match de l equipe : {{teamRating}}/10',
    thisDayBelongsToThe: 'Cette journée depend du stage principal.',
    // eslint-disable-next-line max-len
    thisEventAlreadyHasA: 'Cet événement a déjà une campagne de cotisation. Crée-en une autre seulement si tu veux un paiement distinct.',
    thisEventIsNoLonger: 'Cet événement n est plus disponible ou n a pas pu être charge.',
    thisReportIsADraft: 'Ce bilan est un brouillon — voir tous mes matchs en attente',
    // eslint-disable-next-line max-len
    thisTeamWillOnlyExist: 'Cette équipe n existera que pour ce tournoi. Tu en deviendras automatiquement le capitaine.',
    toCheck: '{{warning}} à vérifier',
    toComplete: 'A compléter',
    toDo: 'A faire',
    tournament: 'TOURNOI',
    tournamentMode: 'Mode tournoi',
    tournamentPeople: {
      absent: 'Absent·e',
      awaiting: '{{count}} invitation·s ou demande·s en attente',
      empty: 'Aucune personne inscrite pour l’instant.',
      lockedHint: 'Tu retrouves ton équipe et ses joueurs depuis le bouton du bas.',
      lockedTitle: 'Réservé à l’organisation',
      pending: 'Sans réponse',
      present: 'Présent·e',
    },
    tournamentRail: {
      groups: 'Poules',
      matches: 'Matchs',
      published: 'Publié',
      settings: 'Réglages',
      teams: 'Équipes',
      title: 'OÙ EN EST LE TOURNOI',
    },
    tournamentTeam: 'Équipe tournoi',
    tournamentTeamName: 'Nom de l équipe tournoi',
    tournamentTeams: {
      accepted: 'INSCRITE',
      archived: 'ARCHIVÉE',
      declined: 'REFUSÉE',
      lead: 'Référent·e : {{name}}',
      pending: 'À VÉRIFIER',
    },
    tournamentTeams2: 'Équipes tournoi',
    trainingCampDay: 'Journée de stage',
    // AVIS (2026-09-09) — l avis anonyme des joueurs sur un entrainement.
    // ⚠️ Pluriel en `_one` / `_other` (`cle_plural` est morte depuis i18next 21),
    // et l appelant passe `count` — sans lui, la forme choisie est toujours la meme.
    trainingReview: {
      average: 'Note moyenne',
      empty: 'Aucun avis pour l’instant. Tes joueurs reçoivent une invitation après chaque séance.',
      noComment: 'Note laissée sans commentaire',
      outOfTen: '{{rating}}/10',
      title: 'Avis des joueurs',
      waiting_one: '{{count}} avis reçu. Il en faut {{minimum}} pour l’afficher anonymement.',
      waiting_other: '{{count}} avis reçus. Il en faut {{minimum}} pour les afficher anonymement.',
    },
    typeTag: {
      capacity: '{{taken}}/{{total}} PLACES',
      matchAway: 'À L\'EXTÉRIEUR',
      matchFinished: 'TERMINÉ',
      matchHome: 'À DOMICILE',
    },
    unableToApproveThisRequest: 'Impossible de valider cette demande.',
    unableToCancelThisParticipation: 'Impossible d annuler cette participation.',
    unableToCloseThisTraining: 'Impossible de fermer cet entraînement pour le moment.',
    unableToCloseThisTraining2: 'Impossible de fermer cet entraînement.',
    unableToConfirmYourParticipation: 'Impossible de confirmer ta participation pour le moment.',
    unableToCreateThisTournament: 'Impossible de créer cette équipe de tournoi.',
    unableToCreateThisTournament2: 'Impossible de créer cette équipe de tournoi pour le moment.',
    unableToCreateThisTournament3: 'Impossible de créer cette équipe tournoi.',
    unableToDeclineThisRequest: 'Impossible de refuser cette demande.',
    // eslint-disable-next-line max-len
    unableToFindYourAnswer: 'Impossible de retrouver ta réponse pour cet événement. Recharge la page et réessaie.',
    unableToJoinThisEvent: 'Impossible de rejoindre cet événement.',
    unableToOpenThisTraining: "Impossible d'ouvrir cet entraînement pour le moment.",
    unableToOpenThisTraining2: "Impossible d'ouvrir cet entraînement.",
    unableToRecordYourArrival: "Impossible d'enregistrer ton arrivée (événement introuvable).",
    unableToRegisterThisTeam: 'Impossible d inscrire cette équipe au tournoi.',
    unableToRegisterThisTeam2: 'Impossible d inscrire cette équipe.',
    unableToSaveYourTournament: 'Impossible d enregistrer ta réponse tournoi.',
    unableToSendThisRequest: 'Impossible d envoyer cette demande pour le moment.',
    unableToUpdateThisRegistration: 'Impossible de mettre à jour cette inscription.',
    unableToUpdateThisTeam: 'Impossible de mettre à jour cette équipe.',
    unlimited: 'Non limite',
    update: 'Mettre à jour',
    updateMyDelay: 'Mettre à jour mon retard',
    updateTheActualDelayOr: 'Mets à jour le retard réel ou réinitialise le pointage.',
    validationAutomatic: 'automatique',
    validationManual: 'manuelle',
    variableTimes: 'Horaires variables',
    view: 'Voir',
    visibleBranchEs: 'branche(s) visible(s)',
    waitingForApproval: 'En attente de validation',
    waitingForTheSyncedOfficial: 'En attente du score officiel synchronise.',
    wellDoneYourEventIs: 'Bravo, ton événement est en ligne',
    weReFetchingTheCurrent: "On récupère l'état actuel de la composition.",
    youAreMarkedPresentOn: "Tu es signale present a l'heure.",
    // eslint-disable-next-line max-len
    youCanAlreadyCreateThe: 'Tu peux déjà créer les équipes même sans participant: les postes resteront libres et se completeront ensuite.',
    youHaveMinLeftTo: 'Il te reste {{minutesLeft}} min pour signaler ton arrivée ou ton retard.',
    yourActualArrivalHasBeen: 'Ton arrivée réelle a bien été enregistrée.',
    // eslint-disable-next-line max-len
    yourAnswerIsAboutYour: 'Ta réponse concerne ton équipe tournoi, pas le RSVP classique de l’événement.',
    youReCalledUpStarter: 'Tu es convoqué · Titulaire',
    youReCalledUpSubstitute: 'Tu es convoqué · Remplaçant',
    youReMarkedAbsent: 'Tu es signale absent',
    youReNotInThe: 'Tu n’es pas dans la composition publiée.',
    youReTakingPart: 'Tu participes',
    yourFeelingIsSavedWithout: 'Ton ressenti est enregistré, sans stats quantitatives.',
    // eslint-disable-next-line max-len
    yourFreeEventCreditHas: 'Ton credit gratuit événement a bien été utilise. Il t en reste {{remainingEventPublishQuota}}{{totalSuffix}}.',
    // eslint-disable-next-line max-len
    yourFreeEventCreditHas2: 'Ton credit gratuit événement a bien été utilise. Les prochaines publications passeront par une offre Team ou Club.',
    yourParticipationForThisPosition: 'Ta participation a bien été envoyée sur ce poste.',
    yourPersonalPostMatchDraft: 'Ton brouillon perso post-match attend encore une validation.',
    yourPersonalStatsAndRating: 'Tes stats personnelles et ta note sont enregistrées.',
    yourTeam: 'Ton équipe',
    yourTeamMembersCanStill: 'Les membres de ton équipe peuvent encore finaliser ce rapport.',
    youSaidYouWerenT: 'Tu as indique ne pas être concerne par ce match.',
    youSaidYouWereThere: 'Tu as indique que tu etais la sans jouer.',
  },
  eventDetectionSlots: {
    alreadyRegistered: 'Déjà inscrit',
    full: 'Complet',
    participationApproved: 'Participation validée',
    // eslint-disable-next-line max-len
    playersPickASpecificPosition: 'Les joueurs choisissent un poste precis. Les places se remplissent quand tu valides les candidatures.',
    remaining: '{{remaining}} restante(s)',
    requestSent: 'Demande envoyée',
    seeThePosition: 'Voir le poste',
  },
  eventEdit: {
    // eslint-disable-next-line max-len
    aConflictWasDetectedOn: '⚠️ Un conflit a été détecté sur ce créneau. Ta demande sera soumise à validation.',
    actions: {
      save: 'Enregistrer',
    },
    addressOrVenue: 'Adresse ou lieu',
    advancedTeamInvitations: 'Invitations d équipes avancées',
    automatic: 'Automatique',
    cancel: 'Annuler',
    capacity: 'Capacité',
    checkTheFieldThenTap: 'Vérifie le champ « {{field}} », puis appuie de nouveau sur Enregistrer.',
    checkTheseFields: 'Vérifie ces champs : {{fields}}.',
    checkYourInputBeforeSaving: "Vérifie ta saisie avant d'enregistrer.",
    chooseATeam: 'Choisir une équipe',
    chooseAType: 'Choisir un type',
    // eslint-disable-next-line max-len
    clickATeamToAdd: 'Clique sur une équipe pour l ajouter ou la retirer, sans combinaison clavier.',
    createAnEvent: 'Créer un événement',
    describeTheEventTheMeeting: "Décris l'événement, le rendez-vous, les consignes...",
    editAnEvent: 'Modifier un événement',
    end: 'Fin',
    eventNotFound: 'Événement introuvable',
    expectedPlayers: 'Joueurs attendus',
    expectedPlayersInternal: 'Joueurs attendus (interne)',
    externalRequests: 'Demandes extérieures',
    externalRequestsAreApprovedBy: 'Les demandes extérieures sont validées par toi.',
    externalSpots: 'Places externes',
    extraTasks: 'Tâches annexes',
    featured: 'Mise à la une',
    // eslint-disable-next-line max-len
    featuringRequestFromEventPage: "La demande de mise a la une se fait depuis la fiche de l'evenement une fois enregistre.",
    fields: {
      address: {
        label: 'Adresse',
      },
      capacity: {
        label: 'Nombre de participant·e·s',
        placeholder: 'Illimité',
      },
      club: {
        label: 'Club',
        placeholder: 'Sélectionner un club',
      },
      date: {
        label: "Date de l'événement",
        placeholder: 'JJ/MM/AAAA',
      },
      description: {
        label: 'Description',
        placeholder: 'Événement de détection ouvert à tous·tes les joueur·se·s.',
      },
      endTime: {
        label: 'Heure de fin',
        placeholder: 'HH:mm',
      },
      externalParticipantLimit: {
        label: 'Places externes',
        placeholder: 'Combien de joueurs externes acceptes ?',
      },
      externalRequests: {
        alwaysManual: 'Les demandes extérieures sont validées par toi.',
        label: 'Demandes extérieures',
      },
      facility: {
        label: 'Installation',
      },
      invitedTeams: {
        label: 'Inviter des équipes',
        myTeams: 'MES ÉQUIPES',
        otherTeams: 'AUTRES ÉQUIPES',
        placeholder: 'Sélectionner des équipes',
      },
      isRecurrent: {
        label: 'Événement récurrent',
      },
      location: {
        label: 'Lieu',
        placeholder: '2 rue du stade, 69000 Lyon',
      },
      participantIdentityVisibility: {
        label: 'Confidentialité des participants',
        options: {
          anonymized: 'Participants anonymisés',
          visible: 'Identités visibles',
        },
      },
      pricePerPerson: {
        label: 'Prix par personne (€)',
        placeholder: 'Ex: 10',
      },
      recurrenceDay: {
        label: 'Jour de la récurrence',
      },
      recurrenceDays: {
        label: 'Jours de récurrence',
      },
      recurrenceEndDate: {
        label: 'Date de fin de la récurrence',
        placeholder: 'JJ/MM/AAAA',
      },
      recurrenceFrequency: {
        label: 'Fréquence de la récurrence',
        options: {
          month: 'Mensuel',
          week: 'Hebdomadaire',
        },
      },
      recurrenceStartDate: {
        label: 'Date de début de la récurrence',
        placeholder: 'JJ/MM/AAAA',
      },
      sessionStatus: {
        label: "Visibilité de l'événement",
        options: {
          closed: 'Privé',
          open: 'Public',
        },
      },
      startTime: {
        label: 'Heure de début',
        placeholder: 'HH:mm',
      },
      team: {
        label: 'Équipe',
        placeholder: 'Sélectionner une équipe',
      },
      time: {
        label: "Horaire de l'événement",
        placeholder: 'JJ/MM/AAAA',
      },
      totalPlayers: {
        label: 'Nombre total de joueurs',
        placeholder: 'Ex: 10',
      },
      trainingTotalPlayers: {
        label: 'Joueurs attendus (interne)',
        placeholder: 'Nombre de joueurs de tes équipes attendus',
      },
      trainingValidationMode: {
        label: 'Validation des membres internes',
      },
      type: {
        label: 'Type d\'événement',
        placeholder: 'Sélectionner un type d\'événement',
      },
      validationMode: {
        // S11 — depuis la regle corrigee par Adel le 25/08, le serveur met
        // TOUTE demande venue du dehors en attente. Ce reglage ne commande donc
        // plus que les MEMBRES des equipes conviees : le libelle le dit.
        label: 'Validation des membres',
        options: {
          auto: 'Automatique',
          manual: 'Manuelle',
        },
      },
    },
    freeVenueAddress: 'Lieu libre / adresse',
    // eslint-disable-next-line max-len
    ifYouChangeTheCalendar: 'Si tu modifies la date du calendrier, elle reste spécifique à cet événement. Les mises à jour pour les suivants ou toute la série propagent surtout les paramètres communs comme l horaire, le lieu et les invitations.',
    // eslint-disable-next-line max-len
    ifYouChooseTheFuture: "\n\nSi tu choisis les futurs ou toute la série, la nouvelle date reste spécifique à cet événement. Les autres occurrences recuperent surtout les paramètres communs comme l'horaire, le lieu et les invitations.",
    internalMembersApproval: 'Validation des membres internes',
    invitedTeams: 'Équipes invitées',
    limitedEditing: 'Modification limitée',
    loadFailed: {
      // eslint-disable-next-line max-len
      description: "L'événement n'a pas pu être chargé. Vérifie ta connexion, puis appuie sur Réessayer.",
      retry: 'Réessayer',
    },
    loading: {
      description: "Chargement de l'événement… Le bouton s'active dès que tout est affiché.",
    },
    loadingTheEvent: 'Chargement de l événement...',
    locationMode: {
      club: 'Club',
      clubHint: 'Installation du club',
      external: 'Exterieur',
      externalHint: 'Adresse extérieure',
    },
    manual: 'Manuelle',
    membersApproval: 'Validation des membres',
    modals: {
      invalidForm: {
        title: 'Il manque quelque chose',
      },
      loadFailed: {
        // eslint-disable-next-line max-len
        description: 'Appuie sur Réessayer : enregistrer maintenant effacerait ses tâches, ses équipes conviées et son lieu.',
        title: "L'événement n'a pas pu être chargé",
      },
      recurrenceUpdate: {
        description: "Cet événement fait partie d'une série. Que veux-tu modifier ?",
        options: {
          all: 'Tous les événements',
          cancel: 'Annuler',
          future: 'Cet événement et les suivants',
          this: 'Cet événement',
        },
        title: 'Modification récurrente',
      },
      saveFailed: {
        keepsInput: "Tes saisies sont toujours à l'écran : rien n'est perdu.",
        reason: "Ça n'a pas marché. Vérifie ta connexion, puis appuie de nouveau sur Enregistrer.",
        title: "L'enregistrement n'est pas passé",
      },
      stillLoading: {
        // eslint-disable-next-line max-len
        description: "Laisse l'événement finir de s'afficher : enregistrer maintenant effacerait ses tâches, ses équipes conviées et son lieu.",
        title: "La fiche n'est pas encore chargée",
      },
      unsupportedEdit: {
        title: 'Modification limitée',
      },
    },
    noEventTypeIsAvailable: 'Aucun type d événement n est disponible pour le moment.',
    noFacility: 'Aucune installation',
    noOtherClubTeamIs: 'Aucune autre équipe du club n est disponible pour le moment.',
    noTeamAvailableToCreate: 'Aucune équipe disponible pour créer ou modifier cet événement.',
    planning: 'Planning',
    preparingTheForm: 'Préparation du formulaire...',
    pricePerPerson: 'Prix par personne',
    recurringSeries: 'Série recurrente',
    sayHowManyExternalSpots: 'Indique combien de places externes tu ouvres pour cet entraînement.',
    scopeOfTheUpdate: 'Portee de la mise à jour',
    setupUnavailable: 'Configuration indisponible',
    start: 'Début',
    team: 'Équipe',
    teamFallback: 'Equipe',
    // eslint-disable-next-line max-len
    theFeaturingRequestIsMade: 'La demande de mise à la une se fait depuis la fiche de l événement après création.',
    // eslint-disable-next-line max-len
    theScopeBelowDecidesWhether: 'La portee ci-dessous determine si la mise à jour s applique à cet événement seulement, aux suivants, ou à toute la série.',
    // eslint-disable-next-line max-len
    theWebVersionNowAlso: 'La version web couvre maintenant aussi les invitations d équipes et les tâches annexes, au plus proche du flow mobile.',
    theWholeSeries: 'Toute la série',
    thisEvent: 'Cet événement',
    thisEventAndTheFollowing: 'Cet événement et les suivants',
    // eslint-disable-next-line max-len
    thisEventNoLongerExists: 'Cet événement n existe plus ou ne peut pas être modifie depuis ce lien.',
    thisPageCanTEdit: "Cette fiche ne permet pas encore d'éditer ce type d'événement.",
    // eslint-disable-next-line max-len
    thisSlotExceedsTheFacility: 'Ce créneau dépasse la capacité de l installation. L événement restera en demande en attente jusqu au traitement d un dirigeant.',
    // eslint-disable-next-line max-len
    thisSlotExceedsTheFacility2: 'Ce créneau dépasse la capacité de l installation, mais ce club est configure en Autorise et notifier. L événement restera confirme et les dirigeants seront prevenus.',
    title: 'Créer un événement',
    titleEdit: 'Modifier l\'événement',
    trainingOpen: {
      externalLimitRequired: 'Indique combien de places externes tu ouvres pour cet entraînement.',
    },
    typeTeamDateAndStart: 'Type, équipe, date et heure de début sont obligatoires.',
    unableToLoadTheForm: 'Impossible de charger les données du formulaire.',
    unableToSaveThisEvent: 'Impossible d enregistrer cet événement.',
    update: 'Mettre à jour',
  },

  eventFilters: {
    actions: {
      apply: 'Appliquer les filtres',
      clear: 'Effacer les filtres',
      empty: 'Effacer les filtres',
      submit: 'Appliquer',
    },
    alertCreatedSuccessfully: 'Alerte créée avec succès !',
    alertUpdatedSuccessfully: 'Alerte modifiée avec succès !',
    cancel: 'Annuler',
    cityAndRadiusAreRequired: 'La ville et le rayon sont obligatoires pour créer une alerte',
    createAlert: 'Créer alerte',
    createAnAlert: 'Créer une alerte',
    createTheAlert: "Créer l'alerte ★",
    editTheAlert: "Modifier l'alerte",
    errorWhileSaving: 'Erreur lors de la sauvegarde',
    event: 'Événement · {{cityName}}',
    fields: {
      activity: {
        label: 'Sport',
        placeholder: 'Sélectionner un sport',
      },
      category: {
        label: 'Catégorie',
        placeholder: 'Sélectionner une catégorie',
      },
      club: {
        label: 'Club',
        placeholder: 'Sélectionner un club',
      },
      date: {
        label: 'Date',
        placeholder: 'Sélectionner une date',
      },
      level: {
        label: 'Niveau',
        placeholder: 'Sélectionner un niveau',
      },
      sessionStatus: {
        label: 'Statut de la session',
        options: {
          closed: 'Fermé',
          open: 'Ouvert',
        },
        placeholder: 'Sélectionner un statut',
      },
      team: {
        label: 'Équipe',
        placeholder: 'Sélectionner une équipe',
        selectClubFirst: 'Sélectionner un club avant l\'équipe',
      },
      type: {
        label: 'Type d\'événement',
        placeholder: 'Sélectionner un type d\'événement',
      },
    },
    infos: {
      activity: 'Le sport pratiqué par l\'équipe (football, basketball, handball, etc.).\n\nFiltrer par sport te permet de ne voir que les événements correspondant à ton discipline.',
      category: 'La catégorie d\'âge de l\'équipe (U7, U9, U11, U13, Senior, etc.).\n\nTu peux sélectionner plusieurs catégories pour voir tous les événements correspondants.',
      level: 'Le niveau de jeu de l\'équipe (Départemental, Régional, National, etc.).\n\nCe filtre t\'aide à trouver des événements adaptés à ton niveau de pratique.',
      type: 'Le type d\'événement (Entraînement, Match, Détection, Tournoi, etc.).\n\nSélectionne plusieurs types pour voir différentes activités.',
    },
    matchingEventsForNow_one: 'Pour le moment, {{count}} événement correspond',
    matchingEventsForNow_other: 'Pour le moment, {{count}} événements correspondent',
    saveChanges: 'Enregistrer les modifications',
    search: 'Recherche',
  },
  eventFiltersSheet: {
    allCities: 'Toutes les villes',
    allFeminine: 'Toutes',
    allMasculine: 'Tous',
    allSports: 'Tous les sports',
  },
  eventList: {
    actions: {
      about: 'À propos',
      absent: 'Absent·e',
      add: 'Ajouter un événement',
      findEvent: 'Trouver un événement',
      join: 'Participer',
      present: 'Présent·e',
    },
    emptyDesc: 'Essaie de modifier tes filtres ou lance une nouvelle recherche.',
    featured: 'À la une :',
    info: {
      alreadyJoined: 'Je participe !',
      alreadyMissing: 'Je serai absent·e',
      declinedRequest: 'Demande refusée',
      eventFull: 'Cet événement est complet.',
      pendingRequest: 'Demande en attente',
      restrictedEvent: 'Accès réservé',
      staffDoesNotRsvp: 'Tu encadres cet événement : ce sont les joueurs qui répondent.',
    },
    joinModal: {
      actions: {
        cancel: 'Annuler',
        confirm: 'Confirmer ma participation',
      },
      checkboxes: {
        conditions: "J'accepte les conditions pour participer à l'événement",
        responsibility: 'Je déclare avoir pris connaissance de la "Déclaration de responsabilité et acceptation des risques"',
      },
      description: 'Je soussigné(e), participant majeur ou, le cas échéant, représentant légal du participant mineur, reconnais et accepte ce qui suit :'
        + '\n\nRôle de Found Club : '
        + '\n    - Found Club est une plateforme de mise en relation et n\'organise pas l\'événement. Found Club ne fournit aucune assurance liée à la participation.'
        + '\n\nTrajets aller/retour :'
        + '\n    - Sauf transport expressément organisé par l\'organisateur, le trajet vers et depuis l\'événement est sous ma responsabilité (ou celle du représentant légal pour un mineur), y compris assurance et choix du mode de transport.'
        + '\n\nAssurance :'
        + '\n    - J\'atteste disposer (ou, pour un mineur, que l\'enfant dispose) d\'une couverture d\'assurance appropriée (ex. licence fédérale en cours et/ou responsabilité civile). J\'ai compris que Found Club n\'assure ni les dommages corporels ni matériels.'
        + '\n\nAptitude médicale :'
        + '\nJ\'atteste être apte à la pratique au jour de l\'événement (ou que l\'enfant est apte, conformément aux exigences fédérales : certificat/questionnaire le cas échéant) et je m\'engage à ne pas participer / ne pas autoriser la participation en cas de doute sur l\'état de santé.'
        + '\n\nLimites de responsabilité (droit FR) :'
        + '\nDans la mesure permise par la loi, je m\'engage à ne pas rechercher la responsabilité de Found Club du fait de la participation ; cette clause ne s\'applique pas en cas de faute lourde ou intentionnelle ou de manquement grave aux obligations de sécurité imputable à Found Club ou à l\'organisateur.'
        + '\n\nRèglement & sécurité :'
        + '\nJe m\'engage (ou j\'engage le mineur) à respecter le règlement, les consignes de sécurité et les instructions des encadrants ; l\'organisateur peut refuser ou interrompre la participation en cas de non-respect.'
        + '\n\nUrgence médicale :'
        + '\nJ\'autorise l\'organisateur à prévenir les secours en cas d\'urgence ; pour un mineur, j\'autorise l\'organisateur à accompagner l\'enfant si nécessaire et je m\'engage à rester joignable.',
      title: 'DÉCLARATION DE RESPONSABILITÉ ET ACCEPTATION DES RISQUES',
      validation: 'En cochant les cases et en validant mon inscription, je confirme avoir lu, compris et accepté la présente déclaration et j\'accepte de participer à l\'événement dans ces conditions.',
    },
    loadingDesc: 'Nous chargeons les événements correspondant à ta recherche.',
    loadingTitle: 'Chargement des événements',
    loadingUpdating: 'Actualisation des événements...',
    noData: 'Aucun événement trouvé.',
    searchPlaceholder: 'Rechercher un événement',
    title: 'Mes événements',
  },
  eventListContent: {
    eventsFrom: 'Événements à partir de',
    eventsInThisArea_one: '{{count}} événement dans cette zone',
    eventsInThisArea_other: '{{count}} événements dans cette zone',
    opensTheEventsMapView: 'Ouvre la vue carte des événements.',
    sortedByRelevance: 'Trie par pertinence',
    switchToMapView: 'Passer en mode carte',
    zoomInOnTheMap: 'Zoome sur la carte pour afficher tous les événements de cette zone.',
  },
  eventParticipants: {
    absent: 'Absent',
    exportTheListExcelCsv: 'Exporter la liste (Excel/CSV)',
    noAnswer: 'Sans réponse',
    noConfirmedParticipantYet: 'Aucun participant confirme pour le moment.',
    user: 'Utilisateur',
  },
  eventReservationActions: {
    full: '✅ Complet',
    open: '🟢 Ouvert',
    playersWanted: '👥 Joueurs recherchés',
    sosActive: '🔥 SOS actif',
  },
  eventShareBubble: {
    event: 'Événement',
    openTheEvent: 'Ouvrir l événement',
    sharedEvent: 'Événement partage',
    team: 'Équipe:',
  },
  eventTasksEditor: {
    add: 'Ajouter',
    automaticApproval: 'Validation automatique',
    cancel: 'Annuler',
    customTitle: 'Titre personnalise.',
    delete: 'Supprimer',
    displayedTitle: 'Titre affiche',
    extraTasks: 'Tâches annexes',
    manual: 'Manuelle',
    manualApproval: 'Validation manuelle',
    newTask: 'Nouvelle tâche',
    noTaskYet: 'Aucune tâche pour le moment.',
    numberOfPeople: 'Nombre de personnes',
    task: 'Tache',
    taskType: 'Type de tâche',
    theTitleFillsInFrom: 'Le titre se remplit à partir du type choisi, puis tu peux le modifier.',
    title: 'Titre',
    typeCompanion: 'Accompagnateur',
    typeEquipment: 'Materiel',
    typeKits: 'Responsable maillots',
    typeName: 'Nom du type',
    typeOther: 'Autre',
    typePhotos: 'Photos / videos',
    typeRefereeing: 'Arbitrage',
    typeRefreshments: 'Buvette',
    typeScoreTable: 'Table de marque',
    typeTransport: 'Voiture / transport',
  },
  eventTasksSection: {
    approve: 'Valider',
    approved: 'Valide',
    assign: 'Assigner',
    assignMembers: 'Assigner des membres',
    automaticApproval: 'Validation automatique',
    cancel: 'Annuler',
    cancelled: 'Annule',
    cancelMyRequest: 'Annuler ma demande',
    chooseThePeopleToAdd: 'Choisis les personnes à ajouter.',
    confirmedAssignments: 'Affectations confirmées',
    decline: 'Refuser',
    declined: 'Refuse',
    extraTasks: 'Tâches annexes',
    iLlTakeIt: "Je m'assigne",
    iVolunteer: 'Je me porte volontaire',
    member: 'Membre',
    // eslint-disable-next-line max-len
    membersCanVolunteerAndStaff: 'Les membres peuvent se proposer, et les encadrants peuvent assigner directement les bonnes personnes.',
    memberSReadyToBe: '{{selectedCount}} membre(s) prêt(s) à être assignes',
    // eslint-disable-next-line max-len
    noAdditionalMemberIsAvailable: 'Aucun membre supplémentaire n est disponible pour cette tâche pour le moment.',
    nobodyIsConfirmedOnThis: 'Personne n est encore confirme sur cette tâche.',
    pending: 'En attente',
    pendingVolunteers: 'Volontaires en attente',
    removeAMemberOrChoose: 'Retire un membre ou choisis une autre tâche avant de continuer.',
    // eslint-disable-next-line max-len
    selectOneOrMoreMembers: 'Sélectionne un ou plusieurs membres pour les affecter directement à cette tâche.',
    taskFull: 'Tâche complète',
    thisTask: 'cette tâche',
    thisTaskIsAlreadyFull: 'Cette tâche est déjà complété',
    unableToApproveThisAssignment: 'Impossible de valider cette assignation.',
    unableToAssignTheseMembers: 'Impossible d assigner ces membres à la tâche.',
    unableToCancelThisAssignment: 'Impossible d annuler cette assignation.',
    unableToDeclineThisAssignment: 'Impossible de refuser cette assignation.',
    unableToJoinThisTask: 'Impossible de rejoindre cette tâche.',
    unknown: 'Inconnu',
    volunteeringWithManualApproval: 'Volontariat avec validation manuelle',
    yourStatus: 'Ton statut : ',
  },
  eventTeamAudiencesEditor: {
    add: 'Ajouter',
    allMembers: 'Tous les membres',
    cancel: 'Annuler',
    // eslint-disable-next-line max-len
    chooseATeamThenDecide: 'Choisis une équipe, puis décide si tu invites tout le monde ou seulement certains membres.',
    clubName: 'Nom du club',
    delete: 'Supprimer',
    edit: 'Modifier',
    editTheInvitation: 'Modifier linvitation',
    externalTeam: 'Équipe externe',
    internalTeam: 'Équipe interne',
    loadingTeams: 'Chargement des équipes...',
    member: 'Membre',
    newInvitation: 'Nouvelle invitation',
    noAdvancedInvitationYet: 'Aucune invitation avancée pour le moment.',
    noClubFound: 'Aucun club trouve.',
    noMemberAvailableForThis: 'Aucun membre disponible pour cette équipe.',
    noTeamAvailable: 'Aucune équipe disponible.',
    organiser: 'Organisateur',
    save: 'Enregistrer',
    searchForAClub: 'Rechercher un club',
    searchForATeam: 'Rechercher une équipe',
    searching: 'Recherche en cours...',
    selectedMembers: 'Membres sélectionnés',
    teamFallback: 'Equipe',
    teamInvitations: "Invitations d'équipe",
    teamName: 'Nom de lequipe',
  },
  eventTeamAudiencesSection: {
    accept: 'Accepter',
    accepted: 'Acceptee',
    allMembers: 'Tous les membres',
    cancelled: 'Annulee',
    cancelTheInvitation: "Annuler l'invitation",
    decline: 'Refuser',
    declined: 'Refusee',
    externalTeam: 'Équipe externe',
    internalTeam: 'Équipe interne',
    organiser: 'Organisateur',
    pending: 'En attente',
    teamFallback: 'Equipe',
    teamInvitations: "Invitations d'équipe",
    unableToUpdateThisInvitation: 'Impossible de mettre à jour cette invitation.',
  },
  eventUseCases: {
    // eslint-disable-next-line max-len
    detectionEditUnavailable: 'Les détections avec postes recherches ne peuvent pas encore être reeditees depuis cette fiche sans risque de perdre la configuration des postes.',
    // eslint-disable-next-line max-len
    stageEditUnavailable: "La modification d'un stage n'est pas encore possible, ni ici ni ailleurs dans l'application. C'est un manque connu de notre côté, pas une erreur de ta part.",
    // eslint-disable-next-line max-len
    tournamentEditUnavailable: "La modification complète d'un tournoi n'est pas encore possible ici. Depuis sa fiche, « Gérer le tournoi » permet déjà d'ajuster une partie de ses réglages.",
  },
  eventWizard: {
    common: {
      stepCounter: 'Étape {{current}}/{{total}}',
    },
    errors: {
      datePast: "La date ou l'heure de début doit être dans le futur.",
      genericCreate: "Erreur de création d'événement.",
      genericLoad: 'Impossible de charger cette étape.',
      invalidTimeRange: "L'heure de fin doit être après l'heure de début.",
      invitesFetch: 'Impossible de charger les équipes à inviter.',
      locationRequired: 'Un lieu est requis.',
      noOtherTeams: 'Aucune autre équipe disponible à inviter.',
      noTeams: 'Aucune équipe organisatrice disponible.',
      noTypes: "Aucun type d'événement disponible.",
      recurrenceDatesRequired: 'Les dates de récurrence sont obligatoires.',
      recurrenceDaysRequired: 'Sélectionne au moins un jour de récurrence.',
      recurrenceInvalidRange: 'La date de fin de récurrence doit être après la date de début.',
      slotConflict: 'Conflit de créneau détecté pour le lieu sélectionné.',
    },
    partial: {
      actions: {
        keep: 'Conserver les créations',
        retry: 'Réessayer les échecs',
        rollback: 'Annuler les créations',
      },
      noCreated: "Aucun événement n'a été créé.",
      rollbackPartial: "{{count}} annulation(s) n'ont pas pu être finalisées.",
      rollbackSuccess: 'Les événements créés ont été annulés.',
      summary: '{{success}} succès / {{failed}} échec(s).',
      title: 'Création partielle détectée',
    },
    recap: {
      actions: {
        create: 'Créer les événements',
        createShort: 'Créer',
        edit: 'Modifier',
      },
      addDescription: '+ Ajouter une description',
      advanced: {
        featuredCount: '{{count}} espace(s)',
        invites: 'Invitations',
        invitesCount: '{{count}} equipe(s)',
        no: 'Non',
        none: 'Aucune',
        opponent: 'Adversaire',
        opponentNone: 'Pas encore connu',
        tasks: 'Tâches annexes',
        title: 'Options avancées',
      },
      capacity: 'Participants max: {{value}}',
      capacityTitle: 'Capacité',
      capacityValue: '{{count}} joueurs',
      completedCount: '{{done}}/5 infos clés complétées',
      creationProgress: {
        description: '{{completed}}/{{total}} evenements traites',
        partialFailures: '{{count}} création(s) à vérifier',
        title: 'Création en cours',
      },
      dateLabel: 'Date',
      dateTimeTitle: 'Date & horaire',
      externalQuotaTitle: 'Places externes',
      externalValidationTitle: 'Validation externe',
      facilitySelected: 'Installation sélectionnée',
      featured: {
        descriptionShort: "Rien n'est envoyé si aucun espace n'est coché.",
        recurrentNote: 'Pour une récurrence, la demande sera envoyée pour chaque occurrence créée.',
        title: 'Mise à la une',
        // eslint-disable-next-line max-len
        warningMessage: "L'événement est créé, mais la demande de mise à la une n'a pas pu être envoyée. Tu pourras la refaire depuis le detail.",
        warningTitle: 'Événement crée',
      },
      freeQuota: {
        description: '{{remaining}}/{{total}} publication gratuite restante avant paywall.',
        // eslint-disable-next-line max-len
        hint: 'Une fois cet avantage utilise, les prochaines publications seront bloquées cote serveur et renverront vers ton abonnement.',
        title: 'Quota événement gratuit',
      },
      incomplete: 'à compléter',
      internalValidationMode: 'Membres internes: {{value}}',
      invitedTeamsTitle: 'équipes invitées',
      invitesCount: '{{count}} équipe(s) invitée(s)',
      noDescription: 'Aucune description',
      notSet: 'Non renseigné',
      organizationTitle: 'Organisation',
      participationTitle: 'Participation',
      perDayLocations: 'Lieux personnalises par jour',
      pricePerPerson: 'Prix par personne: {{value}}',
      quickOverviewTitle: 'Vue d\'ensemble',
      ready: 'Prêt à créer',
      recurrenceCount: '{{count}} occurrence(s) prévues',
      reservationMode: 'Mode de réservation: {{value}}',
      sections: {
        description: 'Description',
        location: 'Lieu',
        logistics: 'Logistique',
        participantPrivacy: 'Confidentialité participants',
        participants: 'Participants',
        reservation: 'Réservation',
        team: 'Équipe',
        type: 'Type',
        validation: 'Validation',
        visibility: 'Visibilité',
      },
      timeLabel: 'Horaire',
      totalPlayers: 'Joueurs attendus: {{value}}',
      totalPlayersTitle: 'Joueurs attendus',
      validationMode: 'Validation: {{value}}',
      whenWhereTitle: 'Quand et lieu',
    },
    stage: {
      applyToAll: 'Appliquer à tous',
      applyToAllHelper: 'Réinitialise les horaires personnalises et reapplique la base du stage.',
      customHours: 'Horaires personnalises',
      customizeHours: 'Personnaliser les horaires',
      customizeLocation: 'Personnaliser le lieu',
      customLocation: 'Lieu personnalise',
      dayEndTime: 'Heure de fin du jour',
      daysHelper: 'Active ou personnalise uniquement les journées qui sortent du cadre par défaut.',
      dayStartTime: 'Heure de début du jour',
      daysTitle: 'Jours du stage',
      defaultEndTime: 'Heure de fin',
      defaultHoursHelper: 'Ces horaires servent de base pour toutes les journées actives du stage.',
      defaultHoursTitle: 'Horaires par défaut',
      defaultStartTime: 'Heure de début',
      endDate: 'Date de fin',
      errors: {
        locationOverrideRequired: 'Complète le lieu personnalise pour chaque jour concerne.',
        noActiveDays: 'Active au moins une journée pour continuer.',
      },
      inheritedHours: 'Horaires hérités du stage',
      mainLocation: 'Lieu principal',
      periodTitle: 'Periode',
      startDate: 'Date de début',
      // eslint-disable-next-line max-len
      subtitle: 'Définis la période du stage, les horaires par défaut et les exceptions sur certains jours.',
      title: 'Programme du stage',
      useDefaultHours: 'Revenir aux horaires par défaut',
      useMainLocation: 'Revenir au lieu principal',
    },
    steps: {
      access: {
        advancedGroup: 'Avancé',
        externalAlwaysManualHint: 'Les demandes extérieures sont validées par toi.',
        externalGroup: 'Demandes extérieures',
        identityAnonymized: 'Anonymisées',
        identityAnonymizedHint: 'Les autres ne verront que le nombre de participants.',
        identityRow: 'Identités des participants',
        identityVisible: 'Visibles',
        identityVisibleHint: 'Les participants apparaissent avec leur nom et leur photo.',
        subtitleShort: "Qui voit l'événement, et comment on s'y inscrit.",
        titleShort: 'Accès',
        validationAutoHint: 'Les participants confirment seuls leur présence — recommandé.',
        validationGroupInternal: 'Validation des membres internes',
        validationGroupMembers: 'Validation des membres',
        validationManualHint: 'Le coach valide chaque participant, un par un.',
        visibilityGroup: 'Visibilité',
        visibilityPrivate: 'Privé',
        visibilityPrivateHint: "Réservé aux membres de l'équipe et aux invités.",
        visibilityPublic: 'Public',
        visibilityPublicHint: 'Découvrable par tous — recommandé pour une détection.',
      },
      description: {
        label: 'Description',
        placeholder: 'Ajoute des détails utiles pour les participants.',
        // eslint-disable-next-line max-len
        placeholderExample: "Ex. : viens essayer le foot avec les U15 — prévois une tenue de sport, l'essai est gratuit.",
        subtitle: 'Ajoute un contexte clair pour cet événement.',
        subtitleShort: "Ce que les joueurs liront avant de s'inscrire.",
        title: 'Description',
        valueHint: 'Une description claire double les inscriptions sur une détection.',
      },
      detectionSlots: {
        capacityWarning: 'Le total des places par poste dépasse la capacité de l événement.',
        emptyPositions: 'Aucun poste n est actuellement défini pour ce sport.',
        positionSummary: '{{count}} place(s) sur ce poste',
        recapSummary: '{{count}} place(s) cible au total',
        // eslint-disable-next-line max-len
        recurrenceHintBody: 'Les postes recherches sont disponibles uniquement sur une détection simple, non recurrente.',
        recurrenceHintTitle: 'Postes par détection indisponibles',
        selectedSectionTitle: 'Postes actifs',
        // eslint-disable-next-line max-len
        slotsSummaryFixed: '{{count}} places fléchées sur {{capacity}} — les {{free}} autres restent libres.',
        slotsSummaryUnlimited: '{{count}} place(s) fléchée(s) sur un poste précis.',
        toggleHint: 'Optionnel : les joueurs candidateront ensuite sur un poste précis.',
        unselectedActionLabel: 'Activer',
      },
      invites: {
        myTeams: 'MES ÉQUIPES',
        otherTeams: 'AUTRES ÉQUIPES',
        subtitle: 'Invite des équipes, ou passe cette étape.',
        title: 'Invitations',
      },
      location: {
        addInstallation: 'Ajouter une installation',
        addressMissing: 'Adresse non renseignée',
        // eslint-disable-next-line max-len
        allowAndNotifyConflict: 'Ce créneau dépasse la capacité, mais il restera autorise et notifiera les dirigeants.',
        // eslint-disable-next-line max-len
        allowAndNotifyHint: "Créneau complet sur cet horaire — le club l'autorise quand même, l'événement reste confirmé.",
        capacityAvailable: 'Cette installation à encore de la capacité pour ce créneau.',
        // eslint-disable-next-line max-len
        disabledNextHint: 'Sélectionne une installation du club ou saisis une adresse extérieure pour continuer.',
        focusSubtitle: "Où se déroule l'événement ?",
        helper: 'Sélectionne un lieu du club ou saisis une adresse externe.',
        installationHelper: 'Choisis une installation existante de ton club.',
        modeButtonHint: 'Sélectionné ce mode de lieu',
        modeHint: 'Choisis si le lieu est dans ton club ou en extérieur.',
        noInstallations: 'Aucune installation disponible pour ce club.',
        noInstallationsTitle: 'Aucune installation pour le moment',
        // eslint-disable-next-line max-len
        pendingValidationConflict: "Ce créneau dépasse la capacité. La création passera en demande en attente jusqu'a validation d'un dirigeant.",
        // eslint-disable-next-line max-len
        pendingValidationHint: "Créneau complet sur cet horaire — l'événement partira en demande de validation au club.",
        subtitle: 'Le lieu est obligatoire pour continuer.',
        title: 'Lieu',
      },
      logistics: {
        dateTimeGroupLabel: 'DATE ET HORAIRE',
        focusSubtitle: "Quand a lieu l'événement ?",
        focusTitle: 'Date & horaire',
        isRecurrent: 'Événement récurrent',
        // eslint-disable-next-line max-len
        recurrenceBaseDayHint: "Le jour de l'événement est présélectionné. Tu peux ajouter d'autres jours.",
        recurrenceDays: 'Jours de récurrence',
        recurrenceInterval: 'Intervalle de récurrence',
        recurrenceIntervalDecrement: "Réduire l'intervalle de récurrence",
        recurrenceIntervalIncrement: "Augmenter l'intervalle de récurrence",
        recurrenceIntervalMonthlyMany: 'Tous les {{count}} mois',
        recurrenceIntervalMonthlyOne: 'Tous les mois',
        recurrenceIntervalWeeklyMany: 'Toutes les {{count}} semaines',
        recurrenceIntervalWeeklyOne: 'Toutes les semaines',
        recurrenceTitle: 'Configuration récurrence',
        repeatApply: 'Appliquer',
        repeatClear: 'Ne pas répéter',
        repeatRowLabel: 'Répéter',
        repeatRowOnce: 'Une seule fois',
        repeatSheetTitle: "Répéter l'événement",
        reservationMode: 'Mode de réservation',
        reservationTitle: 'Paramêtres réservation',
        subtitle: "Configure date, horaires et règles d'accès.",
        title: 'Logistique',
      },
      // Y02 — l'etape « Contre qui ? » du tunnel, posee uniquement pour un match.
      // Idee d'Adel du 2026-08-19 : l'evenement doit s'appeler « Match vs X ».
      opponent: {
        clubResultsTitle: 'Clubs trouvés',
        clubSelected: 'Club trouvé. Précise son équipe en modifiant le nom si besoin.',
        hint: 'Tu ne le connais pas encore ? Passe cette étape, tu pourras l’ajouter plus tard.',
        inviteActivitiesError: 'Impossible de charger la liste des sports pour le moment.',
        inviteChangeClub: 'Changer de club',
        inviteClearFilters: 'Effacer les filtres',
        inviteClubsError: 'Impossible de charger les clubs externes pour le moment.',
        inviteClubsFiltered: 'Clubs correspondant aux filtres',
        inviteClubsFound: 'Résultats de recherche',
        inviteClubsProposed: 'Clubs proposes',
        inviteCurrent: 'Équipe adverse invitée',
        inviteFiltersTitle: 'Filtres de recherche club',
        inviteNoClub: 'Aucun club externe disponible pour le moment.',
        inviteNoClubForFilters: 'Aucun club externe ne correspond à ces filtres pour le moment.',
        inviteNoClubForSearch: 'Aucun club externe trouve pour cette recherche.',
        inviteNoTeam: 'Aucune équipe disponible pour ce club.',
        inviteNoTeamForSearch: 'Aucune équipe ne correspond à cette recherche.',
        inviteOpenClub: 'Appuie pour voir les équipes du club',
        invitePending: 'Invitation en attente de réponse',
        invitePendingSummary: 'Invitation envoyée à {{team}} — son coach doit accepter.',
        inviteSearchPlaceholder: 'Rechercher un club externe',
        inviteSelectedClub: 'Club sélectionne',
        // eslint-disable-next-line max-len
        inviteSubtitle: 'Cherche son club, puis son équipe : elle recevra une invitation à ce match.',
        inviteTeamAction: 'Appuie pour inviter cette équipe',
        inviteTeamHint: 'Choisis l équipe que tu affrontes : son coach recevra l invitation.',
        inviteTeamSearchPlaceholder: 'Rechercher une équipe',
        inviteTeamsError: 'Impossible de charger les équipes de ce club.',
        inviteTitle: 'Inviter l équipe adverse sur FoundClub',
        placeholder: 'Ex. : US Blaisoise U15',
        subtitle: 'Le match s’appellera « Match vs » suivi de ce nom.',
        title: 'Contre qui ?',
      },
      participants: {
        decrease: 'Un joueur de moins',
        externalQuotaLabel: 'Places externes',
        fixed: 'Capacité fixe',
        hint: 'Tu pourras encore modifier ces valeurs avant la création finale.',
        hintFixed: 'Les inscriptions restent libres dans la limite des {{count}} places.',
        hintUnlimited: 'Aucun plafond : tout le monde peut s inscrire.',
        increase: 'Un joueur de plus',
        internalInvitesAllAction: 'Inviter tous les membres',
        // eslint-disable-next-line max-len
        internalInvitesAllHint: 'Tous les membres de cette équipe recevront cette invitation et verront ensuite l événement dans leur planning.',
        internalInvitesAllMembers: 'Tous les membres invites',
        internalInvitesEmptyRoster: 'Aucun membre disponible pour cette équipe.',
        // eslint-disable-next-line max-len
        internalInvitesModalHint: 'Choisis si tu invites tout le groupe ou seulement certains membres à cet événement.',
        internalInvitesPickedCount: '{{count}} membre(s) sélectionne(s)',
        internalInvitesPickPrompt: 'Sélectionne les membres à inviter',
        internalInvitesRemove: 'Retirer cette invitation',
        internalInvitesSelectedCount: '{{count}} membre(s) invites',
        internalInvitesSomeAction: 'Choisir certains membres',
        // eslint-disable-next-line max-len
        internalInvitesSubtitle: 'Choisis une équipe, puis invite tout le groupe ou seulement les membres concernés.',
        internalInvitesTeamHint: 'Appuie pour choisir les membres ou inviter toute l equipe.',
        internalInvitesTitle: 'Inviter des membres d une équipe de mon club',
        invitesOnlySubtitle: 'Invite une équipe de ton club à cet entraînement.',
        matchCallUpCount: '{{count}} sur {{total}}',
        // eslint-disable-next-line max-len
        matchCallUpEmpty: "Cette équipe n'a encore aucun joueur. Tu pourras convoquer depuis la fiche du match.",
        matchCallUpHint: 'Tu pourras encore la modifier, puis la publier depuis la fiche du match.',
        matchCallUpSubtitle: 'Coche les joueurs que tu convoques.',
        matchCallUpTitle: 'Convocation',
        modeHintFixed: 'Mode capacité fixe: nombre de places limite.',
        modeHintUnlimited: 'Mode illimité: aucun plafond de participants.',
        modeLabel: 'Mode de capacité',
        playersUnit: 'joueurs max',
        previewCapacity: 'Capacité: {{value}}',
        previewMode: 'Mode: {{value}}',
        previewTitle: 'Aperçu',
        previewTotalPlayers: 'Joueurs attendus: {{value}}',
        quickPresets: 'Valeurs rapides',
        subtitle: 'Choisis une capacité max, ou laisse l événement en accès illimité.',
        subtitleQuestion: "Combien de joueurs peuvent s'inscrire ?",
        summaryTitle: 'Résumé',
        title: 'Participants',
        totalPlayersExceedsCapacity: 'Le nombre de joueurs attendus ne peut pas dépasser la capacité max.',
        trainingOpenCapacity: 'Illimité en interne + quota externe',
        // eslint-disable-next-line max-len
        trainingOpenSubtitle: 'Définis uniquement combien de joueurs externes a l équipe tu veux accepter.',
        trainingPrivateCapacity: 'Illimité (entraînement prive)',
        trainingSubtitle: 'Définis tes joueurs attendus pour cet entraînement.',
        trainingTotalPlayers: 'Joueurs attendus (interne)',
        unlimited: 'Illimité',
        unlimitedHint: 'Aucune limite de places',
        unlimitedLabel: 'Illimité',
      },
      recap: {
        subtitle: 'Vérifie les informations avant création.',
        subtitleShort: 'Relis, corrige, puis crée. Tout reste modifiable après.',
        title: 'Récapitulatif',
      },
      team: {
        createTeamCta: 'Créer une équipe',
        createTeamHint: "Crée d'abord ton équipe, puis reviens créer ton événement.",
        focusSubtitle: "L'événement sera rattaché à cette équipe.",
        myTeams: 'MES ÉQUIPES',
        otherClubTeams: 'AUTRES ÉQUIPES DU CLUB',
        subtitle: "Sélectionne l'équipe organisatrice.",
        title: 'Équipe organisatrice',
      },
      tournament: {
        // eslint-disable-next-line max-len
        subtitle: 'Définis les règles d inscription, les effectifs et les options d équipe pour ton tournoi.',
        title: 'Paramètres du tournoi',
      },
      type: {
        comingSoonTag: 'Bientôt disponible',
        focusSubtitle: 'Un seul choix — il adapte les étapes suivantes.',
        friendlyMatchDescription: "Trouve un adversaire — ouvre l'annonce League",
        friendlyMatchTitle: 'Match amical',
        subtitle: "Sélectionne le type d'événement.",
        title: "Type d'événement",
      },
      validation: {
        autoDesc: 'Les participants peuvent confirmer automatiquement leur présence.',
        autoRuleOne: 'Check-in simplifié pour les joueurs',
        autoRuleTwo: 'Idéal pour les sessions ouvertes',
        manualDesc: 'Le coach valide manuellement les participants.',
        manualRuleOne: 'Contrôle total par le staff',
        manualRuleTwo: 'Recommandé pour les groupes fermés',
        optionLabel: 'Mode {{title}}',
        previewTitle: 'Mode sélectionné',
        recommended: 'Recommandé',
        selectedHint: 'Mode actuellement sélectionné.',
        selectHint: 'Sélectionne ce mode de validation.',
        subtitle: "Définis comment valider les présences à l'événement.",
        title: 'Mode de validation',
      },
      visibility: {
        participantPrivacyAnonymized: 'Participants anonymisés',
        participantPrivacyVisible: 'Identités visibles',
        public: 'Public',
        publicDesc: 'Visible pour tous les profils qui y ont accès.',
        subtitle: "Définis qui peut voir l'événement.",
        team: 'Équipe',
        teamDesc: "Visibilité uniquement pour les membres de l'équipe créatrice de l'événement.",
        title: 'Visibilité',
      },
    },
    tournamentProgram: {
      applyToAll: 'Appliquer à tous',
      applyToAllHelper: 'Réinitialise les horaires personnalises et reapplique la base du tournoi.',
      customHours: 'Horaires personnalises',
      customizeHours: 'Personnaliser les horaires',
      customizeLocation: 'Personnaliser le lieu',
      customLocation: 'Lieu personnalise',
      dayEndTime: 'Heure de fin du jour',
      daysHelper: 'Active ou personnalise uniquement les journées qui sortent du cadre par défaut.',
      dayStartTime: 'Heure de début du jour',
      daysTitle: 'Jours du tournoi',
      defaultEndTime: 'Heure de fin',
      // eslint-disable-next-line max-len
      defaultHoursHelper: 'Ces horaires servent de base pour toutes les journées actives du tournoi.',
      defaultHoursTitle: 'Horaires par défaut',
      defaultStartTime: 'Heure de début',
      endDate: 'Date de fin',
      errors: {
        locationOverrideRequired: 'Complète le lieu personnalise pour chaque jour concerne.',
        noActiveDays: 'Active au moins une journée de tournoi pour continuer.',
      },
      inheritedHours: 'Horaires hérités du tournoi',
      inlinePeriodHelper: 'Définis directement les dates du tournoi avant de choisir le lieu.',
      // eslint-disable-next-line max-len
      logisticsToggleHelper: 'Active cette option pour définir une période, les jours actifs et les horaires par jour.',
      logisticsToggleTitle: 'Tournoi sur plusieurs jours',
      mainLocation: 'Lieu principal',
      periodTitle: 'Periode',
      startDate: 'Date de début',
      // eslint-disable-next-line max-len
      subtitle: 'Définis la période du tournoi, les horaires par défaut et les exceptions sur certains jours.',
      title: 'Programme du tournoi',
      useDefaultHours: 'Revenir aux horaires par défaut',
      useMainLocation: 'Revenir au lieu principal',
    },
  },
  eventWizardRecap: {
    allowed: 'Autorise',
    allowedPlural: 'Autorisees',
    bracketLine: 'Bracket: {{value}}',
    directQualification: 'Directs',
    disabledPlural: 'Desactivees',
    featuredCm: 'A la une multisport',
    featuredCmDescription: 'Visible au niveau de la structure multisport.',
    featuredPublic: 'A la une publique',
    featuredPublicDescription: 'Visible dans les espaces publics FoundClub après validation.',
    featuredSection: 'A la une du club',
    featuredSectionDescription: 'Visible pour les membres du club ou de la section.',
    formatGroupsFinal: 'Poules + finale',
    formatGroupsOnly: 'Poules uniquement',
    formatLeague: 'Championnat',
    formatLine: 'Format: {{value}}',
    formatStraightKnockout: 'Phase finale directe',
    generationAutomatic: 'Automatique',
    generationLine: 'Génération matchs: {{value}}',
    generationManual: 'Manuelle',
    groupsLine: 'Poules: {{value}}',
    maxTeams: 'Max équipes: {{value}}',
    mixedClubs: 'Mix clubs: {{value}}',
    noGroups: 'Aucune',
    noSpecificRuleEntered: 'Aucune règle spécifique renseignée.',
    notAllowed: 'Non autorise',
    oneStanding: '1 classement',
    pointsLine: 'Points: V {{win}} | N {{draw}} | D {{loss}} | F {{forfeit}}',
    qualifiedLine: 'Qualifiés: {{value}}',
    qualifiedPerGroup: '{{qualified}} / poule',
    seedingLine: 'Tirage: {{value}}',
    seedingManual: 'Manuel',
    seedingRandom: 'Aleatoire',
    seedingSnake: 'Serpentin',
    squadSize: 'Effectif: {{min}} - {{max}}',
    standaloneFrame: 'Cadre autonome',
    standaloneTournament: 'Tournoi autonome',
    teamApproval: 'Validation des équipes: {{value}}',
    temporaryTeams: 'Équipes éphémères: {{value}}',
    thirdPlaceMatchEnabled: 'Petite finale activee',
    tournamentSettings: 'Paramètres tournoi',
    tournamentStructure: 'Structure du tournoi',
    yourEvent: 'Ton événement',
  },
  eventWizardTeam: {
    category: 'Catégorie',
    choose: 'Choisir',
    chooseACategory: 'Choisir une catégorie',
    chooseASection: 'Choisir une section',
    chooseASport: 'Choisir un sport',
    // eslint-disable-next-line max-len
    chooseWhetherTheTournamentStarts: "Choisis si le tournoi part d'une équipe existante ou s'il est autonome.",
    continue: 'Continuer',
    loadingReferenceData: 'Chargement des référentiels...',
    // eslint-disable-next-line max-len
    membersOfTheChosenTeam: 'Les membres de l’équipe choisie seront ajoutés au tournoi. Ils ne passeront pas par le RSVP événement classique.',
    myTeams: 'MES ÉQUIPES',
    noCategoryAvailable: 'Aucune catégorie disponible.',
    noClubAvailable: 'Aucun club disponible',
    noSectionAvailable: 'Aucune section disponible.',
    noSportAvailable: 'Aucun sport disponible.',
    // eslint-disable-next-line max-len
    noTeamIsRegisteredAt: 'Aucune équipe n’est inscrite au départ. Le tournoi est défini par sport, section et catégorie.',
    organisingClub: 'Club organisateur',
    otherClubTeams: 'AUTRES ÉQUIPES DU CLUB',
    reload: 'Recharger',
    selectACategory: 'Sélectionner une catégorie',
    selectASection: 'Sélectionner une section',
    selectASport: 'Sélectionner un sport',
    selected: 'Sélectionné',
    sourceTeam: 'Équipe source',
    standaloneTournament: 'Tournoi autonome',
    teamTournament: "Tournoi d'une équipe",
    // eslint-disable-next-line max-len
    theTeamIsRegisteredAutomatically: "L'équipe est inscrite automatiquement. Ses joueurs répondent Présent ou Absent dans le roster tournoi.",
    // eslint-disable-next-line max-len
    thisInformationReplacesTheSource: 'Ces informations remplacent l’équipe source pour classer le tournoi et guider les inscriptions.',
    tournamentFrame: 'Cadre du tournoi',
    tournamentQualification: 'Qualification du tournoi',
    // eslint-disable-next-line max-len
    unableToLoadAllReference: 'Impossible de charger tous les référentiels. Réessaie ou repassez par un tournoi d’équipe.',
  },
  eventWizardTournamentSettings: {
    // eslint-disable-next-line max-len
    addTheInstructionsToShow: 'Ajoute les consignes a afficher sur la fiche tournoi: tenue, format, conditions d inscription ou arbitrage.',
    // eslint-disable-next-line max-len
    allowedTeamsAreRegisteredDirectly: 'Les équipes autorisées sont inscrites directement sans file de validation.',
    allowPlayersFromOtherClubs: 'Autoriser les joueurs d autres clubs',
    allowTemporaryTeams: 'Autoriser les équipes éphémères',
    // eslint-disable-next-line max-len
    chooseWhetherPlayersCanCreate: 'Choisis si les joueurs peuvent créer une équipe éphémère et si le melange entre clubs est autorise.',
    // eslint-disable-next-line max-len
    decideWhetherRegisteredTeamsAre: 'Décide si les équipes inscrites sont acceptées automatiquement ou validées par l organisateur.',
    eG5ASide: 'Ex. 5 contre 5, un joueur actif par tournoi, tenue claire obligatoire...',
    maxNumberOfTeams: 'Nombre max d équipes',
    maxSquad: 'Effectif max',
    minSquad: 'Effectif min',
    // eslint-disable-next-line max-len
    opensTournamentTeamLineUps: 'Ouvre la composition des équipes de tournoi a des profils externes.',
    playersCanCreateTheirOwn: 'Les joueurs peuvent créer leur propre équipe pour ce tournoi.',
    teamApproval: 'Validation des équipes',
    teamsAndEligibility: 'Équipes et éligibilité',
    // eslint-disable-next-line max-len
    theClubManagerAcceptsOr: 'Le dirigeant accepte ou refuse chaque équipe inscrite avant son entrée dans le tournoi.',
    theMinimumSquadSizeCan: 'L effectif minimum ne peut pas dépasser l effectif maximum.',
    // eslint-disable-next-line max-len
    theseRulesDriveTemporaryTeams: 'Ces règles pilotent les équipes éphémères et les inscriptions sur ce tournoi uniquement.',
    tournamentFrame: 'Cadre du tournoi',
    tournamentRules: 'Règles du tournoi',
  },
  eventWizardTournamentStructure: {
    addsASmallFinalWhen: 'Ajoute une petite finale quand le tableau atteint les demi-finales.',
    automaticShuffleOfTheAccepted: 'Melange automatique des équipes acceptées.',
    best3rds: 'Meilleurs 3es',
    bracketSize: 'Taille du bracket',
    // eslint-disable-next-line max-len
    chooseTheTournamentSMain: 'Choisis le fonctionnement sportif principal du tournoi. Le cockpit organisateur pilotera ensuite le tirage, les matchs et les scores.',
    competitionFormat: 'Format de compétition',
    draw: 'Nul',
    drawMode: 'Mode de tirage',
    forfeit: 'Forfait',
    generationAndPoints: 'Génération et points',
    generationAutomatic: 'Automatique',
    // eslint-disable-next-line max-len
    generationAutomaticDescription: 'Le calendrier est généré automatiquement des que les poules sont créées.',
    generationManual: 'Manuelle',
    generationManualDescription: 'L organisateur garde la main sur le declenchement des matchs.',
    groupsAndQualification: 'Poules et qualification',
    groupsFinal: 'Poules + finale',
    groupsFinalDescription: 'Des poules puis une phase finale automatique.',
    groupsOnly: 'Poules uniquement',
    groupsOnlyDescription: 'Des poules uniquement, sans tableau final.',
    knockoutBracket: 'Tableau final',
    league: 'Championnat',
    leagueDescription: 'Un seul classement general, sans bracket.',
    loss: 'Défaite',
    numberOfGroups: 'Nombre de poules',
    qualifiedPerGroup: 'Qualifiés par poule',
    seedingManual: 'Ordre manuel',
    seedingRandom: 'Aleatoire',
    seedingSnake: 'Serpentin',
    // eslint-disable-next-line max-len
    setTheNumberOfGroups: 'Configure le nombre de poules et la facon dont les équipes passent au tableau final ou au classement.',
    // eslint-disable-next-line max-len
    setTheTournamentSSports: 'Définis la structure sportive du tournoi: poules, tableau final, génération des matchs et règles de classement.',
    // eslint-disable-next-line max-len
    setWhetherTheScheduleIs: 'Définis si le calendrier se génère automatiquement et comment le classement attribue les points.',
    snakeDistributionAcrossTheGroups: 'Répartition serpent entre les poules puis le tableau.',
    straightKnockout: 'Phase finale directe',
    straightKnockoutDescription: 'Un tableau final direct a elimination simple.',
    // eslint-disable-next-line max-len
    theKnockoutBracketWillBe: 'Le tableau final sera généré automatiquement depuis les équipes qualifiees ou directement depuis les équipes acceptées.',
    theOrganiserKeepsTheSeed: 'L organisateur garde l ordre de seed pour le tirage.',
    thirdPlaceMatch: 'Match pour la 3e place',
    tournamentStructure: 'Structure du tournoi',
    useAStandardBracketSize: 'Utilise une taille de bracket standard: 2, 4, 8, 16 ou 32.',
    win: 'Victoire',
  },
  eventWizardType: {
    bookingDescription: "Bloque un créneau d'installation",
    chooseTheEventTypeBefore: 'Choisis le type d événement avant de continuer le wizard.',
    detectionDescription: 'Ouvre ton équipe à de nouveaux joueurs',
    events: 'Evenements',
    matchDescription: 'Rencontre de championnat ou de coupe',
    otherDescription: 'Réunion, sortie, animation du club…',
    reload: 'Recharger',
    stageDescription: 'Plusieurs séances sur plusieurs jours',
    tournamentDescription: 'Plusieurs équipes sur une ou plusieurs journées',
    trainingDescription: 'Séance classique pour ton équipe',
    typeSelection: 'Sélection du type',
  },
  facilityAddressLabel: {
    noAddress: 'Adresse non renseignée',
  },
  facilityForm: {
    accessibility: {
      planningColor: 'Couleur de planning',
    },
    actions: {
      create: 'Créer',
      save: 'Enregistrer',
    },
    capacity: {
      plural: 'équipes à la fois',
      singular: 'équipe à la fois',
      teamPlural: 'équipes simultanées',
      teamSingular: 'équipe simultanée',
    },
    conflictModes: {
      allow: {
        description: 'Le créneau reste confirmé, les dirigeants sont notifiés.',
        label: 'Autoriser et notifier',
      },
      pending: {
        description: 'Le créneau passe en demande, un dirigeant valide avant confirmation.',
        label: 'Demande à valider',
      },
    },
    defaults: {
      name: 'Nom de l\'installation',
      type: 'Type inconnu',
    },
    errors: {
      addressGeocodeRequired: 'Sélectionne une adresse géolocalisée dans la liste.',
      contextMissing: 'Impossible de récupérer les informations du club.',
      planningColorInvalid: 'Sélectionne une couleur validé.',
      saveFailed: "Une erreur est survenue lors de l'enregistrement.",
    },
    fields: {
      address: 'Adresse (lieu exact)',
      capacity: 'Capacité',
      capacityConflictMode: 'Comportement en cas de conflit',
      name: 'Nom de l\'installation',
      planningColor: 'Couleur dans le planning',
      type: 'Type — requis',
    },
    hints: {
      addressSelection: 'Sélectionne une adresse dans la liste pour activer le GPS.',
      gpsActive: '✓ GPS activé',
      planningColor: 'Elle sert à repérer l\'installation dans le planning — elle apparaît en pastille sur sa carte.',
    },
    placeholders: {
      address: 'Ex: 12 Rue du Stade...',
      name: 'Ex: Terrain Honneur, Salle A...',
    },
    state: {
      backToList: 'Retour aux installations',
      loadError: 'Impossible de charger l installation',
      loading: 'Chargement de l installation...',
      missingClubBody: 'Impossible de determiner pour quel club créer cette installation.',
      missingClubTitle: 'Contexte club introuvable',
      notFoundBody: 'Le lien est peut-être obsolète ou cette installation a été supprimée.',
      notFoundTitle: 'Installation introuvable',
      retry: 'Réessayer',
      retryLater: 'Réessaie dans quelques instants.',
    },
    subtitle: {
      create: 'Configure une nouvelle installation pour ton club.',
      edit: 'Mets à jour les informations de cette installation.',
    },
    title: {
      create: 'Nouvelle installation',
      edit: 'Modifier l\'installation',
    },
    types: {
      changingRoom: 'Vestiaire',
      clubHouse: 'Club House',
      gym: 'Gymnase',
      pitch: 'Terrain',
      videoRoom: 'Salle vidéo',
    },
    validation: {
      capacityMin: "La capacité doit être d'au moins 1",
      capacityRequired: 'La capacité est requise',
      colorInvalid: 'Sélectionne une couleur validé',
      colorRequired: 'Sélectionne une couleur',
      nameRequired: 'Le nom est requis',
      typeRequired: 'Le type est requis',
    },
  },
  facilityList: {
    actions: {
      add: 'Ajouter',
      openPlanning: 'Voir le planning',
      viewPlanning: 'Voir planning',
    },
    alerts: {
      delete: {
        error: "Impossible de supprimer l'installation pour le moment.",
        title: "Supprimer l'installation",
      },
    },
    badges: {
      multisport: 'Multisport',
      overflowAllowed: 'Conflits : autoriser et notifier',
      overflowBlocked: 'Conflits : demande à valider',
      shared: 'Partagée',
    },
    capacity: {
      hintPlural: 'Capacité simultanée: {{count}} équipes',
      hintSingular: 'Capacité simultanée: {{count}} équipe',
      teamPlural: 'équipes simultanées',
      teamSingular: 'équipe simultanée',
    },
    defaults: {
      addressMissing: 'Adresse non renseignée',
      facilityName: 'Installation',
      unknownType: 'Type inconnu',
    },
    empty: {
      action: 'Ajouter une installation',
      description: 'Ajoute les terrains, gymnases ou salles de ton club.',
      title: 'Aucune installation',
    },
    labels: {
      planning: 'Planning',
      planningColor: 'Couleur planning',
    },
    loadError: 'Impossible de charger les installations',
    missingClub: {
      back: 'Retour aux équipes',
      body: 'Impossible de determiner pour quel club afficher les installations.',
      title: 'Club introuvable',
    },
    noAddress: 'Adresse non renseignée',
    planning: {
      allClubFacilities: 'Toutes installations',
      allSharedFacilities: 'Toutes partagées',
      capacityAvailable: '{{count}} slot(s) restaient disponibles au pic de charge.',
      // eslint-disable-next-line max-len
      capacityReachedOverflow: 'La capacité a déjà été atteinte sur cette période. Les nouveaux dépassements restent autorises et notifieront les dirigeants.',
      // eslint-disable-next-line max-len
      capacityReachedStrict: 'La capacité a déjà été atteinte sur cette période. Les nouveaux dépassements passeront en demande en attente.',
      capacityTitle: 'Capacité installation',
      occupiedBy: 'Occupé par {{clubName}}',
      overflowAllowed: 'Autorise et notifier',
      overflowBlocked: 'Demande en attente',
      scopeClub: 'Mon club',
      scopeShared: 'Partagées',
      selectedFacility: 'Installation sélectionnée',
      sharedEmpty: 'Aucune installation partagée disponible pour ce club.',
      sharedFallbackTitle: 'Occupation',
      sharedLabel: 'Planning partagé',
    },
    readOnlyHint: 'Installation partagée, modification depuis le multisport uniquement.',
    retry: 'Réessayer',
    sections: {
      club: 'Installations du club',
      shared: 'Installations partagées',
    },
    sharedOwnerHint: 'Installation partagée du multisport {{ownerName}}. Lecture seule côté club.',
  },
  facilityService: {
    sections: {
      club: 'Installations du club',
      shared: 'Installations partagées',
    },
  },
  featuredRequests: {
    approveSuccess: {
      message: "L'événement est maintenant à la une du club.",
      title: 'Demande acceptée',
    },
    confirm: {
      approve: {
        message: 'Cet événement sera visible dans le planning de tous les adherents du club.',
        title: 'Accepter la demande ?',
      },
      reject: {
        message: 'Le demandeur sera notifié du refus.',
        title: 'Refuser la demande ?',
      },
    },
    empty: 'Aucune demande en attente',
    rejectSuccess: {
      message: 'Le demandeur a été notifié.',
      title: 'Demande refusée',
    },
  },
  featuredRequestsList: {
    alerts: {
      approvedBody: "L'événement est maintenant mis en avant.",
      approvedTitle: 'Demande validée',
      declinedBody: 'La demande a été rejetée.',
      declinedTitle: 'Demande refusée',
    },
    empty: {
      history: 'Aucun historique',
      pending: 'Aucune demande en attente',
    },
    eventFallback: 'Evenement',
    filters: {
      history: 'Historique',
      pending: 'En attente',
    },
    requester: 'Demandeur:',
    status: 'Statut:',
    unknown: 'Inconnu',
  },
  featuredRequestsScreen: {
    request: {
      date: 'Date:{{date}}',
      eventFallback: 'Evenement',
    },
    tutorial: {
      description: 'Analyse les demandes et valide les événements à la une.',
      title: 'Demandes à la une',
    },
  },
  featuredReservationCard: {
    free: 'Gratuit',
    noLocation: 'Lieu non défini',
    sport: 'Sport',
  },
  filtersSheet: {
    apply: 'Voir les résultats',
    reset: 'Réinitialiser',
    title: 'Filtrer',
  },
  // LOT D41 ② — la copy des chantiers B (tunnel amical, etape 2/7) et C (carte
  // d'annonce) descend ici. Elle etait ecrite en chaines litterales dans le JSX :
  // rien n'etait traduisible, et corriger une faute demandait de toucher le code.
  // ⛔ CE BLOC NE REFORMULE RIEN. Chaque valeur est le texte deja affiche, mot
  // pour mot, apostrophes typographiques comprises. Un rapatriement qui change
  // un mot n'est plus un rapatriement.
  // ⚠️ Les seules interpolations sont des NOMBRES ({{total}}, {{km}}) et une
  // heure validee par regex ({{start}}) : i18next echappe les valeurs interpolees
  // (&, ', <, >), donc un nom de club ou une ville ne passe JAMAIS par {{...}} —
  // « L'Étoile » y deviendrait « L&#39;Étoile ». Ces valeurs restent assemblees
  // en JS, autour du fragment traduit.
  friendlyMatch: {
    adCard: {
      accessibilityHint: 'Ouvrir le détail de l\'annonce',
      accessibilityLabelPrefix: 'Match amical',
      applications: '{{total}} proposition{{plural}}',
      cta: {
        apply: 'Proposer un match',
        applying: 'Envoi...',
        closed: 'Annonce clôturée',
        confirmed: 'Match confirmé',
        declined: 'Proposition refusée',
        matched: 'Adversaire trouvé',
        pending: 'Proposition envoyée',
        staffOnly: 'Réservé aux entraîneurs et dirigeants',
      },
      distance: 'à {{km}} km',
      edit: 'Modifier',
      editAd: 'Modifier l’annonce',
      fallback: {
        category: 'Catégorie libre',
        club: 'Club inconnu',
        dates: 'Dates à convenir',
        format: 'Format à convenir',
        level: 'Niveau libre',
        place: 'Lieu non précisé',
        sport: 'Football',
        time: 'Heure à convenir',
      },
      seeApplications: 'Voir les {{total}} proposition{{plural}}',
      status: {
        closed: 'Clôturée',
        matched: 'Match trouvé',
        online: 'En ligne',
      },
      timeFrom: 'dès {{start}}',
      view: 'Voir',
    },
    wizard: {
      hosting: {
        info: 'Seules les équipes compatibles avec ton choix verront ton annonce'
          + ' — les autres ne la voient pas.',
        options: {
          away: {
            consequence: 'Tu joues chez l’adversaire.',
            label: 'Je me déplace',
          },
          both: {
            consequence: 'Ton annonce touche le plus d’équipes.',
            label: 'Les deux',
          },
          host: {
            consequence: 'Le match se jouera sur ton terrain.',
            label: 'Je reçois',
          },
        },
        subtitle: 'C’est ce qui décide où le match se jouera.',
        title: 'Tu peux recevoir ?',
      },
      location: {
        facilities: {
          hint: 'Choisis-en une et l’adresse se remplit toute seule.'
            + ' Sinon, tape une ville ci-dessous.',
          info: 'Le terrain exact reste modifiable : il se convient dans la discussion'
            + ' qui s’ouvre quand une équipe te répond.',
          title: 'Une installation de ton club',
        },
      },
    },
  },
  friendlyMatchAdDetails: {
    answeringOpensAConversationBetween: 'Répondre ouvre une discussion entre les deux staffs.',
    aTeam: 'Une équipe',
    aWordFromTheStaff: 'Le mot du staff',
    cancel: 'Annuler',
    cancelTheListing: 'Annuler l’annonce',
    cancelThisListing: 'Annuler cette annonce ?',
    // eslint-disable-next-line max-len
    cancelWithApplications: 'Elle ne sera plus visible, et les {{applicationCount}} équipe(s) qui ont répondu ne pourront plus aller plus loin.',
    congratulationsProposalSent: 'Félicitations, proposition envoyée !',
    itSSentWhatComes: 'Elle est envoyée. La suite se joue dans la discussion.',
    itWasAcceptedTheMatch: 'Elle a été acceptée : le match est dans le planning de ton équipe.',
    itWillNoLongerBe: 'Elle ne sera plus visible par les autres équipes.',
    keepTheListing: 'Garder l’annonce',
    // eslint-disable-next-line max-len
    nobodyHasAnsweredYetTeams: 'Personne n’a encore répondu. Les équipes du secteur voient ton annonce.',
    noDateProposed: 'Aucune date proposée.',
    onlyACoachOrA: 'Seuls un entraîneur ou un dirigeant peuvent proposer un match.',
    openTheConversation: 'Ouvrir la discussion',
    proposalsReceived: 'Les propositions reçues',
    proposalsToHandle_one: '{{count}} proposition à traiter',
    proposalsToHandle_other: '{{count}} propositions à traiter',
    proposeAMatch: 'Proposer un match',
    proposedDate: 'Date proposée',
    proposedDates: 'Dates proposées',
    // eslint-disable-next-line max-len
    publishedInConversation: 'Elle vient d’être publiée dans la discussion avec l’autre staff. À vous de convenir des détails.',
    repostWithNewDates: 'Reposter avec de nouvelles dates',
    // eslint-disable-next-line max-len
    theOtherStaffHasJust: 'L’autre staff vient d’être prévenu. Tu la retrouveras dans tes demandes.',
    theOtherStaffWillNo: 'L’autre staff ne verra plus ta proposition. La discussion, elle, reste.',
    thisListingHasFoundIts: 'Cette annonce a trouvé son adversaire.',
    thisListingIsNoLonger: 'Cette annonce n’est plus disponible.',
    thisListingNoLongerAccepts: 'Cette annonce n’accepte plus de proposition.',
    tryAgainInAMoment: 'Réessaie dans un instant.',
    whatThisTeamOffers: 'Ce que cette équipe propose',
    withdraw: 'Retirer',
    withdrawMyProposal: 'Retirer ma proposition',
    withinKm: 'dans un rayon de {{radius}} km',
    yourProposal: 'Ta proposition',
  },
  friendlyMatchApplicationCard: {
    accept: 'Accepter',
    acceptThisMatch: 'Accepter ce match',
    acceptThisTeam: 'Accepter cette équipe ?',
    agreeOnDateTimeAnd: 'Convenir date, heure et lieu',
    answerNotPossible: 'Réponse impossible',
    aTeam: 'Une équipe',
    cancel: 'Annuler',
    decline: 'Refuser',
    editWhatWasAgreed: 'Modifier ce qui est convenu',
    hostingAway: 'Elle se déplace chez toi',
    hostingHost: 'Elle reçoit chez elle',
    hostingToBeConfirmed: 'Hébergement à confirmer',
    noPreferredDateToBe: 'Aucune date privilégiée : à convenir ensemble.',
    openTheConversation: 'Ouvrir la discussion',
    otherApplicationsWarning_one: 'Les {{count}} autre proposition sera refusée automatiquement.',
    // eslint-disable-next-line max-len
    otherApplicationsWarning_other: 'Les {{count}} autres propositions seront refusées automatiquement.',
    preferredDate: 'Date souhaitée : {{day}}',
    statusAccepted: 'Acceptée',
    statusCancelled: 'Annulée',
    statusDeclined: 'Refusée',
    statusPending: 'En attente de ta réponse',
    statusWithdrawn: 'Retirée par l’équipe',
    tryAgainInAMoment: 'Réessaie dans un instant.',
  },
  friendlyMatchApplySheet: {
    any: 'Peu importe',
    aWordOptional: 'Un mot (facultatif)',
    close: 'Fermer',
    eGHelloOurU15: 'Ex : bonjour, notre U15 est disponible, on peut décaler l’horaire.',
    forThisMatch: 'Pour ce match',
    hostingAway: 'Je me déplace',
    hostingHost: 'Je reçois',
    itDecidesWhereTheMatch: ' c’est lui qui décide où le match se joue.',
    messageForTheListingS: 'Message pour le staff de l’annonce',
    myTeam: 'Mon équipe',
    proposeAMatch: 'Proposer un match',
    // eslint-disable-next-line max-len
    sendingOpensAConversationBetween: 'Envoyer ouvre une discussion entre les deux staffs. C’est là que la date, l’heure et le lieu se décident.',
    sendMyProposal: 'Envoyer ma proposition',
    thisChoiceDecidesWhereThe: 'C’est ce choix qui décide où le match se joue.',
    thisListingOnlyAllowsThis: 'Cette annonce n’autorise que ce choix, mais il reste à cocher :',
    unableToSendTheProposal: "Impossible d'envoyer la proposition.",
    whichDate: 'Quelle date',
    whichTeam: 'Quelle équipe',
    youCanAgreeOnThe: 'Tu pourras convenir de l’heure exacte dans la discussion.',
    youHaveNoTeamTo: 'Tu n’as aucune équipe à proposer sur cette annonce.',
  },
  friendlyMatchDateLabels: {
    from: 'à partir de {{start}}',
    fromTo: 'de {{start}} à {{end}}',
    timeToBeAgreed: 'horaire à convenir',
  },
  friendlyMatchFiltersSheet: {
    all: 'Tous',
    allFeminine: 'Toutes',
    any: 'Peu importe',
    apply: 'Appliquer',
    away: 'Je veux me déplacer',
    category: 'Catégorie',
    clear: 'Effacer',
    closeFilters: 'Fermer les filtres',
    days30: '30 jours',
    days7: '7 jours',
    filters: 'Filtres',
    host: 'Je veux recevoir',
    iWantTo: 'Je veux',
    level: 'Niveau',
    listingsThatDonTMatch: 'Les annonces incompatibles avec ton choix sont simplement masquées.',
    months3: '3 mois',
    when: 'Quand',
  },
  friendlyMatchFlow: {
    hostingSummary: {
      away: 'Il se déplace',
      both: 'Reçoit ou se déplace',
      host: 'Il reçoit',
      unknown: 'À convenir',
    },
    hostingTag: {
      away: 'Se déplace',
      both: 'Reçoit ou se déplace',
      host: 'Reçoit',
      unknown: 'À convenir',
    },
  },
  friendlyMatchListContent: {
    // eslint-disable-next-line max-len
    comeBackALittleLater: 'Reviens un peu plus tard, ou publie la tienne si tu encadres une équipe.',
    createAFriendlyMatch: 'Créer un match amical',
    createAFriendlyMatch2: '+ Créer un match amical',
    findAnOpponent: 'Trouver un adversaire',
    listings: 'Annonces',
    // eslint-disable-next-line max-len
    listingsPublishedForYourTeams: 'Les annonces publiées pour tes équipes et les propositions reçues.',
    myListings: 'Mes annonces',
    myProposals: 'Mes propositions',
    noFriendlyMatchListingFor: 'Aucune annonce de match amical pour le moment.',
    // eslint-disable-next-line max-len
    openAListingAndPropose: 'Ouvre une annonce et propose un match : une conversation s’ouvrira avec le staff.',
    publishAListingSoOther: 'Publie une annonce pour que d’autres équipes te proposent un match.',
    searchForATeamA: 'Rechercher une équipe, une ville...',
    teamsLookingForAFriendly: 'Les équipes qui cherchent un match amical près de chez toi.',
    // eslint-disable-next-line max-len
    widenYourFiltersDistanceAnd: 'Élargis tes filtres : la distance et « je veux recevoir » en masquent peut-être.',
    youHavenTProposedAny: 'Tu n’as encore proposé aucun match.',
    youHavenTPublishedAny: 'Tu n’as encore publié aucune annonce.',
  },
  friendlyMatchRepostSheet: {
    addAtLeastOneUpcoming: 'Ajoute au moins une date à venir pour remettre l’annonce en ligne.',
    close: 'Fermer',
    putBackOnline: 'Remettre en ligne',
    repostTheListing: 'Reposter l’annonce',
    unableToRepostTheListing: "Impossible de reposter l'annonce.",
    // eslint-disable-next-line max-len
    yourDatesHavePassedPropose: 'Tes dates sont passées. Propose-en de nouvelles : le reste de l’annonce ne bouge pas, et les propositions déjà reçues sont conservées.',
  },
  friendlyMatchService: {
    unableToAnswerThisProposal: 'Impossible de répondre à cette proposition.',
    unableToDeleteTheListing: "Impossible de supprimer l'annonce.",
    unableToEditTheListing: "Impossible de modifier l'annonce.",
    unableToPublishTheListing: "Impossible de publier l'annonce.",
    unableToRepostTheListing: "Impossible de reposter l'annonce.",
    unableToSendTheMatch: "Impossible d'envoyer la proposition de match.",
    unableToWithdrawThisProposal: 'Impossible de retirer cette proposition.',
  },
  friendlyMatchSlotEditor: {
    addThisDate: 'Ajouter cette date',
    endOptional: 'Fin (facultatif)',
    n1ProposedDate: '1 date proposée',
    noDateProposedYet: 'Aucune date proposée pour l’instant.',
    pickADateFirst: 'Choisis d’abord une date.',
    proposedDates: '{{slotsCount}} dates proposées',
    putsThisDateBackIn: 'Remet cette date dans le formulaire pour changer son horaire',
    removeTheDate: 'Retirer la date du {{day}}',
    startOptional: 'Début (facultatif)',
    theEndTimeMustBe: 'L’heure de fin doit être après l’heure de début.',
    updateThisDate: 'Mettre à jour cette date',
  },
  friendlyMatchTermsSheet: {
    chooseADayToBe: 'Choisis un jour pour pouvoir enregistrer.',
    close: 'Fermer',
    // eslint-disable-next-line max-len
    discussItInTheThread: 'Discutez-en dans le fil, puis note ici ce sur quoi vous tombez d’accord. C’est ce que le match affichera dans les plannings.',
    eGNorthStadiumPitch: 'Ex : Stade Nord, terrain 2',
    kickOffTime: 'Heure du coup d’envoi',
    matchVenue: 'Lieu du match',
    saveWhatWasAgreed: 'Enregistrer ce qui est convenu',
    // eslint-disable-next-line max-len
    savingDoesnTAcceptThe: 'Enregistrer n’accepte pas encore la proposition : le match ne sera créé qu’au moment où tu appuieras sur « Accepter ce match ».',
    unableToSaveTheTerms: 'Impossible d’enregistrer les modalités.',
    whatWasAgreed: 'Ce qui est convenu',
    whereOptional: 'Où (facultatif)',
    whichDay: 'Quel jour',
  },
  friendlyMatchWizardDates: {
    proposeSeveralDatesYouLl: 'Propose plusieurs dates : tu auras beaucoup plus de réponses.',
    whenDoYouWantTo: 'Quand veux-tu jouer ?',
  },
  friendlyMatchWizardDescription: {
    aWordToConvince: 'Un mot pour convaincre',
    descriptionOptional: 'Description (facultatif)',
    eGCommittedU15Team: 'Ex : équipe U15 sérieuse, on cherche un match de',
    eGRefereeProvidedBy: 'Ex : arbitre fourni par le club',
    listingDescription: 'Description de l’annonce',
    refereeing: 'Arbitrage',
    refereeingOptional: 'Arbitrage (facultatif)',
    twoLinesAreEnoughIt: 'Deux lignes suffisent. C’est ce que les autres staffs liront en premier.',
    warmUpMatchBeforeThe: ' préparation avant la reprise.',
  },
  friendlyMatchWizardLocation: {
    cityOrAddress: 'Ville ou adresse',
    conversationThatOpensWhenA: ' discussion qui s’ouvre quand une équipe te répond.',
    eGMarseilleStadeVelodrome: 'Ex : Marseille, Stade Vélodrome...',
    howFar: 'Jusqu’où',
    itSTheRadiusIn: 'C’est le rayon dans lequel ton annonce sera proposée aux autres équipes.',
    theExactPitchIsnT: 'Le terrain exact n’est pas demandé ici : il se convient dans la',
    whereDoesItHappen: 'Où ça se passe ?',
    whereYouHostAndHow: 'Là où tu reçois, et jusqu’où les autres peuvent venir.',
    yourStartingPointAndHow: 'Ton point de départ, et jusqu’où tu acceptes de te déplacer.',
  },
  friendlyMatchWizardOpponent: {
    all: 'Tous',
    allFeminine: 'Toutes',
    any: 'Peu importe',
    anythingILlTakeAll: 'Peu importe, je prends tout',
    categories: 'Catégories',
    chooseOtherIfYourFormat: 'Choisis « Autre » si ton format n’est pas dans la liste.',
    eGBeach3v39v9: 'Ex : beach 3v3, 9v9...',
    everythingIsOptionalLeaveIt: 'Tout est facultatif : laisse vide et tu verras plus de monde.',
    gameFormat: 'Format de jeu',
    levels: 'Niveaux',
    theFormatsOfferedAreThose: 'Les formats proposés sont ceux du {{sport}}.',
    tickAsManyCategoriesAs: 'Coche autant de catégories que tu veux. Rien de coché : toutes.',
    tickAsManyLevelsAs: 'Coche autant de niveaux que tu veux. Rien de coché : tous.',
    whichOpponent: 'Quel adversaire ?',
    yourFormat: 'Ton format',
  },
  friendlyMatchWizardRecap: {
    any: 'Peu importe',
    aWord: 'Un mot',
    // eslint-disable-next-line max-len
    checkThenPublishYouCan: 'Vérifie, puis publie. Tu pourras annuler tant que personne n’a répondu.',
    date: 'Date',
    datesCount: '{{total}} dates',
    edit: 'Modifier',
    goBackToThisStep: 'Retourne à cette étape pour la modifier',
    iCan: 'Je peux',
    incompleteSummary: 'Récapitulatif incomplet',
    listingPublished: 'Annonce publiée',
    notFilledIn: 'non renseigné',
    notFilledIn2: 'Non renseigné',
    onePieceOfInformationIs: 'Il manque une information avant de publier.',
    opponent: 'Adversaire',
    publishingFailed: 'Publication impossible',
    publishingIsFreeWithNo: 'Publier est gratuit, sans limite de nombre d’annonces.',
    publishTheListing: 'Publier l’annonce',
    team: 'Équipe',
    teamsInTheAreaCan: 'Les équipes du secteur peuvent maintenant te proposer un match.',
    unableToPublishTheListing: "Impossible de publier l'annonce.",
    where: 'Où',
    yourListing: 'Ton annonce',
  },
  friendlyMatchWizardSteps: {
    allYourDatesHaveAlready: 'Toutes tes dates sont déjà passées : propose une date à venir.',
    chooseARadiusOfAt: 'Choisis un rayon d’au moins 1 km.',
    chooseTheTeamLookingFor: 'Choisis l’équipe qui cherche un match.',
    proposeAtLeastOneDate: 'Propose au moins une date.',
    sayWhereYouReLooking: 'Indique où tu cherches un adversaire.',
    sayWhetherYouCanHost: 'Dis si tu peux recevoir, te déplacer, ou les deux.',
    writeTheFormatYouRe: 'Écris le format que tu cherches.',
  },
  friendlyMatchWizardTeam: {
    publishAListing: 'Publier une annonce',
    whoIsLookingForAn: 'Qui cherche un adversaire ?',
    youDonTCoachAny: 'Tu n’encadres encore aucune équipe',
    // eslint-disable-next-line max-len
    youNeedToCoachA: 'Il faut encadrer une équipe pour proposer un match amical. Demande à ton club de te rattacher à une équipe, puis reviens ici.',
  },
  friendlyProposalInChat: {
    acceptConsequence: 'Le match sera créé et apparaîtra dans le planning des deux équipes.',
    acceptThisProposal: 'Accepter cette proposition ?',
    unableToFindTheMatch: 'Impossible de retrouver la proposition de match.',
  },
  guideOffersRecap: {
    acquis: {
      footer: 'Tout reste à toi, à vie — chat illimité inclus.',
      free: 'Gratuit — 0 €',
      items: {
        event: 'Ton événement',
        lineUp: 'Ta compo',
        listing: 'Ton annonce',
        team: 'Ton équipe',
      },
      youAreHere: 'Tu y es',
    },
    alerts: {
      checkoutUnavailable: {
        // eslint-disable-next-line max-len
        message: 'Le checkout store réel sera branché dans une prochaine vague. Utilise le mode test local ou staging pour la recette complète.',
        title: 'Checkout indisponible',
      },
      clubRequired: {
        message: "Rattache d'abord ton compte à un club avant de prendre une offre Club.",
        title: 'Club requis',
      },
      subscriptionError: {
        title: 'Erreur abonnement',
      },
    },
    billingPeriod: {
      monthly: 'Mensuel',
      yearly: 'Annuel',
    },
    catalogError: {
      description: 'Vérifie ta connexion et réessaie. Tes créations sont bien enregistrées.',
      retry: 'Réessayer',
      title: 'Impossible de charger les tarifs',
    },
    cta: {
      alreadyCovered: 'Déjà couvert par ton club',
      later: 'Plus tard',
      loadingPrices: 'Chargement des tarifs…',
      pricesUnavailable: 'Tarifs indisponibles',
      purchasing: 'Achat en cours…',
      unlock: 'Débloquer {{selectedOfferName}}',
      // eslint-disable-next-line max-len
      unlockWithPrice: 'Débloquer {{selectedOfferName}} · {{selectedPriceAmountLabel}}{{billingPeriodSuffix}}',
    },
    footer: {
      cancelAnytime: 'Résiliable à tout moment · Paiement App Store / Google Play',
    },
    header: {
      teamReady: 'Ton équipe est prête.',
      unlockNext: 'Débloque la suite.',
    },
    notice: {
      coveredByOther: '{{coverageNotice}} : payée par un autre membre de ton club. ',
      higherPlanOnly: 'Seule une offre supérieure peut la remplacer.',
    },
    offers: {
      club: {
        benefits: {
          facilities: 'Installations et réservations',
          fees: "Cotisations du club encaissées dans l'app",
          sponsors: 'Sponsors et partenaires du club',
          teams: 'Équipes du club illimitées',
        },
        name: 'Club',
        subtitle: 'Pour les dirigeants — tout le club',
        summary: 'Installations, sponsors, cotisations du club…',
      },
      popular: 'Populaire',
      startingFrom: 'à partir de',
      team: {
        benefits: {
          events: 'Événements et matchs illimités',
          fee: "Cotisation d'équipe encaissée dans l'app",
          lineUp: 'Composition et convocations en 2 taps',
        },
        name: 'Équipe',
        subtitle: 'Pour les coachs — ta ou tes équipes',
        summary: "Événements illimités, compo, convocations, cotisation d'équipe…",
        tierLabel_one: '{{count}} équipe',
        tierLabel_other: '{{count}} équipes',
      },
    },
    priceSuffix: {
      monthly: '/mois',
      yearly: '/an',
    },
    success: {
      resumeCta: "C'est parti !",
      teamOfferLabel_one: 'Équipe · {{count}} équipe',
      teamOfferLabel_other: 'Équipe · {{count}} équipes',
    },
  },
  historyWizard: {
    category: {
      empty: 'Aucune catégorie disponible pour le moment.',
      error: 'Impossible de charger les catégories pour le moment.',
    },
    club: {
      clearSelection: 'Changer de club',
      clearSelectionHint: 'Retire le club retenu et rouvre la recherche.',
    },
  },
  historyWizardSingle: {
    actions: {
      confirm: 'Valider',
      save: 'Enregistrer',
    },
    categories: {
      helperMulti: 'Sélectionne une ou plusieurs catégories (facultatif).',
      helperSingle: 'Sélectionne une catégorie (facultatif).',
      title: 'Quelles catégories ?',
    },
    club: {
      backToSearch: 'Revenir à la recherche',
      customNamePlaceholder: 'Nom du club...',
      enterManually: 'Club non trouvé ? Saisir manuellement',
      helper: 'Recherche ton club ou saisis-le manuellement.',
      noResults: 'Aucun club trouvé pour cette recherche.',
      onboarding: {
        description: 'Commence par rechercher ton club ou saisis le nom manuellement.',
        title: 'Sélection du club',
      },
      searchPlaceholder: 'Rechercher un club...',
      smartSearchUnavailable: 'La recherche intelligente est indisponible.',
      smartSearchUnavailableFallback: 'La recherche intelligente est indisponible, fallback actif.',
      title: 'Quel club ?',
    },
    errors: {
      save: "Impossible d'enregistrer cette expérience pour le moment.",
      saveTitle: 'Erreur',
    },
    filters: {
      apply: 'Appliquer',
      clear: 'Effacer',
      locationLabel: 'Ville ou adresse',
      locationPlaceholder: 'Choisir une localisation',
      radius: 'Rayon : {{radius}} km',
      sportLabel: 'Sport',
      sportPlaceholder: 'Choisir un sport',
    },
    header: {
      editTitle: "Modifier l'expérience",
      // eslint-disable-next-line max-len
      subtitle: "Ajoute une expérience : ton club d'abord, puis la période, les catégories et le niveau.",
      title: 'Ton parcours sportif',
    },
    honour: {
      description: 'Ces informations peuvent être vérifiées par la communauté.',
      title: "Déclaration sur l'honneur",
    },
    level: {
      empty: 'Aucun niveau disponible pour le moment.',
      error: 'Impossible de charger les niveaux pour le moment.',
      helper: 'Sélectionne le meilleur niveau joué (facultatif).',
      retry: 'Réessayer',
      title: 'Quel niveau ?',
    },
    multisport: {
      noSections: 'Aucune section listée.',
      sectionsTitle: 'Sections disponibles :',
      subtitle: 'Sélectionne ton entité de rattachement',
    },
    period: {
      endYear: 'Année de fin',
      helper: 'Indique les années de ta présence dans ce club.',
      startYear: 'Année de début',
      stillActive: 'Je suis toujours dans ce club',
      title: 'Quelle période ?',
    },
  },
  home: {
    fields: {
      type: {
        label: 'Trouver',
        options: {
          club: 'un club',
          event: 'un événement',
          reservation: 'une réservation',
          team: 'une équipe',
        },
      },
    },
    onboarding: {
      searchTabs: 'Choisis ici ce que tu cherches : Événements, Clubs ou Recrutement.',
    },
    searchTypes: {
      clubs: 'Clubs',
      events: 'Événements',
      recruitment: 'Recrutement',
      reservations: 'Réservations',
    },
  },
  homeHub: {
    account: {
      logoutDescription: 'Veux-tu te déconnecter de ton compte ?',
      logoutTitle: 'Déconnexion',
    },
    alerts: {
      featuredFallback: {
        description: 'Aucun club omnisport détecté. Redirection vers les demandes du club.',
        title: 'Information',
      },
      missingContext: {
        description: 'Aucun club disponible pour gérer les demandes à la une.',
        title: 'Contexte manquant',
      },
      noClub: {
        description: 'Ton compte doit être rattaché à un club pour gérer ces demandes.',
        title: 'Club introuvable',
      },
      nonPartnerCoachPublishingBlocked: {
        // eslint-disable-next-line max-len
        adDescription: "Ton club n'est pas encore certifié sur FoundClub. Un superadmin doit autoriser la publication avant de créer une offre.",
        // eslint-disable-next-line max-len
        description: "Ton club n'est pas encore certifié sur FoundClub. Un superadmin doit autoriser la publication avant de créer un événement.",
        title: 'Publication en attente d autorisation',
      },
      noTrainedTeams: {
        description: 'Tu dois être entraîneur d\'au moins une équipe pour gérer les demandes d\'adhésion.',
        title: 'Aucune équipe disponible',
      },
    },
    // D72 — le bandeau de tete de l'accueil, une variante par role.
    banner: {
      coach: {
        action: 'Ouvrir la compo',
        called: 'convoquées',
        label: 'Ma prochaine séance',
        missing: 'réponses manquantes',
      },
      player: {
        absent: 'Absent',
        label: 'Ma semaine',
        present: 'Présent',
      },
      superAdmin: {
        claims: 'Revendications de club',
        featured: 'À la une — à valider',
        label: 'À traiter',
        onboarding: 'Clubs à onboarder',
        reports: 'Signalements',
      },
      today: {
        label: 'Aujourd’hui',
        requests: 'Demandes en attente',
        unpaid: 'Cotisations impayées',
      },
    },
    cards: {
      account: {
        logout: {
          subtitle: 'Ferme ta session sur cet appareil.',
          title: 'Déconnexion',
        },
        switch: {
          subtitle: 'Bascule vers un autre compte connecté.',
          title: 'Changer de compte',
        },
        tutorial: {
          subtitle: 'Relancer un tutoriel ou réinitialiser les guides.',
          title: 'Tutoriels et aide',
        },
      },
      // D72 — le rayon « Administration », visible du seul super admin.
      admin: {
        dashboard: {
          subtitle: 'Les 23 tuiles de suivi.',
          title: 'Dashboard complet',
        },
        league: {
          subtitle: 'Saisons, divisions, classements.',
          title: 'League',
        },
        triage: {
          subtitle: 'Signalements, revendications, à la une, clubs à onboarder.',
          title: 'À traiter',
        },
        users: {
          subtitle: 'Recherche, modération, fiches.',
          title: 'Utilisateurs et clubs',
        },
      },
      league: {
        subtitle: 'Le mode compétitif de FoundClub.',
        title: 'FoundClub League',
      },
      manage: {
        addAd: {
          subtitle: 'Publie une offre de recrutement.',
          // D72 — « Publier une offre » devient « Recruter » : c'est le besoin,
          // pas le geste. La clef ne bouge pas, seule sa valeur change.
          title: 'Recruter',
        },
        addEvent: {
          subtitle: 'Crée un entraînement, un match\u2026',
          title: 'Ajouter un événement',
        },
        clubRequests: {
          subtitle: "Valider ou refuser les demandes d'adhésion au club.",
          title: 'Demandes adhésion club',
        },
        featuredRequests: {
          subtitle: 'Traite les demandes d événements à la une du club.',
          title: 'Demandes événements à la une',
        },
        licenses: {
          subtitle: 'Suis les statuts de tes membres.',
          teamsSubtitle: 'Suis les paiements de tes équipes.',
          teamsTitle: 'Cotisations de mes équipes',
          title: 'Cotisations du club',
        },
        manageClub: {
          coachSubtitle: 'L’espace de ton club et de tes équipes.',
          coachTitle: 'Mon club',
          subtitle: 'Ton espace club pour tout piloter.',
          title: 'Gérer mon club',
        },
        myAds: {
          subtitle: 'Tes offres, tes matchs et les réponses reçues.',
          title: 'Mes activités',
        },
        requests: {
          // D72 — l'entraineur n'a pas l'onglet « Club », reserve au dirigeant.
          coachSubtitle: 'Équipes, événements, à la une.',
          subtitle: 'Club, équipes, événements, à la une.',
          title: 'Demandes',
        },
        teamRequests: {
          subtitle: 'Traite les demandes d adhésion des joueurs à tes équipes.',
          title: 'Demandes adhésion équipes',
        },
      },
      profile: {
        alerts: {
          subtitle: 'Reçois des notifications ciblées.',
          title: 'Gérer mes alertes',
        },
        edit: {
          subtitle: 'Mets à jour tes informations.',
          title: 'Modifier mon profil',
        },
        history: {
          subtitle: 'Ajoute ou ajuste ton parcours.',
          title: 'Historique sportif',
        },
        subscription: {
          fallbackSubtitle: 'Consulte tes offres, quotas gratuits et équipes couvertes.',
          quota_one: '{{status}} · {{count}} événement offert restant',
          quota_other: '{{status}} · {{count}} événements offerts restants',
          title: 'Mon abonnement',
        },
        view: {
          subtitle: 'Consulte les infos de ton profil.',
          title: 'Voir mon profil',
        },
      },
      quick: {
        chat: {
          subtitle: 'Ouvre ta messagerie.',
          title: 'Messagerie',
        },
        license: {
          // AA07 / K1 — le PLURIEL, parce qu on peut cotiser dans plusieurs clubs
          // et qu au singulier la case laissait croire qu il n y en avait qu une.
          subtitle: 'Tes statuts et ton reste à payer.',
          title: 'Mes cotisations',
        },
        planning: {
          subtitle: 'Retrouve tes événements à venir.',
          title: 'Mon planning',
        },
        teams: {
          subtitle: 'Accède à tes équipes et leurs infos.',
          title: 'Mes équipes',
        },
      },
      search: {
        ads: {
          subtitle: 'Postuler aux offres des équipes.',
          title: 'Recrutement',
        },
        amicaux: {
          subtitle: 'Trouve un adversaire pour ton équipe.',
          title: 'Matchs amicaux',
        },
        clubs: {
          subtitle: 'Trouve la page d\u2019un club.',
          title: 'Club',
        },
        events: {
          subtitle: 'Détections, séances d\u2019essai, matchs\u2026',
          title: 'Événement',
        },
        myActivities: {
          subtitle: 'Tes candidatures et leurs réponses.',
          title: 'Mes réponses',
        },
        // PARENT P2 — la porte vers « Mes enfants » depuis l accueil du parent.
        myChildren: {
          subtitle: 'Déclare-les, corrige leur fiche, cherche-leur un club.',
          title: 'Mes enfants',
        },
        profiles: {
          subtitle: 'Trouve des profils ouverts.',
          title: 'Profils',
        },
        reservations: {
          subtitle: 'Réserve un terrain (foot à 5\u2026).',
          title: 'Réservations',
        },
      },
    },
    publishingBlocked: {
      // eslint-disable-next-line max-len
      requiresSuperadmin: "Ton club n'est pas encore certifié. Tu peux gérer ton organisation, mais un superadmin doit encore autoriser la publication des événements et des offres.",
      temporary: 'La publication est temporairement bloquée pour ce club non certifié.',
      title: 'Publication réservée aux clubs certifiés',
    },
    roles: {
      coach: 'Entraîneur',
      // P0 — cette clef MANQUAIT, et c'est tout le defaut : `roleLabel` se
      // repliait sur « Joueur » pour les deux comptes Parent de production.
      parent: 'Parent',
      player: 'Joueur',
      president: 'Dirigeant',
      superAdmin: 'Super admin',
    },
    sections: {
      account: 'Compte',
      administration: 'Administration',
      league: 'FoundClub League',
      manageClub: 'Gérer mon club',
      manageTeams: 'Gérer mes équipes',
      myClub: 'Mon club',
      profile: 'Mon profil',
      // D72 — la section « Navigation rapide » n'est plus rendue par aucun ecran.
      // La clef reste : ⛔ aucune suppression dans fr.js (le controle est la
      // comparaison des ENSEMBLES de clefs, pas le compte de lignes).
      quickNav: 'Navigation rapide',
      search: 'Rechercher',
      training: 'Mon entraînement',
    },
    state: {
      error: {
        // eslint-disable-next-line max-len
        description: 'Impossible de charger ton espace pour le moment. Vérifie ton connexion puis relance le chargement.',
        retry: 'Réessayer',
        title: 'Accueil indisponible',
      },
      loading: {
        description: 'Nous préparons ton espace FoundClub.',
        title: "Chargement de l'accueil",
      },
      noUser: {
        // eslint-disable-next-line max-len
        description: "Ton compte n'a pas encore été chargé. Relance le chargement pour afficher ton accueil personnalisé.",
        refresh: 'Actualiser',
        title: 'Compte introuvable',
      },
    },
    title: 'Accueil',
    tutorial: {
      clubFees: {
        description: 'Pilote les cotisations et relances depuis un tableau dédié.',
        title: 'Cotisations du club',
      },
      friendlies: {
        description: 'Consulte les équipes qui cherchent un match amical, et publie le tien.',
        title: 'Matchs amicaux',
      },
      myActivities: {
        description: 'Retrouve tes offres, tes matchs proposés et les réponses reçues.',
        title: 'Mes activités',
      },
      searchProfiles: {
        description: 'Accèdes directement aux profils ouverts au recrutement pour tes équipes.',
        title: 'Rechercher des profils',
      },
      teamFees: {
        description: 'Consulte les statuts de cotisation de tes équipes.',
        title: 'Cotisations de mes équipes',
      },
    },
  },
  homeHubTutorial: {
    actions: {
      scrollDown: 'Descendre',
    },
    center: {
      actions: {
        pickFeature: 'Choisir un tutoriel de fonctionnalité',
        relaunchHome: 'Relancer le tutoriel Accueil',
        resetAll: 'Réinitialiser tous les tutoriels',
      },
      subtitle: 'Relance un tutoriel ou réinitialise tous les guides.',
      title: 'Tutoriels et aide',
    },
    entry: {
      actions: {
        skip: 'Passer',
        start: 'Lancer le tutoriel complet',
      },
      description: 'Tu peux lancer le tutoriel complet pour tout comprendre, ou explorer l\'application par te même.',
      subtitle: 'FoundClub est un outil conçu pour t\'accompagner dans toute ton aventure sportive, peu importe ton sport.',
      title: 'Bienvenue sur FoundClub',
    },
    featurePicker: {
      subtitle: 'Sélectionne une fonctionnalité à découvrir.',
      title: 'Choisir un tutoriel',
    },
    reset: {
      confirm: 'Réinitialiser',
      description: 'Tous les tutoriels seront remis a zéro pour ce compte.',
      title: 'Réinitialiser les tutoriels',
    },
    steps: {
      accountLogout: {
        description: 'Déconnecte-te proprement de l appareil actuel.',
        title: 'Déconnexion',
      },
      accountSwitch: {
        description: 'Ouvre la modale pour changer ou ajouter un compte.',
        title: 'Changer de compte',
      },
      header: {
        description: 'Cette page te donne un accès rapide à toutes les fonctionnalités principales.',
        title: 'Accueil FoundClub',
      },
      league: {
        description: 'Bascule vers FoundClub League pour les fonctionnalités compétitives.',
        title: 'FoundClub League',
      },
      manageAddAd: {
        description: 'Publie une annonce de recrutement pour cibler des profils précis.',
        title: 'Ajouter une annonce',
      },
      manageAddEvent: {
        description: 'Crée un entraînement, match ou détection pour tes équipes.',
        title: 'Ajouter un événement',
      },
      manageClub: {
        description: 'Accèdes à ton espace club pour piloter ton organisation.',
        title: 'Gérer mon club',
      },
      manageClubRequests: {
        description: 'Traite les demandes d\'adhésion reçues par ton club.',
        title: 'Demandes adhésion club',
      },
      manageFeaturedRequests: {
        description: 'Valide les demandes d événements à la une de ton organisation.',
        title: 'Demandes événements à la une',
      },
      manageRequests: {
        description: 'Regroupe et traite toutes les demandes depuis un seul onglet.',
        title: 'Demandes',
      },
      manageTeamRequests: {
        description: 'Valide ou refuse les demandes pour rejoindre tes équipes.',
        title: 'Demandes adhésion équipes',
      },
      profileAlerts: {
        description: 'Configure des alertes personnalisées selon tes recherches.',
        title: 'Gérer mes alertes',
      },
      profileEdit: {
        description: 'Modifie tes informations personnelles et sportives.',
        title: 'Modifier mon profil',
      },
      profileHistory: {
        description: 'Ajoute tes expériences via le wizard historique.',
        title: 'Historique sportif',
      },
      profileView: {
        description: 'Consulte ta page profil complète.',
        title: 'Voir mon profil',
      },
      quickChat: {
        description: 'Ouvre ta messagerie et suis tes conversations.',
        title: 'Messagerie',
      },
      quickPlanning: {
        description: 'Accèdes rapidement à ton planning personnel.',
        title: 'Mon planning',
      },
      quickTeams: {
        description: 'Retrouve toutes tes équipes et leurs pages.',
        title: 'Mes équipes',
      },
      searchAds: {
        description: 'Consulte les annonces de recrutement et les profils disponibles.',
        title: 'Rechercher des annonces',
      },
      searchClubs: {
        description: 'Explore les clubs et ouvre leur fiche détaillée.',
        title: 'Rechercher un club',
      },
      searchEvents: {
        description: 'Trouve des événements sportifs en utilisant les filtres de recherche.',
        title: 'Rechercher un événement',
      },
      searchReservations: {
        description: 'Accèdes aux réservations et filtre selon ton activité.',
        title: 'Rechercher une réservation',
      },
      tutorialCenter: {
        description: 'Relance un tutoriel quand tu veux, ou remets tout a zéro.',
        title: 'Tutoriels et aide',
      },
    },
  },
  invitationLink: {
    club: {
      body: 'Tu as reçu une invitation à rejoindre ce club. Envoyer ta demande ?',
      primary: 'Voir le club',
      title: 'Invitation à rejoindre un club',
    },
    coded: {
      accept: 'Accepter',
      continue: 'Continuer',
      // eslint-disable-next-line max-len
      errorBody: 'Impossible de répondre à cette invitation pour le moment. Réessaie dans un instant.',
      errorTitle: 'Invitation',
      expired: 'Cette invitation a expiré.',
      intro: "Tu es invité·e à rejoindre l'équipe {{team}}.",
      introFrom: "{{inviter}} t'invite à rejoindre l'équipe {{team}}.",
      member: 'Tu fais déjà partie de cette équipe.',
      refuse: 'Refuser',
      request: 'Demander à rejoindre',
      requested: 'Ta demande pour rejoindre cette équipe est déjà envoyée.',
      requestHint: "Tu peux demander à rejoindre l'équipe : son staff validera.",
      seeTeam: "Voir l'équipe",
      signIn: "Connecte-toi ou crée ton compte : l'invitation t'attendra.",
      teamWithClub: '{{team}} ({{club}})',
      title: 'Rejoindre {{team}}',
    },
    event: {
      body: "Tu as reçu une invitation pour un événement. Veux-tu l'ouvrir ?",
      primary: "Voir l'événement",
      title: 'Invitation à un événement',
    },
    eyebrow: 'Invitation',
    invalid: {
      body: "Ce lien d'invitation est incomplet ou périmé. Demande-en un nouveau.",
      primary: "J'ai compris",
      title: "Lien d'invitation invalide",
    },
    later: 'Plus tard',
    team: {
      body: 'Tu as reçu une invitation à rejoindre cette équipe. Envoyer ta demande ?',
      primary: 'Envoyer ma demande',
      title: 'Invitation à rejoindre une équipe',
    },
  },
  leagueActionPromptHost: {
    actions: {
      accept: 'Accepter',
      back: 'Retour',
      cancelMatch: 'Annuler le match',
      confirmCancel: 'Confirmer l annulation',
      confirming: 'Validation...',
      confirmReschedule: 'Confirmer la replanification',
      decline: 'Refuser',
      enterScore: 'Saisir le score',
      handleDispute: 'Traiter le litige',
      markVenueBooked: 'Marquer terrain réservé',
      matchHappened: 'Le match a eu lieu',
      noNotHappened: 'Non, le match n a pas eu lieu',
      openChat: 'Ouvrir le chat',
      openMatch: 'Ouvrir le match',
      reschedule: 'Replanifier ce match',
      sending: 'Envoi...',
      sendProposal: 'Envoyer une proposition',
      validateScore: 'Valider le score',
      viewMatch: 'Voir le match',
      yesHappened: 'Oui, le match a eu lieu',
    },
    dateToBeDecided: 'Date à définir',
    details: {
      opponentResponse: 'Réponse adverse',
      pending: 'En attente',
      status: 'Statut',
      toBeDecided: 'À définir',
      venue: 'Terrain',
    },
    errors: {
      accept: "Impossible d'accepter la proposition.",
      decline: 'Impossible de refuser la proposition.',
      saveResponse: "Impossible d'enregistrer cette réponse.",
      sendCounterProposal: "Impossible d'envoyer la contre-proposition.",
      sendProposal: "Impossible d'envoyer la proposition.",
      title: 'Erreur',
    },
    homeAway: {
      away: 'Extérieur',
      home: 'Domicile',
      league: 'Match League',
    },
    matchLabel: 'Ta squad VS {{opponent}}',
    negotiationSubtitle: 'Négociation du match en cours',
    opponent: 'Adversaire',
    opponentResponse: {
      cancelProposed: 'Match non joué - annulation proposée',
      notPlayed: 'Match non joué',
      played: 'Match joué',
      rescheduleProposed: 'Match non joué - replanification proposée',
    },
    prompts: {
      askHappened: {
        // eslint-disable-next-line max-len
        body: 'Le créneau est dépassé sans terrain confirmé. Les capitaines doivent confirmer si le match a eu lieu.',
        title: 'Le match a-t-il eu lieu ?',
      },
      confirmCancel: {
        // eslint-disable-next-line max-len
        body: "L'adversaire indique que le match n'a pas eu lieu et propose d'annuler ce match sans pénalité.",
        title: 'Confirmer l annulation ?',
      },
      confirmReschedule: {
        // eslint-disable-next-line max-len
        body: "L'adversaire indique que le match n'a pas eu lieu et propose de replanifier ce même match.",
        title: 'Confirmer la replanification ?',
      },
      disputed: {
        body: 'Un litige est ouvert sur le score. Traite le score pour débloquer la suite League.',
        title: 'Litige score',
      },
      notPlayed: {
        // eslint-disable-next-line max-len
        body: 'Choisis la suite à donner à ce match : replanifier avec le même adversaire ou annuler sans pénalité.',
        title: 'Le match n a pas eu lieu',
      },
      opponentFound: {
        // eslint-disable-next-line max-len
        bodyWithoutVenue: 'Un match compatible est créé. Envoie la première proposition de créneau, avec un lieu si tu veux le fixer tout de suite.',
        // eslint-disable-next-line max-len
        bodyWithVenue: 'Un match compatible est créé. Envoie la première proposition de terrain et de créneau pour lancer la négociation.',
        title: 'Adversaire trouvé',
      },
      pendingValidation: {
        // eslint-disable-next-line max-len
        body: 'Un score attend ta validation. Confirme ou conteste le résultat pour finaliser le match League.',
        title: 'Score à valider',
      },
      proposal: {
        // eslint-disable-next-line max-len
        body: "Une proposition de match attend une réponse de ta squad. Consulte les détails avant d'accepter ou de refuser.",
        title: 'Nouvelle proposition League',
      },
      waitingScore: {
        body: 'Le match est joue. Saisis le score final pour lancer la validation League.',
        title: 'Score à saisir',
      },
      waitingVenue: {
        // eslint-disable-next-line max-len
        body: "Le match est confirmé, mais le terrain n'est pas encore réservé. Pense à finaliser l'organisation.",
        title: 'Terrain à réserver',
      },
    },
    // eslint-disable-next-line max-len
    reminderFooter: "Si tu fermes ce rappel sans agir, il reviendra à la prochaine ouverture de l'app tant que cet état reste actif.",
  },
  leagueDashboard: {
    actionCard: {
      actionRequired: 'ACTION REQUISE',
      venue: 'Lieu',
      viewChat: 'Voir le chat',
      viewMatch: 'Voir le match',
      viewMatchPage: 'Voir la fiche match',
    },
    actions: {
      confirmedUpcoming: {
        actionLabel: 'Voir le match',
        // eslint-disable-next-line max-len
        helper: 'Le match est confirmé. Retrouve les informations de préparation dans ton espace Match.',
        title: 'Match confirmé',
      },
      disputed: {
        actionLabel: 'Traiter le litige',
        helper: 'Un litige est ouvert sur le score. Ouvre le match pour le traiter.',
        title: 'Litige score',
      },
      idle: {
        actionLabel: 'Trouver un match',
        // eslint-disable-next-line max-len
        helper: 'Lance une recherche pour trouver un adversaire compatible avec les créneaux de ta squad.',
        title: 'Aucun match actif',
      },
      opponentFound: {
        actionLabel: 'Envoyer une proposition',
        helper: "Un adversaire a été trouvé. Il reste à t'accorder sur la proposition de match.",
        title: 'Adversaire trouve',
      },
      pendingValidation: {
        actionLabel: 'Valider le score',
        helper: 'Un score attend une validation. Confirme ou conteste le résultat.',
        title: 'Score à valider',
      },
      postSlotResolution: {
        actionLabel: 'Le match a-t-il eu lieu ?',
        // eslint-disable-next-line max-len
        helper: 'Le créneau est dépassé sans terrain confirmé. Le capitaine doit dire si le match a eu lieu.',
        title: 'Confirmation match',
      },
      proposalReceived: {
        actionLabel: 'Répondre',
        // eslint-disable-next-line max-len
        helper: 'Une proposition adverse attend ta réponse. Ouvre la conversation pour accepter, refuser ou contre-proposer.',
        title: 'Nouvelle proposition reçue',
      },
      proposalSentWaiting: {
        actionLabel: 'Voir la proposition',
        // eslint-disable-next-line max-len
        helper: "Ta proposition a été envoyée. Continue l'échange dans la conversation avec l'adversaire.",
        title: 'Proposition envoyée',
      },
      searching: {
        actionLabel: 'Ouvrir le centre de match',
        // eslint-disable-next-line max-len
        helper: 'La recherche est en cours. Les meilleures correspondances continuent à être analysees.',
        title: 'Recherche en cours',
      },
      valid: {
        actionLabel: 'Voir le résultat',
        helper: 'Le score est validé. Consulte le récapitulatif du match.',
        title: 'Résultat validé',
      },
      waitingScore: {
        actionLabel: 'Saisir le score',
        helper: 'Le match est joue. Saisis le score final pour lancer la validation League.',
        title: 'Score à saisir',
      },
      waitingVenue: {
        actionLabel: 'Marquer terrain réservé',
        // eslint-disable-next-line max-len
        helper: "Le match est confirmé, mais le terrain n'est pas encore réservé. Finalise l'organisation dès que possible.",
        title: 'Terrain à réserver',
      },
    },
    captainRequests: {
      awaiting: 'attendent ta réponse',
      badge: 'VALIDATION CAPITAINE',
      cta: 'VOIR LES DEMANDES',
      hint: 'Ouvre les demandes de ta squad pour accepter ou refuser les joueurs en attente.',
      requests_one: 'demande',
      requests_other: 'demandes',
    },
    conversationFallback: {
      // eslint-disable-next-line max-len
      body: "La conversation avec l'adversaire n'est pas encore prête. Réessaie dans quelques secondes ou ouvre la fiche match pour suivre l'organisation.",
      close: 'Fermer',
      reply: 'Repondre',
      status: 'État League',
      title: 'Conversation en préparation',
    },
    conversationTitle: '{{squadName}} vs {{opponentName}}',
    dateToBeDecided: 'Date à définir',
    leaderboard: {
      fullStandings: 'VOIR LE CLASSEMENT COMPLET',
      teamFallback: 'Équipe',
    },
    loadError: 'Impossible de charger le dashboard League pour le moment.',
    loading: {
      description: 'Chargement du dashboard League et de ta squad.',
      title: 'Chargement League',
    },
    manageRoster: 'Gérer mon effectif & Rôles',
    matchupTitle: '{{squadName}} VS {{opponentName}}',
    mySquadFallback: 'Ta squad',
    negotiationSubtitle: 'Négociation du match en cours',
    noTeam: {
      create: 'Créer une squad',
      openSquadTab: 'Ouvrir mon onglet Squad',
      search: 'Rechercher une squad',
      signalsSubtitle: 'A TRAITER MAINTENANT',
      signalsTitle: 'SIGNAUX SQUAD',
      subtitle: 'Crée ton équipe pour rejoindre la compétition officielle.',
      title: "Prêt à l'action ?",
    },
    opponentFallback: 'Adversaire',
    retry: 'Réessayer',
    signals: {
      invitedHelper: "Une squad t'attend déjà. Réponds pour rejoindre la compétition.",
      pendingBadge: 'EN ATTENTE',
      pendingHelper: 'Ta demande a bien été envoyée. Le capitaine doit encore répondre.',
      priority: 'Signal League prioritaire',
      squadFallback: 'Squad League',
      viewInvitation: 'Voir l invitation',
      viewRequest: 'Voir la demande',
    },
    stats: {
      bestStreak: ' | Meilleure série: x',
      cta: 'VOIR LES STATISTIQUES DE LA SQUAD',
      lastResultLoss: 'Dernier résultat: défaite',
      losses: 'DÉFAITES',
      nextBonus: 'Prochain bonus: +{{nextStreakBonus}}',
      nextWin: 'Prochaine victoire: +20 pts',
      pointsToPromotion: '{{points}} pts avant promotion',
      prestigeDivision: 'Division 1 prestige',
      streak: 'SÉRIE',
      wins: 'VICTOIRES',
    },
    switcher: {
      action: 'Changer',
      active: 'Actif',
      empty: 'Aucune squad disponible.',
      hint: 'Ouvre la liste des squads League',
      label: 'Vue squad active',
      single: 'Unique',
      subtitle: 'Sélectionne la squad active pour ton dashboard League.',
      title: 'Changer de squad',
    },
    unavailable: 'Dashboard indisponible',
  },
  leagueLegalAcceptanceModal: {
    cancel: 'Annuler',
    checks: {
      adult: 'Je certifie avoir 18 ans ou plus pour créer ou rejoindre une squad FoundClub League.',
      // eslint-disable-next-line max-len
      context: 'Je comprends que FoundClub ne fait que mettre en relation les équipes et participants, sans organiser ni superviser la rencontre.',
      // eslint-disable-next-line max-len
      risk: 'J accepte les risques normaux liés à la pratique sportive et je vérifie que mon état de santé me permet de participer.',
      // eslint-disable-next-line max-len
      rules: 'Je respecte les règles du lieu, les consignes de sécurité et je vérifie la couverture d assurance applicable.',
      // eslint-disable-next-line max-len
      teamLead: 'Je confirme agir comme membre référent de mon équipe pour cette proposition ou confirmation de match.',
      // eslint-disable-next-line max-len
      venue: 'Je confirme que le terrain, les horaires et les conditions du lieu ont été verifies par les participants concernés.',
    },
    // eslint-disable-next-line max-len
    footer: 'Cette confirmation est enregistrée avec la version legale active pour garder une preuve d acceptation.',
    regarding: 'Concerne',
    scopes: {
      default: {
        action: 'Continuer',
        description: 'Confirme le cadre FoundClub League avant de continuer.',
      },
      matchCaptainAcceptance: {
        action: 'Confirmer le match',
        // eslint-disable-next-line max-len
        description: 'Avant de confirmer ce match League, confirme le cadre de responsabilité de ton équipe et du lieu choisi.',
        title: 'Confirmation League',
      },
      matchCaptainProposal: {
        action: 'Envoyer la proposition',
        // eslint-disable-next-line max-len
        description: 'Tu proposes une rencontre au nom de ton équipe. FoundClub facilite la mise en relation mais n organise pas le match.',
        title: 'Proposition League',
      },
      matchPlayerParticipation: {
        action: 'Confirmer ma présence',
        // eslint-disable-next-line max-len
        description: 'Avant de participer à ce match League, confirme que tu acceptes les risques liés à la pratique sportive.',
        title: 'Participation League',
      },
      matchVenueBooking: {
        action: 'Marquer le terrain réservé',
        // eslint-disable-next-line max-len
        description: 'Avant de marquer le terrain comme réservé, confirme que la réservation et les conditions du lieu ont bien été gérées hors FoundClub.',
        title: 'Terrain League',
      },
      teamCreate: {
        action: 'Créer mon équipe League',
        // eslint-disable-next-line max-len
        description: 'Avant de créer une équipe FoundClub League, confirme que FoundClub est une plateforme de mise en relation et ne devient pas organisateur des rencontres.',
        title: 'Cadre FoundClub League',
      },
      teamInvitationAccept: {
        action: 'Accepter l invitation',
        // eslint-disable-next-line max-len
        description: 'Avant d accepter cette invitation League, confirme le cadre de pratique et de responsabilité applicable aux rencontres.',
        title: 'Invitation FoundClub League',
      },
      teamJoinRequest: {
        action: 'Demander à rejoindre',
        // eslint-disable-next-line max-len
        description: 'Avant de rejoindre une équipe FoundClub League, confirme le cadre de pratique et de responsabilité applicable aux rencontres.',
        title: 'Rejoindre une équipe League',
      },
    },
    toConfirm: 'A confirmer',
  },
  leagueMatchDetails: {
    alerts: {
      acceptError: 'Impossible d accepter la proposition pour le moment.',
      counterProposalError: "Impossible d'envoyer la contre-proposition.",
      declineError: 'Impossible de refuser la proposition pour le moment.',
      responseSaveError: "Impossible d'enregistrer cette réponse.",
      // eslint-disable-next-line max-len
      scoreUnavailableBody: "Tu pourras saisir le score une fois l'heure de début du match dépassée de 1 minute.",
      scoreUnavailableTitle: 'Score indisponible',
      statusUpdateError: 'Impossible de mettre à jour le statut',
      successTitle: 'Succès',
      venueMarkedBooked: 'Terrain marque comme réservé.',
    },
    banners: {
      cancelFailed: 'Échec annulation',
      confirmFailed: 'Échec confirmation',
      participationCancelledBody: 'Ta participation a été annulée',
      participationCancelledTitle: 'Participation annulée',
      resolutionUpdated: 'Résolution mise à jour',
      responseSaved: 'Ta réponse a été enregistrée.',
    },
    cancel: {
      body: 'Action irreversible. Es-tu sûr ?',
      doneBody: 'Le match a été annulé.',
      doneTitle: 'Match annule',
      no: 'Non',
      teamNotFound: 'Équipe introuvable.',
      title: 'Annuler le match ?',
      yes: 'Oui, annuler',
    },
    captain: {
      cancelMatch: 'Annuler le match',
      confirmMatch: 'Confirmer le match',
      markVenueBooked: 'Marquer terrain réservé',
      scoreAvailableAtStart: 'Score disponible au debut du match + 1 min.',
    },
    captainFeedback: {
      available: 'Disponible',
      notAvailable: 'Retour pas encore disponible',
      notShared: 'Pas encore partage',
      pending: 'En attente',
      pendingBody: "Le capitaine n'a pas encore laisse d'avis individuel pour ce match.",
      published: 'Évaluation publiée',
      publishedBody: 'Le capitaine a publié un retour individuel pour ton match.',
    },
    captainHelper: {
      // eslint-disable-next-line max-len
      withoutVenue: 'Les actions rapides présence, score et résolution restent visibles dans la barre du bas pour agir sans quitter la fiche.',
      // eslint-disable-next-line max-len
      withVenue: 'Les actions rapides terrain, score et résolution restent visibles dans la barre du bas pour agir sans quitter la fiche.',
    },
    captainQuick: {
      default: {
        helperNoVenue: "Le match reste à confirmer par les équipes avant le coup d'envoi.",
        // eslint-disable-next-line max-len
        helperVenue: "Le terrain doit être confirme avant le coup d'envoi pour garder le workflow League propre.",
        labelNoVenue: 'Match à confirmer',
        labelVenue: 'Terrain à confirmer',
      },
      locked: {
        helper: "Le score se débloque automatiquement à l'heure de début du match + 1 minute.",
        label: 'Score bientôt disponible',
        title: 'Score verrouillé',
      },
      postSlot: {
        helper: 'Le créneau est dépassé. Confirme si le match a eu lieu.',
        label: 'Résolution à faire',
        title: 'Confirmation du match',
      },
      score: {
        title: 'Score officiel',
      },
    },
    captainSection: {
      captainLabel: 'Priorité MATCH',
      captainZone: 'Zone Capitaine',
      priorityLabel: 'ACTION PRIORITAIRE',
      priorityTitle: 'Action prioritaire',
      teamLabel: 'ACTION Équipe',
    },
    captainSummary: {
      locked: 'Le score sera disponible au coup d envoi.',
      postSlot: 'Confirme si le match a eu lieu.',
      score: 'Saisis le score officiel.',
      venue: 'Confirme le terrain du match.',
    },
    captainTag: 'CAPITAINE',
    context: {
      away: 'EXTERIEUR',
      awaySubtitle: 'Deplacement League',
      home: 'DOMICILE',
      homeSubtitle: 'Tu joues chez toi',
    },
    conversationPending: {
      // eslint-disable-next-line max-len
      alertBody: "La conversation avec l'adversaire n est pas encore disponible. Réessaie dans quelques secondes.",
      // eslint-disable-next-line max-len
      cardBody: 'La conversation avec l adversaire arrive bientôt. Réessaie dans quelques secondes ou poursuis depuis cette fiche match.',
      title: 'Conversation en préparation',
    },
    conversationTitleAnonymous: '{{squadName}} vs Adversaire',
    dateTime: 'Date et heure',
    dateToBeDecided: 'Date à définir',
    dock: {
      captainActions: 'Actions capitaine',
      close: 'Fermer',
      markAbsent: 'Passer absent',
      teamActions: 'Actions équipe',
    },
    eloStakes: 'ENJEUX DU MATCH (ELO matchmaking)',
    errors: {
      load: 'Impossible de charger le match pour le moment.',
      missingId: "Aucun match n'est associé à ce lien.",
    },
    errorTitle: 'Erreur',
    headerTitle: 'Détails du match',
    hero: {
      beforeMatch: 'Avant match',
      captainAction: 'Action capitaine',
      leagueStatus: 'Statut League',
      locked: 'Le match est verrouillé avec son score officiel.',
      officialScoreSaved: 'Score officiel enregistré pour cette affiche League.',
      presenceOpen: 'Les confirmations de présence restent ouvertes avant le début.',
      resultConfirmed: 'Résultat validé',
      teamAction: 'Action équipe',
      teamOrganisation: 'Organisation équipe',
      trackingBelow: 'Le suivi League reste disponible dans les sections ci-dessous.',
      venuePending: "Le terrain doit encore être confirmé avant le coup d'envoi.",
    },
    heroChips: {
      activeChat: 'Chat actif',
      players: '{{participationCount}}/{{requiredPlayers}} joueurs',
    },
    lineups: {
      hidden: 'Masque',
      noPlayers: 'Aucun joueur',
    },
    matchActions: 'Actions du match',
    matchOrganisation: 'Organisation du match',
    myResponse: {
      button: {
        fill: 'Renseigner',
        resume: 'Reprendre',
      },
      fillFeeling: 'Renseigne ton ressenti de match',
      label: 'RETOUR INDIVIDUEL',
      personalRating: 'Note personnelle',
      status: {
        draft: 'Brouillon',
        notInvolved: 'Non concerne',
        sent: 'Envoye',
        todo: 'A faire',
        unknown: 'Je ne sais pas',
      },
      teamRating: 'Le match de l équipe : {{rating}}/10',
      text: {
        draft: 'Ton brouillon perso post-match attend encore une validation.',
        notInvolved: 'Tu as indique ne pas être concerne par ce match.',
        presentNoPlay: 'Tu as indique que tu etais la sans jouer.',
        submitted: 'Tes stats personnelles et ta note sont enregistrées.',
        todo: 'Renseigne ton retour individuel, puis ajoute une note sur 10.',
        unknown: 'Ton ressenti est enregistré, sans stats quantitatives.',
      },
      toComplete: 'À compléter',
    },
    mySquadFallback: 'Ta squad',
    mysteryOpponent: 'Adversaire mystere',
    navigation: {
      myPostMatch: 'Mon retour post-match',
      teamRecap: 'Bilan équipe',
    },
    negotiation: {
      default: {
        helper: "Retrouve la conversation avec l'adversaire pour conclure rapidement.",
        origin: 'Discussion League active',
        title: 'Négociation du match',
      },
      found: {
        // eslint-disable-next-line max-len
        helperWithoutVenue: 'Le match est créé. Envoie une proposition de date, avec un lieu si tu veux le fixer tout de suite.',
        // eslint-disable-next-line max-len
        helperWithVenue: 'Le match est créé. Envoie une proposition de date et de terrain pour lancer la négociation.',
        origin: 'Aucune proposition définitive pour le moment',
        title: 'Adversaire trouve',
      },
      openChat: 'Ouvrir le chat',
      openInChat: 'Ouvrir dans le chat >',
      received: {
        // eslint-disable-next-line max-len
        helper: 'Une proposition adverse attend ta réponse. Tu peux accepter, refuser ou contre-proposer.',
        origin: "Envoyée par l'adversaire",
        title: 'Proposition reçue',
      },
      reply: 'Repondre',
      sendNewProposal: 'Envoyer une nouvelle proposition',
      sendProposal: 'Envoyer une proposition',
      sent: {
        // eslint-disable-next-line max-len
        helper: 'Ta squad attend maintenant la réponse adverse. La conversation reste le centre de la négociation.',
        origin: 'Envoyée par ta squad',
        title: 'Proposition envoyée',
      },
    },
    negotiationSubtitle: 'Négociation du match en cours',
    opponentFallback: 'Adversaire',
    playerFallback: 'Joueur',
    postSlot: {
      back: 'Retour',
      cancelMatch: 'Annuler le match',
      confirmCancel: 'Confirmer l annulation',
      confirmReschedule: 'Confirmer la replanification',
      matchHappened: 'Le match a eu lieu',
      noNotHappened: 'Non, le match n a pas eu lieu',
      reschedule: 'Replanifier ce match',
      yesHappened: 'Oui, le match a eu lieu',
    },
    postSlotModal: {
      ask: {
        // eslint-disable-next-line max-len
        helperWithoutVenue: 'Le créneau est dépassé. Les capitaines doivent confirmer si le match a eu lieu.',
        // eslint-disable-next-line max-len
        helperWithVenue: 'Le créneau est dépassé sans terrain confirmé. Les capitaines doivent confirmer si le match a eu lieu.',
        title: 'Le match a-t-il eu lieu ?',
      },
      confirmCancel: {
        // eslint-disable-next-line max-len
        helper: 'L adversaire indique que le match n a pas eu lieu et propose d annuler ce match sans pénalité.',
        title: 'Confirmer l annulation ?',
      },
      confirmReschedule: {
        // eslint-disable-next-line max-len
        helper: 'L adversaire indique que le match n a pas eu lieu et propose de replanifier ce même match.',
        title: 'Confirmer la replanification ?',
      },
      notPlayed: {
        // eslint-disable-next-line max-len
        helper: 'Choisis la suite à donner à ce match : replanifier avec le même adversaire ou annuler sans pénalité.',
        title: 'Le match n a pas eu lieu',
      },
    },
    postSlotSheet: {
      matchConcerned: 'Match concerne',
    },
    presence: {
      availability: 'Disponibilité',
      confirmed: 'Présence confirmée',
      full: 'Complet',
      join: 'Je participe',
      missing_one: 'Il manque {{count}} joueur pour atteindre le quorum.',
      missing_other: 'Il manque {{count}} joueurs pour atteindre le quorum.',
      quorumReached: 'Le quorum est atteint pour ton équipe.',
      rosterFull: 'Effectif complet pour le moment.',
      stillNeeded_one: 'Encore {{count}} joueur pour atteindre le quorum.',
      stillNeeded_other: 'Encore {{count}} joueurs pour atteindre le quorum.',
    },
    proposalSheet: {
      accept: 'Accepter',
      counter: 'Contre-proposer',
      decline: 'Refuser',
      subtitle: 'Choisis une seule action pour répondre à cette proposition de match.',
      title: 'Répondre à la proposition',
      viewInChat: 'Voir la proposition dans le chat',
    },
    retry: 'Réessayer',
    scoreAction: {
      disputed: {
        // eslint-disable-next-line max-len
        helper: 'Un litige score est ouvert. Ajoute les éléments utiles ou attends la résolution SuperAdmin.',
        label: 'Litige score',
        title: 'Traiter le litige',
      },
      opponentPending: {
        // eslint-disable-next-line max-len
        helper: 'La squad adverse a saisi un score. Confirme ou conteste avant auto-validation dans {{countdown}}.',
        label: 'Score adverse',
        title: 'Valider le score adverse',
      },
      pendingValidation: {
        // eslint-disable-next-line max-len
        helper: 'Un score attend une validation. Sans action, le score soumis sera traite à la deadline dans {{countdown}}.',
        label: 'Score à valider',
        title: 'Valider le score',
      },
      submitted: {
        // eslint-disable-next-line max-len
        helper: 'Ton score est enregistré. Sans réponse adverse, il sera validé automatiquement dans {{countdown}}.',
        label: 'Score saisi',
      },
      waiting: {
        helper: 'Le match est joué. Le score officiel doit être saisi pour lancer le bilan League.',
        label: 'Score à saisir',
        title: 'Saisir le score final',
      },
    },
    sections: {
      captainFeedback: 'Mon retour capitaine',
      leagueHistory: 'Historique League',
      lineups: 'Compositions ({{teamACount}} vs {{teamBCount}})',
      matchStats: 'Stats du match',
      myStats: 'Mes stats',
      negotiation: 'Negociation',
      organisation: 'Organisation',
    },
    states: {
      backToMatches: 'Retour aux matchs',
      errorTitle: 'Chargement impossible',
      notFound: 'Match introuvable',
      reload: 'Recharger',
      unavailable: "Ce match n'existe plus ou n'est pas accessible depuis ce lien.",
    },
    stats: {
      availableAfterScore: 'Les stats seront disponibles une fois le score validé.',
      button: {
        open: 'Ouvrir',
        update: 'Mettre à jour',
      },
      captainRating: 'Note capitaine',
      card: {
        finalized: 'Rapport finalisé',
        finalizedOn: 'Rapport finalisé le {{date}}',
        // eslint-disable-next-line max-len
        manageSubtitle: 'Note collective, retours capitaine et stats manquantes à compléter pour ton équipe.',
        manageTitle: 'Finaliser le bilan équipe',
        pendingSubtitle: 'Le bilan équipe est encore en cours de finalisation.',
        pendingTitle: 'En attente du bilan',
        reviewSubtitle: 'Le score officiel a changé. Vérifie puis republie cette version.',
        reviewTitle: 'Mettre à jour après score officiel',
        soon: 'Stats bientôt disponibles',
        viewTitle: 'Voir les stats du match',
      },
      collectiveRatingsCount_one: '{{count}} note collective prise en compte',
      collectiveRatingsCount_other: '{{count}} notes collectives prises en compte',
      playersFeeling: 'Ressenti joueurs',
      postMatchLabel: 'SUIVI POST-MATCH',
      publication: 'Publication',
      responses: '{{responded}}/{{eligible}} joueurs ont répondu',
      // eslint-disable-next-line max-len
      reviewWarning: 'Le score officiel a changé après la première publication. Une mise à jour est requise.',
      scorePending: 'Score en attente',
      status: {
        published: 'Stats publiées',
        review: 'Vérification requise',
        scoreConfirmed: 'Score validé en attente',
        toFinalise: 'À finaliser',
      },
      summary: {
        final: 'Le rapport stats de ton équipe est finalisé.',
        // eslint-disable-next-line max-len
        manage: 'Complète le bilan collectif, les retours individuels et les stats manquantes maintenant que le score est validé.',
        review: 'Le score officiel a changé. Vérification requise avant nouvelle publication.',
      },
      version: 'Version',
      viewSquadStats: 'Voir les stats de la squad',
    },
    statsPrompt: {
      later: 'Plus tard',
      // eslint-disable-next-line max-len
      manage: 'Le score est validé. Tu peux maintenant compléter le temps de jeu et les stats clés de ton équipe.',
      myTeamFallback: 'Mon équipe',
      review: 'Le score officiel a changé. Vérifie les lignes puis republie ce rapport.',
      team: 'Équipe concernée',
      title: 'Stats de fin de match',
    },
    tabs: {
      history: 'Historique',
      team: 'Equipe',
    },
    teamAFallback: 'Équipe A',
    teamBFallback: 'Équipe B',
    timeline: {
      // eslint-disable-next-line max-len
      empty: 'Les prochaines mises à jour League apparaîtront ici des qu une action sera enregistrée sur ce match.',
      noTimestamp: 'Horodatage indisponible',
      updateFallback: 'Mise à jour League',
    },
    venue: 'Lieu',
    venueToBeDecided: 'Lieu à définir',
    view: 'Voir',
    workflow: {
      confirmed: 'Confirme',
      finished: 'Terminé',
      presence: 'Présences',
      proposal: 'Proposition',
      venue: 'Terrain',
    },
  },
  leagueMatchService: {
    cancellationPenalty: {
      moderate: 'Pénalité de -50 ELO matchmaking applicable.',
      none: 'Aucune pénalité (annulation > 48h avant le match).',
      severe: 'ATTENTION: Forfait. Pénalité de -200 ELO matchmaking et défaite attribuée.',
    },
  },
  leaguePlatformGate: {
    accessDenied: {
      action: "Retour à l'accueil",
      description: "Ton compte n'a pas les droits pour accéder à l'espace Super Admin League.",
      title: 'Accès refusé',
    },
    loading: {
      description: "Nous vérifions l'état de Found Club League.",
      title: 'Préparation de la plateforme',
    },
    loginRequired: {
      action: 'Se connecter',
      description: 'Cette zone Super Admin est réservée aux comptes autorisés.',
      title: 'Connexion requise',
    },
  },
  leaguePlatformService: {
    matchmakingClosed: {
      hint: 'Prépare ta squad avant le lancement.',
      title: 'La recherche de match sera bientôt disponible.',
    },
    openingDate: 'Ouverture prévue le {{openingDate}}.',
    platformClosed: {
      hint: 'Prépare ta squad, la compétition démarre bientôt.',
      title: 'Found Club League arrive bientôt.',
    },
  },
  leagueScoreDetails: {
    invalidSet: 'Set {{setNumber}} invalide.',
    setBreaksPadelRules: 'Le set {{setNumber}} ne respecte pas les règles du padel.',
    setCount: 'Renseigne 2 ou 3 sets pour un match de padel.',
    tiedSet: 'Le set {{setNumber}} ne peut pas être à égalité.',
    winnerSets: 'Le vainqueur doit gagner 2 sets.',
  },
  leagueSportConfig: {
    locationMode: {
      both: 'Les deux',
      host: 'Recoit',
      travel: 'Se deplace',
    },
    sports: {
      football11: 'Football a 11',
      football5: 'Football a 5',
    },
  },
  leagueStandings: {
    comingSoon: 'Bientôt disponible',
    inProgress: '- En cours',
    season: 'Saison',
    title: 'CLASSEMENT',
  },
  leagueWorkflowPresenter: {
    cta: {
      didMatchHappen: 'Le match a-t-il eu lieu ?',
      enterScore: 'Saisir le score',
      handleDispute: 'Traiter le litige',
      markVenueBooked: 'Marquer terrain réservé',
      validateScore: 'Valider le score',
      viewConversation: 'Voir la conversation',
      viewHistory: 'Voir l historique',
      viewMatch: 'Voir le match',
      viewNegotiation: 'Voir la négociation',
    },
    helpers: {
      cancelled: 'Ce match est terminé. Consulte l historique League pour le detail.',
      // eslint-disable-next-line max-len
      confirmedUpcoming: 'Le match est confirmé. Gérer maintenant la présence et le suivi d équipe.',
      default: 'Consulte la fiche match pour suivre l état League.',
      disputed: 'Un litige est en cours. Ouvre la fiche pour consulter les éléments du match.',
      finished: 'Le match est terminé. Consulte l historique League pour le detail.',
      pendingProposal: 'Une proposition League attend ton attention dans la fiche match.',
      // eslint-disable-next-line max-len
      pendingValidation: 'Le score adverse a été soumis. Ouvre la fiche pour confirmer ou contester.',
      postSlotResolution: 'Le match a commence sans terrain confirmé. Dites si le match a eu lieu.',
      valid: 'Le score est validé. Retrouve le récapitulatif dans l historique League.',
      // eslint-disable-next-line max-len
      waitingProposal: 'Une proposition League est en cours. Ouvre la fiche pour negocier ce match.',
      waitingScore: 'Le match est joue. Ouvre la fiche pour saisir ou valider le score.',
      waitingVenue: 'Le terrain doit maintenant être confirme dans la fiche match.',
    },
  },
  legacySearchMapNative: {
    error: {
      // eslint-disable-next-line max-len
      body: 'Les tuiles Google Maps ne répondent pas pour le moment. Réessaie ou reviens à la liste.',
      retry: 'Réessayer',
      retryLabel: 'Réessayer le chargement de la carte',
      showList: 'Voir la liste',
      title: 'Impossible de charger la carte',
    },
    loading: {
      body: "Nous préparons l'affichage géolocalisé de tes résultats.",
      title: 'Chargement de la carte',
    },
    tapMarker: 'Touche un repère pour voir la fiche',
  },
  legalFooter: {
    linkError: {
      message: "Impossible d'ouvrir {{url}} depuis l'application.",
      title: 'Page indisponible',
    },
    pricesNotice: 'Prix TTC. Renouvellement automatique, résiliable à tout moment.',
    privacy: 'Confidentialité',
    privacyHint: 'Ouvre la politique de confidentialité dans le navigateur.',
    restore: 'Restaurer mes achats',
    restoreDone: {
      message: "Ton contexte abonnement vient d'être mis à jour.",
      title: 'Restauration terminée',
    },
    restoreError: {
      title: 'Erreur abonnement',
    },
    restoring: 'Restauration en cours…',
    terms: 'Conditions générales',
    termsHint: "Ouvre les conditions générales d'utilisation dans le navigateur.",
  },
  licenseCheckoutStatus: {
    backToFee: 'Retour à ma cotisation',
    details: {
      amount: 'Montant',
      method: 'Methode',
      status: 'Statut',
      title: 'État actuel',
    },
    error: {
      description: 'Impossible de vérifier le statut du paiement pour le moment.',
      retry: 'Réessayer',
      title: 'Statut indisponible',
    },
    header: {
      title: 'Suivi du paiement',
    },
    messages: {
      checking: 'On vérifie le retour du paiement et la confirmation transmise au club.',
      // eslint-disable-next-line max-len
      confirmed: 'Le paiement est confirmé. Ton reçu apparaîtra des qu il sera généré par le club ou automatiquement.',
      // eslint-disable-next-line max-len
      failed: 'Le paiement n a pas abouti. Tu peux revenir à ta cotisation pour relancer un règlement.',
      // eslint-disable-next-line max-len
      helloassoPending: 'HelloAsso a bien été ouvert. Nous attendons maintenant la confirmation du paiement.',
      manualReview: 'Le paiement est en attente de vérification par le club.',
      // eslint-disable-next-line max-len
      opened: 'Le paiement {{provider}} s est ouvert dans une page securisee. Si tu viens de payer, le statut sera mis à jour automatiquement ou après validation du club.',
      pending: 'Le paiement {{provider}} est encore en cours de vérification.',
      syncing: 'Le paiement {{provider}} est encore en cours de synchronisation.',
    },
    providerFallback: 'paiement',
  },
  licenseDesignSystem: {
    helloAsso: {
      // eslint-disable-next-line max-len
      checkoutFailed: 'Le test de checkout HelloAsso a échoué. Vérifie le slug organisation et les droits API.',
      credentialsMissing: 'Renseigne le slug, le client id et le client secret avant publication.',
      disabled: 'HelloAsso est désactivé pour ce scope.',
      needsReview: 'La configuration HelloAsso demande une vérification supplémentaire.',
      notConfigured: 'La connexion HelloAsso n est pas encore configurée pour ce club.',
      oauthFailed: 'OAuth HelloAsso en erreur. Vérifie le client id et le client secret.',
      pending: 'La configuration HelloAsso existe, mais elle n a pas encore été vérifiée.',
      ready: 'Connexion HelloAsso validée. La campagne peut utiliser le paiement in-app.',
      webhookPending: 'Connexion validée. Le premier paiement doit encore confirmer le webhook.',
      // eslint-disable-next-line max-len
      webhookStale: 'Connexion validée, mais aucun webhook récent n a été vu. Un test de paiement est recommandé.',
    },
    installments: {
      empty: {
        description: 'Aucune échéance détaillée n est encore disponible.',
        title: 'Échéancier indisponible',
      },
      item: 'Échéance',
      noDate: 'Date non définie',
    },
    paymentModes: {
      bankTransfer: 'Virement',
      cardPhysical: 'Carte au club',
      cash: 'Espèces',
      check: 'Chèque',
      custom: 'Autre moyen',
      externalLink: 'Lien externe club',
      stripe: 'Carte en ligne',
    },
    statusChip: {
      unknown: 'Inconnu',
    },
    statusLabels: {
      active: 'Active',
      cancelled: 'Annulee',
      checkoutFailed: 'Test checkout en erreur',
      closed: 'Cloturee',
      confirmed: 'Valide',
      credentialsMissing: 'Configuration incomplète',
      disabled: 'Desactive',
      disputed: 'Litige',
      draft: 'Brouillon',
      failed: 'Echoue',
      issued: 'Emis',
      linkMissing: 'Lien manquant',
      manualReview: 'A valider',
      missing: 'Manquant',
      notConfigured: 'A configurer',
      notDue: 'Non due',
      oauthFailed: 'OAuth en erreur',
      overdue: 'En retard',
      paid: 'Payee',
      partial: 'Partiel',
      partiallyRefunded: 'Remboursement partiel',
      pending: 'En attente',
      ready: 'Pret',
      refunded: 'Remboursee',
      refused: 'Refuse',
      rejected: 'Rejete',
      scheduled: 'Programmee',
      submitted: 'Depose',
      toReplace: 'A remplacer',
      validated: 'Valide',
      waived: 'Exemptee',
      webhookPending: 'Webhook à confirmer',
      webhookStale: 'Webhook à vérifier',
    },
  },
  licenseeCountField: {
    errors: {
      // eslint-disable-next-line max-len
      alreadyCovered: 'Ton abonnement couvre déjà {{covered}} licenciés : indique un nombre plus grand.',
      max: "{{max}} licenciés maximum. Écris-nous au-delà, on s'en occupe.",
      min: 'Indique au moins 1 licencié.',
    },
    label: 'Nombre de licenciés',
  },
  licenseService: {
    errors: {
      apiUnavailableDocument: 'API FoundClub indisponible pour envoyer le document.',
      // eslint-disable-next-line max-len
      apiUnavailableOfficialLicence: 'API FoundClub indisponible pour envoyer la licence officielle.',
      apiUnavailableTemplate: 'API FoundClub indisponible pour envoyer le modèle.',
    },
  },
  location: {
    distanceKm: 'à {{distance}} km',
    distanceMeters: 'à {{distance}} m',
  },
  locationShareBubble: {
    openInGps: 'Ouvrir dans le GPS',
    title: 'Position partagée',
  },
  login: {
    actions: {
      login: 'Se connecter',
      register: 'Créer un compte',
    },
    fields: {
      phoneNumber: {
        label: 'Numéro de téléphone',
        placeholder: '0612345678',
      },
    },
    or: 'ou',
    subtitle: 'Renseigne ton numéro de téléphone.',
    title: 'Connecte-toi',
  },
  maps: {
    error: {
      legacyTiles: 'Les tuiles de la carte legacy ne répondent pas pour le moment.',
      retry: 'Réessayer',
      title: 'Impossible de charger la carte',
    },
  },
  matchCallUp: {
    manualPlayer: {
      actions: {
        cancel: 'Annuler',
        submit: 'Ajouter au groupe',
      },
      errors: {
        nameRequired: 'Prénom et nom requis.',
      },
      fields: {
        firstname: {
          label: 'Prénom',
          placeholder: 'Yanis',
        },
        jerseyNumber: {
          label: 'Numéro de maillot',
          placeholder: '23',
        },
        lastname: {
          label: 'Nom',
          placeholder: 'Bertrand',
        },
        optional: 'Optionnel',
      },
      intro: "Il apparaîtra sur la compo et dans la convocation comme les autres. Il ne pourra simplement pas répondre depuis l'app.",
      subtitle: "Il n'a pas l'app · {{teamName}}",
      title: 'Ajouter un joueur',
      warning: {
        after: '. Ce sera à toi de le prévenir.',
        before: '{{firstname}} ne recevra',
        fallbackName: 'ce joueur',
        strong: 'aucune notification',
      },
    },
    selection: {
      absentWarning: {
        cancel: 'Revoir ma sélection',
        confirm: 'Convoquer quand même',
        message_one: '{{names}} a répondu qu’il ne serait pas là.',
        message_other: '{{names}} ont répondu qu’ils ne seraient pas là.',
        note: 'Rien ne t’en empêche : la convocation partira quand même.',
        title_one: '1 joueur a dit ABSENT',
        title_other: '{{count}} joueurs ont dit ABSENT',
      },
      addPlayer: {
        subtitle: "Nom, prénom et numéro, pour un joueur sans l'app",
        title: 'Ajouter un joueur',
      },
      alerts: {
        noneSelected: {
          message: 'Sélectionne au moins un joueur.',
          title: 'Attention',
        },
      },
      defaultEventType: 'Match',
      empty: {
        offApp: 'Aucun joueur hors app pour le moment.',
        reinforcements: "Aucune autre équipe dans le club pour l'instant.",
        search: 'Aucun résultat.',
        squad: "Aucun joueur dans l'équipe.",
      },
      footer: {
        calledUp_one: '{{count}} convoqué',
        calledUp_other: '{{count}} convoqués',
        extras: 'dont {{reinforcements}} renforts · {{offApp}} hors app',
        next: 'Suivant',
        split: '{{starters}} titulaires · {{bench}} sur le banc',
      },
      meta: {
        number: 'N°{{number}}',
        numberAndPosition: 'N°{{number}} · {{position}}',
        positionToDefine: 'Poste à définir',
      },
      noSms: 'Préviens-le toi-même',
      offAppTag: 'Hors app',
      progress: '{{current}}/{{total}}',
      rsvp: {
        absent: 'Absent',
        none: 'Sans réponse',
        pending: 'En attente',
        present: 'Présent',
      },
      search: 'Rechercher un joueur',
      sections: {
        offApp: 'Déjà ajoutés · {{count}}',
        reinforcements: 'Renforts du club · {{count}}',
        squad: 'Effectif {{teamName}} · {{count}}',
      },
      tabs: {
        offApp: 'Hors app',
        others: 'Autres équipes',
        squad: 'Mon équipe',
      },
      title: 'Convoqués',
      unavailability: {
        injury: 'Blessé',
        licence: 'Licence non validée',
        suspension_one: 'Suspendu {{count}} match',
        suspension_other: 'Suspendu {{count}} matchs',
      },
    },
  },
  matchCenterScreen: {
    alerts: {
      addSlotError: "Impossible d'ajouter le créneau.",
      cancelledByOther: "Ton match a été annulé par l'adversaire ou le système.",
      cancelSearchError: "Impossible d'annuler la recherche pour le moment.",
      invalidLocationBody: 'Impossible de lire les coordonnées de ton localisation.',
      invalidLocationTitle: 'Localisation invalide',
      // eslint-disable-next-line max-len
      locationRequiredBody: 'Ajoute une adresse de squad validée (coordonnées GPS) avant de lancer la recherche.',
      locationRequiredTitle: 'Localisation requise',
      matchCancelledTitle: 'Match annulé',
      matchNotReady: "Le match n'est pas encore prêt. Réessaie dans quelques secondes.",
      previousCancelled: 'Le match précédent a été annulé.',
      proposalError: "Impossible d'envoyer la proposition.",
      restrictedBody: 'Seul un capitaine ou co-capitaine peut arrêter la recherche League.',
      restrictedTitle: 'Action réservée',
      searchActiveBody: 'Une recherche est déjà en cours pour cette squad.',
      searchActiveTitle: 'Recherche déjà activé',
      searchFailed: 'Recherche échouée',
      slotAdded: 'Créneau ajouté à la recherche.',
      slotRequiredBody: 'Sélectionne au moins un créneau avant de lancer la recherche.',
      slotRequiredTitle: 'Créneau requis',
      slotsAdded: '{{count}} créneaux ajoutés à la recherche.',
      successTitle: 'Succès',
    },
    cancelMatch: {
      action: 'Annuler le match',
      body: 'Es-tu sûr de vouloir annuler ce match ? Ton équipe reviendra en mode recherche.',
      cancelAndRestart: 'Annuler et relancer',
      cancelAndRestartAlt: 'Annuler et Relancer',
      cancelOnly: 'Annuler seulement',
      doneBody: 'Tu peux relancer une recherche.',
      doneTitle: 'Match annule',
      error: "Impossible d'annuler le match.",
      no: 'Non',
      restartError: 'Match annule mais impossible de relancer la recherche.',
      restartErrorAlt: 'Match annulé mais impossible de relancer la recherche.',
      title: 'Annuler le match ?',
    },
    chatSubtitle: 'Match de Ligue',
    chatTitleAnonymous: 'Vs Adversaire',
    closed: {
      matchmaking: 'Recherche de match fermée',
      platform: 'Found Club League fermée',
    },
    config: {
      add: '+ Ajouter',
      addressPlaceholder: 'Entre une nouvelle adresse...',
      availability: 'Tes disponibilités (',
      cancel: 'Annuler',
      close: 'Fermer',
      confirmScan: 'CONFIRMER & SCANNER',
      deselectAll: 'Tout désélectionner',
      matchDuration: 'Durée Match',
      noSlots: 'Aucun créneau défini. Ajoute-en directement ici.',
      otherCommonSlots: '- Autres créneaux communs possibles :',
      searchArea: 'Zone de recherche',
      searchRadius: 'Rayon de recherche',
      selectAll: 'Tout sélectionner',
      starting: 'Lancement...',
      subtitle: 'Rechercher match',
      undefinedArea: 'Zone indéfinie',
      venue: 'Lieu:',
    },
    days: {
      friday: 'Vendredi',
      monday: 'Lundi',
      saturday: 'Samedi',
      sunday: 'Dimanche',
      thursday: 'Jeudi',
      tuesday: 'Mardi',
      wednesday: 'Mercredi',
    },
    errors: {
      load: 'Impossible de charger le Match Center League.',
      loadAlert: 'Impossible de charger le Match Center',
      sync: 'Impossible de synchroniser le Match Center League.',
    },
    errorTitle: 'Erreur',
    found: {
      commonSlots: 'Créneaux en commun',
      duelConfirmed: 'Duel confirmé',
      // eslint-disable-next-line max-len
      football11Hint: 'Pour le Football a 11, l identité adverse et les créneaux communs sont visibles des le match trouve.',
      keySlot: 'Créneau phare',
      label: 'MATCH TROUVE',
      // eslint-disable-next-line max-len
      maskedHint: 'Le profil reste masque tant que le premier contact n est pas engage dans le chat.',
      nextStep: 'Prochaine étape',
      opposingTeam: 'Équipe adverse',
    },
    history: {
      draw: 'Nul',
      empty: 'Aucun match terminé pour le moment.',
      emptyHint: 'Termine un premier match pour alimenter ton historique.',
      loss: 'Defaite',
      startSearch: 'Lancer une recherche',
      title: 'DERNIERS MATCHS',
      unknownDate: 'Date inconnue',
      win: 'Victoire',
    },
    mission: {
      error: {
        eyebrow: 'ALERTE Réseau',
        // eslint-disable-next-line max-len
        helper: 'La connexion au serveur League a été interrompue. Tu peux relancer le scan ou revenir au vestiaire.',
        subtitle: 'Signal interrompu',
        title: 'Connexion perdue',
      },
      init: {
        eyebrow: 'PROTOCOLE LEAGUE',
        helper: 'Lancement du protocole de match et synchronisation des signaux de la rencontre.',
        subtitle: 'Mise en place',
        title: 'Initialisation',
      },
      radar: {
        // eslint-disable-next-line max-len
        captainOnly: 'La recherche est geree par le capitaine de ta squad. Seul lui ou un co-capitaine peut l annuler.',
        eyebrow: 'RADAR ACTIF',
        helper: 'Nous cherchons une équipe compatible dans ta zone et sur tes plages partagées.',
        subtitle: 'Balayage en cours',
        title: 'Recherche active',
      },
      scan: {
        helper: 'Nous analysons ta zone, tes créneaux et les disponibilités compatibles.',
        subtitle: 'Analyse réseau',
        title: 'Lancement du scan',
      },
    },
    mySquadFallback: 'Ta squad',
    negotiationSubtitle: 'Négociation du match en cours',
    nextMatch: {
      actionRequired: 'ACTION REQUISE',
      searching: 'RECHERCHE...',
      title: 'PROCHAIN MATCH',
    },
    noTeam: {
      create: 'Créer une squad',
      subtitle: 'Crée ton équipe pour rejoindre la compétition officielle.',
      title: "Prêt à l'action ?",
    },
    opponent: {
      approximateArea: 'Zone approximative',
      locationModes: ' • Nous: {{mine}} / Eux: {{theirs}}',
      mysteryUpper: 'ADVERSAIRE MYSTERE',
      standardRadius: 'Rayon standard',
      standardRadiusTitle: 'Rayon Standard',
      unknownArea: 'Zone inconnue',
      unknownDate: 'Date Inconnue',
      upperFallback: 'ADVERSAIRE',
    },
    opponentFallback: 'Adversaire',
    proposalCta: {
      createTitle: 'ENVOYER UNE PROPOSITION',
      // eslint-disable-next-line max-len
      createWithoutVenue: 'Le match correspond à tes critères. Envoie une proposition d horaire, avec un lieu si tu veux le fixer tout de suite.',
      // eslint-disable-next-line max-len
      createWithVenue: 'Le match correspond à tes critères. Envoie une proposition de terrain et d’horaire pour lancer la négociation.',
      openHelper: 'Une proposition est déjà ouverte. Ouvre la négociation pour continuer.',
      openTitle: 'OUVRIR LA NÉGOCIATION',
      // eslint-disable-next-line max-len
      replyHelper: 'Une proposition adverse attend ta réponse. Ouvre le chat pour accepter, refuser ou contre-proposer.',
      replyTitle: 'RÉPONDRE',
      // eslint-disable-next-line max-len
      sentHelper: 'Ta proposition a été envoyée. Ouvre la discussion pour suivre la réponse adverse.',
      sentTitle: 'VOIR LA PROPOSITION',
    },
    searching: {
      helper: 'Nous cherchons une équipe compatible dans ta zone.',
      title: 'RECHERCHE EN COURS',
    },
    searchRestricted: {
      // eslint-disable-next-line max-len
      body: 'Tu dois être membre de cette squad pour lancer une recherche manuelle. La recherche démarre aussi automatiquement quand le quorum est prêt sur un créneau.',
      invite: 'Inviter des joueurs',
      ok: 'Compris',
      title: 'Recherche réservée à la squad',
    },
    slots: {
      full: 'COMPLET',
      invitePlayers: 'INVITER DES JOUEURS',
      missingPrefix: 'Il manque',
      missingSuffix: 'joueurs pour être au complet.',
      noMatch: 'Pas de match',
      noneBooked: 'Aucun créneau réservé',
      open: 'OUVERT',
      searchMatch: 'RECHERCHER UN MATCH',
      startSearch: 'LANCER LA RECHERCHE',
      teamComplete: 'Équipe complète',
    },
    squadSwitch: {
      active: 'Actif',
      empty: 'Aucune squad disponible.',
      hint: 'Ouvre la liste des squads',
      subtitle: 'Sélectionné la squad active pour les matchs',
      title: 'Changer de squad',
    },
    states: {
      loadingDescription: 'Synchronisation de ta squad et des opportunités de match en cours.',
      loadingTitle: 'Chargement du Match Center',
      retry: 'Réessayer',
      unavailable: 'Match Center indisponible',
    },
    stats: {
      bestStreak: ' | Meilleure série: x',
      currentSeason: 'SAISON EN COURS',
      lastResultLoss: 'Dernier résultat: défaite',
      nextBonus: 'Prochain bonus: +{{nextStreakBonus}}',
      nextWin: 'Prochaine victoire: +20 pts',
      pointsToPromotion: '{{points}} pts avant promotion',
      prestigeDivision: 'Division 1 prestige',
      streak: 'Série',
      wins: 'VICTOIRES',
    },
    suggestion: {
      accept: 'ACCEPTER CETTE PISTE',
      acceptedBody: 'On attend l accord de la squad adverse. La recherche continue en parallele.',
      acceptedPending: 'ACCEPTE - EN ATTENTE',
      acceptedTitle: 'Piste acceptée',
      distance: 'A {{distance}} km de toi',
      distanceChecking: 'Distance en vérification',
      eloGap: " - {{eloDiff}} pts ELO matchmaking d'écart",
      error: 'Impossible de traiter cette piste. La recherche continue.',
      ignoredBody: 'La recherche continue dans ton rayon.',
      ignoredTitle: 'Piste ignorée',
      inArea: ', dans ta zone',
      label: 'PISTE OPTIONNELLE',
      outsideRadius: ', +{{extra}} km hors rayon',
      squadFallback: 'Squad compatible',
      statusAcceptedByMe: 'Tu as accepté. En attente de l autre squad.',
      statusAcceptedByOpponent: 'La squad adverse est partante.',
      statusDefault: 'Piste optionnelle disponible.',
      stayInRadius: 'CONTINUER DANS MON RAYON',
      unavailableTitle: 'Piste indisponible',
      unknownDivision: 'Division inconnue',
    },
  },
  matchComposition: {
    board: {
      actions: {
        publish: 'Publier',
        save: 'Enregistrer',
      },
      alerts: {
        error: {
          publish: 'Impossible de publier cette convocation.',
          save: "Impossible d'enregistrer cette composition.",
          title: 'Erreur',
        },
        published: {
          message: 'La convocation est partie dans le canal de l’équipe.',
          ok: 'OK',
          title: 'Convocation publiée',
        },
        saved: {
          message: 'Ta composition est gardée en brouillon. Personne n’a été prévenu.',
          title: 'Composition enregistrée',
        },
      },
      bench: {
        empty: 'Tout le monde est sur le terrain.',
        hint: 'Glisse un joueur sur le terrain',
        title: 'Remplaçants · {{count}}',
      },
      chips: {
        bench: 'Banc {{count}}',
        freePlacement: 'Placement libre',
        magnet: 'Aimanté aux postes',
        placed: '{{placed}}/{{starters}} placés',
      },
      edit: 'Modifier',
      title: 'Composition',
      tokenOnBench: '{{name}}, sur le banc',
      tokenOnField: '{{name}}, sur le terrain',
    },
    sheet: {
      actions: {
        publish: 'Publier la convocation',
      },
      description: 'La convocation part dans le canal {{teamName}} — seuls les joueurs retenus sont convoqués.',
      kicker: 'Convocation',
      requireResponse: {
        subtitle: 'Présent / absent dans le canal',
        title: 'Demander une réponse',
      },
      summary: {
        offApp: 'Joueurs hors app',
        offAppValue_one: '{{count}} ajouté à la main',
        offAppValue_other: '{{count}} ajoutés à la main',
        starters: 'Titulaires',
        startersValue: '{{count}} sur le terrain',
        substitutes: 'Remplaçants',
        substitutesValue: '{{count}} sur le banc',
      },
      title: 'Publier la compo ?',
    },
    sports: {
      basketball: 'Basketball',
      football: 'Football',
      futsal: 'Futsal',
      generic: 'Terrain',
      handball: 'Handball',
      rugby: 'Rugby à XV',
      rugby13: 'Rugby à XIII',
      volleyball: 'Volleyball',
    },
    start: {
      actions: {
        openField: 'Ouvrir le terrain',
      },
      autoPlace: {
        none: 'Aucun convoqué n’a renseigné son poste : ils partent tous du banc.',
        subtitle_one: '{{count}} convoqué a renseigné son poste. Les autres restent au banc.',
        subtitle_other: '{{count}} convoqués ont renseigné leur poste. Les autres restent au banc.',
        title: 'Placer les joueurs sur leur poste',
      },
      calledUpCount_one: '{{count}} convoqué',
      calledUpCount_other: '{{count}} convoqués',
      eventLabel: 'Match',
      // 🕳️ La contrepartie de l'assouplissement du 07/09 : quand on ouvre une
      // formation a effectif incomplet, on DIT le trou. Sans ca, un blocage
      // deviendrait un oubli silencieux.
      formationPartial_one: '{{count}} poste restera vide — tu pourras le compléter.',
      formationPartial_other: '{{count}} postes resteront vides — tu pourras les compléter.',
      formationSlots_one: '{{count}} poste à remplir.',
      formationSlots_other: '{{count}} postes à remplir.',
      formationsTitle: 'Compos type',
      magnet: {
        disabled: 'Disponible quand tu pars d’une formation.',
        subtitle: 'Le jeton colle au poste le plus proche. Tu peux toujours le poser où tu veux.',
        title: 'Aimanter aux postes',
      },
      noFormationForSport: 'Ce sport n’a pas encore de disposition de terrain — place tes joueurs librement.',
      options: {
        default_composition: {
          subtitle: 'Le modèle par défaut de {{teamName}}.',
          title: 'Compo type',
        },
        empty: {
          subtitle: 'Tout le monde part du banc.',
          title: 'Terrain vide',
        },
        last_match: {
          subtitle: 'La compo du dernier match, telle quelle.',
          subtitleDated: 'La compo de {{date}}, telle quelle.',
          title: 'Dernier match',
        },
      },
      preview: 'Aperçu',
      previewEmpty: 'Tout le monde part du banc.',
      progress: '{{current}}/{{total}}',
      title: 'Partir de…',
      unavailable: {
        noDefaultComposition: 'Cette équipe n’a pas encore de compo type.',
        noLastMatch: 'Aucune compo déjà publiée à reprendre.',
        notEnoughPlayers: 'Le {{label}} se joue à {{needed}} ; il faut au moins {{minimum}} convoqués, tu en as {{selected}}.',
      },
    },
  },
  matchCompositionUtils: {
    team: 'Équipe',
  },
  matchConvocation: {
    amend: {
      actions: {
        cancel: 'Annuler',
        republish: 'Republier',
      },
      alerts: {
        error: {
          message: 'Impossible de republier cette composition.',
          title: 'Erreur',
        },
        republished: {
          message: 'Ta composition est à jour et tes joueurs viennent d’être prévenus.',
          title: 'Composition republiée',
        },
      },
      badges: {
        entering: 'entre',
        leaving: 'sort',
      },
      empty: {
        message: 'Personne ne s’est désisté.',
        title: 'Rien à modifier pour l’instant',
      },
      moves: {
        benchToStarter: 'Banc → titulaire',
        starterToAbsent: 'Titulaire → absent',
      },
      noReplacement: 'Aucun remplaçant disponible sur le banc. Reprends la composition à la main.',
      resend: {
        body: 'Même canal {{teamName}}, même notification individuelle, même demande de '
          + 'réponse. Les joueurs qui avaient déjà répondu gardent leur réponse.',
        title: 'La convocation repart comme la première fois.',
      },
      sections: {
        changes: 'Ce qui change',
        resend: 'Renvoyer la convocation',
      },
      title: 'Compo modifiée',
      unknownPlayer: 'Joueur',
      versionChip: 'Version {{version}}',
      withdrawal: {
        hint_one: 'Sa place de titulaire est vide. Le premier remplaçant disponible est proposé.',
        hint_other: 'Leurs places de titulaires sont vides. Les premiers remplaçants '
          + 'disponibles sont proposés.',
        label: 'Désistement',
        message_one: '{{name}} s’est déclaré·e absent·e après la publication.',
        message_other: '{{count}} titulaires se sont déclarés absents après la publication.',
      },
    },
    published: {
      actions: {
        edit: 'Modifier la composition',
        resend: 'Relancer',
      },
      alerts: {
        error: {
          resend: 'Impossible de renvoyer cette convocation.',
          title: 'Erreur',
        },
        resendConfirm: {
          cancel: 'Annuler',
          confirm: 'Renvoyer',
          message: 'La convocation repart dans le canal {{teamName}}, avec une notification '
            + 'à chaque convoqué. Les réponses déjà données sont conservées.',
          title: 'Renvoyer la convocation ?',
        },
        resent: {
          message: 'Tes convoqués viennent d’être prévenus à nouveau.',
          title: 'Convocation renvoyée',
        },
      },
      counts: {
        absent_one: '{{count}} absent',
        absent_other: '{{count}} absents',
        pending_one: '{{count}} en attente',
        pending_other: '{{count}} en attente',
        present_one: '{{count}} présent',
        present_other: '{{count}} présents',
      },
      empty: 'Personne n’est encore convoqué.',
      loading: 'Chargement des réponses…',
      meta: {
        roleAndNumber: '{{role}} · N°{{number}}',
      },
      noField: {
        message: 'Aucun joueur n’est placé, ou plusieurs équipes ont été publiées ensemble.',
        title: 'Pas de terrain à afficher pour cette convocation',
      },
      offAppNote: 'Hors app — il ne peut pas répondre',
      openCta: 'Voir la convocation et les réponses',
      recap: {
        calledUp: 'Joueurs convoqués',
        sent: 'Envoyée dans le canal {{teamName}}',
        sentAt: 'Envoyée dans le canal {{teamName}} · {{time}}',
        title: 'Convocation publiée',
      },
      responses: {
        absent: 'Absent·e',
        pending: 'Participation en attente',
        present: 'Présent·e',
      },
      roles: {
        starter: 'Titulaire',
        substitute: 'Remplaçant',
      },
      sections: {
        responses: 'Réponses',
      },
      stateChip: 'Publiée',
      title: 'Convocation',
      unknownPlayer: 'Joueur',
      withdrawal: {
        cta: 'Remplacer',
        label: 'Désistement',
        message_one: 'Un titulaire s’est déclaré absent.',
        message_other: '{{count}} titulaires se sont déclarés absents.',
      },
    },
  },
  matchFinalPosterModal: {
    banners: {
      calculating: 'Calcul des points en cours',
      loss: 'Perte League',
      movingTo: 'Passage en D{{division}}',
      progress: 'Progression League',
      promotionConfirmed: 'Promotion validée',
      promotionThreshold: 'Seuil de promotion atteint',
      relegationApplied: 'Relégation appliquée',
      safetyLost: 'Seuil de maintien perdu',
    },
    breakdown: {
      result: 'Résultat',
      streakBonus: 'Bonus série',
    },
    divisionStatus: {
      calculating: 'Calcul en cours',
      held: 'Maintien',
      maxReached: 'Division max atteinte',
      relegation: 'Relégation',
    },
    helper: {
      pointsToNext: '{{points}} pts avant la D{{nextDivision}}.',
      // eslint-disable-next-line max-len
      syncing: 'Les points sont en cours de synchronisation. Le récapitulatif sera mis à jour dès que le calcul League est prêt.',
      thresholdReached: 'Seuil D{{nextDivision}} atteint.',
      topDivision: 'Tu es déjà dans la division la plus haute.',
    },
    pointsAfter: 'Points après',
    pointsBefore: 'Points avant',
    resultFallback: 'Résultat enregistré',
    searchAgain: 'Relancer une recherche',
    stage: {
      maxDivision: 'Division max',
    },
    status: {
      cancelled: 'Match annule',
      forfeit: 'Forfait',
      valid: 'Résultat valide',
    },
    title: 'Fin de match',
    viewDetails: 'Voir détails',
  },
  matchFormationCatalog: {
    placedAttack: 'Attaque placée',
    rugbyLeague: 'Rugby à XIII',
    rugbyUnion: 'Rugby à XV',
    wReception: 'Réception en W',
  },
  matchHistory: {
    emptyHint: 'Lance une recherche !',
    emptyTitle: 'Aucun match joue pour le moment.',
    opponentFallback: 'Adversaire',
    subtitle: 'HISTORIQUE',
    title: 'DERNIERS MATCHS',
    viewAll: 'VOIR TOUT HISTORIQUE (',
  },
  matchHistoryScreen: {
    empty: 'Aucun match trouve',
    errors: {
      history: "Impossible de charger l'historique des matchs.",
      squad: 'Impossible de charger ta squad League.',
    },
    loadError: {
      title: 'Chargement impossible',
    },
    loading: {
      description: "Nous chargeons l'historique de tes matchs League.",
      title: "Chargement de l'historique",
    },
    noSquad: {
      description: "Aucune squad League n'est reliee à ce compte pour afficher un historique.",
      title: 'Historique indisponible',
    },
    opponentFallback: 'Adversaire',
    retry: 'Reessayer',
    subtitle: 'SAISON EN COURS',
    title: 'HISTORIQUE',
  },
  matchRecapBanner: {
    openDetailsHint: 'Touche pour voir le detail complet.',
    resultFallback: 'Match terminé',
    title: 'Recap match',
  },
  matchRecapSheet: {
    leaguePointsTotal: ' | Total points League ',
    movementChange: 'Changement',
    pointsAfter: 'Points après',
    pointsBefore: 'Points avant',
    resultFallback: 'Résultat validé',
    resultLabel: 'Resultat',
    searchAgain: 'Relancer une recherche',
    streakBonus: ' | Bonus série ',
    title: 'Recap de fin de match',
    viewDetails: 'Voir le detail',
  },
  matchStatsEditor: {
    actions: 'Actions',
    anErrorOccurred: 'Une erreur est survenue.',
    assists: 'Passes décisives',
    // eslint-disable-next-line max-len
    assistsExceedGoals: 'Les passes decisives ({{totalAssists}}) dépassent les buts marques ({{totalGoals}}).',
    cancel: 'Annuler',
    checkRequired: 'Vérification requise',
    cleanSheet: 'Clean sheet',
    cleanSheetNeedsZero: 'Le clean sheet n est possible que si le score adverse est a 0.',
    correctionsRequired: 'Corrections requises',
    draftInProgress: 'Brouillon en cours',
    draftSaved: 'Brouillon enregistre',
    draftSavedMessage: 'Le brouillon des stats du match a bien été enregistre.',
    draftSaveError: 'Impossible d enregistrer ce brouillon de stats.',
    draftStaysEditable: 'Le brouillon reste modifiable tant que tu ne publies pas ce rapport.',
    editable: 'Editable',
    enterScoreBeforeDraft: 'Renseigne le score du match avant d enregistrer ce brouillon.',
    eventTeamReview: "Bilan collectif de l'événement",
    finalScore: 'Score final',
    // eslint-disable-next-line max-len
    finalScoreRequiredBeforePublish: 'Le score final doit être enregistre avant de publier les stats.',
    // eslint-disable-next-line max-len
    fixInconsistencies: 'Corrige les incoherences entre le score final et les statistiques joueur avant de continuer.',
    foundClubPlayer: 'Joueur FoundClub',
    goals: 'Buts',
    goalsConceded: 'Buts encaissés',
    goalScorers: 'Buteur·se·s',
    // eslint-disable-next-line max-len
    goalsExceedScore: 'Les buts saisis ({{totalGoals}}) dépassent le score final ({{resolvedScoreFor}}).',
    // eslint-disable-next-line max-len
    individualFeedbackEmptyHint: 'Les retours individuels apparaîtront ici des que la liste joueur sera disponible.',
    // eslint-disable-next-line max-len
    individualFeedbackHint: 'Tu peux ajouter une note et un commentaire prive à chaque joueur si tu le souhaites.',
    leagueMatchTeamReview: 'Bilan collectif du match ligue',
    leagueScoreIsOfficial: 'Le score ligue validé reste la source officielle pour ce rapport.',
    leagueValidatedScore: 'Score ligue validé',
    loadingMatchStats: 'Chargement des stats du match...',
    loadReportError: 'Impossible de charger ce rapport.',
    locked: 'Verrouille',
    manualPlayer: 'Joueur manuel',
    manualScore: 'Score saisi dans FoundClub',
    matchStats: 'Stats du match',
    minutesPlayed: 'Minutes jouees',
    missingScore: 'Score manquant',
    noPlayerAvailable: 'Aucun joueur disponible.',
    noPlayerFeedbackYet: 'Pas encore de retour joueur',
    noPlayerForReport: 'Aucun joueur disponible pour ce rapport.',
    // eslint-disable-next-line max-len
    noPlayerForReportHint: 'Publie d abord la composition d équipe ou vérifie le roster de l équipe pour alimenter cette liste.',
    noReminderNeeded: 'Aucune relance nécessaire pour ce match.',
    officialScoreAwaited: 'Le score officiel est encore attendu depuis la synchronisation externe.',
    // eslint-disable-next-line max-len
    officialScoreChangedCheckLines: 'Le score officiel a changé. Vérifie les lignes puis republie directement cette version.',
    officialScorePending: 'Score officiel en attente',
    officialScoreSynced: 'Score officiel synchronise',
    officialScoreUpdated: 'Score officiel mis à jour',
    // eslint-disable-next-line max-len
    officialScoreUpdatedHint: 'Le score synchronise depuis la compétition officielle a changé après une saisie précédente. Vérifie les statistiques joueur puis republie ce rapport.',
    opponentScore: 'Score adverse',
    optionalIndividualFeedback: 'Retours individuels optionnels',
    ourScore: 'Notre score',
    player: 'Joueur',
    playerCleanSheetNeedsZeroConceded: 'Le clean sheet de {{label}} impose 0 but encaissé.',
    // eslint-disable-next-line max-len
    playerConcededExceedsOpponentScore: 'Les buts encaissés de {{label}} dépassent le score adverse ({{resolvedScoreAgainst}}).',
    playerInclusive: 'Joueur·se',
    playersNotCheckedIn: 'Joueurs non pointes',
    playersReminded: '{{remindedCount}} joueur·se·s relancé·e·s pour leur retour post-match.',
    playerStats: 'Stats joueurs',
    playerStatsHint: 'Temps de jeu et statistiques clés adaptees au sport du match.',
    playerThreePointersExceedPoints: 'Les 3 points de {{label}} dépassent ses points marques.',
    points: 'Points',
    // eslint-disable-next-line max-len
    pointsExceedScore: 'Les points saisis ({{totalPoints}}) dépassent le score final ({{resolvedScoreFor}}).',
    postMatchFeedback: 'Retours post-match',
    privateCommentPlaceholder: 'Commentaire prive pour ce joueur',
    publish: 'Publier',
    // eslint-disable-next-line max-len
    publishConfirmMessage: 'Après publication, ce rapport devient la version officielle des statistiques pour cette équipe.',
    publishError: 'Impossible de publier ces statistiques.',
    publishMatchStatsQuestion: 'Publier les stats du match ?',
    publishTheStats: 'Publier les stats',
    quantitiesLocked: 'Quantités verrouillees',
    // eslint-disable-next-line max-len
    quantitiesLockedHint: 'Ce joueur a déjà validé ses stats personnelles. Les chiffres restent proteges, mais tu peux toujours ajouter un retour qualitatif plus haut.',
    rebounds: 'Rebonds',
    reminderSendError: "Impossible d'envoyer la relance.",
    reminderSent: 'Relance envoyée',
    remindMissing: 'Relancer les {{missingResponseCount}} manquant·e·s →',
    // eslint-disable-next-line max-len
    reportAlreadyFinalised: 'Ce rapport est déjà finalise. Les agregations joueur et équipe sont à jour.',
    reportFinalised: 'Rapport finalise',
    // eslint-disable-next-line max-len
    reportUpdatedAfterSync: 'Le rapport a été mis à jour après la synchronisation du score officiel.',
    responsesReceived: '{{responseCompletionCount}}/{{responseEligibleCount}} reçus',
    // eslint-disable-next-line max-len
    reviewConfirmMessage: 'Le score officiel a changé. Cette publication confirme la nouvelle version des stats pour ton équipe.',
    reviewRequired: 'Revision requise',
    saveTheDraft: 'Sauvegarder le brouillon',
    scorePending: 'Score en attente',
    scoreRequired: 'Score requis',
    scorers: 'Marqueur·se·s',
    scoreToComplete: 'Score à compléter',
    sendingReminder: 'Relance en cours…',
    statsNowFinalised: 'Les statistiques du match sont maintenant finalisées.',
    statsPublished: 'Stats publiées',
    // eslint-disable-next-line max-len
    teamCommentPlaceholder: 'Ressenti collectif, dynamique du groupe, points forts, points à travailler...',
    // eslint-disable-next-line max-len
    teamRatingHint: 'Donne une note d équipe sur 10 et un commentaire collectif visible par ton groupe.',
    teamReport: 'Bilan équipe',
    teamReview: 'Bilan collectif',
    thisPlayer: 'ce joueur',
    threePointers: '3 pts',
    threePointersExceedPoints: 'Les tirs a 3 points saisis dépassent le total des points marques.',
    tryAgain: 'Réessayer',
    // eslint-disable-next-line max-len
    unmarkedPlayersHint: "Ces joueurs restent visibles pour le coach, mais ils ne sont pas inclus dans les stats tant que leur attendance n'a pas ete corrigee.",
    update: 'Mettre à jour',
    updateAfterOfficialScore: 'Mettre à jour après score officiel',
    updateAfterOfficialScoreQuestion: 'Mettre à jour après score officiel ?',
  },
  matchStatsEmptyReason: {
    matchNotFinished: {
      // eslint-disable-next-line max-len
      body: "Le bilan s'ouvre une fois l'heure de fin passée. Reviens après le coup de sifflet final.",
      title: "Ton match n'est pas encore terminé",
    },
    noTeam: {
      // eslint-disable-next-line max-len
      body: "Tu n'es joueur ni entraîneur d'aucune équipe. Rejoins une équipe pour recevoir les bilans de ses matchs.",
      title: 'Aucune équipe rattachée à ton compte',
    },
    nothingPending: {
      // eslint-disable-next-line max-len
      body: 'Quand un match terminé demandera encore une action, elle apparaîtra ici automatiquement.',
      title: 'Aucune action en attente',
    },
    sportNotSupported: {
      // eslint-disable-next-line max-len
      body: 'La saisie du score et des statistiques ne couvre pour le moment que le football et le basket.',
      title: "Le sport de ton équipe n'est pas encore géré",
    },
    superadmin: {
      // eslint-disable-next-line max-len
      body: "Le serveur ne propose jamais de bilan de match aux comptes d'administration. Pour tester la saisie, connecte-toi avec un compte joueur ou entraîneur d'une équipe de football ou de basket.",
      title: 'Ton compte ne peut pas saisir ici',
    },
  },
  matchStatsPromptHost: {
    // eslint-disable-next-line max-len
    aPostMatchDraftAlready: 'Un brouillon post-match existe déjà pour cette équipe. Il attend encore d être finalise.',
    checkRequired: 'Vérification requise',
    dateUnavailable: 'Date indisponible',
    draftInProgress: 'Brouillon en cours',
    endOfMatch: 'Fin du match',
    endOfMatchReport: 'Bilan de fin de match',
    enterMyStats: 'Renseigner mes stats',
    enterTheMatchStats: 'Saisir les stats du match',
    event: 'Evenement',
    iDonTKnowMy: 'Je ne sais pas mes stats',
    later: 'Plus tard',
    league: 'Ligue',
    myPostMatchFeedback: 'Mon retour post-match',
    officialScorePending: 'Score officiel en attente',
    open: 'Ouvrir',
    personalDraft: 'Brouillon perso',
    personalFeedback: 'Retour perso',
    postMatchActionsLeftTo: 'Il reste {{totalPending}} actions post-match à compléter.',
    postMatchReminder: 'Rappel post-match',
    resumeMyAnswer: 'Reprendre ma réponse',
    resumeTheDraft: 'Reprendre le brouillon',
    saveTheScore: 'Enregistrer le score',
    scorePending: 'Score en attente',
    scoreToComplete: 'Score à compléter',
    seeAllPendingMatches: 'Voir tous les matchs en attente',
    team: 'Équipe',
    teamFallback: 'Equipe',
    teamReport: 'Bilan équipe',
    // eslint-disable-next-line max-len
    theMatchIsOverStart: 'Le match est terminé. Commence par enregistrer le score, puis complète les statistiques de ton équipe.',
    // eslint-disable-next-line max-len
    theOfficialScoreChangedAfter: 'Le score officiel a changé après une première saisie. Vérifie les lignes puis republie la bonne version.',
    // eslint-disable-next-line max-len
    theScoreIsReadyPlaying: 'Le score est prêt. Il reste à compléter le temps de jeu et les statistiques clés de ton équipe.',
    toAnswer: 'A répondre',
    toFinalise: 'A finaliser',
    updateAfterOfficialScore: 'Mettre à jour après score officiel',
    yourMatchIsOver: 'Ton match est terminé',
    // eslint-disable-next-line max-len
    yourMatchIsOverEnter: 'Ton match est terminé. Renseigne tes stats individuelles si tu les connais, puis laisse une note sur 10 et ton ressenti.',
    // eslint-disable-next-line max-len
    yourPersonalPostMatchFeedback: 'Ton retour perso post-match est déjà commence. Reprends-le quand tu veux pour finaliser tes stats et ta note.',
  },
  matchStatus: {
    badges: {
      cancelled: 'Annulé',
      confirmedUpcoming: 'À venir',
      disputed: 'Litige',
      forfeit: 'Forfait',
      pendingValidation: 'Validation score',
      postSlotResolution: 'Confirmation match',
      unknown: 'inconnu',
      valid: 'Validé',
      waitingProposal: 'En attente accord',
      waitingScore: 'Score à saisir',
      waitingVenue: 'En attente terrain',
    },
  },
  media: {
    errors: {
      browserRequired: 'Le navigateur est requis pour enregistrer une note vocale.',
      noFilePicker: 'Le navigateur ne supporte pas le sélecteur de fichiers.',
      voiceNoteFailed: 'L enregistrement vocal a échoué.',
      voiceNoteNotAdapted: 'L enregistrement vocal n est pas encore adapte via platform/media.',
      // eslint-disable-next-line max-len
      voiceNoteUnsupported: 'L enregistrement vocal web n est pas pris en charge par ce navigateur.',
    },
  },
  memberLicenseModel: {
    context: {
      cancelled: 'Annulée par le club',
      dueBefore: 'à payer avant le {{dueDate}}',
      manualReview: 'paiement déclaré · le club vérifie',
      noDate: 'aucune date fixée',
      overdue: 'en retard',
      paid: 'soldée',
      partial: '{{paidAmount}} payés sur {{dueAmount}}',
      waived: '{{amount}} offerts par le club',
    },
    fallbacks: {
      campaignTitle: 'Cotisation',
      clubName: 'Ton club',
    },
    months: {
      april: 'avril',
      august: 'août',
      december: 'décembre',
      february: 'février',
      january: 'janvier',
      july: 'juillet',
      june: 'juin',
      march: 'mars',
      may: 'mai',
      november: 'novembre',
      october: 'octobre',
      september: 'septembre',
    },
    overlines: {
      amountCancelled: 'MONTANT ANNULÉ',
      feePaid: 'COTISATION RÉGLÉE',
      leftToPay: 'RESTE À PAYER',
      nothingToPay: 'RIEN À PAYER',
    },
    seasons: {
      unspecified: 'Saison non précisée',
    },
    statusLabels: {
      cancelled: 'Annulée',
      manualReview: 'Déclarée',
      overdue: 'En retard',
      paid: 'Payée',
      partial: 'Partielle',
      pending: 'En attente',
      waived: 'Exemptée',
    },
    totals: {
      clubs_one: '{{count}} club',
      clubs_other: '{{count}} clubs',
      fees_one: '{{count}} cotisation',
      fees_other: '{{count}} cotisations',
      season: 'saison {{season}}',
    },
  },
  memberLicenseSheets: {
    choices: {
      instalmentNumber: 'Échéance {{order}}',
      instalmentOn: "L'échéance du {{dueDate}}",
      nothingLeft: 'Plus rien ne restera à payer',
      payAll: 'Tout solder',
      payMyFee: 'Régler ma cotisation',
      remainingAfter: 'Il restera {{amount}} après',
      totalRemaining: 'Le montant total restant',
    },
    declare: {
      amountOverline: 'MONTANT',
      methodOverline: 'COMMENT',
      submit: 'Envoyer au club',
      subtitle: 'Le club vérifiera avant de mettre ton solde à jour.',
      title: 'Déclarer un paiement',
    },
    pay: {
      confirm: 'Payer {{amount}}',
      methodOverline: 'MOYEN DE PAIEMENT',
      title: 'Payer ma cotisation',
    },
    payer: {
      campaignFallback: 'Cotisation',
      clubFallback: 'Ton club',
      previewOverline: 'CE QUE LA PERSONNE VERRA',
      previewTitle: 'Ta cotisation, et elle seule',
      // eslint-disable-next-line max-len
      privacy: 'Le lien ne montre ni tes autres cotisations, ni ton compte FoundClub, ni tes messages.',
      share: 'Partager le lien',
      subtitle: 'Un parent, un proche, un employeur : la personne paie sans compte FoundClub.',
      title: "Faire payer quelqu'un",
    },
  },
  memberLicenseUi: {
    topBar: {
      back: 'Retour',
      moreOptions: 'Plus d options',
    },
  },
  menu: {
    chat: 'Messagerie',
    home: 'Accueil',
    myClub: 'Mon club',
    myTeams: 'Mes équipes',
    planning: 'Mon planning',
    requests: 'Demandes',
    search: 'Rechercher',
  },
  menuDock: {
    chat: 'Messages',
    home: 'Accueil',
    myClub: 'Club',
    myTeams: 'Équipes',
    planning: 'Planning',
    search: 'Recherche',
  },
  mercatoCard: {
    defaultPosition: 'Joueur',
    openToRecruitment: 'Ouvert au recrutement',
    viewProfile: 'Voir le profil',
  },
  mercatoFilters: {
    alertLabelFallback: 'Recherche',
    alerts: {
      cityRadiusRequired: 'La ville et le rayon sont obligatoires pour créer une alerte',
      created: 'Alerte créée avec succès',
      errorTitle: 'Erreur',
      nameRequired: "Merci de saisir un nom pour l'alerte",
      saveError: "Impossible d'enregistrer l'alerte",
      successTitle: 'Succès',
      updated: 'Alerte modifiée avec succès',
    },
    cancel: 'Annuler',
    createAlert: "Créer l'alerte ★",
    createAlertShort: 'Créer alerte',
    editAlertTitle: "Modifier l'alerte",
    headerTitle: 'Filtres profils',
    placeholders: {
      activity: 'Ex: Football, Tennis...',
      category: 'Ex: U11, U13...',
      position: 'Ex: Attaquant',
      positions: 'Ex: Attaquant, Gardien...',
    },
    previewMatch_one: 'correspond',
    previewMatch_other: 'correspondent',
    previewPrefix: 'Pour le moment,',
    previewProfiles_one: 'profil',
    previewProfiles_other: 'profils',
    saveChanges: 'Enregistrer les modifications',
  },
  messaging: {
    addGroupMembers: 'Ajouter des membres',
    archive: 'Archiver',
    archiveError: "Impossible d'archiver cette conversation.",
    createConversationError: 'Impossible de démarrer cette conversation.',
    errors: {
      cannotMessageSelf: 'Impossible de lancer une conversation avec ton propre compte.',
      failedToCreateConversation: 'Impossible de créer la conversation.',
    },
    filters: {
      all: 'Toutes',
      classic: 'Classique',
      league: 'League',
    },
    loadError: 'Impossible de charger les conversations.',
    loadUsersError: 'Impossible de charger les membres pour cette conversation.',
    noClassicData: 'Aucune conversation classique.',
    noData: 'Aucune conversation trouvée.',
    noLeagueData: 'Aucune conversation League.',
    noSearchResults: 'Aucune conversation trouvée.',
    onboarding: {
      main: 'Recherche une conversation, ouvre un chat et utilise les actions rapides.',
    },
    pinnedBadge: 'ÉPINGLÉ',
    preview: {
      attachment: 'Pièce jointe',
      contactShare: 'Contact partagé',
      eventShare: 'Événement partagé',
      eventShareNamed: 'Événement : {{name}}',
      fallback: 'Nouveau message',
      file: 'Fichier',
      lineupShare: 'Composition publiée',
      lineupShareNamed: 'Composition : {{team}}',
      locationShare: 'Localisation',
      photo: 'Photo',
      poll: 'Sondage',
      pollNamed: 'Sondage : {{question}}',
      proposal: 'Proposition',
      proposalMatch: 'Proposition de match',
      proposalTeam: '{{team}} propose un match',
      proposalWhen: '{{team}} propose un match — {{when}}',
      voiceNote: 'Note vocale',
    },
    searchPlaceholder: 'Rechercher une conversation...',
    searchUserPlaceholder: 'Rechercher un membre...',
    title: 'Messages privés',
    unread: {
      badge: 'Non lu',
    },
  },
  messagingUseCases: {
    conversationName: {
      friendlyMatch: 'Match amical',
      group: 'Groupe',
      leagueMatch: 'Match de Ligue',
      leagueMatchOn: 'Match du {{date}}',
    },
  },
  missingPlayersView: {
    joinModal: {
      confirm: 'Reserver',
    },
    stats: {
      open: 'Réservations ouvertes',
      urgent: '🔥 SOS urgents',
    },
    web: {
      card: {
        clubFallback: 'Club',
        date: 'Date',
        details: 'Voir le detail',
        join: 'Rejoindre',
        joining: 'Participation…',
        lineup: 'Composition',
        pricePerPlayer: '{{price}} EUR / joueur',
        remaining_one: '{{count}} place restante',
        remaining_other: '{{count}} places restantes',
        statusOpen: 'Ouverte',
        statusRecruiting: 'En recherche',
        titleFallback: 'Reservation',
        urgent: 'SOS urgent',
      },
      header: {
        // eslint-disable-next-line max-len
        body: 'Rejoins rapidement les réservations ouvertes qui cherchent encore des joueurs, avec priorité sur les SOS de dernière minute.',
        eyebrow: 'Réservations partagees',
        refresh: 'Rafraîchir',
        seeAll: 'Voir toutes les réservations',
        title: 'Joueurs recherches',
      },
      join: {
        error: 'Impossible de rejoindre cette réservation.',
        success: 'Participation confirmée.',
      },
      loadMore: {
        label: 'Charger plus de réservations',
        loading: 'Chargement…',
      },
      state: {
        // eslint-disable-next-line max-len
        emptyBody: 'Reviens plus tard ou passe par la recherche pour voir toutes les réservations disponibles.',
        emptyTitle: 'Aucune réservation ouverte pour l’instant',
        loadError: 'Impossible de charger les réservations.',
        loading: 'Chargement des reservations…',
      },
      stats: {
        open: 'Réservations ouvertes',
        toFill: 'A pourvoir',
        urgent: 'SOS urgents',
      },
    },
  },
  modals: {
    actions: {
      search: 'Rechercher...',
      select: 'Sélectionner',
    },
    phone: {
      title: 'Sélectionner un pays',
    },
  },
  multisport: {
    accessibility: {
      addSection: 'Ajouter une section',
      addSponsor: 'Ajouter un partenaire',
      callPhone: 'Appeler le club',
      deleteSection: 'Supprimer la section',
      editClub: 'Modifier les informations du club',
      openAdminHint: 'Ouvrir le profil du dirigeant',
      openSectionHint: 'Ouvrir le détail de la section',
      sendEmail: 'Envoyer un email au club',
    },
    actions: {
      addAd: {
        subtitle: 'Publier une annonce de recherche de profil.',
        title: 'Ajouter une annonce',
      },
      addEvent: {
        subtitle: 'Créer un événement pour une section ou une équipe.',
        title: 'Ajouter un événement',
      },
      createSection: {
        title: 'Créer une section',
      },
      licenses: {
        subtitle: 'Piloter les cotisations et paiements de toutes les sections.',
        title: 'Cotisations multisport',
      },
      manageClub: {
        subtitle: 'Modifier les informations et réglages du club.',
        title: 'Gérer mon club',
      },
      requests: {
        subtitle: 'Traiter les demandes en attente de ton organisation.',
        title: 'Demandes',
      },
    },
    badge: 'OMNISPORT',
    createSection: {
      actions: {
        create: 'Créer la section',
        creating: 'Création...',
      },
      activitiesErrorDescription: 'Impossible de charger la liste des sports pour le moment.',
      activitiesErrorTitle: 'Le referentiel des sports est indisponible',
      error: 'Impossible de charger cette structure multisport pour le moment.',
      errorTitle: 'Création indisponible',
      fields: {
        address: {
          label: 'Adresse / Ville *',
          placeholder: 'Rechercher une adresse',
        },
        managerPhone: {
          help: 'Ce numéro sera utilisé pour rattacher le dirigeant à la section.',
          label: 'Numéro du dirigeant (optionnel)',
          placeholder: 'Ex: 0612345678',
        },
        name: {
          label: 'Nom de la section *',
          placeholder: 'Ex: Football, Basketball',
        },
        sport: {
          label: 'Sport',
          noResults: 'Aucun sport ne correspond à ta recherche.',
          placeholder: 'Choisir un sport',
        },
      },
      info: 'Une fois créée, la section pourra accueillir équipes, événements et membres.',
      loading: 'Nous chargeons les informations de ta structure multisport.',
      loadingTitle: 'Chargement de la fiche',
      loadingUser: 'Nous préparons ta structure multisport avant la création de la section.',
      loadingUserTitle: 'Chargement du club',
      notFound: "Cette structure multisport est introuvable ou n'est plus accessible.",
      notFoundTitle: 'Club introuvable',
      subtitle: 'Crée une section sportive pour ton club multisport.',
      title: 'Nouvelle section',
      userError: 'Impossible de retrouver ta structure multisport pour le moment.',
      userErrorTitle: 'Création indisponible',
    },
    deleteSectionConfirm: 'Es-tu sûr de vouloir supprimer la section "{{name}}" ? Cette action est irréversible.',
    deleteSectionTitle: 'Supprimer la section',
    details: {
      error: 'Impossible de charger cette structure multisport pour le moment.',
      errorTitle: 'Club indisponible',
      loading: 'Nous préparons les informations de ta structure multisport.',
      loadingTitle: 'Chargement du club',
      notFound: 'Cette structure multisport est introuvable ou n est plus accessible.',
      notFoundTitle: 'Club introuvable',
    },
    edit: {
      error: 'Impossible de charger cette fiche multisport pour le moment.',
      errorTitle: 'Édition indisponible',
      fields: {
        phone: {
          label: 'Téléphone',
          placeholder: 'Téléphone',
        },
      },
      loading: 'Nous chargeons les informations à modifier.',
      loadingTitle: 'Chargement de la fiche',
      loadingUser: 'Nous préparons les informations de ton club multisport.',
      loadingUserTitle: 'Chargement du club',
      notFound: 'Cette structure multisport est introuvable ou n est plus accessible.',
      notFoundTitle: 'Club introuvable',
      userError: 'Impossible de retrouver ta structure multisport pour le moment.',
      userErrorTitle: 'Édition indisponible',
    },
    empty: {
      admins: 'Aucun dirigeant rattaché.',
      partners: 'Aucun partenaire ajouté.',
      sections: 'Aucune section disponible pour le moment.',
    },
    fallback: {
      error: 'Impossible de charger tes informations multisport pour le moment.',
      errorTitle: 'Club indisponible',
      loading: 'Nous préparons ton espace multisport.',
      loadingTitle: 'Chargement du club',
      noClub: 'Aucun club multisport associé à ce compte.',
      noClubTitle: 'Aucun club multisport',
    },
    featured: {
      error: 'Impossible de charger cette structure multisport pour le moment.',
      errorTitle: 'Demandes indisponibles',
      loading: 'Nous chargeons les informations de ta structure multisport.',
      loadingTitle: 'Chargement des demandes',
      loadingUser: 'Nous préparons les demandes à la une de ta structure multisport.',
      loadingUserTitle: 'Chargement du club',
      notFound: "Cette structure multisport est introuvable ou n'est plus accessible.",
      notFoundTitle: 'Club introuvable',
      userError: 'Impossible de retrouver ta structure multisport pour le moment.',
      userErrorTitle: 'Demandes indisponibles',
    },
    formErrors: {
      addressRequired: "L'adresse est obligatoire.",
      clubRequired: 'Impossible de retrouver le club multisport.',
      generic: 'Une erreur est survenue lors de la création de la section.',
      sectionNameRequired: 'Le nom de la section est obligatoire.',
    },
    hero: {
      summary: 'Vue globale du club multisport et de ses sections.',
    },
    labels: {
      members: 'membres',
      teams: 'équipes',
    },
    members: {
      empty: 'Aucun membre trouve pour le moment.',
      emptyFiltered: 'Aucun membre ne correspond à ces filtres.',
      error: 'Impossible de charger cette structure multisport pour le moment.',
      errorTitle: 'Membres indisponibles',
      loading: 'Nous chargeons les informations de ta structure multisport.',
      loadingTitle: 'Chargement des membres',
      loadingUser: 'Nous préparons les membres de ta structure multisport.',
      loadingUserTitle: 'Chargement du club',
      noSection: 'Section non renseignée',
      notFound: "Cette structure multisport est introuvable ou n'est plus accessible.",
      notFoundTitle: 'Club introuvable',
      userError: 'Impossible de retrouver ta structure multisport pour le moment.',
      userErrorTitle: 'Club indisponible',
    },
    planning: {
      error: 'Impossible de charger cette structure multisport pour le moment.',
      errorTitle: 'Planning indisponible',
      loading: 'Nous chargeons les informations de ta structure multisport.',
      loadingTitle: 'Chargement du planning',
      loadingUser: 'Nous préparons le planning de ta structure multisport.',
      loadingUserTitle: 'Chargement du club',
      notFound: "Cette structure multisport est introuvable ou n'est plus accessible.",
      notFoundTitle: 'Club introuvable',
      userError: 'Impossible de retrouver ta structure multisport pour le moment.',
      userErrorTitle: 'Planning indisponible',
    },
    sectionCreated: 'La section a été créée avec succès.',
    sectionCreatedMessage: 'La section "{{name}}" a été créée avec succès.',
    sectionCreatedTitle: 'Section créée',
    sectionDeleted: 'La section a été supprimée avec succès.',
    stats: {
      admins: 'Dirigeants',
      members: 'Membres',
      sections: 'Sections',
      teams: 'Équipes',
    },
    teams: {
      empty: 'Aucune équipe trouvée pour le moment.',
      emptyFiltered: 'Aucune équipe ne correspond à ces filtres.',
      error: 'Impossible de charger cette structure multisport pour le moment.',
      errorTitle: 'Équipes indisponibles',
      loading: 'Nous chargeons les informations de ta structure multisport.',
      loadingTitle: 'Chargement des équipes',
      loadingUser: 'Nous préparons les équipes de ta structure multisport.',
      loadingUserTitle: 'Chargement du club',
      noSection: 'Section non renseignée',
      notFound: "Cette structure multisport est introuvable ou n'est plus accessible.",
      notFoundTitle: 'Club introuvable',
      userError: 'Impossible de retrouver ta structure multisport pour le moment.',
      userErrorTitle: 'Club indisponible',
    },
    titles: {
      admins: 'Dirigeants omnisport',
      partners: 'Partenaires',
      quickActions: 'Actions rapides',
      sections: 'Mes sections',
    },
    tutorial: {
      mainDescription: 'Gère tes sections, tes membres et tes actions rapides depuis un seul écran.',
      mainTitle: 'Gestion multisport',
    },
  },
  multisportClubEditDetails: {
    fields: {
      address: {
        label: 'Adresse / Ville',
        placeholder: 'Rechercher une adresse...',
      },
      email: {
        label: 'Email',
        placeholder: 'Email',
      },
      name: {
        label: 'Nom du club',
        placeholder: 'Nom du club',
      },
    },
  },
  multiTeamCompositionBoard: {
    add: 'Ajouter',
    addPlayer: 'Ajouter un joueur',
    addTeam: 'Ajouter une équipe',
    allPlayersAssigned: 'Tous les joueurs sont déjà affectes a une équipe.',
    assigned: 'Attribue',
    // eslint-disable-next-line max-len
    autoGenerated: 'Brouillon génère automatiquement. Tu peux maintenant ajuster les équipes à la main.',
    autoGenerateError: 'Impossible de générer cette composition automatiquement.',
    autoGeneration: 'Génération auto',
    automaticGeneration: 'Génération automatique',
    autoPlusManual: 'Auto + manuel',
    autoSetupHint: "Choisis le nombre d'équipes et le preset de chacune, puis génère un brouillon.",
    availablePlayers: 'Joueurs disponibles',
    branchCountPill: '{{branchCount}} branche(s)',
    branchNumber: 'Branche {{number}}',
    calledUp: 'Convoqué',
    cancel: 'Annuler',
    clear: 'Effacer',
    closeAuto: 'Fermer auto',
    coachNotPublished: 'Le coach n a pas encore publie de composition pour cet événement.',
    convokedCount: '{{convokedCount}} joueur(s) convoqué(s) sur {{total}}',
    // eslint-disable-next-line max-len
    convokeHint: "Coche les joueurs que tu convoques. Tu les placeras sur le terrain à l'étape suivante.",
    delete: 'Supprimer',
    // eslint-disable-next-line max-len
    deleteTeamMessage: 'Les joueurs déjà places dans cette équipe repasseront automatiquement dans les remplaçants.',
    deleteTeamQuestion: 'Supprimer cette équipe ?',
    draftSaved: 'Brouillon de composition enregistre.',
    draftSaveError: "Impossible d'enregistrer ce brouillon.",
    // eslint-disable-next-line max-len
    dragHint: 'Fais glisser un joueur des remplaçants vers le terrain : appui long, puis tu le déposes où tu veux. Tu peux aussi le sélectionner puis toucher un poste.',
    event: 'Evenement',
    external: 'Externe',
    firstNameRequired: 'Prénom *',
    freeLineup: 'Composition libre',
    generateDraft: 'Générer le brouillon',
    lastNameRequired: 'Nom *',
    leftOut: 'Écarté',
    limitReached: 'Limite atteinte',
    lineupPublished: "Composition d'équipes publiée.",
    manual: 'Manuel',
    maxTeams: "Tu peux créer jusqu'a {{max}} équipes dans une même composition.",
    myTeam: 'Mon équipe',
    nameRequired: 'Prénom et nom requis.',
    next: 'Suivant',
    noLineupPublished: 'Aucune composition publiée',
    // eslint-disable-next-line max-len
    noPlayerAvailableHint: 'Aucun joueur disponible pour le moment. Ajoute-les à la main avec « Ajouter un joueur », ou passe à la suite et laisse les postes libres.',
    // eslint-disable-next-line max-len
    noPlayerCreateTeamsHint: 'Aucun joueur disponible pour le moment. Tu peux quand même créer les équipes et laisser les postes libres.',
    noPreset: 'Aucun preset',
    noPresetForSport: "Aucun preset n'est disponible pour ce sport. Passe en mode manuel.",
    notAllowed: "Tu n'es pas autorise à gérer cette composition.",
    noUnassignedPlayer: 'Aucun joueur non affecte.',
    numberOptional: 'Numéro (optionnel)',
    oneTeamMustRemain: 'Il doit rester au moins une équipe dans cette composition.',
    // eslint-disable-next-line max-len
    openPositionsHint: 'Les postes encore libres peuvent rester vides: ils seront completes automatiquement quand de nouveaux joueurs acceptes arriveront.',
    openSlot: 'Libre',
    // eslint-disable-next-line max-len
    openSpotsHint: 'Les places encore libres restent visibles et seront complétées automatiquement quand de nouveaux joueurs acceptes arriveront.',
    playerSelectedHint: "{{player}} est sélectionné. Touche maintenant un poste pour l'affecter.",
    position: 'Poste',
    preset: 'Preset',
    presetRequired: 'Preset requis',
    publication: 'Publication',
    publish: 'Publier',
    publishedOn: 'Publie le {{date}}',
    publishError: 'Impossible de publier cette composition.',
    removeShort: 'Suppr.',
    save: 'Sauvegarder',
    selectAll: 'Tout sélectionner',
    step1Of2: 'Étape 1 sur 2',
    step2Of2: 'Étape 2 sur 2',
    substitutes: 'Remplaçants / en attente',
    tapPlayerHint: 'Touche un joueur pour le sélectionner, puis touche un poste sur une équipe.',
    teamCountPill: '{{teamCount}} equipe(s)',
    teamLineup: "Composition d'équipes",
    teamLineupPublished: "Composition d'équipes publiée",
    teamNumber: 'Équipe {{number}}',
    teamRequired: 'Équipe requise',
    teamSource: 'Equipe',
    teamsUnit: 'équipes',
    whereTheyPlay: 'Où ils jouent',
    whoPlays: 'Qui joue ?',
    youAreInReserve: 'Tu figures actuellement dans les remplacants / en attente.',
  },
  multiTeamCompositionUtils: {
    team: 'Équipe {{number}}',
    team1: 'Équipe 1',
    teamFallback: 'Equipe',
  },
  myActivitiesFeed: {
    applicant: 'Candidat',
    applicationCount_one: '{{count}} candidature',
    applicationCount_other: '{{count}} candidatures',
    coachRole: 'Rôle entraîneur',
    friendlyMatch: 'Match amical',
    hosting: {
      away: 'Se déplace',
      both: 'Reçoit ou se déplace',
      host: 'Reçoit',
    },
    positionUnspecified: 'Poste non spécifié',
    proposal: {
      aTeam: 'Une équipe',
      on: 'sur {{target}}',
      title: '{{team}} propose un match',
      yourMatch: 'ton match proposé',
    },
    proposalCount_one: '{{count}} proposition',
    proposalCount_other: '{{count}} propositions',
    sections: {
      friendly_one: 'Matchs amicaux · {{count}} match proposé',
      friendly_other: 'Matchs amicaux · {{count}} matchs proposés',
      receivedApplications: 'Candidatures reçues · {{total}}',
      receivedProposals: 'Propositions reçues · {{total}}',
      recruitment_one: 'Recrutement · {{count}} offre',
      recruitment_other: 'Recrutement · {{count}} offres',
      sentApplications: 'Candidatures envoyées · {{total}}',
      sentProposals: 'Propositions envoyées · {{total}}',
    },
    sentStatus: {
      accepted: 'Acceptée',
      declined: 'Refusée',
      pending: 'En attente',
      rejected: 'Refusée',
      withdrawn: 'Retirée',
    },
  },
  myActivitiesScreen: {
    empty: {
      // eslint-disable-next-line max-len
      publicationsBody: 'Publie une offre ou un match amical depuis Rechercher : tu les géreras ici.',
      publicationsTitle: 'Tu n’as encore rien publié.',
      responsesBody: 'Dès qu’on répondra à ce que tu as publié, tu le verras ici.',
      responsesTitle: 'Aucune réponse pour le moment.',
    },
    item: {
      new: 'Nouveau',
      offline: 'Hors ligne',
      online: 'En ligne',
    },
    tabs: {
      myResponses: 'Mes réponses',
      publications: 'Publications',
      receivedResponses: 'Réponses reçues',
    },
    title: 'Mes activités',
    unreachable: {
      description: 'Vérifie ta connexion, puis réessaie.',
      retry: 'Réessayer',
      title: 'On n’arrive pas à joindre le serveur.',
    },
  },
  myEventList: {
    actions: {
      closeTimeFilter: 'Valider',
    },
    fields: {
      timeFilter: {
        next: 'Mes prochains événements',
        past: 'Mes événements passés',
        selectDate: 'Sélectionner une date',
      },
      type: {
        all: 'Tous',
      },
    },
  },
  myLicenseDetail: {
    actions: {
      paidOutsideApp: "J'ai payé hors app",
      payAmount: 'Payer {{amount}}',
      writeToClub: 'Écrire au club',
    },
    alerts: {
      campaignPaused: {
        message: 'Cette campagne est suspendue. Le paiement reprendra quand le club la rouvrira.',
        title: 'Campagne en pause',
      },
      declarationFailed: {
        message: 'Le club n a pas pu être prévenu.',
        title: 'Déclaration impossible',
      },
      declarationSent: {
        // eslint-disable-next-line max-len
        message: 'Ton solde ne bouge pas tant que le club n a pas vérifié. Tu peux corriger en attendant.',
        title: 'Déclaration envoyée',
      },
      documentSent: {
        message: 'Le club pourra maintenant la vérifier.',
        title: 'Pièce envoyée',
      },
      documentUnavailable: {
        message: 'Aucun fichier exploitable n est rattaché à ce dépôt.',
        title: 'Document indisponible',
      },
      downloadFailed: {
        document: 'Le document n a pas pu être enregistré sur ton téléphone.',
        template: 'Le modèle n a pas pu être enregistré sur ton téléphone.',
        title: 'Téléchargement impossible',
      },
      linkUnavailable: {
        message: 'Le lien de paiement sera disponible après génération par le club.',
        title: 'Lien indisponible',
      },
      paymentUnavailable: {
        message: 'Aucun lien de paiement configuré.',
        title: 'Paiement indisponible',
      },
      receiptGenerated: {
        message: 'Ton reçu est maintenant disponible sur ce paiement.',
        title: 'Reçu généré',
      },
      shareUnavailable: {
        message: 'Impossible de partager le lien depuis ce navigateur.',
        title: 'Partage indisponible',
      },
      templateUnavailable: {
        message: 'Le club n a pas encore déposé de modèle pour cette pièce.',
        title: 'Modèle indisponible',
      },
      uploadFailed: {
        message: 'La pièce n a pas pu être envoyée.',
        title: 'Envoi impossible',
      },
    },
    amountCard: {
      context: {
        cancelled: 'Annulée par le club',
        none: 'Aucun paiement pour l’instant',
        paid: '{{dueLabel}} réglés',
        partial: '{{paidLabel}} déjà payés sur {{dueLabel}}',
        waived: 'Cotisation de {{dueLabel}} offerte par le club',
      },
      footer: {
        cancelled: 'Cette cotisation a été annulée par le club.',
        dueBefore: 'À payer avant le {{nextDate}}',
        nextAmount: '{{amount}} le {{nextDate}}',
        noDate: 'Le club n a pas encore fixé de date. Tu peux payer dès maintenant.',
        receiptPending: 'Reçu en attente du club.',
        waived: 'Le club prend cette cotisation à sa charge.',
      },
    },
    campaign: {
      rows: {
        amount: 'Montant',
        campaign: 'Campagne',
        club: 'Club',
        deadline: 'Date limite',
        section: 'Section',
      },
      title: 'La campagne',
    },
    contact: {
      state: 'Un délai, une aide, une erreur de montant : ça se règle en parlant.',
      title: 'Une question ?',
    },
    dossier: {
      complete: 'Dossier complet',
      documentsCount_one: '{{count}} pièce',
      documentsCount_other: '{{count}} pièces',
      documentsReceived_one: '{{count}} pièce reçue',
      documentsReceived_other: '{{count}} pièces reçues',
      licence: {
        availableSince: 'Disponible depuis le {{date}}',
        clubUpload: 'dépôt du club',
        download: 'Télécharger ma licence',
        notUploaded: 'Le club ne l a pas encore déposée.',
        open: 'Ouvrir ma licence',
        titleFallback: 'Ma licence',
      },
      licenceValidated: 'Licence validée',
      request: {
        download: 'Télécharger le document',
        downloadTemplate: 'Télécharger le modèle',
        dueBefore: ' · à remettre avant le {{dueDate}}',
        open: 'Ouvrir le document',
        optional: 'Facultatif',
        replace: 'Remplacer ma pièce',
        required: 'Obligatoire',
        sent: 'Envoyée · le club vérifie',
        titleFallback: 'Pièce demandée',
        upload: 'Déposer',
        validated: 'Validée par le club',
      },
      title: 'Mon dossier',
    },
    header: {
      title: 'Ma cotisation',
    },
    help: {
      // eslint-disable-next-line max-len
      instalments: 'Ta cotisation est fixée par ton club. Si elle se paie en plusieurs fois, chaque échéance a sa date : tu règles celle qui arrive, ou tu soldes tout.',
      // eslint-disable-next-line max-len
      paidOutsideApp: 'Si tu as payé en espèces, par chèque ou par virement, dis-le avec « J ai payé hors app ». Ton solde ne bougera qu une fois le club passé.',
      // eslint-disable-next-line max-len
      receipts: 'Chaque paiement encaissé porte son reçu. Les saisons terminées restent consultables : un reçu se retrouve indéfiniment.',
      title: 'Comment ça marche',
    },
    installments: {
      hint: '{{instalmentCount}} échéances · {{dueLabel}}',
      itemFallback: 'Échéance {{order}}',
      payAll: 'Tout solder — {{remainingLabel}}',
      states: {
        declared: 'Déclarée · le club vérifie',
        due: 'À payer',
        late: 'En retard',
        paid: 'Payée',
        upcoming: 'À venir',
      },
      title: 'Échéancier',
    },
    loading: {
      description: 'On récupère ta cotisation.',
      title: 'Chargement',
    },
    menu: {
      allFees: 'Toutes mes cotisations',
      paidOutsideApp: 'J’ai payé hors app',
      someonePays: 'Quelqu’un paie pour moi',
    },
    notFound: {
      action: 'Voir mes cotisations',
      description: 'Cette cotisation n est pas disponible pour ton compte.',
      title: 'Cotisation introuvable',
    },
    onlineMethods: {
      clubLink: 'Lien du club',
    },
    paused: {
      state: 'Les paiements reprendront quand le club rouvrira la campagne.',
      title: 'Campagne temporairement suspendue',
    },
    payments: {
      receiptNumber: 'reçu {{receiptNumber}}',
      receiptPending: 'reçu en attente du club',
      receiptsAvailable: '{{receiptCount}} reçus disponibles sur cette cotisation.',
      title: 'Paiements',
      titleFallback: 'Paiement',
    },
    receipt: {
      download: 'Télécharger le reçu',
      generate: 'Générer mon reçu',
    },
    reminders: {
      channels: {
        email: 'e-mail',
        notification: 'notification',
      },
      item: 'Relance du club',
      title: 'Relances du club',
    },
    share: {
      message: 'Paiement cotisation FoundClub: {{payerLink}}',
    },
  },
  myLicenses: {
    archive: {
      allPaid: ' — tout est payé',
      count_one: '{{count}} saison archivée',
      count_other: '{{count}} saisons archivées',
      title: 'Saisons passées',
    },
    card: {
      instalments_one: '{{count}} échéance',
      instalments_other: '{{count}} échéances',
    },
    empty: {
      description: 'Aucune cotisation n est encore rattachée à ton compte.',
    },
    error: {
      description: 'Impossible de charger tes cotisations pour le moment.',
      retry: 'Réessayer',
      title: 'Cotisations indisponibles',
    },
    group: {
      upToDate: 'à jour',
    },
    title: 'Mes cotisations',
    total: {
      overdue_one: '{{count}} cotisation en retard',
      overdue_other: '{{count}} cotisations en retard',
      settled: 'tout est réglé',
      toPay: 'à payer en tout',
    },
  },
  myLicensesArchive: {
    alerts: {
      downloadFailed: {
        fallback: 'Le reçu n a pas pu être enregistré sur ton téléphone.',
        title: 'Téléchargement impossible',
      },
      receiptUnavailable: {
        message: 'Aucun fichier n est rattaché à ce reçu.',
        title: 'Reçu indisponible',
      },
    },
    empty: {
      description: 'Tes saisons terminées apparaîtront ici, avec leurs reçus.',
      title: 'Aucune saison archivée',
    },
    // eslint-disable-next-line max-len
    footer: 'Une saison archivée ne demande rien : elle sert à retrouver un reçu, et il reste téléchargeable indéfiniment.',
    loading: {
      description: 'On récupère tes anciennes saisons.',
      title: 'Chargement',
    },
    row: {
      downloadReceipt: 'Télécharger le reçu',
      settled: 'soldée',
      settledOn: 'soldée le {{settledOn}}',
    },
    title: 'Saisons passées',
  },
  myTeamList: {

    title: 'Mes équipes',
    tutorial: {
      description: "Retrouve tes équipes, les demandes en attente et l'accès aux détails.",
      title: 'Mes équipes',
    },
  },
  newConversation: {
    sections: {
      coaches: 'Entraîneurs',
      managers: 'Dirigeants',
      others: 'Autres',
      players: 'Joueurs',
    },
  },
  nextMatchCard: {
    alerts: {
      absenceNoted: 'Absence notée.',
      attendanceConfirmed: 'Présence confirmée !',
      bookingError: 'Impossible de confirmer la réservation',
      confirmError: 'Impossible de confirmer',
      declineError: 'Impossible de decliner',
      errorTitle: 'Erreur',
      eventNotFound: 'Événement introuvable',
      notedTitle: 'Noté',
      successTitle: 'Succès',
      userNotFound: 'Utilisateur introuvable',
      venueBookedBody: 'Le terrain est confirmé !',
      venueBookedTitle: 'Terrain Réservé ✅',
    },
    attendanceTitle: 'Presences joueurs confirmees (',
    badges: {
      disputed: 'LITIGE',
      scorePending: 'SCORE EN ATTENTE',
      upcoming: 'À venir',
      waitingVenue: 'EN ATTENTE TERRAIN',
    },
    cancel: {
      body: '{{penaltyMessage}}\n\nCette action est irréversible.',
      cancelled: 'Match Annulé',
      cancelledBody: 'Le match a été annulé.',
      cancelledWithPenalty: 'Match Annulé ⚠️',
      error: "Impossible d'annuler le match",
      no: 'Non',
      title: 'Annuler le match ?',
      yesCancel: 'Oui, annuler',
      yesForfeit: 'Oui, forfait',
    },
    matchLabel: '{{myTeamName}} VS {{opponentName}}',
    mySquadFallback: 'Ta squad',
    mysteryOpponent: 'Adversaire Mystère',
    opponentFallback: 'Adversaire',
    quorum: {
      missing: 'Minimum requis: {{requiredPlayers}} joueurs. Il manque {{missingCount}} joueur(s).',
      reached: 'Quorum atteint. Équipe prête.',
    },
    steps: {
      confirmed: 'Confirmé',
      found: 'Trouvé',
      played: 'Match joué',
      result: 'Résultat',
      venueBooked: 'Terrain réservé',
    },
    title: 'PROCHAIN MATCH',
    venueToBeDecided: 'Lieu à définir',
    viewMatch: 'Voir le match',
  },
  notificationBackgroundHandler: {
    defaultBody: 'Réponds rapidement : present ou absent.',
    defaultTitle: 'Rappel événement',
  },
  notificationBootstrap: {
    calendar: {
      add: 'Ajouter au calendrier',
    },
    later: 'Plus tard',
    push: {
      enable: 'Activer',
      supporting: 'Tu pourras toujours modifier ce choix plus tard dans les réglages.',
    },
  },
  notificationList: {
    delete: {
      cancel: 'Annuler',
      confirm: 'Supprimer cette notification ?',
      title: 'Supprimer',
    },
    empty: {
      body: 'Les nouvelles notifications apparaîtront ici.',
      title: 'Aucune notification',
    },
    errors: {
      delete: 'Impossible de supprimer la notification.',
      eventNotFound: "Impossible de retrouver l'événement associe à cette notification.",
      markAll: 'Impossible de marquer toutes les notifications comme lues.',
      markRead: 'Impossible de marquer la notification comme lue.',
      markReadShort: 'Impossible de marquer comme lu.',
      rsvp: "Impossible d'enregistrer ta réponse.",
    },
    markAll: 'Tout lire',
    rsvp: {
      absent: 'Absence enregistrée.',
      present: 'Présence enregistrée.',
    },
    sections: {
      older: 'Plus ancien',
      thisWeek: 'Cette semaine',
      today: "Aujourd'hui",
      yesterday: 'Hier',
    },
  },
  notificationPopup: {
    close: 'Fermer les notifications',
    defaultTitle: 'Notification',
    empty: {
      body: 'Les nouvelles notifications apparaîtront ici.',
      title: 'Aucune notification',
    },
    errors: {
      markAll: 'Impossible de marquer toutes les notifications.',
      markRead: 'Impossible de marquer comme lu.',
    },
    loading: 'Chargement des notifications...',
    markAll: 'Tout lire',
    title: 'Notifications',
    viewAll: 'Voir toutes les notifications',
  },
  notificationPresentation: {
    relative: {
      days: 'Il y a {{value}} j',
      hours: 'Il y a {{value}} h',
      minutes: 'Il y a {{value}} min',
      now: "A l'instant",
    },
  },
  notifications: {
    details: {
      bodyFallback: 'Aucun detail disponible.',
      loadError: 'Impossible de charger cette notification.',
      notFound: 'Notification introuvable.',
      participationDeclined: {
        actions: {
          viewEvent: "Voir l'événement",
        },
        eventFallback: 'Événement indisponible',
        labels: {
          decisionDate: 'Date de décision',
          event: 'Événement',
          reason: 'Motif',
          status: 'Statut',
        },
        reasonFallback: "Aucun motif précisé par l'organisateur.",
        screenTitle: 'Détail notification',
        statusDeclined: 'Demande refusée',
        subtitle: 'Ta demande de participation a été refusée.',
        title: 'Demande refusée',
        unknownDate: 'Date indisponible',
      },
      screenTitle: 'Notification',
      statusFallback: 'Information',
      title: 'Notification',
    },
    labels: {
      participationDeclined: 'Refusée',
    },
    title: 'Notifications',
  },
  onboarding: {
    actions: {
      skipStep: 'Passer cette étape',
    },
    category: {
      subtitle: 'La catégorie d\'âge dans laquelle tu joues cette saison.',
      title: 'Ta catégorie ?',
    },
    clubSearch: {
      editableLater: 'Modifiable à tout moment depuis Mon profil.',
      privateHelp: 'Ton profil n\'apparaît dans aucune recherche '
        + '— seuls tes coéquipiers te voient.',
      privateLabel: 'Profil privé',
      subtitle: 'Les clubs et entraîneurs peuvent-ils te trouver ?',
      title: 'Visibilité de ton profil',
      visibleHelp: 'Les clubs et entraîneurs peuvent te trouver '
        + 'et te contacter pour te recruter.',
      visibleLabel: 'Profil visible',
    },
    history: {
      subtitle: 'Raconte-nous brièvement tes expériences passées (Clubs, niveaux, postes...)',
      title: 'Ton parcours sportif',
    },
    level: {
      subtitle: 'Le plus haut niveau auquel tu as joué — facultatif.',
      title: 'Ton meilleur niveau ?',
    },
    optionalStepHint: 'Cette étape n\'est pas obligatoire, mais elle reste utile pour améliorer ton expérience FoundClub.',
    physique: {
      heightLabel: 'Taille (cm)',
      privacyNotice: 'Visible uniquement si ton profil est public.',
      subtitle: 'Facultatif — ces infos aident les recruteurs.',
      title: 'Ton physique',
      weightLabel: 'Poids (kg)',
    },
    position: {
      subtitle: 'Sélectionne tes postes de prédilection',
      title: 'Quel(s) poste(s) ?',
    },
    sport: {
      subtitle: 'Choisis ton sport de préférence',
      title: 'Quel est ton sport ?',
    },
    trainedTeams: {
      alreadyRequested: 'Demande déjà envoyée',
      createFirst: 'Créer ma première équipe',
      // eslint-disable-next-line max-len
      empty: "Aucune équipe n'est encore déclarée dans ton club. Crée la première : tu en seras l'entraîneur·e.",
      errorMessage: "Impossible d'envoyer ta demande pour le moment. Réessaie dans un instant.",
      errorTitle: 'Demande non envoyée',
      submit: 'Envoyer ma demande ({{count}})',
      subtitle: 'Sélectionne-les toutes : une demande part au club pour chacune.',
      title: 'Quelles équipes entraînes-tu ?',
    },
  },
  onboardingAffiliation: {
    a11y: {
      askForHelpHint: 'Envoie une demande aux superadmins FoundClub.',
      backHint: 'Revient à l\'étape précédente de l\'onboarding.',
      cardHintClub: 'Ouvre la fiche du club pour confirmer l\'affiliation.',
      cardHintClubSelect: 'Sélectionne ce club pour voir ses équipes.',
      cardHintTeam: "Ouvre la fiche de l'équipe pour demander à rejoindre.",
      cardLabelClub: 'Ouvrir la fiche du club {{name}}',
      cardLabelClubSelect: 'Sélectionner le club {{name}}',
      cardLabelTeam: "Ouvrir la fiche de l'équipe {{name}}",
      continueLaterHint: 'Passe cette étape et continue l\'onboarding.',
      filterHint: 'Ouvre les filtres de recherche de club.',
      filterLabel: 'Ouvrir les filtres',
      modalCancelHint: 'Ferme la fenêtre de demande.',
      modalCommentHint: 'Ajoute des informations utiles à la recherche.',
      modalNameHintClub: 'Renseigne le nom du club que tu recherches.',
      modalNameHintTeam: "Renseigne le nom de l'équipe que tu recherches.",
      modalSendHint: 'Envoie ta demande aux superadmins.',
      nearbyHint: 'Autorise la localisation pour classer les clubs par distance.',
      notFoundHintClub: 'Envoie une demande d\'aide si ton club est introuvable.',
      notFoundHintTeam: 'Envoie une demande d\'aide si ton équipe est introuvable.',
      retryHint: 'Relance la recherche de résultats.',
      searchInputHintClub: 'Saisis le nom du club pour filtrer la liste.',
      searchInputHintTeam: "Saisis le nom de l'équipe pour filtrer la liste.",
      searchInputLabelClub: 'Champ nom du club',
      searchInputLabelTeam: "Champ nom de l'équipe",
      sportChipHint: 'Filtre la liste sur ton sport.',
      tooltipNextHint: 'Passe à l étape suivante du tutoriel.',
      tooltipPreviousHint: 'Revient à l\'étape précédente du tutoriel.',
      tooltipSkipHint: 'Quitte le tutoriel guide.',
    },
    actions: {
      askForHelp: 'Besoin d\'aide ? Nous contacter',
      changeClub: 'Changer de club',
      continueLater: 'Continuer plus tard',
      notFoundClub: 'Je ne trouve pas mon club',
      notFoundTeam: 'Je ne trouve pas mon équipe',
      skip: 'Passer',
    },
    addClub: {
      action: 'Ajouter',
      subtitle: 'Ajoute-le en 2 minutes, on s\'occupe du reste.',
      title: 'Ton club n\'est pas là ?',
    },
    addTeam: {
      subtitle: 'Signale-la, on s\'occupe du reste.',
      title: 'Ton équipe n\'est pas là ?',
    },
    chips: {
      nearby: 'Autour de moi',
    },
    common: {
      roleTargetClub: 'club',
      roleTargetTeam: 'équipe',
    },
    feedback: {
      missingInfoMessageClub: 'Renseigne le nom du club recherché.',
      missingInfoMessageTeam: "Renseigne le nom de l'équipe recherchée.",
      missingInfoTitle: 'Information manquante',
      // eslint-disable-next-line max-len
      nearbyDenied: "Localisation refusée : la liste reste triée par suggestions. Tu peux l'autoriser dans les réglages de ton téléphone.",
      // eslint-disable-next-line max-len
      nearbyUnavailable: "La localisation n'est pas disponible sur cet appareil. La liste reste triée par suggestions.",
      requestError: 'Impossible d\'envoyer ta demande.',
      requestSentDescription: 'Ta demande a été envoyée aux superadmins. Tu recevras une notification.',
      requestSentTitle: 'Demande envoyée',
    },
    filtersTutorial: {
      activityDescription: 'Sélectionne un sport pour filtrer uniquement les clubs correspondants.',
      activityTitle: 'Sport',
      applyDescription: 'Applique tes filtres pour revenir à la liste avec des résultats plus précis.',
      applyTitle: 'Appliquer',
      cityDescription: 'Choisis une ville ou une adresse pour centrer la recherche des clubs.',
      cityTitle: 'Localisation',
      radiusDescription: 'Ajuste le rayon en kilomêtres autour de ta localisation.',
      radiusTitle: 'Rayon de recherche',
    },
    modal: {
      commentLabel: 'Commentaire (optionnel)',
      commentPlaceholder: 'Ex: ville, catégorie, orthographe probable...',
      description: 'Donne un maximum de contexte pour aider les superadmins.',
      nameLabelClub: 'Nom du club recherché *',
      nameLabelTeam: "Nom de l'équipe recherchée *",
      namePlaceholderClub: 'Ex: Olympique ...',
      namePlaceholderTeam: 'Ex: U17 Nationaux ...',
      send: 'Envoyer',
      titleClub: 'Je ne trouve pas mon club',
      titleTeam: 'Je ne trouve pas mon équipe',
    },
    results: {
      openClubFallback: 'Voir fiche club',
      openTeamFallback: 'Voir fiche équipe',
    },
    search: {
      filtersActive_one: '{{count}} filtre actif',
      filtersActive_other: '{{count}} filtres actifs',
      placeholderClub: 'Nom du club ou ville',
      placeholderTeam: "Nom de l'équipe",
    },
    sections: {
      nearby: 'PRÈS DE CHEZ TOI',
      results: 'RÉSULTATS',
      suggestions: 'SUGGESTIONS',
      teams: 'ÉQUIPES',
    },
    selectedClubLabel: 'Club sélectionné',
    staffManagementNotice: 'Ta demande de gestion sera envoyée aux dirigeants du club '
      + '— s\'il n\'en a pas encore, tu pourras le revendiquer et le faire certifier.',
    states: {
      emptyWithoutQueryClub: 'Aucun club à afficher pour le moment.',
      emptyWithoutQueryTeam: 'Aucune équipe à afficher pour le moment.',
      emptyWithQueryClub: 'Aucun club trouvé pour "{{query}}".',
      emptyWithQueryTeam: 'Aucune équipe trouvée pour "{{query}}".',
      errorSubtitle: 'Vérifie ta connexion puis réessaie.',
      errorTitle: 'Impossible de charger les résultats',
      loading: 'Recherche en cours...',
      retry: 'Réessayer',
    },
    subtitleClub: 'On personnalise ton accueil, ton planning et tes annonces autour de ton club.',
    subtitleClubCoach: 'Retrouve ton club pour y déclarer les équipes que tu entraînes.',
    subtitleClubSelection: 'Recherche puis sélectionne ton club pour voir ses équipes.',
    subtitleClubStaff: 'Retrouve ton club pour le gérer sur FoundClub.',
    subtitleTeam: 'Recherche ton équipe puis ouvre sa fiche pour envoyer ta demande.',
    subtitleTeamFromClub: 'Recherche ton équipe dans le club sélectionné puis ouvre sa fiche pour envoyer ta demande.',
    teamNotCreated: {
      coachContactHint: 'Indique un téléphone ou un e-mail pour joindre ton coach.',
      coachContactLabel: 'Contact du coach (téléphone ou e-mail)',
      coachContactPlaceholder: 'Ex: 06 12 34 56 78 ou coach@club.fr',
      coachNameHint: 'Indique le nom de ton coach ou dirigeant.',
      coachNameLabel: 'Nom de ton coach ou dirigeant',
      coachNamePlaceholder: 'Ex: Karim Benali',
      // eslint-disable-next-line max-len
      description: "Tu ne peux pas encore rejoindre : ce sera possible dès que le club ou ton coach aura créé l'équipe sur FoundClub. Laisse le contact de ton coach ou dirigeant, on l'invite à la créer.",
      // eslint-disable-next-line max-len
      missingCoach: "Renseigne au moins le nom ou le contact de ton coach pour qu'on puisse l'inviter.",
      send: 'Envoyer au club',
      sendHint: 'Envoie le contact de ton coach aux superadmins FoundClub.',
      title: "Ce club n'a pas encore d'équipe sur FoundClub",
      unknownClub: 'Club sans équipe',
    },
    titleClub: 'Trouve ton club',
    titleTeam: 'Trouve ton équipe',
    tutorial: {
      stepFiltersDescription: 'On va maintenant ouvrir les filtres pour affiner ta recherche.',
      stepFiltersTitle: 'Ouvrir les filtres',
      stepNotFoundDescriptionClub: 'Si tu ne trouves pas ton club, envoie une demande guidée aux superadmins.',
      stepNotFoundDescriptionTeam: 'Si tu ne trouves pas ton équipe, envoie une demande guidée aux superadmins.',
      stepNotFoundTitleClub: 'Je ne trouve pas mon club',
      stepNotFoundTitleTeam: 'Je ne trouve pas mon équipe',
      stepResultDescriptionClub: "Ouvre la fiche du club pour utiliser le bouton C'est mon club.",
      stepResultDescriptionClubSelect: 'Sélectionne ton club pour afficher ensuite ses équipes.',
      stepResultDescriptionTeam: "Ouvre la fiche de l'équipe pour envoyer ta demande de rejoindre.",
      stepResultTitleClub: 'Sélectionner un club',
      stepResultTitleTeam: 'Sélectionner une équipe',
      stepSearchDescription: 'Tape le nom du {{roleTargetLabel}} pour filtrer la liste.',
      stepSearchTitle: 'Recherche',
    },
  },
  onboardingClubCard: {
    clubNameFallback: 'Club',
    recruitingBadge: 'RECRUTE',
    stats: {
      ads: 'Annonces',
      members: 'Membres',
      teams: 'Équipes',
    },
  },
  otp: {
    actions: {
      confirm: 'Confirmer',
      resend: 'Renvoyer le code',
    },
    fields: {
      code: {
        label: 'Code de confirmation',
        placeholder: '123456',
      },
    },
    subtitle: 'Entre le code reçu par SMS.',
    title: 'Confirme ton numéro',
  },
  otpSendThrottle: {
    errors: {
      throttled: "Un code vient d'être envoyé. Nouvel envoi possible dans {{remainingSeconds}} s.",
    },
  },
  // PARENT (2026-09-02) — le palier 13 : l ecran ou atterrit un moins de 13 ans.
  // Il n y a pas de compte sous 13 ans (decision d Adel, version A) : le parent
  // declare son enfant depuis SON compte. Deux sorties, aucune echappatoire.
  parentAccountRequired: {
    body: 'Tu as moins de 13 ans. Sur FoundClub, tu n’as pas besoin de compte : '
      + 'c’est ton parent qui te déclare depuis le sien.',
    fixBirthdate: 'Corriger ma date de naissance',
    logout: 'Se déconnecter',
    steps: 'Il installe l’app, choisit « Parent » à l’inscription, puis te déclare '
      + 'comme joueur. Tu apparaîtras sous ton prénom dans ton équipe.',
    title: 'Un compte parent est nécessaire',
  },
  parentalDeclarationCard: {
    // eslint-disable-next-line max-len
    description: 'Ce profil concerne un enfant de moins de 15 ans. Pour continuer, tu dois confirmer que tu es son parent ou représentant légal.',
    title: 'Déclaration parentale obligatoire',
  },
  participantEventList: {
    addAnEvent: 'Ajouter un événement',
    anErrorOccurred: 'Une erreur est survenue.',
    createAnEvent: 'Créer un événement',
    createYourFirstEventTo: 'Crée ton premier événement pour le voir apparaître ici.',
    eventsFrom: 'Événements à partir de',
    featuredInMyClub: '⭐ À la une dans mon club',
    // eslint-disable-next-line max-len
    findYourEventsYourCalendar: 'Retrouve tes événements, ton calendrier et les actions de planning.',
    myPlanning: 'Mon planning',
    noUpcomingEvent: 'Aucun événement à venir',
    thisActionIsUnavailable: 'Cette action est indisponible.',
    tryAgain: 'Réessayer',
    yourAnswerCouldnTBe: "Ta réponse n'a pas pu être envoyée. Réessaie dans un instant.",
    // eslint-disable-next-line max-len
    yourNextEventsWillShow: 'Tes prochains événements s’afficheront ici dès que ton équipe en publiera.',
  },
  participationFlow: {
    actionImpossibleForNow: 'Action impossible pour le moment.',
    apply: 'Postuler',
    applyAsACoach: 'Candidater comme entraîneur',
    confirmMyApplication: 'Confirmer ma candidature',
    confirmMyAttendance: 'Confirmer ma présence',
    confirmMyParticipation: 'Confirmer ma participation',
    onlyPlayersCanApplyTo: 'Seuls les joueurs peuvent candidater à cette détection.',
    onlyPlayersCanJoinThis: 'Seuls les joueurs peuvent rejoindre cette réservation.',
    onlyPlayersCanTakePart: 'Seuls les joueurs peuvent participer à cet événement.',
    present: 'Present',
    seeTheMainTrainingCamp: 'Voir le stage principal',
    sendMyApplication: 'Envoyer ma candidature',
    takePart: 'Participer',
    // eslint-disable-next-line max-len
    theExternalPlayerQuotaFor: 'Le quota de joueurs externes pour cet entraînement est déjà atteint.',
    thisBookingDoesnTAccept: 'Cette réservation n accepte pas de nouveaux joueurs.',
    thisBookingIsAlreadyFull: 'Cette réservation est déjà complété.',
    thisBookingIsAlreadyOver: 'Cette réservation est déjà passee.',
    thisClosedEventIsReserved: 'Cet événement fermé est réservé aux équipes concernées.',
    thisEventIsAlreadyOver: 'Cet événement est déjà passe.',
    thisEventIsFull: 'Cet événement est complet.',
    thisListingIsNoLonger: 'Cette annonce n est plus active.',
    thisTrainingSessionDoesnT: 'Cet entraînement n accepte pas de joueurs externes pour le moment.',
    youAlreadyHaveAPending: 'Tu as déjà une candidature en attente sur cette détection.',
    youCanTApplyTo: 'Tu ne peux pas candidater à ta propre annonce.',
    yourApplicationHasAlreadyBeen: 'Ta candidature est déjà validée.',
    yourApplicationIsAlreadyPending: 'Ta candidature est déjà en attente.',
    youReAlreadyTakingPart: 'Tu participes déjà à cette réservation.',
    youReAlreadyTakingPart2: 'Tu participes déjà à cet événement.',
    youReAlreadyTakingPart3: 'Tu participes déjà à cette détection.',
    youReStaffForThis: 'Tu encadres cet événement : ce sont les joueurs qui répondent.',
    youVeAlreadyAnsweredThis: 'Tu as déjà répondu à cet événement.',
  },
  pastMatchDetails: {
    alerts: {
      errorTitle: 'Erreur',
    },
    backToDashboard: 'Retour au dashboard',
    context: {
      away: 'EXTERIEUR',
      home: 'DOMICILE',
    },
    dateTime: 'Date et heure',
    elo: {
      after: 'Après',
      before: 'Avant',
      unavailable: 'Indisponible',
    },
    errors: {
      load: 'Impossible de charger le match terminé.',
      missingId: "Aucun match n'est associé à ce lien.",
    },
    headerTitle: 'Match termine',
    loadErrorTitle: 'Chargement impossible',
    missing: {
      description: "Ce match terminé n'est plus accessible depuis ce lien.",
      title: 'Match introuvable',
    },
    officialScore: 'Score officialise',
    playerLabel: 'Joueur',
    reload: 'Recharger',
    rematch: {
      cancel: 'Annuler',
      cannotStart: 'Impossible de lancer la revanche pour ce match.',
      confirm: 'Oui, revanche',
      confirmBody: 'Veux-tu demander une revanche contre {{opponentName}} ?',
      error: 'Impossible de demander une revanche',
      matched: 'Match créé',
      sent: 'Demande envoyée',
      sentBody: 'Ta demande a bien été envoyée.',
      thisTeam: 'cette équipe',
      title: 'Demander une revanche',
    },
    result: {
      draw: 'MATCH NUL',
      loss: 'DEFAITE',
      win: 'VICTOIRE',
    },
    sections: {
      eloImpact: 'Impact ELO matchmaking',
      scorers: 'Buteurs',
    },
    summary: {
      draw: 'Les deux équipes repartent dos à dos.',
      loss: 'Le match a bascule du cote adverse.',
      win: 'Tu remportes ce duel League.',
    },
    teamAFallback: 'Équipe A',
    teamBFallback: 'Équipe B',
    unknownDate: 'Date inconnue',
    venue: 'Lieu du match',
    venueToBeDecided: 'Lieu à définir',
  },
  pendingMatchStatsScreen: {
    actionsToHandle_one: '{{count}} action à traiter',
    actionsToHandle_other: '{{count}} actions à traiter',
    checkRequired: 'Vérification requise',
    checkThenRepublishThisTeam: 'Vérifier puis republier les stats de cette équipe.',
    completeThePlayerStatsThen: 'Compléter les stats joueurs puis publier le rapport.',
    dateUnavailable: 'Date indisponible',
    draftInProgress: 'Brouillon en cours',
    endOfMatch: 'Fin du match',
    fillIn: 'Renseigner',
    // eslint-disable-next-line max-len
    findHereYourPersonalFeedback: 'Retrouve ici tes retours perso et les bilans équipe encore en attente après les matchs.',
    forMe: 'Pour moi',
    forMyTeam: 'Pour mon équipe',
    // eslint-disable-next-line max-len
    giveYourIndividualPostMatch: 'Donner ton retour individuel post-match, avec stats perso et note sur 10.',
    loadingFailed: 'Chargement impossible',
    loadingPendingMatches: 'Chargement des matchs en attente',
    myAction: 'Mon action',
    myPostMatchFeedback: 'Mon retour post-match',
    officialScorePending: 'Score officiel en attente',
    open: 'Ouvrir',
    pendingMatches: 'Matchs en attente',
    personalDraft: 'Brouillon perso',
    postMatchFollowUp: 'Suivi post-match',
    resume: 'Reprendre',
    resumeTheDraftAndFinalise: 'Reprendre le brouillon et finaliser le rapport.',
    // eslint-disable-next-line max-len
    resumeYourPersonalDraftFinalise: 'Reprendre ton brouillon perso, finaliser tes stats et ta note de match.',
    saveTheScore: 'Enregistrer le score',
    saveTheScoreBeforeFilling: 'Enregistrer le score avant de remplir les stats.',
    scoreToComplete: 'Score à compléter',
    teamAction: "Action d'équipe",
    teamFallback: 'Equipe',
    teamReport: 'Bilan équipe',
    toAnswer: 'A répondre',
    toFinalise: 'A finaliser',
    tryAgain: 'Réessayer',
    unableToLoadPostMatch: 'Impossible de charger les actions post-match pour le moment.',
    update: 'Mettre à jour',
    weReFetchingYourAvailable: 'Nous récupérons tes retours post-match disponibles.',
  },
  permissions: {
    camera: {
      denied: 'Permission caméra refusée',
      message: 'L\'application a besoin d\'accéder à ta caméra pour prendre une photo.',
      title: 'Permission Caméra',
    },
  },
  personalPlanningWeekFullscreen: {
    backToTheCurrentWeek: 'Revenir à la semaine actuelle',
    // eslint-disable-next-line max-len
    changeWeekToExploreThe: 'Change de semaine pour explorer le planning ou reviens à la semaine actuelle.',
    closeTheFullScreenPlanning: 'Fermer le planning plein écran',
    events_one: '{{count}} événement',
    events_other: '{{count}} événements',
    nextWeek: 'Semaine suivante',
    noSlotThisWeek: 'Aucun créneau cette semaine',
    peak: 'Pic {{peak}}/{{max}}',
    previousWeek: 'Semaine précédente',
    slots_one: '{{count}} slot',
    slots_other: '{{count}} slots',
    today: 'Aujourd’hui',
    tryAgain: 'Reessayer',
    unableToLoadThePlanning: 'Impossible de charger le planning',
    // eslint-disable-next-line max-len
    weekPlanningLoadError: 'Le planning de cette semaine n’a pas pu être récupère. Réessaie ou change de semaine.',
  },
  planning: {
    actions: {
      today: "Aujourd'hui",
    },
    cm: {
      description: 'Retrouve le planning des sections et la liste des événements de ton club.',
      emptyListDescription: 'Change la date ou les filtres pour afficher d’autres événements.',
      emptyListTitle: 'Aucun événement dans cette liste',
      // eslint-disable-next-line max-len
      filtersErrorDescription: "Le planning reste accessible, mais nous n'avons pas pu charger toutes les sections ou installations.",
      filtersErrorTitle: 'Certains filtres du planning sont indisponibles',
      title: 'Mon planning',
    },
    eventsFrom: 'Événements à partir de',
    filters: {
      allFacilities: 'Toutes installations',
      allSections: 'Toutes sections',
    },
    fullscreen: {
      club: 'Planning club',
      clubShared: 'Planning partagé',
      cm: 'Planning omnisport',
      personal: 'Mon planning',
    },
    labels: {
      noTime: 'Sans horaire',
    },
    mode: {
      monthDescription: 'Vue globale du mois',
      monthShort: 'Mois',
      threeDaysDescription: 'Vue condensée sur 3 jours',
      threeDaysShort: '3 jours',
      weekDescription: 'Vue détaillée de la semaine',
      weekShort: 'Semaine',
    },
    noEventsForDate: 'Aucun événement ce jour-là',
    status: {
      pendingParticipation: 'Demande en attente',
    },
  },
  planningFullscreenButton: {
    openThePlanningInFull: 'Ouvrir le planning en plein écran',
  },
  planningSlots: {
    event: 'Événement',
    eventFallback: 'Evenement',
  },
  planningWeekTimelineViewV2: {
    changeThePeriodToSee: "Change de période pour voir d'autres créneaux.",
    more: 'plus',
    noEventInThisPeriod: 'Aucun événement sur cette période',
    noEventWithATime: 'Aucun événement avec horaire',
    noTime: 'Sans horaire',
    pending: 'En attente',
    pendingShort: 'Attente',
    summary_one: '{{count}} événement sur {{daysCount}} jours',
    summary_other: '{{count}} événements sur {{daysCount}} jours',
    // eslint-disable-next-line max-len
    thisPeriodSEventsAre: 'Les événements de cette période sont uniquement dans la section « Sans horaire ».',
  },
  playerCard: {
    editCardCta: 'Modifier mes infos',
    generating: 'Génération de l\'image…',
    history: {
      clubCount: '{{total}} CLUBS',
      empty: 'PARCOURS À COMPLÉTER',
      title: 'HISTORIQUE SPORTIF',
    },
    info: {
      age: 'ÂGE',
      city: 'VILLE',
      club: 'CLUB',
      nationality: 'NATIONALITÉ',
      position: 'POSTE',
    },
    parentalConsentPreview: 'APERÇU — ACCORD PARENTAL REQUIS',
    preferredFormation: 'DISPOSITION PRÉFÉRÉE',
    rarityHint: 'Complète ton profil et ton parcours pour monter en rareté.',
    saveCta: 'Enregistrer l\'image',
    savedDescription: 'Ta carte a été ajoutée aux photos de ton téléphone (album FoundClub).',
    savedTitle: 'Image enregistrée',
    saveError: 'Impossible d\'enregistrer l\'image pour le moment.',
    saveErrorPermission: 'Autorise l\'accès aux photos pour enregistrer ta carte.',
    screenSubtitle: 'Partage ta carte, gagne en visibilité et fais-toi détecter.',
    screenTitle: 'Ma carte de collection',
    shareCta: 'Partager ma carte',
    // Carte (contenu)
    coachChip: 'COACH',
    field: {
      age: 'Âge',
      city: 'Ville',
      nationality: 'Nationalité',
      position: 'Poste',
      role: 'Rôle',
      sport: 'Sport',
      yearsUnit: 'ans',
    },
    historyEmpty: 'Parcours à compléter',
    historyTitle: 'PARCOURS',
    lockedLabel: 'Aperçu — accord parental requis',
    noClub: 'SANS CLUB',
    nowShort: 'Auj.',
    previewChip: 'APERÇU',
    rarity: {
      common: 'COMMUNE',
      epic: 'ÉPIQUE',
      legendary: 'LÉGENDAIRE',
      mostRare: 'MOST RARE',
      rare: 'RARE',
      ultraRare: 'ULTRA RARE',
    },
    rarityA11y: 'Rareté',
    tagAvailable: 'DISPONIBLE',
    tagAvailableA11y: 'Disponible',
    // Formats d'export
    formatFeed: 'Feed',
    formatStory: 'Story',
    // Reveal fin d'onboarding
    revealContinue: 'Plus tard, continuer',
    revealEyebrow: 'Bienvenue',
    revealTitle: 'Voici ta carte de collection',
    // Garde-fou mineurs
    minorGuardDescription: 'Ce profil concerne un mineur. La publication de la carte nécessite l\'accord d\'un parent ou représentant légal.',
    minorGuardTitle: 'Accord parental requis',
    requestConsent: 'Demander l\'accord parental',
    // Partage (message natif)
    sentDescription: 'Ta carte a bien été partagée. Ouvrir la conversation ?',
    sentTitle: 'Carte envoyée',
    shareAvailableSuffix: 'Je cherche un club !',
    shareError: 'Impossible de générer l\'image pour le moment.',
    shareFallbackName: 'Ma carte FoundClub',
    shareIntro: 'Voici ma carte FoundClub.',
    shareLinkLabel: 'Retrouve-moi sur FoundClub',
    shareOpenWith: 'Ouvrir ta carte avec…',
    sharePermissionError: 'FoundClub n\'a pas le droit d\'enregistrer dans ton téléphone. '
      + 'Autorise-le dans les réglages, puis réessaie.',
    shareSavedGallery: 'Ta carte est enregistrée dans tes photos (album FoundClub). '
      + 'Choisis maintenant où la publier.',
    shareSaveError: 'L\'enregistrement a échoué. '
      + 'Il reste peut-être trop peu de place sur ton téléphone.',
    uploadError: 'L\'envoi de l\'image a échoué.',
    // ShareCardModal
    shareChatA11yHint: 'Envoyer ma carte dans cette conversation',
    shareChatCardHint: 'Envoi direct FoundClub',
    shareChatType: {
      club: 'Club',
      group: 'Groupe',
      multisport: 'Omnisport',
      team: 'Équipe',
      whisper: 'Privé',
    },
    shareCloseA11y: 'Fermer le partage',
    shareEyebrow: 'Diffusion',
    shareGenerating: 'Génération de l\'image…',
    shareInChat: 'Envoyer dans une conversation',
    shareInChatHint: 'Ta carte est envoyée en image.',
    shareNoChat: 'Aucune conversation disponible.',
    shareNoChatHint: 'Rejoins ou crée une conversation pour envoyer ta carte ici.',
    shareOutsideHint: 'SMS, mail ou « Enregistrer l\'image »',
    shareOutsideLabel: 'Lien externe',
    shareSubtitle: 'Choisis un canal pour diffuser ta carte de collection.',
    shareTitle: 'Partager ma carte',
    shareViaOther: 'Partager via… (SMS, Mail, Enregistrer)',
    // Carte équipe
    recruitTitle: 'RECRUTE · SÉANCES D\'ESSAI',
    rosterEmpty: 'Effectif à compléter',
    rosterField: 'Effectif',
    teamChip: 'ÉQUIPE',
  },
  // C-C — ECRAN 10 du pack composition : la vue du joueur convoqué.
  playerConvocation: {
    actions: {
      absent: 'Absent',
      present: 'Présent',
    },
    alerts: {
      error: {
        message: 'Impossible d’enregistrer ta réponse. Réessaie dans un instant.',
        title: 'Erreur',
      },
    },
    card: {
      calledUpBy: 'Convoqué par {{name}}',
      number: 'N°{{number}}',
      position: 'Poste : {{position}}',
    },
    columns: {
      kickOff: 'Coup d’envoi',
      meeting: 'RDV',
      // ⚠️ Le modèle serveur n'a AUCUN champ d'heure de rendez-vous
      // (mesuré le 2026-08-15 sur `event/schema.json`). On le dit, on ne
      // l'invente pas — le pack interdit les promesses fausses.
      notSpecified: 'Non précisé',
      place: 'Lieu',
    },
    compositionTitle: 'La composition',
    empty: {
      // AC08 — ⛔ plus de cul-de-sac : quand la charge n'apporte aucune
      // convocation, on le DIT, et le bouton retour est deja la.
      message: 'Aucune composition publiée ne te concerne sur cet événement.',
      title: 'La composition',
    },
    reserve: {
      title: 'Remplaçants',
    },
    roles: {
      starter: 'Titulaire',
      substitute: 'Remplaçant',
    },
    title: 'Tu es convoqué',
  },
  playerGoalsModal: {
    errorTitle: 'Erreur',
    goalsAssigned: 'buts attribués',
    noPlayers: 'Aucun joueur disponible',
    saveError: 'Impossible de sauvegarder les buteurs.',
    saving: 'Enregistrement...',
    submit: 'Valider les buteurs',
    title: '⚽ Buteurs -',
    // eslint-disable-next-line max-len
    totalMismatch: 'Le total des buts ({{currentTotal}}) ne correspond pas au score ({{totalGoals}}). Merci de corriger.',
  },
  playerMatchResponseScreen: {
    actions: 'Actions',
    anErrorOccurred: 'Une erreur est survenue.',
    assists: 'Passes décisives',
    checkYourStats: 'Vérifier tes stats',
    chooseSituation: 'Choisis le cas qui correspond le mieux à ta situation pour ce match.',
    cleanSheet: 'Clean sheet',
    cleanSheetAuto: 'Activé automatiquement — 0 but encaissé',
    // eslint-disable-next-line max-len
    cleanSheetImpossible: 'Un clean sheet est impossible si le score officiel indique un but adverse.',
    cleanSheetMeansZero: 'Un clean sheet implique 0 but encaisse.',
    cleanSheetTurnsOn: "S'active à 0 but encaissé",
    commentPlaceholder: 'Mon ressenti, ce qui a bien marché, ce qui était plus compliqué…',
    // eslint-disable-next-line max-len
    concededExceedsOpponentScore: 'Les buts encaissés ne peuvent pas dépasser le score officiel adverse ({{scoreAgainst}}).',
    consistencyCheck: 'Vérification de cohérence',
    didNotPlay: 'Pas joué',
    didYouTakePart: 'As-tu participé au match ?',
    dontKnowStats: 'Je ne connais pas mes stats',
    draft: 'Brouillon',
    draftSaved: 'Brouillon enregistré',
    feedbackSaved: 'Ton retour post-match a bien été enregistré.',
    fetchingQuestionnaire: 'Nous récupérons ton questionnaire et le score officiel du match.',
    fillInFigures: 'Renseigne tes chiffres personnels, ou indique que tu ne les connais pas.',
    goals: 'Buts',
    goalsConceded: 'Buts encaissés',
    // eslint-disable-next-line max-len
    goalsExceedTeamScore: 'Tes buts ne peuvent pas dépasser le score officiel de ton équipe ({{scoreFor}}).',
    howIFelt: 'Mon ressenti',
    knowStats: 'Je connais mes stats',
    leagueValidatedScore: 'Score ligue validé',
    loadingFailed: 'Chargement impossible',
    loadingFeedback: 'Chargement du retour post-match',
    loadingYourFeedback: 'Chargement de ton retour post-match...',
    loadQuestionnaireError: 'Impossible de charger ce questionnaire.',
    manualScore: 'Score saisi dans FoundClub',
    match: 'Match',
    matchNotFound: 'Match introuvable',
    matchSaved: 'Ton match est enregistré.',
    // eslint-disable-next-line max-len
    missingRouteInfo: "Cette route n'a pas recu les informations necessaires pour charger ton retour post-match.",
    myPerformance: 'Ma performance',
    myPostMatchFeedback: 'Mon retour post-match',
    myQuantitativeStats: 'Mes stats quantitatives',
    noFeedbackAvailable: "Aucun retour joueur n'est disponible pour ce match.",
    noProblem: 'Aucun problème.',
    notInvolved: "Je n'étais pas concerné·e",
    notInvolvedDescription: 'Tu ne seras plus relancé·e pour ce match.',
    // eslint-disable-next-line max-len
    officialScoreNeverChanged: "Le score officiel ne sera jamais modifié. Corrige simplement les chiffres avant l'envoi.",
    officialScoreSynced: 'Score officiel synchronise',
    oneHalf: 'Une mi-temps',
    participation: 'Participation',
    played: "J'ai joué",
    playedDescription: 'Tu peux ensuite renseigner tes stats et ton ressenti.',
    playingTime: 'Temps de jeu',
    playingTimeMinutes: 'Temps de jeu (min)',
    points: 'Points',
    // eslint-disable-next-line max-len
    pointsExceedTeamScore: 'Tes points ne peuvent pas dépasser le score officiel de ton équipe ({{scoreFor}}).',
    presentNoPlay: "J'étais là mais je n'ai pas joué",
    presentNoPlayDescription: 'Tu peux laisser une note et un commentaire, sans chiffres de match.',
    questionnaireUnavailable: 'Questionnaire indisponible',
    rateContribution: 'Comment tu évaluerais ta contribution personnelle sur ce match ?',
    // eslint-disable-next-line max-len
    rateHint: "Note ton match et le match de l'équipe, puis ajoute un commentaire si tu le souhaites.",
    rebounds: 'Rebonds',
    resumeLater: 'Tu peux reprendre ta réponse plus tard.',
    saveError: "Impossible d'enregistrer ta réponse.",
    saveMyDraft: 'Sauvegarder mon brouillon',
    saveOrSendHint: 'Tu peux enregistrer un brouillon ou envoyer directement ton retour.',
    sayIfPlayedFirst: "Indique d'abord si tu as joué ce match.",
    scorePending: 'Score en attente',
    sendMyFeedback: 'Envoyer mon retour',
    sent: 'Envoyé',
    teamMatch: "Le match de l'équipe",
    teamPerformanceHint: 'Donne ton ressenti collectif sur la performance du groupe.',
    thankYou: 'Merci',
    threePointers: '3 pts',
    // eslint-disable-next-line max-len
    threePointersExceedPoints: 'Le total de tirs a 3 points ne peut pas dépasser ton total de points.',
    toDo: 'À faire',
    tryAgain: 'Réessayer',
    // eslint-disable-next-line max-len
    unknownStatsHint: 'On enregistre que tu ne connais pas tes stats individuelles pour ce match. Tu peux quand même laisser ta note et ton ressenti.',
    wholeMatch: 'Tout le match',
    yourMatch: 'Ton match',
  },
  pollCreationModal: {
    thisOptionIsAlreadyUsed: 'Cette option est déjà utilisée.',
  },
  pollDetails: {
    anonymousVotes: 'Votes anonymes',
    back: 'Retour',
    createdBy: 'Creé par',
    information: 'Informations',
    loadingThePoll: 'Chargement du sondage…',
    member: 'Membre',
    messaging: 'Messagerie',
    multipleVotesAllowed: 'Votes multiples autorises',
    noVoteForThisOption: 'Aucun vote pour cette option.',
    oneChoicePerParticipant: 'Un seul choix par participant',
    poll: 'Sondage',
    pollDetails: 'Detail du sondage',
    pollNotFound: 'Sondage introuvable',
    // eslint-disable-next-line max-len
    seeTheResultsVoteOr: 'Consulte les résultats, vote ou modifie ton choix directement depuis le web.',
    thisPollCanTBe: 'Ce sondage est introuvable ou a été supprimé.',
    thisPollIsAnonymousThe: 'Ce sondage est anonyme, la liste des votants n’est pas affichée.',
    totalVotes: 'Total votes',
    unableToSaveThisVote: 'Impossible de sauvegarder ce vote.',
    vote: 'Voter',
    voteSaved: 'Vote enregistre',
    votesCount_one: '{{count}} vote',
    votesCount_other: '{{count}} votes',
    votesVisibleToAllParticipants: 'Votes visibles pour tous les participants',
  },
  positionSelectionList: {
    currentSelection: 'Sélection actuelle',
    select: 'Selectionner',
  },
  premiumBadge: {
    clubOffer: 'Offre Club',
    teamOffer: 'Offre Équipe',
  },
  privateNavigator: {
    bootError: {
      retry: 'Réessayer',
      // eslint-disable-next-line max-len
      subtitle: 'Impossible de joindre le serveur FoundClub pour le moment. Vérifie ta connexion puis réessaie : tes données reviendront dès que le réseau répond.',
      title: 'Connexion impossible',
    },
    headers: {
      addPartner: 'Ajouter un partenaire',
      bookSlot: 'Réserver un créneau',
      editAd: "Modifier l'annonce",
      facilities: 'Installations',
      featuredRequests: 'Demandes à la une',
      feePayment: 'Paiement cotisation',
      matchDetails: 'Détails du match',
      members: 'Membres',
      missingPlayers: 'Joueurs recherchés',
      multisportClub: 'Club Omnisport',
      multisportFees: 'Cotisations multisport',
      multisportManagement: 'Gestion CM',
      myClubs: 'Mes clubs',
      newSection: 'Nouvelle section',
      planning: 'Planning',
    },
    subscriptionOffers: {
      resumeCta: 'Continuer',
    },
  },
  profile: {
    accountSwitcher: {
      active: 'Actif',
      addAccount: 'Ajouter un compte',
      close: 'Fermer',
      fallbackName: 'Compte',
      fallbackRole: 'Utilisateur',
      singleAccountHint: 'Ce compte est le seul connecté sur cet appareil. Tu peux en ajouter un autre ou te déconnecter.',
      switching: 'Changement…',
      title: 'Changer de compte',
    },
    actions: {
      addAccount: 'Ajouter un compte',
      addValue: 'Ajouter',
      adminDashboardClassic: 'Dashboard admin classique',
      avatarPickerUnavailable: 'Le sélecteur d image est indisponible sur ce navigateur.',
      confirmDeleteAvatar: 'Es-tu sûr de vouloir supprimer cette image ?',
      contactSupport: 'Nous contacter',
      deleteAccount: 'Supprimer mon compte',
      edit: 'Modifier mon profil',
      editIdentity: 'Modifier mon nom et ma photo',
      findClub: 'Trouver mon club',
      findTeam: 'Trouver une équipe',
      ignore: 'Ignorer',
      language: 'Langue',
      logout: 'Déconnexion',
      // PARENT P2 — la rangée qui manquait : aucune des 8 rangées du menu ne
      // parlait d'enfant, alors que « mes enfants » est la raison d'être du
      // compte parent.
      manageAlerts: 'Gérer mes alertes',
      manageClub: 'Gérer mon club',
      manageClubJoinRequests: 'Gérer les demandes d\'affiliation au club',
      manageEvents: 'Gérer mes événements',
      manageRequests: 'Gérer mes demandes',
      manageTeamJoinRequests: 'Gérer les demandes d\'adhésion aux équipes',
      manageTeams: 'Gérer mes équipes',
      myCard: 'Ma carte de collection',
      myChildren: 'Mes enfants',
      myTeams: 'Mes équipes',
      previewPublic: 'Voir mon profil comme les autres',
      save: 'Continuer',
      superAdminLeagueDashboard: 'Dashboard League',
      switchAccount: 'Changer de compte',
      view: 'Voir mon profil',
      viewAvatar: 'Agrandir la photo',
    },
    alerts: {
      deleteAlert: {
        actions: {
          cancel: 'Annuler',
          confirm: 'Supprimer',
        },
        // Lot L28 : le serveur retire desormais les inscriptions a venir et
        // previent le staff. Cette phrase l annonce AVANT la confirmation.
        consequences: 'Tes inscriptions aux événements à venir seront retirées et tes entraîneurs'
          + ' en seront informés. Ton historique passé est conservé. Cette action est définitive.',
        // Lot L48 : cette phrase envoyait remplir un formulaire de contact alors
        // que le bouton supprime le compte tout de suite. CLE MORTE depuis L28 :
        // `Profile.js:200` affiche `consequences`, plus personne ne lit celle-ci
        // (0 appelant, verifie). On la corrige quand meme plutot que de la
        // supprimer, pour qu elle ne mente plus si on la rebranche un jour.
        subtitle: 'Ton compte sera désactivé et tes informations personnelles effacées.'
          + ' Cette action est définitive.',
        title: 'Supprimer ton compte ?',
      },
      deleteError: 'Une erreur est survenue lors de la suppression du compte.',
      maxAccounts: {
        message: 'Tu ne peux pas connecter plus de {{count}} comptes sur cet appareil.',
        title: 'Limite atteinte',
      },
    },
    // AA11 (D-26) — « le joueur dans deux clubs, ca marche. Mais quand je
    // regarde dans mon profil, je ne vois que le premier club. » Ce bloc
    // n'apparait qu'a partir de DEUX clubs : avec un seul, la sous-ligne
    // d'identite le nomme deja, et une liste d'un element serait du bruit.
    clubs: {
      title: 'Mes clubs',
    },
    // R24 — le repli quand aucune application e-mail ne s'ouvre. Un lien de
    // contact qui ne fait rien vaut un lien absent : on donne alors l'adresse
    // en toutes lettres pour qu'elle reste recopiable.
    contactSupport: {
      unavailableBody: "Aucune application e-mail n'a pu s'ouvrir. Écris-nous à contact@foundclubpro.com.",
      unavailableTitle: "Impossible d'ouvrir l'e-mail",
    },
    errors: {
      birthdateIncomplete: 'Renseigne une date de naissance valide pour continuer.',
      formIncomplete: 'Vérifie les informations saisies pour continuer.',
      photoNotRetrieved: "La photo n'a pas pu être récupérée. Réessaie.",
      photoUnavailable: "L'appareil photo n'est pas disponible.",
    },
    fields: {
      // AA11 — ces six libelles vivaient en REPLI dans le code des ecrans
      // (`ProfileEdit.js`, `SelfProfilePlayerCoach.js`). Ils sont remontes ici
      // sans changer d'un caractere : la confirmation d'enregistrement les
      // nomme, et un mot d'ecran ne peut pas vivre a deux endroits.
      avatar: {
        label: 'Photo de profil',
      },
      bestLevel: {
        label: 'Meilleur niveau',
        placeholder: 'Sélectionner un niveau',
      },
      birthdate: {
        label: 'Date de naissance',
        placeholder: 'JJ/MM/AAAA',
      },
      category: {
        label: 'Catégorie',
        placeholder: 'Sélectionner une catégorie',
      },
      city: {
        label: 'Ville',
        placeholder: 'Rechercher une ville',
      },
      email: {
        label: 'Email',
        placeholder: 'Ajouter un email',
      },
      firstname: {
        label: 'Prénom',
        placeholder: 'Luc',
      },
      height: {
        label: 'Taille (m)',
        placeholder: '1,80',
      },
      isLookingForClub: {
        helper: 'Ton profil apparaît dans la recherche des clubs et des coachs.',
        label: 'Profil visible',
      },
      jerseyNumber: {
        label: 'Numéro de maillot',
        placeholder: 'Ex. 10 (vide = automatique)',
      },
      lastname: {
        label: 'Nom',
        placeholder: 'Harne',
      },
      nationality: {
        label: 'Nationalité',
        placeholder: 'Ex. Française, FRA…',
      },
      phoneNumber: {
        label: 'Numéro de téléphone',
        placeholder: '+33612345678',
      },
      position: {
        label: 'Poste',
        placeholder: 'Ailier',
      },
      preferredSport: {
        label: 'Sport de préférence',
        placeholder: 'Sélectionner un sport',
      },
      section: {
        label: 'Section',
        placeholder: 'Sélectionner une section',
      },
      sections: {
        female: 'Féminine',
        male: 'Masculine',
      },
      sportsHistory: {
        label: 'Historique sportif',
      },
      types: {
        coach: 'Entraîneur·e',
        parent: 'Parent',
        player: 'Joueur·se',
        president: 'Dirigeant·e',
      },
      weight: {
        label: 'Poids (kg)',
        placeholder: '80',
      },
    },
    history: {
      add: 'Ajouter une expérience',
      bestLevel: 'Meilleur niveau',
      count: '{{count}} expérience(s)',
      deleteConfirmation: 'Veux-tu vraiment supprimer cette expérience ?',
      empty: 'Ajoute ton parcours sportif pour enrichir ton profil',
      emptyOther: 'Aucun historique renseigne',
      periodNotSet: 'Période non renseignée',
      tapToEdit: 'Touche la carte pour modifier',
      title: 'Historique sportif',
      unknownClub: 'Club inconnu',
    },
    identity: {
      // AFFIL A3 — la demande qui attend, sur le profil du dirigeant. Elle ne
      // dit RIEN de la certification du club : ce sont deux pastilles, deux
      // rangees, deux mots (Adel, 2026-08-28).
      pendingRequest: 'Demande en attente',
      roles: {
        coach: 'Entraîneur',
        new: 'Membre',
        parent: 'Parent',
        player: 'Joueur',
        president: 'Dirigeant',
        superAdmin: 'Administrateur',
      },
      roleWithClub: '{{role}} · {{club}}',
      verified: 'Certifié',
    },
    language: {
      auto: 'Langue du téléphone',
      en: 'English',
      fr: 'Français',
    },
    // AA11 — LA PHRASE QU'ADEL DEMANDE (« felicitations, votre (info) a ete
    // modifiee »), et elle NOMME toujours ce qui a change. Le libelle insere
    // vient de `profile.fields.*.label` ci-dessus : c'est le mot que la
    // personne vient de lire au-dessus de sa saisie, jamais un synonyme.
    // ⚠️ La tournure est volontairement IMPERSONNELLE (« la modification est
    // bien enregistree ») : « ton » ou « ta » devant un libelle oblige a
    // connaitre son genre, et « ton date de naissance » serait faux.
    // Table des champs : `services/profile/profileSaveConfirmation.js`.
    saveConfirmation: {
      eyebrow: 'PROFIL',
      many: '{{count}} informations de ton profil sont bien enregistrées.',
      one: '{{field}} : la modification est bien enregistrée.',
      title: 'C’est enregistré',
      two: '{{first}} et {{second}} : les modifications sont bien enregistrées.',
    },
    sections: {
      account: 'Compte',
      administration: 'Administration',
      contact: 'Coordonnées',
      followUp: 'Suivi',
      profileActivity: 'Profil & activité',
      visibility: 'Visibilité',
    },
    // L33 — le parcours Abonnement est en trois ecrans : le hub (gerer), le
    // carrousel (choisir) et la matrice (comparer). Ces cles nomment les
    // rangees du hub et les entetes natifs des deux ecrans pousses.
    subscription: {
      actions: {
        changeOffer: 'Changer d\'offre',
        compareOffers: 'Comparer les offres',
        manageWeb: 'Gérer ou résilier mon abonnement',
        manageWebErrorBody: 'La gestion en ligne de cet abonnement n\'est pas disponible'
          + ' pour le moment. Écrivez-nous et nous nous en occupons.',
        manageWebErrorTitle: 'Gestion indisponible',
        manageWebHint: 'Site de paiement',
        // 🍎 Apple 3.1.3(a) : sur iOS on ne pointe pas une caisse externe. Ces
        // deux clés disent la même chose sans ouvrir de page de paiement.
        manageWebHintIos: 'Souscrit sur notre site',
        manageWebIosBody: 'Cet abonnement n\'a pas été acheté sur l\'App Store : il a été souscrit'
          + ' sur notre site. Vous pouvez le gérer ou le résilier depuis votre navigateur, avec le'
          + ' même compte. Écrivez-nous si vous avez besoin d\'aide.',
        manageWebIosTitle: 'Abonnement pris sur notre site',
        restore: 'Restaurer mes achats',
        viewClub: 'Voir mon club',
        viewClubHint: 'Demandes · certification',
        viewOffers: 'Voir les offres',
      },
      compareHeaderTitle: 'Comparer',
      cta: 'Voir le détail des offres',
      // ESSAI (28/08) — LA PAGE CADEAU. Les mots sont ceux d'Adel, et les sept
      // usages sont dans SON ordre : infos du club · équipes · membres ·
      // campagnes de cotisations · événements · recherche de matchs ·
      // communication aux licenciés.
      gift: {
        cta: 'Débloquer mon offre',
        ctaHint: 'Aucune carte bancaire demandée.',
        duration_one: '{{count}} jour offert',
        duration_other: '{{count}} jours offerts',
        ending: 'À la fin du cadeau, les équipes que vous avez créées restent :'
          + ' vous ne pourrez simplement plus en créer de nouvelles.',
        errorBody: 'Nous n\'avons pas pu activer votre cadeau. Vous retrouverez'
          + ' l\'offre dans votre profil, rubrique Mon abonnement.',
        errorTitle: 'Cadeau non appliqué',
        free: 'Gratuit, sans carte bancaire',
        headerTitle: 'Votre cadeau',
        intro: 'Profitez-en pour :',
        subtitle: 'Vous avez reçu un cadeau : un abonnement club illimité.',
        title: 'Félicitations !',
        usage1: 'Mettre à jour les infos de votre club',
        usage2: 'Créer vos équipes',
        usage3: 'Ajouter vos membres',
        usage4: 'Créer vos campagnes de cotisations',
        usage5: 'Publier vos événements',
        usage6: 'Rechercher des matchs',
        usage7: 'Communiquer à tous vos licenciés',
      },
      headerTitle: 'Abonnement',
      offers: {
        skip: 'Continuer gratuitement',
      },
      offersHeaderTitle: 'Changer d\'offre',
      onboardingHeaderTitle: 'Choisis ton offre',
      paywall: {
        recommended: 'Offre recommandee',
        remaining: 'Usages gratuits restants: {{count}}.',
        requiredPlan: 'Offre requise: {{plans}}.',
      },
      quota: {
        labels: {
          EVENT_PUBLISH: 'Événements',
          FREE_TEAM: 'Équipes',
          MATCH_PUBLISH: 'Matchs',
          RECRUITMENT_AD_PUBLISH: 'Recrutement',
        },
        remaining_one: '{{count}} offert restant',
        remaining_other: '{{count}} offerts restants',
        used: 'offert utilisé',
      },
      states: {
        club: 'Club · actif',
        clubUnverified: 'Club · actif',
        free: 'Gratuit',
        team: 'Équipe',
      },
      status: {
        club: 'Les droits Club sont actifs sur tout ton club.',
        clubUnverified: 'Tes droits Club sont actifs. Ton club est en cours de certification par la plateforme.',
        free: 'Tu utilises l\'offre gratuite FoundClub.',
        team: 'Tes équipes couvertes profitent des droits Équipe.',
      },
      title: 'Mon abonnement',
      unavailable: {
        description: "Cette action n'est pas disponible pour ce profil.",
        title: 'Action indisponible',
      },
    },
    subtitles: {
      address: 'Renseigne ta ville ou ton code postal',
      avatar: "Ajoute une photo de profil pour que l'on puisse te reconnaître facilement.",
      birthdate: 'Renseigne ta date de naissance.',
      identity: 'Renseigne ton nom, ton prénom et ta date de naissance.',
      identityPresident: 'La seule étape obligatoire du parcours dirigeant.',
      name: 'Renseigne ton nom et prénom.',
      section: 'Elle filtre les équipes et les annonces qui te concernent.',
      type: 'Ta fonction principale — tu pourras en ajouter d\'autres plus tard.',
    },
    title: 'Profil',
    titles: {
      address: 'Où habites-tu ?',
      avatar: 'Une photo de profil ?',
      birthdate: 'Quelle est ta date de naissance ?',
      edit: 'Modifier mes informations',
      identity: 'Qui es-tu ?',
      name: "Comment t'appelles-tu ?",
      profile: 'Mon compte',
      section: 'Dans quelle section joues-tu ?',
      type: 'Quel est ton statut ?',
      unified: 'Mon profil',
    },
    tutorial: {
      accountSwitcher: {
        description: 'Choisis un compte actif ou ajoute un nouveau compte connecté.',
      },
      logout: {
        description: 'Ce bouton lance la confirmation de déconnexion de ta session.',
      },
      mainActions: {
        // eslint-disable-next-line max-len
        description: 'Depuis cette zone, tu peux consulter ton profil, gérer tes demandes et changer de compte.',
        title: 'Actions profil',
      },
    },
    updateError: 'Impossible d\'enregistrer ton profil pour le moment. Vérifie ta connexion et réessaie.',
  },
  profileEdit: {
    errors: {
      birthdateFormat: 'Format attendu: JJ/MM/AAAA',
      required: 'Champ obligatoire',
      updateFailed: 'Impossible de mettre à jour ton profil.',
    },
    parentalDeclaration: {
      required: 'Cette confirmation est obligatoire pour enregistrer un profil de moins de 13 ans.',
    },
    tutorial: {
      form: {
        description: 'Mets à jour tes informations personnelles, sportives et ta visibilité.',
        title: 'Édition du profil',
      },
      save: {
        description: 'Enregistre tes modifications pour mettre à jour ton profil.',
        title: 'Enregistrer',
      },
    },
  },
  profileFiltersSheet: {
    allCities: 'Toutes les villes',
    allFeminine: 'Toutes',
    allMasculine: 'Tous',
    allSports: 'Tous les sports',
    category: 'Catégorie',
    categoryPlaceholder: 'Ex: Seniors, U17...',
    city: 'Ville',
    cityPlaceholder: 'Entre une ville',
    position: 'Poste',
    positionPlaceholder: 'Ex: Ailier, Gardien...',
    radius: 'Dans un rayon autour de : {{radius}} km',
    radiusLabel: 'Rayon de recherche',
    sport: 'Sport',
    sportPlaceholder: 'Ex: Football, Tennis...',
  },
  proposalMessageBubble: {
    actions: {
      accept: 'Accepter',
      counter: 'Contre-proposer',
      decline: 'Refuser',
    },
    badge: {
      accepted: 'Acceptee',
      declined: 'Refusee',
      pendingMine: 'En attente de réponse',
      pendingTheirs: 'En attente de ta réponse',
    },
    dateToBeDefined: 'Date à définir',
    rows: {
      category: 'Catégorie',
      date: 'Date',
      host: 'Qui reçoit',
      level: 'Niveau',
      section: 'Section',
      time: 'Heure',
      venue: 'Lieu',
    },
    title: {
      mine: 'Ta proposition',
      opponent: 'Proposition adverse',
    },
    venueToBeDefined: 'Lieu à définir',
    viewMatch: 'Voir la fiche match',
    viewVenue: 'Voir le lieu',
    waitingOpponent: 'En attente de la réponse adverse',
  },
  publicLicensePayment: {
    alerts: {
      checkoutError: {
        noLink: 'Aucun lien de paiement configure.',
      },
      declared: {
        message: 'Le club devra valider ce paiement.',
        title: 'Déclaration envoyée',
      },
      paused: {
        // eslint-disable-next-line max-len
        message: 'Cette campagne est temporairement suspendue. Le paiement reprendra quand le club la rouvrira.',
        title: 'Campagne en pause',
      },
    },
    campaign: {
      deadline: 'Date limite:',
      deadlineNotSet: 'Non définie',
      seasonFallback: 'Cotisation en cours',
      team: 'Equipe:',
      title: 'Campagne',
    },
    declareModal: {
      description: 'Choisis le moyen utilise pour prevenir le club.',
      title: 'Paiement hors app',
    },
    documents: {
      dueBefore: ' - Dépôt avant {{dueDate}}',
      empty: {
        description: 'Aucune pièce supplémentaire n est associée à ce lien.',
        title: 'Aucun document',
      },
      nameFallback: 'Document',
      optional: 'Facultatif',
      required: 'Obligatoire',
      title: 'Documents demandes',
    },
    error: {
      description: 'Impossible de charger ce lien de paiement pour le moment.',
      retry: 'Réessayer',
    },
    hero: {
      clubFallback: 'Club',
      memberFallback: 'Membre',
      title: 'Paiement cotisation',
    },
    installments: {
      title: 'Echeancier',
    },
    instructions: {
      title: 'Instructions du club',
    },
    invalidLink: {
      description: 'Le lien de paiement est incomplet.',
      title: 'Lien invalide',
    },
    loading: {
      description: 'On récupère les informations de paiement.',
      title: 'Chargement',
    },
    metrics: {
      paid: 'Paye',
      remaining: 'Reste',
      total: 'Total',
    },
    notFound: {
      description: 'Ce lien est introuvable ou n est plus disponible.',
    },
    paused: {
      // eslint-disable-next-line max-len
      description: 'Le dossier reste consultable, mais les paiements et déclarations sont bloques tant que le club n a pas repris cette campagne.',
      title: 'Campagne temporairement suspendue',
    },
    pay: {
      declareOffline: 'Déclarer un paiement hors app',
      description: 'Choisis le moyen propose par le club.',
      externalLink: 'Ouvrir le lien externe du club',
      helloAsso: 'Payer avec HelloAsso',
      title: 'Regler',
    },
    receipts: {
      amount: 'Montant',
      empty: {
        // eslint-disable-next-line max-len
        description: 'Le reçu apparaîtra après confirmation du paiement par le club ou le prestataire.',
        title: 'Pas encore de reçu',
      },
      number: 'Numero',
      status: 'Statut',
      title: 'Reçus déjà emis',
    },
    unavailable: {
      title: 'Paiement indisponible',
    },
  },
  rankingScreen: {
    drawsShort: 'N -',
    emptyHint: 'Change de division ou relance plus tard.',
    emptyTitle: 'Aucune équipe sur cette division.',
    loadError: 'Impossible de charger le classement League pour cette division.',
    loadingDescription: 'Chargement du classement League.',
    loadingTitle: 'Chargement du classement',
    lossesShort: 'D',
    retry: 'Réessayer',
    streak: 'Serie',
    streakDefeat: 'Defaite',
    teamColumn: 'Équipe',
    title: 'CLASSEMENT',
    unavailable: 'Classement indisponible',
    winsShort: 'V -',
  },
  recruitment: {
    invite: {
      action: 'Inviter dans l\'équipe',
      needsAccount: 'Cette personne n\'a pas encore de compte FoundClub : impossible de l\'inviter.',
      sent: 'Invitation envoyée',
    },
  },
  recruitmentAdCard: {
    applyHint: 'Postuler à cette annonce',
    categoryUnknown: 'Catégorie ?',
    coachAudience: 'ENTRAINEUR',
    coachRole: 'Rôle entraîneur',
    cta: {
      accepted: 'Je participe',
      acceptedCoach: 'Candidature acceptée',
      apply: 'Postuler',
      applyCoach: 'Candidater',
      inactive: 'Annonce inactive',
      pending: 'Demande en attente',
      sending: 'Envoi...',
    },
    detection: 'Détection',
    frameworkToDefine: 'Cadre à preciser',
    levelUnknown: 'Niveau ?',
    locationUnspecified: 'Lieu non précisé',
    openCategory: 'Catégorie libre',
    positionUnspecified: 'Poste non spécifié',
    status: {
      inactive: 'Inactive',
      online: 'En ligne',
    },
    unknownClub: 'Club inconnu',
  },
  recruitmentAdDetails: {
    actions: {
      delete: 'Supprimer',
      edit: 'Modifier',
      openDetection: 'Ouvrir la détection',
    },
    alerts: {
      acceptError: "Impossible d'accepter cette candidature pour le moment.",
      alreadyAccepted: 'Ta candidature est déjà validée pour cette annonce.',
      alreadyApplied: 'Tu as déjà postule à cette annonce.',
      alreadyParticipating: 'Tu participes déjà à cette détection.',
      alreadyPendingDetection: 'Tu as déjà une candidature en attente sur cette détection.',
      applicationsTitle: 'Candidatures',
      applicationTitle: 'Candidature',
      applyError: "Impossible d'envoyer la candidature pour le moment.",
      applySuccessBody: 'Ta candidature a bien été envoyée.',
      applySuccessTitle: 'Candidature envoyée',
      contactRequired: 'Ajoute au moins un numéro ou un email pour être recontacte.',
      declineError: 'Impossible de refuser cette candidature pour le moment.',
      invitationError: "Impossible d'envoyer l'invitation pour le moment.",
      invitationTitle: 'Invitation',
      updateError: 'Impossible de mettre à jour cette candidature pour le moment.',
      withdrawError: 'Impossible de retirer cette candidature pour le moment.',
      withdrawSuccess: 'Ta candidature a bien été retirée.',
    },
    candidates: {
      accept: 'Accepter',
      coachAvailability: 'Disponibilités : {{availability}}',
      coachCertifications: 'Certifications : {{certifications}}',
      decline: 'Refuser',
      empty: 'Aucune candidature pour le moment.',
      fallbackName: 'Candidat',
      loadErrorBody: 'Impossible de charger les candidatures pour le moment.',
      loadErrorTitle: 'Chargement impossible',
      loading: 'Chargement des candidatures...',
      reload: 'Recharger',
      slotTitle: 'Candidatures du poste ({{total}})',
      title: 'Candidatures ({{total}})',
      viewProfile: 'Voir le profil',
    },
    coachModal: {
      cancel: 'Annuler',
      emailLabel: 'Email',
      emailPlaceholder: 'Ton adresse email',
      footnote: 'Le club recevra ta candidature avec ton message, ton téléphone et ton email.',
      // eslint-disable-next-line max-len
      intro: 'Renseigne un message et au moins un moyen de contact pour permettre au club de te recontacter rapidement.',
      messageLabel: 'Message',
      // eslint-disable-next-line max-len
      messagePlaceholder: "Explique ton expérience, tes disponibilités ou ce que tu peux apporter a l'équipe.",
      phoneLabel: 'Telephone',
      phonePlaceholder: 'Ton numéro de téléphone',
      submit: 'Envoyer ma candidature',
      title: 'Candidater comme entraîneur',
    },
    coachProfile: {
      availability: 'Disponibilites',
      certifications: 'Certifications souhaitées',
      title: 'Profil entraîneur recherche',
    },
    declineConfirm: {
      body: 'Veux-tu vraiment refuser cette candidature ?',
      cancel: 'Annuler',
      confirm: 'Refuser',
      title: 'Refuser la candidature',
    },
    deleteModal: {
      body: 'Veux-tu vraiment supprimer cette annonce ? Cette action est irreversible.',
      cancel: 'Annuler',
      confirm: 'Supprimer',
      title: 'Supprimer cette annonce',
    },
    description: {
      empty: 'Aucune description fournie pour cette annonce.',
      missions: 'Missions',
      title: 'Description',
      titleCoach: 'Description et missions',
    },
    detectionModal: {
      cancel: 'Annuler',
      checking: 'Vérification de la détection en cours.',
      confirm: 'Participer',
      dateAtHour: '{{date}} a {{hour}}',
      summaryClub: 'Club concerne : {{club}}',
      summaryDate: 'Date de la détection : {{date}}',
      summaryPosition: 'Poste vise : {{position}}',
      title: 'Tu participes a une détection',
    },
    fallback: {
      category: 'Catégorie ?',
      coachRole: 'Rôle entraîneur',
      level: 'Niveau ?',
      positionUnspecified: 'Poste non specifie',
      unknownClub: 'Club inconnu',
    },
    footer: {
      applicationAccepted: 'Candidature acceptée',
      apply: 'Postuler',
      applyAsCoach: 'Candidater comme entraîneur',
      inactive: 'Annonce inactive',
      participating: 'Je participe',
      pending: 'Demande en attente',
      withdraw: 'Retirer ma candidature',
    },
    header: {
      statusInactive: 'INACTIF',
      statusOnline: 'EN LIGNE',
    },
    info: {
      category: 'Catégorie',
      level: 'Niveau',
      publishedOn: 'Publie le',
    },
    otherSlot: {
      // eslint-disable-next-line max-len
      acceptedBody: 'Tu participes déjà a un autre poste de cette détection. Les autres annonces gardent donc le même statut.',
      acceptedTitle: 'Participation déjà validée sur cette détection',
      // eslint-disable-next-line max-len
      pendingBody: 'Tu as déjà une demande en attente sur un autre poste de cette détection. Les autres annonces gardent donc le même statut.',
      pendingTitle: 'Candidature déjà envoyée sur cette détection',
    },
    owner: {
      posterCta: 'Avis de recherche',
    },
    state: {
      loadError: 'Chargement impossible',
      loading: 'Chargement...',
      notFound: 'Annonce introuvable',
      reload: 'Recharger',
      unavailableBody: 'Cette annonce n est plus disponible ou n a pas pu être chargée.',
    },
    status: {
      accepted: 'Accepte',
      declined: 'Refuse',
      pending: 'En attente',
    },
    tags: {
      detection: 'Detection',
      detectionWithDate: 'Détection · {{date}}',
    },
  },
  recruitmentAdEdit: {
    alerts: {
      coachRoleOtherRequired: 'Précise le rôle entraîneur recherche.',
      coachRoleRequired: 'Le rôle entraîneur est requis.',
      errorTitle: 'Erreur',
      ok: 'OK',
      positionRequired: 'Le poste est requis.',
      successTitle: 'Succès',
      updateError: "Impossible de mettre à jour l'annonce.",
      updateSuccess: "L'annonce a été mise à jour avec succès.",
    },
    coachExperience: {
      confirmed: 'Confirme',
      expert: 'Experimente',
      junior: 'Junior',
      qualified: 'Diplome',
    },
    coachRoles: {
      assistant: 'Entraîneur adjoint',
      fitness: 'Préparateur physique',
      goalkeeper: 'Entraîneur gardiens',
      main: 'Entraîneur·e principal·e',
      other: 'Autre rôle',
      teamManager: 'Team manager',
      videoAnalyst: 'Analyste vidéo',
    },
    engagement: {
      expenses: 'Indemnise',
      salaried: 'Salarie',
      toBeDefined: 'A définir',
      volunteer: 'Benevole',
    },
    form: {
      availability: 'Disponibilites',
      availabilityPlaceholder: 'Ex: soirs de semaine, mercredi, week-end...',
      category: 'Categorie',
      categoryPlaceholder: 'Sélectionner une catégorie',
      certifications: 'Certifications souhaitées',
      certificationsPlaceholder: 'Ex: BMF, BPJEPS, formation jeunes',
      coachExperience: 'Expérience attendue',
      coachRole: 'Rôle entraîneur',
      coachRoleOther: 'Autre rôle',
      coachRoleOtherPlaceholder: 'Précise le rôle recherche',
      coachRolePlaceholder: 'Sélectionner un rôle',
      description: 'Description',
      descriptionPlaceholder: 'Détails supplémentaires...',
      descriptionPlaceholderCoach: 'Contexte du club, projet, environnement...',
      engagementPlaceholder: 'Sélectionner un cadre',
      engagementType: "Type d'engagement",
      levelCoach: 'Niveau souhaite',
      levelPlaceholder: 'Sélectionner un niveau',
      levelPlayers: 'Niveau minimum',
      missions: 'Missions',
      missionsPlaceholder: "Cadre, responsabilités, projet d'équipe...",
      position: 'Poste',
      positionPlaceholder: 'Ex: Attaquant, Gardien...',
      quantityCoach: 'Nombre de profils recherches',
      quantityPlayers: 'Nombre de joueurs recherches',
      section: 'Section',
      sectionPlaceholder: 'Sélectionner une section',
      submit: 'Enregistrer les modifications',
      team: 'Équipe',
      unknownTeam: 'Équipe inconnue',
    },
    state: {
      loadErrorBody: 'Impossible de charger cette annonce.',
      loadErrorTitle: 'Chargement impossible',
      loadingBody: 'Préparation du formulaire d’édition.',
      loadingTitle: 'Chargement de l’annonce...',
      // eslint-disable-next-line max-len
      notFoundBody: 'Cette annonce n’est plus disponible ou ne peut pas etre modifiee depuis ce lien.',
      notFoundTitle: 'Annonce introuvable',
      reload: 'Recharger',
    },
    title: "Modifier l'annonce",
  },
  recruitmentAdFilters: {
    actions: {
      apply: 'Appliquer',
      clear: 'Effacer',
    },
    fields: {
      category: {
        label: 'Categorie',
        placeholder: 'Sélectionner une catégorie',
      },
      city: {
        label: 'Ville',
        placeholder: 'Ex: Marseille',
      },
      level: {
        label: 'Niveau',
        placeholder: 'Sélectionner un niveau',
      },
      position: {
        label: 'Poste',
        placeholder: 'Sélectionner un poste',
        placeholderFallback: 'Ex: Avant-centre',
      },
      section: {
        label: 'Section',
        placeholder: 'Sélectionner une section',
      },
      sport: {
        label: 'Sport',
        placeholder: 'Sélectionner un sport',
      },
    },
    headerTitle: 'Filtres annonces',
  },
  recruitmentFiltersSheet: {
    allCities: 'Toutes les villes',
    allFeminine: 'Toutes',
    allMasculine: 'Tous',
    allSports: 'Tous les sports',
    apply: 'Voir les résultats',
    audience: {
      all: 'Joueur·se·s et coachs',
      coach: 'Coachs',
      label: 'Profil',
      player: 'Joueur·se·s',
    },
    category: 'Catégorie',
    city: 'Ville',
    level: 'Niveau',
    reset: 'Réinitialiser',
    sport: 'Sport',
    title: 'Filtrer',
  },
  recruitmentProfilesList: {
    alerts: 'Alertes profils',
    backToFeed: 'Revenir au flux complet',
    clearFilters: 'Effacer les filtres profils',
    count: {
      many: '{{total}} profils',
      none: 'Aucun profil',
      one: '1 profil',
    },
    empty: {
      later: "Les profils ouverts a un club apparaîtront ici des qu'ils seront disponibles.",
      title: 'Aucun profil visible pour cette recherche.',
      widen: "Essaie d'elargir les filtres ou de simplifier la recherche.",
    },
    header: {
      // eslint-disable-next-line max-len
      default: 'Retrouve ici les joueurs et joueuses ouverts a un club pour construire ton recrutement.',
      filtered: 'Les filtres ci-dessous ciblent uniquement les profils ouverts à ton recrutement.',
      // eslint-disable-next-line max-len
      searching: 'Recherche en cours pour "{{search}}". Les profils les plus pertinents remontent en premier.',
    },
    pills: {
      filters: '{{total}} filtre(s)',
      fullFeed: 'Feed complet',
      noFilter: 'Sans filtre',
      searchActive: 'Recherche active',
    },
    searchLabel: 'Recherche et filtres profils',
    searchPlaceholder: 'Rechercher un profil...',
    title: 'Profils ouverts au recrutement',
  },
  recruitmentService: {
    errors: {
      createAd: "Impossible de créer l'annonce",
    },
  },
  recrutementListContent: {
    adsCount_one: '{{count}} annonce',
    adsCount_other: '{{count}} annonces',
    applications: {
      empty: 'Tu n’as pas encore postulé à une annonce.',
      title: 'Suivi de tes candidatures',
    },
    apply: {
      already: 'Tu as déjà postule à cette annonce.',
      alreadyAccepted: 'Ta candidature est déjà validée pour cette annonce.',
      alreadyInDetection: 'Tu participes déjà à cette détection.',
      error: 'Impossible d envoyer la candidature pour le moment.',
      inactive: 'Cette annonce n est plus active.',
      pendingDetection: 'Tu as déjà une candidature en attente sur cette détection.',
      sent: 'Ta candidature a bien été envoyée.',
      sentTitle: 'Candidature envoyée',
      title: 'Candidature',
    },
    audience: {
      all: 'Toutes',
      coach: 'Entraineurs',
      player: 'Joueurs',
    },
    completeProfile: {
      fields: 'Sport, section, catégorie, niveau.',
      open: 'Ouvrir',
      title: 'Compléter mon profil',
    },
    empty: {
      browseAll: "Tu peux déjà consulter toutes les annonces publiées sur l'application.",
      comeBack: 'Reviens un peu plus tard ou ajuste ta recherche.',
      completeProfile: 'Complète ton profil pour activer le tri personnalisé des annonces.',
      disableFilter: 'Désactive le filtre pour afficher toutes les annonces disponibles.',
      noMatch: 'Aucune annonce ne correspond exactement à ton profil pour le moment.',
      none: 'Aucune annonce disponible pour le moment.',
    },
    helper: {
      completeProfile: 'Complète ton profil pour activer un tri personnalisé.',
      matchesFirst: 'Les annonces compatibles restent affichées en tête.',
      matchesOnly: 'Le flux affiche uniquement les annonces compatibles.',
    },
    matchesOnlyToggle: 'Compatibles avec mon profil',
    matchReasons: {
      category: 'Catégorie compatible',
      city: 'Même ville',
      level: 'Niveau compatible',
      section: 'Section compatible',
      sport: 'Sport compatible',
    },
    priority: 'Prioritaires',
    publishOffer: {
      cta: '+ Publier une offre',
      label: 'Publier une offre de recrutement',
    },
    relevanceReason: 'Pertinence : {{reason}}',
    searchPlaceholder: 'Rechercher une annonce...',
    sections: {
      all: 'Toutes les annonces',
      matching: 'Correspondent à ton profil',
      other: 'Autres annonces',
    },
    sortedByRelevance: 'Trie par pertinence',
    tabs: {
      applications: 'Candidatures',
      opportunities: 'Opportunités',
      profiles: 'Profils',
    },
    unreachable: {
      description: 'Vérifie ta connexion, puis réessaie.',
      retry: 'Réessayer',
      title: 'On n’arrive pas à joindre le serveur.',
    },
  },
  register: {
    actions: {
      register: 'Continuer',
    },
    fields: {
      phoneNumber: {
        label: 'Numéro de téléphone',
        placeholder: '0612345678',
      },
    },
    subtitle: 'Renseigne ton numéro de téléphone.',
    title: 'Crée ton compte',
  },
  remindReport: {
    alreadyRemindedOn: 'Deja relance le {{date}}.',
    alreadyRemindedRecently: 'Deja relance il y a moins de 48 h.',
    canRemindFrom: ' Tu pourras relancer a partir du {{date}}.',
    everyoneAnswered: 'Tout le monde a deja repondu : il n y avait personne a relancer.',
    nobodyReminded: 'Personne n a ete relance',
    // eslint-disable-next-line max-len
    oneOtherAlreadyReminded: 'Une autre personne a deja ete relancee il y a moins de 48 h : elle ne recevra rien de plus.',
    // eslint-disable-next-line max-len
    othersAlreadyReminded: '{{blockedCount}} autres personnes ont deja ete relancees il y a moins de 48 h : elles ne recevront rien de plus.',
    remindedPeople_one: '{{count}} personne relancee',
    remindedPeople_other: '{{count}} personnes relancees',
    waitBetweenReminders: ' Il faut attendre 48 h entre deux relances.',
    willBeNotified: 'Elles vont recevoir une notification pour leur rappeler de repondre.',
  },
  requestFeedItem: {
    occupancy: '{{occupied}}/{{max}} slots occupes',
  },
  requestMappers: {
    club: {
      claim: '{{requester}} veut revendiquer la gestion du club {{club}}.',
      claimReview: 'Revendication en cours de vérification FoundClub.',
      claimTitle: 'Revendication club',
      claimTitleReadOnly: 'Revendication club en vérification',
      join: '{{requester}} demande une affiliation au club {{club}}.',
      joinTitle: 'Demande affiliation club',
    },
    clubFallback: 'Club',
    event: {
      validationTitle: 'Validation événement',
    },
    eventFallback: 'Evenement',
    facility: {
      // eslint-disable-next-line max-len
      subtitle: '{{team}} demande une place supplementaire sur {{facility}} ({{overlap}}/{{max}} slots deja pris).',
      title: 'Exception installation',
    },
    facilityFallback: 'Installation',
    featured: {
      forTarget: ' pour {{target}}',
      scope: {
        club: 'Club',
        multisport: 'Multisport',
        public: 'Public',
      },
      subtitle: '{{requester}} demande une mise à la une {{scope}}{{target}}.',
      title: 'Mise à la une {{scope}} - {{event}}',
    },
    friendly: {
      myTeamFallback: 'ton equipe',
      opponentFallback: 'Une equipe',
      received: '{{opponent}} propose un match à {{team}}.',
      receivedTitle: 'Proposition de match amical',
      sent: 'Envoyée à {{opponent}}. En attente de sa réponse.',
      sentTitle: 'Ta proposition de match',
    },
    interest: {
      childPlace: '{{requester}} demande une place pour {{child}} dans {{destination}}.',
      childPlaceTitle: 'Place pour un enfant',
      childWithAge: '{{firstname}} ({{age}} ans)',
      club: '{{requester}} est intéressé par le club {{club}}.',
      team: '{{requester}} est intéressé par {{team}}.',
      title: 'Intérêt club',
    },
    requesterFallback: 'Utilisateur',
    team: {
      asked: '{{requester}} a demandé à rejoindre {{team}}.',
      managerRequired: 'Un responsable autorisé doit traiter cette demande.',
      title: 'Demande adhésion équipe',
      titleReadOnly: 'Demande équipe en validation',
      waitForManagers: 'Ton équipe doit attendre la validation par ton ou tes dirigeant(s).',
      wantsToJoin: '{{requester}} souhaite rejoindre {{team}}.',
    },
    teamFallback: 'Equipe',
    teamInvite: {
      invited: '{{team}} est invitee a cet evenement.',
      invites: '{{organizer}} invite {{team}}.',
      myTeamFallback: 'Ton equipe',
      title: 'Invitation - {{event}}',
    },
  },
  requests: {
    approvedError: 'Impossible de valider cette demande pour le moment.',
    approvedSuccess: 'La demande est validée.',
    empty: 'Aucune demande en attente',
    emptyDescription: "Les prochaines validations de demandes d'événements apparaîtront ici.",
    rejectConfirmMessage: 'Cette demande sera refusée et la personne prévenue.',
    rejectConfirmTitle: 'Refuser cette demande ?',
    rejectedError: 'Impossible de refuser cette demande pour le moment.',
    rejectedSuccess: 'La demande est refusée.',
  },
  requestsDashboard: {
    item: {
      eventFallback: 'Événement',
      locationLabel: 'Lieu:',
      locationUndefined: 'Non défini',
      teamLabel: 'Équipe:',
      teamUnknown: 'Équipe inconnue',
    },
    loadError: {
      fallback: 'Réessaie dans quelques instants.',
      retry: 'Réessayer',
      title: 'Impossible de charger les demandes',
    },
    missingContext: {
      backToTeams: 'Retour aux équipes',
      description: 'Impossible de determiner pour quel club afficher les demandes.',
      title: 'Club introuvable',
    },
    onboarding: {
      description: 'Consulte puis valide ou refuse les demandes d événements en attente.',
      title: 'Demandes en attente',
    },
  },
  requestsHub: {
    actionError: 'Impossible de traiter la demande.',
    actions: {
      approveOverflow: 'Autoriser',
      open: 'Voir la proposition',
      openChat: 'Ouvrir chat',
      respond: 'Repondre',
      viewEvent: "Voir l'événement",
      viewProfile: 'Voir le profil',
      viewProfileHint: 'Ouvre le profil du demandeur',
    },
    assignNow: 'Assigner maintenant',
    // Y04 — LA FENETRE QUI DIT CE QUI VIENT DE CHANGER, demande d'Adel du
    // 2026-08-19. Une phrase par type de demande : « acceptée » ne dit pas si
    // quelqu'un est entré dans une équipe, si un match est confirmé, ou si un
    // créneau est accordé. La table qui les choisit vit dans
    // services/requests/requestAcceptanceCelebration.js.
    // ⚠️ `{{name}}` est remplacé À LA MAIN par l'écran : le repli passé en
    // second argument de `t` n'est pas interpolé par i18next.
    celebration: {
      close: 'Super',
      club: '{{name}} rejoint le club.',
      event: 'La participation est validée.',
      featured: "L'événement passe à la une.",
      friendly: 'Le match est confirmé.',
      installation: 'La place supplémentaire est accordée.',
      interest: 'Ta réponse est partie.',
      someone: 'Un nouveau membre',
      team: "{{name}} rejoint l'équipe.",
      title: 'Félicitations',
      unknown: 'La demande est acceptée.',
    },
    childInterest: {
      refuseMessage: 'La demande pour {{firstname}} sera effacée. Son parent sera prévenu.',
      refuseTitle: 'Refuser la demande ?',
    },
    clubAssignedMessage: "{{name}} a été ajouté au club. Veux-tu l'assigner à une équipe maintenant ?",
    clubAssignedTitle: 'Entraîneur ajouté',
    clubClaimAssignedMessage: '{{name}} a été ajouté comme dirigeant du club.',
    clubClaimAssignedTitle: 'Dirigeant ajouté',
    empty: 'Aucune demande en attente',
    filters: {
      all: 'Toutes',
      club: 'Club',
      event: 'Événement',
      featured: 'À la une',
      friendly: 'Amicaux',
      installation: 'Installation',
      interest: 'Interets',
      team: 'Équipe',
      teamInvite: 'Invitations',
    },
    forbidden: 'Cet onglet est réservé aux entraîneur·e·s et aux dirigeant·e·s.',
    installation: {
      defaultRefusalReason: 'Créneau complet, dépassement refuse par le dirigeant.',
      eventLabel: 'Evenement',
      refusalModalDescription: 'Explique pourquoi cette exception installation est refusée.',
      refusalModalPlaceholder: 'Exemple: capacité déjà atteinte pour ce créneau.',
      refusalModalTitle: 'Refuser la demande',
      refusalReasonRequired: 'Ajoute un motif pour refuser cette demande d installation.',
      summary: "Une équipe supplémentaire demande ce créneau sur l'installation.",
    },
    interest: {
      responseDescription: 'Choisis une réponse rapide à envoyer au joueur intéresse.',
      responseMissing: 'Choisis une réponse pour traiter cet intérêt.',
      responsePreview: 'Message envoyé',
      responseTitle: 'Répondre à cet intérêt',
      targetTeam: 'Équipe visee',
    },
    // S10-C — les invitations d'équipe reçues. Le libellé du bouton dit où l'on
    // va ET ce qu'on y fera : accepter et refuser vivent à UN seul endroit, la
    // section « Invitations d'équipe » de la fiche événement (décision D5).
    invitations: {
      respond: "Répondre à l'invitation",
    },
    loading: 'Chargement des demandes...',
    migratedBannerAction: "Ouvrir l'onglet Demandes",
    migratedBannerTitle: 'Ce flux a été migré vers Demandes.',
    partialError: 'Source indisponible',
    // eslint-disable-next-line max-len
    partialErrorDescription: 'Certaines demandes n ont pas pu être chargées. Le reste reste disponible.',
    partialErrorForbidden: 'Cette section n est pas disponible pour ce compte.',
    partialErrorLabel: 'indisponible',
    // Y04 — la bannière d'erreur n'avait AUCUN bouton : elle nommait la panne et
    // s'arrêtait là. Un 403 n'y arrive jamais (le service le laisse tomber en
    // silence), donc ce qui reste affiché est toujours réessayable.
    partialErrorRetry: 'Réessayer',
    partialErrorServer: 'Le chargement est temporairement indisponible. Réessaie dans un instant.',
    rejectEventMessage: 'L\'événement sera annulé.',
    rejectEventTitle: 'Refuser la demande ?',
    rejectFeaturedMessage: 'Le demandeur sera notifié du refus.',
    rejectFeaturedTitle: 'Refuser la demande ?',
    title: 'Demandes',
    types: {
      club: 'Club',
      event: 'Événement',
      featured: 'À la une',
      // R02 — ces trois-la manquaient : la banniere d'erreur les nommait
      // « Demande », le libelle fourre-tout. Une section indisponible qui ne dit
      // pas laquelle ne se diagnostique pas.
      friendly: 'Match amical',
      installation: 'Installation',
      interest: 'Intérêt',
      team: 'Équipe',
      teamInvite: 'Invitation',
      unknown: 'Demande',
    },
  },
  reservationFiltersSheet: {
    allCities: 'Toutes les villes',
    allSports: 'Tous les sports',
    noLimit: 'Sans limite',
  },
  reservationListContent: {
    activities: {
      all: 'Tous',
      basket: 'Basket',
      foot: 'Foot 5',
      tennis: 'Tennis',
    },
    book: 'Reserver',
    errors: {
      generic: 'Une erreur est survenue',
      join: 'Impossible de rejoindre cette réservation pour le moment.',
    },
    filterByActivity: 'Filtrer par activité',
    fromDate: 'Réservations à partir de',
    relevanceReason: 'Tri pertinence: {{reason}}',
    sortedByRelevance: 'Tri par pertinence',
  },
  reservationModeModal: {
    cancel: 'Annuler',
    confirm: 'Confirmer',
    errors: {
      noMode: 'Merci de sélectionner un mode',
    },
    fullGroup: {
      description: 'Tous les joueurs sont déjà trouvés',
      title: 'Je viens avec mon groupe complet',
    },
    recruiting: {
      description: "D'autres joueurs peuvent rejoindre",
      title: 'Je cherche des joueurs',
    },
    title: 'Comment souhaites-te participer ?',
  },
  rsvpActions: {
    absent: {
      body: 'Ton absence est enregistrée.',
      title: 'Absence confirmée',
    },
    actions: {
      absent: 'Absent',
      present: 'Present',
    },
    chatReply: {
      action: 'Repondre',
      placeholder: 'Ta réponse',
      send: 'Envoyer',
      sent: {
        body: 'Ta réponse a été envoyée.',
        title: 'Réponse envoyée',
      },
    },
    notFinalized: {
      body: "Ouvre l'application pour finaliser ta réponse.",
      title: 'Action non finalisée',
    },
    present: {
      body: 'Ta présence est enregistrée.',
      title: 'Présence confirmée',
    },
  },
  scoreFlow: {
    countdown: {
      days: '{{days}}j',
      lessThanMinute: "moins d'une minute",
    },
    primaryCta: {
      disputed: 'Traiter le litige',
      lockedBeforeStart: 'Score verrouillé',
      lockedNoVenue: 'Confirmer le terrain',
      opponentScorePending: 'Valider le score adverse',
      readyToSubmit: 'Saisir le score',
      submitted: 'Score saisi',
      valid: 'Résultat validé',
    },
  },
  search: {
    map: {
      addressPlaceholder: 'Tape une adresse ou une ville',
    },
  },
  searchAlerts: {
    actions: {
      create: 'Créer une alerte',
    },
    create: {
      desc: 'Donne un nom à ta recherche pour recevoir des notifications.',
      events: 'Un événement / Une réservation ?',
      profiles: 'Un profil ?',
      title: 'Créer une alerte',
    },
    deleteModal: {
      // eslint-disable-next-line max-len
      body: 'Cette action est irréversible. Tu ne recevras plus de notifications pour cette recherche.',
      cancel: 'Annuler',
      confirm: 'Supprimer',
      title: "Supprimer l'alerte ?",
    },
    empty: 'Aucune alerte enregistrée.\nCrée une alerte depuis les filtres de recherche.',
    errors: {
      title: 'Erreur',
      toggle: "Impossible de modifier l'alerte",
    },
    item: {
      search: 'Rechercher',
      staffOnly: 'Disponible uniquement sur un compte dirigeant ou entraîneur.',
    },
    profilesUnavailable: {
      editBody: 'Cette alerte profils n est plus modifiable sur un compte joueur.',
      // eslint-disable-next-line max-len
      launchBody: 'Cette alerte profils est visible uniquement sur un compte dirigeant ou entraîneur.',
      title: 'Alerte profils indisponible',
    },
    title: 'Mes Alertes',
    type: {
      events: 'Alerte événements',
      profiles: 'Alerte profils',
    },
    typeSelection: {
      desc: "Choisis le type d'alerte que tu souhaites créer.",
      title: 'Que recherches-tu ?',
    },
  },
  searchClubsScreen: {
    tutorial: {
      content: {
        description: 'Utilise la barre de recherche, les filtres et ouvre une fiche club.',
        title: 'Liste des clubs',
      },
      header: {
        description: 'Retrouve ici la recherche complète de clubs.',
        title: 'Recherche club',
      },
      switcher: {
        description: 'Bascule rapidement entre les differentes recherches.',
        title: 'Types de recherche',
      },
    },
  },
  searchCountdown: {
    title: 'TEMPS DE RECHERCHE',
  },
  searchEventsScreen: {
    tutorial: {
      finish: 'Terminer',
      finishLabel: 'Terminer le tutoriel',
      next: 'Suivant',
      nextLabel: 'Étape suivante',
      previous: 'Précédent',
      previousLabel: 'Étape précédente',
      skip: 'Passer',
      skipLabel: 'Passer le tutoriel',
      steps: {
        cards: {
          // eslint-disable-next-line max-len
          description: 'Chaque carte affiche les détails. Appuie sur "À propos" pour ouvrir la fiche.',
          title: 'Résultats',
        },
        filters: {
          description: 'Utilise la recherche texte et les filtres avancés pour affiner.',
          title: 'Filtres événement',
        },
        intro: {
          description: 'Cet écran te permet de trouver les événements selon tes critères.',
          title: 'Recherche événement',
        },
        types: {
          description: 'Les chips en haut servent à changer rapidement de type de recherche.',
          title: 'Types de recherche',
        },
      },
    },
  },
  searchHubScreen: {
    reservations: {
      // eslint-disable-next-line max-len
      comingSoonBody: "La réservation de terrains et d'installations arrive très vite. Reste connecté, on te préviendra dès son ouverture.",
      comingSoonTitle: 'Bientôt disponible',
    },
  },
  searchMap: {
    badges: {
      club: 'Club',
      event: 'Événement',
      multisport: 'Omnisport',
      reservation: 'Réservation',
    },
    empty: {
      clubs: 'Aucun club géolocalisable pour le moment.',
      events: 'Aucun événement géolocalisable pour le moment.',
      reservations: 'Aucune réservation géolocalisable pour le moment.',
    },
    noCoordinates: {
      clubs_one: "{{count}} club trouvé, mais aucun n'a de position exploitable sur la carte.",
      clubs_other: "{{count}} clubs trouvés, mais aucun n'a de position exploitable sur la carte.",
      // eslint-disable-next-line max-len
      events_one: "{{count}} événement trouvé, mais aucun n'a de position exploitable sur la carte.",
      // eslint-disable-next-line max-len
      events_other: "{{count}} événements trouvés, mais aucun n'a de position exploitable sur la carte.",
      // eslint-disable-next-line max-len
      reservations_one: "{{count}} réservation trouvée, mais aucune n'a de position exploitable sur la carte.",
      // eslint-disable-next-line max-len
      reservations_other: "{{count}} réservations trouvées, mais aucune n'a de position exploitable sur la carte.",
    },
    price: {
      free: 'Gratuit',
      perPerson: '{{price}}€ / pers',
    },
    resultLabel: {
      club: 'club',
      clubs: 'clubs',
      event: 'événement',
      events: 'événements',
      reservation: 'réservation',
      reservations: 'réservations',
    },
    tapMarker: 'Touche un repère pour voir la fiche',
  },
  searchMapCopy: {
    errors: {
      // eslint-disable-next-line max-len
      invalidApiKey: 'La clé TomTom utilisée par ce build n’est pas validé ou n’a pas accès à Map Display API.',
      // eslint-disable-next-line max-len
      invalidTileRequest: 'La requête envoyée au provider cartographique est invalide. Vérifie la configuration TomTom.',
      // eslint-disable-next-line max-len
      leafletUnavailable: 'Le moteur cartographique n’a pas pu démarrer correctement dans ce build.',
      // eslint-disable-next-line max-len
      missingApiKey: 'La clé TomTom est manquante pour ce build. Ajoute TOMTOM_API_KEY avant de tester la carte.',
      // eslint-disable-next-line max-len
      networkError: 'Le réseau de la carte est indisponible pour le moment. Vérifie la connexion puis réessaie.',
      // eslint-disable-next-line max-len
      providerUnavailable: 'Le service cartographique TomTom est momentanément indisponible. Réessaie plus tard.',
      rateLimited: 'Le quota TomTom a été atteint pour le moment. Réessaie un peu plus tard.',
      // eslint-disable-next-line max-len
      tilesNotResponding: 'Les tuiles TomTom ne répondent pas pour le moment. Réessaie ou reviens à la liste.',
      // eslint-disable-next-line max-len
      tilesUnavailable: 'La carte a démarré, mais aucune tuile exploitable n’a pu être chargée. Réessaie ou reviens à la liste.',
      webViewError: 'Le moteur web de la carte a échoué au chargement. Ferme puis rouvre la carte.',
      // eslint-disable-next-line max-len
      webViewProcessGone: 'Le moteur web de la carte a été interrompu. Recharge la carte ou reviens à la liste.',
    },
    loading: {
      body: 'Nous préparons l’affichage cartographique de tes résultats géolocalisés.',
      title: 'Chargement de la carte',
    },
    searchArea: {
      search: 'Rechercher dans cette zone',
      updating: 'Mise à jour…',
    },
    updatingResults: 'Mise à jour des résultats…',
  },
  searchMapFab: {
    backToList: 'Revenir à la liste',
    hint: 'Bascule entre la liste et la carte.',
    switchToMap: 'Passer en mode carte',
  },
  searchMapGeolocationSource: {
    permission: {
      allow: 'Autoriser',
      cancel: 'Annuler',
      later: 'Plus tard',
      message: 'Nous avons besoin de ta position pour afficher les résultats autour de toi.',
      title: 'Permission de localisation',
    },
  },
  searchMapHud: {
    locateMe: 'Me localiser',
    markers: {
      geolocatable: '{{total}} geolocalisables',
      none: 'Aucun repère',
      noneVisible: 'Aucun repère visible',
      tap: 'Touche un repère',
      updating: 'Mise à jour des repères...',
      visible: '{{total}} repères visibles',
      zoomToSeeAll: 'Zoome pour tout voir',
    },
    recenter: 'Recentrer',
  },
  searchMapPreviewCard: {
    hide: 'Masquer',
    open: 'Ouvrir',
    openNamed: 'Ouvrir {{title}}',
    openSheet: 'Ouvrir la fiche',
    showList: 'Voir la liste',
  },
  searchMapScreen: {
    actions: {
      filters: 'Filtres',
      list: 'Liste',
    },
    chips: {
      from: 'Dès le',
      maxBudget: 'Budget max {{amount}}€',
      open: 'Ouverts',
      query: 'Recherche : {{query}}',
      until: 'Jusqu’au',
    },
    heading: {
      clubs: 'Clubs',
      events: 'Evenements',
      reservations: 'Reservations',
    },
    hints: {
      clubsZoom: 'Zoome pour afficher tous les clubs de cette zone.',
      clubsZoomOrCity: 'Zoome ou recherchez une ville pour afficher les clubs.',
      eventsZoom: 'Zoome pour afficher tous les événements de cette zone.',
      eventsZoomOrArea: 'Zoome ou recherchez une zone plus précise pour afficher les événements.',
    },
    unavailable: {
      clubs: 'Impossible de mettre à jour les clubs pour le moment.',
      events: 'Impossible de mettre à jour les événements pour le moment.',
      reservations: 'Impossible de mettre à jour les réservations pour le moment.',
      title: 'Recherche indisponible',
    },
  },
  searchRecruitmentScreen: {
    tutorial: {
      content: {
        // eslint-disable-next-line max-len
        description: 'Utilise les onglets Annonces et Mes candidatures pour suivre tes opportunités.',
        // eslint-disable-next-line max-len
        descriptionStaff: 'Utilise les onglets Profils, Opportunités, Mes annonces et Mes candidatures pour piloter ton recrutement.',
        title: 'Contenu recrutement',
      },
      header: {
        description: 'Retrouve ici les annonces de recrutement et le suivi de tes candidatures.',
        // eslint-disable-next-line max-len
        descriptionStaff: 'Retrouve ici les profils, les opportunités de recrutement et les annonces de tes équipes.',
        title: 'Recherche recrutement',
      },
      switcher: {
        description: 'Change de type de recherche en un geste.',
        title: 'Types de recherche',
      },
    },
  },
  searchReservationsScreen: {
    tutorial: {
      content: {
        description: 'Filtre par activité et critères avancés pour trouver une réservation.',
        title: 'Liste des réservations',
      },
      header: {
        description: 'Accèdes ici aux réservations de terrains et installations.',
        title: 'Recherche réservations',
      },
      switcher: {
        description: 'Le switch permet de passer ? un autre type de recherche.',
        title: 'Types de recherche',
      },
    },
  },
  searchService: {
    matchReason: {
      activity: "Correspond à l'activité",
      city: 'Correspond à la ville',
      club: 'Correspond au club',
      description: 'Correspond à la description',
      location: 'Correspond au lieu',
      locationFuzzy: 'Lieu proche de la recherche',
      nameExact: 'Correspondance exacte du nom',
      nameFuzzy: 'Nom proche de la recherche',
      namePrefix: 'Correspondance du nom',
      nearby: 'A proximite',
      team: 'Correspond à l équipe',
    },
  },
  select: {
    placeholder: 'Sélectionner',
  },
  selectAvatar: {
    errors: {
      camera: "Impossible d'ouvrir la caméra : {{message}}",
      gallery: "Impossible d'ouvrir la galerie : {{message}}",
      title: 'Erreur',
    },
  },
  selectPicker: {
    placeholder: 'Sélectionner',
  },
  share: {
    errors: {
      webUnavailable: 'Le partage web n est pas disponible dans ce navigateur.',
    },
  },
  shareCompositionModal: {
    player: 'Joueur',
    // eslint-disable-next-line max-len
    teamLineUpStartersSee: "📋 Composition d'équipe\n\n⚽ Titulaires ({{playerCount}}):\n- {{starters}}\n\nRetrouve le détail sur FoundClub !",
  },
  // L16 — chaque bouton dit CE QU'ON OBTIENT (un fichier, un format), jamais un
  // verbe abstrait. `share` porte desormais le geste principal : envoyer l'AFFICHE.
  showcase: {
    ad: {
      fieldCible: 'Cible',
      fieldMention: 'Mention',
      fieldNiveau: 'Niveau',
      fieldPoste: 'Poste',
      fieldQrLabel: 'Texte sous le QR code',
      fieldRecompense: 'Accroche',
      placeholderCible: 'Joueur·se',
      placeholderCibleClub: 'Ce club est',
      placeholderMention: 'recherché·e',
      placeholderMentionClub: 'recherché.',
      placeholderNiveau: 'Tous niveaux',
      placeholderPoste: 'Ailier · Meneur',
      placeholderQrLabel: "Scanne si c'est toi",
      placeholderQrLabelClub: "Scanne si c'est ton club",
      placeholderRecompense: 'Une équipe qui compte sur toi, chaque week-end.',
      placeholderRecompenseClub: 'Ton club, enfin géré en un seul endroit.',
      shareIntro: 'On recrute, rejoins l’équipe !',
      shareLabel: 'Voir l’annonce',
      subtitle: 'Fais-le voir. Plus il est vu, plus vite tu trouves.',
      title: 'Ton avis de recherche est prêt',
    },
    // AA08 : la croix de sortie, en haut a droite. L'ecran est `headerShown: false`
    // et n'avait aucune sortie visible en haut (constat d'Adel du 2026-08-20).
    close: 'Fermer',
    club: {
      fieldQrLabel: 'Texte sous le QR code',
      fieldSports: 'Sports (séparés par ·)',
      fieldTitre: 'Titre',
      fieldTitreAccent: 'Accroche',
      placeholderQrLabel: 'Scanne pour nous rejoindre',
      placeholderSports: 'Football · Rugby · Handball',
      placeholderTitre: 'Ici, on joue',
      placeholderTitreAccent: 'ensemble.',
      shareIntro: 'Viens nous rejoindre au club !',
      shareLabel: 'Voir le club',
      subtitle: 'Fais-la voir. Plus elle est vue, plus on te rejoint.',
      title: 'Ton affiche club est prête',
    },
    customize: 'Personnaliser le texte',
    customizeHint: 'Modifie les textes avant de télécharger. Laisse vide pour garder le texte proposé.',
    downloadError: 'Le téléchargement a échoué. Vérifie ta connexion et réessaie.',
    error: 'Le visuel n\'a pas pu être généré.',
    // X01 : le titre héros des gabarits Tournoi et Neutre. Le serveur ne PEUT PAS
    // connaître le titre d'un événement (`event.name` est réécrit en « Type - date
    // - Équipe » à chaque enregistrement) : c'est ici que l'organisateur l'écrit.
    evenement: {
      placeholderTitre: 'Notre événement',
    },
    fieldEquipe: 'Équipe',
    fieldLieu: 'Lieu',
    fieldNiveau: 'Niveau',
    fieldQrLabel: 'Texte sous le QR code',
    fieldTitre: 'Titre',
    fieldTitreAccent: 'Accroche',
    // T04 : le « encore {{seconds}} s environ » de S07 est PARTI. La mesure du
    // 2026-08-17 va de 3,1 s à 22,9 s selon la charge du serveur (renderProgress.js) :
    // aucun nombre n'était vrai, et le dépassement se déclenchait à tous les coups.
    // La phrase dit qu'on travaille, elle ne promet plus de durée.
    generating: 'Ton affiche se fabrique…',
    // 🔒 La phrase de l'attente ANORMALE — au-delà du pire cas mesuré (13 s). Elle
    // parle du temps DÉJÀ écoulé, la seule chose que le téléphone sache vraiment,
    // et elle reste vraie à la 60e seconde.
    generatingLonger: 'Ton affiche se fabrique toujours — c’est plus long que d’habitude.',
    later: 'Plus tard',
    // R05 : sur Android, « ouvrir avec » ne transporte que l'image — le texte est
    // mis dans le presse-papiers. On le DIT, sinon personne ne pense à le coller.
    messageCopied: 'Le texte est copié : colle-le avec l’image.',
    // Android : la feuille de partage de React Native jette le fichier (cf. L20).
    // Le geste devient « enregistrer, puis ouvrir avec » — les libellés le disent.
    openWith: 'Ouvrir l’affiche avec…',
    otherFormats: 'Autres formats : story, A4 à imprimer',
    placeholderQrLabel: 'Scanne pour participer',
    placeholderQrLabelDecouverte: 'Scanne pour essayer',
    placeholderTitre: 'Viens montrer',
    placeholderTitreAccent: 'ce que tu vaux.',
    placeholderTitreAccentDecouverte: 'tu vas aimer.',
    placeholderTitreDecouverte: 'Viens essayer,',
    poster: 'Affiche A4 à imprimer',
    posterHint: 'Fichier PDF, prêt pour l’imprimante du club.',
    posterHintSave: 'Fichier PDF enregistré dans tes téléchargements, '
      + 'prêt pour l’imprimante du club.',
    // T04 : la story (9:16) et l'A4 sont d'AUTRES images que l'aperçu 4:5 — le
    // serveur DOIT les fabriquer. Sans cette phrase, l'attente ressemblait à une
    // régénération inutile de ce qu'on a déjà sous les yeux, donc à un bug.
    preparingOtherFormat: 'On prépare la version à partager — '
      + 'c’est une autre image que celle à l’écran.',
    // AA08 : le serveur de rendu a refuse de fabriquer le fichier (HTTP >= 400).
    // ⛔ Ne JAMAIS retomber ici sur « verifie ta connexion » : l'apercu vient
    // d'arriver par le meme reseau, la panne est ailleurs.
    renderError: 'L’affiche n’a pas pu être fabriquée par le serveur. '
      + 'Réessaie dans un instant.',
    reset: 'Réinitialiser',
    retry: 'Réessayer',
    save: 'Enregistrer l’affiche',
    savedDownloads: 'C’est enregistré dans tes téléchargements.',
    savedGallery: 'C’est enregistré dans ta galerie photo.',
    saveError: 'L’enregistrement a échoué. '
      + 'Il reste peut-être trop peu de place sur ton téléphone.',
    saveHint: 'Elle part dans ta galerie photo, telle que tu la vois. '
      + 'Tu choisis ensuite l’application qui l’ouvre.',
    savePermissionError: 'FoundClub n’a pas le droit d’enregistrer dans ton téléphone. '
      + 'Autorise-le dans les réglages, puis réessaie.',
    sendInChat: 'Envoyer dans une conversation',
    sendInChatHint: 'Directement dans une discussion FoundClub.',
    share: 'Envoyer l’affiche',
    shareHint: 'L’image part telle que tu la vois. Dans la fenêtre de partage, tu peux aussi l’enregistrer dans ton téléphone.',
    shareIntro: 'Viens participer à notre détection / séance d’essai !',
    // D94/C2 : le message de partage suit le TYPE de l'événement. `shareIntro`
    // ci-dessus reste le défaut du gabarit (club, annonce, lien profond sans type).
    shareIntroByType: {
      detection: 'Viens participer à notre détection / séance d’essai !',
      entrainement: 'Rendez-vous à l’entraînement !',
      match: 'Viens nous encourager pour ce match !',
      neutre: 'Voici notre prochain événement !',
      reservation: 'Voici les infos de cette réservation.',
      stage: 'Découvre notre stage !',
      tournoi: 'Viens vivre notre tournoi !',
    },
    shareLabel: 'Voir l’événement',
    sharePoster: 'Partager l’affiche',
    story: 'Version story 9:16',
    storyHint: 'Image verticale plein écran, pour Instagram, WhatsApp ou Snap.',
    storyHintSave: 'Image verticale plein écran, enregistrée dans ta galerie, '
      + 'pour Instagram, WhatsApp ou Snap.',
    subtitle: 'Fais-le voir. Plus il est vu, plus tu remplis.',
    title: 'Ton événement est en ligne',
    variantHint: 'Choisir le style {{label}}',
  },
  smartNotificationHost: {
    defaultBody: 'Nouvelle mise à jour.',
    defaultTitle: 'Notification league',
    lineup: {
      description: 'Ton match est dans 2 jours. Souhaites-te publier la composition maintenant ?',
      later: 'Plus tard',
      publish: 'Publier la compo',
      title: 'Publier la compo',
    },
  },
  squad: {
    filters: {
      city: 'Ville de référence',
      cityPlaceholder: 'Ex: Marseille',
      clear: 'Effacer',
      title: 'Filtres Squad',
    },
    invitation: {
      acceptMessage: 'Tu as rejoint la squad.',
      acceptTitle: 'Invitation acceptée',
      declineMessage: 'Tu as decline cette invitation.',
      declineTitle: 'Invitation refusée',
      error: 'Impossible de répondre a l invitation.',
    },
    inviteLink: {
      acceptMessage: 'Tu as rejoint la squad.',
      acceptTitle: 'Squad rejointe',
      error: 'Impossible de rejoindre la squad avec ce lien.',
      // eslint-disable-next-line max-len
      loginMessage: 'Connecte-toi ou crée ton compte pour rejoindre cette squad avec le lien d invitation.',
      loginTitle: 'Connexion requise',
    },
    join: {
      cancelError: "Impossible d'annuler la demande.",
      cancelSuccessMessage: 'Ta demande à rejoindre la squad a bien été annulée.',
      cancelSuccessTitle: 'Demande annulée',
      error: "Impossible d'envoyer la demande.",
      successMessage: 'Le capitaine a reçu ta demande.',
      successTitle: 'Demande envoyée',
    },
    search: {
      title: 'Trouver une Squad',
    },
  },
  squadAvailabilitiesStep: {
    addSlot: '+ Ajouter un créneau',
    back: 'Retour',
    continue: 'Continuer',
    days: {
      friday: 'Vendredi',
      monday: 'Lundi',
      saturday: 'Samedi',
      sunday: 'Dimanche',
      thursday: 'Jeudi',
      tuesday: 'Mardi',
      wednesday: 'Mercredi',
    },
    empty: 'Ajoute tes créneaux réguliers pour faciliter le matchmaking.',
    slot: {
      remove: 'Supprimer',
    },
    slotFormOpen: {
      body: 'Valide ou annule le popup « Ajouter un créneau » avant de continuer.',
      title: 'Popup ouvert',
    },
    title: 'Quand ton équipe joue-t-elle habituellement ?',
  },
  squadCategoryStep: {
    back: 'Retour',
    continue: 'Continuer',
    senior: 'Senior',
    // eslint-disable-next-line max-len
    seniorOnly: 'FoundClub League est réservé aux squads Senior. Les catégories jeunes ne sont pas disponibles dans ce mode.',
    title: 'Catégorie League',
  },
  squadDetails: {
    actions: {
      deleteTeam: 'Supprimer la squad',
      deleteTeamError: 'Impossible de supprimer la squad.',
      edit: 'Modifier',
      editTeam: 'Modifier la squad',
      invitePlayer: 'Inviter un joueur',
      leaveTeamError: 'Impossible de quitter la squad.',
      menuDescription: 'Choisis une action.',
      menuTitle: 'Actions squad',
      openRequests: 'Voir les demandes',
      requests: 'Demandes',
      unavailableTitle: 'Action non disponible',
    },
    captains: {
      addAction: 'Ajouter comme capitaine',
      addHint: 'Tu gardes ton rôle et la squad peut avoir plusieurs capitaines.',
      addSuccess: '{{name}} est maintenant capitaine avec toi.',
      addTitle: 'Ajouter un capitaine',
      assignButton: 'Nommer',
      assignError: 'Impossible de mettre à jour les capitaines.',
      assignSuccessTitle: 'Capitaines mis à jour',
      modalDescription: 'Choisis comment donner le rôle de capitaine a {{name}}.',
      modalTitle: 'Assigner capitaine',
      transferAction: 'Transferer le capitanat',
      transferHint: '{{name}} devient le seul capitaine de la squad.',
      transferSuccess: '{{name}} devient le seul capitaine de la squad.',
      transferTitle: 'Laisser ma place',
    },
    defaultName: 'Squad',
    delete: {
      confirmationWithName: 'Es-tu sûr de vouloir supprimer la squad "{{teamName}}" ? Cette action est irréversible.',
      title: 'Supprimer la squad',
    },
    join: {
      pending: 'Demande en attente...',
      request: 'Demander à rejoindre',
    },
    labels: {
      locationUnknown: 'Localisation non renseignée',
    },
    leave: {
      title: 'Quitter la squad',
    },
    roster: {
      captain: 'Capitaine',
      player: 'Joueur',
      removeAction: 'Retirer',
      removeError: 'Impossible de retirer ce joueur.',
      removeTitle: 'Retirer le joueur',
      title: 'Effectif',
      unknownPlayer: 'Joueur',
    },
    slots: {
      added: 'Créneau ajouté',
      addTitle: 'Ajouter un créneau',
      deleteConfirm: 'Veux-tu vraiment supprimer ce créneau ?',
      deleted: 'Créneau supprimé',
      deleteError: 'Impossible de supprimer le créneau',
      editTitle: 'Modifier le créneau',
      joinHint: 'Rejoins la squad pour participer aux créneaux.',
      multipleAdded: '{{count}} créneaux ajoutés',
      saveError: 'Impossible de sauvegarder le créneau',
      statusError: 'Impossible de modifier ton statut.',
      updated: 'Créneau modifié',
    },
  },
  squadDetailsScreen: {
    actionCard: {
      awaits_one: 'attend',
      awaits_other: 'attendent',
      captain: {
        addSlot: 'Ajouter un créneau',
        invitePlayer: 'Inviter un joueur',
        manageSlots: 'Gérer les créneaux',
        nextSlot: 'Prochain créneau: {{nextSlotLongLabel}}',
        noSlot: 'Ajoute un premier créneau pour rendre la squad active.',
        title: 'Pilote ta squad',
        titlePending: 'Ta squad attend ta validation',
        viewRequests: 'Voir les demandes',
      },
      invited: {
        accept: 'Accepter',
        decline: 'Refuser',
        // eslint-disable-next-line max-len
        description: "Une invitation t'attend. Accepte-la pour rejoindre la squad et participer aux prochains créneaux.",
      },
      inviteLink: {
        // eslint-disable-next-line max-len
        description: "Ce lien t'invite à rejoindre directement la squad. Confirme pour être ajoute a l effectif.",
        title: 'Invitation squad',
      },
      member: {
        confirm: 'Confirme ta présence sur {{nextSlotLongLabel}}.',
        noSlot: 'Aucun créneau défini pour le moment. Reviens bientôt ou contacte le capitaine.',
        title: 'Ton prochaine action',
        viewStats: 'Voir les stats',
      },
      open: {
        noSlot: "Rejoins cette squad pour accéder aux créneaux et à l'effectif complet.",
        title: 'Rejoins cette squad',
        withSlot: 'La squad vit déjà autour de {{nextSlotLongLabel}}. Rejoins-la pour participer.',
      },
      pending: {
        cancel: 'Annuler la demande',
        // eslint-disable-next-line max-len
        description: "Ta demande est bien envoyée. Tu peux déjà consulter les créneaux et l'effectif.",
        title: 'Ta demande est en attente',
      },
      requests_one: 'demande',
      requests_other: 'demandes',
      viewRoster: "Voir l'effectif",
      viewSlots: 'Voir les créneaux',
      yourApproval: 'ta validation.',
    },
    back: 'Retour',
    captain: 'Capitaine',
    captainQueue: {
      body: 'attendent ta réponse. Ouvre la file pour accepter ou refuser rapidement.',
      title: 'Validation capitaine en attente',
      view: 'Voir',
    },
    captainsLabel_one: 'Capitaine',
    captainsLabel_other: 'Capitaines',
    competition: {
      highestStreak: 'Meilleure série',
      rank: 'Classement',
      rankPending: 'En attente',
      record: 'Bilan',
      recordValue: '{{wins}}V {{draws}}N {{losses}}D',
      reliability: 'Fiabilite',
      streak: 'Serie',
      streakLoss: 'Defaite',
    },
    dateToBeDecided: 'Date à définir',
    days: {
      friday: 'Vendredi',
      monday: 'Lundi',
      saturday: 'Samedi',
      sunday: 'Dimanche',
      thursday: 'Jeudi',
      tuesday: 'Mardi',
      wednesday: 'Mercredi',
    },
    daysShort: {
      friday: 'Ven',
      monday: 'Lun',
      saturday: 'Sam',
      sunday: 'Dim',
      thursday: 'Jeu',
      tuesday: 'Mar',
      wednesday: 'Mer',
    },
    errorTitle: 'Erreur',
    joinHelper: {
      inviteLink: 'Ce lien te permet de rejoindre directement la squad',
      pending: 'Ta demande attend la validation du capitaine',
      request: 'Envoyer une demande au capitaine de la squad',
    },
    joinSquad: 'Rejoindre la squad',
    legalTargetFallback: 'Squad League',
    nextSlot: {
      addSlot: 'Ajoute un créneau pour lancer ton rythme.',
      day: 'Jour',
      upcoming: 'A venir',
    },
    nextSlotAction: {
      captain: 'Animer la squad',
      member: 'Confirmer ma présence',
    },
    opponentFallback: 'Adversaire',
    photo: {
      cancel: 'Annuler',
      error: "Impossible de mettre à jour l'image",
      gallery: 'Galerie',
      subtitle: 'Choisis une option',
      title: 'Modifier la photo',
    },
    reports: {
      captainRating: 'Capitaine {{rating}}/10',
      draft: 'Brouillon équipe',
      lastResponse: 'Dernière réponse le {{date}}',
      latestTitle: 'Derniers matchs renseignes',
      matchFallback: 'Match League',
      newResponseOne: 'Nouvelle réponse',
      newResponsesMany: '{{count}} nouvelles réponses',
      pending: 'En attente',
      pendingTitle: 'Réponses joueur en attente de validation équipe',
      playersRating: 'Joueurs {{rating}}/10',
      published: 'Publie',
      responses: '{{responded}}/{{eligible}} joueurs ont repondu',
    },
    requestPending: 'Demande en attente',
    requestToJoin: 'Demander à rejoindre',
    results: {
      draw: 'Nul',
      loss: 'Defaite',
      pending: 'En attente',
      win: 'Victoire',
    },
    resync: {
      action: 'Resynchroniser l équipe source',
      error: "Impossible de resynchroniser l'équipe source pour le moment.",
      successBody: "L'équipe source a été resynchronisee dans League.",
      successTitle: 'Synchronisation terminée',
    },
    roster: {
      activeHint: 'Le groupe est actif: pense à traiter les demandes et inviter les bons profils.',
      // eslint-disable-next-line max-len
      introCaptain: 'Retrouve les capitaines, les membres actifs et ajuste la responsabilité de la squad.',
      introMember: 'Vois qui compose déjà la squad et identifie rapidement les capitaines.',
      // eslint-disable-next-line max-len
      stableHint: 'Le groupe est stable. Tu peux encore inviter des joueurs pour enrichir la squad.',
    },
    share: {
      aSquad: ' une squad',
      aSquadShort: 'une squad',
      introAnonymous: 'Rejoins{{squadPart}} sur FoundClub League.',
      // eslint-disable-next-line max-len
      introFromInviter: "{{inviterName}} t'invite à rejoindre sa squad{{squadSuffix}} sur FoundClub League.",
      linkLabel: 'Ouvrir dans FoundClub',
      theSquad: ' la squad {{squadName}}',
      titleAnonymous: 'Rejoins {{squadName}}',
      titleFromInviter: "{{inviterName}} t'invite",
    },
    signals: {
      members: 'Membres',
      requests: 'Demandes',
      status: 'Statut',
    },
    slots: {
      confirmed: 'Confirmes',
      introCaptain: 'Ajoute et anime tes créneaux pour rendre la squad visible et active.',
      introMember: 'Consulte les prochains créneaux et confirme ta présence en un geste.',
      missing: 'Manquants',
      next: 'Prochain créneau',
      none: 'Aucun créneau programmé',
    },
    slotStatus: {
      almost: {
        badge: 'Presque prêt',
        helper_one: 'Encore {{count}} présence pour atteindre le format ideal.',
        helper_other: 'Encore {{count}} présences pour atteindre le format ideal.',
      },
      none: {
        badge: 'Aucun créneau',
        helper: 'Ajoute un créneau pour donner un premier point de rendez-vous à la squad.',
      },
      ready: {
        badge: 'Prêt à jouer',
        helper: 'Le prochain créneau est complet. La squad a déjà assez de monde pour se lancer.',
      },
      weak: {
        badge: 'A renforcer',
        // eslint-disable-next-line max-len
        helper_one: 'Seulement {{count}} présence pour le moment. Il faut encore mobiliser la squad.',
        // eslint-disable-next-line max-len
        helper_other: 'Seulement {{count}} présences pour le moment. Il faut encore mobiliser la squad.',
      },
    },
    states: {
      // eslint-disable-next-line max-len
      errorDescription: 'Impossible de charger cette squad League pour le moment. Relance le chargement ou reviens à la recherche.',
      errorTitle: 'Chargement impossible',
      loadingDescription: 'Chargement de la fiche squad et des signaux League.',
      loadingTitle: 'Chargement de la squad',
      // eslint-disable-next-line max-len
      missingId: "L'identifiant de la squad est manquant. Ouvre la fiche depuis la recherche League ou le dashboard.",
      notFound: 'Squad introuvable',
      retry: 'Réessayer',
      unavailableDescription: "Cette squad League est introuvable ou n'est plus disponible.",
      unavailableTitle: 'Squad indisponible',
    },
    statistics: 'Statistiques',
    statisticsMode: {
      football: 'Football complet',
    },
    stats: {
      assists: 'Passes décisives',
      cleanSheets: '{{cleanSheets}} clean sheets - {{goalsAgainst}} buts encaissés',
      competition: 'Compétition League',
      competitionRecord: 'Bilan compétition',
      cumulativeScore: 'Score cumule',
      cumulativeScoreValue: 'Score cumule: {{scoreFor}} - {{scoreAgainst}}',
      goals: 'Buts',
      // eslint-disable-next-line max-len
      hintFootball: 'La squad suit ici sa compétition League, ses derniers matchs et les retours post-match publiés.',
      // eslint-disable-next-line max-len
      hintPadel: 'La squad voit déjà ses résultats, son historique et ses indicateurs League. Les statistiques post-match détaillées padel arriveront dans un lot dédié.',
      history: 'Historique des matchs',
      // eslint-disable-next-line max-len
      introFootball: 'Retrouve tes indicateurs League et les statistiques post-match de la squad au même endroit.',
      // eslint-disable-next-line max-len
      introPadel: 'Suis ton bilan League, ta position dans la division et l historique récent de la squad.',
      loadingHistory: 'Chargement de l historique...',
      matches: 'Matchs',
      matchPerformance: 'Performance match',
      noMatches: 'Aucun match League joue pour le moment.',
      noPerformance: 'Aucune performance de match disponible pour le moment.',
      // eslint-disable-next-line max-len
      padelV1: 'Cet espace suit déjà les résultats League, ton classement et ton historique. Les statistiques post-match détaillées pour le padel ne sont pas encore actives dans cette V1.',
      playerFallback: 'Joueur',
      playerLine: '{{goals}} buts - {{assists}} passes - {{minutes}} min',
      playerMatches: '{{count}} matchs',
      players: 'Joueurs',
      viewAll: 'Voir tout',
    },
    status: {
      invitationReceived: 'Invitation reçue',
      member: 'Membre',
      openSquad: 'Squad ouverte',
    },
    summary: {
      next: 'Prochain',
      roster: 'Effectif',
      slots: 'Créneaux',
    },
    toBeDecided: 'À définir',
  },
  squadEditScreen: {
    alerts: {
      errorBody: 'Impossible de mettre à jour la squad',
      errorTitle: 'Erreur',
      invalidAddressBody: 'Sélectionne une adresse avec des coordonnées valides.',
      invalidAddressTitle: 'Adresse invalide',
      successBody: 'Squad mise à jour',
      successTitle: 'Succès',
    },
    backToSquads: 'Retour aux squads',
    cancel: 'Annuler',
    fields: {
      category: 'Catégorie',
      categoryHint: 'FoundClub League est réservé aux squads Senior.',
      homeBase: 'QG (Adresse principale)',
      homeBasePlaceholder: 'Rechercher une adresse',
      name: 'Nom de la Squad',
      namePlaceholder: 'Ex: Les Invincibles',
      radius: 'Rayon de déplacement',
      radiusHint: "Distance max pour tes matchs à l'extérieur",
      selectPlaceholder: 'Sélectionner',
    },
    headerTitle: 'Éditer la Squad',
    loadError: {
      description: 'Impossible de charger cette squad pour le moment.',
      title: 'Chargement impossible',
    },
    loading: {
      description: "Préparation du formulaire d'édition de la squad.",
      title: 'Chargement de la squad',
    },
    missing: {
      description: "Cette squad n'existe plus ou n'est pas accessible depuis ce lien.",
    },
    missingId: {
      description: "Aucune squad n'est associée à ce lien d'édition.",
    },
    notFound: 'Squad introuvable',
    reload: 'Recharger',
    save: 'Enregistrer',
    sections: {
      female: 'Féminin',
      male: 'Masculin',
      mixed: 'Mixte',
    },
  },
  squadFiltersScreen: {
    activeFilters_one: 'filtre actif',
    activeFilters_other: 'filtres actifs',
    apply: 'Appliquer les filtres',
    category: 'Catégorie',
    radiusHint: 'Choisis une ville pour activer le rayon.',
    radiusLabel: 'Dans un rayon de',
    sections: {
      female: 'Feminin',
      male: 'Masculin',
      mixed: 'Mixte',
    },
    // eslint-disable-next-line max-len
    seniorHint: 'Les squads FoundClub League sont filtrées automatiquement sur la catégorie Senior.',
    seniorOnly: 'Senior uniquement',
  },
  squadImageStep: {
    back: 'Retour',
    continue: 'Continuer',
    cover: {
      hint: "Fond des cartes de l'équipe",
      title: 'Photo de couverture',
    },
    logo: {
      hint: 'Apparaît sur les classements et profils',
      title: 'Logo',
    },
    title: "Identité de l'équipe",
  },
  squadLevelStep: {
    back: 'Retour',
    continue: 'Continuer',
    levels: {
      advanced: 'Confirmé (Compétition)',
      beginner: 'Débutant (Amateur)',
      expert: 'Expert (Semi-Pro)',
      intermediate: 'Intermédiaire (Habitué)',
    },
    placeholder: 'Sélectionner un niveau',
    subtitle: 'Cela nous aidera à te placer dans la bonne division intiale.',
    title: 'Quel est ton niveau ?',
  },
  squadLocationStep: {
    back: 'Retour',
    continue: 'Continuer',
    placeholder: 'Rechercher une ville...',
    radius: {
      hint: "C'est la distance max que tu es prêt à parcourir pour un match.",
      title: 'Rayon de recherche',
    },
    title: 'Où joues-tu ?',
  },
  squadNameStep: {
    back: 'Retour',
    check: {
      available: 'Nom disponible.',
      checking: 'Vérification du nom...',
      error: 'Impossible de vérifier le nom maintenant. Réessaie.',
      taken: 'Ce nom est déjà pris. Choisis un autre nom.',
    },
    continue: 'Continuer',
    placeholder: 'Ex: FC Les Champions',
    suggestions: 'Suggestions disponibles',
    title: 'Quel est le nom de ta squad ?',
  },
  squadRequestsScreen: {
    back: 'Retour',
    errorState: {
      // eslint-disable-next-line max-len
      description: "Impossible de charger les demandes d'adhésion pour cette squad. Vérifie la connexion puis relance.",
      title: 'Chargement impossible',
    },
    feedback: {
      accepted: 'Demande acceptée.',
      declined: 'Demande refusée.',
      error: 'Impossible de traiter cette demande.',
    },
    loading: 'Chargement...',
    loadingState: {
      description: "Chargement des demandes d'adhésion de la squad League.",
      title: 'Chargement des demandes',
    },
    missingId: {
      // eslint-disable-next-line max-len
      description: "L'identifiant de la squad est manquant. Ouvre les demandes depuis la fiche squad ou le dashboard League.",
      title: 'Squad introuvable',
    },
    newRequest: 'Nouvelle demande',
    noPending: 'Aucune demande en attente',
    pendingCount: 'demande(s) en attente',
    playerFallback: 'Joueur',
    retry: 'Réessayer',
    unavailable: {
      description: "Cette squad League est introuvable ou n'est plus disponible.",
      title: 'Squad indisponible',
    },
    wantsToJoin: 'Souhaite rejoindre ta squad.',
  },
  squadSearchScreen: {
    activeFilters: 'Filtres actifs:',
    categoryFallback: 'Categorie',
    detectedStatuses: 'Statuts detectes:',
    editFilters: 'Modifier les filtres',
    empty: {
      hint: "Essaie avec d'autres filtres ou un autre nom de squad.",
      title: 'Aucune squad trouvée',
    },
    filters: 'Filtres',
    footer: {
      available: 'Ouvre la fiche pour envoyer ta demande',
      invited: 'Invitation à traiter en priorité',
      joined: 'Accès rapide à ta squad League',
      pending: 'Le capitaine doit encore te répondre',
    },
    retry: 'Réessayer',
    search: 'Rechercher',
    searchError: 'Erreur de recherche. Réessaie.',
    searching: 'Recherche des squads...',
    searchPlaceholder: 'Nom de squad ou ville',
    sections: {
      female: 'Feminin',
      male: 'Masculin',
      mixed: 'Mixte',
    },
    status: {
      available: {
        action: 'Demander à rejoindre',
        badge: 'DISPONIBLE',
        helper: 'Squad ouverte aux demandes de nouveaux joueurs.',
      },
      invited: {
        action: 'Répondre a l invitation',
        helper: "Une invitation t'attend sur cette squad.",
      },
      joined: {
        action: 'Voir ma squad',
        badge: 'MEMBRE',
        helper: 'Tu fais déjà partie de cette squad.',
      },
      pending: {
        action: 'Voir la demande',
        badge: 'EN ATTENTE',
        helper: 'Ta demande est en attente de validation.',
      },
    },
    // eslint-disable-next-line max-len
    statusesError: 'Impossible de charger tes statuts personnels League. La recherche reste disponible.',
    statusesHint: 'Les invitations et demandes en attente remontent en premier.',
    summary: {
      invited_one: '{{count}} invitation',
      invited_other: '{{count}} invitations',
      joined_one: '{{count}} déjà membre',
      joined_other: '{{count}} déjà membres',
      pending_one: '{{count}} demande en attente',
      pending_other: '{{count}} demandes en attente',
    },
    unknownCity: 'Ville inconnue',
  },
  squadSectionStep: {
    back: 'Retour',
    continue: 'Continuer',
    loadError: 'Impossible de charger les sections League pour le moment.',
    placeholder: 'Sélectionner une section',
    title: 'Pour quelle section ?',
  },
  squadSourceTeamStep: {
    back: 'Retour',
    continue: 'Continuer',
    importError: "Impossible d'importer cette équipe pour le moment.",
    placeholder: 'Sélectionner une équipe',
    sections: {
      female: 'Feminin',
      male: 'Masculin',
      mixed: 'Mixte',
    },
    subtitle: 'Choisis ton équipe classique pour recuperer le nom et les membres dans League.',
    teamFallback: 'Equipe',
    title: 'Quelle équipe importer ?',
  },
  squadSportStep: {
    back: 'Retour',
    continue: 'Continuer',
    loadError: 'Impossible de charger les sports League pour le moment.',
    placeholder: 'Sélectionner un sport',
    reload: 'Recharger',
    title: 'Quel est ton sport ?',
  },
  squadSummaryStep: {
    back: 'Retour',
    days: {
      friday: 'Vendredi',
      monday: 'Lundi',
      saturday: 'Samedi',
      sunday: 'Dimanche',
      thursday: 'Jeudi',
      tuesday: 'Mardi',
      wednesday: 'Mercredi',
    },
    identity: {
      category: 'Catégorie',
      location: 'Localisation',
      name: "Nom de l'équipe",
      notSpecified: 'Non spécifié',
      radius: 'Rayon :{{radius}} km',
      section: 'Section',
      sport: 'Sport',
      title: 'Identité',
    },
    intro: 'Voici le récapitulatif de ta Squad. Tout est bon ?',
    save: 'Enregistrer',
    slots: {
      empty: 'Aucun créneau défini',
      title: 'Créneaux ({{total}})',
    },
    submitError: 'Création impossible',
  },
  stepper: {
    progress: 'Étape {{filled}} sur {{total}}',
  },
  subscriptionBilling: {
    clubCoverage: {
      unlimited: 'un nombre illimité de licenciés',
      upTo: "jusqu'à {{licenseeCap}} licenciés du club",
    },
    clubOfferAvailability: {
      higherOffer: 'Ton club a déjà une offre supérieure',
      sameOffer: 'Ton club a déjà cette offre',
    },
    clubOfferDescription: 'Débloque les droits club sur tout ton club.',
    clubRights: 'Droits Club',
    clubTierShortUnlimited: 'illim.',
    coveredByClub: 'Déjà couverte par ton club',
    errors: {
      // eslint-disable-next-line max-len
      clubAlreadyCovered: 'Ce club est déjà couvert par une offre Club active (souscrite par un autre membre). Inutile de payer deux fois : les droits sont partages.',
      clubRequired: 'Rattache d abord le bon club avant de prendre une offre Club.',
      generic: 'Impossible de mettre à jour ton abonnement pour le moment.',
      // eslint-disable-next-line max-len
      missingTransactionId: 'Le store ne nous a pas transmis le numéro de ta transaction. Ton paiement est bien enregistré chez lui : tes droits s ouvriront automatiquement, et « Restaurer mes achats » les débloque tout de suite.',
      // eslint-disable-next-line max-len
      storeSourceUnknown: 'Le store ne reconnaît pas cet abonnement sur ton compte. Vérifie que tu es connecté au même compte App Store ou Google Play qu au moment de l achat, puis réessaie.',
      // eslint-disable-next-line max-len
      subscriptionSourceNotFound: 'Nous n avons pas retrouvé l abonnement à changer sur ce compte. Ton achat est bien enregistré par le store : ouvre « Mon abonnement » puis « Restaurer mes achats ».',
      // eslint-disable-next-line max-len
      teamAlreadyCovered: 'Cette équipe est déjà couverte par une autre offre active. Choisis une équipe non couverte ou libere sa place actuelle.',
      // eslint-disable-next-line max-len
      teamCoveredByClubPlan: "Cette équipe est déjà couverte par l'offre Club de son club : tu as déjà ces droits, inutile de payer une offre Équipe pour elle.",
      // eslint-disable-next-line max-len
      teamSlotCountExceeded: 'Cette offre n a pas assez de places pour couvrir autant d équipes. Ajuste la sélection avant de continuer.',
      // eslint-disable-next-line max-len
      teamSlotDuplicate: 'Une même équipe ne peut pas être attribuée deux fois à la même offre Équipe.',
      // eslint-disable-next-line max-len
      webPlanChangeClosed: 'Le changement d offre web public n est pas encore ouvert sur cet environnement.',
    },
    monthlyEquivalent: 'soit {{amount}} {{currency}}/mois',
    period: {
      monthly: 'Mensuel',
      yearly: 'Annuel',
    },
    periodSuffix: {
      monthly: '/mois',
      yearly: '/an',
    },
    perMemberTotal_one: '{{count}} licencié × {{unitLabel}} = {{totalLabel}}',
    perMemberTotal_other: '{{count}} licenciés × {{unitLabel}} = {{totalLabel}}',
    teamOfferDescription: 'Publie et gère les équipes couvertes par ton offre Équipe.',
    teamSlotsCovered_one: '{{count}} équipe couverte',
    teamSlotsCovered_other: '{{count}} équipes couvertes',
    trialHandover: {
      deadline: " (il court jusqu'au {{date}})",
      // eslint-disable-next-line max-len
      notice: "Ton essai gratuit est en cours{{deadline}}. L'offre que tu choisis est facturée tout de suite par ton magasin et prend le relais immédiatement : ton club garde ses droits sans coupure.",
    },
    unitPrice: '{{amountLabel}} par licencié',
  },
  subscriptionCompare: {
    columns: {
      club: 'Club',
      perMonth: '{{price}}/mois',
      startingPrice: 'dès {{price}}',
    },
    rows: {
      clubCertification: {
        label: 'Certification du club',
      },
      clubFees: {
        label: 'Cotisations du club',
      },
      clubProfileRoles: {
        label: 'Fiche club & rôles',
      },
      coveredTeams: {
        club: 'Toutes',
        label: 'Équipes couvertes',
      },
      eventsMatches: {
        free: 'Limités',
        label: 'Événements & matchs',
      },
      facilitiesBookings: {
        label: 'Installations & réservations',
      },
      lineUpCallUps: {
        label: 'Composition & convocations',
      },
      recruitmentAds: {
        free: 'Limitées',
        label: 'Annonces de recrutement',
      },
      sponsorsPartners: {
        label: 'Sponsors & partenaires',
      },
      teamFees: {
        label: "Cotisations de l'équipe",
      },
    },
  },
  subscriptionCoveredHero: {
    actions: {
      opening: 'Ouverture…',
      writeTo: 'Écrire à {{displayName}}',
    },
    alerts: {
      chatError: {
        message: 'Impossible de démarrer cette conversation pour le moment.',
        title: 'Messagerie',
      },
    },
    offers: {
      club: 'Offre Club',
      clubLicensee: 'Offre Club au licencié · équipes illimitées',
      clubTier1: "Offre Club 100 · jusqu'à 100 licenciés",
      clubTier2: "Offre Club 500 · jusqu'à 500 licenciés",
      clubTier3: "Offre Club 1000 · jusqu'à 1 000 licenciés",
      clubTier4: 'Offre Club Illimité · licenciés illimités',
      foundclub: 'Offre FoundClub',
      team_one: 'Offre Équipe · {{count}} équipe',
      team_other: 'Offre Équipe · {{count}} équipes',
    },
    payer: {
      fallbackName: 'Un membre',
    },
    renewalInline: 'renouvellement le {{renewalDate}}',
    renewalNewLine: 'Renouvellement le {{renewalDate}}',
    title: {
      club: '{{firstname}} paie pour tout le club',
      team: '{{firstname}} paie pour cette équipe',
    },
    unlockedChip: 'Tout est débloqué pour toi',
    // eslint-disable-next-line max-len
    upgradeHint: "Besoin d'une équipe de plus ? {{firstname}} peut passer au palier supérieur en 1 tap.",
  },
  subscriptionDecision: {
    accessDenied: 'Accès refuse',
    benefits: {
      addTeamsAsNeeded: 'Ajoute autant d équipes que besoin',
      allClubTeamsCovered: 'Toutes les équipes du club couvertes',
      allTeamsUnlimitedEvents: 'Toutes tes équipes, événements illimités',
      applicationsInMessages: 'Candidatures directement dans tes messages',
      callupsTwoTaps: 'Convocations envoyées en 2 taps',
      callWholeTeamTwoTaps: 'Convoque toute ton équipe en 2 taps',
      clubRightsCentralised: 'Droits club et gestion centralisée',
      collectEachTeamFee: 'Encaisse la cotisation de chaque équipe',
      existingMembersKeepAll: 'Les membres deja inscrits gardent tout',
      fullTeamManagement: 'Gestion complète de chaque équipe',
      lineupCallups: 'Composition et convocations',
      lineupCallupsTwoTaps: 'Composition et convocations en 2 taps',
      oneClickReminders: 'Relances des membres en un clic',
      onlyNewMembershipsPaused: 'Seules les NOUVELLES adhesions sont en pause',
      realTimeAttendance: 'Présences en temps réel, relances auto',
      simpleAttendanceTracking: 'Suivi des présences simplifie',
      simplePaymentTracking: 'Suivi des paiements simplifie',
      teamFeeInApp: "Cotisation de l'équipe encaissée dans l'app",
      templateLineupCallups: 'Composition type et convocations en 2 taps',
      unlimitedContacts: 'Contacts sans limite',
      unlimitedEventsMatches: 'Événements et matchs illimités',
      unlimitedFeeCampaigns: 'Campagnes de cotisation illimitées',
      unlimitedFeesRecruitment: 'Cotisations et recrutement illimités',
      unlimitedMatchesEvents: 'Matchs et événements illimités',
      unlimitedRecruitmentAds: 'Annonces de recrutement illimitées',
      upgradeTierToReopen: 'Passe a la tranche superieure pour rouvrir',
      visibilityWithPlayers: 'Visibilité aupres des joueurs',
      visibleToAreaPlayers: 'Visible par tous les joueurs de ta zone',
      wholeTeamBenefits: 'Toute l équipe en profite',
      wholeTeamBenefitsSheet: "Toute l'équipe en profite",
    },
    clubFull: {
      counts: ' Ton club compte {{members}} pour {{licensees}}.',
      licensees_one: '{{count}} licencié souscrit',
      licensees_other: '{{count}} licenciés souscrits',
      members_one: '{{count}} membre',
      members_other: '{{count}} membres',
    },
    clubSheet: {
      kicker: 'Offre Club',
      successCta: 'Reprendre',
    },
    clubTierNames: {
      unlimited: 'Illimité',
    },
    entryPointHints: {
      eventPublish: "Ton événement gratuit est déjà en ligne — débloque l'offre Équipe",
      freeTeam: "Ta création gratuite est utilisée — débloque l'offre Équipe",
      matchPublish: "Ton match gratuit est déjà en ligne — débloque l'offre Équipe",
      recruitmentAdPublish: "Ton annonce gratuite est déjà en ligne — débloque l'offre Équipe",
    },
    paywall: {
      clubLicenseeLimit: {
        cta: 'Passer à la tranche supérieure',
        // eslint-disable-next-line max-len
        description: 'Les nouvelles adhésions sont en pause : ton club a atteint le nombre de licenciés couverts par son abonnement.{{countsSentence}} Les membres déjà inscrits gardent tout.',
        title: 'Ton club est complet',
      },
      clubRoles: {
        description: 'La gestion des rôles et des droits du club est réservée a l offre Club.',
        title: 'Rôles club reserves',
      },
      clubTierTeamLimit: {
        // eslint-disable-next-line max-len
        description: 'Ton offre Club a atteint son nombre maximum d équipes. Passe au palier supérieur pour ajouter de nouvelles équipes.',
        title: 'Limite d équipes atteinte',
      },
      composition: {
        description: 'La composition d équipe est réservée a l offre Équipe.{{requiredPlanSuffix}}',
        title: 'Composition réservée',
      },
      default: {
        description: 'Cette action demande une offre FoundClub active.{{requiredPlanSuffix}}',
        title: 'Abonnement FoundClub requis',
      },
      dues: {
        // eslint-disable-next-line max-len
        description: 'La création de campagnes de cotisation demande une offre active.{{requiredPlanSuffix}}',
        title: 'Cotisations réservées',
      },
      event: {
        // eslint-disable-next-line max-len
        description: 'Tu as atteint la limite gratuite de publication d événements.{{requiredPlanSuffix}}',
        title: 'Publication d événement limitée',
      },
      facility: {
        description: 'La gestion des installations du club est réservée a l offre Club.',
        title: 'Installations réservées',
      },
      match: {
        // eslint-disable-next-line max-len
        description: 'Tu as atteint la limite gratuite de publication de match.{{requiredPlanSuffix}}',
        title: 'Publication de match limitée',
      },
      recruitment: {
        // eslint-disable-next-line max-len
        description: 'Cette publication de recrutement demande une offre active.{{requiredPlanSuffix}}',
        title: 'Publication recrutement limitée',
      },
      sponsor: {
        description: 'La gestion des sponsors du club est réservée a l offre Club.',
        title: 'Sponsors reserves',
      },
      team: {
        description: 'La création d équipe demande une offre active.{{requiredPlanSuffix}}',
        title: 'Création d équipe limitée',
      },
      viewSubscription: 'Voir mon abonnement',
    },
    planLabel: {
      club: 'Club / {{period}}',
      clubLicensee: 'Club au licencié / {{period}}',
      clubTier: 'Club {{tierName}} / {{period}}',
      none: 'Aucune offre active',
      team_one: 'Équipe · {{count}} équipe / {{period}}',
      team_other: 'Équipe · {{count}} équipes / {{period}}',
    },
    planPeriods: {
      month: 'mois',
      year: 'an',
    },
    quotaLabels: {
      events: 'Evenements',
      matches: 'Matchs',
      recruitment: 'Recrutement',
      teams: 'Equipes',
    },
    quotaSheet: {
      composition: {
        successCta: 'Préparer ma compo',
        title: "La composition d'équipe est réservée à l'offre Équipe",
      },
      event: {
        successCta: 'Publier mon événement',
        title: 'Tu veux publier un 2ᵉ événement ?',
      },
      kickerTeamOffer: 'Offre Équipe',
      match: {
        successCta: 'Publier mon match',
        title: 'Tu veux publier un 2ᵉ match ?',
      },
      recruitment: {
        successCta: 'Publier mon annonce',
        title: 'Tu veux publier une 2ᵉ annonce ?',
      },
      team: {
        successCta: 'Créer ma 2ᵉ équipe',
        title: 'Tu veux créer une 2ᵉ équipe ?',
      },
      teamOfferUnlock: {
        successCta: "C'est parti !",
        title: "Débloque tes outils d'équipe",
      },
    },
    reasons: {
      authRequired: 'Connexion requise',
      clubTierLimitReached: 'Limite d équipes de ton offre Club atteinte',
      freeIncluded: 'Inclus dans l offre gratuite',
      freeQuotaAvailable: 'Quota gratuit disponible',
      freeQuotaExhausted: 'Quota gratuit épuisé',
      subscriptionRequired: 'Abonnement requis',
    },
    requiredPlanLabels: {
      team: 'Équipe',
    },
    requiredPlanSuffix: ' Offre conseillée: {{requiredPlanText}}.',
    requiredPlanText: {
      many: '{{others}} ou {{last}}',
      two: '{{first}} ou {{second}}',
    },
    statusMeta: {
      club: {
        description: 'Les droits Club sont actifs sur tout ton club.',
      },
      clubActive: 'Club · actif',
      clubUnverified: {
        // eslint-disable-next-line max-len
        description: 'Tes droits Club sont actifs. Ton club est en cours de certification par la plateforme.',
      },
      free: {
        description: 'Tu utilises actuellement les quotas gratuits FoundClub.',
        label: 'Gratuit',
      },
      team: {
        description: 'Les droits Équipe sont ouverts sur les équipes couvertes.',
        label: 'Équipe',
      },
    },
  },
  subscriptionOffers: {
    alerts: {
      browserCheckout: {
        // eslint-disable-next-line max-len
        message: 'Termine le paiement dans la page qui vient de s ouvrir, puis reviens ici. Tes droits s ouvrent dans la minute qui suit.',
        title: 'Paiement ouvert dans ton navigateur',
      },
      checkoutUnavailable: {
        // eslint-disable-next-line max-len
        message: "Le paiement in-app n'est pas disponible sur ce build. Mets l'app à jour puis réessaie.",
        title: 'Checkout indisponible',
      },
      clubRequired: {
        clubPlanMessage: 'Rattache d abord ton compte a un club avant de prendre une offre Club.',
        // eslint-disable-next-line max-len
        licenseeMessage: 'Rattache d abord ton compte a un club : c est sur lui que se compte le nombre de licenciés.',
        title: 'Club requis',
      },
      licenseeCountRequired: {
        message: 'Indique combien de licenciés ton club doit couvrir avant de continuer.',
        title: 'Nombre de licenciés requis',
      },
      slotsFull: {
        message_one: 'Cette offre couvre {{count}} équipe maximum.',
        message_other: 'Cette offre couvre {{count}} équipes maximum.',
        title: 'Toutes les places sont prises',
      },
      subscriptionError: {
        title: 'Erreur abonnement',
      },
      teamRequired: {
        noSelection: 'Sélectionne au moins une équipe à couvrir avec cette offre Équipe.',
        noTeam: 'Ajoute ou rattache d abord une équipe avant de prendre une offre Équipe.',
        title: 'Équipe requise',
      },
    },
    billingPeriods: {
      monthly: 'Mensuel',
      yearly: 'Annuel',
    },
    cards: {
      club: {
        allMembers: 'tous les licenciés du club',
        empty: 'Aucune offre Club pour cette période.',
        lead: "Tout ce que fait l'offre Équipe, pour {{coverage}}, plus :",
        legend: 'Taille du club',
        licenseeHelper: 'Tous les membres du club comptent : joueurs, coachs et dirigeants.',
        tagline: 'Pour les dirigeants — équipes illimitées, sans limite',
        taglineCoverage: 'Pour les dirigeants — équipes illimitées, {{clubCoverageLabel}}',
      },
      free: {
        tagline: 'Pour découvrir FoundClub',
      },
      team: {
        empty: 'Aucune offre Équipe pour cette période.',
        legend: 'Équipes couvertes',
        tagline: 'Pour les coachs — ta ou tes équipes',
      },
    },
    catalog: {
      loading: 'Chargement du catalogue abonnement...',
    },
    chips: {
      certificationIncluded: 'Certification incluse',
      currentPlan: 'Ton offre actuelle',
      popular: 'Populaire',
    },
    clubPricingModes: {
      licensee: 'Au licencié',
      tier: 'Par palier',
    },
    cta: {
      active: {
        sub: 'Change de palier ou de période pour la remplacer.',
      },
      choose: 'Choisir {{familyLabel}} · {{priceLabel}}',
      free: {
        currentSub: 'Publie en quantité limitée, sans carte bancaire.',
        manageInStore: 'Gérer dans le store',
        storeSub: 'Le retour au gratuit se gère dans ton store.',
      },
      licensee: {
        enterCount: 'Indique ton nombre de licenciés',
        pendingSub: 'Le prix se calcule sur le nombre de licenciés de ton club.',
        // eslint-disable-next-line max-len
        readySub: 'Le paiement s ouvre dans ton navigateur. Équipes illimitées, résiliable a tout moment.',
        subscribe: 'Souscrire · {{total}}',
      },
      locked: {
        higherOnly: 'Seule une offre supérieure peut la remplacer.',
        label: 'Déjà couvert par ton club',
        paidByOther: '{{coverageNotice}} : payée par un autre membre de ton club. ',
      },
      manageTeams: {
        label: 'Gérer mes équipes couvertes',
        sub: 'Change les équipes couvertes par ton offre, sans repayer.',
      },
      unavailable: {
        label: 'Offre indisponible',
        sub: "Ce palier n'est pas proposé pour cette période.",
      },
    },
    features: {
      allClubTeams: 'Toutes les équipes du club',
      callUps: 'Convocations',
      clubBroadcast: 'Canal de diffusion',
      clubFees: 'Cotisations du club',
      clubRoles: 'Rôles du club',
      facilities: 'Installations',
      fullClubProfile: 'Fiche club complète',
      sponsors: 'Sponsors et partenaires',
      teamFees: "Cotisations de l'équipe",
      teamLineUp: "Composition d'équipe",
      unlimitedEvents: 'Événements illimités',
      unlimitedListings: 'Annonces illimitées',
      unlimitedMatches: 'Matchs illimités',
    },
    freePlan: {
      limitedEventsMatches: 'Événements et matchs en quantité limitée',
      limitedRecruitmentAds: 'Annonces de recrutement limitées',
      oneTeam: '1 équipe gratuite',
    },
    pager: {
      card: 'Carte {{position}} sur 3',
    },
    plans: {
      club: 'Club',
    },
    purchaseHelper: {
      // eslint-disable-next-line max-len
      available: 'Paiement sécurisé par le store. Changement immédiat, prorata géré automatiquement.',
      testMode: "Mode test actif : les changements d'offre sont simulés pour la recette.",
      // eslint-disable-next-line max-len
      unavailable: "Le paiement in-app n'est pas encore disponible sur cette version. Cette section reste en lecture pour le moment.",
    },
    success: {
      letsGo: "C'est parti !",
      resume: 'Reprendre',
      teamOffer_one: 'Équipe · {{count}} équipe',
      teamOffer_other: 'Équipe · {{count}} équipes',
    },
    teamModal: {
      activate: 'Activer cette offre',
      cancel: 'Annuler',
      confirmChange: 'Confirmer le changement',
      coverage_one: "Cette offre couvre jusqu'à {{count}} équipe.",
      coverage_other: "Cette offre couvre jusqu'à {{count}} équipes.",
      noTeams: "Aucune équipe exploitable n'a été trouvée sur ce compte pour une offre Équipe.",
      purchaseUnavailable: "Le paiement in-app n'est pas encore disponible sur cette version.",
      titleChoose: 'Choisir les équipes couvertes',
      titleManage: 'Mettre à jour mes équipes couvertes',
      tooMany: "Trop d'équipes sélectionnées pour cette formule.",
      unnamedTeam: 'Équipe sans nom',
    },
    teamSlots: {
      places_one: '{{count}} place',
      places_other: '{{count}} places',
      usage: '{{used}} / {{places}} {{usedWord}}',
      usedWord_one: 'utilisée',
      usedWord_other: 'utilisées',
    },
    tierRow: {
      lockedSuffix: ' — seules les offres supérieures restent disponibles.',
    },
  },
  subscriptionOverview: {
    alerts: {
      licenseeIncreased: {
        // eslint-disable-next-line max-len
        fromTo: 'Ton club passe de {{previousCount}} à {{nextCount}} licenciés. La différence est facturée tout de suite, au prorata, et les adhésions rouvrent.',
        // eslint-disable-next-line max-len
        nowCovers: 'Ton club couvre maintenant {{nextCount}} licenciés. La différence est facturée tout de suite, au prorata, et les adhésions rouvrent.',
        title: 'Nouveau nombre de licenciés enregistré',
      },
      restoreDone: {
        found_one: '{{count}} abonnement a été retrouve.',
        found_other: '{{count}} abonnements ont été retrouves.',
        none: 'Aucun achat n a été retrouve sur ce compte.',
        title: 'Restauration terminée',
      },
      subscriptionError: {
        title: 'Erreur abonnement',
      },
    },
    coverage: {
      allClubTeams: 'Toutes les équipes de ton club sont couvertes.',
      teams_one: '{{count}} équipe couverte par ton offre.',
      teams_other: '{{count}} équipes couvertes par ton offre.',
    },
    licensee: {
      coveredCount: '{{knownLicenseeCount}} couverts',
      increase: 'Augmenter mes licenciés',
    },
    licenseeSheet: {
      cancel: 'Annuler',
      confirm: "Confirmer l'augmentation",
      extraPerYear: '+ {{extraYearLabel}} sur une année pleine',
      fieldLabel: 'Nouveau nombre de licenciés',
      helperCharge: 'La différence est facturée tout de suite, au prorata du temps restant. ',
      helperDecrease: 'Une baisse, elle, prend effet au prochain renouvellement.',
      // eslint-disable-next-line max-len
      introKnown: 'Ton abonnement couvre {{knownLicenseeCount}} licenciés{{memberClause}}. Indique le nouveau total.',
      introUnknown: 'Indique le nouveau nombre TOTAL de licenciés que ton club doit couvrir.',
      memberClause: ', et ton club compte {{knownMemberCount}} membres',
    },
    planCard: {
      description: {
        // eslint-disable-next-line max-len
        club: 'Les droits Club sont actifs sur ton club certifié : toutes tes équipes sont couvertes.',
        // eslint-disable-next-line max-len
        clubUnverified: "Tes droits Club sont actifs sur tout ton club — rien n'est bloqué. Ton club est en cours de certification par la plateforme.",
        free: 'Tu publies en quantité limitée. Passe à une offre payante pour lever les limites.',
        team: 'Tes équipes couvertes profitent des droits Équipe, sans limite de publication.',
      },
      freeTitle: 'Offre gratuite FoundClub',
      otherPlans: 'Autres offres actives : {{plans}}',
    },
    sections: {
      club: 'Club',
      plan: 'Offre',
    },
    statusLines: {
      certification: 'Certification',
      coveredTeams: 'Équipes couvertes',
      renewedOn: 'Renouvelé le',
    },
    teamSlots: {
      assignedWord_one: 'attribuée',
      assignedWord_other: 'attribuées',
      places_one: '{{count}} place',
      places_other: '{{count}} places',
      usage: '{{assigned}}/{{places}} {{assignedWord}}',
    },
    trialBanner: {
      noCard: "Aucune carte requise. Retour à l'offre gratuite ensuite.",
      title: 'Aperçu {{scope}} · J-{{remainingDays}}',
    },
    trialPlans: {
      club: 'Aperçu Club (offert)',
      team: 'Aperçu Équipe (offert)',
    },
    trialScope: {
      club: 'Club',
    },
    verification: {
      noClub: 'Aucun club rattaché',
      pending: 'Certification en cours',
      unverified: 'Club non certifié',
      verified: 'Club certifié',
    },
  },
  subscriptionPaywallSheet: {
    alerts: {
      checkoutUnavailable: {
        // eslint-disable-next-line max-len
        message: 'Le checkout store réel sera branché dans une prochaine vague. Utilise le mode test local ou staging pour la recette complète.',
        title: 'Checkout indisponible',
      },
      clubRequired: {
        clubOfferMessage: "Rattache d'abord ton compte à un club avant de prendre une offre Club.",
        // eslint-disable-next-line max-len
        licenseeMessage: "Rattache d'abord ton compte à un club : c'est sur lui que se compte le nombre de licenciés.",
        title: 'Club requis',
      },
      licenseeCountRequired: {
        message: 'Indique combien de licenciés ton club doit couvrir avant de continuer.',
        title: 'Nombre de licenciés requis',
      },
      paymentOpened: {
        // eslint-disable-next-line max-len
        message: "Termine le paiement dans la page qui vient de s'ouvrir, puis reviens ici. Tes droits s'ouvrent dans la minute qui suit.",
        title: 'Paiement ouvert dans ton navigateur',
      },
      subscriptionError: {
        title: 'Erreur abonnement',
      },
    },
    billingPeriod: {
      monthly: 'Mensuel',
      yearly: 'Annuel',
    },
    catalogUnavailable: {
      // eslint-disable-next-line max-len
      message: 'Impossible de charger les tarifs pour le moment. Vérifie ta connexion puis réessaie.',
      title: 'Tarifs indisponibles',
    },
    compareOffers: 'Comparer les offres',
    cta: {
      alreadyCovered: 'Déjà couvert par ton club',
      enterLicenseeCount: 'Indique ton nombre de licenciés',
      loadingPrices: 'Chargement des tarifs…',
      purchasing: 'Achat en cours…',
      subscribe: 'Souscrire · {{total}}',
      unlockMyTeam: 'Débloquer mon équipe',
      unlockTier: 'Débloquer {{selectedTierLabel}}',
    },
    draftKept: '✓ brouillon conservé',
    later: 'Plus tard',
    // eslint-disable-next-line max-len
    licenseeHelper: 'Équipes illimitées. Tous les membres du club comptent : joueurs, coachs et dirigeants.',
    // eslint-disable-next-line max-len
    lockedNotice: '{{lockedNotice}} : payée par un autre membre. Seule une offre supérieure peut la remplacer.',
    priceSuffix: {
      monthly: '/mois',
      yearly: '/an',
    },
    pricingMode: {
      licensee: 'Au licencié',
      tier: 'Par palier',
    },
    resumeCta: 'Reprendre',
    retry: 'Réessayer',
    teamOfferLabel_one: 'Équipe · {{count}} équipe',
    teamOfferLabel_other: 'Équipe · {{count}} équipes',
    tierTeamsCount_one: '{{count}} équipe',
    tierTeamsCount_other: '{{count}} équipes',
  },
  subscriptionPurchaseRail: {
    errors: {
      invalidLicenseeCount: 'Nombre de licenciés invalide (entier, minimum 1).',
      planChangeMobileOnly: 'Le changement d offre se fait depuis l app mobile pour le moment.',
      webPaymentUnavailable: 'Paiement web indisponible pour le moment.',
    },
  },
  subscriptionQuotaBanner: {
    covered: {
      message: "{{displayName}} paie l'offre {{offerName}} pour {{coveredThing}}.",
      offerClub: 'Club',
      offerTeam: 'Équipe',
      thisTeam: 'cette équipe',
      title: "Déjà couvert — tu n'as rien à payer",
      wholeClub: 'tout le club',
    },
    exhausted: {
      cta: "Débloquer l'offre Équipe →",
      defaultBody: "Débloque l'offre Équipe pour continuer sans limite.",
      title: '{{label}} : quota gratuit épuisé',
    },
    exhaustedBody: {
      // eslint-disable-next-line max-len
      eventPublish: "Ton événement gratuit est déjà en ligne. Passe à l'illimité : entraînements, matchs, tournois…",
      freeTeam: "Ta 1ʳᵉ équipe reste active. Débloque l'offre Équipe pour en créer d'autres.",
      // eslint-disable-next-line max-len
      recruitmentAdPublish: "Ton annonce gratuite est déjà en ligne. Recrute sans limite avec l'offre Équipe.",
    },
    nouns: {
      creation: 'création',
      publication: 'publication',
    },
    remaining: {
      many: '{{label}} : il te reste {{remaining}} {{quotaNoun}}s gratuites',
      one: '{{label}} : il te reste {{remaining}} {{quotaNoun}} gratuite',
    },
  },
  subscriptionRevenueCat: {
    errors: {
      missingRevenueCatKey: 'Checkout indisponible : la clé RevenueCat est absente de ce build.',
      // eslint-disable-next-line max-len
      offerNotOnStore: "Cette offre ({{planCode}}) n'est pas encore disponible sur le store. Réessaie dans quelques minutes.",
      purchaseCancelled: 'Achat annulé. Ton brouillon est toujours là.',
      // eslint-disable-next-line max-len
      purchasePending: "Achat en attente de validation (contrôle parental ou moyen de paiement). Tes accès s'activeront automatiquement à la confirmation.",
      userNotIdentified: "Utilisateur non identifié : reconnecte-toi avant de finaliser l'achat.",
    },
  },
  // L11 — écran d'après-achat : la liste reflète la matrice serveur
  // (subscription-permission.ts) via getSubscriptionUnlockedCapabilities,
  // ne pas y ajouter une capacité que le serveur ne débloque pas.
  subscriptionSuccess: {
    actions: {
      backHome: "Retour à l'accueil",
      resume: 'Reprendre',
    },
    firstActions: {
      club: 'Gérer mon club',
      composition: 'Préparer ma compo',
      events: 'Publier un événement ou un match',
      recruitment: 'Publier une annonce de recrutement',
    },
    firstActionTitle: 'Que veux-tu faire en premier pour profiter de ton abonnement ?',
    offerLine: {
      activeNow: "— active pour toute l'équipe, dès maintenant.",
      // eslint-disable-next-line max-len
      atRenewal: "— elle prendra effet à ta prochaine échéance. D'ici là, ton offre actuelle continue.",
      prefix: 'Offre',
    },
    receipt: {
      detailsIn: ' — détails dans ',
      pending: "On vérifie ton achat : ton abonnement s'active dans un instant · {{storeLabel}}",
      renewal: 'Renouvellement le {{renewalDateLabel}} · {{storeLabel}} — détails dans ',
      store: '{{storeLabel}} — détails dans ',
    },
    title: {
      saved: "C'est enregistré !",
      unlocked: "C'est débloqué !",
    },
    unlockedAtRenewalTitle: 'À ta prochaine échéance, tu auras :',
    unlockedTitle: 'Ton offre débloque :',
    unlocks: {
      clubRoles: 'Gestion des entraîneurs et dirigeants',
      clubTeams: 'Toutes les équipes du club couvertes',
      composition: 'Composition et convocations',
      dues: 'Campagnes de cotisations',
      events: 'Événements et matchs illimités',
      facilities: 'Installations du club',
      recruitment: 'Annonces de recrutement illimitées',
      sponsors: 'Sponsors du club',
      teams: 'Équipes supplémentaires',
    },
    // Tour 7a — version courte des mêmes libellés pour la grille à 2 colonnes.
    // Raccourci d'AFFICHAGE seulement : la liste vient toujours de
    // getSubscriptionUnlockedCapabilities. Une capacité absente d'ici retombe
    // sur son libellé long ci-dessus (`teams` est dans ce cas), elle ne
    // disparaît jamais de l'écran.
    unlocksShort: {
      clubRoles: 'Rôles du club',
      clubTeams: 'Toutes les équipes du club',
      composition: 'Compo & convocations',
      dues: 'Cotisations',
      events: 'Événements illimités',
      facilities: 'Installations',
      recruitment: 'Annonces illimitées',
      sponsors: 'Sponsors',
    },
  },
  subscriptionWebSuccess: {
    actions: {
      backHome: "Retour à l'accueil",
      letsGo: "C'est parti !",
    },
    error: {
      // eslint-disable-next-line max-len
      chargedHint: "Si tu as bien été débité, tes droits s'activeront automatiquement d'ici quelques minutes.",
      title: 'Confirmation impossible',
    },
    errors: {
      confirmFailed: 'Impossible de confirmer le paiement.',
      sessionNotFound: 'Session de paiement introuvable.',
    },
    pending: 'Confirmation du paiement…',
  },
  superAdminContentExplorer: {
    states: {
      errorDescription: 'Impossible de charger les content-types superadmin.',
      errorTitle: 'Chargement impossible',
      loadingDescription: 'Nous chargeons les content-types du Content Manager.',
      loadingTitle: 'Chargement du contenu superadmin',
      retry: 'Réessayer',
    },
  },
  superAdminContentManager: {
    actions: {
      addId: 'Ajouter ID',
      apply: 'Appliquer',
      cancel: 'Annuler',
      close: 'Fermer',
      copyId: 'Copier ID',
      createEntry: 'Créer une entrée',
      delete: 'Supprimer',
      deleteEntry: 'Supprimer l\'entrée',
      deleting: 'Suppression...',
      edit: 'Modifier',
      exitSelection: 'Quitter sélection',
      hide: 'Masquer',
      more: 'Plus d actions',
      multiSelect: 'Sélection multiple',
      next: 'Suivant',
      previous: 'Précédent',
      processing: 'Traitement...',
      publish: 'Publier',
      refresh: 'Rafraîchir',
      remove: 'Retirer',
      save: 'Enregistrer',
      saving: 'Enregistrement...',
      search: 'Chercher',
      selectAll: 'Tout sélectionner',
      show: 'Afficher',
      suspendUser: 'Suspendre le compte',
      unpublish: 'Dépublier',
      unselectAll: 'Tout desélectionner',
      unsuspendUser: 'Reactiver le compte',
    },
    alerts: {
      bulkFailedTitle: 'Action de masse impossible',
      copyFailedTitle: 'Copié impossible',
      deleteFailedTitle: 'Suppression impossible',
      emptySelectionMessage: 'Sélectionne au moins une entrée.',
      emptySelectionTitle: 'Sélection vide',
      filePickerUnavailable: 'Le sélecteur de fichiers est indisponible sur cette build.',
      fileResolveFailed: 'Impossible de récupérer ce fichier.',
      fileSelectFailed: 'Impossible de sélectionner ce fichier.',
      openCameraFailed: 'Impossible d\'ouvrir la caméra.',
      openGalleryFailed: 'Impossible d\'ouvrir la galerie.',
      reasonRequiredMessage: 'Minimum 3 caractères.',
      reasonRequiredTitle: 'Raison requise',
      relationSearchFailedTitle: 'Recherche impossible',
      relationSearchMinChars: 'Merci de saisir au moins 1 caractère.',
      relationSearchTitle: 'Recherche relation',
      saveFailedTitle: 'Enregistrement impossible',
      takePhotoFailed: 'Impossible de prendre une photo.',
      uploadFailedTitle: 'Upload impossible',
      uploadNoFile: 'Aucun fichier n\'a été reçu par le serveur.',
      validationTitle: 'Validation',
    },
    bulkModal: {
      description: 'entrée(s) seront traitées. Une raison d\'audit est obligatoire.',
      reasonPlaceholder: 'Raison obligatoire (minimum 3 caractères)',
      titleSuffix: 'les entrées',
    },
    common: {
      genericError: 'Une erreur est survenue.',
      id: 'ID',
      reason: 'Raison',
      unknown: 'inconnue',
    },
    deleteModal: {
      description: 'Action définitive. Une raison d\'audit est obligatoire.',
      reasonPlaceholder: 'Raison obligatoire (minimum 3 caractères)',
      title: 'Supprimer l\'entrée',
    },
    detail: {
      createdAt: 'Crée le',
      noAudit: 'Aucun log disponible.',
      noKeyFields: 'Aucun champ clé détecté.',
      noRelations: 'Aucune relation ou média exploitable.',
      rawJsonCollapsed: 'Vue avancée repliée pour garder l\'écran lisible.',
      sections: {
        audit: 'Audit récent',
        keyFields: 'Champs clés',
        rawJson: 'JSON complet',
        relationsMedia: 'Relations / Médias',
        summary: 'Résumé',
      },
      shortId: 'ID court',
      updatedAt: 'Modifié le',
    },
    empty: {
      explorerDescription: 'Ajuste la recherche ou vérifie les permissions Super Admin.',
      explorerTitle: 'Aucun content-type trouvé',
      listDescription: 'Aucune donnée ne correspond aux filtres actifs.',
      listTitle: 'Aucune entrée',
    },
    explorer: {
      collectionType: 'collection type',
      draftPublish: 'draft + publish',
      results: 'Résultats',
      searchPlaceholder: 'Rechercher un content-type',
      singleType: 'single type',
      subtitle: 'Parcours tous les content-types API Strapi.',
      title: 'Explorer Content Manager',
      types: 'Types',
    },
    feedback: {
      bulkApplied: 'action(s) appliquée(s)',
      clipboardUnavailable: 'Copié indisponible sur cette build',
      entryDeleted: 'Entrée supprimée',
      idCopied: 'ID copié',
      userSuspended: 'Compte suspendu.',
      userUnsuspended: 'Compte reactive.',
    },
    form: {
      allowedTypes: 'Types autorisés',
      documentIdToAdd: 'documentId à ajouter',
      editableFields: 'Champs éditables',
      mediaMultipleAllowed: 'Média multiple autorisé',
      mediaSingle: 'Média unique',
      no: 'Non',
      noEditableFields: 'Aucun champ détecté',
      noMediaSelected: 'Aucun média sélectionné.',
      none: 'Aucun',
      rawFallbackHint: 'Champs non totalement supportés en mode guide:',
      rawFallbackTitle: 'Fallback JSON avancé',
      reasonLabel: 'Raison (optionnelle sauf règles sensibles)',
      reasonPlaceholder: 'Ajouter un contexte d\'audit',
      relationDocumentId: 'documentId relation',
      relationTo: 'Relation vers',
      searchRelationPlaceholder: 'Rechercher une relation...',
      sections: {
        advanced: 'Avancé',
        advancedHint: 'JSON, rich text et champs complexes.',
        booleanEnum: 'Booléens / Enums',
        booleanEnumHint: 'Valeurs à choix rapide.',
        media: 'Médias',
        mediaHint: 'Ajoute images ou fichiers.',
        relations: 'Relations',
        relationsHint: 'Associe des entrées liées.',
        scalars: 'Scalaires',
        scalarsHint: 'Texte, nombres et dates.',
      },
      titleCreate: 'Créer une entrée',
      titleEdit: 'Modifier une entrée',
      type: 'Type',
      uploading: 'Upload en cours...',
      yes: 'Oui',
    },
    list: {
      page: 'Page',
      searchPlaceholder: 'Rechercher une entrée',
      selectedEntries: 'entrée(s) sélectionnée(s)',
      total: 'Total',
      updatedPrefix: 'Maj:',
    },
    media: {
      camera: 'Caméra',
      file: 'Fichier',
      gallery: 'Galerie',
    },
    suspensionModal: {
      description: "Une raison support est obligatoire et sera ajoutée a l'audit.",
      reasonPlaceholder: 'Raison obligatoire (minimum 3 caractères)',
      suspendTitle: 'Suspendre le compte',
      unsuspendTitle: 'Reactiver le compte',
    },
  },

  /* eslint-disable perfectionist/sort-objects */
  reservationFilters: {
    fields: {
      maxPrice: {
        label: 'Prix maximum par personne',
        placeholder: 'Ex: 20',
      },
      startTime: {
        label: 'À partir de',
        placeholder: 'Heure de début',
      },
    },
  },

  reservation: {
    actions: {
      cancelRequest: 'Annuler la demande',
      findPlayers: 'Chercher joueurs',
      openAgain: 'Ouvrir aux joueurs',
      participate: 'Réserver',
      privatize: 'Privatiser',
      requestFeatured: 'Demander la mise à la une',
      sos: 'SOS 🔥',
    },
    bookFull: {
      error: 'Impossible de réserver le créneau entier.',
      success: {
        message: 'Ta réservation est maintenant complète.',
        title: 'Réservation privatisee',
      },
    },
    card: {
      missingPlayers: 'Il manque {{count}} joueur',
      missingPlayers_plural: 'Il manque {{count}} joueurs',
      pricePerPerson: '{{price}}€/pers',
    },
    featured: 'À la une :',
    featuredRequest: {
      approved: 'Approuvée',
      cancelError: 'Erreur lors de l\'annulation',
      cancelSuccess: 'Demande annulée',
      pending: 'Demande en attente',
      rejected: 'Refusée',
      requestError: 'Erreur lors de l\'envoi de la demande',
      requestSuccess: 'Demande envoyée avec succès',
      title: 'Mise en avant',
    },
    filters: {
      detections: 'Détections',
      openTrainings: 'Entraînements ouverts',
      tournaments: 'Tournois',
    },
    joinError: 'Impossible de rejoindre cette réservation.',
    joinSuccess: {
      message: 'Tu participes maintenant à cette réservation.',
      title: 'Participation confirmée',
    },
    missingPlayers: {
      subtitle: 'Rejoins une réservation qui manque de joueurs',
      title: 'Joueurs recherchés',
    },
    mode: {
      fullGroup: 'J\'ai déjà mon groupe complet',
      invalidPlayerCount: 'Merci de entrer un nombre validé',
      playerCount: 'Combien de joueurs as-tu ?',
      recruiting: 'Il me manque des joueurs',
      selectMode: 'Merci de sélectionner un mode',
      title: 'Comment veux-tu participer ?',
      tooManyPlayers: 'Le nombre doit être inférieur au total',
    },
    noData: 'Aucune réservation trouvée.',
    noMissingPlayers: 'Aucune réservation ne cherche de joueurs pour le moment',
    noMissingPlayersHint: 'Reviens plus tard ou crée ta propre réservation !',
    openForPlayers: {
      error: 'Impossible d’ouvrir ce créneau aux joueurs.',
      success: {
        message: 'Les joueurs peuvent maintenant te rejoindre !',
        title: 'Réservation ouverte',
      },
    },
    sosAlert: {
      error: 'Impossible d’envoyer l’alerte SOS.',
      success: {
        message: 'Les joueurs proches seront notifies.',
        title: 'Alerte SOS lancée',
      },
    },
    title: 'Événements :',
  },
  searchTypeSwitcher: {
    amicaux: 'Matchs amicaux',
    recruitment: 'Recrutement',
    soon: {
      body: 'La réservation de créneaux (foot à 5, padel…) arrive dans une prochaine version.',
      gotIt: 'Compris',
      title: 'Bientôt disponible !',
    },
  },
  superadminDisplaySchema: {
    boolean: {
      no: 'Non',
      yes: 'Oui',
    },
    sort: {
      created: 'Création récente',
      updated: 'MAJ récente',
    },
    summary: {
      empty: '0 element',
      fields: '{{count}} champs',
      items: '{{count}} éléments',
      itemsWithExample: '{{count}} éléments (ex: {{firstLabel}})',
    },
    untitled: 'Sans titre',
  },
  superAdminEntryDetail: {
    back: 'Retour',
    states: {
      errorDescription: 'Impossible de charger cette entrée.',
      errorTitle: 'Chargement impossible',
      incompleteUrl: "Les informations de l'entrée superadmin sont incomplètes dans l'URL.",
      loadingDescription: "Nous chargeons le detail de l'entrée.",
      loadingTitle: 'Chargement du detail',
      notFound: 'Entrée introuvable',
      retry: 'Réessayer',
      unavailable: "Cette entrée superadmin n'existe pas ou n'est plus accessible.",
    },
  },
  superAdminEntryForm: {
    back: 'Retour',
    errors: {
      json: 'Le champ "{{name}}" contient un JSON invalide.',
      number: 'Le champ "{{name}}" doit être un nombre validé.',
    },
    media: {
      fileFallback: 'Fichier',
    },
    states: {
      errorDescription: 'Impossible de charger ce formulaire.',
      errorTitle: 'Chargement impossible',
      loadingDescription: 'Nous préparons le formulaire superadmin.',
      loadingTitle: 'Chargement du formulaire',
      missingType: "Le content-type superadmin est absent de l'URL.",
      notFound: 'Entrée introuvable',
      retry: 'Réessayer',
      typeNotFound: 'Content-type introuvable',
      unavailable: "L'entrée demandée n'existe pas ou n'est plus accessible.",
    },
  },
  superAdminEntryList: {
    back: 'Retour',
    states: {
      errorDescription: 'Impossible de charger cette liste superadmin.',
      errorTitle: 'Chargement impossible',
      loadingDescription: 'Nous chargeons les entrées du content manager.',
      loadingTitle: 'Chargement du contenu superadmin',
      missingType: "Le content-type superadmin est absent de l'URL.",
      retry: 'Réessayer',
      typeNotFound: 'Content-type introuvable',
    },
  },
  superAdminLeagueDashboard: {
    classicAdmin: 'Admin classique',
    // eslint-disable-next-line max-len
    description: "Pilote l'ouverture plateforme, les squads, les matchs League et les litiges depuis un seul espace dédié.",
    manageOpening: "Gérer l'ouverture League",
    metrics: {
      cancelledMatches: 'Matchs annulés',
      completeSquads: 'Squads complètes',
      confirmedMatches: 'Matchs confirmés',
      confirmedScores: 'Scores validés',
      incompleteSquads: 'Squads incomplètes',
      matches: 'Matchs',
      openDisputes: 'Litiges ouverts',
      playedMatches: 'Matchs joués',
      resolvedDisputes: 'Litiges résolus',
      searchesStarted: 'Recherches lancées',
      uniquePlayers: 'Joueurs uniques',
    },
    noData: 'Aucune donnée disponible.',
    openDisputes: 'Ouvrir les litiges League',
    squadsByDivision: 'Squads par division',
    squadsBySport: 'Squads par sport',
    states: {
      errorDescription: 'Impossible de charger le dashboard League.',
      errorTitle: 'Chargement impossible',
      loadingDescription: 'Nous consolidons les métriques globales de Found Club League.',
      loadingTitle: 'Chargement du dashboard League',
      retry: 'Réessayer',
    },
    title: 'Dashboard League',
  },
  superAdminLeagueDisputes: {
    actions: {
      cancel: 'Annuler le résultat',
      correct: 'Corriger le score',
      validate: 'Valider le score',
    },
    adminComment: 'Commentaire admin',
    alerts: {
      errorBody: 'Impossible de traiter ce litige.',
      errorTitle: 'Traitement impossible',
      invalidScoresBody: 'Renseigne deux scores entiers avant de traiter ce litige.',
      invalidScoresTitle: 'Scores invalides',
      updatedBody: "L'action Super Admin a bien été enregistrée.",
      updatedTitle: 'Litige mis à jour',
    },
    // eslint-disable-next-line max-len
    description: 'Analyse les litiges League, compare les scores proposés, puis valide, corrige ou annule le résultat.',
    empty: 'Aucun litige League pour ces filtres.',
    fields: {
      disputedScore: 'Score contesté :',
      proposedScore: 'Score proposé :',
      reason: 'Raison :',
      sport: 'Sport :',
      status: 'Statut :',
    },
    filters: {
      dateMax: 'Date max (2026-04-30)',
      dateMin: 'Date min (2026-04-24)',
      status: 'Statut (open, resolved, all)',
    },
    found: 'litiges trouvés',
    noComment: 'Aucun commentaire',
    states: {
      errorDescription: 'Impossible de charger les litiges League.',
      errorTitle: 'Chargement impossible',
      loadingDescription: 'Nous chargeons les litiges League à traiter.',
      loadingTitle: 'Chargement des litiges',
      retry: 'Réessayer',
    },
    title: 'Gestion des litiges',
    unknown: 'Inconnu',
  },
  superAdminLeagueDivisions: {
    // eslint-disable-next-line max-len
    description: "Visualise les divisions 1 à 5, l'effectif des squads, l'Elo moyen et le volume de matchs par sport.",
    empty: 'Aucune donnée de division disponible.',
    fields: {
      averageElo: 'Elo moyen :',
      matchesPlayed: 'Matchs joués :',
      squads: 'Squads :',
    },
    states: {
      errorDescription: 'Impossible de charger les divisions League.',
      errorTitle: 'Chargement impossible',
      loadingDescription: 'Nous chargeons la répartition des squads par division League.',
      loadingTitle: 'Chargement des divisions',
      retry: 'Réessayer',
    },
    title: 'Divisions League',
    unknownSport: 'Sport inconnu',
  },
  superAdminLeagueLayout: {
    back: 'Retour',
    nav: {
      disputes: 'Litiges',
      licenses: 'Cotisations',
      matches: 'Matchs',
      settings: 'Paramètres',
    },
  },
  superAdminLeagueMatches: {
    // eslint-disable-next-line max-len
    description: 'Suis les matchs League avec leurs statuts métier, leur score, leur terrain et leurs litiges éventuels.',
    empty: 'Aucun match ne correspond à ces filtres.',
    fields: {
      date: 'Date :',
      dispute: 'Litige :',
      score: 'Score :',
      sport: 'Sport :',
      status: 'Statut :',
      venue: 'Terrain :',
    },
    filters: {
      dateMax: 'Date max (2026-04-30)',
      dateMin: 'Date min (2026-04-24)',
      division: 'Filtre division',
      sport: 'Filtre sport',
      status: 'Filtre statut',
      team: 'Filtre équipe',
    },
    found: 'matchs trouvés',
    notProvided: 'Non renseigné',
    notSet: 'Non définie',
    pending: 'En attente',
    states: {
      errorDescription: 'Impossible de charger les matchs League.',
      errorTitle: 'Chargement impossible',
      loadingDescription: 'Nous chargeons tous les matchs League de la plateforme.',
      loadingTitle: 'Chargement des matchs',
      retry: 'Réessayer',
    },
    title: 'Suivi des matchs',
    unknown: 'Inconnu',
  },
  superAdminLeagueSettings: {
    alerts: {
      invalidDateBody: 'Utilise un format valide du type 2026-05-12T18:00.',
      invalidDateTitle: 'Date invalide',
      matchmakingSaved: "L'état de la recherche de match a bien été mis à jour.",
      platformSaved: "L'état plateforme League a bien été mis à jour.",
      savedTitle: 'Paramètres enregistrés',
      saveErrorBody: 'Impossible de mettre à jour les paramètres League.',
      saveErrorTitle: 'Enregistrement impossible',
    },
    close: 'Fermer',
    // eslint-disable-next-line max-len
    description: 'Ouvre ou ferme Found Club League pour les joueurs, puis pilote séparément la disponibilité du matchmaking.',
    matchmaking: {
      clear: 'Supprimer la date de recherche',
      closed: 'Recherche fermée',
      // eslint-disable-next-line max-len
      description: 'La plateforme peut rester ouverte pendant que la recherche de match est bloquée pour préparer un lancement synchronisé.',
      open: 'Recherche ouverte',
      title: 'Recherche de match',
    },
    open: 'Ouvrir',
    openingDateLabel: "Date et heure d'ouverture (optionnel)",
    platform: {
      clear: 'Supprimer la date',
      closed: 'Plateforme fermée',
      // eslint-disable-next-line max-len
      description: "Quand la plateforme est fermée, les joueurs voient l'écran Found Club League arrive bientôt. Les SuperAdmin gardent l'accès complet.",
      open: 'Plateforme ouverte',
      title: 'État de Found Club League',
    },
    save: 'Enregistrer',
    scheduled: {
      matchmaking: 'Recherche programmée : {{date}}',
      platform: 'Ouverture programmée : {{date}}',
    },
    states: {
      errorDescription: 'Impossible de charger les paramètres League.',
      errorTitle: 'Chargement impossible',
      loadingDescription: "Nous chargeons la configuration d'ouverture de Found Club League.",
      loadingTitle: 'Chargement des paramètres League',
      retry: 'Réessayer',
    },
    title: 'Paramètres plateforme',
    unsaved: 'Modification non enregistrée',
  },
  superAdminLeagueSquads: {
    captain: 'Capitaine :',
    captains: 'Capitaines :',
    completeSquad: 'Squad complète',
    // eslint-disable-next-line max-len
    description: 'Recherche, filtre et inspecte les squads League, leur capitaine, leur Elo, leur division et leur dynamique récente.',
    detail: {
      members: 'Membres',
      noRecentData: 'Aucune donnée récente',
      noRecentMatches: 'Aucun match récent.',
      noScore: 'Sans score',
      recentHistory: 'Historique récent',
      title: 'Détail squad :',
      trend: 'Dynamique :',
      userFallback: 'Utilisateur',
    },
    filters: {
      division: 'Filtre division (1 à 5)',
      query: 'Recherche par squad ou capitaine',
      sport: 'Filtre sport (Football à 5, Padel...)',
      status: 'Filtre statut (complete / incomplete)',
    },
    found: 'squads trouvées',
    incompleteSquad: 'Squad incomplète',
    membersCount: '{{count}} membres',
    states: {
      errorDescription: 'Impossible de charger les squads League.',
      errorTitle: 'Chargement impossible',
      loadingDescription: 'Nous chargeons la console Squad League.',
      loadingTitle: 'Chargement des squads',
      retry: 'Réessayer',
    },
    title: 'Suivi des squads',
    unknown: 'Inconnu',
    unknownCaptain: 'Inconnu',
    unknownSport: 'Sport inconnu',
  },
  superAdminLicensesDashboard: {
    campaignDetail: 'Detail campagne',
    campaignUpdatedAt: 'Dernière mise à jour campagne',
    currentSlug: 'Slug actuel',
    // eslint-disable-next-line max-len
    description: 'Supervise les campagnes, les connexions HelloAsso, les paiements et les anomalies de cotisation depuis un cockpit support unique.',
    disableHelloAsso: 'Désactiver HelloAsso',
    environment: 'Environnement',
    external: 'Externe:',
    filters: {
      all: 'Tous',
      campaignStatus: 'Statut campagne',
      closed: 'Cloturee',
      draft: 'Brouillon',
      link: 'Lien externe',
      offline: 'Hors ligne',
      paused: 'Pause',
      paymentMode: 'Mode de paiement',
      ready: 'Pret',
      searchPlaceholder: 'Club, multisport ou campagne',
      seasonPlaceholder: 'Filtrer par saison',
      title: 'Filtres',
    },
    helloAssoConfiguration: 'Configuration HelloAsso',
    helloAssoDisabled: 'Le mode HelloAsso a été désactivé pour ce scope.',
    helloAssoReadiness: 'Readiness HelloAsso',
    helloAssoVerified: 'La configuration HelloAsso a été vérifiée avec succès.',
    helloAssoVerifyError: 'Impossible de vérifier cette configuration HelloAsso.',
    lastError: 'Dernière erreur',
    lastWebhook: 'Dernier webhook',
    metrics: {
      campaigns: 'Campagnes',
      confirmedPayments: 'Paiements confirmes',
      helloassoCampaigns: 'Campagnes HelloAsso',
      ignoredEvents: 'Webhooks ignores',
      pendingPayments: 'Paiements en attente',
      providerErrors: 'Connexions à surveiller',
    },
    missingScope: 'Scope manquant',
    never: 'Jamais',
    noPayments: 'Aucun paiement rattache à cette campagne dans les 100 derniers paiements charges.',
    // eslint-disable-next-line max-len
    noProviderEvents: 'Aucun événement provider rattache à cette campagne dans les 100 derniers événements charges.',
    noResults: 'Aucun résultat avec les filtres actuels.',
    open: 'Ouvrir',
    opened: 'Ouverte',
    openEvents: 'Ouvrir les événements',
    openRawList: 'Ouvrir la liste brute',
    // eslint-disable-next-line max-len
    partialData: 'Certaines listes dépassent 100 éléments. Le cockpit montre pour l instant les 100 plus recentes données par famille.',
    payment: 'Paiement',
    paymentLabel: 'Paiement:',
    paymentRechecked: 'La reverification du paiement est terminée.',
    paymentRecheckError: 'Impossible de reverifier ce paiement.',
    paymentsCockpit: 'Cockpit paiements',
    paymentsListTitle: 'Paiements cotisations',
    paymentStats: {
      confirmed: 'Confirmes',
      failed: 'En anomalie',
      pending: 'En attente',
    },
    providerEvent: 'Événement provider',
    providerEvents: 'Événements provider',
    providerEventsListTitle: 'Événements provider cotisations',
    rawExplorer: 'Explorer brut',
    readiness: {
      checkoutFailed: 'Test checkout en erreur',
      credentialsMissing: 'Configuration incomplète',
      disabled: 'Desactive',
      error: 'Erreur provider',
      notConfigured: 'A configurer',
      oauthFailed: 'OAuth en erreur',
      pending: 'En attente',
      ready: 'Pret',
      unknown: 'Inconnu',
      webhookPending: 'Webhook à confirmer',
      webhookStale: 'Webhook à vérifier',
    },
    recentPayments: 'Paiements récents',
    recheck: 'Reverifier',
    retestConnection: 'Retester la connexion',
    scope: {
      missingClub: 'Club manquant',
      missingMultisport: 'Multisport manquant',
    },
    secretConfigured: 'Configure (masque)',
    secretMissing: 'Non configure',
    // eslint-disable-next-line max-len
    secretNote: 'Le secret n est jamais affiche. Si tu laisses le champ vide, on conserve le secret existant.',
    secretPlaceholderKeep: 'Client secret (laisser vide pour conserver)',
    slugPlaceholder: 'Slug organisation HelloAsso',
    slugRequired: 'Le slug organisation est obligatoire.',
    states: {
      errorDescription: 'Impossible de charger les campagnes cotisations.',
      errorTitle: 'Chargement impossible',
      loadingDescription: 'Nous consolidons les campagnes, providers et paiements cotisations.',
      loadingTitle: 'Chargement du cockpit cotisations',
      retry: 'Reessayer',
    },
    title: 'Cockpit cotisations',
    undefinedSeason: 'Saison non définie',
    unnamedCampaign: 'Campagne sans nom',
    updated: 'Maj',
    verifying: 'Verification...',
    visibleCampaigns: 'Campagnes visibles (',
  },
  tacticalBoard: {
    actions: 'Actions',
    activeDefaultLineup: 'Composition type active',
    allSelectedPlaced: 'Tous les joueurs sélectionnés sont déjà placés.',
    bench: 'Banc',
    cancel: 'Annuler',
    changesWaiting: "Des changements attendent d'être publiés",
    close: 'Fermer',
    currentlyPublished: 'Composition actuellement publiée',
    defaultLineup: 'Composition type',
    defaultLineupDeleted: 'Composition type supprimée.',
    // eslint-disable-next-line max-len
    defaultLineupEmptyHint: 'Place les joueurs sur le terrain puis enregistre cette composition type pour répartir plus vite ensuite.',
    // eslint-disable-next-line max-len
    defaultLineupHint: 'Composition type : reutilise cette composition comme base de depart sur les prochains evenements.',
    defaultLineupSaved: 'Composition type enregistrée',
    defaultLineupSavedAlert: 'Composition type enregistrée.',
    delete: 'Supprimer',
    deleteDefaultError: 'Impossible de supprimer la composition type.',
    detection: 'Detection',
    detectionLineup: "Composition d'équipe détection",
    draft: 'Brouillon',
    // eslint-disable-next-line max-len
    draftHintDetection: 'Brouillon : garde tes changements prives pour cette détection, sans les publier.',
    draftHintMatch: 'Brouillon : garde tes changements prives pour ce match, sans les publier.',
    draftInProgress: 'Brouillon en cours',
    draftSaved: 'Brouillon enregistré',
    draftSavedAlert: 'Brouillon enregistré.',
    draftSaveError: "Impossible d'enregistrer le brouillon.",
    dragPlayerOntoPitch: 'Fais glisser un joueur sur le terrain',
    editing: 'Édition',
    editingPlain: 'Edition',
    editLineup: 'Modifier la composition',
    editPlayers: 'Modifier les joueurs',
    // eslint-disable-next-line max-len
    editWithoutOverwriting: 'Tu peux la modifier pour préparer une nouvelle version sans écraser immédiatement la version publiée.',
    holdBenchPlayerHint: 'Maintiens un joueur du banc puis glisse-le vers sa position.',
    holdPlayerHint: 'Maintiens un joueur puis glisse-le sur le terrain.',
    identifyTeamError: "Impossible d'identifier l'équipe concernée.",
    identifyTeamOrEventError: "Impossible d'identifier l'équipe ou l'événement concerné.",
    identifyTeamShortError: "Impossible d'identifier l'équipe.",
    lastSavedOn: 'Dernière sauvegarde le {{updatedAt}}',
    lastUpdatedOn: 'Dernière mise à jour le {{updatedAt}}',
    leaveWithoutSaving: 'Quitter sans enregistrer',
    leaveWithoutSavingQuestion: 'Quitter sans enregistrer ?',
    match: 'Match',
    newLineup: 'Nouvelle composition',
    // eslint-disable-next-line max-len
    newLineupHint: 'Place les joueurs sur le terrain, complète le banc puis enregistre ou publie quand tout est prêt.',
    notAllowed: "Tu n'es pas autorisé à gérer la composition pour cette équipe.",
    open: 'Ouvrir',
    placeCalledUpPlayers: 'Place les joueurs convoques sur le terrain',
    placedCount: '{{placed}}/{{total}} placés',
    placeStarters: 'Place tes titulaires sur le terrain',
    playersNeverSeeDrafts: 'Les joueurs ne voient jamais les brouillons intermédiaires.',
    plusAddPlayer: '+ Ajouter un joueur',
    prepareDefaultLineup: "Prépare une composition type pour l'équipe",
    previewMessage: 'Ceci est un aperçu — publie tes vraies compos depuis un événement.',
    previewMode: 'Mode aperçu',
    publicationOn: 'Publication le {{publishedAt}}',
    publishDetectionLineup: "Publier la composition d'équipe détection",
    publishedDetectionLineup: "Composition d'équipe détection publiée",
    publishedLineup: 'Composition publiée',
    publishedVersion: 'Publiée v{{version}}',
    publishError: "Impossible de publier la composition d'équipe.",
    publishing: 'Publication...',
    publishTeamLineup: "Publier la composition d'équipe",
    publishWhenReady: "Publie quand la composition est prête pour l'équipe.",
    publishYourLineup: 'Publie ta compo',
    readOnly: 'Lecture seule',
    removeDefaultLineup: 'Retirer la composition type',
    removeDefaultMessage: 'Cette action retire la composition type de cette équipe.',
    restartFromVersion: 'Tu peux répartir de cette version pour préparer la suite.',
    reuseAsBase: 'Tu peux la réutiliser comme base sur les prochains matchs.',
    saveAsDefaultLineup: 'Enregistrer comme composition type',
    savedAsDefault: 'Cette composition a été enregistrée comme composition type.',
    saveDefaultError: "Impossible d'enregistrer la composition type.",
    saveDefaultLineup: 'Enregistrer la composition type',
    saveTheDraft: 'Sauvegarder le brouillon',
    saveThisDraft: 'Sauvegarder ce brouillon',
    saving: 'Enregistrement...',
    savingDraft: 'Sauvegarde...',
    startOrganising: 'Commence par organiser ton équipe',
    tapAddHint: 'Appuie sur + Ajouter si tu veux compléter la sélection sans revenir en arrière.',
    teamLineup: "Composition d'équipe",
    teamLineupPublishedAlert: "Composition d'équipe publiée.",
    twoSavesQuestion: 'A quoi servent ces deux sauvegardes ?',
    // eslint-disable-next-line max-len
    unsavedDefaultLineup: "Tu as des modifications non enregistrées sur la composition type. Tu peux l'enregistrer avant de quitter, ou fermer sans enregistrer.",
    // eslint-disable-next-line max-len
    unsavedLineup: 'Tu as des modifications non enregistrées sur cette composition. Tu peux sauvegarder le brouillon avant de quitter, ou fermer sans enregistrer.',
    versionAlreadyPublished: 'Une version est déjà publiée',
    versionVisibleToPlayers: 'Cette version est celle visible par les joueurs.',
    visibleVersion: 'Version visible: v{{version}} publiée le {{publishedAt}}',
  },
  tacticalSelection: {
    add: 'Ajouter',
    addedManually: 'Ajouté manuellement',
    addPlayer: 'Ajouter un joueur',
    appliedFor: 'A postulé : {{appliedPosition}}',
    baseLabel: 'Base : {{sourceLabel}}',
    callUpPublishedOn: 'Convocation publiée (v{{version}}) le {{date}}',
    cancel: 'Annuler',
    clear: 'Effacer',
    clearSelection: 'Effacer la sélection',
    continueWithSize: 'Continuer ({{size}})',
    defaultLineup: 'Composition type',
    defaultLineupTeamOnly: "La composition type ne peut contenir que les joueurs de l'équipe.",
    delete: 'Supprimer',
    deletePlayer: 'Supprimer ce joueur',
    deletePlayerQuestion: 'Supprimer {{firstname}} {{lastname}} ?',
    draft: 'Brouillon',
    draftUpdatedOn: 'Brouillon mis à jour le {{date}}',
    editNumber: 'Modifier le numéro',
    editPlayer: 'Modifier le joueur',
    firstName: 'Prénom',
    firstNameRequired: 'Prénom *',
    identifyingTeam: "On termine d'identifier l'équipe concernée.",
    identifyMatchTeamError: "Impossible d'identifier l'équipe de ce match.",
    identifyTeamError: "Impossible d'identifier l'équipe pour cette composition.",
    lastMatch: 'Dernier match',
    lastName: 'Nom',
    lastNameRequired: 'Nom *',
    loadingDefaultLineup: 'Chargement de la composition type...',
    loadingTeam: "Chargement de l'équipe...",
    loadingTeamConcerned: "Chargement de l'équipe concernée...",
    nameRequired: 'Prénom et nom requis',
    noPlayerInTeam: "Aucun joueur dans l'équipe",
    noResults: 'Aucun résultat',
    number: 'Numéro',
    numberOptional: 'Numéro (optionnel)',
    numberShort: 'N°{{number}}',
    playerSelection: 'Sélection des joueurs',
    pleaseWait: 'Patiente',
    plusAdd: '+ Ajouter',
    save: 'Enregistrer',
    search: 'Rechercher...',
    selectAll: 'Tout sélectionner',
    selectAtLeastOne: 'Sélectionne au moins un joueur',
    selectedPlayers_one: '{{count}} joueur sélectionné',
    selectedPlayers_other: '{{count}} joueurs sélectionnés',
    teamLabel: 'Équipe : {{teamName}}',
    unavailable: 'Indisponible',
    validateWithSize: 'Valider ({{size}})',
    warning: 'Attention',
  },
  teamCreationGate: {
    affiliationPending: {
      // eslint-disable-next-line max-len
      message: "Ton adhésion à {{club}} n'est pas encore validée. Un dirigeant du club doit d'abord accepter ta demande : tu pourras créer ton équipe juste après. Inutile de remplir le formulaire maintenant, il serait refusé à la dernière étape.",
      title: 'Ton adhésion est en attente',
    },
    coachNotAllowed: {
      // eslint-disable-next-line max-len
      message: '{{club}} a choisi que seuls ses dirigeants créent les équipes. Demande à un dirigeant de créer la tienne, ou de te donner ce droit dans les réglages du club.',
      title: 'Ce club réserve la création aux dirigeants',
    },
    yourClub: 'ton club',
  },
  teamInvitation: {
    refusal: {
      alreadyInvited: 'Cette personne a déjà une invitation en attente pour cette équipe.',
      alreadyMember: "Cette personne fait déjà partie de l'équipe.",
      fallback: "Impossible d'envoyer l'invitation pour le moment.",
      forbidden: "Tu n'as pas le droit d'inviter dans cette équipe.",
      incomplete: "Informations incomplètes : impossible d'envoyer l'invitation.",
      unknownTeam: 'Cette équipe est introuvable.',
      unknownUser: 'Ce profil est introuvable. Il a peut-être été supprimé.',
    },
    thisPerson: 'Cette personne',
  },
  teamInviteService: {
    errors: {
      cancel: "Impossible d'annuler cette invitation pour le moment.",
      claim: "Impossible d'ouvrir cette invitation pour le moment.",
      link: "Impossible de préparer le lien d'invitation.",
      phone: "Impossible d'enregistrer cette invitation pour le moment.",
      preview: 'Impossible de lire cette invitation pour le moment.',
      sent: 'Impossible de charger les invitations envoyées.',
      suggestions: 'Impossible de charger les propositions.',
    },
  },
  teamInviteShare: {
    // eslint-disable-next-line max-len
    message: "Tu es invité·e à rejoindre l'équipe {{team}} sur FoundClub. Ouvre ce lien pour voir l'invitation :",
    // eslint-disable-next-line max-len
    messageFrom: "{{inviter}} t'invite à rejoindre l'équipe {{team}} sur FoundClub. Ouvre ce lien pour voir l'invitation :",
    teamWithClub: '{{team}} ({{club}})',
  },
  teamInviteSheet: {
    accepted: {
      body: "{{name}} fait maintenant partie de l'équipe.",
      title: 'Demande acceptée',
    },
    acceptError: {
      body: "La demande n'a pas pu être acceptée. Réessaie dans un instant.",
      title: "Impossible d'accepter",
    },
    acceptRequest: 'Accepter',
    cancelError: {
      body: "Cette invitation n'est peut-être plus en attente.",
      title: "Impossible d'annuler",
    },
    empty: {
      allInTeam: "Tout ton club est déjà dans l'équipe.",
      // eslint-disable-next-line max-len
      allInTeamExplanation: "Pour faire venir quelqu'un de nouveau, partage-lui un lien d'invitation juste au-dessus.",
    },
    // eslint-disable-next-line max-len
    intro: "Invite une personne de la liste, ou envoie un lien : la personne verra qui l'invite et dans quelle équipe, et c'est elle qui accepte.",
    phone: {
      alreadyMember: {
        body: "Cette personne fait déjà partie de l'équipe.",
        title: "Déjà dans l'équipe",
      },
      errors: {
        // eslint-disable-next-line max-len
        dailyLimit: 'Tu as atteint la limite de 20 invitations par numéro sur 24 heures. Réessaie demain.',
        firstname: 'Indique le prénom de la personne.',
        phone: "Ce numéro de téléphone n'est pas valide.",
      },
      firstnamePlaceholder: 'Prénom',
      numberPlaceholder: 'Numéro de téléphone',
      open: 'Par numéro',
      // eslint-disable-next-line max-len
      privacy: "Un SMS part de ton téléphone avec le lien. Quand la personne crée son compte avec ce numéro, l'invitation l'attend. Le prénom et le numéro sont effacés à sa réponse, ou au bout de 30 jours.",
      send: "Envoyer l'invitation",
      title: "Inviter quelqu'un qui n'a pas l'app",
    },
    qr: {
      caption: "Fais scanner ce code : la personne verra qui l'invite.",
      hide: 'Masquer le QR code',
      show: 'Montrer un QR code',
    },
    reason: {
      applied: "A candidaté à une annonce de l'équipe",
      appliedTo: 'A candidaté : {{label}}',
      club: 'Membre de ton club',
      clubStaff: 'Encadrant de ton club',
      otherTeam: 'Joue en {{label}}',
      otherTeamUnnamed: 'Joue dans une autre équipe du club',
      requested: "A demandé à rejoindre l'équipe",
      requestedOn: "A demandé à rejoindre l'équipe le {{date}}",
    },
    sent: {
      accepted: 'Acceptée',
      cancel: 'Annuler',
      cancelled: 'Annulée',
      expired: 'Expirée',
      nameWithHint: '{{name}} · •• {{hint}}',
      pending: 'En attente',
      pendingUntil: 'En attente · expire le {{date}}',
      refused: 'Refusée',
      resend: 'Renvoyer',
      title: 'Invitations envoyées',
      unnamed: 'Invitation par numéro',
    },
  },
  teamListContent: {
    createSquad: 'Créer une squad',
    memberCount_one: '{{count}} membre',
    memberCount_other: '{{count}} membres',
    newTeam: {
      freeRemaining: 'Il te reste {{remaining}} création gratuite',
      freeUsed: "Ta création gratuite est utilisée — débloque l'offre Équipe",
      hint: 'Crée une équipe pour ton club.',
      title: 'Nouvelle équipe',
    },
    searchSquad: 'Rechercher une squad',
    sections: {
      invitations: 'Invitations reçues',
      mine: 'Mes équipes',
      other: 'Autres équipes',
      otherInClub: 'Autres équipes du club',
      pending: 'Demandes en attente',
    },
  },
  teamMembershipRequestService: {
    errors: {
      accept: "Impossible d'accepter cette invitation pour le moment.",
      decline: 'Impossible de refuser cette invitation pour le moment.',
      invite: "Impossible d'envoyer l'invitation pour le moment.",
    },
  },
  teamSlotCreationForm: {
    add: 'Ajouter',
    both: 'Les deux',
    cancel: 'Annuler',
    chooseADay: 'Choisir un jour',
    chooseOneOrMoreDays: 'Choisir un ou plusieurs jours',
    chooseTheDays: 'Choisir les jours',
    day: 'Jour',
    dayS: 'Jour(s)',
    deleteThisSlot: 'Supprimer ce créneau',
    edit: 'Modifier',
    end: 'Fin',
    friday: 'Vendredi',
    host: 'Recoit',
    monday: 'Lundi',
    onThisSlot: 'Sur ce créneau',
    saturday: 'Samedi',
    start: 'Début',
    sunday: 'Dimanche',
    thursday: 'Jeudi',
    travel: 'Se deplace',
    tuesday: 'Mardi',
    wednesday: 'Mercredi',
  },
  teamSlotList: {
    add: '+ Ajouter',
    checkInSoon: 'Check-in bientôt disponible.',
    comingSoon: 'Bientôt disponible',
    confirmedPlayers: 'Joueurs confirmés',
    cta: {
      confirmPresence: 'Je suis présent',
      removePresence: 'Retirer ma présence',
    },
    empty: 'Aucun créneau défini.',
    joinHint: 'Rejoindre la squad pour participer.',
    memberHelp: 'Touche pour confirmer ta présence.',
    status: {
      complete: 'Complet',
      confirmed: '{{count}}/{{required}} confirmés',
      remaining: 'Encore {{count}}',
    },
    title: 'Disponibilités (créneaux)',
  },
  teamDetails: {
    actions: {
      contactTeam: 'Contacter',
      contactTrainer: "Contacter l'entraîneur·e",
      contactTrainers: 'Contacter les entraîneur·e·s',
      contactTrainersError: "Impossible d'ouvrir la conversation pour le moment.",
      convocations: 'Convocations',
      defaultComposition: 'Composition type',
      edit: 'Modifier',
      facilities: 'Installations',
      inviteMember: 'Inviter un membre du club',
      join: "C'est mon équipe !",
      joinRequest: "Demander à rejoindre l'équipe",
      leave: "Quitter l'équipe",
      noTrainerContact: "Aucun entraîneur n'est disponible pour cette équipe.",
      openPanel: 'Ouvrir',
      panelTitle: "Actions d'équipe",
      publicJoin: "C'est mon équipe",
      requestPending: 'Demande en attente',
      shareInviteLink: "Partager un lien d'invitation",
      sponsors: 'Sponsors & partenaires',
      stats: 'Statistiques',
      teamChat: 'Équipe',
      teamChatFull: "Discussion d'équipe",
      teamDues: "Cotisation de l'équipe",
    },
    alerts: {
      addTrainerError: "Impossible d'ajouter cet entraîneur",
      deleteTrainer: {
        actions: {
          cancel: 'Annuler',
          confirm: 'Supprimer du club',
        },
        description: 'Le compte ne sera pas supprimé, mais l\'entraîneur·e ne sera plus lié·e au club ni à aucune de ces équipes.'
          + ' Si tu souhaites le retirer seulement de cette équipe merci de passer par le bouton de modification de l\'équipe.',
        title: 'Tu es sur le point de supprimer cet·te entraîneur·e de ton club.',
      },
      deleteTrainerError: 'Impossible de retirer cet entraîneur',
      invitePlayers: {
        alreadyHaveTheApp: "J'ai déjà l'application",
        downloadApp: "Telecharge l'application ici",
        downloadOnAndroid: 'Télécharger sur Android',
        downloadOnIOS: 'Télécharger sur iOS',
        message: 'Bonjour !'
          + '\nVotre équipe {{teamName}} de ton club {{clubName}} t\'attend !'
          + "\nTélécharge l'application Found Club pour finaliser la création de ton compte"
          + ' et commencer accéder et participer aux événements de ton équipe.',
        title: 'Tes coéquipiers t\'attendent !',
      },
      joinRequest: {
        actions: {
          ok: 'OK',
        },
        // eslint-disable-next-line max-len
        coachDescription: "Les entraîneurs de l'équipe et le dirigeant du club vont recevoir ta demande.",
        description: 'Ton entraîneur·e va recevoir ta demande et la traiter dès que possible.',
        title: 'Ta demande d\'adhésion a bien été envoyée',
      },
      leave: {
        actions: {
          cancel: 'Annuler',
          confirm: "Quitter l'équipe",
        },
        description: 'Tu es sur le point de quitter l\'équipe. Une fois cette action validée tu ne pourras plus participer aux entraînements et matchs.',
        title: 'Es-tu sûr·e de vouloir quitter cette équipe ?',
      },
      removePlayer: {
        description: "Veux-tu vraiment retirer ce joueur de l'équipe ?",
        title: 'Supprimer le joueur',
      },
      removePlayerError: 'Impossible de retirer ce joueur de l équipe',
      trainerRequired: 'Au moins un entraîneur est requis',
      updateTrainersError: 'Impossible de mettre à jour les entraîneurs',
    },
    attendance: {
      late: 'Retards',
      lateAverage: 'Retard moyen',
      lateCount_one: '{{count}} retard',
      lateCount_other: '{{count}} retards',
      lateMinutes: '{{minutes}} min',
      playerFallback: 'Joueur·se',
      ratio: 'Assiduité',
      summary: '{{players}} joueur·se·s · {{events}} événements',
      title: 'Présences',
    },
    calendar: {
      dateUnknown: 'Date à confirmer',
      empty: {
        all: 'Aucun match pour ce filtre.',
        results: 'Aucun résultat disponible.',
        upcoming: 'Aucun match à venir pour cette équipe.',
      },
      filters: {
        myTeam: 'À venir',
        poolCalendar: 'Calendrier poule',
        poolResults: 'Joués',
      },
      followedTeam: 'Équipe suivie',
      months: {
        all: 'Tous les mois',
      },
      monthUnknown: 'Date à confirmer',
      round: {
        chip: 'J{{round}}',
        title: 'Journée {{round}}',
        unknown: 'Journée non précisée',
        unknownShort: 'J?',
      },
      rounds: {
        all: 'Toutes les journées',
      },
      scope: {
        ffbbRound: 'Affichage organise par journée FFBB.',
        fullPool: 'Résultats et calendrier de toute la poule.',
        upcomingAll: 'Rencontres à venir de la poule.',
        upcomingTeamOnly: 'Prochaines rencontres de ton équipe uniquement.',
      },
      status: {
        played: 'Terminé',
        upcoming: 'À venir',
      },
      you: 'Toi',
    },
    calendarCard: {
      away: 'Extérieur',
      empty: 'Aucun calendrier disponible.',
      home: 'Domicile',
      matchCount_one: '{{count}} match',
      matchCount_other: '{{count}} matchs',
    },
    contact: {
      startConversationError: 'Impossible de démarrer la conversation.',
    },
    errors: {
      fallback: 'Erreur',
    },
    events: {
      emptyBody: 'Ton 1ᵉʳ événement est offert — entraînement, match…',
      emptyCreate: 'Créer',
      emptyTitle: 'Aucun événement prévu',
    },
    external: {
      actions: {
        addSource: 'Ajouter une source',
        editSource: 'Modifier la source',
        report: 'Voir le rapport',
        reportBug: 'Signaler',
        sync: 'Synchroniser',
      },
      cardTitle: 'Source externe',
      errorsTitle: 'Erreurs',
      errorTitle: 'Problème de synchronisation',
      followedTeam: 'Équipe suivie',
      history: {
        errors: 'erreurs',
        warnings: 'avertissements',
      },
      historyTitle: 'Dernières synchronisations',
      lastConfigUpdate: 'Lien mis à jour',
      lastConfigUpdateBy: 'Mis à jour par',
      lastMode: 'Origine',
      lastSync: 'Dernière synchronisation',
      loading: {
        // eslint-disable-next-line max-len
        connectingDescription: 'Nous récupérons le classement, le calendrier et les données associées.',
        connectingTitle: 'Connexion de ton équipe',
        previewingDescription: 'Nous récupérons la liste des équipes disponibles.',
        previewingTitle: 'Analyse de la compétition',
        waitDescription: 'Merci de patienter pendant la récupération des données.',
        waitTitle: 'Chargement en cours',
      },
      mode: {
        connect: 'Configuration initiale',
        daily: 'Synchronisation auto quotidienne',
        hotWindow: 'Synchronisation auto autour des matchs',
        manual: 'Synchronisation manuelle',
        unknown: 'Synchronisation',
      },
      noSource: 'Aucune source configurée',
      pool: 'Poule',
      prompt: {
        cta: 'Ajouter le classement',
        description: "Tu peux ajouter le lien du classement de ta ligue pour retrouver directement dans l'application ton classement, ton calendrier et tes statistiques.",
        title: 'Ajoute le classement de ta ligue',
      },
      recommendedBadge: 'Recommandée',
      recommendedTeam: 'Équipe recommandée',
      // eslint-disable-next-line max-len
      replaceDescription: "Cette équipe a déjà une source configurée. La nouvelle source remplacera l'ancienne configuration.",
      replaceTitle: 'Remplacer la source externe ?',
      report: {
        archivedSection: 'Événements archivés',
        away: 'Exterieur',
        createdSection: 'Événements créés',
        dateUnknown: 'Date à confirmer',
        home: 'Domicile',
        openEvent: "Ouvrir l'événement",
        scoreUpdatedSection: 'Scores importes',
        skippedSection: 'Matchs ignorés',
        title: 'Classement et calendrier synchronisés',
        unknownOpponent: 'Adversaire non précisé',
        updatedSection: 'Événements mis à jour',
      },
      resolutionMode: 'Mode de résolution',
      resolvedSource: 'Source résolue',
      // eslint-disable-next-line max-len
      staffOnly: "Seul un entraîneur assigné à cette équipe ou un dirigeant du club peut lancer l'import.",
      status: {
        configured: 'Configuré',
        error: 'Erreur',
        notConfigured: 'Non configuré',
        synced: 'Synchronisé',
        syncedWithWarnings: 'Synchronisé avec avertissements',
        syncing: 'Synchronisation',
      },
      summary: {
        archived: 'Archives',
        created: 'Créés',
        scoreUpdated: 'Scores importes',
        unchanged: 'Inchangés',
        updated: 'Mis à jour',
        venueDetailFetchFailed: 'Détails lieu KO',
        venueEnriched: 'Lieux enrichis',
        venueFallbackUsed: 'Lieu à confirmer',
      },
      syncCompleted: 'Classement et calendrier synchronisés.',
      warningsTitle: 'Avertissements',
    },
    externalSync: {
      provider: 'Provider: {{provider}}',
      resolution: {
        direct: 'Lien compétition direct',
        normalizedDirect: 'Lien source normalisé',
        storedSource: 'Source configurée existante',
        teamPageHtml: 'Page équipe FFBB résolue via le contenu HTML',
        teamPageRewrite: 'Page équipe FFBB résolue via redirection',
      },
      strategy: {
        calendar: 'Calendrier',
        ngStateFallback: 'fallback ng-state',
        securedApi: 'API sécurisée',
        securedApiMonthly: 'API sécurisée mensuelle',
        securedApiScoped: 'API sécurisée ciblée',
        securedApiTeam: 'API sécurisée équipe',
        skippedPreview: 'non chargé en preview',
        standings: 'Classement',
        unavailable: 'indisponible',
      },
    },
    ffbb: {
      configure: 'Configurer le classement externe',
      configureDescription: "Colle l'URL de ton compétition FFF ou FFBB",
      configureTitle: 'Configurer le classement externe',
      description: 'Description (optionnel)',
      descriptionPlaceholder: 'Décris le problème...',
      errorReported: 'Signalement envoyé, merci !',
      noCandidate: 'Aucune équipe détectée depuis cette source.',
      noData: 'Aucun classement externe configuré',
      problems: {
        missingTeam: 'Équipe manquante',
        other: 'Autre',
        outdated: 'Données obsoletes',
        wrongData: 'Données incorrectes',
        wrongUrl: 'Mauvaise URL',
      },
      problemType: 'Type de problème',
      reportTitle: 'Signaler un problème',
      selectTeam: 'Sélectionne ton équipe',
      urlError: 'Erreur lors de la configuration: ',
    },
    ffbbForm: {
      urlPlaceholder: 'https://epreuves.fff.fr/... ou https://competitions.ffbb.com/...',
    },
    header: {
      clubCertified: 'Club certifié',
      clubNotCertified: 'Club non certifié',
    },
    invitation: {
      accept: 'Accepter',
      error: 'Impossible de répondre à cette invitation pour le moment.',
      message: 'Le staff de cette équipe t\'invite à la rejoindre. À toi de décider.',
      refuse: 'Refuser',
      title: 'Invitation',
    },
    // INVIT (2026-09-05) — les mots de la feuille qui envoie une VRAIE
    // invitation. ⚠️ Ne pas confondre avec `invitation` juste au-dessus, qui
    // est le sens INVERSE : ce que voit la personne INVITÉE.
    invite: {
      action: 'Inviter',
      emptyClub: "Personne d'autre dans ton club pour l'instant.",
      emptyExplanation: 'Tu peux inviter directement les personnes déjà rattachées à ton club.'
        + " Pour quelqu'un d'un autre club, envoie-lui plutôt un lien d'invitation :"
        + " il·elle pourra demander à rejoindre l'équipe.",
      emptyHidden: 'Ce club masque ses membres : impossible de les proposer ici.',
      emptySearch: 'Personne de ce nom dans ton club.',
      emptyTeamHint: "Invite un membre du club, ou partage un lien d'invitation.",
      errorTitle: 'Invitation impossible',
      searchPlaceholder: 'Rechercher un membre du club',
      sentBadge: 'Invitation envoyée',
      sentMessage: '{{name}} va recevoir une notification.'
        + " Elle rejoindra l'équipe si elle accepte.",
      sentTitle: 'Invitation envoyée',
      sheetIntro: 'Choisis une personne de ton club :'
        + " elle reçoit une invitation, et c'est elle qui accepte.",
      sheetTitle: "Inviter dans l'équipe",
      someone: 'Cette personne',
    },
    members: {
      emptyInvite: 'Inviter',
      emptyTitle: "Personne pour l'instant",
    },
    modals: {
      trainers: {
        add: 'Ajouter un entraîneur',
        noData: 'Aucun entraîneur ou dirigeant disponible',
        title: 'Choisir les entraîneurs',
      },
    },
    myTitle: 'Mon équipe',
    perf: {
      basketballLine: '{{rebounds}} rebonds - {{threePointers}} tirs à 3 points',
      // eslint-disable-next-line max-len
      body: "Lecture des stats publiées de l'équipe, avec prise en compte des réponses joueur quand elles sont disponibles.",
      coachRating: 'Coach',
      coachScore: 'Coach {{rating}}/10',
      cumulativeScore: 'Score cumule: {{scoreFor}} - {{scoreAgainst}}',
      empty: 'Aucune performance de match disponible pour le moment.',
      eyebrow: 'Performance équipe',
      feedbackCount_one: "d'après {{count}} retour post-match",
      feedbackCount_other: "d'après {{count}} retours post-match",
      footballLine: '{{cleanSheets}} clean sheets - {{conceded}} buts encaissés',
      lastResponse: 'Dernière réponse le {{date}}',
      loading: 'Chargement des performances...',
      matchFallback: 'Match',
      newResponse: 'Nouvelle réponse',
      newResponses: '{{total}} nouvelles réponses',
      open: 'Ouvrir',
      pendingDraft: 'Brouillon équipe',
      // eslint-disable-next-line max-len
      pendingOnly: 'Des réponses joueur existent déjà pour des matchs en attente de publication équipe.',
      pendingReport: 'En attente du bilan équipe',
      pendingTitle: 'Réponses joueur en attente de validation équipe',
      playerBasketballLine: '{{points}} points - {{assists}} passes - {{rebounds}} rebonds',
      playerFallback: 'Joueur',
      playerFootballLine: '{{goals}} buts - {{assists}} passes - {{minutes}} min',
      playerMatches: '{{matches}} matchs',
      playersRating: 'Joueurs',
      playersScore: 'Joueurs {{rating}}/10',
      playersTitle: 'Joueurs',
      published: 'Publie',
      ratingCount_one: '{{count}} note',
      ratingCount_other: '{{count}} notes',
      recentTitle: 'Derniers matchs renseignes',
      responses: '{{submitted}}/{{eligible}} joueurs ont répondu',
      stats: {
        assists: 'Passes décisives',
        goals: 'Buts',
        matches: 'Matchs',
        minutes: 'Minutes',
        points: 'Points',
      },
      title: 'Récap du groupe',
    },
    playerSheet: {
      absenceCount_one: '{{count}} absence',
      absenceCount_other: '{{count}} absences',
      attendanceTitle: "Vie d'équipe",
      lateCount_one: '{{count}} retard',
      lateCount_other: '{{count}} retards',
      perf: {
        assists: 'passes',
        goals: 'buts',
        matches: 'matchs',
        minutes: '{{minutes}} min',
        playingTime: 'temps de jeu',
        points: 'points',
        title: 'Performance · saison',
      },
      presence: 'Présences',
      writeTo: 'Écrire à {{name}}',
      writeToFallback: 'ce membre',
    },
    sections: {
      membersHiddenTitle: 'Membres masqués',
      nextEvents: 'Prochains événements',
      noTrainer: 'Aucun entraîneur pour le moment',
      players_one: 'Joueur·se',
      players_other: 'Joueur·se·s',
      playersHidden: 'Le club masque les joueurs de cette équipe pour les visiteurs externes.',
      trainers_one: 'Entraîneur·e',
      trainers_other: 'Entraîneur·e·s',
      trainersHidden: 'Le club masque les entraîneurs de cette équipe pour les visiteurs externes.',
    },
    slots: {
      comingSoonBody: 'La gestion des créneaux sera activee prochainement.',
      comingSoonTitle: 'Bientôt disponible',
    },
    standingsTable: {
      difference: 'Diff',
      goals: 'buts {{goalsFor}}–{{goalsAgainst}}',
      levelFallback: 'Classement',
      matchday: 'Journée {{round}}',
      points: 'Pts',
      promotion: 'Montée',
      relegation: 'Descente',
      team: 'Équipe',
      you: 'Toi',
    },
    states: {
      backToTeams: 'Retour aux équipes',
      loadErrorBody: 'Réessaie dans quelques instants.',
      loadErrorTitle: "Impossible de charger l'équipe",
      loading: "Chargement de l'équipe...",
      missingIdBody: "Aucun identifiant d'équipe n'a été fourni.",
      missingIdTitle: 'Équipe introuvable',
      notFoundBody: "Le lien est peut-être obsolète ou l'équipe a été supprimée.",
      notFoundTitle: 'Cette équipe est introuvable',
      retry: 'Réessayer',
    },
    stats: {
      baselineLabel: 'Depuis le {{date}}',
      noData: 'Aucune statistique disponible pour le moment.',
      resetAction: 'Réinitialiser les statistiques',
      // eslint-disable-next-line max-len
      resetDescription: "Les compteurs repartiront de zéro à partir de maintenant. L'historique est conservé.",
      resetError: 'Impossible de réinitialiser les statistiques',
      resetReasonDefault: 'Reset manuel depuis Mon équipe',
      resetSuccess: 'Les statistiques ont été réinitialisées à partir de maintenant.',
      resetTitle: 'Réinitialiser les statistiques ?',
      summaryHint: 'Consulte les statistiques détaillées de ton équipe.',
    },
    statsModes: {
      attendance: "Vie d'équipe",
      performance: 'Performance',
    },
    tabs: {
      calendar: 'Calendrier',
      infos: 'Infos',
      standings: 'Classement',
      stats: 'Stats',
    },
    title: 'Équipe',
    trainerPicker: {
      userFallback: 'Utilisateur',
    },
    trainerPreselect: {
      body: '{{name}} est présélectionné. Vérifie puis appuie sur "Valider".',
      title: 'Preselection effectuée',
      trainerFallback: "L'entraîneur",
    },
    upsell: {
      clubAction: "Voir l'offre →",
      clubLabel: "Avec l'offre Club",
      teamAction: 'Débloquer →',
      teamLabel: "Avec l'offre Équipe",
    },
  },
  /* eslint-enable perfectionist/sort-objects */
  teamEdit: {
    actions: {
      deleteConfirmAction: 'Oui, supprimer',
      deleteError: "Impossible de supprimer l'équipe.",
      deleteTeam: "Supprimer l'équipe",
      deleteTitle: "Supprimer l'équipe",
      save: 'Enregistrer',
      saveError: 'Impossible d enregistrer l équipe.',
    },
    fields: {
      activities: {
        label: 'Sports',
        placeholder: 'Sélectionner un sport',
      },
      address: {
        label: "Adresse de l'équipe",
        placeholder: 'Rechercher une adresse',
      },
      category: {
        label: 'Catégorie',
        placeholder: 'Sélectionner une catégorie',
      },
      description: {
        label: 'Description',
        placeholder: 'Équipe senior évoluant en championnat régional depuis 2015.',
      },
      level: {
        label: 'Niveau',
        placeholder: 'Sélectionner un niveau',
      },
      name: {
        label: 'Nom de l\'équipe',
        placeholder: 'Les lions de Marseille',
      },
      section: {
        label: 'Section',
        placeholder: 'Sélectionner une section',
      },
      trainers: {
        actions: {
          add: 'Ajouter un entraîneur',
        },
        label: 'Entraîneur·e·s',
        placeholder: 'Sélectionner un·e entraîneur·e',
      },
    },
    membershipRequests: {
      // eslint-disable-next-line max-len
      allowCoachHint: 'Si ce réglage est désactivé, seul le dirigeant pourra accepter ou refuser les demandes pour cette équipe.',
      allowCoachToggle: "Autoriser l'entraîneur à traiter les demandes",
      // eslint-disable-next-line max-len
      allSelectedHint: "Aucun filtre précis n'est appliqué: tous les entraîneurs de l'équipe pourront traiter les demandes.",
      authorizedManagers: 'Entraîneurs autorisés',
      // eslint-disable-next-line max-len
      authorizedManagersHint: 'Seuls les entraîneurs sélectionnés pourront gérer les demandes. Le dirigeant gardera toujours une vue complète.',
      authorizedManagersPlaceholder: 'Tous les entraîneurs sélectionnés',
      // eslint-disable-next-line max-len
      description: 'Choisis si les entraîneurs de cette équipe peuvent gérer les demandes, ou si le dirigeant garde la main.',
      // eslint-disable-next-line max-len
      ownerOnlyDescription: 'Le club est configuré pour que le dirigeant traite toutes les demandes. Les entraîneurs de cette équipe ne pourront pas accepter ou refuser directement.',
      title: "Demandes d'adhésion",
    },
    paymentValidation: {
      authorizedValidators: 'Entraîneurs autorisés à encaisser',
      // eslint-disable-next-line max-len
      authorizedValidatorsHint: 'Ces entraîneurs pourront enregistrer un paiement reçu pour cette équipe uniquement. Tu gardes tous tes droits, et tu peux retirer cette autorisation à tout moment.',
      authorizedValidatorsPlaceholder: 'Personne pour le moment',
      // eslint-disable-next-line max-len
      description: 'Choisis les entraîneurs qui pourront marquer une cotisation comme payée pour cette équipe. Ils ne verront jamais l’argent des autres équipes.',
      // eslint-disable-next-line max-len
      noneHint: 'Personne n’est autorisé : toi seul peux enregistrer un paiement reçu pour cette équipe.',
      title: 'Encaissement des cotisations',
    },
    sections: {
      sportProfile: 'Profil sportif',
    },
    states: {
      backToTeams: 'Retour aux équipes',
      clubNotFound: 'Club introuvable pour cette équipe. Reessaye ou reviens à la fiche équipe.',
      loadError: 'Impossible de charger les informations de l équipe.',
      loading: 'Chargement des informations de cette équipe...',
      missingId: 'Identifiant d équipe manquant. Ouvre la fiche équipe pour continuer.',
      notFound: 'Équipe introuvable. Vérifie le lien ou retourne à la liste des équipes.',
      retry: 'Réessayer',
    },
    title: 'Créer une équipe',
    titleEdit: "Modifier l'équipe",
    trainers: {
      me: '{{firstname}} {{lastname}} (Toi)',
    },
  },
  teamFilters: {
    actions: {
      apply: 'Appliquer les filtres',
      clear: 'Effacer les filtres',
    },
    fields: {
      activities: {
        label: 'Sports',
        placeholder: 'Sélectionner un sport',
      },
      category: {
        label: 'Catégorie',
        placeholder: 'Sélectionner une catégorie',
      },
      level: {
        label: 'Niveau',
        placeholder: 'Sélectionner un niveau',
      },
      name: {
        label: 'Nom de l équipe',
        placeholder: 'Rechercher un nom',
      },
      section: {
        label: 'Section',
        placeholder: 'Sélectionner une section',
      },
    },
    status: {
      // eslint-disable-next-line max-len
      referenceErrorBody: 'Tu peux quand même filtrer par nom, ou recharger les listes de référence.',
      referenceErrorTitle: 'Certaines listes n ont pas pu être chargées.',
    },
    title: 'Filtres équipes',
  },
  teamList: {
    actions: {
      add: 'Ajouter une équipe',
    },
    alerts: {
      maxTeamLimitReached: {
        actions: {
          cancel: 'Abandon',
          contact: 'Contacter Found Club',
        },
        description: 'Tu as atteint le nombre maximum d\'équipes autorisées dans ton club. Merci de contacter Found Club pour débloquer cette limite.',
        title: 'Limite d\'équipes atteinte',
      },
    },
    awaitingApproval: {
      approveCta: 'Valider cette équipe',
      // eslint-disable-next-line max-len
      explanation: "Cette équipe a été créée par un·e entraîneur·e de ton club. Elle n'apparaîtra pour les autres qu'une fois que tu l'auras validée.",
    },
    badges: {
      coach: 'COACH',
      invitation: 'INVITATION',
      pending: 'EN ATTENTE',
      player: 'JOUEUR·SE',
    },
    fields: {
      category: 'Catégorie',
      level: 'Niveau',
      members: 'Membres',
      section: 'Section',
    },
    findTeamCta: 'Rechercher une équipe',
    // eslint-disable-next-line max-len
    noClubEmptyDescription: 'Recherche un club, ouvre sa fiche, puis demande à rejoindre une équipe.',
    noClubEmptyTitle: "Tu n'as pas encore d'équipe",
    noData: 'Aucune équipe trouvée.',
    noSearchResult: 'Aucune équipe trouvée pour cette recherche',
    pendingNotice: {
      claim: {
        unblocks: 'Une fois acceptée, tu deviens dirigeant·e du club et tu peux créer tes équipes.',
        waiting: 'Ta demande pour diriger ce club',
        who: 'FoundClub vérifie que tu diriges bien ce club. Tu n\'as rien à faire de ton côté.',
      },
      clubJoin: {
        unblocks: 'Une fois acceptée, tu fais partie du club.',
        waiting: 'Ta demande pour rejoindre ce club',
        who: 'Un·e dirigeant·e du club doit l\'accepter.',
      },
      teamInvite: {
        unblocks: 'Si tu acceptes, tu rejoins l\'effectif.',
        waiting: 'Cette équipe t\'invite',
        who: 'Ouvre la fiche de l\'équipe pour accepter ou refuser.',
      },
      teamJoin: {
        unblocks: 'Une fois acceptée, tu rejoins l\'effectif.',
        waiting: 'Ta demande pour rejoindre cette équipe',
        who: 'Le staff de l\'équipe doit l\'accepter.',
      },
    },
    searchPlaceholder: 'Mes équipes',
    stats: {
      members: 'Membres',
      trainers: 'Entraîneur·e·s',
    },
    title: 'Équipes de mon club',
    trainerGuide: {
      // eslint-disable-next-line max-len
      body: '{{name}} est maintenant dans ton club.\n\n1. Ouvre une équipe.\n2. Appuie sur "Modifier".\n3. Dans la section "Entraîneurs", ajoute-le puis valide.',
      nameFallback: 'Cet entraîneur',
      title: 'Assigner un entraîneur',
    },
    tutorial: {
      description: 'Consulte tes équipes, les demandes et ouvre chaque fiche équipe.',
      title: 'Mes équipes',
    },
  },
  teamMembershipRequestList: {
    actions: {
      accept: 'Accepter',
      backToTeams: 'Retour aux équipes',
      reject: 'Refuser',
    },
    errors: {
      accept: 'Impossible de valider la demande pour le moment.',
      load: "Impossible de charger les demandes d'équipe pour le moment.",
      loadTitle: 'Chargement impossible',
      missingTeamBody: "Impossible d'ouvrir ces demandes sans identifiant d'équipe.",
      missingTeamTitle: 'Équipe introuvable',
      reject: 'Impossible de refuser la demande pour le moment.',
    },
    fields: {
      accepted: 'Demande acceptée',
      pending: "{{firstname}} s'est signalé comme joueur·se de l'équipe",
      rejected: 'Demande refusée',
    },
    governance: {
      manageAllowed: 'Tu peux traiter cette demande pour cette équipe.',
      // eslint-disable-next-line max-len
      ownerOnly: '{{name}} a demandé à rejoindre {{team}}. Ton équipe doit attendre la validation par ton ou tes dirigeant(s).',
      // eslint-disable-next-line max-len
      readOnly: 'Tu vois cette demande, mais seul un entraîneur autorisé ou le dirigeant peut la traiter.',
    },
    noData: 'Aucune demande d\'adhésion en attente',
    title: 'Demandes d\'adhésion',
    tutorial: {
      description: "Ici tu peux accepter ou refuser les demandes d'adhésion à tes équipes.",
      title: 'Demandes équipe',
    },
  },
  teamStack: {
    headers: {
      createSquad: 'Créer une Squad',
    },
  },
  teamStats: {
    empty: 'Aucun joueur dans cette équipe',
    title: 'Statistiques',
  },
  teamStatsScreen: {
    columns: {
      absence: 'Abs.',
      attendance: 'Prés.',
      late: 'Ret.',
    },
    header: {
      events: 'Événements',
      players: 'Joueurs',
      sport: 'Sport',
    },
    states: {
      backToTeams: 'Retour aux équipes',
      loadError: 'Impossible de charger les statistiques',
      missingIdBody: 'Aucun identifiant d équipe n a été fourni.',
      notFoundTitle: 'Équipe introuvable',
      retry: 'Réessayer',
    },
    table: {
      player: 'Joueur',
    },
  },
  teamWizard: {
    actions: {
      create: "Créer l'équipe",
      skipStep: 'Passer cette étape',
    },
    blocked: {
      backCta: "J'ai compris",
    },
    clubRequired: {
      createCta: 'Je ne trouve pas mon club',
      searchCta: 'Rechercher mon club',
      // eslint-disable-next-line max-len
      subtitle: 'Une équipe appartient toujours à un club. Rejoins ton club ou crée-le, puis reviens créer ton équipe.',
      title: "Il te faut d'abord un club",
    },
    created: {
      // eslint-disable-next-line max-len
      message: 'Félicitations, ton équipe est créée. Tu peux dès maintenant y ajouter tes joueur·ses et créer tes premiers événements.',
      // eslint-disable-next-line max-len
      pendingMessage: "Félicitations, votre équipe est créée. Vous pourrez en profiter une fois qu'elle sera validée par votre dirigeant.",
      pendingTitle: 'Félicitations',
      title: 'Félicitations',
    },
    errors: {
      clubRequired: 'Club introuvable. Recommence la création depuis la liste équipe.',
      trainerRequired: 'Sélectionne au moins un entraîneur.',
    },
    recap: {
      freeQuota: {
        footnote: 'Cette équipe utilise ta création gratuite ({{used}}/{{total}}).',
      },
      identity: 'Identité',
      noDescription: 'Aucune — ajouter ?',
      staff: 'Encadrement',
    },
    steps: {
      activity: {
        allSports: 'Autres sports',
        clubSports: 'Les sports de ton club',
        clubSportTag: 'Sport du club',
        searchPlaceholder: 'Rechercher un sport…',
        skipEmpty: 'Continuer sans sport',
        subtitle: "Le sport principal de l'équipe.",
        title: 'Sport',
      },
      category: {
        skipEmpty: 'Continuer sans catégorie',
        subtitle: "La catégorie d'âge de l'équipe.",
        title: 'Catégorie',
      },
      description: {
        // eslint-disable-next-line max-len
        hint: "Visible sur la page de l'équipe et dans la recherche — utile pour attirer des joueur·se·s.",
        // eslint-disable-next-line max-len
        placeholder: 'Ex. : Équipe engagée en championnat départemental. Entraînements mardi et jeudi, matchs le samedi.',
        subtitle: "Optionnel — précise l'identité et les objectifs de l'équipe.",
        title: 'Description',
      },
      level: {
        skipEmpty: 'Continuer sans niveau',
        subtitle: "Le niveau de compétition de l'équipe.",
        title: 'Niveau',
      },
      name: {
        hint: 'Visible par tout le club — modifiable plus tard.',
        placeholder: 'Ex. : U15 Filles',
        subtitle: 'Donne un nom clair à ton équipe pour la retrouver facilement.',
        suggestions: 'Suggestions',
        title: "Nom de l'équipe",
      },
      recap: {
        subtitle: 'Vérifie, puis crée ton équipe.',
        title: 'Récapitulatif',
      },
      section: {
        skipEmpty: 'Continuer sans section',
        subtitle: 'Dans quelle section joue cette équipe ?',
        title: 'Section',
      },
      trainers: {
        createCta: '+  Créer un·e entraîneur·e',
        createHint: 'Invitation envoyée par e-mail',
        selfHint: "Tu es déjà sélectionné·e — tu pourras en ajouter d'autres plus tard.",
        selfTag: 'Toi',
        subtitle: 'Sélectionne au moins un·e entraîneur·e pour encadrer cette équipe.',
        title: 'Entraîneur·e·s',
      },
    },
  },
  teamWizardActivity: {
    // eslint-disable-next-line max-len
    clubMissing: 'Club introuvable pour initialiser la création de l’équipe. Reviens à la liste des équipes puis relance le wizard.',
    empty: 'Aucun sport n’est proposé pour le moment.',
    loadError: 'Impossible de charger le référentiel des sports. Réessaie pour continuer.',
    loading: 'Chargement des sports disponibles…',
    noMatch: 'Aucun sport ne correspond à ta recherche.',
    retry: 'Réessayer',
  },
  teamWizardCategory: {
    empty: 'Aucune catégorie d’âge n’est proposée pour le moment.',
    loadError: 'Impossible de charger les catégories. Réessaie pour continuer.',
    loading: 'Chargement des catégories disponibles…',
    retry: 'Réessayer',
  },
  teamWizardEmptyReferential: {
    // eslint-disable-next-line max-len
    sharedExplanation: 'Cette liste est commune à toute l’application : ce n’est pas ton club qui manque quelque chose. Tu pourras la renseigner plus tard, depuis la fiche de l’équipe.',
  },
  teamWizardLevel: {
    empty: 'Aucun niveau n’est proposé pour le moment.',
    loadError: 'Impossible de charger les niveaux. Réessaie pour continuer.',
    loading: 'Chargement des niveaux disponibles…',
    retry: 'Réessayer',
  },
  teamWizardName: {
    chooser: {
      alreadyMember: 'Tu y es déjà — ouvrir',
      body: 'Rejoins une équipe existante, reprends-en une sans entraîneur·e, ou crée la tienne.',
      claiming: 'Reprise en cours…',
      claimTag: 'Reprendre',
      createNew: 'Créer une nouvelle équipe',
      orphan: 'Sans entraîneur·e — reprends-la',
      teamFallback: 'Équipe',
      title: 'Ton club a déjà des équipes',
      trainerCount_one: '{{count}} entraîneur·e',
      trainerCount_other: '{{count}} entraîneur·es',
    },
    claim: {
      error: 'Impossible de reprendre cette équipe pour le moment.',
      success: "Tu es maintenant l'entraîneur·e de {{team}}.",
      teamFallback: 'cette équipe',
    },
    quotaLabel: 'Équipes',
    suggestions: {
      mixedLeisure: 'Loisir mixte',
      seniorsA: 'Seniors A',
      u15Girls: 'U15 Filles',
    },
  },
  teamWizardRecap: {
    // eslint-disable-next-line max-len
    loadErrorBody: 'Réessaie avant de créer cette équipe pour vérifier le club, les référentiels et les entraîneur·e·s.',
    loadErrorTitle: 'Impossible de charger toutes les informations du récapitulatif.',
    loading: 'Chargement du récapitulatif de cette équipe…',
    paywallContext: 'Ta nouvelle équipe',
    retry: 'Réessayer',
    trainers: {
      fallback: 'Entraîneur·e',
      roleCoach: 'coach',
      rolePresident: 'dirigeant·e',
      self: 'Toi',
      selfWithRole: ' — toi, {{role}}',
    },
  },
  teamWizardSection: {
    empty: 'Aucune section n’est proposée pour le moment.',
    loadError: 'Impossible de charger les sections. Réessaie pour continuer.',
    loading: 'Chargement des sections disponibles…',
    retry: 'Réessayer',
    subtitles: {
      mixte: 'Ouverte à toutes et tous',
    },
  },
  teamWizardTrainers: {
    // eslint-disable-next-line max-len
    clubMissing: "Club introuvable pour initialiser la création de l'équipe. Reviens à la liste des équipes puis relance le wizard.",
    // eslint-disable-next-line max-len
    empty: "Aucun·e entraîneur·e n'est encore disponible pour ce club. Ajoutes-en un·e pour continuer.",
    loadError: 'Impossible de charger les membres du club. Réessaie pour continuer.',
    loading: 'Chargement des entraîneur·e·s du club…',
    retry: 'Réessayer',
    roles: {
      coach: 'Coach',
      president: 'Dirigeant·e',
    },
  },
  timePickerInput: {
    cancel: 'Annuler',
  },
  tomTomSearchMapNative: {
    error: {
      retry: 'Réessayer',
      showList: 'Voir la liste',
      title: 'Impossible de charger la carte',
    },
    tapMarker: 'Touche un repère pour voir la fiche',
  },
  tourBanner: {
    collapse: 'Réduire le tour',
    compact: 'Tour {{step}}/{{total}}',
    nextStep: 'Étape suivante',
    quit: 'Quitter le tour',
    resume: 'Reprendre le tour',
    show: 'Afficher le tour guidé',
    skip: 'Passer',
    stepOf: 'Tour guidé · étape {{step}} sur {{total}}',
    waiting: "Ton tour guidé t'attend (étape {{step}}/{{total}})",
  },
  tourCatalog: {
    coachComposition: {
      instruction: "Prépare ta compo — terrain d'essai, rien n'est publié.",
      manualLabel: "J'ai testé",
      successMessage: 'Compo maîtrisée ! (Publier une convocation = offre Équipe)',
      title: 'Préparer une composition',
    },
    coachCreateEvent: {
      instruction: 'Crée ton premier événement — il est offert.',
      skipLabel: 'Créer plus tard',
      successMessage: '🎉 Ton événement offert est en ligne !',
      title: 'Ton premier événement',
    },
    coachCreateTeam: {
      instruction: 'Crée ton équipe — tout le reste en découle (ta 1ʳᵉ équipe est offerte).',
      skipLabel: 'Créer plus tard',
      successMessage: '🎉 Ton équipe est créée !',
      title: 'Crée ton équipe',
    },
    coachFindEventCard: {
      // eslint-disable-next-line max-len
      instruction: 'Ton équipe est prête ! Sur ton accueil, touche la carte « Ajouter un événement ».',
      manualLabel: "M'y emmener",
      successMessage: "Bien trouvé ! C'est ici que tout se crée.",
      title: 'Trouve la carte « Ajouter un événement »',
    },
    coachFollowEvent: {
      // eslint-disable-next-line max-len
      instruction: 'Ouvre ton événement depuis le planning : présents, absents, retards et arrivées se suivent ici.',
      manualLabel: "J'ai vu",
      successMessage: 'Tu sais suivre ton événement.',
      title: 'Suivre ton événement',
    },
    coachMessaging: {
      instruction: 'Le groupe de ton équipe est déjà créé.',
      manualLabel: "J'ai vu",
      successMessage: 'Communication en place.',
      title: 'Ta messagerie',
    },
    coachOffers: {
      instruction: 'Voici ce que chaque offre débloque — à toi de jouer.',
      manualLabel: 'Terminer le tour',
      successMessage: 'Tour terminé 🎉 Bienvenue chez toi.',
      title: 'Les offres FoundClub',
    },
    coachPlanning: {
      instruction: 'Ton planning regroupe toute ta semaine.',
      manualLabel: "J'ai vu",
      successMessage: 'Planning en poche.',
      title: 'Ton planning',
    },
    coachTeam: {
      instruction: 'Ton espace équipe : invite tes joueur·se·s avec le lien de partage.',
      manualLabel: "J'ai vu",
      successMessage: 'Ton équipe est prête à grandir.',
      title: 'Ton équipe',
    },
    playerMessaging: {
      instruction: 'Le groupe de ton équipe est déjà là — chat illimité, pour toujours.',
      manualLabel: "J'ai vu",
      successMessage: 'Tu sais où parler à ton équipe.',
      title: 'Messagerie',
    },
    playerParticipation: {
      instruction: 'Trouve un événement qui te plaît et réponds présent·e.',
      manualLabel: 'Plus tard',
      successMessage: 'Première participation enregistrée !',
      title: 'Répondre présent·e',
    },
    playerPlanning: {
      instruction: 'Retrouve ici tous tes événements et ton agenda.',
      manualLabel: "J'ai vu",
      successMessage: 'Ton planning est prêt !',
      title: 'Mon planning',
    },
    playerProfile: {
      instruction: 'Complète ton profil sportif pour être repéré·e.',
      manualLabel: 'Terminer le tour',
      successMessage: 'Profil au top — tour terminé 🎉',
      title: 'Mon profil',
    },
    presidentClub: {
      instruction: 'Ton espace club : infos, logo, coordonnées.',
      manualLabel: "J'ai vu",
      successMessage: 'Ton club a une vitrine.',
      title: 'Ta fiche club',
    },
    presidentEvents: {
      instruction: 'Crée un événement pour ton club — le premier est offert.',
      skipLabel: 'Créer plus tard',
      successMessage: '🎉 Ton événement offert est en ligne !',
      title: 'Ton premier événement',
    },
    presidentMessaging: {
      instruction: 'Groupes de discussion du club.',
      manualLabel: "J'ai vu",
      successMessage: 'Communication club vue.',
      title: 'Communication',
    },
    presidentOffers: {
      instruction: "L'offre Club débloque tout ça d'un coup.",
      manualLabel: 'Terminer le tour',
      successMessage: 'Tour terminé 🎉',
      title: "L'offre Club",
    },
    presidentPlanning: {
      instruction: 'Le planning du club : terrains, salles et créneaux colorés par installation.',
      manualLabel: "J'ai vu",
      successMessage: 'Installations repérées (offre Club).',
      title: 'Installations & planning',
    },
    presidentTeams: {
      instruction: 'Gère toutes les équipes de ton club ici.',
      manualLabel: "J'ai vu",
      successMessage: "Vue d'ensemble acquise.",
      title: 'Les équipes du club',
    },
  },
  tournamentCompetitionComponents: {
    drawShort: 'N',
    gd: 'Diff',
    group: 'Poule',
    groupLabel: 'Poule {{label}}',
    knockoutStage: 'Phase finale',
    lossShort: 'D',
    noGroupHasBeenDrawn: 'Aucune poule n à encore été tirée.',
    noKnockoutBracketGeneratedYet: 'Aucun tableau final génère pour le moment.',
    noStandingsComputedYet: 'Aucun classement calcule pour le moment.',
    p: 'PJ',
    qualifiedA: 'Qualifié A',
    qualifiedB: 'Qualifié B',
    round: 'Tour',
    seeTheMatch: 'Voir le match',
    standings: 'Classement',
    teamA: 'Équipe A',
    teamB: 'Équipe B',
    teamFallback: 'Equipe',
    timeToBeSet: 'Horaire à définir',
    toBeDecided: 'A définir',
    tournamentMatch: 'Match tournoi',
    winShort: 'V',
  },
  tournamentManagement: {
    aClubTeam: 'une équipe club',
    // eslint-disable-next-line max-len
    afterPublishingTheSportsStructure: 'Après publication, la structure sportive sera verrouillée. Seuls les horaires, installations et scores resteront modifiables.',
    approve: 'Valider',
    archiveTheTeam: 'Archiver l équipe',
    automatic: 'Automatique',
    bracketGenerated: 'Bracket génère',
    cancel: 'Annuler',
    close: 'Cloturer',
    closeTheTournament: 'Clôturer le tournoi',
    competitionActions: 'Actions compétition',
    competitionPublished: 'Compétition publiée',
    competitionView: 'Lecture compétition',
    decline: 'Refuser',
    drawTheGroups: 'Tirer les poules',
    // eslint-disable-next-line max-len
    drawTheGroupsGenerateThe: 'Tire les poules, génère les matchs, calcule les classements et pilote la phase finale depuis un seul cockpit.',
    editTheSettings: 'Modifier les paramètres',
    filterAccepted: 'Validees',
    filterAll: 'Toutes',
    filterArchived: 'Archivees',
    filterDeclined: 'Refusees',
    filterPending: 'En attente',
    filterWarning: 'Warnings roster',
    fromTeam: 'Depuis {{teamName}}',
    generateTheKnockoutStage: 'Générer la phase finale',
    generateTheMatches: 'Générer les matchs',
    manual: 'Manuelle',
    matchGenerationMode: 'Génération des matchs: {{mode}}',
    noMatchGeneratedYet: 'Aucun match génère pour le moment.',
    noTeamMatchesThisFilter: 'Aucune équipe ne correspond à ce filtre pour le moment.',
    openTheTeam: 'Ouvrir l équipe',
    pointsSummary: 'Points: V {{win}} | N {{draw}} | D {{loss}} | F {{forfeit}}',
    publish: 'Publier',
    publishTheCompetition: 'Publier la compétition',
    qualifiedPerGroup: 'Qualifies / poule: {{qualified}}',
    registeredTeams: 'Équipes inscrites',
    rosterWarning: 'Warning roster',
    // eslint-disable-next-line max-len
    runTheDrawGenerateThe: 'Organise le tirage, génère les matchs, puis publie la compétition quand la structure est prête.',
    seeding: 'Tirage: {{seeding}}',
    seeTheMatch: 'Voir le match',
    sportsStructure: 'Structure sportive',
    syncTheStructure: 'Synchroniser la structure',
    tabBracket: 'Phases finales',
    tabGroups: 'Poules',
    tabMatches: 'Matchs',
    tabOverview: 'Vue d ensemble',
    tabStandings: 'Classements',
    tabTeams: 'Equipes',
    teamApprovalMode: 'Validation des équipes: {{mode}}',
    temporaryTeamCreatedByA: 'Équipe éphémère créée par un joueur',
    // eslint-disable-next-line max-len
    theSportsStructureIsNow: 'La structure sportive est maintenant verrouillée. Les horaires, installations et scores restent modifiables.',
    // eslint-disable-next-line max-len
    theTournamentIsNowClosed: 'Le tournoi est maintenant ferme et les équipes éphémères sont archivées.',
    // eslint-disable-next-line max-len
    thisActionArchivesAllTemporary: 'Cette action archive toutes les équipes éphémères et gele les modifications sur la compétition.',
    tournamentClosed: 'Tournoi clôture',
    tournamentControl: 'Pilotage du tournoi',
    tournamentTeam: 'Équipe tournoi',
    unableToCloseThisTournament: 'Impossible de clôturer ce tournoi.',
    unableToDrawTheGroups: 'Impossible de tirer les poules.',
    unableToGenerateTheKnockout: 'Impossible de générer la phase finale.',
    unableToGenerateTheMatches: 'Impossible de générer les matchs.',
    unableToPublishThisCompetition: 'Impossible de publier cette compétition.',
    unableToSyncTheTournament: 'Impossible de synchroniser la structure du tournoi.',
    unableToUpdateThisTeam: 'Impossible de mettre à jour cette équipe.',
    // eslint-disable-next-line max-len
    youCanFollowGroupsMatches: 'Tu peux suivre les poules, les matchs, les classements et le bracket depuis ce cockpit en lecture seule.',
  },
  tournamentMatchDetails: {
    addressUnavailable: 'Adresse indisponible',
    approveTheScore: 'Valider le score',
    backToTheTournament: 'Retour au tournoi',
    chooseTheWinner: 'Choisir le vainqueur',
    endTime: 'Heure de fin',
    // eslint-disable-next-line max-len
    enterTwoValidScoresFor: 'Renseigne deux scores valides. Pour un match nul en phase finale, indique aussi le vainqueur.',
    facility: 'Installation',
    forfeitOf: 'Forfait {{teamName}}',
    groupLabel: 'Poule {{label}}',
    incompleteScore: 'Score incomplet',
    incompleteSlot: 'Créneau incomplet',
    // eslint-disable-next-line max-len
    inTheKnockoutStageA: 'En phase finale, un match nul doit tout de même designer une équipe qualifiée.',
    knockoutStage: 'Phase finale',
    noFacility: 'Aucune installation',
    noFacilityAvailableForThis: 'Aucune installation disponible pour ce club.',
    refereeCommentsMatchContextForfeit: 'Commentaires arbitre, contexte du match, forfait...',
    saveTheScore: 'Enregistrer le score',
    saveTheSlot: 'Enregistrer le créneau',
    scheduleTheMatch: 'Programmer le match',
    scoreEntry: 'Saisie du score',
    selectAValidDateStart: 'Sélectionne une date, une heure de début et une heure de fin valides.',
    startTime: 'Heure de début',
    teamA: 'Équipe A',
    teamB: 'Équipe B',
    timeToBeSet: 'Horaire à définir',
    tournamentMatch: 'Match tournoi',
    unableToApproveThisScore: 'Impossible de valider ce score.',
    unableToSaveThisScore: 'Impossible d enregistrer ce score.',
    unableToScheduleThisMatch: 'Impossible de programmer ce match.',
  },
  tournamentSettingsEdit: {
    accessReservedForTheOrganiser: 'Accès réserve a l organisateur',
    addsASmallFinalWhen: 'Ajoute une petite finale quand la compétition atteint les demi-finales.',
    // eslint-disable-next-line max-len
    adjustTheTournamentSGlobal: 'Ajuste les règles globales du tournoi sans toucher aux équipes permanentes du club.',
    allowPlayersFromOtherClubs: 'Autoriser les joueurs d autres clubs',
    // eslint-disable-next-line max-len
    allowsAdditionsFromOutsideThe: 'Autorise les ajouts hors club organisateur dans les rosters tournoi.',
    allowTemporaryTeams: 'Autoriser les équipes éphémères',
    automatic: 'Automatique',
    best3rds: 'Meilleurs 3es',
    bracketSize: 'Taille du bracket',
    cancel: 'Annuler',
    // eslint-disable-next-line max-len
    compatibleTeamsAreAcceptedDirectly: 'Les équipes compatibles sont acceptées directement a l inscription.',
    draw: 'Nul',
    drawMode: 'Mode de tirage',
    // eslint-disable-next-line max-len
    eachTeamStaysPendingUntil: 'Chaque équipe reste en attente tant que le dirigeant ne l a pas acceptée.',
    eGOneActivePlayer: 'Ex. un joueur actif par tournoi, tenue claire obligatoire...',
    forfeit: 'Forfait',
    groupsFinal: 'Poules + finale',
    groupsOnly: 'Poules uniquement',
    inManualModeOnlyThe: 'En mode manuel, seul l organisateur valide les équipes inscrites.',
    league: 'Championnat',
    loss: 'Défaite',
    manual: 'Manuelle',
    matchGeneration: 'Génération des matchs',
    maxNumberOfTeams: 'Nombre max d équipes',
    maxSquad: 'Effectif max',
    minSquad: 'Effectif min',
    numberOfGroups: 'Nombre de poules',
    // eslint-disable-next-line max-len
    onlyTheTournamentCreatorCan: 'Seul le createur du tournoi peut modifier ces paramètres globaux.',
    playersCanCreateTheirOwn: 'Les joueurs peuvent créer leur propre équipe pour ce tournoi.',
    qualifiedPerGroup: 'Qualifiés par poule',
    rosterImpactDetected: 'Impact roster détecte',
    save: 'Enregistrer',
    seedingManual: 'Ordre manuel',
    seedingRandom: 'Aleatoire',
    seedingSnake: 'Serpentin',
    setWhoCanCreateA: 'Définis qui peut créer une équipe et si le melange de clubs est autorise.',
    sportsStructure: 'Structure sportive',
    straightKnockout: 'Phase finale directe',
    teamApproval: 'Validation des équipes',
    // eslint-disable-next-line max-len
    teamSAlreadyAcceptedWill: '{{teamsCount}} équipe(s) déjà acceptée(s) deviendront non conformes avec ces règles. Leur statut restera accepte, avec warning visible seulement.',
    teamsAndEligibility: 'Équipes et eligibility',
    theMinimumSquadSizeCan: 'L effectif minimum ne peut pas dépasser l effectif maximum.',
    // eslint-disable-next-line max-len
    theNumberOfTeamsAnd: 'Le nombre d équipes et la fourchette d effectif s appliquent à toutes les équipes éphémères de ce tournoi.',
    // eslint-disable-next-line max-len
    theOrganiserTriggersTheSchedule: 'L organisateur déclenche lui-même la génération du calendrier.',
    // eslint-disable-next-line max-len
    theScheduleIsGeneratedAutomatically: 'Le calendrier est généré automatiquement une fois les poules créées.',
    // eslint-disable-next-line max-len
    theseSettingsDriveTheGroups: 'Ces réglages pilotent les poules, la phase finale et le calcul du classement. Après modification, resynchronise la compétition depuis le cockpit organisateur.',
    thirdPlaceMatch: 'Match pour la 3e place',
    // eslint-disable-next-line max-len
    thisTextIsShownOn: 'Ce texte est affiche sur la fiche tournoi et sert de référence commune pour les équipes.',
    tournamentFrame: 'Cadre du tournoi',
    tournamentRules: 'Règles du tournoi',
    tournamentSettings: 'Paramètres du tournoi',
    unableToUpdateTheTournament: 'Impossible de mettre à jour les paramètres du tournoi.',
    useAStandardBracketSize: 'Utilise une taille de bracket standard: 2, 4, 8, 16 ou 32.',
    win: 'Victoire',
  },
  tournamentTeamDetails: {
    absent: 'Absent',
    accept: 'Accepter',
    // eslint-disable-next-line max-len
    acceptedRequestsThenMoveInto: 'Les demandes acceptées passent ensuite dans le roster actif avec un statut initial en attente.',
    acceptThisRequest: 'Veux-tu accepter cette demande ?',
    // eslint-disable-next-line max-len
    activeMembersMakeUpThe: "Les membres actifs composent l'équipe tournoi. Cette composition ne modifie jamais l'équipe club permanente.",
    activeRoster: 'Roster actif',
    askToJoin: 'Demander à rejoindre',
    backToTheTournament: 'Revenir au tournoi',
    cancel: 'Annuler',
    cancelTheInvitation: "Annuler l'invitation",
    captain: 'Capitaine',
    chosenTeam: 'Équipe choisie : {{name}}.',
    close: 'Fermer',
    closeRequests: 'Fermer les demandes',
    confirm: 'Confirmer',
    decline: 'Refuser',
    declined: 'Refusé',
    declineThisRequest: 'Veux-tu refuser cette demande ?',
    derivedFrom: 'Équipe tournoi dérivée de {{name}}',
    exceptionalAddition: 'Ajout exceptionnel',
    foundclubProfile: 'Profil FoundClub',
    // eslint-disable-next-line max-len
    incomingRequestsAreDisabledOnly: 'Les demandes entrantes sont désactivées. Seules tes invitations manuelles sont possibles.',
    inheritedFromTheClubTeam: "Hérité de l'équipe club",
    invitationAddsYou: "Cette invitation t'ajoute au roster tournoi uniquement si tu l'acceptes.",
    invitationReceived: 'Invitation reçue',
    invitationSent: 'Invitation envoyée',
    invite: 'Inviter',
    inviteAClubPlayerWithout: "Invite un joueur du club sans toucher à l'équipe club de base.",
    inviteAPlayer: 'Inviter un joueur',
    joinRequest: 'Demande de rejoindre',
    joinRequests: 'Demandes de rejoindre',
    joinThisTeam: 'Rejoindre cette équipe',
    leave: 'Quitter',
    leaveTheTeam: "Quitter l'équipe",
    leaveThisTeam: 'Quitter cette équipe ?',
    makeCaptain: 'Nommer capitaine',
    maximumSquadSizeExceeded: 'Effectif maximum dépassé: {{totalCount}}/{{maxRosterSize}}',
    me: 'Moi',
    member: 'Membre',
    myTournamentAnswer: 'Ma réponse tournoi',
    noActiveMemberInThe: 'Aucun membre actif dans le roster pour le moment.',
    noOtherPlayerAvailableTo: 'Aucun autre joueur disponible à inviter pour le moment.',
    noPendingRequestForNow: 'Aucune demande en attente pour le moment.',
    noProfileAvailableToInvite: 'Aucun profil disponible à inviter pour cette recherche.',
    openRequests: 'Ouvrir les demandes',
    participant: 'Participant',
    pending: 'En attente',
    pendingInvitations: 'Invitations en attente',
    // eslint-disable-next-line max-len
    playersCanSendARequest: 'Les joueurs peuvent envoyer une demande pour rejoindre cette équipe custom.',
    present: 'Présent',
    remove: 'Retirer',
    removeThisMember: 'Retirer ce membre',
    requestReceived: 'Demande reçue',
    requestsClosed: 'Demandes fermées',
    requestSent: 'Demande envoyée',
    searchForAClubPlayer: 'Rechercher un joueur du club',
    searchForAFoundclubPlayer: 'Rechercher un joueur FoundClub',
    // eslint-disable-next-line max-len
    searchForAFoundclubProfile: 'Recherche un profil FoundClub ou reprends un joueur du club pour lui envoyer une invitation.',
    searching: 'Recherche en cours...',
    // eslint-disable-next-line max-len
    sendAJoinRequestThe: "Envoie une demande de rejoindre. Le capitaine ou un admin pourra ensuite l'accepter ou la refuser.",
    sendMyRequest: 'Envoyer ma demande',
    teamArchived: 'Équipe archivée',
    teamStatus: 'Statut équipe',
    temporaryTeamCreatedForThis: 'Équipe éphémère créée pour ce tournoi',
    // eslint-disable-next-line max-len
    theCaptainOrAnAdmin: 'Le capitaine ou un admin doit ouvrir cette équipe avant de recevoir de nouvelles demandes.',
    theClubTeam: "l'équipe club",
    // eslint-disable-next-line max-len
    theNewCaptainWillManage: 'Le nouveau capitaine gérera cette équipe éphémère uniquement dans le cadre du tournoi.',
    // eslint-disable-next-line max-len
    theseProfilesArenTPart: "Ces profils ne font pas encore partie du roster actif tant qu'ils n'ont pas accepté.",
    // eslint-disable-next-line max-len
    theTournamentIsClosedTeam: "Le tournoi est fermé. Les modifications d'équipe et les nouvelles réponses sont maintenant bloquées.",
    thisActionOnlyRemovesThe: 'Cette action ne retire le joueur que de cette équipe de tournoi.',
    // eslint-disable-next-line max-len
    thisTeamStaysAcceptedBut: "Cette équipe reste acceptée, mais un warning roster est maintenant visible pour l'organisateur.",
    // eslint-disable-next-line max-len
    thisTemporaryTeamIsArchived: "Cette équipe éphémère est archivée. Le roster reste lisible mais n'est plus modifiable.",
    tournamentClosed: 'Tournoi clôturé',
    tournamentInvitation: 'Invitation tournoi',
    tournamentTeam: 'Équipe tournoi',
    unableToAnswerThisInvitation: 'Impossible de répondre à cette invitation.',
    unableToInviteThisPlayer: "Impossible d'inviter ce joueur.",
    unableToLeaveThisTeam: 'Impossible de quitter cette équipe.',
    unableToProcessThisRequest: 'Impossible de traiter cette demande.',
    unableToRemoveThisMember: 'Impossible de retirer ce membre.',
    unableToSendThisRequest: "Impossible d'envoyer cette demande.",
    unableToTransferTheCaptaincy: 'Impossible de transférer le capitanat.',
    unableToUpdateThisOption: 'Impossible de mettre à jour cette option.',
    unableToUpdateYourAnswer: 'Impossible de mettre à jour ta réponse.',
    // eslint-disable-next-line max-len
    youLlOnlyBeRemoved: 'Tu seras retiré uniquement de cette équipe de tournoi. Ton équipe club restera intacte.',
    // eslint-disable-next-line max-len
    yourRequestIsWaitingFor: 'Ta demande est en attente de validation par le capitaine ou un admin de cette équipe tournoi.',
  },
  tournamentUtils: {
    approved: 'Validée',
    archived: 'Archivée',
    cancelled: 'Annule',
    competitionInDraft: 'Compétition en brouillon',
    competitionPublished: 'Compétition publiée',
    declined: 'Refusée',
    draft: 'Brouillon',
    forfeit: 'Forfait',
    groupsFinal: 'Poules + finale',
    groupsOnly: 'Poules uniquement',
    league: 'Championnat',
    pending: 'En attente',
    readyToPlay: 'Prêt à jouer',
    scheduled: 'Programme',
    scoreToApprove: 'Score à valider',
    straightKnockout: 'Phase finale directe',
    validated: 'Valide',
  },
  // BLOQUER (02/09) — un bloc A PART, volontairement : les lots ENFANTS et
  // HYGIENE ajoutent au meme moment dans `userDetails` et dans `profile`.
  // Aucune cle existante n'est touchee ici.
  training: {
    actions: {
      abandon: 'Quitter cet entraînement',
      back: 'Retour',
      choose: 'Choisir cet entraînement',
      close: 'Fermer',
      copyLogbook: 'Copier le carnet',
      finishDay: 'Terminer la journée',
      finishTest: 'Test terminé',
      invalidAttempt: 'Essai nul',
      next: 'Suivant',
      nextTest: 'Test suivant',
      openDay: 'Ouvrir la journée',
      openProgram: 'Voir le programme',
      postpone: 'Décaler',
      prepare: 'Préparer ma séance',
      previous: 'Précédent',
      resume: 'Reprendre',
      retry: 'Réessayer',
      save: 'Enregistrer',
      seeAll: 'Tout voir',
      skipSession: 'Sauter cette séance',
      startDay: 'Commencer la journée',
      startNow: 'Commencer maintenant',
      startSession: 'Commencer ma séance',
      startTest: 'Commencer le test',
      sync: 'Envoyer les mesures',
      watchVideo: 'Voir le geste',
    },
    attempt: {
      reason: 'Pourquoi cet essai est nul',
      title: 'Essai {{current}} sur {{total}}',
      // ⛔ Pas une petite croix : une rangee entiere. Une croix de douze points au
      // bout d un champ se rate avec les doigts froids, et surtout elle se lit
      // comme « effacer » alors qu elle veut dire « garder, mais nul ».
      void: 'Essai nul — je le garde au carnet',
    },
    catalog: {
      demands: '{{places}} · de {{min}} à {{max}} min par séance',
      empty: {
        action: 'Revenir',
        description: 'Aucun entraînement n\'est publié pour le moment. Reviens bientôt.',
        title: 'Rien à afficher',
      },
      error: {
        description: 'Les entraînements n\'ont pas pu être chargés.',
        title: 'Connexion impossible',
      },
      legend_one: 'Un seul programme est publié pour l’instant. Tu suis un programme '
        + 'à la fois — il s’ajoute dans « Mon entraînement ».',
      legend_other: 'Tu suis un programme à la fois — il s’ajoute dans '
        + '« Mon entraînement ».',
      published_one: 'Publié · {{count}} programme',
      published_other: 'Publiés · {{count}} programmes',
      rhythm: '{{sessions}} rendez-vous sur {{days}} jours',
      seeDetail: 'Voir le détail',
      stat: {
        days: 'journées',
        level: 'niveau',
        tests: 'tests',
      },
      subtitle: 'Choisis un entraînement, il apparaîtra dans « Mon entraînement ».',
      title: 'Choisir un entraînement',
    },
    day: {
      alreadyDone: 'Journée terminée',
      blocks_one: '{{count}} bloc',
      // Le CODE est le titre de l'\'ecran, pas le nom de la journee : c'\'est
      // ce qu'\'on cherche au bord du terrain, et ce qui est ecrit sur la feuille
      // de route du programme.
      blocks_other: '{{count}} blocs',
      code: 'Jour {{code}}',
      computeOnly: 'calcul seul',
      duration: '{{count}} min',
      // ⛔ « Contrôle de fraîcheur » a disparu : le pack interdit ce mot devant
      // l'utilisateur, et il a raison — personne ne parle comme ça. On pose la
      // question telle qu'on la poserait de vive voix.
      freshnessAction: 'Répondre aux 5 questions',
      freshnessRequired: 'Avant de commencer, cinq questions sur ta forme du jour.',
      heading: '{{date}} · {{place}}',
      inProgress: 'en cours',
      later: 'Je la ferai {{date}}',
      lines_one: '{{count}} ligne',
      lines_other: '{{count}} lignes',
      logbook: 'À noter dans le carnet',
      markers: 'À savoir avant de partir',
      measures_one: '{{count}} mesure',
      measures_other: '{{count}} mesures',
      points_one: '{{count}} point',
      points_other: '{{count}} points',
      // Le seul compteur de l ecran comptait les TESTS faits pendant la seance.
      // Celui-ci compte les PREPARATIFS, la veille : ce n est pas le meme geste,
      // ni le meme moment.
      prepared_one: '{{done}} faite sur {{total}}',
      prepared_other: '{{done}} faites sur {{total}}',
      progress_one: '{{done}} test sur {{total}} fait',
      progress_other: '{{done}} tests sur {{total}} faits',
      seeMeasures_one: 'Voir la mesure au carnet',
      seeMeasures_other: 'Voir les {{count}} mesures au carnet',
      tab: {
        onSite: 'Sur place',
        prepare: 'Préparer',
      },
      testsTitle: 'Les tests, dans l\'ordre',
      timeline: 'Le déroulé, minute par minute',
      warmup: 'Échauffement',
    },
    enroll: {
      confirm: 'Ajouter à mon entraînement',
      consequence: 'Les {{sessions}} séances seront planifiées à partir de cette date, '
        + 'sur {{days}} jours. Tu pourras décaler chacune, ou en commencer une autre.',
      custom: 'Choisir une date',
      notNow: 'Pas maintenant',
      pickDate: 'La date de ta première séance',
      today: 'Aujourd’hui',
      tomorrow: 'Demain',
      until: '{{start}} — fin le {{end}}',
      when: 'Quand veux-tu commencer ?',
    },
    enrolled: {
      before: {
        partner: 'Trouve un partenaire : il filme et chronomètre à chaque séance.',
        phone: 'Charge un smartphone qui filme en 240 images par seconde.',
        title: 'Avant la première séance',
        tripod: 'Prépare un trépied — les mesures se lisent sur des vidéos stables.',
      },
      // 🐞 AUCUN POINT FINAL APRES UNE DATE : en francais, une date abregee se
      // termine deja par un point (« dim. 20 sept. »). On lisait « … au dim.
      // 20 sept.. » a l ecran. Meme correction que la feuille « Décaler ».
      firstSession: 'Ça commence par {{day}}, le {{date}}',
      later: 'Plus tard',
      recap_one: '{{program}} — {{count}} séance planifiée du {{start}} au {{end}}',
      recap_other: '{{program}} — {{count}} séances planifiées du {{start}} au {{end}}',
      seeSessions: 'Voir mes séances',
      title: 'C’est dans ton entraînement',
    },
    freshness: {
      anyway: 'Je la fais quand même',
      decision: {
        go: 'C\'est bon, tu peux y aller.',
        postpone: 'Reporte la séance : une mesure prise fatigué serait fausse.',
        restricted: 'Vas-y, mais arrête les séries lourdes à une répétition de la réserve.',
      },
      // Le titre COURT du verdict, en gros, avec sa couleur. La phrase au-dessus
      // explique ; ces trois mots-là se lisent d'un coup d'œil.
      decisionTitle: {
        go: 'On y va',
        postpone: 'On reporte',
        restricted: 'Version allégée',
      },
      // Les deux bouts de chaque échelle : sans eux, « 1 » ne veut rien dire. Et
      // ils changent de sens d'une question à l'autre — 5 en courbatures veut dire
      // « aucune », 5 en sommeil veut dire « très bon ».
      ends: {
        fatigue: { high: 'Frais', low: 'Épuisé' },
        mood: { high: 'Très bonne', low: 'Très mauvaise' },
        sleep: { high: 'Très bon', low: 'Très mauvais' },
        soreness: { high: 'Aucune', low: 'Très douloureux' },
        stress: { high: 'Serein', low: 'Très tendu' },
      },
      intro: 'Réponds assis, avant de sortir le matériel. Tes réponses décident '
        + 'si la séance a lieu aujourd\'hui.',
      items: {
        fatigue: 'Fatigue',
        mood: 'Humeur',
        sleep: 'Sommeil',
        soreness: 'Courbatures',
        stress: 'Stress',
      },
      postponeAction: 'Reporter ma séance',
      saveFailed: 'Tes réponses n\'ont pas pu partir. Réessaie.',
      scale: {
        1: 'Très mauvais',
        2: 'Mauvais',
        3: 'Moyen',
        4: 'Bon',
        5: 'Très bon',
      },
      start: 'Commencer ma séance',
      startLight: 'Commencer en version allégée',
      title: 'Comment tu te sens ?',
      total: 'Total : {{score}} sur 25',
      totalLabel: 'Total',
      totalMax: 'sur 25',
    },
    guided: {
      attemptsSummary_one: '{{done}} essai bon sur {{total}} · {{voided}} nul',
      attemptsSummary_other: '{{done}} essais bons sur {{total}} · {{voided}} nuls',
      betweenTests: '{{count}} s avant {{test}}',
      checkTest: '{{test}} — vérifie avant de valider',
      doneTest: '{{test}} fait',
      // Le bouton unique du bas change de mot selon l arret : c est ce qui dit
      // toujours ou on va, au lieu d un « Suivant » qui ne dit rien.
      endHint: 'Valider ferme le test et propose le suivant. Finir plus tard le laisse '
        + 'ouvert : tu peux y revenir depuis ta séance.',
      finishLater: 'Finir plus tard',
      gesture: 'Le geste',
      go: {
        attempt: 'Enregistrer et récupérer',
        prep: 'Tout est en place',
        recovery: 'Commencer l’essai {{count}}',
        warmup: 'Commencer l’essai 1',
      },
      judgedLater: 'Les critères qui se voient sur la vidéo se jugent le soir, pas ici.',
      missing_one: 'Il reste {{count}} mesure à noter pour cet essai.',
      missing_other: 'Il reste {{count}} mesures à noter pour cet essai.',
      next: 'Ensuite',
      nextTest: 'Test suivant',
      prepHint: 'Ton partenaire compte à voix haute et filme ; toi, tu ne regardes '
        + 'plus l’écran.',
      prescribed: 'Prescrite : {{count}} s entre tentatives',
      redo: 'Refaire l’essai {{count}}',
      saved: 'Essai {{current}} enregistré',
      skipTest: 'Passer ce test aujourd’hui',
      stopHere: 'Arrêter le test ici',
      validate: 'Valider — {{test}} fait',
      videoLater_one: '{{count}} mesure se lira sur ta vidéo, plus tard.',
      videoLater_other: '{{count}} mesures se liront sur ta vidéo, plus tard.',
      videoQueue_one: '{{count}} mesure t’attend dans Relevés vidéo',
      videoQueue_other: '{{count}} mesures t’attendent dans Relevés vidéo',
      warmupHint: 'Le protocole complet reste lisible dans « Comprendre ». Ici, '
        + 'seulement ce que tu fais maintenant.',
      whatWeMeasure: 'Ce qu’on mesure',
      why: 'Pourquoi ?',
    },
    home: {
      countdown_one: 'dans {{count}} jour',
      countdown_other: 'dans {{count}} jours',
      findCard: {
        subtitle: 'Les programmes publiés',
        title: 'Choisir un entraînement',
      },
      logbookCard: {
        subtitle: 'Toutes tes mesures, prêtes à coller.',
        title: 'Mon carnet',
      },
      myCard: {
        emptySubtitle: 'Un protocole de tests athlétiques, avec un partenaire, '
          + 'sur plusieurs journées.',
        emptyTitle: 'Choisir un entraînement',
        // Le lieu et la durée viennent du serveur ; le compte de préparatifs n'apparaît
        // que si la journée en porte, sinon la phrase se coupe d'elle-même.
        subtitle: '{{day}} · {{place}} · {{duration}} min',
        title: '{{program}} — {{day}} {{countdown}}',
        today: 'aujourd’hui',
        tomorrow: 'demain',
        toPrepare_one: '{{count}} chose à préparer d’ici là',
        toPrepare_other: '{{count}} choses à préparer d’ici là',
      },
      section: 'Mon entraînement',
    },
    links: {
      // L etiquette dit ce qu on va ouvrir AVANT de l ouvrir : sans elle, trois
      // liens bleus se ressemblent tous.
      nature: {
        geste: 'Le geste en vidéo',
        logiciel: 'Le logiciel',
        source: 'La source',
      },
    },
    logbook: {
      attempt: 'essai {{count}}',
      // La pastille cyan qui dit qu une valeur ne vient pas d un chronometre mais
      // d un calcul de l app. Sans elle, on cherche a se rappeler si on l a saisie.
      computed: 'calculé',
      copied: 'Carnet copié',
      description: 'Une mesure par ligne, prête à coller.',
      empty: 'Tes mesures apparaîtront ici, séance après séance.',
      emptyAction: 'Voir ma prochaine séance',
      // 🪤 Le titre du vide redisait « Mon carnet », juste sous le vrai titre : on
      // lisait deux fois la meme chose et on croyait a un defaut d affichage.
      emptyTitle: 'Rien au carnet',
      rawHint: '12 colonnes, une mesure par ligne, point-virgule. Il existe pour être '
        + 'collé ailleurs, analysé, puis réimporté.',
      readableHint: 'La vue lisible est un confort de relecture — elle ne remplace pas '
        + 'le carnet brut.',
      rows_one: '{{count}} mesure',
      rows_other: '{{count}} mesures',
      side: {
        both: 'les deux',
        left: 'gauche',
        right: 'droite',
      },
      title: 'Mon carnet',
      view: {
        raw: 'Brut',
        readable: 'Lisible',
      },
      void: 'nul',
      // 🧑‍⚖️ QUI A JUGE. Le carnet ne dit plus seulement « nul », il dit d'où vient le
      // verdict : ce qu'on a vu sur place, ou ce qu'on a lu le soir sur la vidéo.
      voidBy: {
        terrain: 'nul · vu sur place',
        video: 'nul · vu à la vidéo',
      },
    },
    measures: {
      attempt: 'Essai {{number}}',
      computed: 'Calculé',
      context: 'À noter une fois',
      invalidReason: 'Pourquoi l\'essai est nul',
      // 🪤 « À saisir plus tard » n est PAS un concept neuf : c est le champ
      // `moment` du serveur, deja rempli sur les 413 mesures du programme. Il
      // manquait juste le mot pour le dire a l ecran.
      later: 'À saisir plus tard',
      noValue: 'Pas encore saisi',
      outOfRange: 'Valeur inhabituelle : {{min}} à {{max}} attendu. Vérifie avant d\'enregistrer.',
      performance: 'Ce que tu chronomètres ou mesures',
      side: {
        both: 'Les deux',
        left: 'Gauche',
        none: '',
        right: 'Droite',
      },
    },
    now: {
      allDone: 'Tout est fait',
      back: 'Revenir à ma séance',
      // 🐞 « T+2352 min » s affichait sur une seance ouverte l avant-veille : au-dela
      // de deux heures, plus personne ne lit des minutes. On bascule en heures.
      elapsed_one: 'T+{{count}} min',
      elapsed_other: 'T+{{count}} min',
      elapsedHours: 'T+{{hours}} h {{minutes}}',
      elapsedLong: 'ouverte depuis {{days}} j',
      // Une seule question se pose sur un terrain, entre deux essais, avec un
      // partenaire qui attend. L ecran ne repond qu a celle-la.
      hint: 'Une seule question ici : qu’est-ce que je fais maintenant ?',
      label: 'Maintenant',
      progress_one: '{{tests}} test fait · étape {{done}} sur {{total}}',
      progress_other: '{{tests}} tests faits · étape {{done}} sur {{total}}',
      resume: 'Continuer : {{test}}, {{what}}',
      resumeAttempt: 'essai {{count}}',
      resumePrep: 'mise en place',
      step: {
        attempt: '{{test}} · Essai {{current}} sur {{total}}',
        prep: '{{test}} · Mise en place',
      },
      title: 'Ma séance',
      whatNext: 'La suite, dans l’ordre',
    },
    plan: {
      abandonConfirm: {
        cancel: 'Non, je continue',
        confirm: 'Oui, quitter',
        description: 'Tes mesures déjà saisies sont conservées. Tu pourras choisir un autre entraînement.',
        failed: 'On n’a pas pu te désinscrire. Rien n’est perdu — réessaie.',
        title: 'Quitter cet entraînement ?',
      },
      // La clef reste : ⛔ aucune suppression dans fr.js. Elle titre desormais la
      // porte vers « Toutes mes seances », la ou elle titrait la liste elle-meme.
      dateHint: 'La date est indicative — tu décides quand.',
      days: 'Toutes mes séances',
      doors: {
        logbook: 'Mon carnet',
        logbookSubtitle_one: '{{count}} mesure enregistrée',
        logbookSubtitle_other: '{{count}} mesures enregistrées',
        sessionsSubtitle_one: '{{count}} séance au programme',
        sessionsSubtitle_other: '{{count}} séances au programme',
        video: 'Relevés vidéo à faire',
        videoSubtitle_one: '{{count}} mesure à lire sur ta vidéo',
        videoSubtitle_other: '{{count}} mesures à lire sur ta vidéo',
      },
      empty: {
        action: 'Choisir un entraînement',
        description: 'Choisis un programme : il apparaîtra ici, séance par séance.',
        title: 'Aucun entraînement en cours',
      },
      endsOn: 'fin le {{date}}',
      // 🪤 « À faire ensuite » titrait un encart SUPPRIME le 06/09 parce qu il
      // montrait la meme journee que la liste juste en dessous. La clef reprend
      // du service comme etiquette de la grande carte du haut.
      nextUp: 'Prochaine séance · {{date}}',
      // 🐞 CE BANDEAU NE PARLE PAS DE RESEAU. Sa condition est « des mesures
      // attendent d'être envoyées » — l'app n'a aucun detecteur de reseau. Il
      // s'affichait « Sans réseau » avec quatre barres de wifi, ce qui envoie
      // chercher la panne au mauvais endroit.
      offline: 'Des mesures attendent d’être envoyées — '
        + 'elles sont gardées sur le téléphone.',
      progress_one: '{{done}} séance faite sur {{total}}',
      progress_other: '{{done}} séances faites sur {{total}}',
      title: 'Mon entraînement',
      today: 'Aujourd’hui',
    },
    postpone: {
      // 🪤 i18next choisit `_one` a partir de count=1 : la premiere rangee dit donc
      // « Demain », pas « Dans 1 jour ». Les deux clefs restent, les deux servent.
      byDays_one: 'Demain',
      byDays_other: 'Dans {{count}} jours',
      chooseDate: 'Choisir une date',
      confirm: 'Décaler au {{date}}',
      confirmSkip: 'Sauter cette séance',
      // LA PHRASE QUI EST TOUT L'INTERET DE LA FEUILLE : elle dit AVANT ce que le
      // geste change a la date de fin. Sans elle, on decale a l'aveugle.
      // 🐞 PAS DE POINT FINAL : une date abregee en francais se termine deja par
      // un point (« sam. 19 sept. »). On lisait « … le sam. 19 sept.. » a l ecran.
      consequence: 'Les séances suivantes se décalent d’autant. '
        + 'Le programme finira le {{date}}',
      consequenceAlone: 'Seule cette séance bouge. La fin du programme ne change pas.',
      hint: 'La date est indicative — tu décides quand.',
      scope: 'Décaler aussi les séances suivantes, pour garder les écarts du programme.',
      skip: 'Sauter cette séance',
      skipWarning: 'Elle restera marquée « Sautée ». '
        + 'Les séances suivantes ne bougent pas.',
      title: 'Décaler la séance du {{date}}',
    },
    program: {
      contains: 'Ce que contient le programme',
      days_one: '{{count}} journée',
      days_other: '{{count}} journées',
      demands: {
        days_one: '{{count}} jour du premier au dernier rendez-vous',
        days_other: '{{count}} jours du premier au dernier rendez-vous',
        longest: 'la plus longue dure {{duration}} min',
        partner: 'un partenaire, présent à chaque séance : il filme et chronomètre',
        sessions_one: '{{count}} séance — {{places}}',
        sessions_other: '{{count}} séances — {{places}}',
        title: 'Ce que ça demande',
        total: '{{total}} minutes en tout, installation et récupérations comprises',
      },
      enrollFailed: 'On n’a pas pu t’inscrire à cet entraînement. '
        + 'Rien n’est perdu — réessaie.',
      equipment: 'Le matériel',
      equipmentCheck: 'As-tu ce qu’il faut ?',
      equipmentCount_one: '{{count}} ligne',
      equipmentCount_other: '{{count}} lignes',
      equipmentWarning: 'Il te faut l’accès à une salle de musculation : sans elle, '
        + 'cinq séances sur huit sont impossibles.',
      level: {
        avance: 'Avancé',
        decouverte: 'Découverte',
        elite: 'Élite',
        intermediaire: 'Intermédiaire',
      },
      startsToday: 'Il commencera aujourd\'hui. Tu pourras décaler chaque journée.',
      stat: {
        measures: 'mesures',
      },
      tests_one: '{{count}} test',
      tests_other: '{{count}} tests',
    },
    // ⚠️ « Relevés vidéo » et jamais « dépouiller » : le pack interdit ce mot
    // devant l utilisateur, et il a raison — personne ne dit qu il « depouille »
    // ses mesures.
    schema: {
      close: 'Fermer',
      family: {
        body: 'Position du corps',
        field: 'Plan de terrain',
      },
      hint: {
        body: 'Lecture rapide, debout. Pas de pivot : faire tourner quelqu’un '
          + 'debout ne rend pas le dessin plus lisible.',
        field: 'Pince pour zoomer. Pivoté, il se lit accroupi, les plots à la main.',
      },
      missing: 'Ce dessin n’est pas arrivé.',
      reset: '1:1',
      rotate: 'Pivoter',
      video: 'Vidéo du geste',
      zoomIn: 'Agrandir',
    },
    sessions: {
      lead: 'Dans l’ordre conseillé — mais tu peux en commencer n’importe laquelle.',
      title: 'Toutes mes séances',
    },
    status: {
      done: 'Fait',
      in_progress: 'En cours',
      planned: 'À faire',
      postponed: 'Reporté',
      skipped: 'Sauté',
    },
    sync: {
      allSent: 'Tout est envoyé',
      failed: 'Envoi impossible. Tes mesures sont gardées ici, elles partiront plus tard.',
      localFailed: 'Ton téléphone n\'a pas pu enregistrer cette valeur. '
        + 'Note-la sur papier et libère de la place avant de continuer.',
      offline_one: '{{count}} mesure en attente d\'envoi',
      offline_other: '{{count}} mesures en attente d\'envoi',
      success: 'Mesures envoyées',
    },
    test: {
      attempts_one: '{{count}} essai',
      attempts_other: '{{count}} essais',
      attemptsDone: '{{done}} notés · {{left}} restants',
      cells: 'Case {{done}} sur {{total}}',
      feeds: 'Ce que ce test alimente',
      invalidIf: 'Essai nul si',
      links: 'Pour voir le geste',
      offlineBody: 'Tes mesures déjà notées sont sur ton téléphone et repartiront '
        + 'toutes seules. La minuterie et le carnet local marchent sans réseau.',
      offlineTitle: 'Ce test n’est pas encore sur ton téléphone',
      optional: 'Facultatif',
      protocol: 'Le protocole',
      reading: 'Lire le résultat',
      recap: 'Ce qui est déjà noté',
      results: 'Tes mesures',
      seriesResult: 'Résultat de la série',
      // Les onglets s appelaient « Le protocole » et « Pourquoi ce test » : deux
      // titres de rubrique, pas deux modes. Ce qu ils separent, c est FAIRE et
      // COMPRENDRE — et c est ce qu ils doivent dire.
      setup: 'La mise en place',
      step: 'Test {{current}} sur {{total}}',
      tabDo: 'Faire',
      tabLearn: 'Comprendre',
      toEntry: 'Passer à la saisie',
      why: 'Pourquoi ce test',
    },
    timer: {
      done: 'C\'est parti',
      endsWith: 'À 0:00 · deux vibrations',
      recovery: 'Récupération',
      reset: 'Remettre à zéro',
      start: 'Lancer',
      stop: 'Arrêter',
    },
    video: {
      allDone: 'Tout est relevé',
      backToQueue: 'Revenir aux relevés',
      hint: 'Ce que tu relèves ici part au même carnet que le terrain : '
        + 'même ligne, même test, même essai.',
      // 🚨 Ce compteur manquait, et trois mesures sur quatre etaient
      // inatteignables : l ecran n affichait que la PREMIERE mesure d un essai.
      lead_one: 'mesure à relever sur tes vidéos.',
      lead_other: 'mesures à relever sur tes vidéos.',
      measureOf: 'mesure {{current}} sur {{total}}',
      nothingHere: 'Ce test n’a rien à relever sur la vidéo.',
      notStarted: 'Journée pas encore commencée — rien à relever pour l’instant.',
      previous: '← Essai {{count}}',
      // 🐞 « en attente » disait la MEME chose que le bandeau d envoi juste au-dessus
      // (« 2 mesures en attente » / « 2 mesures en attente d'envoi ») alors que les
      // deux comptent des choses differentes : le travail restant, et le reseau.
      remaining_one: '{{count}} mesure à relever',
      remaining_other: '{{count}} mesures à relever',
      save: 'Enregistrer',
      testDone: '{{test}} relevé',
      // 🧑‍⚖️ LA CASE DU SECOND JUGE, et elle n'annule QUE cette mesure : le programme
      // écrit lui-même « vitesse illisible … : le score reste, la vitesse est notée — ».
      unreadable: 'Illisible à la lecture — cette mesure seule est annulée',
      // 🐞 L ENTETE COMPTE CE QUI RESTE, la ligne comptait le TOTAL : « 3 mesures a
      // relever » en haut, « 4 mesures a lire » en dessous, et une barre a 25 %.
      // On dit maintenant les deux nombres, comme la barre juste en dessous.
      testLine_one: '{{attempts}} essai · {{done}} sur {{measures}} relevées',
      testLine_other: '{{attempts}} essais · {{done}} sur {{measures}} relevées',
      testsCount_one: '{{count}} test',
      testsCount_other: '{{count}} tests',
      title: 'Relevés vidéo',
    },
  },
  trainingBlocks: {
    bodyPosition: 'Position du corps',
    enlarge: 'Agrandir',
    pitchPlan: 'Plan de terrain',
  },
  trainingParcours: {
    prep: 'Prépa',
    warmUp: 'Éch.',
  },
  // AVIS (2026-09-09) — le pop-up « note ton entrainement ». Adel : « note sur
  // dix, ils peuvent laisser un commentaire, ce n est pas obligatoire ».
  trainingReviewPrompt: {
    anonymous: 'Ton avis est anonyme : ton entraîneur voit la note, jamais qui l’a mise.',
    commentPlaceholder: 'Un mot sur la séance ? (facultatif)',
    later: 'Plus tard',
    ratingLabel: 'Ta note sur 10',
    sending: 'Envoi…',
    submit: 'Envoyer mon avis',
    subtitle: '{{team}} · terminé {{date}}',
    title: 'Comment s’est passé ton entraînement ?',
  },
  // PARENT P2 (10/09) — « MES ENFANTS » et « un club pour mon enfant ».
  //
  // 🔒 Un enfant de moins de 13 ans n'a PAS de compte : le serveur le refuse.
  // Il vit ici sous forme de FICHE portée par le compte de son parent. Les
  // libellés parlent donc toujours d'un enfant, jamais d'un « utilisateur ».
  myChildren: {
    actions: {
      add: 'Ajouter un enfant',
      delete: 'Supprimer',
      edit: 'Modifier',
      // Le prénom est DANS le libellé : un parent de trois enfants doit voir
      // pour lequel il agit, sans avoir à se souvenir de l'ordre des cartes.
      searchClub: 'Chercher un club pour {{firstname}}',
    },
    confirmDelete: {
      cancel: 'Annuler',
      confirm: 'Supprimer',
      // §B7 du plan : l'effacement est RÉEL (le serveur supprime la ligne, il
      // n'anonymise pas). Mais une feuille de match passée garde le prénom : on
      // ne réécrit pas l'histoire d'un match, et on le dit AVANT de supprimer.
      message: 'La fiche de {{firstname}} sera effacée : son prénom, son nom'
        + ' et sa date de naissance. Une composition déjà jouée gardera son'
        + ' prénom — on ne réécrit pas la feuille d’un match passé.',
      title: 'Supprimer la fiche de {{firstname}} ?',
    },
    errors: {
      delete: 'Impossible de supprimer cette fiche pour le moment.',
    },
    // L'ECRAN 8 — ajouter ou modifier une fiche.
    form: {
      addTitle: 'Ajouter un enfant',
      editTitle: 'Modifier la fiche',
      // 🔒 Le serveur ne rend JAMAIS la date de naissance (il rend un age
      // calcule). L'ecran de modification ne peut donc pas la pre-remplir : il
      // le DIT, au lieu d'afficher trois cases vides sans explication.
      birthdateKeepHint: 'Laisse vide pour ne pas la changer.',
      birthdateLabel: 'Date de naissance',
      errors: {
        invalidDate: 'Cette date n’existe pas.',
        required: 'Le prénom, le nom et la date de naissance sont obligatoires.',
        // 🧒 Le palier 13, dit AVANT d'envoyer. Jusqu'ici l'app ne prevenait
        // jamais : le palier ne tenait que sur le refus du serveur (§4.5 du plan).
        save: 'Impossible d’enregistrer cette fiche pour le moment.',
        tooOld: 'Une fiche enfant est réservée aux moins de 13 ans.'
          + ' À partir de 13 ans, ton enfant a droit à son propre compte.',
      },
      // ⚖️ « Plus tard » plutot que « Passer cette etape » : ce n est pas une
      // etape qu on saute, c est un geste qu on remet. Un parent peut s inscrire
      // juste pour CHERCHER un club avant de decider (C8 du plan).
      firstnameLabel: 'Prénom',
      firstnamePlaceholder: 'Léa',
      later: 'Plus tard',
      laterHint: 'Tu pourras le déclarer quand tu veux, depuis ton profil.',
      // 🔒 La minimisation n'est pas un confort, c'est la loi (C10 du plan) :
      // trois champs obligatoires, trois facultatifs, et RIEN d'autre. On le
      // dit au parent, parce qu'un formulaire court sur un mineur se remarque.
      hint: 'Trois informations suffisent. On ne demande ni téléphone,'
        + ' ni adresse : c’est toi qu’on contacte.',
      lastnameLabel: 'Nom',
      lastnamePlaceholder: 'Martin',
      numberLabel: 'Numéro de maillot (facultatif)',
      positionLabel: 'Poste (facultatif)',
      positionPlaceholder: 'Gardienne, attaquant…',
      submitAdd: 'Déclarer mon enfant',
      submitEdit: 'Enregistrer',
    },
    screen: {
      // ⚠️ Pluriel i18next : « _one » / « _other », jamais « _plural » (morte depuis
      // i18next 21), et l'appelant DOIT passer « count ».
      count_one: '{{count}} enfant déclaré',
      count_other: '{{count}} enfants déclarés',
      empty: 'Tu n’as pas encore déclaré d’enfant.',
      emptyHint: 'Déclare-le ici, puis cherche-lui un club.'
        + ' Tu peux en ajouter autant que tu veux.',
      hint: 'Tu déclares tes enfants depuis TON compte :'
        + ' avant 13 ans, ils n’ont pas de compte à eux.',
      noTeam: 'Pas encore d’équipe',
      title: 'Mes enfants',
      // Les deux tranches où le parent n'agit plus (E17). Elles ne sont pas des
      // erreurs : ce sont des explications, et l'écran les donne au lieu de
      // faire disparaître un bouton sans un mot.
      tooOldHint: 'À partir de 13 ans, {{firstname}} fait ses demandes'
        + ' lui-même depuis son propre compte.',
      years_one: '{{count}} an',
      years_other: '{{count}} ans',
      // 18 ans : le lien parental s'éteint tout seul, c'est la loi.
      adultHint: '{{firstname}} est majeur : il gère son compte seul.',
    },
  },
  useAdminClubWizardExit: {
    // eslint-disable-next-line max-len
    body: 'Le tunnel de création du club sera ferme et les informations non sauvegardees seront perdues.',
    continue: 'Continuer',
    leave: 'Quitter',
    title: 'Quitter la création ?',
  },
  useAudioPlayback: {
    errors: {
      cacheNotFound: 'Cache audio introuvable',
      emptyFile: 'Fichier audio vide',
      emptySource: 'Source audio vide',
      http: 'Erreur HTTP audio ({{status}})',
      invalidContent: 'Réponse audio invalide',
      moduleUnavailable: 'Module audio indisponible',
      nativeStartFailed: 'Lecture native impossible',
      notFound404: 'Audio introuvable (404)',
      refused401: 'Audio refuse (401)',
      refused403: 'Audio refuse (403)',
      unavailable: 'Lecture audio indisponible',
      unavailableWithReason: 'Lecture audio indisponible ({{reason}})',
    },
  },
  useEventMutations: {
    nobodyWasNotifiedTryAgain: '{{raison}} Personne n a ete prevenu : reessaie dans un instant.',
    theReminderCouldnTBe: 'La relance n a pas pu partir',
    theServerDidnTRespond: 'Le serveur n a pas repondu.',
    unableToApproveThisParticipation: 'Impossible de valider cette participation pour le moment.',
    unableToChangeTheDelay: 'Impossible de modifier le retard.',
    unableToDeclineThisParticipation: 'Impossible de refuser cette participation pour le moment.',
    unableToResetTheCheck: 'Impossible de réinitialiser le pointage.',
    unableToSaveTheArrival: "Impossible d'enregistrer l'arrivée.",
    unableToSaveYourAbsence: "Impossible d'enregistrer ton absence pour le moment.",
    unableToSaveYourAnswer: "Impossible d'enregistrer ta réponse pour le moment.",
    unableToSaveYourArrival: "Impossible d'enregistrer ton arrivée.",
    unableToSaveYourDelay: "Impossible d'enregistrer ton retard.",
    unableToSaveYourParticipation: "Impossible d'enregistrer ta participation pour le moment.",
  },
  useEventShowcase: {
    variants: {
      clubRecherche: 'Club recherché',
      clubRechercheWestern: 'Club recherché — Western',
      decouverte: 'Découverte',
      ecusson: 'Écusson',
      famille: 'Famille',
      farWest: 'Far-west',
      laissezPasser: 'Laissez-passer',
      projecteurs: 'Projecteurs',
      viseur: 'Viseur',
      western: 'Western',
    },
  },
  useHomeEventAnswer: {
    error: "Impossible d'enregistrer ta réponse pour le moment.",
  },
  useMatchmakingStateMachine: {
    // eslint-disable-next-line max-len
    criteria: 'Critere prioritaire: ELO matchmaking similaire, écart max actuel {{autoEloCap}} pts.',
    status: {
      // eslint-disable-next-line max-len
      activeSoftCaps: "Statut: recherche active.\n{{criteriaLineV3}}\nRayon conserve pour le match auto; pistes opt-in possibles jusqu'a +{{extraDistanceKm}} km.\n{{zoneLineV3}}",
      // eslint-disable-next-line max-len
      candidateExpansionIn: 'Statut: adversaire potentiel repère.\n{{criteriaLineV3}}\n{{zoneLineV3}}\nSuite: elargissement ELO matchmaking dans {{delay}}.',
      // eslint-disable-next-line max-len
      candidateWidened: 'Statut: adversaire potentiel repère.\n{{criteriaLineV3}}\n{{zoneLineV3}}\nSuite: recherche ELO matchmaking elargie en cours.',
      initialising: 'Initialisation...',
      // eslint-disable-next-line max-len
      preciseSearch: 'Statut: recherche précise en cours.\n{{criteriaLineV3}}\nProchain elargissement ELO matchmaking dans {{delay}}.\n{{zoneLineV3}}',
      // eslint-disable-next-line max-len
      wideSearch: 'Statut: recherche large en cours.\n{{criteriaLineV3}}\nRayon auto conserve; les grands écarts passent en opt-in.\n{{zoneLineV3}}',
    },
    zone: {
      city: 'Zone: {{city}}.',
      cityRadius: 'Zone: {{city}} - rayon {{safeRadius}} km.',
      fallbackCity: 'ta zone',
    },
  },
  useNotifications: {
    calendarPrompt: {
      body: 'Ajouter ce match League à ton agenda pour ne pas le manquer ?',
      title: 'Match confirmé',
    },
    pushPrompt: {
      // eslint-disable-next-line max-len
      body: 'Active les notifications FoundClub pour recevoir les validations League, les rappels de composition et les actions importantes sans attendre.',
      title: 'Active les notifications FoundClub',
    },
  },
  userAddress: {
    alerts: {
      updateError: {
        message: 'Impossible de mettre à jour ton profil.',
        title: 'Erreur',
      },
    },
    loadError: {
      message: 'Impossible de charger ton profil.',
      retry: 'Réessayer',
      title: 'Chargement impossible',
    },
    loading: {
      description: 'Nous récupérons ton profil avant de renseigner ton adresse.',
      title: 'Chargement du profil',
    },
  },
  userAffiliationGuide: {
    loadError: {
      message: 'Impossible de charger ton profil.',
      retry: 'Réessayer',
      title: 'Chargement impossible',
    },
    loading: {
      description: "Nous récupérons ton profil avant de lancer l'affiliation.",
      title: 'Chargement du profil',
    },
  },
  userAvatar: {
    alerts: {
      updateError: {
        message: 'Impossible de mettre à jour ton profil.',
        network: 'Connexion impossible au serveur pour le moment. Réessaie dans quelques secondes.',
        title: 'Erreur',
      },
    },
    loadError: {
      message: 'Impossible de charger ton profil.',
      retry: 'Réessayer',
      title: 'Chargement impossible',
    },
    loading: {
      description: 'Nous récupérons ton profil avant de choisir ton avatar.',
      title: 'Chargement du profil',
    },
  },
  userBlock: {
    actions: {
      block: 'Bloquer cette personne',
      unblock: 'Débloquer cette personne',
    },
    confirm: {
      block: 'Bloquer',
      cancel: 'Annuler',
      message: '{{name}} ne pourra plus t’écrire ni ouvrir de discussion avec toi, et tu ne verras plus ses messages. Tu pourras le débloquer quand tu veux depuis ton profil.',
      messageNoName: 'Cette personne ne pourra plus t’écrire ni ouvrir de discussion avec toi, et tu ne verras plus ses messages. Tu pourras la débloquer quand tu veux depuis ton profil.',
      title: 'Bloquer cette personne ?',
    },
    errors: {
      blocked: 'Tu as bloqué cette personne. Débloque-la pour lui réécrire.',
    },
    screen: {
      empty: 'Tu n’as bloqué personne.',
      hint: 'Une personne bloquée ne peut plus t’écrire, et tu ne vois plus ses messages. Les discussions de groupe et de club ne sont pas fermées.',
      title: 'Personnes bloquées',
      unblock: 'Débloquer',
    },
  },
  userCategory: {
    alerts: {
      updateError: {
        message: 'Impossible de mettre à jour ton profil.',
        title: 'Erreur',
      },
    },
    categories: {
      senior: 'Senior',
      veteran: 'Vétéran',
    },
    loadError: {
      message: 'Impossible de charger ton profil.',
      retry: 'Réessayer',
      title: 'Chargement impossible',
    },
    loading: {
      description: 'Nous récupérons ton profil avant de choisir ta catégorie.',
      title: 'Chargement du profil',
    },
  },
  userClubSearch: {
    alerts: {
      updateError: {
        message: 'Impossible de mettre à jour ton profil.',
        title: 'Erreur',
      },
    },
    loadError: {
      message: 'Impossible de charger ton profil.',
      retry: 'Réessayer',
      title: 'Chargement impossible',
    },
    loading: {
      description: 'Nous récupérons ton profil avant de régler la visibilité.',
      title: 'Chargement du profil',
    },
  },
  userDetails: {
    actions: {
      contact: 'Contacter',
      sendMessage: 'Envoyer un message',
    },
    badges: {
      lookingForClub: 'En recherche de club',
    },
    empty: {
      club: 'Aucun club renseigné',
      coachFeedback: 'Aucun',
      coachTeams: 'Aucune équipe entraînée',
      playerTeams: 'Aucune équipe joueur',
    },
    errors: {
      minorNoParent: "Impossible de contacter ce joueur mineur car aucun compte parent n'est lie.",
    },
    feedback: {
      comment: 'Commentaire',
      dateTbc: 'Date à confirmer',
      empty: 'Aucun retour individuel du coach pour le moment.',
      matchFallback: 'Match',
      noComment: 'Pas de commentaire detaille pour ce retour.',
    },
    fields: {
      address: 'Adresse',
      age: 'Âge',
      ageValue_one: '{{count}} ans',
      ageValue_other: '{{count}} ans',
      bestLevel: 'Niveau',
      birthdate: 'Date de naissance',
      birthYear: 'Année de naissance',
      category: 'Catégorie',
      email: 'Email',
      height: 'Taille (m)',
      history: 'Historique sportif',
      phone: 'Téléphone',
      position: 'Poste',
      section: 'Section',
      sport: 'Sport',
      weight: 'Poids (kg)',
    },
    filters: {
      allSports: 'Tous',
      allTeams: 'Toutes',
      team: 'Équipe',
    },
    historySummary: {
      count: '{{count}} expérience(s)',
    },
    license: {
      available: 'Une licence officielle est disponible pour ce joueur.',
      title: 'Licence',
      unavailable: 'La licence officielle n est pas encore disponible pour ce joueur.',
      view: 'Voir la licence',
    },
    notSet: 'Non renseigné',
    private: 'Privé',
    roleLabels: {
      coach: 'Entraîneur',
      player: 'JOUEUR',
      president: 'DIRIGEANT',
      user: 'UTILISATEUR',
    },
    sectionLabels: {
      female: 'Feminin',
      male: 'Masculin',
      mixed: 'Mixte',
    },
    sections: {
      coachFeedback: 'Retours du coach',
      matchStats: 'Stats de match',
      personal: 'Infos personnelles',
      sport: 'Profil sportif',
    },
    sports: {
      basketball: 'Basket',
      football: 'Football',
    },
    stats: {
      assists: 'Passes déc.',
      assistsLong: 'Passes décisives',
      goals: 'Buts',
      loading: 'Chargement des statistiques...',
      losses: 'Défaites',
      matches: 'Matchs',
      minutes: 'Minutes',
      points: 'Points',
      privateToOwner: 'Ces statistiques ne sont visibles que par la personne elle-même.',
      teamFallback: 'Equipe',
      wins: 'Victoires',
    },
    teamGroups: {
      coach: 'Équipes entraînées',
      player: 'Équipes joueur',
    },
    title: 'Infos profil',
    titles: {
      teams: 'Équipes',
    },
    values: {
      no: 'Non',
      yes: 'Oui',
    },
  },
  userLevel: {
    alerts: {
      updateError: {
        message: 'Impossible de mettre à jour ton profil.',
        title: 'Erreur',
      },
    },
    levelsError: {
      message: 'Impossible de charger les niveaux.',
    },
    levelsLoading: {
      description: 'Nous chargeons les niveaux disponibles.',
      title: 'Chargement des niveaux',
    },
    loadError: {
      message: 'Impossible de charger ton profil.',
      retry: 'Réessayer',
      title: 'Chargement impossible',
    },
    loading: {
      description: 'Nous récupérons ton profil avant de choisir ton niveau.',
      title: 'Chargement du profil',
    },
  },
  userName: {
    alerts: {
      updateError: {
        message: 'Impossible de mettre à jour ton profil.',
        title: 'Erreur',
      },
    },
    birthdate: {
      dayPlaceholder: 'JJ',
      monthPlaceholder: 'MM',
      yearPlaceholder: 'AAAA',
    },
    loadError: {
      message: 'Impossible de charger ton profil.',
      retry: 'Réessayer',
      title: 'Chargement impossible',
    },
    loading: {
      description: 'Nous récupérons ton profil avant de modifier ton nom.',
      title: 'Chargement du profil',
    },
  },
  userParentalDeclaration: {
    actions: {
      continue: 'Continuer',
    },
    alerts: {
      saveError: {
        message: 'Impossible d enregistrer la déclaration parentale.',
        title: 'Erreur',
      },
    },
    card: {
      // eslint-disable-next-line max-len
      description: 'La personne qui utilise FoundClub pour ce profil doit être le parent ou le représentant legal de l enfant.',
    },
    // eslint-disable-next-line max-len
    intro: 'Ce profil concerne un enfant de moins de 15 ans. Pour continuer, tu dois confirmer que tu es son parent ou représentant légal.',
    loadError: {
      message: 'Impossible de charger le profil.',
      retry: 'Reessayer',
      title: 'Chargement impossible',
    },
    loading: {
      description: 'Nous recuperons le profil avant la déclaration parentale.',
      title: 'Chargement du profil',
    },
  },
  userPhysique: {
    alerts: {
      updateError: {
        message: 'Impossible de mettre à jour ton profil.',
        title: 'Erreur',
      },
    },
    fields: {
      height: {
        placeholder: 'Ex : 180',
      },
      weight: {
        placeholder: 'Ex : 75',
      },
    },
    loadError: {
      message: 'Impossible de charger ton profil.',
      retry: 'Réessayer',
      title: 'Chargement impossible',
    },
    loading: {
      description: 'Nous récupérons ton profil avant de renseigner ton physique.',
      title: 'Chargement du profil',
    },
  },
  userPosition: {
    alerts: {
      updateError: {
        message: 'Impossible de mettre à jour ton profil.',
        title: 'Erreur',
      },
    },
    loadError: {
      message: 'Impossible de charger ton profil.',
      retry: 'Réessayer',
      title: 'Chargement impossible',
    },
    loading: {
      description: 'Nous récupérons ton profil avant de choisir tes postes.',
      title: 'Chargement du profil',
    },
    subtitleWithSport: 'Postes en {{sportName}} (plusieurs choix possibles)',
  },
  userRole: {
    alerts: {
      updateError: {
        message: 'Impossible de mettre à jour ton profil.',
        title: 'Erreur',
      },
    },
    loadError: {
      message: 'Impossible de charger ton profil.',
      retry: 'Réessayer',
      title: 'Chargement impossible',
    },
    loading: {
      description: 'Nous récupérons ton profil avant de choisir ton rôle.',
      title: 'Chargement du profil',
    },
    rolesError: {
      message: 'Impossible de charger les rôles.',
    },
    rolesLoading: {
      description: 'Nous chargeons les rôles disponibles.',
      title: 'Chargement des rôles',
    },
  },
  userSection: {
    alerts: {
      updateError: {
        message: 'Impossible de mettre à jour ton profil.',
        title: 'Erreur',
      },
    },
    loadError: {
      message: 'Impossible de charger ton profil.',
      retry: 'Réessayer',
      title: 'Chargement impossible',
    },
    loading: {
      description: 'Nous récupérons ton profil avant de choisir ta section.',
      title: 'Chargement du profil',
    },
    sectionsError: {
      message: 'Impossible de charger les sections.',
    },
    sectionsLoading: {
      description: 'Nous chargeons les sections disponibles.',
      title: 'Chargement des sections',
    },
  },
  userSport: {
    alerts: {
      updateError: {
        message: 'Impossible de mettre à jour ton profil.',
        title: 'Erreur',
      },
    },
    loadError: {
      message: 'Impossible de charger ton profil.',
      retry: 'Réessayer',
      title: 'Chargement impossible',
    },
    loading: {
      description: 'Nous récupérons ton profil avant de choisir ton sport.',
      title: 'Chargement du profil',
    },
    sportsError: {
      message: 'Impossible de charger les sports.',
    },
    sportsLoading: {
      description: 'Nous chargeons la liste des sports.',
      title: 'Chargement des sports',
    },
  },
  userSportHistory: {
    loadError: {
      message: 'Impossible de charger ton profil.',
      retry: 'Réessayer',
      title: 'Chargement impossible',
    },
    loading: {
      description: "Nous récupérons ton profil avant d'afficher ton historique.",
      title: 'Chargement du profil',
    },
  },
  userTrainedTeams: {
    loadError: {
      message: 'Impossible de charger ton profil.',
      retry: 'Réessayer',
      title: 'Chargement impossible',
    },
    loading: {
      description: 'Nous récupérons ton profil avant de lister tes équipes.',
      title: 'Chargement du profil',
    },
    teamsError: {
      message: 'Impossible de charger les équipes.',
    },
    teamsLoading: {
      description: 'Nous chargeons les équipes de ton club.',
      title: 'Chargement des équipes',
    },
  },
  venueProposalModal: {
    addAVenueIfNeeded: 'Ajoute un lieu si besoin',
    addAVenueToContinue: 'Ajoute un lieu pour continuer.',
    back: 'Retour',
    beforeYouStart: 'Avant de commencer',
    checkTheDetailsBeforeSending: 'Vérifie les informations avant de les envoyer à ton adversaire.',
    checkTheProposal: 'Vérifie la proposition',
    chosenDate: 'Date choisie',
    commonSlotAlreadyFound: 'Créneau commun déjà trouve',
    confirmationBeforeSending: 'Confirmation avant envoi',
    confirmationRequired: 'Confirmation requise',
    confirmTheLeagueTermsBefore: 'Confirme le cadre League avant d envoyer la proposition.',
    confirmThese4PointsTo: 'Confirme ces 4 points pour envoyer la proposition à ton adversaire.',
    continue: 'Continuer',
    eGZ5Aix12: 'Ex: Z5 Aix, 12 rue des Sports Marseille',
    endAuto: 'Fin (auto)',
    enterASingleVenueOr: 'Renseigne un seul lieu ou une seule adresse pour cette proposition.',
    enterTheVenueNameOr: 'Renseigne le nom du lieu ou son adresse en un seul champ.',
    error: 'Erreur',
    fixedDurationMin: 'Durée fixe : {{durationMinutes}} min',
    // eslint-disable-next-line max-len
    iAcceptTheNormalRisks: 'J accepte les risques normaux liés à la pratique sportive et je vérifie mon aptitude à jouer.',
    iCertifyThatIAm: 'Je certifie avoir 18 ans ou plus pour cette action League.',
    // eslint-disable-next-line max-len
    iConfirmIAmActing: 'Je confirme agir comme membre référent de mon équipe pour cette proposition de match.',
    // eslint-disable-next-line max-len
    iConfirmThatTheVenue: 'Je confirme que le lieu, les horaires et les conditions du terrain ont été verifies.',
    // eslint-disable-next-line max-len
    iFollowTheVenueS: 'Je respecte les règles du lieu, les consignes de sécurité et la couverture d assurance applicable.',
    inShort: 'En bref',
    // eslint-disable-next-line max-len
    iUnderstandThatFoundclubHelps: 'Je comprends que FoundClub facilite la mise en relation sans organiser le match.',
    justOneDecisionHerePick: 'Une seule décision ici : choisis le jour à proposer.',
    letSJustStartBy: 'On commence juste par choisir le jour à proposer.',
    n2Days: '+2 jours',
    opponentSAnswer: 'Réponse adverse',
    pickTheDate: 'Choisis la date',
    pickTheStartTime: 'Choisis l heure de début.',
    pickTheTime: 'Choisis l heure',
    pickTheVenue: 'Choisis le lieu',
    // eslint-disable-next-line max-len
    proposeWhenAndWhereTo: 'Propose quand et ou jouer à ton adversaire. Tu choisiras la date, l heure et le lieu.',
    // eslint-disable-next-line max-len
    proposeWhenAndWhereTo2: 'Propose quand et ou jouer à ton adversaire en quelques étapes simples.',
    // eslint-disable-next-line max-len
    proposeWhenToPlayTo: 'Propose quand jouer à ton adversaire. Tu pourras aussi ajouter un lieu si besoin.',
    selectedSlot: 'Créneau retenu',
    sendAMatchProposal: 'Envoyer une proposition de match',
    sendTheProposal: 'Envoyer la proposition',
    skipAndGoToThe: 'Passer et acceder au chat',
    slotInThePast: 'Créneau passe',
    slotToFix: 'Créneau à corriger',
    start: 'Commencer',
    startField: 'Debut',
    stepOfTotal: 'Etape {{current}}/{{total}}',
    theEndIsStillCalculated: 'La fin reste calculee automatiquement ({{durationMinutes}} min).',
    // eslint-disable-next-line max-len
    thisProposalFallsInThe: 'Cette proposition tombe dans le passé. Reviens en arrière pour choisir une date ou une heure future.',
    thisSlotIsAlreadyIn: 'Ce créneau est déjà passé. Choisis une date ou une heure future.',
    time: 'Heure',
    toBeDecided: 'A définir',
    today: 'Aujourd hui',
    tomorrow: 'Demain',
    unableToConvertTheSelected: 'Impossible de convertir le créneau sélectionne.',
    venue: 'Lieu',
    venueOptional: 'Lieu (optionnel)',
    venueRequired: 'Lieu requis',
    // eslint-disable-next-line max-len
    youCanAlreadyProposeA: 'Tu peux déjà proposer un lieu, mais ce n est pas obligatoire pour ce format.',
    yourOpponentCanAcceptDecline: 'Ton adversaire pourra accepter, refuser ou contre-proposer.',
  },
  visualRender: {
    errors: {
      readFailed: 'Lecture du visuel impossible.',
    },
  },
  voiceNoteBubble: {
    playbackUnavailable: 'Lecture audio indisponible sur cette build.',
    unavailable: 'Note vocale indisponible',
  },
  voiceNoteService: {
    permission: {
      allow: 'Autoriser',
      deny: 'Refuser',
      message: 'FoundClub a besoin du micro pour enregistrer une note vocale.',
      title: 'Autoriser le microphone',
    },
  },
  webNavigationGuard: {
    // eslint-disable-next-line max-len
    message: "Cet écran n'est pas encore disponible sur le site : ouvre-le depuis l'application FoundClub.",
    title: 'Bientôt sur le site',
  },
  welcome: {
    actions: {
      go: 'Allons-y !',
    },
    descriptions: {
      club: {
        bold: '- Rejoins un club',
        // 🐞 L ESPACE DE TETE MANQUAIT, et elle seule : les trois autres
        // `regular` en portent une. A l ecran le gras et le maigre se
        // recollaient — « Rejoins un clubet progresse » (vu le 2026-09-10).
        // Chaque moitie, prise seule, etait pourtant correcte : c est pour ca
        // qu aucune relecture ne l attrape.
        regular: ' et progresse dans ta carrière sportive.',
      },
      info: {
        bold: '- Reste informé·e',
        regular: ' des nouveautés grâce aux notifications',
      },
      register: {
        bold: '- Inscris-toi',
        regular: ' à des entraînements et détections ouverts',
      },
      search: {
        bold: '- Recherche',
        regular: ' des clubs et des événements près de chez toi.',
      },
    },
    loadError: {
      message: 'Impossible de charger ton profil.',
      retry: 'Réessayer',
      title: 'Chargement impossible',
    },
    loading: {
      description: "Nous récupérons ton profil avant de finaliser l'onboarding.",
      title: 'Chargement du profil',
    },
    // 👨‍👧 LA VERSION DU PARENT. L ecran promettait a un parent d « evoluer dans
    // le sport » et de « progresser dans sa carriere sportive » : ce n est pas
    // lui qui joue. Meme defaut que celui que P0 a repare sur l accueil, reste
    // entier ici (vu sur emulateur le 2026-09-10).
    parent: {
      descriptions: {
        club: {
          bold: '- Demande à rejoindre un club',
          regular: ' en son nom, et le club te répond.',
        },
        declare: {
          bold: '- Déclare ton enfant',
          regular: ' depuis ton compte : avant 13 ans, il n’a pas de compte à lui.',
        },
        info: {
          bold: '- Reste informé·e',
          regular: ' de ses convocations grâce aux notifications.',
        },
        search: {
          bold: '- Cherche un club',
          regular: ' près de chez toi, pour la saison qui vient.',
        },
      },
      subtitle: 'Prêt·e à trouver le club de ton enfant ?',
    },
    subscription: {
      actions: {
        skip: 'Continuer',
      },
      club: {
        bullet1: 'Toutes les équipes du club incluses',
        bullet2: 'Installations et réservations',
        bullet3: 'Sponsors et canal de diffusion',
        footnote: 'Réservée aux clubs vérifiés',
        kicker: "Quand ton club s'organise",
        title: 'Pilote tout le club',
      },
      free: {
        bullet1: '1 équipe offerte',
        bullet2: '1 événement et 1 annonce offerts',
        bullet3: 'Chat illimité, pour toujours',
        kicker: "Aujourd'hui",
        title: 'Commence sans payer',
      },
      hint: 'Tu retrouveras les offres à tout moment dans Profil → Mon abonnement.',
      team: {
        bullet1: 'Événements et matchs illimités',
        bullet2: 'Convocations en 2 taps',
        bullet3: "Cotisation encaissée dans l'app",
        kicker: 'Quand ton équipe grandit',
        title: 'Débloque tes équipes',
      },
      title: 'Bienvenue dans FoundClub',
    },
    subtitle: 'Prêt·e à trouver ton club et évoluer dans le sport ?',
    title: 'Bienvenu·e sur',
    tour: {
      actions: {
        start: 'Démarrer le tour guidé',
      },
    },
  },
};
