/**
 * Tests d'intégration pour les fonctionnalités pressing
 * Validation end-to-end des API critiques
 */

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const Pressing = require('../../src/models/pressing.model');
const Service = require('../../src/models/service.model');
const Order = require('../../src/models/order.model');
const Client = require('../../src/models/client.model');

describe('Integration Tests - Pressing Management', () => {
  let pressingToken;
  let clientToken;
  let pressingId;
  let clientId;
  let serviceId;
  let orderId;

  beforeAll(async () => {
    // Connexion à la base de données de test
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/geopressci_test');
    }
  });

  afterAll(async () => {
    // Nettoyage et fermeture
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Nettoyer les collections avant chaque test
    await Promise.all([
      Pressing.deleteMany({}),
      Service.deleteMany({}),
      Order.deleteMany({}),
      Client.deleteMany({})
    ]);
  });

  describe('1. Inscription et Authentification Pressing', () => {
    test('Doit permettre l\'inscription d\'un pressing', async () => {
      const pressingData = {
        prenom: 'Jean',
        nom: 'Dupont',
        email: 'pressing.test@example.com',
        telephone: '+2250700000001',
        password: 'TestPass123',
        nomCommerce: 'Pressing Test Excellence',
        adresse: 'Cocody, Abidjan, Côte d\'Ivoire',
        coordinates: { lat: 5.365, lng: -4.001 },
        services: [
          {
            nom: 'Nettoyage à sec',
            description: 'Service de nettoyage professionnel',
            prix: 2500,
            categorie: 'nettoyage'
          }
        ]
      };

      const response = await request(app)
        .post('/api/v1/auth/register/pressing')
        .send(pressingData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe(pressingData.email);
      expect(response.body.data.nomCommerce).toBe(pressingData.nomCommerce);
      expect(response.body.token).toBeDefined();

      pressingToken = response.body.token;
      pressingId = response.body.data.id;
    });

    test('Doit permettre la connexion du pressing', async () => {
      // D'abord créer un pressing
      const pressingData = {
        prenom: 'Marie',
        nom: 'Martin',
        email: 'pressing.login@example.com',
        telephone: '+2250700000002',
        password: 'LoginTest123',
        nomCommerce: 'Pressing Login Test',
        adresse: 'Yopougon, Abidjan, Côte d\'Ivoire',
        coordinates: { lat: 5.34, lng: -4.10 }
      };

      await request(app)
        .post('/api/v1/auth/register/pressing')
        .send(pressingData)
        .expect(201);

      // Puis se connecter
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: pressingData.email,
          password: pressingData.password
        })
        .expect(200);

      expect(loginResponse.body.success).toBe(true);
      expect(loginResponse.body.token).toBeDefined();
      expect(loginResponse.body.user.role).toBe('pressing');
    });
  });

  describe('2. Gestion des Services', () => {
    beforeEach(async () => {
      // Créer un pressing pour les tests
      const pressingData = {
        prenom: 'Service',
        nom: 'Tester',
        email: 'service.test@example.com',
        telephone: '+2250700000003',
        password: 'ServiceTest123',
        nomCommerce: 'Pressing Service Test',
        adresse: 'Plateau, Abidjan, Côte d\'Ivoire',
        coordinates: { lat: 5.32, lng: -4.03 }
      };

      const response = await request(app)
        .post('/api/v1/auth/register/pressing')
        .send(pressingData)
        .expect(201);

      pressingToken = response.body.token;
      pressingId = response.body.data.id;
    });

    test('Doit permettre la création d\'un service', async () => {
      const serviceData = {
        nom: 'Lavage Express',
        description: 'Service de lavage rapide et efficace',
        prix: 1500,
        categorie: 'lavage',
        dureeMoyenne: 2,
        disponible: true
      };

      const response = await request(app)
        .post('/api/v1/pressing/services')
        .set('Authorization', `Bearer ${pressingToken}`)
        .send(serviceData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.nom).toBe(serviceData.nom);
      expect(response.body.data.prix).toBe(serviceData.prix);
      expect(response.body.data.pressing).toBe(pressingId);

      serviceId = response.body.data._id;
    });

    test('Doit permettre la récupération des services du pressing', async () => {
      // Créer quelques services
      const services = [
        {
          nom: 'Repassage',
          description: 'Service de repassage professionnel',
          prix: 1000,
          categorie: 'repassage'
        },
        {
          nom: 'Nettoyage à sec',
          description: 'Nettoyage à sec pour vêtements délicats',
          prix: 3000,
          categorie: 'nettoyage'
        }
      ];

      for (const service of services) {
        await request(app)
          .post('/api/v1/pressing/services')
          .set('Authorization', `Bearer ${pressingToken}`)
          .send(service)
          .expect(201);
      }

      const response = await request(app)
        .get('/api/v1/pressing/services')
        .set('Authorization', `Bearer ${pressingToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].nom).toBeDefined();
      expect(response.body.data[0].prix).toBeDefined();
    });

    test('Doit permettre la mise à jour d\'un service', async () => {
      // Créer un service
      const serviceData = {
        nom: 'Service à modifier',
        description: 'Description originale',
        prix: 2000,
        categorie: 'nettoyage'
      };

      const createResponse = await request(app)
        .post('/api/v1/pressing/services')
        .set('Authorization', `Bearer ${pressingToken}`)
        .send(serviceData)
        .expect(201);

      const serviceId = createResponse.body.data._id;

      // Modifier le service
      const updateData = {
        nom: 'Service modifié',
        description: 'Description mise à jour',
        prix: 2500
      };

      const updateResponse = await request(app)
        .put(`/api/v1/pressing/services/${serviceId}`)
        .set('Authorization', `Bearer ${pressingToken}`)
        .send(updateData)
        .expect(200);

      expect(updateResponse.body.success).toBe(true);
      expect(updateResponse.body.data.nom).toBe(updateData.nom);
      expect(updateResponse.body.data.prix).toBe(updateData.prix);
    });
  });

  describe('3. Dashboard et Statistiques', () => {
    beforeEach(async () => {
      // Créer un pressing avec des données de test
      const pressingData = {
        prenom: 'Stats',
        nom: 'Tester',
        email: 'stats.test@example.com',
        telephone: '+2250700000004',
        password: 'StatsTest123',
        nomCommerce: 'Pressing Stats Test',
        adresse: 'Marcory, Abidjan, Côte d\'Ivoire',
        coordinates: { lat: 5.295, lng: -3.995 }
      };

      const response = await request(app)
        .post('/api/v1/auth/register/pressing')
        .send(pressingData)
        .expect(201);

      pressingToken = response.body.token;
      pressingId = response.body.data.id;

      // Créer un client pour les commandes
      const clientData = {
        prenom: 'Client',
        nom: 'Test',
        email: 'client.stats@example.com',
        telephone: '+2250700000005',
        password: 'ClientTest123',
        adresse: 'Adjamé, Abidjan, Côte d\'Ivoire'
      };

      const clientResponse = await request(app)
        .post('/api/v1/auth/register/client')
        .send(clientData)
        .expect(201);

      clientToken = clientResponse.body.token;
      clientId = clientResponse.body.data.id;
    });

    test('Doit récupérer les statistiques du pressing', async () => {
      const response = await request(app)
        .get('/api/v1/pressing/stats')
        .set('Authorization', `Bearer ${pressingToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('todayOrders');
      expect(response.body.data).toHaveProperty('monthlyRevenue');
      expect(response.body.data).toHaveProperty('activeCustomers');
      expect(response.body.data).toHaveProperty('avgRating');
      expect(response.body.data).toHaveProperty('pendingOrders');
      expect(response.body.data).toHaveProperty('completedToday');
      expect(response.body.data).toHaveProperty('weeklyGrowth');
      expect(response.body.data).toHaveProperty('monthlyGrowth');
      expect(response.body.data).toHaveProperty('_performance');
      expect(response.body.data._performance.optimized).toBe(true);
    });

    test('Doit récupérer le profil du pressing', async () => {
      const response = await request(app)
        .get('/api/v1/pressing/profile')
        .set('Authorization', `Bearer ${pressingToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.nomCommerce).toBe('Pressing Stats Test');
      expect(response.body.data.email).toBe('stats.test@example.com');
    });
  });

  describe('4. Gestion des Commandes Temps Réel', () => {
    beforeEach(async () => {
      // Setup pressing et client
      const pressingData = {
        prenom: 'Order',
        nom: 'Tester',
        email: 'order.test@example.com',
        telephone: '+2250700000006',
        password: 'OrderTest123',
        nomCommerce: 'Pressing Order Test',
        adresse: 'Treichville, Abidjan, Côte d\'Ivoire',
        coordinates: { lat: 5.295, lng: -4.025 }
      };

      const pressingResponse = await request(app)
        .post('/api/v1/auth/register/pressing')
        .send(pressingData)
        .expect(201);

      pressingToken = pressingResponse.body.token;
      pressingId = pressingResponse.body.data.id;

      const clientData = {
        prenom: 'Order',
        nom: 'Client',
        email: 'order.client@example.com',
        telephone: '+2250700000007',
        password: 'OrderClient123',
        adresse: 'Cocody, Abidjan, Côte d\'Ivoire'
      };

      const clientResponse = await request(app)
        .post('/api/v1/auth/register/client')
        .send(clientData)
        .expect(201);

      clientToken = clientResponse.body.token;
      clientId = clientResponse.body.data.id;

      // Créer un service
      const serviceData = {
        nom: 'Service Test Commande',
        description: 'Service pour test de commande',
        prix: 2000,
        categorie: 'nettoyage'
      };

      const serviceResponse = await request(app)
        .post('/api/v1/pressing/services')
        .set('Authorization', `Bearer ${pressingToken}`)
        .send(serviceData)
        .expect(201);

      serviceId = serviceResponse.body.data._id;
    });

    test('Doit permettre la création d\'une commande', async () => {
      const orderData = {
        pressingId: pressingId,
        services: [
          {
            serviceId: serviceId,
            quantite: 2,
            instructions: 'Traitement délicat'
          }
        ],
        adresseLivraison: 'Cocody, Abidjan, Côte d\'Ivoire',
        dateCollecteSouhaitee: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        dateLivraisonSouhaitee: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
      };

      const response = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${clientToken}`)
        .send(orderData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.customer).toBe(clientId);
      expect(response.body.data.pressing).toBe(pressingId);
      expect(response.body.data.statut).toBe('en_attente');

      orderId = response.body.data._id;
    });

    test('Doit permettre la récupération des commandes du pressing', async () => {
      // Créer une commande d'abord
      const orderData = {
        pressingId: pressingId,
        services: [
          {
            serviceId: serviceId,
            quantite: 1
          }
        ],
        adresseLivraison: 'Test Address'
      };

      await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${clientToken}`)
        .send(orderData)
        .expect(201);

      // Récupérer les commandes
      const response = await request(app)
        .get('/api/v1/pressing/orders')
        .set('Authorization', `Bearer ${pressingToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].pressing).toBe(pressingId);
    });

    test('Doit permettre la mise à jour du statut d\'une commande', async () => {
      // Créer une commande
      const orderData = {
        pressingId: pressingId,
        services: [
          {
            serviceId: serviceId,
            quantite: 1
          }
        ],
        adresseLivraison: 'Test Address'
      };

      const orderResponse = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${clientToken}`)
        .send(orderData)
        .expect(201);

      const orderId = orderResponse.body.data._id;

      // Mettre à jour le statut
      const statusUpdate = {
        statut: 'confirmee',
        commentaire: 'Commande confirmée par le pressing'
      };

      const updateResponse = await request(app)
        .put(`/api/v1/orders/${orderId}/statut`)
        .set('Authorization', `Bearer ${pressingToken}`)
        .send(statusUpdate)
        .expect(200);

      expect(updateResponse.body.success).toBe(true);
      expect(updateResponse.body.data.statut).toBe('confirmee');
    });
  });

  describe('5. Tests de Performance', () => {
    test('Les statistiques doivent être rapides (< 500ms)', async () => {
      // Créer un pressing
      const pressingData = {
        prenom: 'Perf',
        nom: 'Test',
        email: 'perf.test@example.com',
        telephone: '+2250700000008',
        password: 'PerfTest123',
        nomCommerce: 'Pressing Perf Test',
        adresse: 'Abidjan, Côte d\'Ivoire',
        coordinates: { lat: 5.3, lng: -4.0 }
      };

      const response = await request(app)
        .post('/api/v1/auth/register/pressing')
        .send(pressingData)
        .expect(201);

      const token = response.body.token;

      // Mesurer le temps de réponse des statistiques
      const startTime = Date.now();
      
      await request(app)
        .get('/api/v1/pressing/stats')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      const responseTime = Date.now() - startTime;
      
      expect(responseTime).toBeLessThan(500); // Moins de 500ms
    });

    test('La récupération des services doit être rapide (< 300ms)', async () => {
      // Créer un pressing avec plusieurs services
      const pressingData = {
        prenom: 'Service',
        nom: 'Perf',
        email: 'service.perf@example.com',
        telephone: '+2250700000009',
        password: 'ServicePerf123',
        nomCommerce: 'Pressing Service Perf',
        adresse: 'Abidjan, Côte d\'Ivoire',
        coordinates: { lat: 5.3, lng: -4.0 }
      };

      const response = await request(app)
        .post('/api/v1/auth/register/pressing')
        .send(pressingData)
        .expect(201);

      const token = response.body.token;

      // Créer plusieurs services
      const services = Array.from({ length: 10 }, (_, i) => ({
        nom: `Service ${i + 1}`,
        description: `Description du service ${i + 1}`,
        prix: 1000 + i * 100,
        categorie: 'nettoyage'
      }));

      for (const service of services) {
        await request(app)
          .post('/api/v1/pressing/services')
          .set('Authorization', `Bearer ${token}`)
          .send(service)
          .expect(201);
      }

      // Mesurer le temps de récupération
      const startTime = Date.now();
      
      await request(app)
        .get('/api/v1/pressing/services')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      const responseTime = Date.now() - startTime;
      
      expect(responseTime).toBeLessThan(300); // Moins de 300ms
    });
  });

  describe('6. Tests de Gestion d\'Erreur', () => {
    test('Doit retourner 401 pour un token invalide', async () => {
      const response = await request(app)
        .get('/api/v1/pressing/stats')
        .set('Authorization', 'Bearer invalid_token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Token');
    });

    test('Doit retourner 403 pour un accès non autorisé', async () => {
      // Créer un client
      const clientData = {
        prenom: 'Unauthorized',
        nom: 'Client',
        email: 'unauthorized@example.com',
        telephone: '+2250700000010',
        password: 'UnauthorizedTest123',
        adresse: 'Abidjan, Côte d\'Ivoire'
      };

      const response = await request(app)
        .post('/api/v1/auth/register/client')
        .send(clientData)
        .expect(201);

      const clientToken = response.body.token;

      // Essayer d'accéder aux stats pressing avec un token client
      await request(app)
        .get('/api/v1/pressing/stats')
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(403);
    });

    test('Doit valider les données d\'entrée', async () => {
      // Créer un pressing
      const pressingData = {
        prenom: 'Validation',
        nom: 'Test',
        email: 'validation.test@example.com',
        telephone: '+2250700000011',
        password: 'ValidationTest123',
        nomCommerce: 'Pressing Validation Test',
        adresse: 'Abidjan, Côte d\'Ivoire',
        coordinates: { lat: 5.3, lng: -4.0 }
      };

      const response = await request(app)
        .post('/api/v1/auth/register/pressing')
        .send(pressingData)
        .expect(201);

      const token = response.body.token;

      // Essayer de créer un service avec des données invalides
      const invalidServiceData = {
        // nom manquant
        description: 'Service sans nom',
        prix: -100, // prix négatif
        categorie: 'invalid_category'
      };

      await request(app)
        .post('/api/v1/pressing/services')
        .set('Authorization', `Bearer ${token}`)
        .send(invalidServiceData)
        .expect(400);
    });
  });
});

module.exports = {
  // Exporter les utilitaires de test si nécessaire
};
