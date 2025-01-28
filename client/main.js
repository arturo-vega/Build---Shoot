import io from 'socket.io-client';
import { Game } from './game.js';

// Connect to Socket.IO server
const socket = io('http://localhost:3000');


async function initializeGame() {
    try {
        const game = await new Game(socket);
        // Additional setup after game is fully loaded
        game.setupEventListeners();
        game.animate();
    } catch (error) {
        console.error('Game initialization failed:', error);
    }
}


initializeGame();



socket.on('disconnect', () => {
    console.log('Disconnected from server');
});



