import { World } from './world.js';
import { GameState } from '../shared/gamestate.js';

export class GameRoom {
    constructor(id, creatorName, maxPlayers = 8, gameType, gameTime) {
        this.id = id;
        this.creatorName = creatorName;
        this.maxPlayers = maxPlayers;
        this.players = new Map();
        this.world = new World();
        this.gameState = new GameState(gameType, gameTime);
        this.createdAt = Date.now();
        this.lastActivity = Date.now();

        this.gameType = gameType;
        this.gameTime = gameTime;

        this.timeRemaining = this.gameTime;
        this.redTeamScore = 0;
        this.blueTeamScore = 0;

        this.gameState.gameStart();
    }

    gameStateUpdate() {
        const gameUpdate =
        {
            timeRemaining: this.gameState.timeRemaining,
            redTeamScore: this.gameState.teamScore.red,
            blueTeamScore: this.gameState.teamScore.blue,
        }

        return gameUpdate;
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
        const team = this.gameState.assignTeam(playerData);
        console.log(`${playerData.playerName} assigned to ${team} team`);
        console.log(this.gameState.teamPopulation);

        this.players.set(socketId, {
            ...playerData,
            joinedAt: Date.now(),
            lastUpdate: performance.now(),
            playerTeam: team
        });

        this.lastActivity = Date.now();
    }

    removePlayer(socketId) {
        const unassigned = this.gameState.playerLeft(socketId);
        const removed = this.players.delete(socketId);
        if (removed && unassigned) {
            this.lastActivity = Date.now();
        } else {
            console.error(`Player ${socketId} not successffully removed from game room: unassigned status: ${unassigned} removed status: ${removed}`);
        }

        console.log(this.gameState.teamPopulation);

        return removed;
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
