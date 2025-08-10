# Gestion des Abonnements et de la Facturation

Ce document décrit les fonctionnalités de gestion des abonnements et de la facturation pour l'application GeoPressCI.

## Fonctionnalités Principales

### 1. Période d'Essai
- Tous les nouveaux pressings bénéficient d'une période d'essai gratuite de 30 jours
- Pendant cette période, toutes les fonctionnalités sont accessibles
- Des notifications sont envoyées 3 jours avant la fin de la période d'essai

### 2. Abonnements Payants
- Après la période d'essai, un abonnement payant est requis (5000 XOF/mois)
- Différents forfaits disponibles : mensuel et annuel
- Paiement sécurisé via différentes méthodes de paiement

### 3. Vérification d'Identité
- Obligatoire pour souscrire à un abonnement payant
- Nécessite la soumission de documents d'identité
- Validation manuelle par l'administrateur

### 4. Facturation et Paiement
- Historique complet des paiements
- Factures téléchargeables au format PDF
- Notifications pour les paiements réussis ou échoués
- Gestion des méthodes de paiement

## API Endpoints

### Abonnements
- `GET /api/v1/subscription/status` - Statut de l'abonnement actuel
- `POST /api/v1/subscription/subscribe` - Souscrire à un abonnement
- `POST /api/v1/subscription/cancel` - Annuler un abonnement
- `POST /api/v1/subscription/change-plan` - Changer de forfait

### Facturation
- `GET /api/v1/billing/history` - Historique des paiements
- `PUT /api/v1/billing/payment-method` - Mettre à jour la méthode de paiement
- `GET /api/v1/billing/invoices/:id` - Télécharger une facture

### Vérification d'Identité
- `POST /api/v1/subscription/verify-identity` - Soumettre des documents d'identité
- `GET /api/v1/subscription/verification-status` - Statut de la vérification

## Scripts Utiles

### Initialiser les Périodes d'Essai
```bash
npm run init-trials
```

### Générer des Données de Test
```bash
npm run seed-subscriptions
```

### Démarrer le Planificateur de Tâches
```bash
npm run scheduler
```

## Tâches Planifiées

Le système exécute automatiquement les tâches suivantes :

1. **Tous les jours à minuit**
   - Renouvellement des abonnements
   - Notification des périodes d'essai bientôt terminées
   - Désactivation des comptes en retard de paiement

2. **Notifications Automatiques**
   - 3 jours avant la fin de la période d'essai
   - Confirmation de paiement
   - Échec de paiement
   - Fin de période d'essai

## Configuration Requise

Assurez-vous que les variables d'environnement suivantes sont définies :

```env
# Configuration de la base de données
MONGODB_URI=mongodb://localhost:27017/geopressci

# Configuration des paiements (exemple avec Stripe)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Configuration des emails
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user@example.com
SMTP_PASS=yourpassword

# Configuration des SMS (optionnel)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
```

## Sécurité

- Toutes les communications avec l'API doivent utiliser HTTPS
- Les données de paiement sont traitées de manière sécurisée
- Les tokens d'accès JWT sont requis pour les endpoints protégés
- Validation stricte des entrées utilisateur

## Support

Pour toute question ou problème, veuillez contacter l'équipe de support à support@geopressci.com
