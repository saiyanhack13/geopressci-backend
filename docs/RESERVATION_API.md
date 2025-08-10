# API de Réservation GeoPressCI

## Vue d'ensemble

L'API de réservation GeoPressCI permet la gestion complète des créneaux horaires et des rendez-vous pour les services de pressing. Elle comprend deux modules principaux :

- **TimeSlots** : Gestion des créneaux horaires disponibles
- **Appointments** : Gestion des rendez-vous clients

## Base URL

```
https://api.geopressci.com/api/v1
```

## Authentification

Toutes les routes protégées nécessitent un token JWT dans l'en-tête Authorization :

```
Authorization: Bearer <your-jwt-token>
```

---

## 📅 TimeSlots API

### 1. Créer un créneau horaire

**POST** `/pressings/{pressingId}/time-slots`

Crée un nouveau créneau horaire pour un pressing.

#### Paramètres de route
- `pressingId` (string, requis) : ID du pressing

#### Corps de la requête
```json
{
  "date": "2024-01-15",
  "startTime": "09:00",
  "endTime": "10:00",
  "maxCapacity": 5,
  "slotType": "regular",
  "specialPrice": 2500,
  "discount": 10,
  "availableServices": ["service_id_1", "service_id_2"],
  "recurrence": {
    "isRecurring": true,
    "frequency": "weekly",
    "endDate": "2024-03-15"
  }
}
```

#### Réponse de succès (201)
```json
{
  "success": true,
  "message": "Créneau créé avec succès",
  "data": {
    "_id": "slot_id_123",
    "pressing": "pressing_id_456",
    "date": "2024-01-15T00:00:00.000Z",
    "startTime": "09:00",
    "endTime": "10:00",
    "maxCapacity": 5,
    "currentBookings": 0,
    "status": "available",
    "slotType": "regular",
    "specialPrice": 2500,
    "discount": 10,
    "createdAt": "2024-01-10T10:30:00.000Z"
  }
}
```

### 2. Récupérer les créneaux disponibles

**GET** `/pressings/{pressingId}/available-slots`

Récupère les créneaux disponibles d'un pressing selon les critères spécifiés.

#### Paramètres de route
- `pressingId` (string, requis) : ID du pressing

#### Paramètres de requête
- `date` (string, optionnel) : Date spécifique (YYYY-MM-DD)
- `startDate` (string, optionnel) : Date de début de période
- `endDate` (string, optionnel) : Date de fin de période
- `slotType` (string, optionnel) : Type de créneau (`regular`, `express`, `premium`, `bulk`)
- `minCapacity` (integer, optionnel) : Capacité minimale requise
- `includeUnavailable` (boolean, optionnel) : Inclure les créneaux indisponibles

#### Exemple de requête
```
GET /pressings/pressing_123/available-slots?date=2024-01-15&slotType=regular&minCapacity=2
```

#### Réponse de succès (200)
```json
{
  "success": true,
  "data": {
    "slots": [
      {
        "_id": "slot_id_123",
        "date": "2024-01-15T00:00:00.000Z",
        "startTime": "09:00",
        "endTime": "10:00",
        "maxCapacity": 5,
        "currentBookings": 2,
        "availableSpots": 3,
        "status": "available",
        "slotType": "regular",
        "specialPrice": 2500,
        "discount": 10
      }
    ],
    "totalSlots": 1,
    "availableSlots": 1,
    "totalCapacity": 5,
    "availableCapacity": 3
  }
}
```

### 3. Créer des créneaux en lot

**POST** `/pressings/{pressingId}/bulk-time-slots`

Crée plusieurs créneaux selon un template pour une période donnée.

#### Corps de la requête
```json
{
  "startDate": "2024-01-15",
  "endDate": "2024-01-21",
  "timeSlots": [
    {
      "startTime": "09:00",
      "endTime": "10:00",
      "maxCapacity": 5,
      "slotType": "regular"
    },
    {
      "startTime": "14:00",
      "endTime": "15:00",
      "maxCapacity": 3,
      "slotType": "express"
    }
  ],
  "daysOfWeek": [1, 2, 3, 4, 5],
  "skipExistingSlots": true
}
```

#### Réponse de succès (201)
```json
{
  "success": true,
  "message": "Créneaux créés en lot avec succès",
  "data": {
    "created": 10,
    "skipped": 2,
    "errors": 0,
    "details": {
      "createdSlots": ["slot_id_1", "slot_id_2"],
      "skippedSlots": ["slot_id_3", "slot_id_4"]
    }
  }
}
```

---

## 📋 Appointments API

### 1. Créer un rendez-vous

**POST** `/appointments`

