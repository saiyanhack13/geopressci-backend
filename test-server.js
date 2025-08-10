#!/usr/bin/env node

/**
 * Serveur minimal pour tester les routes de promotions
 */

const express = require('express');
const cors = require('cors');

// Configuration minimale
const app = express();
const PORT = 5003;

// Middleware basique
app.use(cors());
app.use(express.json());

// Middleware d'authentification simulé
const mockAuth = (req, res, next) => {
  // Simuler un utilisateur pressing connecté
  req.user = {
    id: '507f1f77bcf86cd799439011',
    role: 'pressing',
    businessName: 'Test Pressing'
  };
  next();
};

// Route de test simple
app.get('/', (req, res) => {
  res.json({ 
    message: 'Serveur de test GeoPressCI',
    status: 'online',
    timestamp: new Date().toISOString()
  });
});

// Route de test pour les promotions (simulation)
app.get('/api/v1/pressings/promotions', mockAuth, (req, res) => {
  console.log('📝 Test route promotions - User:', req.user.id);
  
  res.json({
    success: true,
    data: [
      {
        _id: '507f1f77bcf86cd799439012',
        title: 'Promotion Test',
        description: 'Promotion de test',
        type: 'percentage',
        value: 20,
        status: 'active',
        createdBy: req.user.id,
        createdAt: new Date().toISOString()
      }
    ],
    pagination: {
      page: 1,
      limit: 12,
      total: 1,
      pages: 1
    },
    count: 1
  });
});

// Route de test pour créer une promotion
app.post('/api/v1/pressings/promotions', mockAuth, (req, res) => {
  console.log('📝 Test create promotion - User:', req.user.id);
  console.log('📝 Data:', req.body);
  
  res.status(201).json({
    success: true,
    data: {
      _id: '507f1f77bcf86cd799439013',
      ...req.body,
      createdBy: req.user.id,
      createdAt: new Date().toISOString()
    },
    message: 'Promotion créée avec succès'
  });
});

// Démarrer le serveur
const server = app.listen(PORT, () => {
  console.log(`✅ Serveur de test démarré sur le port ${PORT}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`🎯 Test promotions: http://localhost:${PORT}/api/v1/pressings/promotions`);
  console.log('📝 Appuyez sur Ctrl+C pour arrêter');
});

// Gestion des erreurs
server.on('error', (error) => {
  console.error('❌ Erreur serveur:', error.message);
  process.exit(1);
});

// Gestion de l'arrêt propre
process.on('SIGINT', () => {
  console.log('\n👋 Arrêt du serveur...');
  server.close(() => {
    console.log('✅ Serveur arrêté');
    process.exit(0);
  });
});

console.log('🚀 Serveur de test prêt !');
