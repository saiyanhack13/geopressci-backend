const mongoose = require('mongoose');
const config = require('./src/config/config');

// Modèles
const Order = require('./src/models/order.model');

async function cleanupCorruptedOrders() {
  try {
    console.log('🔧 Démarrage du nettoyage des commandes corrompues...');
    
    // Connexion à MongoDB
    await mongoose.connect(config.db.uri);
    console.log('✅ Connecté à MongoDB');
    
    // Rechercher les commandes sans customer
    const ordersWithoutCustomer = await Order.find({ 
      customer: { $exists: false } 
    }).populate('pressing', 'nomCommerce');
    
    console.log(`📊 Commandes sans client trouvées: ${ordersWithoutCustomer.length}`);
    
    for (const order of ordersWithoutCustomer) {
      console.log(`\n🔍 Commande corrompue: ${order._id}`);
      console.log(`   - Statut: ${order.status}`);
      console.log(`   - Pressing: ${order.pressing?.nomCommerce || 'N/A'}`);
      console.log(`   - Créée le: ${order.createdAt}`);
      
      // Option 1: Supprimer la commande corrompue
      console.log(`❌ Suppression de la commande corrompue: ${order._id}`);
      await Order.findByIdAndDelete(order._id);
    }
    
    // Rechercher les commandes sans pressing
    const ordersWithoutPressing = await Order.find({ 
      pressing: { $exists: false } 
    }).populate('customer', 'nom prenom');
    
    console.log(`📊 Commandes sans pressing trouvées: ${ordersWithoutPressing.length}`);
    
    for (const order of ordersWithoutPressing) {
      console.log(`\n🔍 Commande sans pressing: ${order._id}`);
      console.log(`   - Statut: ${order.status}`);
      console.log(`   - Client: ${order.customer?.nom} ${order.customer?.prenom || 'N/A'}`);
      console.log(`   - Créée le: ${order.createdAt}`);
      
      // Option 1: Supprimer la commande corrompue
      console.log(`❌ Suppression de la commande sans pressing: ${order._id}`);
      await Order.findByIdAndDelete(order._id);
    }
    
    // Vérification finale
    const totalOrders = await Order.countDocuments();
    const validOrders = await Order.countDocuments({
      customer: { $exists: true },
      pressing: { $exists: true }
    });
    
    console.log(`\n📊 Résumé final:`);
    console.log(`   - Total commandes: ${totalOrders}`);
    console.log(`   - Commandes valides: ${validOrders}`);
    console.log(`   - Commandes corrompues restantes: ${totalOrders - validOrders}`);
    
    if (totalOrders === validOrders) {
      console.log('✅ Toutes les commandes sont maintenant valides !');
    } else {
      console.log('⚠️ Il reste des commandes avec des problèmes de données');
    }
    
  } catch (error) {
    console.error('❌ Erreur lors du nettoyage:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Déconnecté de MongoDB');
  }
}

// Exécuter le script
if (require.main === module) {
  cleanupCorruptedOrders()
    .then(() => {
      console.log('🎉 Nettoyage terminé !');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Erreur fatale:', error);
      process.exit(1);
    });
}

module.exports = cleanupCorruptedOrders;
