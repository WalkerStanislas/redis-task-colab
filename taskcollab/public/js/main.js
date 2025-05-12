document.addEventListener('DOMContentLoaded', () => {
    // Connexion Socket.IO
    const socket = io();
    
    // Éléments du DOM
    const taskList = document.getElementById('task-list');
    const newTaskForm = document.getElementById('new-task-form');
    const updateTaskForm = document.getElementById('update-task-form');
    const modal = document.getElementById('update-modal');
    const closeModal = document.querySelector('.close');
    const filterUser = document.getElementById('filter-user');
    const filterStatus = document.getElementById('filter-status');
    const notificationArea = document.getElementById('notification-area');
    
    // Cache pour les tâches
    let tasksCache = [];
    
    // Fonctions utilitaires
    
    // Afficher une notification
    function showNotification(message, type = 'info') {
      const notification = document.createElement('div');
      notification.className = `notification ${type}`;
      notification.textContent = message;
      
      notificationArea.appendChild(notification);
      
      // Supprimer la notification après 5 secondes
      setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
          notification.remove();
        }, 300);
      }, 5000);
    }
    
    // Formater le statut
    function formatStatus(status) {
      switch(status) {
        case 'pending': return 'En attente';
        case 'in-progress': return 'En cours';
        case 'completed': return 'Terminée';
        default: return status;
      }
    }
    
    // Trouver le nom d'utilisateur par ID
    function getUserName(userId) {
      const users = [
        { id: 'user1', name: 'Alice' },
        { id: 'user2', name: 'Bob' },
        { id: 'user3', name: 'Charlie' }
      ];
      
      const user = users.find(u => u.id === userId);
      return user ? user.name : 'Non assignée';
    }
    
    // Créer un élément HTML pour une tâche
    function createTaskElement(task) {
      const taskElement = document.createElement('div');
      taskElement.className = 'task-card';
      taskElement.dataset.id = task.id;
      taskElement.dataset.user = task.assignedTo || '';
      taskElement.dataset.status = task.status;
      
      const assigneeName = task.assignedTo ? getUserName(task.assignedTo) : 'Non assignée';
      
      taskElement.innerHTML = `
        <h3>${task.title}</h3>
        <p class="task-description">${task.description || ''}</p>
        
        <div class="task-meta">
          <div class="task-assignee">
            <strong>Assignée à:</strong>
            <span>${assigneeName}</span>
          </div>
          
          <div class="task-status">
            <strong>Statut:</strong>
            <span class="status-badge ${task.status}">${formatStatus(task.status)}</span>
          </div>
        </div>
        
        <div class="task-actions">
          <button class="btn-update" data-id="${task.id}">Modifier</button>
          <button class="btn-delete" data-id="${task.id}">Supprimer</button>
        </div>
      `;
      
      return taskElement;
    }
    
    // Charger les tâches depuis l'API
    async function loadTasks() {
      try {
        const response = await fetch('/tasks');
        if (!response.ok) {
          throw new Error('Erreur lors du chargement des tâches');
        }
        
        const tasks = await response.json();
        tasksCache = tasks;
        
        renderTasks(tasks);
        showNotification('Tâches chargées avec succès', 'success');
        
        return tasks;
      } catch (error) {
        console.error('Erreur:', error);
        showNotification(error.message, 'error');
        return [];
      }
    }
    
    // Afficher les tâches dans la liste
    function renderTasks(tasks) {
      // Vider la liste actuelle
      taskList.innerHTML = '';
      
      // Appliquer les filtres
      const userFilter = filterUser.value;
      const statusFilter = filterStatus.value;
      
      const filteredTasks = tasks.filter(task => {
        const matchesUser = !userFilter || task.assignedTo === userFilter;
        const matchesStatus = !statusFilter || task.status === statusFilter;
        return matchesUser && matchesStatus;
      });
      
      // Afficher les tâches filtrées
      if (filteredTasks.length === 0) {
        taskList.innerHTML = '<p class="no-tasks">Aucune tâche ne correspond aux critères.</p>';
        return;
      }
      
      filteredTasks.forEach(task => {
        const taskElement = createTaskElement(task);
        taskList.appendChild(taskElement);
      });
      
      // Ajouter les gestionnaires d'événements aux boutons
      document.querySelectorAll('.btn-update').forEach(btn => {
        btn.addEventListener('click', handleUpdateClick);
      });
      
      document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', handleDeleteClick);
      });
    }
    
    // Créer une nouvelle tâche
    async function createTask(taskData) {
      try {
        const response = await fetch('/tasks', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(taskData)
        });
        
        if (!response.ok) {
          throw new Error('Erreur lors de la création de la tâche');
        }
        
        const task = await response.json();
        showNotification('Tâche créée avec succès!', 'success');
        
        return task;
      } catch (error) {
        console.error('Erreur:', error);
        showNotification(error.message, 'error');
        throw error;
      }
    }
    
    // Mettre à jour une tâche
    async function updateTask(taskId, taskData) {
      try {
        const response = await fetch(`/tasks/${taskId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(taskData)
        });
        
        if (!response.ok) {
          throw new Error('Erreur lors de la mise à jour de la tâche');
        }
        
        const task = await response.json();
        showNotification('Tâche mise à jour avec succès!', 'success');
        
        return task;
      } catch (error) {
        console.error('Erreur:', error);
        showNotification(error.message, 'error');
        throw error;
      }
    }
    
    // Supprimer une tâche
    async function deleteTask(taskId) {
      try {
        const response = await fetch(`/tasks/${taskId}`, {
          method: 'DELETE'
        });
        
        if (!response.ok) {
          throw new Error('Erreur lors de la suppression de la tâche');
        }
        
        showNotification('Tâche supprimée avec succès!', 'success');
        return true;
      } catch (error) {
        console.error('Erreur:', error);
        showNotification(error.message, 'error');
        throw error;
      }
    }
    
    // Gestionnaires d'événements
    
    // Soumission du formulaire de nouvelle tâche
    newTaskForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const taskData = {
        title: e.target.title.value,
        description: e.target.description.value,
        assignedTo: e.target.assignedTo.value || null
      };
      
      try {
        await createTask(taskData);
        e.target.reset();
      } catch (error) {
        console.error('Erreur lors de la création:', error);
      }
    });
    
    // Soumission du formulaire de mise à jour
    updateTaskForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const taskId = document.getElementById('update-id').value;
      const taskData = {
        title: e.target.title.value,
        description: e.target.description.value,
        status: e.target.status.value,
        assignedTo: e.target.assignedTo.value || null
      };
      
      try {
        await updateTask(taskId, taskData);
        closeModalHandler();
      } catch (error) {
        console.error('Erreur lors de la mise à jour:', error);
      }
    });
    
    // Clic sur le bouton de mise à jour
    function handleUpdateClick(e) {
      const taskId = e.target.dataset.id;
      const task = tasksCache.find(t => t.id === taskId);
      
      if (!task) {
        showNotification('Tâche non trouvée', 'error');
        return;
      }
      
      // Remplir le formulaire de mise à jour
      document.getElementById('update-id').value = task.id;
      document.getElementById('update-title').value = task.title;
      document.getElementById('update-description').value = task.description || '';
      document.getElementById('update-status').value = task.status;
      document.getElementById('update-assignedTo').value = task.assignedTo || '';
      
      // Afficher la modal
      modal.style.display = 'block';
    }
    
    // Clic sur le bouton de suppression
    async function handleDeleteClick(e) {
      const taskId = e.target.dataset.id;
      
      if (confirm('Êtes-vous sûr de vouloir supprimer cette tâche?')) {
        try {
          await deleteTask(taskId);
        } catch (error) {
          console.error('Erreur lors de la suppression:', error);
        }
      }
    }
    
    // Fermer la modal
    function closeModalHandler() {
      modal.style.display = 'none';
    }
    
    closeModal.addEventListener('click', closeModalHandler);
    
    window.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModalHandler();
      }
    });
    
    // Filtrer les tâches
    filterUser.addEventListener('change', () => {
      renderTasks(tasksCache);
    });
    
    filterStatus.addEventListener('change', () => {
      renderTasks(tasksCache);
    });
    
    // Événements Socket.IO
    
    // Réception des mises à jour en temps réel
    socket.on('task-update', (data) => {
      console.log('Événement reçu:', data.type);
      
      switch (data.type) {
        case 'task-created':
          // Ajouter la nouvelle tâche au cache
          tasksCache.push(data.task);
          showNotification(`Nouvelle tâche créée: ${data.task.title}`, 'info');
          break;
          
        case 'task-updated':
          // Mettre à jour la tâche dans le cache
          const updateIndex = tasksCache.findIndex(t => t.id === data.taskId);
          if (updateIndex !== -1) {
            tasksCache[updateIndex] = data.task;
            showNotification(`Tâche mise à jour: ${data.task.title}`, 'info');
          }
          break;
          
        case 'task-deleted':
          // Supprimer la tâche du cache
          const deleteIndex = tasksCache.findIndex(t => t.id === data.taskId);
          if (deleteIndex !== -1) {
            const taskTitle = tasksCache[deleteIndex].title;
            tasksCache.splice(deleteIndex, 1);
            showNotification(`Tâche supprimée: ${taskTitle}`, 'info');
          }
          break;
      }
      
      // Actualiser l'affichage
      renderTasks(tasksCache);
    });
    
    // Initialisation
    loadTasks();
  });