function GameInfo({ blueScore, redScore, gameTime }) {

    return (
        <div className="game-info-container">
            <div className="blue-score-label">{blueScore}</div>
            <div className="game-time-label">{gameTime}</div>
            <div className="red-score-label">{redScore}</div>
        </div>
    );
}

export default GameInfo;