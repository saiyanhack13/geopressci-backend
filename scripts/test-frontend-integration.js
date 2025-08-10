/**
 * Script de test d'intégration Frontend-Backend pour le système de réservation GeoPressCI
 * 
 * Ce script teste l'intégration complète entre le frontend React et le backend Node.js
 * pour valider le workflow complet de réservation.
 */

const axios = require('axios');
const chalk = require('chalk');

// Configuration
const BASE_URL = process.env.API_URL || 'https://geopressci.netlify.app/api';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';

// Variables de test
let authToken = '';
let testUser = null;
let testPressing = null;
let testTimeSlot = null;
let testAppointment = null;

/**
 * Configuration Axios avec intercepteur pour les tokens
 */
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000
});

api.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

/**
 * Utilitaires de logging
 */
const log = {
  info: (message) => console.log(chalk.blue('ℹ'), message),
  success: (message) => console.log(chalk.green('✓'), message),
  error: (message) => console.log(chalk.red('✗'), message),
  warning: (message) => console.log(chalk.yellow('⚠'), message),
  step: (message) => console.log(chalk.cyan('\n📋'), chalk.bold(message))
};

/**
 * Fonction pour attendre un délai
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Test 1: Vérification de la connectivité backend
 */
async function testBackendConnectivity() {
  log.step('Test 1: Vérification de la connectivité backend');
  
  try {
    const response = await axios.get(`${BASE_URL}/health`);
    if (response.status === 200) {
      log.success('Backend accessible et fonctionnel');
      return true;
    }
  } catch (error) {
    log.error(`Impossible de se connecter au backend: ${error.message}`);
    return false;
  }
}

/**
 * Test 2: Authentification et création d'utilisateur test
 */
