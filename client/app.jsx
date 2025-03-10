import React, { useEffect, useState } from 'react';
import HealthBar from './components/healthbar.jsx';
import WeaponDisplay from './components/weapondisplay.jsx';

function App() {
    console.log("React App rendering");
    const [playerHealth, setPlayerHealth] = useState(100);
    const [currentWeapon, setCurrentWeapon] = useState('Pistol');

  // update UI based on game state
    useEffect(() => {
        const updateInterval = setInterval(() => {
            if (window.gameInstance && window.gameInstance.player) {
                setPlayerHealth(window.gameInstance.player.health);

                const weapon = window.gameInstance.player.itemNames[window.gameInstance.player.currentItemIndex];
                setCurrentWeapon(weapon);
            }
        }, 100); // update UI 10 times per second
    
        return () => clearInterval(updateInterval);
    }, []);

    return (
        <div className="game-hud">
            <HealthBar health={playerHealth} />
            <WeaponDisplay weapon={currentWeapon} />
        </div>
    );
}

export default App;