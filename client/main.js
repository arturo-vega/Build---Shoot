import io from 'socket.io-client';
import { Game } from './game.js';

// Connect to Socket.IO server
const socket = io('http://localhost:3000');


socket.on('connect', () => {
    const game = new Game(socket);
});




socket.on('disconnect', () => {
    console.log('Disconnected from server');
});



