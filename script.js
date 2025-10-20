const firebaseConfig = {
    apiKey: "AIzaSyA1AKqZs8lkFkbX2vMxYX4ytwocrw3hNHs",
    authDomain: "santeai-b8e44.firebaseapp.com",
    databaseURL: "https://santeai-b8e44-default-rtdb.europe-west1.firebasedatabase.app", 
    projectId: "santeai-b8e44",
    storageBucket: "santeai-b8e44.appspot.com",
    messagingSenderId: "103280040214",           
    appId: "1:103280040214:web:89256070716da5b55a1837"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database(); 

let currentUserId = null;
let registeredUsers = {}; 

async function loadRegisteredUsers() {
    try {
        const snapshot = await db.ref('chefs_groupe').once('value');
        registeredUsers = snapshot.val() || {};
    } catch (error) {
        console.error("Erreur lors du chargement des chefs de groupe:", error);
    }
}

window.authenticate = async function() {
    const id = document.getElementById('permanentId').value.trim().toUpperCase();
    const messageDiv = document.getElementById('auth-message');
    const drawSection = document.getElementById('draw-section');
    
    messageDiv.textContent = "";
    drawSection.style.display = 'none';
    document.getElementById('draw-result').style.display = 'none';
    
    await loadRegisteredUsers();

    const userName = registeredUsers[id];
    if (!userName) {
        messageDiv.textContent = "Erreur: Identifiant permanent inconnu.";
        return;
    }

    currentUserId = id;
    document.getElementById('userName').textContent = userName;

    const resultSnapshot = await db.ref(`resultats_tirage/${id}`).once('value');
    const themeAttribue = resultSnapshot.val();

    if (themeAttribue) {
        drawSection.style.display = 'block';
        document.getElementById('drawButton').style.display = 'none';
        document.getElementById('finalTheme').textContent = themeAttribue;
        document.getElementById('draw-result').classList.add('success');
        document.getElementById('draw-result').style.display = 'block';
        messageDiv.textContent = `✅ Vous avez déjà tiré votre thème : ${themeAttribue}.`;
    } else {
        drawSection.style.display = 'block';
        document.getElementById('drawButton').style.display = 'block';
        messageDiv.textContent = `Authentification réussie. Bienvenue ${userName}.`;
    }
}

window.startDraw = async function() {
    if (!currentUserId) {
        alert("Veuillez d'abord vous identifier.");
        return;
    }
    
    const drawButton = document.getElementById('drawButton');
    drawButton.disabled = true;
    drawButton.textContent = "Tirage en cours...";

    const themesSnapshot = await db.ref('themes_disponibles').once('value');
    const themesObject = themesSnapshot.val() || {}; 
    const countSnapshot = await db.ref('themes_attribues_count').once('value');
    const assignedCounts = countSnapshot.val() || {}; 

    const themeKeys = Object.keys(themesObject);
    
    if (themeKeys.length === 0) {
        alert("Aucun thème disponible dans la base de données !");
        drawButton.disabled = false;
        drawButton.textContent = "Lancer le Tirage ! 🎉";
        return;
    }

    let unassignedKeys = themeKeys.filter(key => !assignedCounts[key] || assignedCounts[key] === 0);
    
    let keysToDrawFrom;
    
    if (unassignedKeys.length > 0) {
        keysToDrawFrom = unassignedKeys;
        console.log("Priorité : Tirage parmi les thèmes non encore attribués.");
    } else {
        keysToDrawFrom = themeKeys;
        console.log("Tous les thèmes sont attribués, tirage au hasard sur tout l'ensemble.");
    }

    const randomIndex = Math.floor(Math.random() * keysToDrawFrom.length);
    const selectedKey = keysToDrawFrom[randomIndex];
    const selectedTheme = themesObject[selectedKey];
    
    try {
        await db.ref(`resultats_tirage/${currentUserId}`).set(selectedTheme); 
        
        await db.ref('themes_attribues_count').child(selectedKey).transaction(currentCount => {
            return (currentCount || 0) + 1;
        });

        document.getElementById('finalTheme').textContent = selectedTheme;
        document.getElementById('draw-result').style.display = 'block';
        document.getElementById('draw-result').classList.add('success');
        drawButton.style.display = 'none';

        alert(`Félicitations ! Votre thème est : ${selectedTheme}`);
        authenticate(); 
    } catch (error) {
        console.error("Erreur lors de la transaction Firebase:", error);
        alert("❌ Une erreur s'est produite lors du tirage. Veuillez rafraîchir la page.");
        drawButton.disabled = false;
        drawButton.textContent = "Lancer le Tirage ! 🎉";
    }
}

function setupDashboardListener() {
    db.ref().on('value', async (globalSnapshot) => {
        const globalData = globalSnapshot.val() || {};
        const results = globalData.resultats_tirage || {};
        const themesObject = globalData.themes_disponibles || {};
        const assignedCounts = globalData.themes_attribues_count || {};

        const totalThemes = Object.keys(themesObject).length;
        const assignedThemesCount = Object.keys(assignedCounts).filter(key => assignedCounts[key] > 0).length;

        const resultsList = document.getElementById('results-list');
        resultsList.innerHTML = '';
        
        await loadRegisteredUsers(); 

        for (const id in registeredUsers) {
            const theme = results[id];
            const userName = registeredUsers[id];
            
            const listItem = document.createElement('li');
            
            if (theme) {
                listItem.innerHTML = `<strong>${userName}</strong> (${id}) : <span>${theme}</span>`;
            } else {
                listItem.innerHTML = `<strong>${userName}</strong> : <span>Attente du tirage...</span>`;
            }
            resultsList.appendChild(listItem);
        }

        const statusItem = document.createElement('li');
        statusItem.style.marginTop = '15px';
        statusItem.style.fontWeight = 'bold';
        
        if (assignedThemesCount < totalThemes) {
            statusItem.innerHTML = `Thèmes non attribués : <span>${totalThemes - assignedThemesCount} sur ${totalThemes}</span>`;
            statusItem.style.color = '#ffc107'; 
        } else {
            statusItem.innerHTML = `STATUT : Tous les thèmes ont été attribués au moins une fois !`;
            statusItem.style.color = '#28a745'; 
        }
        resultsList.appendChild(statusItem);
    });
}

window.onload = function() {
    setupDashboardListener();
};