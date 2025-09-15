import React from 'react';

function WeaponDisplay({ weapon, numBlocks, itemCharge, }) {


    // These are found in the 'Controls' file
    const weaponEmojis = {
        'Placer': '📦',
        'Remover': '🪏',
        'Weapon': '🔫'
    }


    const getWeaponBar = (weapon, charge) => {
        switch (weapon) {
            case 'Placer':
                return charge == 100 ? '#4CAF50' : '#F44336'

            case 'Remover':
                return charge == 100 ? '#4CAF50' : '#F44336'

            case 'Weapon':
                return charge > 80 ? '#4CAF50' : charge > 40 ? '#FFC107' : '#F44336'
        }
    }


    const fillWidth = `${Math.max(0, itemCharge)}%`;

    return (
        <div className="weapon-display">
            <div className='weapon-info'>
                <div className="weapon-info">
                    {weaponEmojis[weapon]}
                </div>

                <div className="weapon-name">
                    {weapon} 📦 :          {numBlocks}
                </div>
            </div>

            <div className="weapon-bar-background">
                <div
                    className="weapon-bar-fill"
                    style={{
                        width: fillWidth,
                        backgroundColor: getWeaponBar(weapon, itemCharge)
                    }}
                />
            </div>

        </div>
    );
}

export default WeaponDisplay;