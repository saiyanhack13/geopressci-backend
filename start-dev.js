const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Démarrage du serveur GeoPressCI Backend...');
console.log('📍 Port configuré: 5002 (pour correspondre au frontend)');
console.log('🔑 Assurez-vous que les variables d\'environnement sont configurées dans .env');

// Définir les variables d'environnement par défaut
const env = {
  ...process.env,
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: '5002', // Port configuré pour correspondre au frontend
  FRONTEND_URL: process.env.FRONTEND_URL || 'https://geopressci.netlify.app',
  JWT_SECRET: process.env.JWT_SECRET || 'your-super-secret-jwt-key-minimum-32-characters',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/geopressci',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info'
};

// Vérifier les variables critiques
if (!process.env.MAPBOX_ACCESS_TOKEN) {
  console.warn('⚠️  MAPBOX_ACCESS_TOKEN non définie - les fonctionnalités de géolocalisation ne fonctionneront pas');
  console.warn('   Ajoutez MAPBOX_ACCESS_TOKEN=votre-token-mapbox dans le fichier .env');
  console.warn('   Token fourni: pk.eyJ1IjoiZG9sa28xMyIsImEiOiJjbWUzOTVnc2wwNTVsMmxzZTF1Zm13ZWVjIn0.o48XqkHK-s4jF4qLzLKRQ');
} else {
  console.log('✅ Mapbox configuré pour la géolocalisation');
}

// Google Maps deprecated
if (!env.GOOGLE_MAPS_API_KEY) {
  console.warn('ℹ️  GOOGLE_MAPS_API_KEY non définie (deprecated - Mapbox utilisé à la place)');
}

if (!env.JWT_SECRET || env.JWT_SECRET === 'your-super-secret-jwt-key-minimum-32-characters') {
  console.warn('⚠️  JWT_SECRET non définie ou utilise la valeur par défaut');
  console.warn('   Ajoutez JWT_SECRET=votre-secret-jwt dans le fichier .env');
}

// Démarrer le serveur
const server = spawn('node', ['src/app.js'], {
  env,
  stdio: 'inherit',
  cwd: __dirname
});

server.on('error', (err) => {
  console.error('❌ Erreur lors du démarrage du serveur:', err);
});

server.on('close', (code) => {
  console.log(`🔴 Serveur arrêté avec le code ${code}`);
});

// Gestion propre de l'arrêt
process.on('SIGINT', () => {
  console.log('\n🛑 Arrêt du serveur...');
  server.kill('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Arrêt du serveur...');
  server.kill('SIGTERM');
  process.exit(0);
});
