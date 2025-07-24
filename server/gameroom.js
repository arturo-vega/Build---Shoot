import { World } from './world.js';

export class GameRoom {
    constructor(id, creatorName, maxPlayers = 8) {
        this.id = id;
        this.creatorName = creatorName;
        this.maxPlayers = maxPlayers;
        this.players = new Map();
        this.world = new World();
        this.createdAt = Date.now();
        this.lastActivity = Date.now();
    }

    roomHasPlayer(socketId) {
        if (this.players.has(socketId)) {
            return true;
        } else {
            return false;
        }
    }

    addPlayer(socketId, playerData) {
        if (this.players.size >= this.maxPlayers) {
            return false;
        }

        this.players.set(socketId, {
            ...playerData,
            joinedAt: Date.now(),
            lastUpdate: performance.now()
        });

        this.lastActivity = Date.now();
    }

    removePlayer(socketId) {
        const removed = this.players.delete(socketId);
        if (removed) {
            this.lastActivity = Date.now();
        }
        return removed;
    }

    updatePlayer(socketId, updateData) {
        const player = this.player.get(socketId);
        if (player) {
            Object.assign(player, updateData);
            player.lastUpdate = performance.now();
            this.lastActivity = Date.now();
            return true;
        }
        return false;
    }

    updatePlayer(socketId, updateData) {
        const player = this.players.get(socketId);
        if (player) {
            Object.assign(player, updateData);
            player.lastUpdate = performance.now();
            this.lastActivity = Date.now();
            return true;
        }
        return false;
    }

    getPlayerCount() {
        return this.players.size;
    }

    isEmpty() {
        return this.players.size == 0;
    }

    isFull() {
        return this.players.size >= this.maxPlayers;
    }

    toJSON() {
        return {
            id: this.id,
            creatorName: this.creatorName,
            playerCount: this.getPlayerCount(),
            maxPlayers: this.maxPlayers,
            createdAt: this.createdAt,
            isFull: this.isFull()
        };
    }
}