export default {
  addCoach: {
    actions: {
      invite: 'Inviter',
      save: 'Ajouter',
    },
    alerts: {
      alreadyExist: {
        actions: {
          addToClub: 'Ajouter au club',
          cancel: 'Annuler',
        },
        description: "Le détenteur de ce numéro de téléphone utilise l'application sous le nom de {{firstname}} {{lastname}}. Voulez-vous l'ajouter à votre club ?",
        title: 'Un utilisateur existe déjà avec ce numéro de téléphone.',
      },
      alreadyInClub: {
        description: "Un utilisateur du nom de {{firstname}} {{lastname}} est déjà membre d'un autre club.",
        title: "Impossible d'ajouter cet·te entraîneur·e à l'équipe",
      },
      success: {
        description: "L'entraîneur·e {{trainerName}} a bien été ajouté·e à votre club.",
        title: 'Ajout réussi !',
      },
    },
    fields: {
      birthdate: {
        label: 'Date de naissance',
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
        label: 'Numéro de téléphone',
        placeholder: '+33612345678',
      },
    },
    subtitles: {
      avatar: "Ajoutez une photo de profil pour que l'on puisse reconnaître l'entraîneur·e facilement.",
      birthdate: "Renseignez la date de naissance de l'entraîneur·e.",
      name: "Renseignez le nom et prénom de l'entraîneur·e.",
    },
    titles: {
      birthdate: 'Quelle est sa date de naissance ?',
      main: 'Ajouter un·e entraîneur·e',
      name: "Comment s'appelle l'entraîneur·e ?",
    },
  },
  addSponsor: {
    actions: {
      save: 'Ajouter',
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
    title: 'Ajouter un partenaire',
  },
  APIerrors: {
    // Authentication errors
    AUTHENTICATION_FAILED: "Échec d'authentification.",
    INVALID_TOKEN: "Jeton d'authentification invalide.",
    MISSING_TOKEN: "Jeton d'authentification manquant.",
    OTP_ERROR: 'Une erreur est survenue lors de la connexion OTP',

    // Authorization errors
    FORBIDDEN: 'Accès refusé.',
    UNAUTHORIZED: "Vous n'êtes pas autorisé·e à effectuer cette action.",

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
    USER_NOT_IN_CLUB: "L'utilisateur n'est pas membre du club.",

    // Membership request errors
    MEMBERSHIP_REQUEST_ALREADY_PROCESSED: "La demande d'adhésion a déjà été traitée.",
    MEMBERSHIP_REQUEST_NOT_PENDING: "La demande d'adhésion n'est pas en attente.",
    MEMBERSHIP_REQUEST_REFUSED: "La demande d'adhésion a été refusée.",

    // Sport errors
    SPORT_DELETE_ERROR: 'Erreur lors de la suppression du sport.',

    // Trainer errors
    NOT_A_TRAINER: "L'utilisateur n'est pas un·e entraîneur·e.",
    TRAINER_ALREADY_IN_CLUB: "L'entraîneur·e est déjà membre d'un club.",
    TRAINER_HAS_TEAMS: "L'entraîneur·e est associé·e à des équipes.",
    TRAINER_IS_UNIQUE_TEAM_TRAINER: "L'entraîneur·e est le/la seul·e entraîneur·e de l'équipe.",
    TRAINER_NOT_FOUND: 'Entraîneur·e introuvable.',
    TRAINER_NOT_IN_CLUB: "L'entraîneur·e n'est pas membre du club.",

    // Team errors
    CLUB_MAX_TEAM_NUMBER_REACHED: 'Le nombre maximum d\'équipes pour ce club a été atteint.',
    TEAM_CLUB_REQUIRED: 'Un club est requis pour chaque équipe.',
    TEAM_MEMBER_POLICY_ERROR: 'Pour effectuer cette action, vous devez être membre de l\'équipe.',
    TEAM_PLAYER_REMOVE_ERROR: 'Erreur lors de la suppression du/de la joueur·se de l\'équipe.',
    TEAM_TRAINER_CONNECT_REQUIRED: 'La connexion avec l\'entraîneur·e est requise.',
    TEAM_TRAINER_REMOVE_ERROR: 'Erreur lors de la suppression de l\'entraîneur·e de l\'équipe.',
    TEAM_TRAINER_REQUIRED: 'Au moins un·e entraîneur·e est requis·e pour chaque équipe.',
    TEAM_TRAINER_SET_REQUIRED: 'Une équipe d\'entraîneur·e·s est requise.',

    // Department errors
    DEPARTMENT_IMPORT_ERROR: 'Erreur lors de l\'import des données du département.',
    DEPARTMENT_REQUIRED: 'Le département est requis.',

    // Event errors
    EVENT_ALREADY_MISSING: 'Vous avez deja repondu absent a cet evenement.',
    EVENT_CANCEL_ERROR: "Erreur lors de l'annulation de l'evenement.",
    EVENT_CAPACITY_ERROR: "La capacite maximale de l'evenement est atteinte.",
    EVENT_CREATE_ERROR: "Erreur lors de la creation de l'evenement.",
    EVENT_DATE_ERROR: "La date de l'evenement est invalide.",
    EVENT_DATE_PAST: "La date ou l'heure de l'evenement est deja passee.",
    EVENT_FIND_ERROR: "Erreur lors de la recherche de l'evenement.",
    EVENT_INVALID_TIME_RANGE: "L'heure de fin doit etre apres l'heure de debut.",
    EVENT_IS_NOT_ACTIVE_ERROR: "L'evenement n'est pas actif.",
    EVENT_LOCATION_REQUIRED: 'Un lieu est requis pour creer un evenement.',
    EVENT_MISSING_ERROR: "Erreur lors de la reponse a l'evenement.",
    EVENT_PARTICIPATION_ACCEPT_ERROR: "Erreur lors de l'acceptation de la participation.",
    EVENT_PARTICIPATION_ALREADY_TREATED: 'La demande de participation a deja ete traitee.',
    EVENT_PARTICIPATION_CREATE_ERROR: 'Erreur lors de la creation de la participation.',
    EVENT_PARTICIPATION_REFUSE_ERROR: 'Erreur lors du refus de la participation.',
    EVENT_SLOT_CONFLICT: 'Un conflit de creneau a ete detecte pour ce lieu.',
    EVENT_UPDATE_ERROR: "Erreur lors de la mise a jour de l'evenement.",
    EVENT_USER_ALREADY_IN_EVENT_ERROR: "L'utilisateur est deja inscrit a cet evenement.",
    EVENT_USER_NOT_PLAYER_OF_TEAM_ERROR: "L'utilisateur n'est pas joueur de l'equipe.",

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
    CHAT_MESSAGE_NOT_FOUND_POLICY_ERROR: 'CHAT_MESSAGE_NOT_FOUND_POLICY_ERROR',
    CHAT_MESSAGE_REPORT_NOT_FOUND_POLICY_ERROR: 'CHAT_MESSAGE_REPORT_NOT_FOUND_POLICY_ERROR',
    CHAT_NOT_FOUND_POLICY_ERROR: 'CHAT_NOT_FOUND_POLICY_ERROR',
    CLUB_MANAGER_CREATE_POLICY_ERROR: 'CLUB_MANAGER_CREATE_POLICY_ERROR',
    CLUB_MANAGER_POLICY_ERROR: 'Violation de la politique concernant les dirigeant·e·s du club.',
    CLUB_MEMBER_POLICY_ERROR: 'Violation de la politique concernant les membres du club.',
    CLUB_STAFF_CREATE_POLICY_ERROR: 'Violation de la politique de création de personnel du club.',
    CLUB_STAFF_POLICY_ERROR: 'Violation de la politique concernant le personnel du club.',
    error: 'Erreur',
    EVENT_TRAINER_CREATE_POLICY_ERROR: "Violation de la politique de création d'événements par les entraîneur·e·s.",
    EVENT_TRAINER_POLICY_ERROR: 'Violation de la politique concernant les entraîneur·e·s et les événements.',
    generic: 'Une erreur est survenue. Veuillez réessayer plus tard.',
    HAD_PENDING_MEMBERSHIP_REQUEST_POLICY_ERROR: "Vous avez déjà une demande d'adhésion en attente.",
    MANAGER_TRAINER_CLUB_POLICY_ERROR: 'Violation de la politique concernant les entraîneur·e·s et dirigeant·e·s du club.',
    MANAGER_WITH_CLUB_POLICY_ERROR: 'Violation de la politique concernant les dirigeant·e·s avec club.',
    phoneNumberAlreadyUsed: 'Ce numéro est déjà utilisé par {{firstname}} {{lastname}}.',
    phoneNumberAlreadyUsedWithClub: 'Ce numéro est déjà utilisé par un·e entraîneur·e qui appartient à un club.',
    'Request failed with status code 404': 'La ressource demandée est introuvable.',
    schemaMismatch: 'Un problème est survenu lors de la récupération des informations.'
      + ' Veuillez vérifier que votre application est à jour ou réessayer plus tard.',
    TEAM_MANAGER_POLICY_ERROR: 'Violation de la politique concernant les gestionnaires d\'équipe.',
    TEAM_TRAINER_CREATE_POLICY_ERROR: 'Violation de la politique de création d\'événements par les entraîneur·e·s.',
    title: 'Erreur',
    UNIQUE_CLUB_CHAT_POLICY_ERROR: 'Violation de la politique concernant les discussions de club.',
    UNIQUE_TEAM_CHAT_POLICY_ERROR: 'Violation de la politique concernant les discussions d\'équipe.',
    UNIQUE_WHISPER_CHAT_POLICY_ERROR: 'Violation de la politique concernant les discussions privées.',
    unknown: 'Une erreur inconnue est survenue.',
    USER_NOT_FOUND_POLICY_ERROR: 'Violation de la politique concernant les utilisateurs introuvables.',
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
  clubDetails: {
    actions: {
      claimClub: "C'est mon club",
      contactTrainers: 'Contacter les entraîneur·e·s',
      delete: 'Supprimer',
      editInfo: 'Modifier',
      join: "C'est mon club !",
      manageJoinRequests: 'Voir les demandes d\'affiliation',
      requestJoin: 'Demander à rejoindre ce club',
      requestPending: 'Demande en attente',
    },
    alerts: {
      deleteSponsor: {
        actions: {
          cancel: 'Annuler',
          confirm: 'Supprimer',
        },
        description: 'Êtes-vous sûr·e de vouloir continuer ?',
        title: 'Vous êtes sur le point de supprimer le partenaire {{sponsorName}} .',
      },
      deleteTrainer: {
        actions: {
          cancel: 'Annuler',
          confirm: 'Supprimer',
        },
        description: 'Le compte ne sera pas supprimé mais l\'entraineur·e ne sera plus lié au club. Êtes-vous sûr·e de vouloir continuer ?',
        title: 'Vous êtes sur le point de supprimer cet·te entraîneur·e.',
      },
      inviteTrainer: {
        message: 'Bonjour {{coachName}} !'
          + '\nVous avez été désigné comme entraineur·e dans le club {{clubName}}.'
          + "\nTéléchargez l'application Found Club pour finaliser la création de votre compte"
          + ' et commencer à gérer vos équipes et vos évènements.',
        title: 'Bienvenue sur Found Club !',
      },
      joinClub: {
        actions: {
          ok: 'OK',
        },
        description: 'Votre dirigeant·e va recevoir votre demande et la traiter dès que possible.',
        title: "Votre demande d'adhésion a bien été envoyée",
      },
      myClub: {
        actions: {
          cancel: 'Annuler',
          confirm: 'Contacter Found Club',
        },
        description: 'Contactez nos équipes pour accéder aux fonctionnalités pour les dirigeant·e·s et entraineurs de club !',
        title: 'Vous êtes dirigeant·e de ce club ?',
      },
    },
    titles: {
      activities: 'Sports',
      coachs: 'Nos entraîneur·e·s',
      owners: 'Nos dirigeant·e·s',
      sponsors: 'Nos partenaires',
      teams: 'Nos équipes',
    },
  },
  clubEdit: {
    title: 'Modifier le club',
  },
  clubFilters: {
    actions: {
      apply: 'Appliquer les filtres',
      clear: 'Effacer les filtres',
    },
    fields: {
      activity: {
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
  clubList: {
    actions: {
      createClub: 'Ajouter mon club',
    },
    fields: {
      search: 'Rechercher',
    },
    noData: 'Aucun club ne correspond à la recherche.',
    title: 'Trouver mon club ',
  },
  clubMembershipRequestList: {
    actions: {
      accept: 'Accepter',
      reject: 'Refuser',
    },
    errors: {
      accept: 'Impossible de valider la demande pour le moment.',
      missingRequester: 'Impossible de traiter cette demande. Demandez au joueur de renvoyer sa demande.',
      reject: 'Impossible de refuser la demande pour le moment.',
    },
    fields: {
      accepted: 'Demande acceptée',
      pending: "{{firstname}} s'est signalé comme entraineur·e de cette équipe ",
      rejected: 'Demande refusée',
    },
    noData: 'Aucune demande d\'affiliation en attente',
    title: 'Demandes d\'affiliation',
  },
  common: {
    actions: {
      askLater: 'Plus tard',
      cancel: 'Annuler',
      confirm: 'Confirmer',
      continueLater: 'Continuer plus tard',
      create: 'Creer',
      delete: 'Supprimer',
      ok: 'OK',
      photoFromCamera: 'Prendre une photo',
      photoFromGallery: 'Choisir depuis la gallerie',
      save: 'Enregistrer',
    },
    back: 'Retour',
    close: 'Fermer',
    error: 'Erreur',
    finish: 'Terminer',
    ignore: 'Ignorer',
    messages: {
      noData: 'Aucune donnée disponible',
    },
    next: 'Suivant',
    previous: 'Precedent',
    skip: 'Passer',
    view: 'Voir',
  },
  conversation: {
    messagePlaceholder: 'Message',
    modals: {
      actions: {
        report: 'Signaler le message',
        seeUser: 'Voir le profil',
      },
      reportSuccess: {
        description: 'Merci de votre retour, nous allons traiter votre demande dans les plus brefs délais.',
        title: 'Votre signalement a bien été envoyé',
      },
    },
  },
  createClubRequest: {
    actions: {
      create: 'Ajouter le club',
      ok: 'OK',
    },
    alerts: {
      description: "L'équipe Found Club va examiner votre demande et vous recontacter dans les plus brefs délais.",
      title: 'Votre demande de création de club a bien été envoyée',
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
  errorPage: {
    action: 'Recharger la page',
    subtitle: 'Une erreur est survenue.',
    title: 'Oups !',
  },
  event: {
    sharedEvent: 'Événement partagé',
    shareInChat: 'Partager dans une conversation',
  },
  eventDetails: {
    actions: {
      accept: 'Accepter',
      cancelEvent: 'Annuler l\'évènement',
      cancelResponse: 'Annuler ma participation',
      edit: 'Modifier l\'évènement',
      editResponse: 'Modifier ma réponse',
      join: 'Participer',
      refuse: 'Refuser',
      remind: 'Relancer',
    },
    fields: {
      description: 'À propos',
      participationRequests: 'Demandes de participation',
      participations: 'Participants',
    },
    invitedTeams: {
      historicalPending: '{{count}} reponse(s) en attente',
      historicalTitle: 'Historique equipe retiree',
      homeTeamBadge: 'Equipe organisatrice',
      invitedTeamBadge: 'Equipe invitee',
    },
    modals: {
      accept: {
        title: 'Êtes-vous sûr·e de vouloir accepter cette demande ?',
      },
      actions: {
        cancel: 'Annuler',
        confirm: 'Confirmer',
        report: 'Signaler',
      },
      cancelEvent: {
        description: 'Une fois annulé, l\'évènement ne sera plus visible par les participant·e·s.',
        title: 'Êtes-vous sûr·e de vouloir annuler cet évènement ?',
      },
      deleteParticipation: {
        actions: {
          cancel: 'Non, retour',
          confirm: 'Oui, annuler',
        },
        description: 'Êtes-vous sûr·e de vouloir annuler votre participation à cet évènement ?',
        title: 'Annuler ma participation',
      },
      editResponse: {
        description: "En modifiant votre réponse vous indiquez votre participation à l'évènement",
        title: 'Modifier ma réponse',
      },
      refuse: {
        fields: {
          reason: {
            label: 'Raison du refus',
            placeholder: 'Il faut avoir plus de 16 ans.',
          },
        },
        title: 'Êtes-vous sûr·e de vouloir refuser cette demande ?',
      },
      remindSuccess: {
        description: 'Les joueur·se·s vont recevoir une notification pour leur rappeler de répondre à l\'évènement.',
        title: 'Votre relance a bien été envoyée',
      },
      reportEvent: {
        description: 'Merci de nous indiquer la raison pour laquelle vous signalez cet évènement.',
        fields: {
          reason: {
            label: 'Raison du signalement',
            placeholder: 'Cet évènement est inapproprié.',
          },
        },
        title: 'Signaler un évènement',
      },
      reportSuccess: {
        description: 'Merci de votre retour, nous allons traiter votre demande dans les plus brefs délais.',
        title: 'Votre signalement a bien été envoyé',
      },
    },
    participationStatus: {
      missing: 'Absent\u00b7e\u00b7s',
      notAnswered: 'Sans r\u00e9ponse',
      participating: 'Pr\u00e9sent\u00b7e\u00b7s',
    },
  },
  eventEdit: {
    actions: {
      save: 'Enregistrer',
    },
    fields: {
      capacity: {
        label: 'Nombre de participant·e·s',
        placeholder: 'Illimité',
      },
      club: {
        label: 'Club',
        placeholder: 'Sélectionner un club',
      },
      date: {
        label: "Date de l'évènement",
        placeholder: 'JJ/MM/AAAA',
      },
      description: {
        label: 'Description',
        placeholder: 'Évènement de détection ouvert à tous·tes les joueur·se·s.',
      },
      endTime: {
        label: 'Heure de fin',
        placeholder: 'HH:mm',
      },
      invitedTeams: {
        label: 'Inviter des équipes',
        myTeams: 'MES ÉQUIPES',
        otherTeams: 'AUTRES ÉQUIPES',
        placeholder: 'Sélectionner des équipes',
      },
      isRecurrent: {
        label: 'Évènement récurrent',
      },
      location: {
        label: 'Lieu',
        placeholder: '2 rue du stade, 69000 Lyon',
      },
      pricePerPerson: {
        label: 'Prix par personne (€)',
        placeholder: 'Ex: 10',
      },
      recurrenceDay: {
        label: 'Jour de la récurrence',
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
        label: 'Statut de la session',
        options: {
          closed: 'Fermé',
          open: 'Ouvert',
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
        label: "Horaire de l'évènement",
        placeholder: 'JJ/MM/AAAA',
      },
      totalPlayers: {
        label: 'Nombre total de joueurs',
        placeholder: 'Ex: 10',
      },
      type: {
        label: 'Type d\'évènement',
        placeholder: 'Sélectionner un type d\'évènement',
      },
      validationMode: {
        label: 'Mode de validation',
        options: {
          auto: 'Automatique',
          manual: 'Manuelle',
        },
      },
    },
    title: 'Créer un évènement',
    titleEdit: 'Modifier l\'évènement',
  },

  eventFilters: {
    actions: {
      apply: 'Appliquer les filtres',
      clear: 'Effacer les filtres',
    },
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
        label: 'Type d\'évènement',
        placeholder: 'Sélectionner un type d\'évènement',
      },
    },
    infos: {
      activity: 'Le sport pratiqué par l\'équipe (football, basketball, handball, etc.).\n\nFiltrer par sport vous permet de ne voir que les événements correspondant à votre discipline.',
      category: 'La catégorie d\'âge de l\'équipe (U7, U9, U11, U13, Senior, etc.).\n\nVous pouvez sélectionner plusieurs catégories pour voir tous les événements correspondants.',
      level: 'Le niveau de jeu de l\'équipe (Départemental, Régional, National, etc.).\n\nCe filtre vous aide à trouver des événements adaptés à votre niveau de pratique.',
      type: 'Le type d\'événement (Entraînement, Match, Détection, Tournoi, etc.).\n\nSélectionnez plusieurs types pour voir différentes activités.',
    },
  },
  eventList: {
    actions: {
      about: 'À propos',
      absent: 'Absent·e',
      add: 'Ajouter un évènement',
      findEvent: 'Trouver un évènement',
      join: 'Participer',
      present: 'Présent·e',
    },
    info: {
      alreadyJoined: 'Je participe !',
      alreadyMissing: 'Je serai absent·e',
      pendingRequest: 'Participation en attente',
    },
    joinModal: {
      actions: {
        cancel: 'Annuler',
        confirm: 'Confirmer ma participation',
      },
      checkboxes: {
        conditions: "J'accepte les conditions pour participer à l'évènement",
        responsibility: 'Je déclare avoir pris connaissance de la "Déclaration de responsabilité et acceptation des risques"',
      },
      description: 'Je soussigné(e), participant majeur ou, le cas échéant, représentant légal du participant mineur, reconnais et accepte ce qui suit :'
        + '\n\nRôle de Found Club : '
        + '\n    - Found Club est une plateforme de mise en relation et n’organise pas l’événement. Found Club ne fournit aucune assurance liée à la participation.'
        + '\n\nTrajets aller/retour :'
        + '\n    - Sauf transport expressément organisé par l’organisateur, le trajet vers et depuis l’événement est sous ma responsabilité (ou celle du représentant légal pour un mineur), y compris assurance et choix du mode de transport.'
        + '\n\nAssurance :'
        + '\n    - J’atteste disposer (ou, pour un mineur, que l’enfant dispose) d’une couverture d’assurance appropriée (ex. licence fédérale en cours et/ou responsabilité civile). J’ai compris que Found Club n’assure ni les dommages corporels ni matériels.'
        + '\n\nAptitude médicale :'
        + '\nJ’atteste être apte à la pratique au jour de l’événement (ou que l’enfant est apte, conformément aux exigences fédérales : certificat/questionnaire le cas échéant) et je m’engage à ne pas participer / ne pas autoriser la participation en cas de doute sur l’état de santé.'
        + '\n\nLimites de responsabilité (droit FR) :'
        + '\nDans la mesure permise par la loi, je m’engage à ne pas rechercher la responsabilité de Found Club du fait de la participation ; cette clause ne s’applique pas en cas de faute lourde ou intentionnelle ou de manquement grave aux obligations de sécurité imputable à Found Club ou à l’organisateur.'
        + '\n\nRèglement & sécurité :'
        + '\nJe m’engage (ou j’engage le mineur) à respecter le règlement, les consignes de sécurité et les instructions des encadrants ; l’organisateur peut refuser ou interrompre la participation en cas de non-respect.'
        + '\n\nUrgence médicale :'
        + '\nJ’autorise l’organisateur à prévenir les secours en cas d’urgence ; pour un mineur, j’autorise l’organisateur à accompagner l’enfant si nécessaire et je m’engage à rester joignable.',
      title: 'DÉCLARATION DE RESPONSABILITÉ ET ACCEPTATION DES RISQUES',
      validation: 'En cochant les cases et en validant mon inscription, je confirme avoir lu, compris et accepté la présente déclaration et j’accepte de participer à l’événement dans ces conditions.',
    },
    noData: 'Aucun évènement trouvé.',
    title: 'Mes évènements',
  },
  eventWizard: {
    common: {
      stepCounter: 'Etape {{current}}/{{total}}',
    },
    errors: {
      datePast: "La date ou l'heure de debut doit etre dans le futur.",
      genericCreate: "Erreur de creation d'evenement.",
      invalidTimeRange: "L'heure de fin doit etre apres l'heure de debut.",
      invitesFetch: 'Impossible de charger les equipes a inviter.',
      locationRequired: 'Un lieu est requis.',
      noOtherTeams: 'Aucune autre equipe disponible a inviter.',
      noTeams: 'Aucune equipe organisatrice disponible.',
      noTypes: "Aucun type d'evenement disponible.",
      recurrenceDatesRequired: 'Les dates de recurrence sont obligatoires.',
      recurrenceDaysRequired: 'Selectionne au moins un jour de recurrence.',
      recurrenceInvalidRange: 'La date de fin de recurrence doit etre apres la date de debut.',
      slotConflict: 'Conflit de creneau detecte pour le lieu selectionne.',
    },
    partial: {
      actions: {
        keep: 'Conserver les creations',
        retry: 'Reessayer les echecs',
        rollback: 'Annuler les creations',
      },
      noCreated: "Aucun evenement n'a ete cree.",
      rollbackPartial: "{{count}} annulation(s) n'ont pas pu etre finalisees.",
      rollbackSuccess: 'Les evenements crees ont ete annules.',
      summary: '{{success}} succes / {{failed}} echec(s).',
      title: 'Creation partielle detectee',
    },
    recap: {
      actions: {
        create: 'Creer les evenements',
        createShort: 'Creer',
        edit: 'Modifier',
      },
      capacity: 'Participants max: {{value}}',
      completedCount: '{{done}}/5 infos cles completees',
      dateLabel: 'Date',
      incomplete: 'A completer',
      invitedTeamsTitle: 'Equipes invitees',
      invitesCount: '{{count}} equipe(s) invitee(s)',
      noDescription: 'Aucune description',
      notSet: 'Non renseigne',
      organizationTitle: 'Organisation',
      participationTitle: 'Participation',
      pricePerPerson: 'Prix par personne: {{value}}',
      quickOverviewTitle: 'Vue d ensemble',
      ready: 'Pret a creer',
      recurrenceCount: '{{count}} occurrence(s) prevue(s)',
      reservationMode: 'Mode de reservation: {{value}}',
      sections: {
        description: 'Description',
        location: 'Lieu',
        logistics: 'Logistique',
        participants: 'Participants',
        reservation: 'Reservation',
        team: 'Equipe',
        type: 'Type',
        validation: 'Validation',
        visibility: 'Visibilite',
      },
      timeLabel: 'Horaire',
      totalPlayers: 'Joueurs attendus: {{value}}',
      totalPlayersTitle: 'Joueurs attendus',
      validationMode: 'Validation: {{value}}',
      whenWhereTitle: 'Quand et lieu',
    },
    steps: {
      description: {
        label: 'Description',
        placeholder: 'Ajoute des details utiles pour les participants.',
        subtitle: 'Ajoute un contexte clair pour cet evenement.',
        title: 'Description',
      },
      invites: {
        myTeams: 'MES EQUIPES',
        otherTeams: 'AUTRES EQUIPES',
        subtitle: 'Invite des equipes, ou passe cette etape.',
        title: 'Invitations',
      },
      location: {
        addInstallation: 'Ajouter une installation',
        addressMissing: 'Adresse non renseignee',
        helper: 'Selectionne un lieu du club ou saisis une adresse externe.',
        installationHelper: 'Choisis une installation existante de ton club.',
        noInstallations: 'Aucune installation disponible pour ce club.',
        subtitle: 'Le lieu est obligatoire pour continuer.',
        title: 'Lieu',
      },
      logistics: {
        isRecurrent: 'Evenement recurrent',
        recurrenceDays: 'Jours de recurrence',
        recurrenceInterval: 'Intervalle de recurrence',
        recurrenceTitle: 'Configuration recurrence',
        reservationMode: 'Mode de reservation',
        reservationTitle: 'Parametres reservation',
        subtitle: "Configure date, horaires et regles d'acces.",
        title: 'Logistique',
      },
      participants: {
        fixed: 'Capacite fixe',
        hint: 'Tu pourras encore modifier ces valeurs avant la creation finale.',
        modeHintFixed: 'Mode capacite fixe: nombre de places limite.',
        modeHintUnlimited: 'Mode illimite: aucun plafond de participants.',
        modeLabel: 'Mode de capacite',
        playersUnit: 'joueurs max',
        previewCapacity: 'Capacite: {{value}}',
        previewMode: 'Mode: {{value}}',
        previewTitle: 'Apercu',
        previewTotalPlayers: 'Joueurs attendus: {{value}}',
        quickPresets: 'Valeurs rapides',
        subtitle: 'Choisis une capacite max, ou laisse l evenement en acces illimite.',
        summaryTitle: 'Resume',
        title: 'Participants',
        totalPlayersExceedsCapacity: 'Le nombre de joueurs attendus ne peut pas depasser la capacite max.',
        unlimited: 'Illimite',
        unlimitedHint: 'Aucune limite de places',
        unlimitedLabel: 'Illimite',
      },
      recap: {
        subtitle: 'Verifie les informations avant creation.',
        title: 'Recapitulatif',
      },
      team: {
        subtitle: "Selectionne l'equipe organisatrice.",
        title: 'Equipe organisatrice',
      },
      type: {
        subtitle: "Selectionne le type d'evenement.",
        title: "Type d'evenement",
      },
      validation: {
        autoDesc: 'Les participants peuvent confirmer automatiquement leur presence.',
        autoRuleOne: 'Check-in simplifie pour les joueurs',
        autoRuleTwo: 'Ideal pour les sessions ouvertes',
        manualDesc: 'Le coach valide manuellement les participants.',
        manualRuleOne: 'Controle total par le staff',
        manualRuleTwo: 'Recommande pour groupes fermes',
        optionLabel: 'Mode {{title}}',
        previewTitle: 'Mode selectionne',
        recommended: 'Recommande',
        selectedHint: 'Mode actuellement selectionne.',
        selectHint: 'Selectionne ce mode de validation.',
        subtitle: "Definis comment valider les presences a l'evenement.",
        title: 'Mode de validation',
      },
      visibility: {
        private: 'Prive',
        privateDesc: 'Visible uniquement pour les membres concernes.',
        public: 'Public',
        publicDesc: 'Visible pour tous les profils qui y ont acces.',
        subtitle: "Definis qui peut voir l'evenement.",
        title: 'Visibilite',
      },
    },
  },
  home: {
    fields: {
      type: {
        label: 'Trouver',
        options: {
          club: 'un club',
          event: 'un évènement',
          reservation: 'une réservation',
          team: 'une équipe',
        },
      },
    },
  },
  homeHub: {
    account: {
      logoutDescription: 'Voulez-vous vous deconnecter de votre compte ?',
      logoutTitle: 'Deconnexion',
    },
    alerts: {
      featuredFallback: {
        description: 'Aucun club omnisport detecte. Redirection vers les demandes du club.',
        title: 'Information',
      },
      missingContext: {
        description: 'Aucun club disponible pour gerer les demandes a la une.',
        title: 'Contexte manquant',
      },
      noClub: {
        description: 'Votre compte doit etre rattache a un club pour gerer ces demandes.',
        title: 'Club introuvable',
      },
      noTrainedTeams: {
        description: 'Vous devez etre entraineur d au moins une equipe pour gerer les demandes d adhesion.',
        title: 'Aucune equipe disponible',
      },
    },
    cards: {
      account: {
        logout: {
          subtitle: 'Fermer votre session sur cet appareil.',
          title: 'Deconnexion',
        },
        switch: {
          subtitle: 'Basculer vers un autre compte connecte.',
          title: 'Changer de compte',
        },
        tutorial: {
          subtitle: 'Relancer un tutoriel ou reinitialiser les guides.',
          title: 'Tutoriels et aide',
        },
      },
      league: {
        subtitle: 'Acceder a FoundClub League et a ses fonctionnalites competitives.',
        title: 'FoundClub League',
      },
      manage: {
        addEvent: {
          subtitle: 'Cr\u00e9e rapidement un entra\u00eenement, match ou s\u00e9ance d essai.',
          title: 'Ajouter un \u00e9v\u00e9nement',
        },
        clubRequests: {
          subtitle: 'Valider ou refuser les demandes d adh\u00e9sion au club.',
          title: 'Demandes adh\u00e9sion club',
        },
        featuredRequests: {
          subtitle: 'Traite les demandes d \u00e9v\u00e9nements \u00e0 la une du club.',
          title: 'Demandes \u00e9v\u00e9nements \u00e0 la une',
        },
        manageClub: {
          subtitle: 'Acc\u00e9dez \u00e0 votre espace club pour piloter votre organisation.',
          title: 'G\u00e9rer mon club',
        },
        requests: {
          subtitle: 'Traitez toutes les demandes de votre organisation depuis un seul ecran.',
          title: 'Demandes',
        },
        teamRequests: {
          subtitle: 'Traite les demandes d adh\u00e9sion des joueurs \u00e0 vos \u00e9quipes.',
          title: 'Demandes adh\u00e9sion \u00e9quipes',
        },
      },
      profile: {
        alerts: {
          subtitle: 'Creer des alertes pour recevoir des notifications personnalisees selon vos recherches.',
          title: 'G\u00e9rer mes alertes',
        },
        edit: {
          subtitle: 'Mettre a jour vos informations personnelles et sportives.',
          title: 'Modifier mon profil',
        },
        history: {
          subtitle: 'Ajouter ou ajuster votre historique sportif.',
          title: 'Historique sportif',
        },
        view: {
          subtitle: 'Consulter les informations de votre compte.',
          title: 'Voir mon profil',
        },
      },
      quick: {
        chat: {
          subtitle: 'Ouvrir rapidement votre messagerie.',
          title: 'Messagerie',
        },
        planning: {
          subtitle: 'Retrouver vos evenements a venir et votre planning personnel.',
          title: 'Mon planning',
        },
        teams: {
          subtitle: 'Acceder a vos equipes et a leurs informations.',
          title: 'Mes equipes',
        },
      },
      search: {
        ads: {
          subtitle: 'Postuler aux annonces de recherche des equipes.',
          title: 'Annonces',
        },
        clubs: {
          subtitle: 'Trouver votre page club pour voir toutes ses informations.',
          title: 'Club',
        },
        events: {
          subtitle: 'Trouve des d\u00e9tections, s\u00e9ances d essai, entra\u00eenements et matchs.',
          title: '\u00c9v\u00e9nement',
        },
        reservations: {
          subtitle: 'R\u00e9serve rapidement un terrain (foot \u00e0 5, padel, etc.).',
          title: 'Reservations',
        },
      },
    },
    roles: {
      coach: 'Entraineur',
      player: 'Joueur',
      president: 'Dirigeant',
    },
    sections: {
      account: 'Compte',
      league: 'FoundClub League',
      manageClub: 'G\u00e9rer mon club',
      manageTeams: 'G\u00e9rer mes \u00e9quipes',
      profile: 'Mon profil',
      quickNav: 'Navigation rapide',
      search: 'Rechercher',
    },
    title: 'Accueil',
  },
  homeHubTutorial: {
    actions: {
      scrollDown: 'Descendre',
    },
    center: {
      actions: {
        pickFeature: 'Choisir un tutoriel de fonctionnalite',
        relaunchHome: 'Relancer le tutoriel Accueil',
        resetAll: 'Reinitialiser tous les tutoriels',
      },
      subtitle: 'Relancez un tutoriel ou reinitialisez tous les guides.',
      title: 'Tutoriels et aide',
    },
    entry: {
      actions: {
        skip: 'Passer',
        start: 'Lancer le tutoriel complet',
      },
      description: 'Vous pouvez lancer le tutoriel complet pour tout comprendre, ou explorer l application par vous meme.',
      subtitle: 'FoundClub est un outil concu pour vous accompagner dans toute votre aventure sportive, peu importe votre sport.',
      title: 'Bienvenue sur FoundClub',
    },
    featurePicker: {
      subtitle: 'Selectionnez une fonctionnalite a decouvrir.',
      title: 'Choisir un tutoriel',
    },
    reset: {
      confirm: 'Reinitialiser',
      description: 'Tous les tutoriels seront remis a zero pour ce compte.',
      title: 'Reinitialiser les tutoriels',
    },
    steps: {
      accountLogout: {
        description: 'Deconnectez-vous proprement de l appareil actuel.',
        title: 'Deconnexion',
      },
      accountSwitch: {
        description: 'Ouvrez la modal pour changer ou ajouter un compte.',
        title: 'Changer de compte',
      },
      header: {
        description: 'Cette page vous donne un acces rapide a toutes les fonctionnalites principales.',
        title: 'Accueil FoundClub',
      },
      league: {
        description: 'Basculez vers FoundClub League pour les fonctionnalites competitives.',
        title: 'FoundClub League',
      },
      manageAddEvent: {
        description: 'Creez un entrainement, match ou detection pour vos equipes.',
        title: 'Ajouter un evenement',
      },
      manageClub: {
        description: 'Accedez a votre espace club pour piloter votre organisation.',
        title: 'Gerer mon club',
      },
      manageClubRequests: {
        description: 'Traitez les demandes d adhesion recues par votre club.',
        title: 'Demandes adhesion club',
      },
      manageFeaturedRequests: {
        description: 'Validez les demandes d evenements a la une de votre organisation.',
        title: 'Demandes evenements a la une',
      },
      manageRequests: {
        description: 'Regroupez et traitez toutes les demandes depuis un seul onglet.',
        title: 'Demandes',
      },
      manageTeamRequests: {
        description: 'Validez ou refusez les demandes pour rejoindre vos equipes.',
        title: 'Demandes adhesion equipes',
      },
      profileAlerts: {
        description: 'Configurez des alertes personnalisees selon vos recherches.',
        title: 'Gerer mes alertes',
      },
      profileEdit: {
        description: 'Modifiez vos informations personnelles et sportives.',
        title: 'Modifier mon profil',
      },
      profileHistory: {
        description: 'Ajoutez vos experiences via le wizard historique.',
        title: 'Historique sportif',
      },
      profileView: {
        description: 'Consultez votre page profil complete.',
        title: 'Voir mon profil',
      },
      quickChat: {
        description: 'Ouvrez votre messagerie et suivez vos conversations.',
        title: 'Messagerie',
      },
      quickPlanning: {
        description: 'Accedez rapidement a votre planning personnel.',
        title: 'Mon planning',
      },
      quickTeams: {
        description: 'Retrouvez toutes vos equipes et leurs pages.',
        title: 'Mes equipes',
      },
      searchAds: {
        description: 'Consultez les annonces de recrutement et les profils disponibles.',
        title: 'Rechercher des annonces',
      },
      searchClubs: {
        description: 'Explorez les clubs et ouvrez leur fiche detaillee.',
        title: 'Rechercher un club',
      },
      searchEvents: {
        description: 'Trouvez des evenements sportifs en utilisant les filtres de recherche.',
        title: 'Rechercher un evenement',
      },
      searchReservations: {
        description: 'Accedez aux reservations et filtrez selon votre activite.',
        title: 'Rechercher une reservation',
      },
      tutorialCenter: {
        description: 'Relancez un tutoriel quand vous voulez, ou remettez tout a zero.',
        title: 'Tutoriels et aide',
      },
    },
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
  menu: {
    chat: 'Messagerie',
    home: 'Accueil',
    myClub: 'Mon club',
    myTeams: 'Mes équipes',
    planning: 'Mon planning',
    requests: 'Demandes',
    search: 'Rechercher',
  },
  messaging: {
    noData: 'Aucune conversation trouvée.',
    title: 'Messages privés',
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
    deleteSectionConfirm: 'Êtes-vous sûr de vouloir supprimer la section "{{name}}" ?\nCette action est irréversible et supprimera toutes les équipes et membres associés.',
    deleteSectionTitle: 'Supprimer la section',
    sectionCreated: 'La section a été créée avec succès.',
    sectionDeleted: 'La section a été supprimée avec succès.',
  },
  myEventList: {
    actions: {
      closeTimeFilter: 'Valider',
    },
    fields: {
      timeFilter: {
        next: 'Mes prochains évènements',
        past: 'Mes évènements passés',
        selectDate: 'Sélectionner une date',
      },
      type: {
        all: 'Tous',
      },
    },
  },
  myTeamList: {

    title: 'Mes équipes',
  },
  onboardingAffiliation: {
    a11y: {
      backHint: 'Revient a l etape precedente de l onboarding.',
      cardHintClub: 'Ouvre la fiche du club pour confirmer l affiliation.',
      cardHintTeam: 'Ouvre la fiche de l equipe pour demander a rejoindre.',
      cardLabelClub: 'Ouvrir la fiche du club {{name}}',
      cardLabelTeam: 'Ouvrir la fiche de l equipe {{name}}',
      continueLaterHint: 'Passe cette etape et continue l onboarding.',
      filterHint: 'Ouvre les filtres de recherche de club.',
      filterLabel: 'Ouvrir les filtres',
      modalCancelHint: 'Ferme la fenetre de demande.',
      modalCommentHint: 'Ajoute des informations utiles a la recherche.',
      modalNameHintClub: 'Renseigne le nom du club que tu recherches.',
      modalNameHintTeam: 'Renseigne le nom de l equipe que tu recherches.',
      modalSendHint: 'Envoie ta demande aux superadmins.',
      notFoundHintClub: 'Envoie une demande d aide si ton club est introuvable.',
      notFoundHintTeam: 'Envoie une demande d aide si ton equipe est introuvable.',
      retryHint: 'Relance la recherche de resultats.',
      searchInputHintClub: 'Saisis le nom du club pour filtrer la liste.',
      searchInputHintTeam: 'Saisis le nom de l equipe pour filtrer la liste.',
      searchInputLabelClub: 'Champ nom du club',
      searchInputLabelTeam: 'Champ nom de l equipe',
      tooltipNextHint: 'Passe a l etape suivante du tutoriel.',
      tooltipPreviousHint: 'Revient a l etape precedente du tutoriel.',
      tooltipSkipHint: 'Quitte le tutoriel guide.',
    },
    actions: {
      continueLater: 'Continuer plus tard',
      notFoundClub: 'Je ne trouve pas mon club',
      notFoundTeam: 'Je ne trouve pas mon equipe',
    },
    common: {
      roleTargetClub: 'club',
      roleTargetTeam: 'equipe',
    },
    feedback: {
      missingInfoMessageClub: 'Renseigne le nom du club recherche.',
      missingInfoMessageTeam: 'Renseigne le nom de l equipe recherchee.',
      missingInfoTitle: 'Information manquante',
      requestError: 'Impossible d envoyer votre demande.',
      requestSentDescription: 'Votre demande a ete envoyee aux superadmins. Vous recevrez une notification.',
      requestSentTitle: 'Demande envoyee',
    },
    filtersTutorial: {
      activityDescription: 'Selectionne un sport pour filtrer uniquement les clubs correspondants.',
      activityTitle: 'Sport',
      applyDescription: 'Applique tes filtres pour revenir a la liste avec des resultats plus precis.',
      applyTitle: 'Appliquer',
      cityDescription: 'Choisis une ville ou une adresse pour centrer la recherche des clubs.',
      cityTitle: 'Localisation',
      radiusDescription: 'Ajuste le rayon en kilometres autour de ta localisation.',
      radiusTitle: 'Rayon de recherche',
    },
    modal: {
      commentLabel: 'Commentaire (optionnel)',
      commentPlaceholder: 'Ex: ville, categorie, orthographe probable...',
      description: 'Donnez un maximum de contexte pour aider les superadmins.',
      nameLabelClub: 'Nom du club recherche *',
      nameLabelTeam: 'Nom de l equipe recherchee *',
      namePlaceholderClub: 'Ex: Olympique ...',
      namePlaceholderTeam: 'Ex: U17 Nationaux ...',
      send: 'Envoyer',
      titleClub: 'Je ne trouve pas mon club',
      titleTeam: 'Je ne trouve pas mon equipe',
    },
    results: {
      openClubFallback: 'Voir fiche club',
      openTeamFallback: 'Voir fiche equipe',
    },
    search: {
      filtersActive_one: '{{count}} filtre actif',
      filtersActive_other: '{{count}} filtres actifs',
      placeholderClub: 'Nom du club',
      placeholderTeam: 'Nom de l equipe',
    },
    states: {
      emptyWithoutQueryClub: 'Aucun club a afficher pour le moment.',
      emptyWithoutQueryTeam: 'Aucune equipe a afficher pour le moment.',
      emptyWithQueryClub: 'Aucun club trouve pour "{{query}}".',
      emptyWithQueryTeam: 'Aucune equipe trouvee pour "{{query}}".',
      errorSubtitle: 'Verifie ta connexion puis reessaie.',
      errorTitle: 'Impossible de charger les resultats',
      loading: 'Recherche en cours...',
      retry: 'Reessayer',
    },
    subtitleClub: 'Recherche ton club puis ouvre sa fiche pour valider C est mon club.',
    subtitleTeam: 'Recherche ton equipe puis ouvre sa fiche pour envoyer ta demande.',
    titleClub: 'Trouve ton club',
    titleTeam: 'Trouve ton equipe',
    tutorial: {
      stepFiltersDescription: 'On va maintenant ouvrir les filtres pour affiner ta recherche.',
      stepFiltersTitle: 'Ouvrir les filtres',
      stepNotFoundDescriptionClub: 'Si tu ne trouves pas ton club, envoie une demande guidee aux superadmins.',
      stepNotFoundDescriptionTeam: 'Si tu ne trouves pas ton equipe, envoie une demande guidee aux superadmins.',
      stepNotFoundTitleClub: 'Je ne trouve pas mon club',
      stepNotFoundTitleTeam: 'Je ne trouve pas mon equipe',
      stepResultDescriptionClub: 'Ouvre la fiche du club pour utiliser le bouton C est mon club.',
      stepResultDescriptionTeam: 'Ouvre la fiche equipe pour envoyer ta demande de rejoindre.',
      stepResultTitleClub: 'Selectionner un club',
      stepResultTitleTeam: 'Selectionner une equipe',
      stepSearchDescription: 'Tape le nom du {{roleTargetLabel}} pour filtrer la liste.',
      stepSearchTitle: 'Recherche',
    },
  },
  otp: {
    actions: {
      confirm: 'Confirmer',
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
  permissions: {
    camera: {
      denied: 'Permission caméra refusée',
      message: 'L\'application a besoin d\'accéder à votre caméra pour prendre une photo.',
      title: 'Permission Caméra',
    },
  },
  profile: {
    actions: {
      confirmDeleteAvatar: 'Êtes-vous sûr de vouloir supprimer cette image ?',
      deleteAccount: 'Supprimer mon compte',
      edit: 'Modifier mon profil',
      findClub: 'Trouver mon club',
      findTeam: 'Trouver une équipe',
      ignore: 'Ignorer',
      logout: 'D\u00e9connexion',
      manageAlerts: 'G\u00e9rer mes alertes',
      manageClub: 'G\u00e9rer mon club',
      manageClubJoinRequests: 'Gérer les demandes d\'affiliation au club',
      manageEvents: 'Gérer mes évènements',
      manageRequests: 'Gerer mes demandes',
      manageTeamJoinRequests: 'Gérer les demandes d\'adhésion aux équipes',
      manageTeams: 'Gérer mes équipes',
      myTeams: 'Mes équipes',
      save: 'Continuer',
    },
    alerts: {
      deleteAlert: {
        actions: {
          cancel: 'Annuler',
          confirm: 'Supprimer',
        },
        subtitle: 'Pour demander la suppression de votre compte merci de remplir le formulaire de contact'
          + ' suivant en précisant votre demande.',
        title: 'Supprimer votre compte ?',
      },
    },
    fields: {
      birthdate: {
        label: 'Date de naissance',
        placeholder: 'JJ/MM/AAAA',
      },
      firstname: {
        label: 'Prénom',
        placeholder: 'Luc',
      },
      height: {
        label: 'Taille (m)',
        placeholder: '1,80',
      },
      lastname: {
        label: 'Nom',
        placeholder: 'Harne',
      },
      phoneNumber: {
        label: 'Numéro de téléphone',
        placeholder: '+33612345678',
      },
      position: {
        label: 'Poste',
        placeholder: 'Ailier',
      },
      section: {
        label: 'Section',
        placeholder: 'Sélectionner une section',
      },
      sections: {
        female: 'Féminine',
        male: 'Masculine',
      },
      types: {
        coach: 'Entraîneur·e',
        player: 'Joueur·se',
        president: 'Dirigeant·e',
      },
      weight: {
        label: 'Poids (kg)',
        placeholder: '80',
      },
    },
    subtitles: {
      avatar: "Ajoute une photo de profil pour que l'on puisse te reconnaître facilement.",
      birthdate: 'Renseigne ta date de naissance.',
      name: 'Renseigne ton nom et prénom.',
      section: 'Renseigne la catégorie de sexe dans laquelle tu évolues',
      type: 'Renseignez votre fonction principale.',
    },
    titles: {
      avatar: 'Une photo de profil ?',
      birthdate: 'Quelle est ta date de naissance ?',
      edit: 'Modifier mes informations',
      name: "Comment t'appelles-tu ?",
      profile: 'Mon compte',
      section: 'Dans quelle section évolues-tu ?',
      type: 'Quel est votre statut ?',
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
  requestsHub: {
    actionError: 'Impossible de traiter la demande.',
    assignNow: 'Assigner maintenant',
    clubAssignedMessage: '{{name}} a ete ajoute au club. Voulez-vous l assigner a une equipe maintenant ?',
    clubAssignedTitle: 'Entraineur ajoute',
    empty: 'Aucune demande en attente',
    filters: {
      all: 'Toutes',
      club: 'Club',
      event: 'Evenement',
      featured: 'A la une',
      team: 'Equipe',
    },
    forbidden: 'Cet onglet est reserve aux coachs et dirigeants.',
    migratedBannerAction: "Ouvrir l'onglet Demandes",
    migratedBannerTitle: 'Ce flux est migre vers Demandes.',
    partialError: 'Source indisponible',
    rejectEventMessage: 'L evenement sera annule.',
    rejectEventTitle: 'Refuser la demande ?',
    rejectFeaturedMessage: 'Le demandeur sera notifie du refus.',
    rejectFeaturedTitle: 'Refuser la demande ?',
    title: 'Demandes',
    types: {
      club: 'Club',
      event: 'Evenement',
      featured: 'A la une',
      team: 'Equipe',
      unknown: 'Demande',
    },
  },
  reservation: {
    actions: {
      cancelRequest: 'Annuler la demande',
      participate: 'Réserver',
      requestFeatured: 'Demander la mise à la une',
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
    mode: {
      fullGroup: 'J\'ai déjà mon groupe complet',
      invalidPlayerCount: 'Veuillez entrer un nombre valide',
      playerCount: 'Combien de joueurs avez-vous ?',
      recruiting: 'Il me manque des joueurs',
      selectMode: 'Veuillez sélectionner un mode',
      title: 'Comment voulez-vous participer ?',
      tooManyPlayers: 'Le nombre doit être inférieur au total',
    },
    noData: 'Aucune réservation trouvée.',
    title: 'Évènements :',
  },
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
  searchTypeSwitcher: {
    recruitment: 'Recrutement',
  },
  teamDetails: {
    actions: {
      contactTeam: 'Contacter',
      edit: 'Modifier',
      join: "C'est mon équipe !",
      leave: "Quitter l'équipe",
      stats: 'Statistiques',
    },
    alerts: {
      deleteTrainer: {
        actions: {
          cancel: 'Annuler',
          confirm: 'Supprimer du club',
        },
        description: 'Le compte ne sera pas supprimé mais l\'entraineur·e ne sera plus lié au club ni à aucune de ces équipes.'
          + ' Si vous souhaitez le retirer seulement de cette équipe merci de passer par le bouton de modification de l\'équipe.',
        title: 'Vous êtes sur le point de supprimer cet·te entraîneur·e de votre club.',
      },
      invitePlayers: {
        alreadyHaveTheApp: "J'ai déjà l'application",
        downloadOnAndroid: 'Télécharger sur Android',
        downloadOnIOS: 'Télécharger sur iOS',
        message: 'Bonjour !'
          + '\nVotre équipe {{teamName}} de votre club {{clubName}} vous attend !'
          + "\nTéléchargez l'application Found Club pour finaliser la création de votre compte"
          + ' et commencer accéder et participer aux évènements de votre équipe.',
        title: 'Vos coéquipiers vous attendent !',
      },
      joinRequest: {
        actions: {
          ok: 'OK',
        },
        description: 'Votre entraîneur·e va recevoir votre demande et la traiter dès que possible.',
        title: 'Votre demande d\'adhésion a bien été envoyée',
      },
      leave: {
        actions: {
          cancel: 'Annuler',
          confirm: "Quitter l'équipe",
        },
        description: 'Vous êtes sur le point de quitter l\'équipe. Une fois cette action validée vous ne pourrez plus participer aux entrainements et matchs.',
        title: 'Êtes-vous sûr·e de vouloir quitter cette équipe ?',
      },
    },
    myTitle: 'Mon équipe',
    sections: {
      nextEvents: 'Prochains évènements',
      players_one: 'Joueur·se',
      players_other: 'Joueur·se·s',
      trainers_one: 'Entraîneur·e',
      trainers_other: 'Entraîneur·e·s',
    },
    stats: {
      summaryHint: 'Consulte les statistiques detaillees de ton equipe.',
    },
    tabs: {
      calendar: 'Calendrier',
      infos: 'Infos',
      standings: 'Classement',
      stats: 'Statistiques',
    },
    title: 'Équipe',
  },
  teamEdit: {
    actions: {
      save: 'Enregistrer',
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
        label: 'Entraîneur·e·s',
        placeholder: 'Sélectionner un·e entraîneur·e',
      },
    },
    title: 'Créer une équipe',
    titleEdit: "Modifier l'équipe",
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
      section: {
        label: 'Section',
        placeholder: 'Sélectionner une section',
      },
    },
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
        description: 'Vous avez atteint le nombre maximum d\'équipes autorisées dans votre club. Veuillez contacter Found Club pour débloquer cette limite.',
        title: 'Limite d\'équipes atteinte',
      },
    },
    fields: {
      category: 'Catégorie',
      level: 'Niveau',
      section: 'Section',
    },
    noData: 'Aucune équipe trouvée.',
    searchPlaceholder: 'Rechercher dans mes équipes...',
    title: 'Équipes de mon club',
  },
  teamMembershipRequestList: {
    actions: {
      accept: 'Accepter',
      reject: 'Refuser',
    },
    fields: {
      accepted: 'Demande acceptée',
      pending: "{{firstname}} s'est signalé comme joueur·se de l'équipe",
      rejected: 'Demande refusée',
    },
    noData: 'Aucune demande d\'adhésion en attente',
    title: 'Demandes d\'adhésion',
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
      club: 'Aucun club renseigne',
      coachTeams: 'Aucune equipe entrainee',
      playerTeams: 'Aucune equipe joueur',
    },
    fields: {
      address: 'Adresse',
      age: 'Age',
      bestLevel: 'Niveau',
      birthdate: 'Date de naissance',
      birthYear: 'Annee de naissance',
      category: 'Categorie',
      email: 'Email',
      height: 'Taille (m)',
      history: 'Historique sportif',
      phone: 'Telephone',
      position: 'Poste',
      section: 'Section',
      sport: 'Sport',
      weight: 'Poids (kg)',
    },
    notSet: 'Non renseigne',
    private: 'Prive',
    sections: {
      personal: 'Infos personnelles',
      sport: 'Profil sportif',
    },
    teamGroups: {
      coach: 'Equipes entrainees',
      player: 'Equipes joueur',
    },
    title: 'Infos profil',
    titles: {
      teams: 'Equipes',
    },
  },
  welcome: {
    actions: {
      go: 'Allons-y !',
    },
    descriptions: {
      club: {
        bold: '🔥 Rejoins un club',
        regular: 'et progresse dans ta carrière sportive.',
      },
      info: {
        bold: '📢 Reste informé·e',
        regular: ' des nouveautés grâce aux notifications',
      },
      register: {
        bold: '📅 Inscris-toi',
        regular: ' à des entrainements et détections ouverts',
      },
      search: {
        bold: '🔎 Recherche',
        regular: ' des clubs et des évènements près de chez toi.',
      },
    },
    subtitle: 'Prêt·e à trouver ton club et évoluer dans le sport ?',
    title: 'Bienvenu·e sur',
  },
};
