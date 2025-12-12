function GameInfo({ blueScore, redScore, gameTime, maxTime = 600 }) {
    const timePercentage = (gameTime / maxTime) * 100;

    const minutes = Math.floor(gameTime / 60);
    const seconds = gameTime % 60;
    const formattedTime = `${minutes}:${seconds.toString().padStart(2, "0")}`;

    return (
        <div className="game-info-container">
            <div className="scores-row">
                <div className="blue-score-label">{blueScore}</div>

                <div className="time-display">
                    <div className="time-label">Time Remaining</div>
                    <div className="game-time-label">{formattedTime}</div>
                </div>

                <div className="red-score-label">{redScore}</div>
            </div>
        </div>
    );
}

export default GameInfo;