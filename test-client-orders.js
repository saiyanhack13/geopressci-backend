const mongoose = require('mongoose');
const config = require('./src/config/config');

// Test des commandes pour un client spécifique
console.log('🧪 Test des commandes pour client spécifique\n');

async function testClientOrders() {
  try {
    // Connexion à la base de données
    console.log('📡 Connexion à MongoDB...');
    await mongoose.connect(config.db.uri);
    console.log('✅ Connecté à MongoDB\n');

    // Importer les modèles
    const Order = require('./src/models/order.model');
    
    const clientId = '687dde13528b48ca748358cf'; // ID du client test
    console.log(`🎯 Recherche des commandes pour le client: ${clientId}`);

    // Chercher toutes les commandes
    console.log('\n📋 Toutes les commandes dans la base:');
    const allOrders = await Order.find({}).limit(10);
    console.log(`Total: ${allOrders.length} commandes`);
    
    allOrders.forEach((order, index) => {
      console.log(`${index + 1}. ${order._id} - Customer: ${order.customer || 'null'} - Status: ${order.status}`);
    });

    // Chercher les commandes pour ce client spécifique
    console.log(`\n🔍 Commandes pour le client ${clientId}:`);
    const clientOrders = await Order.find({ customer: clientId })
      .populate('customer', 'nom prenom email')
      .populate('pressing', 'nomCommerce adresse');
    
    console.log(`✅ ${clientOrders.length} commandes trouvées pour ce client`);
    
    if (clientOrders.length > 0) {
      clientOrders.forEach((order, index) => {
        console.log(`${index + 1}. Commande ${order._id}:`);
        console.log(`   Status: ${order.status}`);
        console.log(`   Client: ${order.customer?.nom} ${order.customer?.prenom}`);
        console.log(`   Pressing: ${order.pressing?.nomCommerce}`);
        console.log(`   Date: ${order.createdAt}`);
      });
    } else {
      console.log('❌ Aucune commande trouvée pour ce client');
      
      // Chercher des commandes avec customer null
      console.log('\n🔍 Commandes avec customer null:');
      const nullCustomerOrders = await Order.find({ customer: null }).limit(5);
      console.log(`${nullCustomerOrders.length} commandes avec customer null`);
      
      // Chercher des commandes avec des customers différents
      console.log('\n📊 Répartition des customers:');
      const customerStats = await Order.aggregate([
        { $group: { _id: '$customer', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]);
      
      customerStats.forEach(stat => {
        console.log(`Customer ${stat._id || 'null'}: ${stat.count} commandes`);
      });
    }

  } catch (error) {
    console.error('❌ Erreur lors du test:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n📡 Déconnecté de MongoDB');
  }
}

testClientOrders();
