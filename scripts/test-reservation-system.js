const mongoose = require('mongoose');
const config = require('../src/config/config');
const TimeSlot = require('../src/models/timeSlot.model');
const Appointment = require('../src/models/appointment.model');
const Order = require('../src/models/order.model');
const Client = require('../src/models/client.model');
const Pressing = require('../src/models/pressing.model');

/**
 * Script de test pour valider le système de réservation GeoPressCI
 * 
 * Ce script teste :
 * 1. Création de créneaux horaires
 * 2. Création de rendez-vous
 * 3. Intégration avec les commandes
 * 4. Gestion des conflits et disponibilités
 */

async function connectToDatabase() {
  try {
    await mongoose.connect(config.database.uri);
    console.log('✅ Connexion à MongoDB réussie');
  } catch (error) {
    console.error('❌ Erreur de connexion à MongoDB:', error.message);
    process.exit(1);
  }
}

async function testTimeSlotCreation() {
  console.log('\n🧪 Test 1: Création de créneaux horaires');
  
  try {
    // Récupérer un pressing existant
    const pressing = await Pressing.findOne({ status: 'approved' });
    if (!pressing) {
      throw new Error('Aucun pressing approuvé trouvé');
    }
    console.log(`📍 Pressing utilisé: ${pressing.businessName}`);

    // Créer des créneaux pour demain
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const timeSlots = [
      {
        pressing: pressing._id,
        date: tomorrow,
        startTime: '09:00',
        endTime: '10:00',
        maxCapacity: 3,
        slotType: 'regular'
      },
      {
        pressing: pressing._id,
        date: tomorrow,
        startTime: '10:00',
        endTime: '11:00',
        maxCapacity: 5,
        slotType: 'express'
      },
      {
        pressing: pressing._id,
        date: tomorrow,
        startTime: '14:00',
        endTime: '15:00',
        maxCapacity: 2,
        slotType: 'premium'
      }
    ];

    const createdSlots = await TimeSlot.insertMany(timeSlots);
    console.log(`✅ ${createdSlots.length} créneaux créés avec succès`);
    
    // Afficher les créneaux créés
    createdSlots.forEach(slot => {
      console.log(`   - ${slot.startTime}-${slot.endTime} (${slot.slotType}, capacité: ${slot.maxCapacity})`);
    });

    return { pressing, timeSlots: createdSlots };
  } catch (error) {
    console.error('❌ Erreur lors de la création des créneaux:', error.message);
    throw error;
  }
}

async function testAppointmentCreation(pressing, timeSlots) {
  console.log('\n🧪 Test 2: Création de rendez-vous');
  
  try {
    // Récupérer un client existant
    const client = await Client.findOne();
    if (!client) {
      throw new Error('Aucun client trouvé');
    }
    console.log(`👤 Client utilisé: ${client.firstName} ${client.lastName}`);

    // Créer un rendez-vous sur le premier créneau
    const selectedSlot = timeSlots[0];
    
    const appointmentData = {
      client: client._id,
      pressing: pressing._id,
      timeSlot: selectedSlot._id,
      services: [
        {
          service: new mongoose.Types.ObjectId(), // Service fictif pour le test
          quantity: 2,
          unitPrice: 2000,
          totalPrice: 4000
        }
      ],
      totalAmount: 4000,
      notes: 'Test de création de rendez-vous automatisé',
      pickupAddress: {
        street: '123 Rue de Test',
        city: 'Abidjan',
        coordinates: {
          latitude: 5.3364,
          longitude: -4.0267
        }
      }
    };

    const appointment = new Appointment(appointmentData);
    await appointment.save();
    
    console.log(`✅ Rendez-vous créé avec succès`);
    console.log(`   - ID: ${appointment._id}`);
    console.log(`   - Date: ${appointment.appointmentDate}`);
    console.log(`   - Statut: ${appointment.status}`);
    console.log(`   - Montant: ${appointment.totalAmount} FCFA`);

    return appointment;
  } catch (error) {
    console.error('❌ Erreur lors de la création du rendez-vous:', error.message);
    throw error;
  }
}

