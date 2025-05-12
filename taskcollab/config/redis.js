const redis = require('redis');
require('dotenv').config();

// Configuration principale de Redis
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

// Gestion des erreurs de connexion
redisClient.on('error', (err) => {
  console.error('Erreur de connexion Redis:', err);
});

// Connexion au serveur Redis
(async () => {
  await redisClient.connect();
  console.log('Connecté à Redis');
})();

// Configuration du cache
const DEFAULT_EXPIRATION = 3600; // 1 heure en secondes

// Fonctions utilitaires pour le cache
async function getOrSetCache(key, cb) {
  try {
    // Tentative de récupération depuis le cache
    const cachedData = await redisClient.get(key);
    
    if (cachedData != null) {
      console.log(`Cache hit pour ${key}`);
      return JSON.parse(cachedData);
    } else {
      console.log(`Cache miss pour ${key}`);
      // Si pas en cache, exécuter le callback
      const freshData = await cb();
      // Stocker en cache pour les futures requêtes
      await redisClient.setEx(key, DEFAULT_EXPIRATION, JSON.stringify(freshData));
      return freshData;
    }
  } catch (error) {
    console.error(`Erreur cache pour ${key}:`, error);
    // En cas d'erreur, exécuter le callback sans utiliser le cache
    return await cb();
  }
}

// Client Redis séparé pour le pub/sub
const pubClient = redisClient.duplicate();
const subClient = redisClient.duplicate();

(async () => {
  await pubClient.connect();
  await subClient.connect();
  console.log('Clients pub/sub connectés');
})();

module.exports = {
  redisClient,
  getOrSetCache,
  pubClient,
  subClient,
  DEFAULT_EXPIRATION
};