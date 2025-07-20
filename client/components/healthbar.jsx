import React from 'react';

function HealthBar({ health }) {
    // calculate health bar fill percentage
    const fillWidth = `${Math.max(0, health)}%`;

    return (
        <div className="health-bar-container">
            <div className="health-bar-label">HP: {Math.round(health)}</div>
            <div className="health-bar-background">
                <div
                    className="health-bar-fill"
                    style={{
                        width: fillWidth,
                        backgroundColor: health > 50 ? '#4CAF50' : health > 20 ? '#FFC107' : '#F44336'
                    }}
                />
            </div>
        </div>
    );
}

export default HealthBar;