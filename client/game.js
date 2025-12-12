import * as THREE from 'three';
import { GLTFLoader } from '../node_modules/three/examples/jsm/loaders/GLTFLoader';
import { Player } from './player.js';
import { Projectiles } from './projectiles.js';
import { World } from './world.js';
import { GameState } from '../shared/gamestate.js';
import { Controls } from './controls.js'
import { Item } from './item.js'


// CHANGE CLIENT SIDE PLAYER UPDATES TO socket.volatile.emit
// WILL NOT SEND BUFFERED INFORMATION IS CONNECTION IS UNSTEADY!

export class Game {
    constructor(socket, playerName, setLoadingProcess, setLoadingStatus, setGameState) {
        this.socket = socket;
        this.playerName = playerName;
        this.setLoadingProcess = setLoadingProcess;
        this.setLoadingStatus = setLoadingStatus;
        this.setGameState = setGameState;

        this.playerTeam;
        this.cameraMinY = 3;
        this.spawnPoint;
        // for communication with server
        this.updateRate = 25; // milliseconds
        this.lastUpdateSent = 0;

        this.otherPlayers = new Map();
        this.gameModels = new Map();
        this.gameState = new GameState();

        this.playerModels = {
            blueRobot: './models/bluerobot.glb',
            redRobot: './models/redrobot.gltf'
        };
        this.modelList = {
            earth: './models/earth/earth.gltf'
        }

        this.loadedModels = new Map();

        // using this to calculate FPS
        this.frameCount = 0;
        this.FPS = 0;
        this.timeElapsed = 0;

        this.aspectRatio = 16 / 9;

        this.windowHeight = window.outerHeight;
        //this.windowWidth = this.windowHeight * this.aspectRatio;
        this.windowWidth = window.outerWidth;

        this.scene = new THREE.Scene();
        this.listener = new THREE.AudioListener();

        this.skyScene = new THREE.Scene();

        this.camera = new THREE.PerspectiveCamera(60, this.windowWidth / this.windowHeight);
        this.camera.add(this.listener);
        const canvas = document.querySelector('canvas.webgl');

        this.skyCamera = new THREE.PerspectiveCamera(60, this.windowWidth / this.windowHeight);

        try {
            this.renderer = new THREE.WebGLRenderer({ canvas: canvas })
        } catch {
            alert("WebGL failed to initialize. Try restarting your browser or check your browser's compatibility.");
        }
        this.renderer.setSize(this.windowWidth, this.windowHeight);

        this.initializationFinished = new Promise((resolve, reject) => {
            this.resolveInitilization = resolve;
            this.rejectInitilization = reject;
        });

        this.initializeGame();
    }


