import * as THREE from 'three';
import { GLTFLoader } from '../node_modules/three/examples/jsm/loaders/GLTFLoader';
import { OtherPlayer } from './otherplayer.js';
import { Player } from './player.js';
import { Projectiles } from './projectiles.js';
import { World } from './world.js';
import { ModelLoader } from './modelloader.js';

export class Game {
    constructor(socket, playerName) {
        this.socket = socket;
        this.playerName = playerName;
        this.playerTeam = 'blue'; // change this later

        this.otherPlayers = new Map();
        this.gameModels = new Map();

        this.modelList = {
            blueRobot: './models/bluerobot.gltf',
            redRobot: './models/redrobot.gltf'
        };

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

        this.camera = new THREE.PerspectiveCamera(100, this.windowWidth / this.windowHeight);
        this.camera.add(this.listener);
        const canvas = document.querySelector('canvas.webgl');

        try {
            this.renderer = new THREE.WebGLRenderer({ canvas: canvas })
        } catch {
            alert("WebGL failed to initialize. Try restarting your browser or check your browser's compatibility.");
        }
        this.renderer.setSize(this.windowWidth, this.windowHeight);

        this.initializeGame();
    }

    async initializeGame() {
        this.world = await this.loadWorld();
        let model = await this.loadModelPlayer();
        this.player = await this.loadPlayer(model);
        // creates a class to handle all projectiles in the world
        this.projectiles = new Projectiles(this.scene);

        this.scene.add(this.camera);

        // sun light
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
        directionalLight.position.set(-1, 1, 1);
        this.scene.add(directionalLight);

        const light = new THREE.AmbientLight(0x4A6A8C); // soft white light
        this.scene.add(light);

        this.loadSkyBox();

        // time stamp for interpolation
        this.lastUpdateTime = performance.now();

        // for communication with server
        this.updateRate = 15; // milliseconds
        this.lastUpdateSent = 0;

        // buffer for interpolation
        this.positionBuffer = new Map();

        this.setupSocketListeners();

        this.animate();
        //this.update();
    }

    loadWorld() {
        return new Promise((resolve, reject) => {
            this.socket.on('initialWorldState', (worldState) => {
                try {
                    let worldMap = new Map(JSON.parse(worldState));
                    let loadedWorld = new World(this.scene, worldMap, this.listener);

                    console.log(`World loaded ${worldMap.size} blocks.`);

                    resolve(loadedWorld)
                } catch (error) {
                    console.error("Failed to load world:", error);
                    reject(error);
                }
            });
        });
    }

    loadModelPlayer() {
        return new Promise((resolve, reject) => {
            let playerModel = new THREE.Object3D();
            const gltfLoader = new GLTFLoader();
            try {
                if (this.playerTeam === 'blue') {
                    gltfLoader.load(this.modelList.blueRobot, (model) => {
                        playerModel = model.scene;
                        playerModel.scale.set(0.5, 0.5, 1);
                        resolve(playerModel);
                    });
                } else {
                    gltfLoader.load(this.modelList.redRobot, (model) => {
                        playerModel = model.scene;
                        resolve(playerModel);
                    });
                }
            } catch (error) {
                console.error("Failed to load model:", model);
                reject(error);
            }

        });
    }

    loadPlayer(model) {
        return new Promise((resolve, reject) => {
            try {
                console.log("About to load player");

                const playerStartPosition = new THREE.Vector2(10, 10);
                const player = new Player(
                    this.scene,
                    this.world,
                    this.camera,
                    playerStartPosition,
                    this,
                    this.listener,
                    this.playerName,
                    this.playerTeam,
                    model
                );

                resolve(player);
            } catch (error) {
                console.error("Failed to load player", error);
                reject(error)
            }
        });
    }

