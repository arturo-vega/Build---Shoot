import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app.jsx';
import './style.css';

import io from 'socket.io-client';
import { Game } from './game.js';

// Connect to Socket.IO server
const socket = io('http://localhost:3000');

window.gameInstance = null;

const root = ReactDOM.createRoot(document.getElementById('react-root'));
root.render(<App />);

async function initializeGame() {
    try {
        const game = await new Game(socket);
        game.setupEventListeners();
        game.animate();

        window.gameInstance = game;
    } catch (error) {
        console.error('Game initialization failed:', error);
    }
}

initializeGame();

socket.on('disconnect', () => {
    console.log('Disconnected from server');
});



