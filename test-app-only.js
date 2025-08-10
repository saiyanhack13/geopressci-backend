#!/usr/bin/env node

/**
 * Test minimal pour charger uniquement l'app sans démarrer le serveur
 */

console.log('🧪 Test de chargement de l\'app...');

try {
  // Charger les variables d'environnement
  require('dotenv').config();
  console.log('✅ Variables d\'environnement chargées');
  
  // Charger l'app
  console.log('📝 Chargement de l\'app...');
  const app = require('./src/app.js');
  console.log('✅ App chargée avec succès !');
  
  // Vérifier que c'est bien une app Express
  console.log('📊 Type de l\'app:', typeof app);
  console.log('📊 Est-ce une fonction ?', typeof app === 'function');
  
  // Essayer de démarrer le serveur
  console.log('🚀 Tentative de démarrage du serveur...');
  const server = app.listen(5004, () => {
    console.log('✅ Serveur démarré sur le port 5004');
    console.log('🌐 URL: http://localhost:5004');
    
    // Arrêter le serveur après 5 secondes
    setTimeout(() => {
      console.log('⏰ Arrêt automatique du serveur...');
      server.close(() => {
        console.log('✅ Serveur arrêté');
        process.exit(0);
      });
    }, 5000);
  });
  
  server.on('error', (error) => {
    console.error('❌ Erreur serveur:', error.message);
    process.exit(1);
  });
  
} catch (error) {
  console.error('❌ Erreur lors du test:', error.message);
  console.error('📍 Stack trace:');
  console.error(error.stack);
  process.exit(1);
}
