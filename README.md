# Geopressci Backend

Ce dépôt contient le backend de l'application Geopressci, construit avec Node.js et Express.

## Prérequis

- Node.js (version 18 ou supérieure)
- npm (version 6 ou supérieure) ou Yarn
- MongoDB (version 4.4 ou supérieure)

## Installation

1. Cloner le dépôt :
   ```bash
   git clone <url-du-dépôt>
   cd backend
   ```

2. Installer les dépendances :
   ```bash
   npm install
   ```

3. Configurer les variables d'environnement :
   Créez un fichier `.env` à la racine du projet avec les variables nécessaires.

4. Démarrer le serveur en mode développement :
   ```bash
   npm run dev
   ```

## Variables d'environnement

Créez un fichier `.env` à la racine du projet avec les variables suivantes :

```
PORT=5002
MONGODB_URI=mongodb://localhost:27017/geopressci
JWT_SECRET=votre_clé_secrète_jwt
NODE_ENV=development
```

## Démarrage en production

Pour démarrer le serveur en production :

```bash
npm start
```

## Déploiement avec Docker

1. Construire l'image Docker :
   ```bash
   docker build -t geopressci-backend .
   ```

2. Exécuter le conteneur :
   ```bash
   docker run -p 5000:5000 --env-file .env geopressci-backend
   ```

## API Documentation

La documentation de l'API est disponible à l'adresse `/api-docs` lorsque le serveur est en cours d'exécution.

## Tests

Pour exécuter les tests :

```bash
npm test
```

## Licence

[À spécifier]
