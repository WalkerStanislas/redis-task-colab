const express = require('express');
const router = express.Router();
const Task = require('../models/task');
const { subClient } = require('../config/redis');

// Liste de tous les utilisateurs (pour la démonstration)
const users = [
  { id: 'user1', name: 'Alice' },
  { id: 'user2', name: 'Bob' },
  { id: 'user3', name: 'Charlie' }
];

// Middleware pour les statistiques de performance
const performanceMiddleware = (req, res, next) => {
  const start = Date.now();
  
  // Une fois la réponse terminée
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} - ${duration}ms`);
  });
  
  next();
};

// Appliquer le middleware à toutes les routes
router.use(performanceMiddleware);

// GET / - Page d'accueil avec liste des tâches
router.get('/', async (req, res) => {
  try {
    const tasks = await Task.findAll();
    res.render('index', { tasks, users });
  } catch (error) {
    console.error('Erreur lors de la récupération des tâches:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /tasks - API pour récupérer toutes les tâches
router.get('/tasks', async (req, res) => {
  try {
    const tasks = await Task.findAll();
    res.json(tasks);
  } catch (error) {
    console.error('Erreur lors de la récupération des tâches:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /tasks/:id - API pour récupérer une tâche par ID
router.get('/tasks/:id', async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({ error: 'Tâche non trouvée' });
    }
    
    res.json(task);
  } catch (error) {
    console.error('Erreur lors de la récupération de la tâche:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /tasks/user/:userId - API pour récupérer les tâches d'un utilisateur
router.get('/tasks/user/:userId', async (req, res) => {
  try {
    const tasks = await Task.findByUser(req.params.userId);
    res.json(tasks);
  } catch (error) {
    console.error('Erreur lors de la récupération des tâches de l\'utilisateur:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /tasks - API pour créer une nouvelle tâche
router.post('/tasks', async (req, res) => {
  try {
    const { title, description, assignedTo } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'Le titre est requis' });
    }
    
    const task = new Task({
      title,
      description,
      assignedTo,
      status: 'pending'
    });
    
    await task.save();
    
    res.status(201).json(task);
  } catch (error) {
    console.error('Erreur lors de la création de la tâche:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /tasks/:id - API pour mettre à jour une tâche
router.put('/tasks/:id', async (req, res) => {
  try {
    const { title, description, status, assignedTo } = req.body;
    const task = await Task.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({ error: 'Tâche non trouvée' });
    }
    
    // Mise à jour des champs
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
    
    // Appliquer les modifications
    await task.update(updateData);
    
    res.json(task);
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la tâche:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /tasks/:id - API pour supprimer une tâche
router.delete('/tasks/:id', async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({ error: 'Tâche non trouvée' });
    }
    
    await task.delete();
    
    res.status(204).end();
  } catch (error) {
    console.error('Erreur lors de la suppression de la tâche:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;