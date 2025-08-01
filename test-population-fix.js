const mongoose = require('mongoose');
const config = require('./src/config/config');

// Test de population après correction
console.log('🧪 Test de population après correction\n');

async function testPopulationFix() {
  try {
    // Connexion à la base de données
    console.log('📡 Connexion à MongoDB...');
    await mongoose.connect(config.db.uri);
    console.log('✅ Connecté à MongoDB\n');

    // Importer les modèles avec la bonne syntaxe
    const Order = require('./src/models/order.model');
    const { User } = require('./src/models/user.model'); // Correction ici
    const Pressing = require('./src/models/pressing.model');
    
    console.log('✅ Modèles importés:', {
      Order: typeof Order,
      User: typeof User,
      Pressing: typeof Pressing
    });

    // Vérifier les modèles enregistrés dans Mongoose
    console.log('\n📋 Modèles enregistrés dans Mongoose:');
    console.log(Object.keys(mongoose.models));

    // Tester avec une commande existante
    console.log('\n🔍 Test de population avec une commande existante...');
    const firstOrder = await Order.findOne({});
    
    if (!firstOrder) {
      console.log('❌ Aucune commande trouvée');
      return;
    }
    
    console.log(`✅ Commande trouvée: ${firstOrder._id}`);
    
    // Tester la population
    const populatedOrder = await Order.findById(firstOrder._id)
      .populate('customer', 'nom prenom email telephone')
      .populate('pressing', 'nomCommerce adresse telephone');
      
    console.log('✅ Population réussie:', {
      orderId: populatedOrder._id,
      customer: populatedOrder.customer,
      pressing: populatedOrder.pressing
    });

    // Tester le filtrage pour un client spécifique
    const clientId = '687dde13528b48ca748358cf';
    console.log(`\n🎯 Test de filtrage pour client: ${clientId}`);
    
    const clientOrders = await Order.find({ customer: clientId })
      .populate('customer', 'nom prenom email telephone')
      .populate('pressing', 'nomCommerce adresse telephone');
      
    console.log(`✅ ${clientOrders.length} commandes trouvées pour ce client`);
    
    if (clientOrders.length > 0) {
      console.log('📋 Première commande du client:', {
        id: clientOrders[0]._id,
        status: clientOrders[0].status,
        customer: clientOrders[0].customer,
        pressing: clientOrders[0].pressing
      });
    }

  } catch (error) {
    console.error('❌ Erreur lors du test:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n📡 Déconnecté de MongoDB');
  }
}

testPopulationFix();
