const fs = require('fs');
const path = require('path');

// Script pour harmoniser la nomenclature commande -> order
const files = [
  './src/controllers/order.controller.js',
  './src/routes/order.routes.js',
  './src/app.js'
];

const replacements = [
  // Fonctions
  { from: /getCommandes/g, to: 'getOrders' },
  { from: /getCommande/g, to: 'getOrder' },
  { from: /createCommande/g, to: 'createOrder' },
  { from: /updateCommandeStatut/g, to: 'updateOrderStatus' },
  { from: /annulerCommande/g, to: 'cancelOrder' },
  { from: /noterCommande/g, to: 'reviewOrder' },
  
  // Variables et objets
  { from: /const commande/g, to: 'const order' },
  { from: /let commande/g, to: 'let order' },
  { from: /commande\./g, to: 'order.' },
  { from: /commande\[/g, to: 'order[' },
  { from: /commande,/g, to: 'order,' },
  { from: /commande\)/g, to: 'order)' },
  { from: /commande;/g, to: 'order;' },
  
  // Routes et URLs
  { from: /\/commandes/g, to: '/orders' },
  { from: /commandes\//g, to: 'orders/' },
  
  // Tags Swagger
  { from: /\[Commandes\]/g, to: '[Orders]' },
  { from: /tags: \[Commandes\]/g, to: 'tags: [Orders]' },
  
  // Modèles et références
  { from: /commandeController/g, to: 'orderController' },
  { from: /commande\.routes/g, to: 'order.routes' },
  { from: /commande\.controller/g, to: 'order.controller' },
  
  // Commentaires et descriptions (garder le français pour l'UX)
  // On ne remplace pas les textes utilisateur en français
];

files.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    console.log(`Processing ${filePath}...`);
    let content = fs.readFileSync(filePath, 'utf8');
    
    replacements.forEach(({ from, to }) => {
      content = content.replace(from, to);
    });
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✓ ${filePath} updated`);
  } else {
    console.log(`⚠ ${filePath} not found`);
  }
});

console.log('Harmonization complete!');
