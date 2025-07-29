export class GameState {
    constructor() {
        this.gameType = 'ctf';
        this.gameTime = 600;
        this.breakTime = 30;
        this.timeRemaining = 0;
        this.gameStart = performance.now();
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
        if (this.teamPopulation['red'] && this.teamPopulation['blue']) {
            this.redPlayers.set(player.playerName, player);
            this.teamPopulation['red']++;
        }
        else if (this.teamPopulation['red'] < this.teamPopulation['blue']) {
            this.redPlayers.set(player.playerName, player);
            this.teamPopulation['red']++;
        } else {
            this.bluePlayers.set(player.playerName, player);
            this.teamPopulation['blue']++;
        }
    }

    playerLeft(player) {
        if (this.redPlayers.has(player.playerName)) {
            this.redPlayers.delete(player.Playername);
            this.teamPopulation['red']--;
        }
        else if (this.bluePlayers.has(player.playerName)) {
            this.bluePlayers.delete(player.Playername);
            this.teamPopulation['blue']--;
        } else {
            console.error(`${player.playerName} not assigned to any team`);
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
        }, 1000);
    }

    gameOver(timeOut = false) {
        if (timeOut) {
            if (this.teamScore['red'] > this.teamScore['blue']) {
                this.redTeamWon = true;
            } else if (this.teamScore['red'] < this.teamScore['blue']) {
                this.blueTeamwon = false;
            } else {
                this.tie = true;
            }
        } else {
            this.teamScore['red'] >= this.scoreToWin ? this.redTeamWon : this.blueTeamWon;
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

export default GameState;