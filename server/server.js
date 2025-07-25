import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { World } from './world.js';
import { GameRoom } from './gameroom.js';

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

// Note:
// io.to(roomId).emit(event) = broadcasts to everyone including the person who sent the event
// socket.to(roomId).emit(event) = broadcasts toe veryone EXCLUDING the person who sent the event

// Serve static files from the client directory
app.use(express.static(path.join(__dirname, '../client')));

// Serve index.html for the root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

const rooms = new Map();
const playerRooms = new Map();
let nextRoomId = 0;

function generateRoomId() {
    nextRoomId++;
    return nextRoomId;
}

function getRoomsList() {
    return Array.from(rooms.values()).map(room => room.toJSON());
}

function cleanupEmptyRooms() {
    const now = Date.now();
    const ROOM_TIMEOUT = 30 * 60 * 1000; // 30 mins

    for (const [roomId, room] of rooms.entries()) {
        if (room.isEmpty() && (now - room.lastActivity > ROOM_TIMEOUT)) {
            console.log(`Cleaning up empty room: ${roomId}`);
            rooms.delete(roomId);
        }
    }
}

// cleanup rooms every 5 mins
setInterval(cleanupEmptyRooms, 5 * 60 * 1000);

//const loader = new THREE.ObjectLoader();

io.on('connection', (socket) => {
    console.log('A user connected with socket id: ', socket.id);

    socket.on('playerJoin', (playerData) => {
        console.log(`Player ${playerData.name} connected`);

        socket.playerName = playerData.name;

        socket.emit('roomList', getRoomsList());
    });

    socket.on('createRoom', (data) => {
        const roomId = generateRoomId();
        const room = new GameRoom(roomId, socket.playerName /*|| data.playerName*/);

        rooms.set(roomId, room);

        room.addPlayer(socket.id, {
            name: socket.playerName || data.playerName,
            position: { x: 0, y: 0, z: 0 },
            velocity: { x: 0, y: 0, z: 0 },
            health: 100
        });

        socket.join(roomId);
        playerRooms.set(socket.id, roomId);

        console.log(`Player ${socket.playerName} created room ${roomId}`);

        socket.emit('roomCreated', {
            roomId: roomId,
            room: room.toJSON()
        });

        let transitBlocks = JSON.stringify(Array.from(room.world.blocks));
        socket.emit('initialWorldState', transitBlocks);

        io.emit('roomList', getRoomsList());
    });

    socket.on('joinRoom', (data) => {
        const room = rooms.get(data.roomId);

        if (!room) {
            socket.emit('roomNotFound');
            console.log(console.log(`Player ${socket.playerName} tried to join room ${data.roomId} but room not found.`));
            return;
        }

        if (room.isFull()) {
            socket.emit('roomFull');
            console.log(console.log(`Player ${socket.playerName} tried to join room ${data.roomId} but room was full.`));
            return;
        }

        room.addPlayer(socket.id, {
            name: socket.playerName,
            position: { x: 0, y: 0, z: 0 },
            velocity: { x: 0, y: 0, z: 0 },
            health: 100
        });

        if (room.roomHasPlayer(socket.id)) {
            socket.join(data.roomId);
            playerRooms.set(socket.id, data.roomId);

            console.log(`Player ${socket.playerName} joined room ${data.roomId}`);

            socket.emit('roomJoined', {
                roomId: data.roomId,
                room: room.toJSON()
            });

            // send world state of the room
            let transitBlocks = JSON.stringify(Array.from(room.world.blocks));
            socket.emit('initialWorldState', transitBlocks);

            socket.to(data.roomId).emit('playerJoined', {
                id: socket.id,
                name: socket.playerName,
                position: { x: 0, y: 0, z: 0 },
                velocity: { x: 0, y: 0, z: 0 },
                health: 100
            });

            room.players.forEach((player, id) => {
                if (id != socket.id) {
                    socket.emit('playerJoined', {
                        id: id,
                        name: player.name,
                        position: player.position,
                        velocity: player.velocity,
                        health: player.health
                    });
                }
            });

            // broadcast updated room list
            io.emit('roomList', getRoomsList());
        }
    });

    socket.on('getRooms', () => {
        socket.emit('roomsList', getRoomsList());
    });

    socket.on('playerUpdate', (updateData) => {
        const roomId = playerRooms.get(socket.id);
        if (!roomId) return;

        const room = rooms.get(roomId);
        if (!room) return;

        room.updatePlayer(socket.id, {
            position: updateData.position,
            velocity: updateData.velocity,
            health: updateData.health
        });

        if (room.roomHasPlayer(socket.id)) {
            // broadcast update to other players in the room
            socket.to(roomId).emit('playerMoved', {
                id: socket.id,
                position: updateData.position,
                velocity: updateData.velocity,
                health: updateData.health,
                timestamp: updateData.timestamp
            });
        }
    });

    socket.on('playerHit', (damageInfo) => {
        const roomId = playerRooms.get(socket.id);

        if (!roomId) return;

        const room = rooms.get(roomId);
        if (!room) return;

        const targetPlayer = room.players.get(damageInfo.playerId);
        if (targetPlayer) {
            socket.to(roomId).emit('playerDamaged', damageInfo);
        }
    });

    socket.on('playerFiredDamagedBlock', (shotInfo) => {
        const roomId = playerRooms.get(socket.id);
        if (roomId) {
            socket.to(roomId).emit('otherPlayerFiredDamagedBlock', shotInfo, socket.id);
        }
    });

    socket.on('playerFired', (shotInfo) => {
        const roomId = playerRooms.get(socket.id);
        if (roomId) {
            socket.to(roomId).emit('otherPlayerFired', shotInfo, socket.id);
        }
    });

    socket.on('blockModified', (blockData) => {
        const roomId = playerRooms.get(socket.id);

        if (!roomId) return;

        const room = rooms.get(roomId);
        if (!room) return;

        if (blockData.updateType === 'added') {
            addBlock(blockData, room, roomId, socket);
            console.log(`Block placed in room ${roomId}`);
        }

        else if (blockData.updateType === 'damaged') {
            damageBlock(blockData, room, roomId, socket);
            console.log(`Block damaged in room ${roomId}`);
        }

        else if (blockData.updateType === 'removed') {
            removeBlock(blockData, room, roomId, socket);
            console.log(`Block destroyed in room ${roomId}`);
        }

        else {
            console.error(`Uknown block update type: ${blockData.updateType}`);
        }
    });

    socket.on('leaveRoom', () => {
        const roomId = playerRooms.get(socket.id);
        if (roomId) {
            handlePlayerLeaveRoom(socket, roomId);
        }
    });

    socket.on('disconnect', () => {
        console.log(`Player ${socket.playerName} disconnected.`);

        const roomId = playerRooms.get(socket.id);
        if (roomId) {
            handlePlayerLeaveRoom(socket, roomId);
        }
    });
});

