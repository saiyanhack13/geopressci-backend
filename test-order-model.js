const mongoose = require('mongoose');
const config = require('./src/config/config');

// Test du modèle Order
console.log('🧪 Test du modèle Order\n');

async function testOrderModel() {
  try {
    // Connexion à la base de données
    console.log('📡 Connexion à MongoDB...');
    console.log('🔗 URI:', config.db.uri);
    await mongoose.connect(config.db.uri);
    console.log('✅ Connecté à MongoDB\n');

    // Importer le modèle Order
    const Order = require('./src/models/order.model');
    console.log('📋 Modèle Order importé:', typeof Order);

    // Tester la recherche d'une commande
    console.log('🔍 Test de recherche de commandes...');
    const orders = await Order.find().limit(5);
    console.log(`✅ ${orders.length} commandes trouvées\n`);

    if (orders.length > 0) {
      const firstOrder = orders[0];
      console.log('📦 Première commande:', {
        id: firstOrder._id,
        status: firstOrder.status,
        customer: firstOrder.customer,
        pressing: firstOrder.pressing,
        createdAt: firstOrder.createdAt
      });

      // Tester la population
      console.log('\n🔗 Test de population...');
      const populatedOrder = await Order.findById(firstOrder._id)
        .populate('customer', 'nom prenom email telephone')
        .populate('pressing', 'nomCommerce adresse telephone');

      if (populatedOrder) {
        console.log('✅ Population réussie:', {
          customer: populatedOrder.customer,
          pressing: populatedOrder.pressing
        });
      } else {
        console.log('❌ Échec de la population');
      }
    }

    // Tester avec un ID spécifique (celui de l'erreur)
    const testId = '6888f07'; // ID partiel de l'erreur
    console.log(`\n🎯 Test avec ID partiel: ${testId}`);
    
    // Chercher des commandes qui commencent par cet ID
    const matchingOrders = await Order.find({
      _id: { $regex: `^${testId}` }
    });
    
    console.log(`📋 Commandes trouvées avec ID commençant par ${testId}:`, matchingOrders.length);
    
    if (matchingOrders.length > 0) {
      console.log('🔍 Détails de la première commande correspondante:');
      console.log({
        id: matchingOrders[0]._id,
        status: matchingOrders[0].status,
        customer: matchingOrders[0].customer,
        pressing: matchingOrders[0].pressing
      });
    }

  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n📡 Déconnecté de MongoDB');
  }
}

testOrderModel();