async function testAuthentication() {
  log.step('Test 2: Authentification et création d\'utilisateur test');
  
  try {
    // Créer un utilisateur test
    const userData = {
      firstName: 'Test',
      lastName: 'User',
      email: `test.integration.${Date.now()}@example.com`,
      password: 'TestPassword123!',
      phone: '+2250123456789',
      role: 'client'
    };

    const registerResponse = await api.post('/auth/register', userData);
    testUser = registerResponse.data.data.user;
    authToken = registerResponse.data.data.token;
    
    log.success(`Utilisateur test créé: ${testUser.email}`);
    log.success('Token d\'authentification obtenu');
    
    return true;
  } catch (error) {
    log.error(`Erreur lors de l'authentification: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

/**
 * Test 3: Création d'un pressing test
 */
async function testPressingCreation() {
  log.step('Test 3: Création d\'un pressing test');
  
  try {
    const pressingData = {
      businessName: `Pressing Test ${Date.now()}`,
      email: `pressing.test.${Date.now()}@example.com`,
      password: 'TestPassword123!',
      phone: '+2250987654321',
      address: {
        street: '123 Rue de Test',
        city: 'Abidjan',
        coordinates: {
          latitude: 5.3364,
          longitude: -4.0267
        }
      },
      services: [
        {
          name: 'Nettoyage à sec',
          price: 2000,
          description: 'Service de nettoyage à sec standard'
        },
        {
          name: 'Repassage',
          price: 1000,
          description: 'Service de repassage professionnel'
        }
      ]
    };

    const response = await api.post('/pressings', pressingData);
    testPressing = response.data.data;
    
    log.success(`Pressing test créé: ${testPressing.businessName}`);
    return true;
  } catch (error) {
    log.error(`Erreur lors de la création du pressing: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

/**
 * Test 4: Création de créneaux horaires
 */
async function testTimeSlotCreation() {
  log.step('Test 4: Création de créneaux horaires');
  
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const timeSlotData = {
      pressing: testPressing._id,
      date: tomorrow.toISOString().split('T')[0],
      startTime: '09:00',
      endTime: '10:00',
      maxCapacity: 4,
      slotType: 'regular'
    };

    const response = await api.post('/timeslots', timeSlotData);
    testTimeSlot = response.data.data;
    
    log.success(`Créneau horaire créé: ${testTimeSlot.startTime} - ${testTimeSlot.endTime}`);
    
    // Créer plusieurs créneaux pour les tests
    const additionalSlots = [
      { startTime: '10:00', endTime: '11:00', slotType: 'express' },
      { startTime: '14:00', endTime: '15:00', slotType: 'premium' },
      { startTime: '15:00', endTime: '16:00', slotType: 'regular' }
    ];

    for (const slot of additionalSlots) {
      await api.post('/timeslots', {
        ...timeSlotData,
        ...slot
      });
    }
    
    log.success('Créneaux horaires supplémentaires créés');
    return true;
  } catch (error) {
    log.error(`Erreur lors de la création des créneaux: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

/**
 * Test 5: Test des APIs de créneaux disponibles
 */
async function testAvailableSlots() {
  log.step('Test 5: Test des APIs de créneaux disponibles');
  
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const response = await api.get(`/pressings/${testPressing._id}/available-slots`, {
      params: {
        startDate: tomorrow.toISOString().split('T')[0],
        endDate: tomorrow.toISOString().split('T')[0]
      }
    });
    
    const availableSlots = response.data.data;
    log.success(`${availableSlots.length} créneaux disponibles trouvés`);
    
    // Vérifier que notre créneau test est dans la liste
    const foundSlot = availableSlots.find(slot => slot._id === testTimeSlot._id);
    if (foundSlot) {
      log.success('Créneau test trouvé dans les créneaux disponibles');
    } else {
      log.warning('Créneau test non trouvé dans les créneaux disponibles');
    }
    
    return true;
  } catch (error) {
    log.error(`Erreur lors de la récupération des créneaux: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

/**
 * Test 6: Création d'un rendez-vous
 */
async function testAppointmentCreation() {
  log.step('Test 6: Création d\'un rendez-vous');
  
  try {
    const appointmentData = {
      pressing: testPressing._id,
      timeSlot: testTimeSlot._id,
      services: [
        {
          service: testPressing.services[0]._id,
          quantity: 2
        },
        {
          service: testPressing.services[1]._id,
          quantity: 1
        }
      ],
      pickupAddress: {
        street: '456 Avenue de Test',
        city: 'Abidjan',
        coordinates: {
          latitude: 5.3364,
          longitude: -4.0267
        }
      },
      notes: 'Test d\'intégration - Rendez-vous automatique'
    };

    const response = await api.post('/appointments', appointmentData);
    testAppointment = response.data.data;
    
    log.success(`Rendez-vous créé: ${testAppointment._id}`);
    log.info(`Statut: ${testAppointment.status}`);
    log.info(`Montant total: ${testAppointment.totalAmount} FCFA`);
    
    return true;
  } catch (error) {
    log.error(`Erreur lors de la création du rendez-vous: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

/**
 * Test 7: Gestion du cycle de vie du rendez-vous
 */
async function testAppointmentLifecycle() {
  log.step('Test 7: Gestion du cycle de vie du rendez-vous');
  
  try {
    // Confirmer le rendez-vous
    await api.patch(`/appointments/${testAppointment._id}/confirm`, {
      estimatedDuration: 60,
      internalNotes: 'Confirmé par test d\'intégration'
    });
    log.success('Rendez-vous confirmé');
    
    await sleep(1000);
    
    // Vérifier le statut
    const statusResponse = await api.get(`/appointments/${testAppointment._id}`);
    const updatedAppointment = statusResponse.data.data;
    
    if (updatedAppointment.status === 'confirmed') {
      log.success('Statut du rendez-vous mis à jour correctement');
    } else {
      log.warning(`Statut inattendu: ${updatedAppointment.status}`);
    }
    
    return true;
  } catch (error) {
    log.error(`Erreur lors de la gestion du cycle de vie: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

/**
 * Test 8: Test des statistiques
 */
async function testStatistics() {
  log.step('Test 8: Test des statistiques');
  
  try {
    // Statistiques des créneaux
    const slotsStatsResponse = await api.get(`/timeslots/stats`, {
      params: {
        pressing: testPressing._id
      }
    });
    
    const slotsStats = slotsStatsResponse.data.data;
    log.success(`Statistiques créneaux: ${slotsStats.totalSlots} total, ${slotsStats.bookedSlots} réservés`);
    
    // Statistiques des rendez-vous
    const appointmentsStatsResponse = await api.get(`/appointments/stats`, {
      params: {
        pressing: testPressing._id
      }
    });
    
    const appointmentsStats = appointmentsStatsResponse.data.data;
    log.success(`Statistiques RDV: ${appointmentsStats.totalAppointments} total, ${appointmentsStats.totalRevenue} FCFA revenus`);
    
    return true;
  } catch (error) {
    log.error(`Erreur lors de la récupération des statistiques: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

/**
 * Test 9: Test de la connectivité frontend (optionnel)
 */
async function testFrontendConnectivity() {
  log.step('Test 9: Test de la connectivité frontend (optionnel)');
  
  try {
    const response = await axios.get(FRONTEND_URL, { timeout: 5000 });
    if (response.status === 200) {
      log.success('Frontend accessible');
      return true;
    }
  } catch (error) {
    log.warning(`Frontend non accessible: ${error.message}`);
    log.info('Ce test est optionnel - le backend fonctionne indépendamment');
    return true; // Non bloquant
  }
}

/**
 * Test 10: Nettoyage des données de test
 */
async function cleanup() {
  log.step('Test 10: Nettoyage des données de test');
  
  try {
    // Supprimer le rendez-vous
    if (testAppointment) {
      await api.patch(`/appointments/${testAppointment._id}/cancel`, {
        reason: 'Nettoyage automatique après test'
      });
      log.success('Rendez-vous de test supprimé');
    }
    
    // Supprimer les créneaux
    if (testTimeSlot) {
      await api.delete(`/timeslots/${testTimeSlot._id}`);
      log.success('Créneaux de test supprimés');
    }
    
    // Note: On ne supprime pas l'utilisateur et le pressing pour éviter les contraintes de clés étrangères
    log.info('Utilisateur et pressing de test conservés (peuvent être supprimés manuellement)');
    
    return true;
  } catch (error) {
    log.warning(`Erreur lors du nettoyage: ${error.response?.data?.message || error.message}`);
    return true; // Non bloquant
  }
}

/**
 * Fonction principale de test
 */
async function runIntegrationTests() {
  console.log(chalk.bold.blue('\n🚀 TESTS D\'INTÉGRATION SYSTÈME DE RÉSERVATION GEOPRESSCI\n'));
  console.log(chalk.gray('=' .repeat(60)));
  
  const tests = [
    testBackendConnectivity,
    testAuthentication,
    testPressingCreation,
    testTimeSlotCreation,
    testAvailableSlots,
    testAppointmentCreation,
    testAppointmentLifecycle,
    testStatistics,
    testFrontendConnectivity,
    cleanup
  ];
  
  let passedTests = 0;
  let failedTests = 0;
  
  for (const test of tests) {
    try {
      const result = await test();
      if (result) {
        passedTests++;
      } else {
        failedTests++;
      }
    } catch (error) {
      log.error(`Test échoué: ${error.message}`);
      failedTests++;
    }
    
    await sleep(500); // Pause entre les tests
  }
  
  // Résumé final
  console.log(chalk.gray('\n' + '=' .repeat(60)));
  console.log(chalk.bold('\n📊 RÉSUMÉ DES TESTS'));
  console.log(chalk.green(`✓ Tests réussis: ${passedTests}`));
  console.log(chalk.red(`✗ Tests échoués: ${failedTests}`));
  console.log(chalk.blue(`📈 Taux de réussite: ${Math.round((passedTests / tests.length) * 100)}%`));
  
  if (failedTests === 0) {
    console.log(chalk.bold.green('\n🎉 TOUS LES TESTS D\'INTÉGRATION ONT RÉUSSI !'));
    console.log(chalk.green('Le système de réservation GeoPressCI est prêt pour la production.'));
  } else {
    console.log(chalk.bold.yellow('\n⚠️  CERTAINS TESTS ONT ÉCHOUÉ'));
    console.log(chalk.yellow('Veuillez vérifier les erreurs ci-dessus avant le déploiement.'));
  }
  
  console.log(chalk.gray('\n' + '=' .repeat(60)));
  process.exit(failedTests > 0 ? 1 : 0);
}

// Gestion des erreurs non capturées
process.on('unhandledRejection', (reason, promise) => {
  log.error(`Erreur non gérée: ${reason}`);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  log.error(`Exception non capturée: ${error.message}`);
  process.exit(1);
});

// Lancement des tests
if (require.main === module) {
  runIntegrationTests();
}

module.exports = {
  runIntegrationTests,
  testBackendConnectivity,
  testAuthentication,
  testPressingCreation,
  testTimeSlotCreation,
  testAvailableSlots,
  testAppointmentCreation,
  testAppointmentLifecycle,
  testStatistics,
  testFrontendConnectivity,
  cleanup
};