function addBlock(blockData, room, roomId, socket) {
    if (blockData.updateType === 'added') {
        room.world.createBlock(blockData.x, blockData.y);
        socket.to(roomId).emit('mapUpdated', {
            updateType: 'added',
            x: blockData.x,
            y: blockData.y
        });

    } else {
        console.error(`Passed incorrect type '${blockData.updateType}' into addBlock function`);
        return;
    }
}

function damageBlock(blockData, room, roomId, socket) {
    if (blockData.updateType === 'damaged') {
        room.world.damageBlock(blockData.x, blockData.y, blockData.health);

        // world keeps track of blocks removed and needs to be sent out if damage
        // to a block caused it to be destroyed
        if (room.world.blocksRemoved.length > 0) {
            for (let i = 0; i < room.world.blocksRemoved.length; i++) {
                let block = room.world.blocksRemoved[i];
                if (!block) continue;
                io.to(roomId).emit('mapUpdated', {
                    updateType: 'removed',
                    x: block.x,
                    y: block.y
                });
            }
            room.world.blocksRemoved = [];
        } else {
            socket.to(roomId).emit('mapUpdated', {
                updateType: 'damaged',
                x: blockData.x,
                y: blockData.y,
                health: blockData.health
            });
        }

    } else {
        console.error(`Passed incorrect type '${blockData.updateType}' into damageBlock function`);
        return;
    }
}

function removeBlock(blockData, room, roomId, socket) {
    if (blockData.updateType === 'removed') {
        room.world.removeBlock(blockData.x, blockData.y, blockData.type)

        for (let i = 0; i <= room.world.blocksRemoved.length; i++) {
            let block = room.world.blocksRemoved[i];
            if (!block) continue;

            io.to(roomId).emit('mapUpdated', {
                updateType: 'removed',
                x: block.x,
                y: block.y
            });
        }
        // reset the removed blocks in the world to 0
        room.world.blocksRemoved = [];
    } else {
        console.error(`Passed incorrect type '${blockData.updateType}' into removeBlock function`);
        return;
    }
}

function handlePlayerLeaveRoom(socket, roomId) {
    const room = rooms.get(roomId);
    if (room) {
        room.removePlayer(socket.id);

        socket.to(roomId).emit('playerLeft', socket.id);

        if (room.isEmpty()) {
            console.log(`Room ${roomId} is now empty`);
        }

        io.emit('roomList', getRoomsList());
    }

    socket.leave(roomId);
    playerRooms.delete(socket.id);
}

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
})