    setupSocketListeners() {
        this.socket.on('playerJoined', (playerData) => {
            console.log(`Player ${playerData.name} joined`);
            if (!this.otherPlayers.has(playerData.id)) {
                const newPlayer = new OtherPlayer(
                    this.scene,
                    this.world,
                    new THREE.Vector2().copy(playerData.velocity),
                    new THREE.Vector2().copy(playerData.position),
                    playerData.health || 100,
                    this.listener,
                    playerData.name
                );

                // Work in giving players a name label in the game
                newPlayer.playerName = playerData.name;

                console.log(`NEW PLAYER ID IS: ${playerData.id}`);
                console.log(`NEW PLAYER NAME IS: ${playerData.name}`);

                this.otherPlayers.set(playerData.id, newPlayer);
            }
        });

        // Updates player movement
        this.socket.on('playerMoved', (updateData) => {
            const player = this.otherPlayers.get(updateData.id);
            if (player) {
                // store in position buffer for interpolation
                if (!this.positionBuffer.has(updateData.id)) {
                    this.positionBuffer.set(updateData.id, []);
                }

                this.updateOtherPlayerPosition(updateData, player);

                const buffer = this.positionBuffer.get(updateData.id);
                buffer.push({
                    position: new THREE.Vector2().copy(updateData.position),
                    velocity: new THREE.Vector2().copy(updateData.velocity),
                    timestamp: performance.now()
                });
                // keeping only last half second of buffer data
                this.positionBuffer.set(updateData.id, buffer.filter(entry => entry.timestamp > performance.now() - 500));

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
            // Not a very good system, change this
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

        this.socket.on('playerLeft', (playerId) => {
            const player = this.otherPlayers.get(playerId);
            if (player) {
                console.log(`Player left: ${playerId}`);
                this.scene.remove(player.player);
                this.otherPlayers.delete(playerId);
                this.positionBuffer.delete(playerId);
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
    }

    /*id: socket.id,
                position: updateData.position,
                velocity: updateData.velocity,
                health: updateData.health,
                timestamp: updateData.timestamp */

    updateOtherPlayerPosition(updateData, player) {
        player.position = updateData.position;
        player.velocity = updateData.velocity;
        player.health = updateData.health;
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
            timestamp: performance.now()
        });
    }

    // CHANGE THIS SO THAT IF A PLAYER FIRES AND HITS A PLAYER IT DRAWS A LINE TO THEM
    // ALSO ON THE FINAL SHOT THAT DESTROYS A BLOCK THE BEAM LENGTH IS 40 AND NOT HOWEVER
    // FAR AWAY THE BLOCK WAS WHEN IT WAS DESTROYED
    sendPVPInfo() {
        if (this.player.didDamage) {
            console.log('Sent player damage info');
            // send all the pvp flags from the player
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
            // send information if block was damaged to calculate beam distance
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
            // send information if a block wasn't damaged when player fired
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

    animate() {
        requestAnimationFrame(() => this.animate());
        this.update();
        this.render();
    }

    update() {
        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastUpdateTime) / 500;

        // calculate FPS
        this.frameCount++;
        this.timeElapsed += (currentTime - this.lastUpdateTime);
        if (this.timeElapsed / 1000 >= 1) {
            this.FPS = this.frameCount;
            this.timeElapsed = 0;
            this.frameCount = 0;
        }

        this.player.update(deltaTime);
        this.world.update();

        // sends updates at constant rate rather than every frame at the speed of update rate
        if (currentTime - this.lastUpdateSent > this.updateRate) {
            this.sendPlayerPosition();
            this.lastUpdateSent = currentTime;
        }
        // update players
        this.updateOtherPlayers(deltaTime);
        // update camera to follow player
        this.camera.position.set(this.player.position.x, this.player.position.y, 7);
        this.camera.lookAt(this.player.position.x, this.player.position.y, 0);

        // block information goes second to calculate beam distance
        this.sendPVPInfo();
        this.sendBlockInformation();

        this.projectiles.update();

        this.lastUpdateTime = currentTime;
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }

    // updates all the other players in the otherPlayers map
    updateOtherPlayers(deltaTime) {
        for (const [playerId, player] of this.otherPlayers) {

            console.log(`Updating other player: ${player.name} ${player.id}`);

            //const buffer = this.positionBuffer.get(playerId);

            //if (buffer && buffer.length >= 2) {
            //    this.interpolatePlayerPosition(player, buffer, deltaTime);
            //}

            // apply prediction based on velocity
            //player.position.add(player.velocity.clone().multiplyScalar(deltaTime));
            //player.player.position.copy(player.position);


            // update collisions
            player.update(deltaTime);
        }
    }

    interpolatePlayerPosition(player, buffer, deltaTime) {
        let currentTime = performance.now();
        // the position buffer contains previous movements of other players along with a new movements
        // not yet rendered. We need to find the two movement positions we have the player currently
        // rendered
        // work on this later
        let previousUpdate = buffer[buffer.length - 2];
        let nextUpdate = buffer[buffer.length - 1];

        for (let i = buffer.length - 1; i > 0; i--) {
            if (buffer[i].timestamp > currentTime) {
                previousUpdate = buffer[i - 1];
                nextUpdate = buffer[i];

            }
        }

        // sets this vector to be the vector linearly interpolated between v1 and v2 by progress
        player.position.lerpVectors(
            previousUpdate.position,
            nextUpdate.position * deltaTime,
            0.2
        );
        // ditto
        player.velocity.lerpVectors(
            previousUpdate.velocity,
            nextUpdate.velocity * deltaTime,
            0.2
        );
    }

    sendPlayerPosition() {
        this.socket.emit('playerUpdate', {
            position: this.player.position,
            velocity: this.player.velocity,
            health: this.player.health,
            timestamp: performance.now()
        });
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


        this.scene.background = textureCube;

        // environment map not used but could be used for reflecting materials off the skybox later
        const material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            envMap: textureCube
        });

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

        this.socket.off('initialWorldState');
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