Crée un nouveau rendez-vous pour un client.

#### Corps de la requête
```json
{
  "pressing": "pressing_id_123",
  "timeSlot": "slot_id_456",
  "services": [
    {
      "service": "service_id_789",
      "quantity": 2
    }
  ],
  "notes": "Traitement délicat requis",
  "pickupAddress": {
    "street": "123 Rue de la Paix",
    "city": "Abidjan",
    "coordinates": {
      "latitude": 5.3364,
      "longitude": -4.0267
    }
  },
  "deliveryAddress": {
    "street": "456 Avenue de la République",
    "city": "Abidjan",
    "coordinates": {
      "latitude": 5.3400,
      "longitude": -4.0300
    }
  }
}
```

#### Réponse de succès (201)
```json
{
  "success": true,
  "message": "Rendez-vous créé avec succès",
  "data": {
    "_id": "appointment_id_123",
    "client": "client_id_456",
    "pressing": "pressing_id_789",
    "timeSlot": "slot_id_101",
    "appointmentDate": "2024-01-15T09:00:00.000Z",
    "status": "pending",
    "services": [
      {
        "service": "service_id_789",
        "quantity": 2,
        "unitPrice": 2000,
        "totalPrice": 4000
      }
    ],
    "totalAmount": 4000,
    "createdAt": "2024-01-10T10:30:00.000Z"
  }
}
```

### 2. Récupérer les rendez-vous

**GET** `/appointments`

Récupère les rendez-vous selon les critères de filtrage.

#### Paramètres de requête
- `status` (string, optionnel) : Filtrer par statut
- `pressing` (string, optionnel) : Filtrer par pressing
- `client` (string, optionnel) : Filtrer par client
- `startDate` (string, optionnel) : Date de début
- `endDate` (string, optionnel) : Date de fin
- `page` (integer, optionnel) : Numéro de page (défaut: 1)
- `limit` (integer, optionnel) : Éléments par page (défaut: 20)
- `sortBy` (string, optionnel) : Champ de tri
- `sortOrder` (string, optionnel) : Ordre de tri (`asc`, `desc`)

#### Exemple de requête
```
GET /appointments?status=confirmed&pressing=pressing_123&page=1&limit=10
```

#### Réponse de succès (200)
```json
{
  "success": true,
  "data": {
    "appointments": [
      {
        "_id": "appointment_id_123",
        "client": {
          "_id": "client_id_456",
          "firstName": "Jean",
          "lastName": "Dupont"
        },
        "pressing": {
          "_id": "pressing_id_789",
          "businessName": "Pressing Excellence"
        },
        "appointmentDate": "2024-01-15T09:00:00.000Z",
        "status": "confirmed",
        "totalAmount": 4000
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "totalItems": 25,
      "itemsPerPage": 10
    }
  }
}
```

### 3. Confirmer un rendez-vous

**PATCH** `/appointments/{appointmentId}/confirm`

Confirme un rendez-vous (réservé aux pressings et admins).

#### Paramètres de route
- `appointmentId` (string, requis) : ID du rendez-vous

#### Corps de la requête
```json
{
  "estimatedDuration": 45,
  "specialInstructions": "Traitement délicat requis",
  "internalNotes": "Client VIP - service prioritaire"
}
```

#### Réponse de succès (200)
```json
{
  "success": true,
  "message": "Rendez-vous confirmé avec succès",
  "data": {
    "_id": "appointment_id_123",
    "status": "confirmed",
    "estimatedDuration": 45,
    "specialInstructions": "Traitement délicat requis",
    "confirmedAt": "2024-01-10T11:00:00.000Z"
  }
}
```

### 4. Annuler un rendez-vous

**PATCH** `/appointments/{appointmentId}/cancel`

Annule un rendez-vous.

#### Corps de la requête
```json
{
  "reason": "Empêchement de dernière minute du client",
  "refundRequested": true
}
```

#### Réponse de succès (200)
```json
{
  "success": true,
  "message": "Rendez-vous annulé avec succès",
  "data": {
    "_id": "appointment_id_123",
    "status": "cancelled",
    "cancellation": {
      "reason": "Empêchement de dernière minute du client",
      "cancelledAt": "2024-01-10T11:30:00.000Z",
      "cancelledBy": "client_id_456",
      "refundRequested": true
    }
  }
}
```

### 5. Reporter un rendez-vous

**PATCH** `/appointments/{appointmentId}/reschedule`

Reporte un rendez-vous vers un nouveau créneau.

#### Corps de la requête
```json
{
  "newTimeSlot": "new_slot_id_789",
  "reason": "Conflit d'horaire du client"
}
```

