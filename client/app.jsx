import React, { useEffect, useState } from 'react';
import HealthBar from './components/healthbar.jsx';
import WeaponDisplay from './components/weapondisplay.jsx';
import FPSCounter from './components/fpscounter.jsx';
import io from 'socket.io-client';
import { Game } from './game.js';

function App() {
    // in game UI
    const [playerHealth, setPlayerHealth] = useState(100);
    const [currentWeapon, setCurrentWeapon] = useState('Pistol');
    const [gameFPS, setCurrentFPS] = useState(0);

    // 'menu', 'connecting', 'playing'
    const [gameState, setGameState] = useState('menu');
    const [socket, setSocket] = useState(null);
    const [serverUrl, setServerUrl] = useState('http://localhost:3000');
    const [playerName, setPlayerName] = useState('');
    const [connectionError, setConnectionError] = useState('');
    const [availableRooms, setAvailableRooms] = useState([]);

    useEffect(() => {
        const updateInterval = setInterval(() => {
            if (window.gameInstance && window.gameInstance.player) {
                setPlayerHealth(window.gameInstance.player.health);

                setCurrentFPS(window.gameInstance.FPS);
                setCurrentVelocity(window.gameInstance.player.velocity);

                const weapon = window.gameInstance.player.itemNames[window.gameInstance.player.currentItemIndex];
                setCurrentWeapon(weapon);
            }
        }, 100); // update UI 10 times per second

        return () => clearInterval(updateInterval);
    }, []);


    const connectToServer = async () => {
        if (!playerName.trim()) {
            setConnectionError('Please enter a name');
            return;
        }

        setGameState('connecting');
        setConnectionError('');

        try {
            const newSocket = io(serverUrl, {
                timeout: 5000,
                forceNew: true
            });

            newSocket.on('connect', () => {
                console.log('Connected to server');
                setSocket(newSocket);

                newSocket.emit('playerJoin', { name: playerName });

                newSocket.on('roomList', (rooms) => {
                    setAvailableRooms(rooms);
                });

                newSocket.emit('getRooms');
            });

            newSocket.on('connection_error', (error) => {
                console.error('Connection failed:', error);
                setConnectionError('Failed to connect to server. Make sure the server is running.');
                setGameState('menu');
            });

            newSocket.on('disconnect', () => {
                console.log('Disconnected from server');
                setGameState('menu');
                setSocket(null);
            });
        } catch (error) {
            console.error('Connection error:', error);
            setConnectionError('Connection failed');
            setGameState('menu');
        }
    };

    const joinRoom = async (roomId) => {
        if (!socket) return;

        console.log("Trying to join room:", roomId);

        socket.emit('joinRoom', { roomId });

        socket.on('roomJoined', async (roomData) => {
            console.log('Joined room:', roomData);
            await startGame();
        });

        socket.on('roomFull', () => {
            setConnectionError('Room is full');
        });

        socket.on('roomNotFound', () => {
            setConnectionError('Room not found');
        });
    };

    const createRoom = () => {
        if (!socket) return;

        socket.emit('createRoom', { playerName });

        socket.on('roomCreated', async (roomData) => {
            console.log('Room created', roomData);
            await startGame();
        });
    };

    const startGame = async () => {
        setGameState('playing');

        try {
            const game = new Game(socket, playerName);
            window.gameInstance = game;
            //game.animate();
        } catch (error) {
            console.error('Game initialization failed:', error);
            setConnectionError('Failed to start game');
            setGameState('menu');
        }
    };

    const backToMenu = () => {
        if (socket) {
            socket.disconnect();
            setSocket(null);
        }
        if (window.gameInstance) {
            window.gameInstance.cleanup?.();
            window.gameInstance = null;
        }
        setGameState('menu');
        setConnectionError('');
        setAvailableRooms([]);
    };

    if (gameState == 'playing') {
        return (
            <>
                <div className="game-ui">
                    <button
                        className="back-button"
                        onClick={backToMenu}
                    >Back</button>
                </div>
                <div className="game-hud">
                    <HealthBar health={playerHealth} />
                    <WeaponDisplay weapon={currentWeapon} />
                    <FPSCounter fps={gameFPS} />
                </div>
            </>
        );
    }

    return (
        <div className="menu-container">
            <div className="menu-content">
                <h1>Facing Worlds</h1>

                {!socket ? ( // if no socket send to main menu
                    <div className="main-menu">
                        <div className="input-group">
                            <label>Player Name:</label>
                            <input
                                type="text"
                                name="userName"
                                onChange={(e) => setPlayerName(e.target.value)}
                                placeholder="Enter a name"
                                maxLength={20}
                                defaultValue=''
                            />
                        </div>

                        <div className="input-group">
                            <label>Server URL:</label>
                            <input
                                type="text"
                                onChange={(e) => setServerUrl(e.target.value)}
                                value={serverUrl}
                                placeholder="http://localhost:3000"
                            />
                        </div>

                        <button
                            className="primary-button"
                            onClick={connectToServer}
                        >
                            Connect to Server
                        </button>

                        {connectionError && (
                            <div className="error-message">
                                {connectionError}
                            </div>
                        )}
                    </div>
                ) : ( // if socket send them to room menu
                    <div className="room-menu">
                        <h2>Welcome, {playerName}!</h2>

                        <div className="room-actions">
                            <button
                                className="primary-button"
                                onClick={createRoom}
                            >
                                Create New Room
                            </button>
                        </div>

                        <div className="room-list">
                            <h3>Available Rooms:</h3>
                            {availableRooms.length === 0 ? (
                                <p>No rooms available. Create one to start playing!</p>
                            ) : (
                                availableRooms.map((room) => (
                                    <div key={room.id} className="room-item">
                                        <div className="room-info">
                                            <span className="room-name">Room {room.id}</span>
                                            <span className="room-players">
                                                {room.playerCount}/{room.maxPlayers} players
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => joinRoom(room.id)}
                                            disabled={room.playerCount >= room.maxPlayers}
                                            className={room.playerCount >= room.maxPlayers ? 'disabled' : ''}
                                        >
                                            {room.playerCount >= room.maxPlayers ? 'Full' : 'Join'}
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        <button
                            className="secondary-button"
                            onClick={backToMenu}
                        >
                            Disconnect
                        </button>

                        {connectionError && (
                            <div className="error-message">
                                {connectionError}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default App;