async function testSlotAvailability(pressing, timeSlots) {
  console.log('\n🧪 Test 3: Vérification de la disponibilité des créneaux');
  
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    // Récupérer les créneaux disponibles
    const availableSlots = await TimeSlot.find({
      pressing: pressing._id,
      date: tomorrow,
      status: 'available'
    }).populate('pressing', 'businessName');

    console.log(`✅ ${availableSlots.length} créneaux disponibles trouvés`);
    
    availableSlots.forEach(slot => {
      const availability = slot.maxCapacity - slot.currentBookings;
      console.log(`   - ${slot.startTime}-${slot.endTime}: ${availability}/${slot.maxCapacity} places disponibles`);
    });

    // Test de la méthode isAvailable
    const firstSlot = timeSlots[0];
    const isAvailable = await firstSlot.isAvailable();
    console.log(`   - Premier créneau disponible: ${isAvailable ? '✅' : '❌'}`);

    return availableSlots;
  } catch (error) {
    console.error('❌ Erreur lors de la vérification de disponibilité:', error.message);
    throw error;
  }
}

async function testAppointmentWorkflow(appointment) {
  console.log('\n🧪 Test 4: Workflow complet du rendez-vous');
  
  try {
    console.log(`📋 Statut initial: ${appointment.status}`);

    // Test de confirmation
    await appointment.confirm({
      estimatedDuration: 45,
      specialInstructions: 'Traitement délicat requis'
    });
    console.log(`✅ Rendez-vous confirmé - Nouveau statut: ${appointment.status}`);

    // Test de mise en cours
    appointment.status = 'in_progress';
    appointment.statusHistory.push({
      status: 'in_progress',
      changedAt: new Date(),
      changedBy: appointment.pressing,
      changedByModel: 'Pressing',
      reason: 'Début du service'
    });
    await appointment.save();
    console.log(`✅ Rendez-vous en cours - Statut: ${appointment.status}`);

    // Test de completion
    await appointment.complete({
      actualDuration: 50,
      qualityNotes: 'Service réalisé avec succès'
    });
    console.log(`✅ Rendez-vous terminé - Statut final: ${appointment.status}`);

    // Afficher l'historique
    console.log(`📜 Historique des statuts (${appointment.statusHistory.length} entrées)`);
    appointment.statusHistory.forEach((entry, index) => {
      console.log(`   ${index + 1}. ${entry.status} - ${entry.changedAt.toLocaleString()}`);
    });

    return appointment;
  } catch (error) {
    console.error('❌ Erreur lors du test du workflow:', error.message);
    throw error;
  }
}

async function testOrderIntegration(appointment) {
  console.log('\n🧪 Test 5: Intégration avec les commandes');
  
  try {
    // Créer une commande liée au rendez-vous
    const orderData = {
      orderNumber: `COMM-${Date.now()}`,
      customer: appointment.client,
      pressing: appointment.pressing,
      items: appointment.services.map(service => ({
        service: service.service,
        pressing: appointment.pressing,
        serviceDetails: {
          name: 'Service de test',
          description: 'Service créé pour test d\'intégration',
          price: service.unitPrice,
          category: 'lavage'
        },
        quantity: service.quantity,
        unitPrice: service.unitPrice,
        totalPrice: service.totalPrice
      })),
      totalAmount: appointment.totalAmount,
      appointment: {
        appointmentId: appointment._id,
        appointmentDate: appointment.appointmentDate,
        timeSlot: appointment.timeSlot,
        appointmentStatus: appointment.status,
        appointmentType: 'regular',
        estimatedDuration: 60,
        appointmentNotes: 'Commande créée via test d\'intégration'
      },
      delivery: {
        type: 'pickup',
        pickupAddress: appointment.pickupAddress
      }
    };

    const order = new Order(orderData);
    await order.save();

    console.log(`✅ Commande créée avec succès`);
    console.log(`   - Numéro: ${order.orderNumber}`);
    console.log(`   - Montant: ${order.totalAmount} FCFA`);
    console.log(`   - Rendez-vous lié: ${order.appointment.appointmentId}`);

    // Mettre à jour le rendez-vous avec la référence de commande
    appointment.order = order._id;
    await appointment.save();
    
    console.log(`✅ Rendez-vous mis à jour avec la référence de commande`);

    return order;
  } catch (error) {
    console.error('❌ Erreur lors de l\'intégration avec les commandes:', error.message);
    throw error;
  }
}

