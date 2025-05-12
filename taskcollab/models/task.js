const { redisClient, getOrSetCache, pubClient } = require('../config/redis');
const { v4: uuidv4 } = require('uuid');

// Préfixes des clés Redis
const TASK_PREFIX = 'task:';
const TASK_LIST_KEY = 'tasks';
const USER_TASKS_PREFIX = 'user:tasks:';

class Task {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.title = data.title;
    this.description = data.description || '';
    this.status = data.status || 'pending'; // pending, in-progress, completed
    this.assignedTo = data.assignedTo || null;
    this.createdAt = data.createdAt || Date.now();
    this.updatedAt = data.updatedAt || Date.now();
  }

  // Sauvegarder une tâche
  async save() {
    try {
      // Stockage de la tâche comme un hash Redis
      const taskKey = TASK_PREFIX + this.id;
      
      await redisClient.hSet(taskKey, {
        id: this.id,
        title: this.title,
        description: this.description,
        status: this.status,
        assignedTo: this.assignedTo || '',
        createdAt: this.createdAt.toString(),
        updatedAt: Date.now().toString()
      });
      
      // Ajouter l'ID à la liste des tâches
      await redisClient.sAdd(TASK_LIST_KEY, this.id);
      
      // Si assignée à un utilisateur, ajouter à sa liste de tâches
      if (this.assignedTo) {
        await redisClient.sAdd(USER_TASKS_PREFIX + this.assignedTo, this.id);
      }
      
      // Publier un événement de mise à jour
      await pubClient.publish('task-updates', JSON.stringify({
        type: 'task-created',
        taskId: this.id,
        task: this
      }));
      
      // Invalider les caches potentiels
      await redisClient.del(`cache:tasks:all`);
      if (this.assignedTo) {
        await redisClient.del(`cache:tasks:user:${this.assignedTo}`);
      }
      
      return this;
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de la tâche:', error);
      throw error;
    }
  }

  // Mettre à jour une tâche
  async update(data) {
    try {
      const oldTask = { ...this };
      
      // Mettre à jour les propriétés
      Object.keys(data).forEach(key => {
        if (this.hasOwnProperty(key) && key !== 'id') {
          this[key] = data[key];
        }
      });
      
      this.updatedAt = Date.now();
      
      // Sauvegarder les modifications
      const taskKey = TASK_PREFIX + this.id;
      
      await redisClient.hSet(taskKey, {
        id: this.id,
        title: this.title,
        description: this.description,
        status: this.status,
        assignedTo: this.assignedTo || '',
        createdAt: this.createdAt.toString(),
        updatedAt: this.updatedAt.toString()
      });
      
      // Gérer les changements d'assignation
      if (oldTask.assignedTo !== this.assignedTo) {
        // Supprimer de l'ancienne liste d'utilisateur
        if (oldTask.assignedTo) {
          await redisClient.sRem(USER_TASKS_PREFIX + oldTask.assignedTo, this.id);
          await redisClient.del(`cache:tasks:user:${oldTask.assignedTo}`);
        }
        
        // Ajouter à la nouvelle liste d'utilisateur
        if (this.assignedTo) {
          await redisClient.sAdd(USER_TASKS_PREFIX + this.assignedTo, this.id);
          await redisClient.del(`cache:tasks:user:${this.assignedTo}`);
        }
      }
      
      // Publier un événement de mise à jour
      await pubClient.publish('task-updates', JSON.stringify({
        type: 'task-updated',
        taskId: this.id,
        task: this,
        changes: {
          from: oldTask,
          to: this
        }
      }));
      
      // Invalider le cache
      await redisClient.del(`cache:tasks:all`);
      await redisClient.del(`cache:task:${this.id}`);
      
      return this;
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la tâche:', error);
      throw error;
    }
  }

  // Supprimer une tâche
  async delete() {
    try {
      const taskKey = TASK_PREFIX + this.id;
      
      // Supprimer la tâche
      await redisClient.del(taskKey);
      
      // Supprimer de la liste principale
      await redisClient.sRem(TASK_LIST_KEY, this.id);
      
      // Si assignée à un utilisateur, supprimer de sa liste
      if (this.assignedTo) {
        await redisClient.sRem(USER_TASKS_PREFIX + this.assignedTo, this.id);
        await redisClient.del(`cache:tasks:user:${this.assignedTo}`);
      }
      
      // Publier un événement de suppression
      await pubClient.publish('task-updates', JSON.stringify({
        type: 'task-deleted',
        taskId: this.id
      }));
      
      // Invalider les caches
      await redisClient.del(`cache:tasks:all`);
      await redisClient.del(`cache:task:${this.id}`);
      
      return true;
    } catch (error) {
      console.error('Erreur lors de la suppression de la tâche:', error);
      throw error;
    }
  }

  // Récupérer une tâche par ID (avec cache)
  static async findById(id) {
    return getOrSetCache(`cache:task:${id}`, async () => {
      try {
        const taskKey = TASK_PREFIX + id;
        const taskData = await redisClient.hGetAll(taskKey);
        
        if (!taskData || Object.keys(taskData).length === 0) {
          return null;
        }
        
        // Convertir les champs numériques
        if (taskData.createdAt) taskData.createdAt = parseInt(taskData.createdAt);
        if (taskData.updatedAt) taskData.updatedAt = parseInt(taskData.updatedAt);
        
        return new Task(taskData);
      } catch (error) {
        console.error('Erreur lors de la récupération de la tâche:', error);
        throw error;
      }
    });
  }

  // Récupérer toutes les tâches (avec cache)
  static async findAll() {
    return getOrSetCache('cache:tasks:all', async () => {
      try {
        // Récupérer tous les IDs de tâches
        const taskIds = await redisClient.sMembers(TASK_LIST_KEY);
        
        // Récupérer chaque tâche (sans passer par le cache individuel ici)
        const tasks = await Promise.all(
          taskIds.map(async (id) => {
            const taskKey = TASK_PREFIX + id;
            const taskData = await redisClient.hGetAll(taskKey);
            
            // Convertir les champs numériques
            if (taskData.createdAt) taskData.createdAt = parseInt(taskData.createdAt);
            if (taskData.updatedAt) taskData.updatedAt = parseInt(taskData.updatedAt);
            
            return new Task(taskData);
          })
        );
        
        return tasks;
      } catch (error) {
        console.error('Erreur lors de la récupération des tâches:', error);
        throw error;
      }
    });
  }

  // Récupérer les tâches d'un utilisateur (avec cache)
  static async findByUser(userId) {
    return getOrSetCache(`cache:tasks:user:${userId}`, async () => {
      try {
        // Récupérer les IDs des tâches de l'utilisateur
        const taskIds = await redisClient.sMembers(USER_TASKS_PREFIX + userId);
        
        // Récupérer chaque tâche
        const tasks = await Promise.all(
          taskIds.map(async (id) => {
            const taskKey = TASK_PREFIX + id;
            const taskData = await redisClient.hGetAll(taskKey);
            
            // Convertir les champs numériques
            if (taskData.createdAt) taskData.createdAt = parseInt(taskData.createdAt);
            if (taskData.updatedAt) taskData.updatedAt = parseInt(taskData.updatedAt);
            
            return new Task(taskData);
          })
        );
        
        return tasks;
      } catch (error) {
        console.error('Erreur lors de la récupération des tâches de l\'utilisateur:', error);
        throw error;
      }
    });
  }
}

module.exports = Task;