#### Réponse de succès (200)
```json
{
  "success": true,
  "message": "Rendez-vous reporté avec succès",
  "data": {
    "_id": "appointment_id_123",
    "timeSlot": "new_slot_id_789",
    "appointmentDate": "2024-01-16T14:00:00.000Z",
    "rescheduleHistory": [
      {
        "oldTimeSlot": "old_slot_id_456",
        "newTimeSlot": "new_slot_id_789",
        "reason": "Conflit d'horaire du client",
        "rescheduledAt": "2024-01-10T12:00:00.000Z"
      }
    ]
  }
}
```

---

## 📊 Statistiques

### Statistiques des créneaux

**GET** `/pressings/{pressingId}/slot-stats`

Récupère les statistiques des créneaux d'un pressing.

#### Réponse de succès (200)
```json
{
  "success": true,
  "data": {
    "totalSlots": 150,
    "availableSlots": 45,
    "bookedSlots": 85,
    "blockedSlots": 20,
    "occupancyRate": 56.67,
    "averageBookingsPerSlot": 2.3,
    "peakHours": ["09:00-10:00", "14:00-15:00"],
    "slotTypeDistribution": {
      "regular": 60,
      "express": 30,
      "premium": 10
    }
  }
}
```

### Statistiques des rendez-vous

**GET** `/appointments/stats`

Récupère les statistiques des rendez-vous.

#### Réponse de succès (200)
```json
{
  "success": true,
  "data": {
    "totalAppointments": 1250,
    "statusDistribution": {
      "pending": 45,
      "confirmed": 120,
      "in_progress": 15,
      "completed": 1000,
      "cancelled": 60,
      "no_show": 10
    },
    "completionRate": 80.0,
    "cancellationRate": 4.8,
    "noShowRate": 0.8,
    "averageRevenue": 3500,
    "totalRevenue": 4375000,
    "appointmentsByDay": [
      { "date": "2024-01-15", "count": 25, "revenue": 87500 }
    ]
  }
}
```

---

## 🚨 Codes d'erreur

### Erreurs communes

| Code | Message | Description |
|------|---------|-------------|
| 400 | Données invalides | Les données envoyées ne respectent pas le format requis |
| 401 | Non authentifié | Token JWT manquant ou invalide |
| 403 | Accès refusé | Permissions insuffisantes pour cette action |
| 404 | Ressource non trouvée | L'élément demandé n'existe pas |
| 409 | Conflit | Conflit avec l'état actuel (ex: créneau déjà réservé) |
| 422 | Entité non traitable | Données valides mais logiquement incorrectes |
| 500 | Erreur serveur | Erreur interne du serveur |

### Erreurs spécifiques à la réservation

| Code | Message | Description |
|------|---------|-------------|
| 409 | Créneau non disponible | Le créneau est complet ou bloqué |
| 409 | Créneau déjà existant | Un créneau existe déjà pour cette période |
| 422 | Heure de fin antérieure | L'heure de fin est antérieure à l'heure de début |
| 422 | Date passée | Impossible de créer un créneau dans le passé |
| 422 | Rendez-vous non modifiable | Le rendez-vous ne peut plus être modifié |

---

## 🔔 Notifications

Le système envoie automatiquement des notifications lors des événements suivants :

### Notifications client
- Confirmation de rendez-vous
- Rappel 24h avant le rendez-vous
- Rappel 2h avant le rendez-vous
- Rappel 30min avant le rendez-vous
- Annulation ou report de rendez-vous
- Completion du service

### Notifications pressing
- Nouveau rendez-vous créé
- Annulation de rendez-vous
- Rendez-vous à confirmer
- Rendez-vous du jour

---

## 🧪 Tests

Un script de test complet est disponible pour valider le système :

```bash
node scripts/test-reservation-system.js
```

Ce script teste :
- Création de créneaux horaires
- Création de rendez-vous
- Vérification de disponibilité
- Workflow complet des rendez-vous
- Intégration avec les commandes
- Gestion des conflits

---

## 📝 Notes d'implémentation

### Gestion des créneaux récurrents
Les créneaux peuvent être créés de manière récurrente (quotidienne, hebdomadaire, mensuelle) pour faciliter la planification.

### Intégration avec les commandes
Chaque rendez-vous peut être lié à une commande pour un suivi complet du processus de service.

### Optimisation des performances
- Index MongoDB sur les champs fréquemment recherchés
- Pagination pour les listes importantes
- Cache des créneaux disponibles

### Sécurité
- Validation stricte des données d'entrée
- Contrôle d'accès basé sur les rôles
- Audit trail complet des modifications
