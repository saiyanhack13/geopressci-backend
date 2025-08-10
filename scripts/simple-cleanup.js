/**
 * Script simple pour nettoyer les commandes en double
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Schéma Order simplifié
const orderSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
  pressing: { type: mongoose.Schema.Types.ObjectId, ref: 'Pressing' },
  status: String,
  payment: {
    amount: {
      total: Number
    }
  }
}, { timestamps: true });

const Order = mongoose.model('Order', orderSchema);

async function main() {
  try {
    console.log('🔌 Connexion à MongoDB...');
    
    const uri = process.env.MONGODB_URI;
    console.log('📍 URI:', uri ? uri.substring(0, 50) + '...' : 'Non définie');
    
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000, // Timeout de 5 secondes
    });
    
    console.log('✅ Connecté à MongoDB');
    
    const clientId = '687dde13528b48ca748358cf';
    const pressingId = '68950559e0e42bf6c61e3bc4';
    
    console.log(`🔍 Recherche des commandes pour client: ${clientId}`);
    
    // Rechercher toutes les commandes du client
    const allOrders = await Order.find({ customer: clientId }).lean();
    console.log(`📊 Total commandes trouvées: ${allOrders.length}`);
    
    // Rechercher les commandes spécifiques avec montant 3658
    const duplicateOrders = await Order.find({
      customer: clientId,
      pressing: pressingId,
      'payment.amount.total': 3658
    }).sort({ createdAt: -1 }).lean();
    
    console.log(`🔍 Commandes avec montant 3658: ${duplicateOrders.length}`);
    
    if (duplicateOrders.length > 1) {
      console.log('🚨 Doublons détectés !');
      
      duplicateOrders.forEach((order, index) => {
        console.log(`${index + 1}. ${order._id} - ${order.createdAt} - ${order.status}`);
      });
      
      // Garder la première (plus récente) et marquer les autres pour suppression
      const toKeep = duplicateOrders[0];
      const toDelete = duplicateOrders.slice(1);
      
      console.log(`📌 À conserver: ${toKeep._id}`);
      console.log(`🗑️ À supprimer: ${toDelete.length} commandes`);
      
      // Supprimer les doublons
      const deleteIds = toDelete.map(order => order._id);
      const result = await Order.deleteMany({ _id: { $in: deleteIds } });
      
      console.log(`✅ ${result.deletedCount} commandes supprimées`);
    } else {
      console.log('✅ Aucun doublon détecté');
    }
    
    // Vérification finale
    const remainingOrders = await Order.find({ customer: clientId }).lean();
    console.log(`📋 Commandes restantes: ${remainingOrders.length}`);
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Déconnecté');
    process.exit(0);
  }
}

main();
