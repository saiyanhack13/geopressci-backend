const mongoose = require('mongoose');
const config = require('./src/config/config');

// Test de population simple
console.log('🧪 Test de population des modèles\n');

async function testPopulation() {
  try {
    // Connexion à la base de données
    console.log('📡 Connexion à MongoDB...');
    await mongoose.connect(config.db.uri);
    console.log('✅ Connecté à MongoDB\n');

    // Importer tous les modèles nécessaires
    console.log('📋 Import des modèles...');
    const Order = require('./src/models/order.model');
    const User = require('./src/models/user.model');
    const Pressing = require('./src/models/pressing.model');
    
    console.log('✅ Modèles importés:', {
      Order: typeof Order,
      User: typeof User,
      Pressing: typeof Pressing
    });

    // Vérifier les modèles enregistrés dans Mongoose
    console.log('\n📋 Modèles enregistrés dans Mongoose:');
    console.log(Object.keys(mongoose.models));

    // Tester une commande spécifique
    const testOrderId = '6888f07dc6a85488a3500485'; // ID complet de l'erreur
    console.log(`\n🎯 Test avec ID complet: ${testOrderId}`);

    // Vérifier si l'ID existe
    const orderExists = await Order.findById(testOrderId);
    if (!orderExists) {
      console.log('❌ Commande non trouvée avec cet ID');
      
      // Chercher des commandes similaires
      const similarOrders = await Order.find({}).limit(3);
      console.log('\n📋 Commandes disponibles:');
      similarOrders.forEach(order => {
        console.log(`- ${order._id} (status: ${order.status})`);
      });
      
      if (similarOrders.length > 0) {
        console.log(`\n🔄 Test avec la première commande: ${similarOrders[0]._id}`);
        
        // Tester la population avec une commande existante
        const populatedOrder = await Order.findById(similarOrders[0]._id)
          .populate('customer', 'nom prenom email telephone')
          .populate('pressing', 'nomCommerce adresse telephone');
          
        console.log('✅ Population réussie:', {
          orderId: populatedOrder._id,
          customer: populatedOrder.customer,
          pressing: populatedOrder.pressing
        });
      }
    } else {
      console.log('✅ Commande trouvée, test de population...');
      
      const populatedOrder = await Order.findById(testOrderId)
        .populate('customer', 'nom prenom email telephone')
        .populate('pressing', 'nomCommerce adresse telephone');
        
      console.log('✅ Population réussie:', {
        customer: populatedOrder.customer,
        pressing: populatedOrder.pressing
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

testPopulation();
