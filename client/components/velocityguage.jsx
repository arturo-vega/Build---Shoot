function VelocityGuage({ velocity }) {
    return (
        <div className="velocityguage-container">
            <div className="velocityguage-label">x: {velocity.x} y: {velocity.y}</div>
        </div>
    );
}

export default VelocityGuage;