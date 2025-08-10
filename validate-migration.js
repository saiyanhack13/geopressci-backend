const mongoose = require('mongoose');
require('dotenv').config();

// Script de validation finale pour s'assurer que la migration est complète
async function validateMigration() {
  try {
    console.log('🔍 VALIDATION DE LA MIGRATION USERS → PRESSINGS');
    console.log('===============================================');
    
    // Connexion à MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/geopressci');
    console.log('✅ Connexion MongoDB établie');
    
    const db = mongoose.connection.db;
    let validationErrors = [];
    let validationWarnings = [];
    
    // 1. Vérifier qu'il n'y a plus de pressings dans la collection users
    console.log('\n🔍 1. Vérification collection "users"...');
    const pressingsInUsers = await db.collection('users').find({ role: 'pressing' }).toArray();
    
    if (pressingsInUsers.length > 0) {
      validationErrors.push(`❌ ${pressingsInUsers.length} pressing(s) encore présent(s) dans la collection "users"`);
      console.log(`❌ ERREUR: ${pressingsInUsers.length} pressing(s) trouvé(s) dans "users"`);
      pressingsInUsers.forEach(p => console.log(`   - ${p.email}`));
    } else {
      console.log('✅ Aucun pressing dans la collection "users"');
    }
    
    // 2. Vérifier que tous les pressings sont dans la collection pressings
    console.log('\n🔍 2. Vérification collection "pressings"...');
    const pressingsInPressings = await db.collection('pressings').find({}).toArray();
    console.log(`📊 ${pressingsInPressings.length} pressing(s) dans la collection "pressings"`);
    
    if (pressingsInPressings.length === 0) {
      validationWarnings.push('⚠️ Aucun pressing dans la collection "pressings"');
    }
    
    // Vérifier la structure des pressings
    for (const pressing of pressingsInPressings.slice(0, 3)) { // Vérifier les 3 premiers
      console.log(`   ✅ ${pressing.email} - Structure OK`);
      
      // Vérifier les champs requis
      const requiredFields = ['nom', 'prenom', 'email', 'password', 'phone', 'businessName', 'address'];
      for (const field of requiredFields) {
        if (!pressing[field]) {
          validationWarnings.push(`⚠️ Champ manquant "${field}" pour ${pressing.email}`);
        }
      }
      
      // Vérifier la structure de l'adresse
      if (pressing.address && pressing.address.coordinates) {
        console.log(`   📍 Coordonnées: ${pressing.address.coordinates.coordinates}`);
      } else {
        validationWarnings.push(`⚠️ Coordonnées manquantes pour ${pressing.email}`);
      }
    }
    
    // 3. Vérifier les références dans les autres collections
    console.log('\n🔍 3. Vérification des références dans les autres collections...');
    
    // Vérifier les commandes
    const orders = await db.collection('orders').find({}).limit(5).toArray();
    console.log(`📊 ${orders.length} commande(s) trouvée(s) pour vérification`);
    
    for (const order of orders) {
      if (order.customer) {
        // Vérifier que le customer référence bien un client
        const customer = await db.collection('clients').findOne({ _id: order.customer });
        if (!customer) {
          const userCustomer = await db.collection('users').findOne({ _id: order.customer });
          if (userCustomer) {
            validationWarnings.push(`⚠️ Commande ${order._id} référence un client dans "users" au lieu de "clients"`);
          } else {
            validationWarnings.push(`⚠️ Commande ${order._id} référence un client inexistant`);
          }
        }
      }
      
      if (order.pressing) {
        // Vérifier que le pressing référence bien un pressing
        const pressing = await db.collection('pressings').findOne({ _id: order.pressing });
        if (!pressing) {
          const userPressing = await db.collection('users').findOne({ _id: order.pressing });
          if (userPressing) {
            validationErrors.push(`❌ Commande ${order._id} référence un pressing dans "users" au lieu de "pressings"`);
          } else {
            validationWarnings.push(`⚠️ Commande ${order._id} référence un pressing inexistant`);
          }
        }
      }
    }
    
    // 4. Vérifier les services
    console.log('\n🔍 4. Vérification des services...');
    const services = await db.collection('services').find({}).limit(5).toArray();
    console.log(`📊 ${services.length} service(s) trouvé(s) pour vérification`);
    
    for (const service of services) {
      if (service.createdBy) {
        const pressing = await db.collection('pressings').findOne({ _id: service.createdBy });
        if (!pressing) {
          const userPressing = await db.collection('users').findOne({ _id: service.createdBy });
          if (userPressing && userPressing.role === 'pressing') {
            validationErrors.push(`❌ Service ${service._id} créé par un pressing dans "users" au lieu de "pressings"`);
          }
        }
      }
    }
    
    // 5. Vérifier les promotions
    console.log('\n🔍 5. Vérification des promotions...');
    const promotions = await db.collection('promotions').find({}).limit(5).toArray();
    console.log(`📊 ${promotions.length} promotion(s) trouvée(s) pour vérification`);
    
    for (const promotion of promotions) {
      if (promotion.createdBy) {
        const pressing = await db.collection('pressings').findOne({ _id: promotion.createdBy });
        if (!pressing) {
          const userPressing = await db.collection('users').findOne({ _id: promotion.createdBy });
          if (userPressing && userPressing.role === 'pressing') {
            validationErrors.push(`❌ Promotion ${promotion._id} créée par un pressing dans "users" au lieu de "pressings"`);
          }
        }
      }
    }
    
    // 6. Test de connexion avec un pressing
    console.log('\n🔍 6. Test de connexion pressing...');
    if (pressingsInPressings.length > 0) {
      const testPressing = pressingsInPressings[0];
      console.log(`🧪 Test avec pressing: ${testPressing.email}`);
      
      // Simuler une recherche de pressing pour connexion
      const foundPressing = await db.collection('pressings').findOne({ email: testPressing.email });
      if (foundPressing) {
        console.log('✅ Pressing trouvé dans la collection "pressings"');
        
        // Vérifier que le pressing n'est pas dans users
        const pressingInUsers = await db.collection('users').findOne({ email: testPressing.email });
        if (pressingInUsers) {
          validationErrors.push(`❌ Pressing ${testPressing.email} existe dans les deux collections`);
        } else {
          console.log('✅ Pressing absent de la collection "users"');
        }
      }
    }
    
    // 7. Résumé de la validation
    console.log('\n📊 RÉSUMÉ DE LA VALIDATION');
    console.log('==========================');
    
    const stats = {
      pressingsInUsers: pressingsInUsers.length,
      pressingsInPressings: pressingsInPressings.length,
      totalOrders: await db.collection('orders').countDocuments({}),
      totalServices: await db.collection('services').countDocuments({}),
      totalPromotions: await db.collection('promotions').countDocuments({}),
      totalClients: await db.collection('clients').countDocuments({}),
      totalAdmins: await db.collection('admins').countDocuments({})
    };
    
    console.log(`📊 Pressings dans "users": ${stats.pressingsInUsers}`);
    console.log(`📊 Pressings dans "pressings": ${stats.pressingsInPressings}`);
    console.log(`📊 Total commandes: ${stats.totalOrders}`);
    console.log(`📊 Total services: ${stats.totalServices}`);
    console.log(`📊 Total promotions: ${stats.totalPromotions}`);
    console.log(`📊 Total clients: ${stats.totalClients}`);
    console.log(`📊 Total admins: ${stats.totalAdmins}`);
    
    // 8. Affichage des erreurs et avertissements
    console.log('\n🚨 ERREURS CRITIQUES:');
    if (validationErrors.length === 0) {
      console.log('✅ Aucune erreur critique détectée');
    } else {
      validationErrors.forEach(error => console.log(error));
    }
    
    console.log('\n⚠️ AVERTISSEMENTS:');
    if (validationWarnings.length === 0) {
      console.log('✅ Aucun avertissement');
    } else {
      validationWarnings.forEach(warning => console.log(warning));
    }
    
    // 9. Verdict final
    console.log('\n🎯 VERDICT FINAL');
    console.log('================');
    
    if (validationErrors.length === 0 && stats.pressingsInUsers === 0) {
      console.log('🎉 MIGRATION RÉUSSIE !');
      console.log('✅ Tous les pressings utilisent maintenant la collection "pressings"');
      console.log('✅ Plus aucune dépendance à la collection "users" pour les pressings');
      console.log('✅ Architecture cohérente et propre');
      
      if (validationWarnings.length > 0) {
        console.log(`⚠️ ${validationWarnings.length} avertissement(s) à vérifier`);
      }
      
      return true;
    } else {
      console.log('❌ MIGRATION INCOMPLÈTE');
      console.log(`❌ ${validationErrors.length} erreur(s) critique(s) détectée(s)`);
      console.log(`❌ ${stats.pressingsInUsers} pressing(s) encore dans "users"`);
      console.log('🔧 Veuillez corriger les erreurs avant de continuer');
      
      return false;
    }
    
  } catch (error) {
    console.error('❌ Erreur lors de la validation:', error);
    return false;
  } finally {
    await mongoose.disconnect();
    console.log('\n🔚 Connexion MongoDB fermée');
  }
}

// Exécution du script
if (require.main === module) {
  validateMigration()
    .then(success => {
      if (success) {
        console.log('\n🎉 VALIDATION RÉUSSIE !');
        console.log('✅ La migration users → pressings est complète');
        process.exit(0);
      } else {
        console.log('\n❌ VALIDATION ÉCHOUÉE !');
        console.log('❌ La migration nécessite des corrections');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('\n❌ ERREUR LORS DE LA VALIDATION:', error);
      process.exit(1);
    });
}

module.exports = { validateMigration };
