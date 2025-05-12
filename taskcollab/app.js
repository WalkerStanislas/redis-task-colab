const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const http = require('http');
const { Server } = require('socket.io');
const { subClient } = require('./config/redis');
require('dotenv').config();

// Importer les routes
const taskRoutes = require('./routes/tasks');

// Initialiser l'application Express
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Configurer le moteur de template EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/', taskRoutes);

// Configurer Socket.IO pour les notifications en temps réel
io.on('connection', (socket) => {
  console.log('Nouvelle connexion Socket.IO:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Déconnexion Socket.IO:', socket.id);
  });
});

// S'abonner aux événements Redis pour les diffuser via Socket.IO
(async () => {
  await subClient.subscribe('task-updates', (message) => {
    try {
      const data = JSON.parse(message);
      // Émettre l'événement vers tous les clients connectés
      io.emit('task-update', data);
      console.log(`Événement publié: ${data.type}`);
    } catch (error) {
      console.error('Erreur lors du traitement du message Redis:', error);
    }
  });
  
  console.log('Abonnement aux événements Redis actif');
})();

// Démarrer le serveur
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});