    async initializeGame() {
        try {
            const initSteps = 6;
            let currentStep = 0;

            const updateProcess = (status) => {
                currentStep++;
                this.setLoadingProcess((currentStep / initSteps) * 100);
                this.setLoadingStatus(status);
            };


            updateProcess('Connecting to server...');
            await this.getAssignedTeam();

            updateProcess('Loading other players...');
            this.otherPlayers = await this.getOtherPlayers();

            updateProcess('Getting world...');
            this.world = await this.loadWorld();

            updateProcess('Loading models...');
            const playerModel = await this.loadPlayerModel(this.playerTeam);
            this.player = await this.loadPlayer(playerModel);

            for (const player of this.otherPlayers) {
                let otherPlayerModel = await this.loadPlayerModel(player[1].playerTeam);
                if (!this.otherPlayers.has(player.socketId)) {
                    const newPlayer = new Player(
                        this.scene,
                        this.world,
                        player[1].velocity,
                        player[1].spawnPoint,
                        player[1].health || 100,
                        this.listener,
                        player[1].playerName,
                        player[1].playerTeam,
                        otherPlayerModel,
                        player[1].id
                    );

                    this.otherPlayers.set(player[1].id, newPlayer);
                }
            }

            this.loadedModels = await this.loadAllModels();
            const earthModel = this.loadedModels.get('earth')
            earthModel.position.set(-300, -450, -500);
            earthModel.scale.set(5, 5, 5);
            earthModel.rotation.set(0, 0, 0);
            this.skyScene.add(earthModel);

            const innerAtmosphere = new THREE.Mesh(
                new THREE.SphereGeometry(510, 32, 32),
                new THREE.MeshBasicMaterial({
                    color: 0x6699ff,
                    transparent: true,
                    opacity: 0.3,
                    side: THREE.BackSide
                })
            );
            innerAtmosphere.position.copy(earthModel.position);
            this.skyScene.add(innerAtmosphere);

            const outerAtmosphere = new THREE.Mesh(
                new THREE.SphereGeometry(525, 32, 32),
                new THREE.MeshBasicMaterial({
                    color: 0x88ccff,
                    transparent: true,
                    opacity: 0.1,
                    side: THREE.BackSide
                })
            );
            outerAtmosphere.position.copy(earthModel.position);
            this.skyScene.add(outerAtmosphere);

            const sun = new THREE.Mesh(
                new THREE.SphereGeometry(15, 32, 32),
                new THREE.MeshBasicMaterial({
                    color: 0xfffff0,
                })
            );

            sun.position.set(400, 50, -800);
            this.skyScene.add(sun);

            updateProcess('Setting up the game...');
            this.projectiles = new Projectiles(this.scene);
            this.scene.add(this.camera);

            // sun light
            const skyAmbientLight = new THREE.AmbientLight(0x6699cc, 0.05); // Soft blue light
            this.skyScene.add(skyAmbientLight);

            const stageAmbientLight = new THREE.AmbientLight(0xffffff, 0.3); // Soft white light
            this.scene.add(stageAmbientLight);

            const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
            directionalLight.position.copy(sun.position);
            this.scene.add(directionalLight);
            this.skyScene.add(directionalLight);

            this.loadSkyBox();

            // time stamp for interpolation
            this.lastUpdateTime = performance.now();

            this.setupSocketListeners();

            this.socket.off('initialWorldState');
            this.socket.off('initialPlayerStates');
            this.socket.off('teamAssigned');

            this.items = [
                new Item('placer', this.scene, this.world, this.camera, this, this.player),
                new Item('remover', this.scene, this.world, this.camera, this, this.player),
                new Item('weapon', this.scene, this.world, this.camera, this, this.player)
            ];

            this.controls = new Controls(this.camera, this, this.items, this.player, this.world);

            this.items.forEach((item) => {
                item.mouseRaycaster = this.controls.mouseRaycaster;
            });

            updateProcess('Done!');
            console.log("Game initilized successfully");

            this.resolveInitilization();


            this.animate();

        } catch (error) {
            console.error('Initilization error:', error);
            this.rejectInitilization(error);
            throw error;
        }
    }

    getAssignedTeam() {
        return new Promise((resolve, reject) => {
            this.socket.on('teamAssigned', (team) => {
                try {
                    console.log(`Assigned team: ${team}`);
                    this.playerTeam = team.playerTeam;
                    this.spawnPoint = team.spawnPoint;
                    resolve(team);
                } catch (error) {
                    console.error("Couldn't get assigned team", error);
                    reject(error);
                }
            });
        });
    }

    // this can be only used to load models that are spawned once
    loadAllModels() {
        return new Promise((resolve, reject) => {
            let modelMap = new Map();
            const gltfLoader = new GLTFLoader();
            const modelKeys = Object.keys(this.modelList);
            let loadedCount = 0;

            for (const model of modelKeys) {
                gltfLoader.load(this.modelList[model], (loadedModel) => {
                    let newModel = new THREE.Object3D();
                    newModel = loadedModel.scene;
                    modelMap.set(model, newModel);
                    loadedCount++;

                    if (loadedCount === modelKeys.length) {
                        resolve(modelMap);
                    }
                },
                    undefined, // This is part of GLTFLoader async error handling
                    (error) => {
                        console.error(`Failed to load model: ${model}`, error);
                        reject(error);
                    });
            }
        });
    }

