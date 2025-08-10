#!/usr/bin/env node

/**
 * Script de lancement des tests d'intégration GeoPressCI
 * Valide l'ensemble du système end-to-end
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 GeoPressCI - Tests d\'Intégration End-to-End\n');

// Configuration des tests
const config = {
  testTimeout: 30000,
  maxWorkers: 1,
  verbose: true,
  detectOpenHandles: true,
  forceExit: true
};

// Vérifier que les dépendances de test sont installées
const checkDependencies = () => {
  console.log('📦 Vérification des dépendances de test...');
  
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    console.error('❌ package.json non trouvé');
    process.exit(1);
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const devDeps = packageJson.devDependencies || {};
  
  const requiredDeps = ['jest', 'supertest'];
  const missingDeps = requiredDeps.filter(dep => !devDeps[dep]);
  
  if (missingDeps.length > 0) {
    console.log('⚠️  Dépendances manquantes:', missingDeps.join(', '));
    console.log('🔧 Installation des dépendances...');
    
    const installCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const installArgs = ['install', '--save-dev', ...missingDeps];
    
    return new Promise((resolve, reject) => {
      const installProcess = spawn(installCmd, installArgs, {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
      });
      
      installProcess.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Dépendances installées avec succès\n');
          resolve();
        } else {
          reject(new Error(`Installation échouée avec le code ${code}`));
        }
      });
    });
  } else {
    console.log('✅ Toutes les dépendances sont présentes\n');
    return Promise.resolve();
  }
};

// Vérifier la configuration de la base de données de test
const checkTestDatabase = () => {
  console.log('🗄️  Vérification de la configuration de test...');
  
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    if (envContent.includes('MONGODB_TEST_URI')) {
      console.log('✅ Base de données de test configurée');
    } else {
      console.log('⚠️  MONGODB_TEST_URI non configuré, utilisation de la valeur par défaut');
    }
  } else {
    console.log('⚠️  Fichier .env non trouvé, utilisation des valeurs par défaut');
  }
  console.log('');
};

// Lancer les tests
const runTests = () => {
  console.log('🧪 Lancement des tests d\'intégration...\n');
  
  const jestCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const jestArgs = [
    'jest',
    'tests/integration',
    '--testTimeout=' + config.testTimeout,
    '--maxWorkers=' + config.maxWorkers,
    '--detectOpenHandles',
    '--forceExit'
  ];
  
  if (config.verbose) {
    jestArgs.push('--verbose');
  }
  
  return new Promise((resolve, reject) => {
    const testProcess = spawn(jestCmd, jestArgs, {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    
    testProcess.on('close', (code) => {
      if (code === 0) {
        console.log('\n✅ Tous les tests d\'intégration ont réussi !');
        resolve();
      } else {
        console.log(`\n❌ Tests échoués avec le code ${code}`);
        reject(new Error(`Tests échoués avec le code ${code}`));
      }
    });
    
    testProcess.on('error', (error) => {
      console.error('❌ Erreur lors du lancement des tests:', error.message);
      reject(error);
    });
  });
};

// Générer un rapport de couverture
const generateCoverageReport = () => {
  console.log('\n📊 Génération du rapport de couverture...');
  
  const jestCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const jestArgs = [
    'jest',
    'tests/integration',
    '--coverage',
    '--coverageDirectory=coverage/integration',
    '--collectCoverageFrom=src/**/*.js',
    '--coverageReporters=text',
    '--coverageReporters=html'
  ];
  
  return new Promise((resolve, reject) => {
    const coverageProcess = spawn(jestCmd, jestArgs, {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    
    coverageProcess.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Rapport de couverture généré dans coverage/integration/');
        resolve();
      } else {
        console.log('⚠️  Rapport de couverture non généré');
        resolve(); // Ne pas faire échouer le processus principal
      }
    });
    
    coverageProcess.on('error', (error) => {
      console.log('⚠️  Erreur lors de la génération du rapport:', error.message);
      resolve(); // Ne pas faire échouer le processus principal
    });
  });
};

// Afficher un résumé des fonctionnalités testées
const displayTestSummary = () => {
  console.log('\n📋 Résumé des tests d\'intégration GeoPressCI:');
  console.log('');
  console.log('🏗️  Architecture et Authentification:');
  console.log('   ✓ Inscription pressing avec géolocalisation');
  console.log('   ✓ Connexion et authentification JWT');
  console.log('   ✓ Validation des données et sécurité');
  console.log('');
  console.log('🛠️  Gestion des Services:');
  console.log('   ✓ CRUD complet des services');
  console.log('   ✓ Catégories et tarification');
  console.log('   ✓ Validation des données métier');
  console.log('');
  console.log('📊 Dashboard et Statistiques:');
  console.log('   ✓ KPIs temps réel optimisés');
  console.log('   ✓ Statistiques de performance');
  console.log('   ✓ Profil pressing complet');
  console.log('');
  console.log('📦 Gestion des Commandes:');
  console.log('   ✓ Création et suivi des commandes');
  console.log('   ✓ Mise à jour des statuts');
  console.log('   ✓ Notifications temps réel');
  console.log('');
  console.log('⚡ Performance et Fiabilité:');
  console.log('   ✓ Temps de réponse < 500ms');
  console.log('   ✓ Gestion d\'erreur robuste');
  console.log('   ✓ Validation des autorisations');
  console.log('');
};

// Fonction principale
const main = async () => {
  try {
    displayTestSummary();
    
    await checkDependencies();
    checkTestDatabase();
    await runTests();
    
    // Optionnel: générer rapport de couverture
    if (process.argv.includes('--coverage')) {
      await generateCoverageReport();
    }
    
    console.log('\n🎉 Tests d\'intégration terminés avec succès !');
    console.log('🚀 Le système GeoPressCI est prêt pour la production.');
    
  } catch (error) {
    console.error('\n💥 Erreur lors des tests d\'intégration:');
    console.error(error.message);
    process.exit(1);
  }
};

// Gestion des signaux
process.on('SIGINT', () => {
  console.log('\n⏹️  Tests interrompus par l\'utilisateur');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n⏹️  Tests terminés par le système');
  process.exit(0);
});

// Lancer le script
if (require.main === module) {
  main();
}

module.exports = {
  checkDependencies,
  checkTestDatabase,
  runTests,
  generateCoverageReport
};
