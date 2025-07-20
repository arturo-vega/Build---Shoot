import React, { useEffect, useState } from 'react';
import HealthBar from './components/healthbar.jsx';
import WeaponDisplay from './components/weapondisplay.jsx';
import FPSCounter from './components/fpscounter.jsx';
import VelocityGuage from './components/velocityguage.jsx';


function App() {
    const [playerHealth, setPlayerHealth] = useState(100);
    const [currentWeapon, setCurrentWeapon] = useState('Pistol');
    const [gameFPS, setCurrentFPS] = useState(0);
    const [velocityGuague, setCurrentVelocity] = useState(0, 0);

    // update UI based on game state
    useEffect(() => {
        const updateInterval = setInterval(() => {
            if (window.gameInstance && window.gameInstance.player) {
                setPlayerHealth(window.gameInstance.player.health);

                setCurrentFPS(window.gameInstance.FPS);
                setCurrentVelocity(window.gameInstance.player.velocity);

                const weapon = window.gameInstance.player.itemNames[window.gameInstance.player.currentItemIndex];
                setCurrentWeapon(weapon);
            }
        }, 1); // update UI 10 times per second

        return () => clearInterval(updateInterval);
    }, []);

    return (
        <div className="game-hud">
            <HealthBar health={playerHealth} />
            <WeaponDisplay weapon={currentWeapon} />
            <FPSCounter fps={gameFPS} />
            <VelocityGuage velocity={velocityGuague} />
        </div>
    );
}

export default App;