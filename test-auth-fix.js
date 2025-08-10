#!/usr/bin/env node

/**
 * Script de test pour vérifier les corrections d'authentification
 * Teste les nouvelles fonctionnalités du middleware d'authentification
 */

const { authorize } = require('./src/middleware/auth.middleware');

// Simuler une requête avec un utilisateur pressing
const mockRequest = {
  user: {
    _id: '6890e189d07ac264082a7fe0',
    email: 'test@pressing.com',
    role: 'pressing', // Rôle normalisé en minuscules
    type: 'pressing',
    constructor: { modelName: 'Pressing' }
  }
};

const mockResponse = {
  status: (code) => ({
    json: (data) => {
      console.log(`❌ Réponse ${code}:`, data);
      return data;
    }
  })
};

const mockNext = () => {
  console.log('✅ Autorisation accordée - next() appelé');
};

console.log('🧪 Test des corrections d\'authentification\n');

// Test 1: Autorisation avec paramètres séparés (ancienne syntaxe)
console.log('📝 Test 1: authorize("pressing", "admin")');
const middleware1 = authorize('pressing', 'admin');
middleware1(mockRequest, mockResponse, mockNext);

console.log('\n📝 Test 2: authorize(["pressing", "admin"]) - nouvelle syntaxe avec tableau');
const middleware2 = authorize(['pressing', 'admin']);
middleware2(mockRequest, mockResponse, mockNext);

console.log('\n📝 Test 3: authorize("admin") - rôle non autorisé');
const middleware3 = authorize('admin');
middleware3(mockRequest, mockResponse, mockNext);

console.log('\n📝 Test 4: authorize(["admin", "super_admin"]) - rôles non autorisés');
const middleware4 = authorize(['admin', 'super_admin']);
middleware4(mockRequest, mockResponse, mockNext);

console.log('\n🎯 Tests terminés');