    getOtherPlayers() {
        return new Promise((resolve, reject) => {
            this.socket.on('initialPlayerStates', (playerStates) => {
                try {
                    let otherPlayers = new Map(JSON.parse(playerStates));
                    // remove this instance of the player from the 'other players' map
                    otherPlayers.delete(this.socket.id);
                    resolve(otherPlayers);
                } catch (error) {
                    console.error("Failed to load players:", error);
                    reject(error);
                }
            });
        });
    }

    loadWorld() {
        return new Promise((resolve, reject) => {
            this.socket.on('initialWorldState', (worldState) => {
                try {
                    let worldMap = new Map(JSON.parse(worldState));
                    let loadedWorld = new World(this.scene, worldMap, this.listener);

                    resolve(loadedWorld)
                } catch (error) {
                    console.error("Failed to load world:", error);
                    reject(error);
                }
            });
        });
    }

    loadPlayerModel(playerTeam) {
        return new Promise((resolve, reject) => {
            let playerModel = new THREE.Object3D();
            const gltfLoader = new GLTFLoader();
            if (playerTeam === 'blue') {
                gltfLoader.load(this.playerModels.blueRobot, (model) => {

                    playerModel = model.scene;
                    playerModel.animations = model.animations;
                    playerModel.scale.set(0.5, 0.5, 0.5);

                    resolve(playerModel);
                },
                    undefined, // This is part of GLTFLoader async error handling
                    (error) => {
                        console.error(`Failed to load model: ${model}`, error);
                        reject(error);
                    });
            } else if (playerTeam === 'red') {
                gltfLoader.load(this.playerModels.redRobot, (model) => {

                    playerModel = model.scene;
                    playerModel.animations = model.animations;
                    playerModel.scale.set(0.5, 0.5, 0.5);

                    resolve(playerModel);
                },
                    undefined, // This is part of GLTFLoader async error handling
                    (error) => {
                        console.error(`Failed to load model: ${model}`, error);

                        reject(error);
                    });
            }
        });
    }

    loadPlayer(model) {
        return new Promise((resolve, reject) => {
            try {
                const player = new Player(
                    this.scene,
                    this.world,
                    { x: 0, y: 0, z: 0 }, // velocity
                    this.spawnPoint,
                    100, //health
                    this.listener,
                    this.playerName,
                    this.playerTeam,
                    model,
                    this.socket.id
                );
                resolve(player);
            } catch (error) {
                console.error("Failed to load player", error);
                reject(error)
            }
        });
    }

    async loadNewPlayer(playerData) {
        let model = await this.loadPlayerModel(playerData.playerTeam);
        model.userData

        if (!this.otherPlayers.has(playerData.id)) {
            const newPlayer = new Player(
                this.scene,
                this.world,
                new THREE.Vector3().copy(playerData.velocity),
                new THREE.Vector3().copy(playerData.position),
                playerData.health || 100,
                this.listener,
                playerData.playerName,
                playerData.playerTeam,
                model,
                playerData.id
            );

            this.otherPlayers.set(playerData.id, newPlayer);
        }
    }

