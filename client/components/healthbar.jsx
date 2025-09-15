import React from 'react';

function HealthBar({ health }) {
    // calculate health bar fill percentage
    const fillWidth = `${Math.max(0, health)}%`;

    return (
        <div className="health-bar-container">
            <div className="health-bar-label">🩸: {Math.round(health)}</div>
            <div className="health-bar-background">
                <div
                    className="health-bar-fill"
                    style={{
                        width: fillWidth,
                        backgroundColor: '#F44336'
                    }}
                />
            </div>
        </div>
    );
}

export default HealthBar;