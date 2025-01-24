import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { World } from './world.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"],
        allowedHeaders: ["Content-Type"],
        credentials: true
    }
});
// Serve static files from the client directory
app.use(express.static(path.join(__dirname, '../client')));

// Serve index.html for the root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

const world = new World();
let players = new Map();
console.log(world.blocks.size);

// this handles all the interactions of a client with the server
io.on('connection', (socket) => {
    console.log('A user connected', socket.id);

    // send the world state to a player who joins immediately
    // can't send maps over socket so need to do this first
    let transitBlocks = JSON.stringify(Array.from(world.blocks));
    socket.emit('initialWorldState', transitBlocks);

    // When new player joins get player id and set player position info
    socket.on('playerJoin', (position, velocity) => {
        players.set(socket.id, {
            position: position,
            velocity: velocity,
            lastUpdate: performance.now()
        });

        // Send new player info to everyone else
        socket.broadcast.emit('playerJoined', {
            id: socket.id,
            position: position,
            velocity: velocity
        });

        // Send existing player info to new player
        players.forEach((player, id) => { ///////// check this
            if (id !== socket.id) {
                socket.emit('playerJoined', {
                    id: id,
                    position: player.position,
                    velocity: player.velocity
                });
            }
        });
    });
    
    // Handle player movement/actions
    socket.on('playerUpdate', (updateData) => {
        const player = players.get(socket.id);
        if (player) {
            player.position = updateData.position;
            player.velocity = updateData.velocity;
            player.lastUpdate = performance.now();

            // broadcast update to other players
            socket.broadcast.emit('playerMoved', {
                id: socket.id,
                position: updateData.position,
                velocity: updateData.velocity,
                timestamp: updateData.timestamp
            });
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected', socket.id);
        players.delete(socket.id);
        io.emit('playerLeft', socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