    setupSocketListeners() {
        this.socket.on('playerJoined', (playerData) => {
            this.loadNewPlayer(playerData);
        });

        // Updates player movement
        this.socket.on('playerMoved', (updateData) => {
            const player = this.otherPlayers.get(updateData.id);
            if (player) {
                this.updateOtherPlayerPosition(updateData, player);
            }
        });

        this.socket.on('mapUpdated', (blockData) => {
            console.log("Recieved block update:", blockData.updateType);
            const x = blockData.x;
            const y = blockData.y;
            if (blockData.updateType === 'added') {
                this.world.createBlock(x, y);
            }
            else if (blockData.updateType === 'removed') {
                this.world.removeBlock(x, y);
            }
            else if (blockData.updateType === 'damaged') {
                this.world.updateBlockHealth(x, y, blockData.health)
            }
        });

        this.socket.on('playerDamaged', (damageInfo) => {
            const rayDirection = damageInfo.rayDirection;
            const amount = damageInfo.damage;
            const playerId = damageInfo.playerId;

            const player = this.otherPlayers.get(playerId);
            // If the player ID isn't in the otherPlayers map then just assume that it's the player character
            // Not a very good system
            if (player) {
                player.damage(rayDirection, amount);
            } else {
                this.player.damage(rayDirection, amount);
            }
        });

        this.socket.on('otherPlayerFiredDamagedBlock', (shotInfo, playerid) => {
            // change to a vector because it's not a vector object when its sent over
            const vectorRay = new THREE.Vector3(shotInfo.rayDirection.x, shotInfo.rayDirection.y, 0);
            const otherPlayer = this.otherPlayers.get(playerid);
            otherPlayer.playSound('shot');

            this.projectiles.createBeam(
                vectorRay,
                shotInfo.playerPosition,
                shotInfo.blockPosition
            )
        });

        this.socket.on('otherPlayerFired', (shotInfo, playerid) => {
            // change to a vector because it's not a vector object when its sent over
            const vectorRay = new THREE.Vector3(shotInfo.rayDirection.x, shotInfo.rayDirection.y, 0);
            const otherPlayer = this.otherPlayers.get(playerid);
            otherPlayer.playSound('shot');
            this.projectiles.createBeam(
                vectorRay,
                shotInfo.playerPosition
            )
        });

        this.socket.on('playerRespawn', (playerid) => {
            const otherPlayer = this.otherPlayers.get(playerid);
            if (otherPlayer) {
                otherPlayer.respawn();
            }

            if (playerid === this.socket.id) {
                console.log("Respawning player");
                this.setGameState('playing');
                this.player.respawn();
            }

        });

        this.socket.on('playerLeft', (playerId) => {
            const otherPlayer = this.otherPlayers.get(playerId);
            if (otherPlayer) {
                console.log(`Player left: ${playerId}`);
                this.scene.remove(otherPlayer.player);
                this.otherPlayers.delete(playerId);
            }
        });

        this.socket.on('roomJoined', (roomData) => {
            console.log('Successfully joined room:', roomData);
        });

        this.socket.on('roomCreated', (roomData) => {
            console.log('Successfully created room:', roomData);
        });

        this.socket.on('roomLeft', () => {
            console.log('Left the room');
        });

        this.socket.on('gameStateUpdate', (update) => {
            this.gameState.timeRemaining = update.timeRemaining;
            this.gameState.teamScore.red = update.redTeamScore;
            this.gameState.teamScore.blue = update.blueTeamScore
        });
    }

    updateOtherPlayerPosition(updateData, player) {
        player.position = updateData.position;
        player.velocity = updateData.velocity;
        player.health = updateData.health;
        player.lookDirection = updateData.lookDirection;
    }

    sendBlockInformation() {
        if (this.world.blockAdded) {
            this.socket.emit('blockModified', {
                updateType: 'added',
                x: this.world.lastBlockModified.x,
                y: this.world.lastBlockModified.y
            });
            this.world.blockAdded = false;
        }
        else if (this.world.blockRemoved) {
            this.socket.emit('blockModified', {
                updateType: 'removed',
                x: this.world.lastBlockModified.x,
                y: this.world.lastBlockModified.y
            });
            this.world.blockRemoved = false;
        }
        else if (this.world.blockDamaged) {
            this.socket.emit('blockModified', {
                updateType: 'damaged',
                x: this.world.lastBlockModified.x,
                y: this.world.lastBlockModified.y,
                health: this.world.damagedBlockHealth
            });
            this.world.blockDamaged = false;
        }
    }

    sendPlayerPosition() {
        this.socket.emit('playerUpdate', {
            position: this.player.position,
            velocity: this.player.velocity,
            health: this.player.health,
            lookDirection: this.player.lookDirection,
            timeStamp: performance.now()
        });
    }

