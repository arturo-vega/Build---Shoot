function FPSCounter({ fps }) {

    return (
        <div className="fpscounter-container">
            <div className="fpscounter-label">FPS: {Math.round(fps)}</div>
        </div>
    );
}

export default FPSCounter;