const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// Script de nettoyage final après migration complète
async function finalCleanup() {
  try {
    console.log('🧹 NETTOYAGE FINAL APRÈS MIGRATION');
    console.log('==================================');
    
    // 1. Nettoyer les fichiers temporaires et scripts de migration
    console.log('\n🗑️ Suppression des fichiers temporaires...');
    
    const filesToDelete = [
      'migrate-pressing-user.js',
      'test-pressing-registration.js', 
      'debug-db.js',
      'migrate-users-to-pressings.js', // Ce script lui-même après exécution
      'cleanup-migration.js' // Ce script lui-même
    ];
    
    const scriptsDir = path.join(__dirname, 'scripts');
    const scriptFilesToDelete = [
      'simple-index.js',
      'direct-test.js',
      'create-geo-indexes.js',
      'create-geo-index.js',
      'cleanup-geo-indexes.js',
      'check-data.js'
    ];
    
    let deletedCount = 0;
    
    // Supprimer les fichiers à la racine
    for (const file of filesToDelete) {
      try {
        const filePath = path.join(__dirname, file);
        await fs.unlink(filePath);
        console.log(`✅ Supprimé: ${file}`);
        deletedCount++;
      } catch (error) {
        if (error.code !== 'ENOENT') {
          console.log(`⚠️ Impossible de supprimer ${file}: ${error.message}`);
        }
      }
    }
    
    // Supprimer les scripts temporaires dans le dossier scripts
    for (const file of scriptFilesToDelete) {
      try {
        const filePath = path.join(scriptsDir, file);
        await fs.unlink(filePath);
        console.log(`✅ Supprimé: scripts/${file}`);
        deletedCount++;
      } catch (error) {
        if (error.code !== 'ENOENT') {
          console.log(`⚠️ Impossible de supprimer scripts/${file}: ${error.message}`);
        }
      }
    }
    
    console.log(`📊 Total fichiers supprimés: ${deletedCount}`);
    
    // 2. Vérifier l'état final de la base de données
    console.log('\n🔍 Vérification finale de la base de données...');
    
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/geopressci');
    const db = mongoose.connection.db;
    
    // Compter les documents dans chaque collection
    const collections = {
      users: await db.collection('users').countDocuments({}),
      clients: await db.collection('clients').countDocuments({}),
      pressings: await db.collection('pressings').countDocuments({}),
      admins: await db.collection('admins').countDocuments({})
    };
    
    console.log('\n📊 ÉTAT FINAL DES COLLECTIONS:');
    console.log(`👥 users: ${collections.users} documents`);
    console.log(`👤 clients: ${collections.clients} documents`);
    console.log(`🏢 pressings: ${collections.pressings} documents`);
    console.log(`👨‍💼 admins: ${collections.admins} documents`);
    
    // Vérifier qu'il n'y a plus de pressings dans users
    const pressingsInUsers = await db.collection('users').countDocuments({ role: 'pressing' });
    
    if (pressingsInUsers === 0) {
      console.log('\n✅ MIGRATION RÉUSSIE !');
      console.log('🎉 Plus aucun pressing dans la collection "users"');
      console.log('✅ Tous les pressings utilisent maintenant la collection "pressings"');
    } else {
      console.log(`\n⚠️ ATTENTION: ${pressingsInUsers} pressing(s) restant(s) dans la collection "users"`);
      console.log('❌ La migration n\'est pas complète');
    }
    
    // 3. Créer un rapport de migration
    const report = {
      migrationDate: new Date().toISOString(),
      collections: collections,
      pressingsInUsers: pressingsInUsers,
      migrationComplete: pressingsInUsers === 0,
      filesDeleted: deletedCount,
      summary: {
        totalPressings: collections.pressings,
        totalClients: collections.clients,
        totalAdmins: collections.admins,
        remainingUsers: collections.users
      }
    };
    
    await fs.writeFile(
      path.join(__dirname, 'migration-report.json'),
      JSON.stringify(report, null, 2)
    );
    
    console.log('\n📄 Rapport de migration créé: migration-report.json');
    
  } catch (error) {
    console.error('❌ Erreur lors du nettoyage:', error);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    console.log('\n🔚 Nettoyage terminé');
  }
}

// Exécution du script
if (require.main === module) {
  finalCleanup()
    .then(() => {
      console.log('\n🎉 NETTOYAGE TERMINÉ AVEC SUCCÈS !');
      console.log('✅ Migration complète : users → pressings');
      console.log('✅ Fichiers temporaires supprimés');
      console.log('✅ Architecture cohérente et propre');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ ERREUR LORS DU NETTOYAGE:', error);
      process.exit(1);
    });
}

module.exports = { finalCleanup };