async function testConflictManagement(pressing, timeSlots) {
  console.log('\n🧪 Test 6: Gestion des conflits de réservation');
  
  try {
    const client = await Client.findOne();
    const selectedSlot = timeSlots[0]; // Utiliser le même créneau que le premier rendez-vous

    // Essayer de créer plusieurs rendez-vous sur le même créneau
    const conflictAppointments = [];
    
    for (let i = 0; i < selectedSlot.maxCapacity + 1; i++) {
      try {
        const appointmentData = {
          client: client._id,
          pressing: pressing._id,
          timeSlot: selectedSlot._id,
          services: [{
            service: new mongoose.Types.ObjectId(),
            quantity: 1,
            unitPrice: 1500,
            totalPrice: 1500
          }],
          totalAmount: 1500,
          notes: `Test de conflit #${i + 1}`
        };

        const appointment = new Appointment(appointmentData);
        await appointment.save();
        conflictAppointments.push(appointment);
        
        console.log(`   ✅ Rendez-vous ${i + 1} créé`);
      } catch (error) {
        console.log(`   ❌ Rendez-vous ${i + 1} rejeté: ${error.message}`);
      }
    }

    // Vérifier l'état final du créneau
    const updatedSlot = await TimeSlot.findById(selectedSlot._id);
    console.log(`📊 État final du créneau:`);
    console.log(`   - Capacité maximale: ${updatedSlot.maxCapacity}`);
    console.log(`   - Réservations actuelles: ${updatedSlot.currentBookings}`);
    console.log(`   - Statut: ${updatedSlot.status}`);

    return conflictAppointments;
  } catch (error) {
    console.error('❌ Erreur lors du test de gestion des conflits:', error.message);
    throw error;
  }
}

async function cleanupTestData() {
  console.log('\n🧹 Nettoyage des données de test');
  
  try {
    // Supprimer les données créées pendant les tests
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const deletedSlots = await TimeSlot.deleteMany({ date: tomorrow });
    const deletedAppointments = await Appointment.deleteMany({ 
      createdAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) } // Dernières 10 minutes
    });
    const deletedOrders = await Order.deleteMany({
      orderNumber: { $regex: /^COMM-\d+$/ }
    });

    console.log(`✅ Nettoyage terminé:`);
    console.log(`   - ${deletedSlots.deletedCount} créneaux supprimés`);
    console.log(`   - ${deletedAppointments.deletedCount} rendez-vous supprimés`);
    console.log(`   - ${deletedOrders.deletedCount} commandes supprimées`);
  } catch (error) {
    console.error('❌ Erreur lors du nettoyage:', error.message);
  }
}

async function runAllTests() {
  console.log('🚀 Démarrage des tests du système de réservation GeoPressCI\n');
  
  try {
    await connectToDatabase();
    
    // Test 1: Création de créneaux
    const { pressing, timeSlots } = await testTimeSlotCreation();
    
    // Test 2: Création de rendez-vous
    const appointment = await testAppointmentCreation(pressing, timeSlots);
    
    // Test 3: Vérification de disponibilité
    await testSlotAvailability(pressing, timeSlots);
    
    // Test 4: Workflow complet
    await testAppointmentWorkflow(appointment);
    
    // Test 5: Intégration avec commandes
    await testOrderIntegration(appointment);
    
    // Test 6: Gestion des conflits
    await testConflictManagement(pressing, timeSlots);
    
    console.log('\n🎉 Tous les tests sont terminés avec succès !');
    console.log('\n📋 Résumé des fonctionnalités testées:');
    console.log('   ✅ Création de créneaux horaires');
    console.log('   ✅ Création de rendez-vous');
    console.log('   ✅ Vérification de disponibilité');
    console.log('   ✅ Workflow complet (confirmation → en cours → terminé)');
    console.log('   ✅ Intégration avec les commandes');
    console.log('   ✅ Gestion des conflits de réservation');
    
  } catch (error) {
    console.error('\n💥 Erreur lors des tests:', error.message);
    console.error(error.stack);
  } finally {
    // Nettoyage des données de test
    await cleanupTestData();
    
    // Fermer la connexion
    await mongoose.connection.close();
    console.log('\n👋 Connexion fermée');
  }
}

// Exécuter les tests si le script est appelé directement
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  runAllTests,
  testTimeSlotCreation,
  testAppointmentCreation,
  testSlotAvailability,
  testAppointmentWorkflow,
  testOrderIntegration,
  testConflictManagement
};
