import * as THREE from 'three';
import { OtherPlayer } from './otherplayer.js';
import { Player } from './player.js';
import { Projectiles } from './projectiles.js';
import { World } from './world.js';

export class Game {
    constructor(socket) {
        this.socket = socket;
        this.otherPlayers = new Map();

        this.aspectRatio = 16/9;

        this.windowHeight = window.innerHeight;
        this.windowWidth = this.windowHeight * this.aspectRatio;

        this.scene = new THREE.Scene();
        this.listener = new THREE.AudioListener();

        this.camera = new THREE.PerspectiveCamera(90, this.windowWidth / this.windowHeight);
        this.camera.add(this.listener);
        const canvas = document.querySelector('canvas.webgl');

        try {
            this.renderer = new THREE.WebGLRenderer({canvas: canvas})
        } catch {
            alert("WebGL failed to initialize. Try restarting your browser or check your browser's compatibility.");
        }
        this.renderer.setSize(this.windowWidth, this.windowHeight);

        return new Promise((resolve, reject) => {
            // Store the resolve and reject functions as instance methods
            this.resolveWorldLoad = resolve;
            this.rejectWorldLoad = reject;
    
            // Track world loading state
            this.worldLoaded = false;
    
            // Listen for initial world state
            this.socket.on('initialWorldState', (worldState) => {
                try {
                    let worldMap = new Map(JSON.parse(worldState));
                    
                    this.world = new World(this.scene, worldMap, this.listener);

                    console.log(`World loaded ${worldMap.size} blocks.`);
                    console.log("About to load player");
                    
                    // Create player after world is loaded
                    const playerStartPosition = new THREE.Vector2(10,10);

                    this.player = new Player(
                        this.scene,
                        this.world,
                        this.camera,
                        playerStartPosition,
                        this,
                        this.listener
                    );

                    // creates a class to handle all projectiles in the world
                    this.projectiles = new Projectiles(this.scene);

                    this.socket.emit('playerJoin', this.player.position, this.player.velocity);

                    this.scene.add(this.camera);
            
                    // sun light
                    const directionalLight = new THREE.DirectionalLight( 0xffffff, 1.2 );
                    directionalLight.position.set(-1,1,1);
                    this.scene.add( directionalLight );
            
                    const light = new THREE.AmbientLight( 0x4A6A8C ); // soft white light
                    this.scene.add( light );

                    this.loadSkyBox();
            
                    // time stamp for interpolation
                    this.lastUpdateTime = performance.now();
            
                    this.updateRate = 15; // milliseconds
                    this.lastUpdateSent = 0;
            
                    // buffer for interpolation
                    this.positionBuffer = new Map();
            
                    this.setupSocketListeners();
                    this.setupEventListeners();
                    this.animate();
    
                    // Mark world as loaded
                    this.worldLoaded = true;
    
                    // Resolve the promise with the game instance
                    this.resolveWorldLoad(this);
                } catch (error) {
                    // Reject if world creation fails
                    this.rejectWorldLoad(error);
                }
            });
    
            // Set up timeout for world loading
            setTimeout(() => {
                if (!this.worldLoaded) {
                    this.rejectWorldLoad(new Error("Failed to load world within 5 seconds"));
                }
            }, 5000);
        });
        
    }

    setupSocketListeners() {
        this.socket.on('playerJoined', (playerData) => {
            console.log('Player joined:', playerData.id);
            if (!this.otherPlayers.has(playerData.id)) {
                const newPlayer = new OtherPlayer(
                    this.scene,
                    this.world,
                    new THREE.Vector2().copy(playerData.velocity),
                    new THREE.Vector2().copy(playerData.position)
                );
                this.otherPlayers.set(playerData.id, newPlayer);
            }
        });

        // probably will use this to update player position and everything else
        this.socket.on('playerMoved', (updateData) => {
            const player = this.otherPlayers.get(updateData.id);
            if (player) {
                // store in position buffer for interpolation
                if (!this.positionBuffer.has(updateData.id)) {
                    this.positionBuffer.set(updateData.id, []);
                }

                // update the player health
                player.health = updateData.health;

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
                console.log(`Player ${playerId} recieved ${amount} damage`);
            } else {
                this.player.damage(rayDirection, amount);
                console.log(`Received: ${amount} damage from player ${damageInfo.playerId}`);
            }
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
        this.player.didDamage = false;
    }

    setupEventListeners() {
        window.addEventListener('resize', () => {
            this.windowHeight = window.innerHeight;
            this.windowWidth = this.windowHeight * this.aspectRatio;

            this.camera.aspect = this.windowWidth / this.windowHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize( this.windowWidth, this.windowHeight );
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

        this.player.update();
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
        this.camera.lookAt(this.player.position.x,this.player.position.y,0);

        this.sendBlockInformation();
        this.sendPVPInfo();

        this.projectiles.update();
        
        this.lastUpdateTime = currentTime;
    }
    render() {
        this.renderer.render(this.scene, this.camera);
    }

    // updates all the other players in the otherPlayers map
    updateOtherPlayers(deltaTime) {
        for (const [playerId, player] of this.otherPlayers) {
            const buffer = this.positionBuffer.get(playerId);
            if (buffer && buffer.length >= 2) {
                this.interpolatePlayerPosition(player, buffer, deltaTime);
            }

            // apply prediction based on velocity
            player.position.add( player.velocity.clone().multiplyScalar(deltaTime) );
            player.player.position.copy(player.position);

                        
            // update collisions
            player.update();
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

        //console.log(buffer.length);

        //console.log("_________________________");
        //console.log(`buffer[0]: ${buffer[0].timestamp} end of buffer: ${buffer[buffer.length - 1].timestamp}`)

        for (let i = buffer.length - 1; i > 0; i--) {
            if (buffer[i].timestamp > currentTime) {
                previousUpdate = buffer[i - 1];
                nextUpdate = buffer[i];
                console.log("Buffer loop buffer loop buffer loop");
                
            }
        }

        //let total = nextUpdate.timestamp - previousUpdate.timestamp;
        //let progress = (currentTime - previousUpdate.timestamp) / total;
        //console.log("_________________________________________")
        //console.log(`Previous Update: ${previousUpdate.timestamp} Next Update: ${nextUpdate.timestamp} Difference: ${nextUpdate.timestamp - previousUpdate.timestamp}`);
        //console.log(`Current time: ${currentTime} Difference from previous update: ${currentTime - previousUpdate.timestamp}`)
        //console.log(`Total: ${total}  Progress = ${progress}`);

        // sets this vector to be the vector linearly interpolated between v1 and v2 by progress
        player.position.lerpVectors(
            previousUpdate.position,
            nextUpdate.position,
            0.2
        );
        // ditto
        player.velocity.lerpVectors(
            previousUpdate.velocity,
            nextUpdate.velocity,
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

        const textureCube = loader.load ( [
// load order: right, left, top, bottom, front, back
            'skyboxRT.png', 'skyboxLF.png',
            'skyboxUP.png', 'skyboxDN.png',
            'skyboxFT.png', 'skyboxBK.png'
        ] );


        this.scene.background = textureCube;

        // environment map not used but could be used for reflecting materials off the skybox later
        const material = new THREE.MeshBasicMaterial( {
            color: 0xffffff,
            envMap: textureCube
        });

    }
}