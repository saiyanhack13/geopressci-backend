const mongoose = require('mongoose');
const config = require('./src/config/config');

// Modèles
const Order = require('./src/models/order.model');
const Client = require('./src/models/client.model');
const Pressing = require('./src/models/pressing.model');

async function testFixedPopulation() {
  try {
    console.log('🧪 Test de la population corrigée...');
    
    // Connexion à MongoDB
    await mongoose.connect(config.db.uri);
    console.log('✅ Connecté à MongoDB');
    
    const orderId = '688844d1c6a85488a3500579';
    console.log(`🎯 Test de la commande: ${orderId}`);
    
    // Test avec la nouvelle méthode de population
    const order = await Order.findById(orderId)
      .populate({
        path: 'customer',
        model: 'Client',
        select: 'nom prenom email telephone'
      })
      .populate({
        path: 'pressing',
        model: 'Pressing',
        select: 'nomCommerce adresse telephone'
      });
      
    console.log('📄 Résultat de la population corrigée:', {
      _id: order?._id,
      customer: order?.customer,
      pressing: order?.pressing,
      status: order?.status,
      customerPopulated: !!order?.customer,
      pressingPopulated: !!order?.pressing,
      customerDetails: order?.customer ? {
        id: order.customer._id,
        nom: order.customer.nom,
        prenom: order.customer.prenom,
        email: order.customer.email
      } : null,
      pressingDetails: order?.pressing ? {
        id: order.pressing._id,
        nomCommerce: order.pressing.nomCommerce,
        adresse: order.pressing.adresse
      } : null
    });
    
    if (order?.customer && order?.pressing) {
      console.log('✅ Population réussie ! La commande a maintenant ses données complètes.');
    } else {
      console.log('❌ Problème de population persistant');
      if (!order?.customer) console.log('   - Customer non populé');
      if (!order?.pressing) console.log('   - Pressing non populé');
    }
    
  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Déconnecté de MongoDB');
  }
}

// Exécuter le script
if (require.main === module) {
  testFixedPopulation()
    .then(() => {
      console.log('🎉 Test terminé !');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Erreur fatale:', error);
      process.exit(1);
    });
}

module.exports = testFixedPopulation;
