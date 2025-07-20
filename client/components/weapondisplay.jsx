import React from 'react';

function WeaponDisplay({ weapon }) {
    return (
        <div className="weapon-display">
            <div className="weapon-icon">
                {/* could use weapon-specific icons here */}
                🔫
            </div>
            <div className="weapon-name">{weapon}</div>
        </div>
    );
}

export default WeaponDisplay;