# Plan de Développement Backend - GeoPressCI

Ce document détaille l'architecture, les fonctionnalités et les points d'API du backend de l'application GeoPressCI.

## 1. Points d'API Clés (Existant)

Liste complète des endpoints disponibles pour la communication avec le frontend.

### Authentification (`/api/v1/auth`)

- `POST /register/client`: Inscription d'un nouveau client.
- `POST /register/pressing`: Inscription d'un nouveau pressing.
- `POST /login`: Connexion d'un utilisateur.
- `GET /me`: Récupérer les informations de l'utilisateur connecté.

### Utilisateurs (`/api/v1/users`)

- `GET /me`: Récupérer le profil de l'utilisateur connecté.
- `PUT /me`: Mettre à jour le profil de l'utilisateur connecté.
- `PUT /update-password`: Mettre à jour le mot de passe de l'utilisateur connecté.
- `GET /`: (Admin) Récupérer tous les utilisateurs.
- `GET /:id`: (Admin) Récupérer un utilisateur par son ID.
- `PUT /:id`: (Admin) Mettre à jour un utilisateur.
- `DELETE /:id`: (Admin) Supprimer un utilisateur.

### Pressings (`/api/v1/pressings`)

- `GET /`: Récupérer la liste des pressings (publique).
- `GET /radius/:zipcode/:distance`: Récupérer les pressings dans un rayon donné (publique).
- `GET /:id`: Récupérer les détails d'un pressing (publique).
- `GET /:id/services`: Récupérer les services d'un pressing (publique).
- `POST /:id/services`: (Pressing/Admin) Ajouter un service à un pressing.
- `PUT /:id/services/:serviceId`: (Pressing/Admin) Mettre à jour un service d'un pressing.
- `DELETE /:id/services/:serviceId`: (Pressing/Admin) Supprimer un service d'un pressing.
- `POST /`: (Admin) Créer un nouveau pressing.
- `PUT /:id`: (Admin) Mettre à jour un pressing.
- `DELETE /:id`: (Admin) Supprimer un pressing.

### Abonnements (`/api/v1/subscriptions`)

- `POST /verify-identity`: (Pressing) Soumettre une vérification d'identité.
- `GET /status`: (Pressing) Obtenir le statut de l'abonnement.
- `PUT /billing`: (Pressing) Mettre à jour les informations de facturation.
- `POST /pay`: (Pressing) Traiter un paiement.
- `POST /cancel`: (Pressing) Annuler un abonnement.
- `PUT /admin/pressings/:id/approve-verification`: (Admin) Approuver une vérification d'identité.
- `PUT /admin/pressings/:id/reject-verification`: (Admin) Rejeter une vérification d'identité.

### Facturation (`/api/v1/billing`)

- `GET /history`: (Pressing) Obtenir l'historique des paiements.
- `PUT /payment-method`: (Pressing) Mettre à jour la méthode de paiement.
- `POST /cancel-subscription`: (Pressing) Annuler l'abonnement.

### Administration (`/api/v1/admin`)

- `POST /auth/login`: Connexion d'un administrateur.
- `GET /`: (Super Admin) Récupérer la liste des administrateurs.
- `POST /`: (Super Admin) Créer un administrateur.
- `PUT /:id`: Mettre à jour un administrateur.
- `DELETE /:id`: (Super Admin) Supprimer un administrateur.
- `GET /stats`: Obtenir les statistiques du système.
- `GET /pressings`: Obtenir la liste des pressings.
- `PUT /pressings/:id`: Mettre à jour un pressing.
- `DELETE /pressings/:id`: Supprimer un pressing.
- `GET /users`: (Admin/Super Admin) Obtenir la liste des utilisateurs.
- `PATCH /users/:id/status`: (Admin/Super Admin) Mettre à jour le statut d'un utilisateur.
- `POST /reports/generate`: (Admin/Super Admin) Générer un rapport.
- `GET /reports/:id`: (Admin/Super Admin) Obtenir un rapport.
- `GET /promotions`: (Admin/Super Admin) Obtenir la liste des promotions.
- `POST /promotions`: (Admin/Super Admin) Créer une promotion.
- `GET /promotions/:id`: (Admin/Super Admin) Obtenir une promotion par son ID.
- `PUT /promotions/:id`: (Admin/Super Admin) Mettre à jour une promotion.
- `DELETE /promotions/:id`: (Admin/Super Admin) Supprimer une promotion.
- `PATCH /promotions/:id/status`: (Admin/Super Admin) Mettre à jour le statut d'une promotion.

### Cartographie (`/api/v1/maps`)

- `GET /directions`: Obtenir un itinéraire.
- `GET /reverse-geocode`: Obtenir une adresse à partir de coordonnées.

## 2. Points d'API à Ajouter (Suggestions du Frontend)

Cette section liste les endpoints identifiés comme nécessaires depuis le plan de développement frontend pour compléter certaines fonctionnalités.

### Commandes (`/api/v1/orders`)

- `GET /`: (Client/Pressing/Admin) Récupérer la liste des commandes avec filtres (`userId`, `status`, `page`, `limit`, `search`).
- `GET /:id`: (Client/Pressing/Admin) Récupérer les détails d'une commande.
- `POST /`: (Client) Créer une nouvelle commande.
- `PATCH /:id/status`: (Pressing/Admin) Mettre à jour le statut d'une commande.

### Paiements (`/api/v1/payments`)

- `GET /`: (Client/Admin) Récupérer l'historique des transactions.
- `POST /initiate`: (Client) Initier un processus de paiement pour une commande.

### Gestion des Pressings (Admin)

- `PATCH /api/v1/admin/pressings/:id/status`: (Admin) Mettre à jour le statut d'un pressing (ex: `approved`, `rejected`, `suspended`).

### Gestion des Abonnements

- `GET /api/v1/subscriptions/plans`: (Publique) Récupérer la liste des plans d'abonnement disponibles.
- `POST /api/v1/subscriptions/subscribe`: (Pressing) Souscrire à un plan d'abonnement.
- `GET /api/v1/admin/users/:userId/subscription`: (Admin) Récupérer le statut de l'abonnement d'un utilisateur spécifique.