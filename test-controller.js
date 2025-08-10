#!/usr/bin/env node

/**
 * Test simple pour vérifier que le contrôleur pressing se charge correctement
 */

console.log('🧪 Test du contrôleur pressing...');

try {
  // Charger la configuration
  console.log('📝 Chargement de la configuration...');
  require('dotenv').config();
  
  // Charger le contrôleur
  console.log('📝 Chargement du contrôleur pressing...');
  const pressingController = require('./src/controllers/pressing.controller.js');
  
  console.log('✅ Contrôleur chargé avec succès !');
  console.log('📊 Fonctions disponibles:');
  
  const functions = Object.keys(pressingController);
  functions.forEach((fn, index) => {
    console.log(`  ${index + 1}. ${fn}`);
  });
  
  console.log(`\n🎯 Total: ${functions.length} fonctions`);
  
  // Vérifier les fonctions de promotion
  const promotionFunctions = functions.filter(fn => fn.includes('Promotion'));
  console.log(`\n🎉 Fonctions de promotion: ${promotionFunctions.length}`);
  promotionFunctions.forEach((fn, index) => {
    console.log(`  ${index + 1}. ${fn}`);
  });
  
  if (promotionFunctions.length === 5) {
    console.log('\n✅ Toutes les fonctions de promotion sont présentes !');
  } else {
    console.log('\n❌ Il manque des fonctions de promotion');
  }
  
} catch (error) {
  console.error('❌ Erreur lors du test:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}

console.log('\n🎊 Test terminé avec succès !');
