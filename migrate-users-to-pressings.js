const mongoose = require('mongoose');
require('dotenv').config();

// Script de migration : Transférer tous les pressings de la collection "users" vers "pressings"
async function migrateUsersToPressingCollection() {
  try {
    console.log('🚀 Début de la migration des pressings de "users" vers "pressings"');
    
    // Connexion à MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/geopressci');
    console.log('✅ Connexion MongoDB établie');
    
    const db = mongoose.connection.db;
    
    // Collections
    const usersCollection = db.collection('users');
    const pressingsCollection = db.collection('pressings');
    
    // 1. Trouver tous les pressings dans la collection users
    console.log('\n🔍 Recherche des pressings dans la collection "users"...');
    const pressingsInUsers = await usersCollection.find({ 
      role: 'pressing' 
    }).toArray();
    
    console.log(`📊 Trouvé ${pressingsInUsers.length} pressing(s) dans la collection "users"`);
    
    if (pressingsInUsers.length === 0) {
      console.log('✅ Aucun pressing à migrer. Migration terminée.');
      return;
    }
    
    // 2. Vérifier les pressings existants dans la collection pressings
    console.log('\n🔍 Vérification des pressings existants dans la collection "pressings"...');
    const existingPressings = await pressingsCollection.find({}).toArray();
    console.log(`📊 Trouvé ${existingPressings.length} pressing(s) existant(s) dans la collection "pressings"`);
    
    // 3. Migrer chaque pressing
    let migratedCount = 0;
    let skippedCount = 0;
    
    for (const pressing of pressingsInUsers) {
      console.log(`\n📝 Traitement du pressing: ${pressing.email}`);
      
      // Vérifier si le pressing existe déjà dans la collection pressings
      const existingPressing = await pressingsCollection.findOne({ email: pressing.email });
      
      if (existingPressing) {
        console.log(`⚠️ Pressing ${pressing.email} existe déjà dans la collection "pressings". Ignoré.`);
        skippedCount++;
        continue;
      }
      
      // Préparer les données pour la migration
      const pressingData = {
        // Champs de base
        nom: pressing.nom,
        prenom: pressing.prenom,
        email: pressing.email,
        password: pressing.password,
        phone: pressing.phone || pressing.telephone,
        role: 'pressing',
        
        // Champs spécifiques au pressing
        businessName: pressing.businessName || pressing.nomCommerce || `Pressing ${pressing.nom}`,
        businessPhone: pressing.businessPhone || pressing.phone || pressing.telephone,
        
        // Adresse avec structure correcte
        address: pressing.address || {
          street: pressing.adresse || 'Adresse non spécifiée',
          city: pressing.ville || 'Abidjan',
          district: pressing.quartier || 'Abidjan',
          postalCode: pressing.codePostal || '00225',
          country: pressing.pays || 'Côte d\'Ivoire',
          coordinates: pressing.coordinates || {
            type: 'Point',
            coordinates: [-4.0267, 5.3364] // Coordonnées par défaut Cocody
          },
          formattedAddress: pressing.adresse || 'Adresse non spécifiée'
        },
        
        // Description
        description: pressing.description || `Pressing ${pressing.businessName || pressing.nomCommerce || pressing.nom}`,
        
        // Horaires par défaut
        businessHours: pressing.businessHours || [
          { day: 'lundi', open: '08:00', close: '18:00', isClosed: false },
          { day: 'mardi', open: '08:00', close: '18:00', isClosed: false },
          { day: 'mercredi', open: '08:00', close: '18:00', isClosed: false },
          { day: 'jeudi', open: '08:00', close: '18:00', isClosed: false },
          { day: 'vendredi', open: '08:00', close: '18:00', isClosed: false },
          { day: 'samedi', open: '08:00', close: '16:00', isClosed: false },
          { day: 'dimanche', open: '00:00', close: '00:00', isClosed: true }
        ],
        
        // Services
        services: pressing.services || [],
        
        // Options de livraison par défaut
        deliveryOptions: pressing.deliveryOptions || {
          isAvailable: false,
          freeDeliveryThreshold: 10000,
          deliveryFee: 1000,
          maxDeliveryDistance: 10,
          estimatedDeliveryTime: 120
        },
        
        // Évaluations
        rating: pressing.rating || {
          average: 0,
          count: 0,
          totalScore: 0
        },
        
        // Abonnement
        subscription: pressing.subscription || {
          plan: 'trial',
          status: 'trialing',
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 jours
          autoRenew: false
        },
        
        // Vérification
        verification: pressing.verification || {
          status: 'pending',
          documents: []
        },
        
        // Paramètres
        settings: pressing.settings || {
          notifications: {
            email: true,
            sms: true,
            push: true
          },
          privacy: {
            showPhone: true,
            showEmail: false
          }
        },
        
        // Statut
        status: pressing.status || 'pending',
        isActive: pressing.isActive !== false,
        isVerified: pressing.isVerified || false,
        
        // Métadonnées
        createdAt: pressing.createdAt || new Date(),
        updatedAt: pressing.updatedAt || new Date(),
        lastLogin: pressing.lastLogin
      };
      
      try {
        // Insérer dans la collection pressings
        await pressingsCollection.insertOne(pressingData);
        console.log(`✅ Pressing ${pressing.email} migré avec succès`);
        migratedCount++;
        
        // Supprimer de la collection users
        await usersCollection.deleteOne({ _id: pressing._id });
        console.log(`🗑️ Pressing supprimé de la collection "users"`);
        
      } catch (error) {
        console.error(`❌ Erreur lors de la migration du pressing ${pressing.email}:`, error.message);
      }
    }
    
    // 4. Résumé de la migration
    console.log('\n📊 RÉSUMÉ DE LA MIGRATION');
    console.log(`✅ Pressings migrés avec succès: ${migratedCount}`);
    console.log(`⚠️ Pressings ignorés (déjà existants): ${skippedCount}`);
    console.log(`📊 Total traité: ${pressingsInUsers.length}`);
    
    // 5. Vérification finale
    console.log('\n🔍 Vérification finale...');
    const remainingPressingsInUsers = await usersCollection.countDocuments({ role: 'pressing' });
    const totalPressingsInPressings = await pressingsCollection.countDocuments({});
    
    console.log(`📊 Pressings restants dans "users": ${remainingPressingsInUsers}`);
    console.log(`📊 Total pressings dans "pressings": ${totalPressingsInPressings}`);
    
    if (remainingPressingsInUsers === 0) {
      console.log('🎉 Migration terminée avec succès ! Tous les pressings ont été transférés.');
    } else {
      console.log('⚠️ Il reste des pressings dans la collection "users". Vérifiez les erreurs ci-dessus.');
    }
    
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔚 Connexion MongoDB fermée');
  }
}

