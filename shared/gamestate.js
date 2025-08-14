export class GameState {
    constructor(gameType, gameTime) {
        this.gameType = gameType;
        this.gameTime = gameTime;
        this.breakTime = 30;
        this.timeRemaining = 0;
        this.redPlayers = new Map();
        this.bluePlayers = new Map();
        this.teamPopulation = {
            'red': 0,
            'blue': 0
        }
        this.teamScore = {
            'red': 0,
            'blue': 0
        }
        this.scoreToWin = 3;
        this.redFlagStolen = false;
        this.blueFlagStolen = false;
        this.redScored = false;
        this.blueSored = false;
        this.redTeamWon = false;
        this.blueTeamWon = false;
        this.tie = false;
        this.gameEnded = false;
        this.gameStarted = true;

        this.gameTimer = null;
    }

    getScore(teamColor) {
        return this.teamScore[teamColor];
    }

    getTeamPopulation(teamColor) {
        return this.teamPopulation[teamColor];
    }

    getGameTime() {
        return this.gameTime;
    }

    playerScored(teamColor) {
        if (teamColor == 'red') {
            this.teamScore['red']++;
            this.blueFlagStolen = false;
            if (this.teamScore['red'] >= this.scoreToWin) {
                this.gameOver();
            }
        } else { // blue
            this.teamScore['blue']++;
            this.redFlagStolen = false;
            if (this.teamScore['blue'] >= this.scoreToWin) {
                this.gameOver();
            }
        }
    }

    assignTeam(player) {
        if (this.teamPopulation['red'] === this.teamPopulation['blue']) {
            this.redPlayers.set(player.id, player);
            this.teamPopulation['red']++;
            return 'red';
        }
        else if (this.teamPopulation['red'] < this.teamPopulation['blue']) {
            this.redPlayers.set(player.id, player);
            this.teamPopulation['red']++;
            return 'red';
        } else {
            this.bluePlayers.set(player.id, player);
            this.teamPopulation['blue']++;
            return 'blue';
        }
    }

    playerLeft(playerId) {
        if (this.redPlayers.has(playerId)) {
            this.teamPopulation['red']--;
            return this.redPlayers.delete(playerId);
        }
        else if (this.bluePlayers.has(playerId)) {
            this.teamPopulation['blue']--;
            return this.bluePlayers.delete(playerId);
        } else {
            console.error(`${playerId} not assigned to any team`);
        }
    }

    gameStart() {
        this.gameStarted = true;
        this.timeRemaining = this.gameTime;

        this.gameTimer = setInterval(() => {
            this.timeRemaining--;
            if (this.timeRemaining <= 0) {
                const timeOut = true;
                this.gameOver(timeOut);
            }
        }, 1000); // decrement timer every second

    }

    gameOver(timeOut = false) {
        if (timeOut) {
            if (this.teamScore['red'] > this.teamScore['blue']) {
                this.redTeamWon = true;
            } else if (this.teamScore['red'] < this.teamScore['blue']) {
                this.blueTeamwon = true;
            } else {
                this.tie = true;
            }
        } else {
            if (this.teamScore['red'] > this.teamScore['blue']) {
                this.redTeamWon = true;
            } else if (this.teamScore['red'] < this.teamScore['blue']) {
                this.blueTeamwon = true;
            }
        }

        this.gameEnded = true;
        this.timeRemaining = this.breakTime;

        this.gameTimer = setInterval(() => {
            this.timeRemaining--;
            if (this.timeRemaining <= 0) {
                this.gameStart();
            }
        }, 1000);
    }

}
