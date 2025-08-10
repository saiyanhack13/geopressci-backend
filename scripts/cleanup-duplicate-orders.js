/**
 * Script pour nettoyer les commandes en double
 * Garde la commande la plus récente et supprime les autres
 */

const mongoose = require('mongoose');
const Order = require('../src/models/order.model');

// Configuration de la base de données
require('dotenv').config();
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/geopressci';

async function cleanupDuplicateOrders() {
  try {
    console.log('🔌 Connexion à MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté à MongoDB');

    // Trouver les commandes du client spécifique avec les mêmes caractéristiques
    const clientId = '687dde13528b48ca748358cf';
    const pressingId = '68950559e0e42bf6c61e3bc4';
    
    console.log(`🔍 Recherche des commandes en double pour le client ${clientId}...`);
    
    const duplicateOrders = await Order.find({
      customer: clientId,
      pressing: pressingId,
      'payment.amount.total': 3658,
      status: 'draft'
    }).sort({ createdAt: -1 }); // Trier par date de création (plus récent en premier)
    
    console.log(`📊 ${duplicateOrders.length} commandes trouvées`);
    
    if (duplicateOrders.length <= 1) {
      console.log('✅ Aucun doublon détecté');
      return;
    }
    
    // Garder la première (plus récente) et supprimer les autres
    const orderToKeep = duplicateOrders[0];
    const ordersToDelete = duplicateOrders.slice(1);
    
    console.log(`📌 Commande à conserver: ${orderToKeep._id} (créée le ${orderToKeep.createdAt})`);
    console.log(`🗑️ Commandes à supprimer: ${ordersToDelete.length}`);
    
    // Afficher les détails des commandes à supprimer
    ordersToDelete.forEach((order, index) => {
      console.log(`   ${index + 1}. ${order._id} (créée le ${order.createdAt})`);
    });
    
    // Supprimer les commandes en double
    const orderIdsToDelete = ordersToDelete.map(order => order._id);
    
    const deleteResult = await Order.deleteMany({
      _id: { $in: orderIdsToDelete }
    });
    
    console.log(`✅ ${deleteResult.deletedCount} commandes supprimées`);
    console.log(`📌 Commande conservée: ${orderToKeep._id}`);
    
    // Vérification finale
    const remainingOrders = await Order.find({
      customer: clientId,
      pressing: pressingId,
      'payment.amount.total': 3658,
      status: 'draft'
    });
    
    console.log(`🔍 Vérification finale: ${remainingOrders.length} commande(s) restante(s)`);
    
    if (remainingOrders.length === 1) {
      console.log('✅ Nettoyage réussi !');
    } else {
      console.log('⚠️ Problème détecté lors du nettoyage');
    }
    
  } catch (error) {
    console.error('❌ Erreur lors du nettoyage:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Déconnecté de MongoDB');
  }
}

// Fonction pour lister toutes les commandes d'un client
async function listClientOrders() {
  try {
    console.log('🔌 Connexion à MongoDB...');
    console.log('📍 URI:', MONGODB_URI);
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté à MongoDB');
    
    const clientId = '687dde13528b48ca748358cf';
    console.log(`🔍 Recherche des commandes pour le client: ${clientId}`);
    
    const orders = await Order.find({ customer: clientId })
      .populate('pressing', 'businessName')
      .sort({ createdAt: -1 });
    
    console.log(`📊 ${orders.length} commandes trouvées`);
    console.log(`📋 Toutes les commandes du client ${clientId}:`);
    
    if (orders.length === 0) {
      console.log('   Aucune commande trouvée');
    } else {
      orders.forEach((order, index) => {
        console.log(`${index + 1}. ${order._id}`);
        console.log(`   - Pressing: ${order.pressing?.businessName || 'N/A'}`);
        console.log(`   - Montant: ${order.payment?.amount?.total || 'N/A'} FCFA`);
        console.log(`   - Statut: ${order.status}`);
        console.log(`   - Créée: ${order.createdAt}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    console.log('🔌 Déconnexion de MongoDB...');
    await mongoose.disconnect();
    console.log('✅ Déconnecté');
  }
}

// Exécuter le script selon l'argument
const action = process.argv[2];

if (action === 'list') {
  listClientOrders();
} else if (action === 'clean') {
  cleanupDuplicateOrders();
} else {
  console.log('Usage:');
  console.log('  node cleanup-duplicate-orders.js list   # Lister les commandes');
  console.log('  node cleanup-duplicate-orders.js clean  # Nettoyer les doublons');
}