    sendPVPInfo() {
        if (this.player.didDamage) {
            this.socket.emit('playerHit', {
                playerId: this.player.playerDamaged,
                damage: this.player.damageDealt,
                rayDirection: {
                    x: this.player.playerRayDirection.x,
                    y: this.player.playerRayDirection.y
                }
            });
        }

        if (this.player.fired) {
            if (this.world.blockDamaged) {
                this.socket.emit('playerFiredDamagedBlock', {
                    rayDirection: {
                        x: this.player.playerRayDirection.x,
                        y: this.player.playerRayDirection.y
                    },
                    playerPosition: {
                        x: this.player.position.x,
                        y: this.player.position.y
                    },
                    blockPosition: {
                        x: this.world.lastBlockModified.x,
                        y: this.world.lastBlockModified.y
                    }
                });
            }
            else {
                this.socket.emit('playerFired', {
                    rayDirection: {
                        x: this.player.playerRayDirection.x,
                        y: this.player.playerRayDirection.y
                    },
                    playerPosition: {
                        x: this.player.position.x,
                        y: this.player.position.y
                    }
                });
            }
            this.player.didDamage = false;
            this.player.fired = false;
        }
    }

    leaveRoom() {
        this.socket.emit('leaveRoom');
        this.cleanup();
    }

    setupEventListeners() {
        window.addEventListener('resize', () => {
            this.windowHeight = window.innerHeight;
            this.windowWidth = this.windowHeight * this.aspectRatio;

            this.camera.aspect = this.windowWidth / this.windowHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(this.windowWidth, this.windowHeight);
        }, false);
    }

    caluclateFps(currentTime) {
        this.frameCount++;
        this.timeElapsed += (currentTime - this.lastUpdateTime);
        if (this.timeElapsed / 1000 >= 1) {
            this.FPS = this.frameCount;
            this.timeElapsed = 0;
            this.frameCount = 0;
        }
    }

    updateOtherPlayers(deltaTime) {
        for (const player of this.otherPlayers) {
            player[1].update(deltaTime);
        }
    }

    loadSkyBox() {
        const loader = new THREE.CubeTextureLoader();
        loader.setPath('/skybox/');

        const textureCube = loader.load([
            // load order: right, left, top, bottom, front, back
            'skyboxRT.png', 'skyboxLF.png',
            'skyboxUP.png', 'skyboxDN.png',
            'skyboxFT.png', 'skyboxBK.png'
        ]);

        this.skyScene.background = textureCube;

        // environment map not used but could be used for reflecting materials off the skybox later
        const material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            envMap: textureCube
        });
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.update();
        this.render();
    }

    update() {
        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastUpdateTime) / 500;

        if (this.player.isDead) {
            this.setGameState('dead');
        }

        this.controls.update();

        this.caluclateFps(currentTime);
        this.player.update(deltaTime);
        this.player.mouseX = this.controls.mouse.x;
        this.world.update();

        // sends updates at constant rate rather than every frame at the speed of update rate
        if (currentTime - this.lastUpdateSent > this.updateRate) {
            this.sendPlayerPosition();
            this.lastUpdateSent = currentTime;
        }

        this.updateOtherPlayers(deltaTime);

        // update camera to follow player
        this.camera.position.set(this.player.position.x, Math.max(this.player.position.y + 3, this.cameraMinY), 25);
        this.camera.lookAt(this.player.position.x, this.player.position.y, 0);

        this.skyCamera.rotation.copy(this.camera.rotation);

        this.sendPVPInfo();
        this.sendBlockInformation();
        this.projectiles.update();

        this.lastUpdateTime = currentTime;
    }

    render() {
        this.renderer.autoClear = false;
        this.renderer.clear();
        this.renderer.render(this.skyScene, this.skyCamera);

        this.renderer.render(this.scene, this.camera);
        this.renderer.autoClear = true;
    }

    cleanup() {
        if (this.renderer) {
            this.renderer.dispose();
        }

        this.scene.traverse((object) => {
            if (object.geometry) {
                object.geometry.dispose();
            }
            if (object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach(material => material.dispose());
                } else {
                    object.material.dispose();
                }
            }
        });

        this.socket.off('playerJoined');
        this.socket.off('playerMoved');
        this.socket.off('playerLeft');
        this.socket.off('playerDamaged');
        this.socket.off('otherPlayerFired');
        this.socket.off('otherPlayerFiredDamagedBlock');
        this.socket.off('mapUpdated');
        this.socket.off('roomJoined');
        this.socket.off('roomLeft');

        this.otherPlayers.clear();

        console.log('Game cleaned up successfully');
    }
}