// Fonction pour nettoyer les scripts et fichiers temporaires
async function cleanupTemporaryFiles() {
  console.log('\n🧹 Nettoyage des fichiers temporaires...');
  
  const fs = require('fs').promises;
  const path = require('path');
  
  const filesToDelete = [
    'migrate-pressing-user.js',
    'test-pressing-registration.js',
    'debug-db.js'
  ];
  
  for (const file of filesToDelete) {
    try {
      const filePath = path.join(__dirname, file);
      await fs.unlink(filePath);
      console.log(`🗑️ Fichier supprimé: ${file}`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.log(`⚠️ Impossible de supprimer ${file}: ${error.message}`);
      }
    }
  }
}

// Exécution du script
if (require.main === module) {
  console.log('🚀 MIGRATION USERS → PRESSINGS');
  console.log('================================');
  
  migrateUsersToPressingCollection()
    .then(() => {
      console.log('\n🧹 Nettoyage des fichiers temporaires...');
      return cleanupTemporaryFiles();
    })
    .then(() => {
      console.log('\n🎉 MIGRATION TERMINÉE AVEC SUCCÈS !');
      console.log('✅ Tous les pressings utilisent maintenant la collection "pressings"');
      console.log('✅ Plus aucune dépendance à la collection "users" pour les pressings');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ ERREUR LORS DE LA MIGRATION:', error);
      process.exit(1);
    });
}

module.exports = { migrateUsersToPressingCollection };
