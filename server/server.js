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

//const loader = new THREE.ObjectLoader();

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
        players.forEach((player, id) => { 
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
            player.health = updateData.health;
            player.lastUpdate = performance.now();

            // broadcast update to other players
            socket.broadcast.emit('playerMoved', {
                id: socket.id,
                position: updateData.position,
                velocity: updateData.velocity,
                health: updateData.health,
                timestamp: updateData.timestamp
            });
        }
    });

    // Handle PVP damage ------------------------------------------------------------
    socket.on('playerHit', (damageInfo) => {

        const player = players.get(damageInfo.playerId)
        // if the damageInfo playerid matches the id in the players map then they
        // have been hit and send them the hit info. For everyone else update
        // the new player hp
        if (player) {
            socket.broadcast.emit('playerDamaged', damageInfo);
            console.log("Sent damage!");
        }
    });

    // handle block changes
    socket.on('blockModified', (blockData) => {

        const x = blockData.x
        const y = blockData.y

        if (blockData.updateType === 'added') {
            world.createBlock(x, y);
            socket.broadcast.emit('mapUpdated', {
                updateType: 'added',
                x: x,
                y: y
            });
        }
        else if (blockData.updateType === 'removed') {
            const blocksToRemove = world.checkForDisconnectedBlocks(x, y);

            for (let i = 0; i < blocksToRemove.length; i++) {
                const block = blocksToRemove[i];
                if (!block) continue;
                // using io.emit so that all players, even the player who sent the 'blockModified' emission, receives the updated map
                io.emit('mapUpdated', {
                    updateType: 'removed',
                    x: block.x,
                    y: block.y
                });
                world.removeBlock(block.x, block.y);
            }
        }
        else if (blockData.updateType === 'damaged') {
            world.updateBlockHealth(x, y, blockData.health)
            socket.broadcast.emit('mapUpdated', {
                updateType: 'damaged',
                x: x,
                y: y,
                health: blockData.health
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

