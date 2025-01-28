import * as THREE from 'three';
import { OtherPlayer } from './otherplayer.js';
import { Player } from './player.js';
import { World } from './world.js';

export class Game {
    constructor(socket) {
        this.socket = socket;
        this.otherPlayers = new Map();

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight);
        const canvas = document.querySelector('canvas.webgl')

        try {
            this.renderer = new THREE.WebGLRenderer({canvas: canvas})
        } catch {
            alert("WebGL failed to initialize. Try restarting your browser or check your browser's compatibility.");
        }
        this.renderer.setSize(window.innerWidth, window.innerHeight);

        // get initial world state
        // -----------------------------------------------------------------------------------------
        // FIX THIS, THIS NEEDS TO LOAD BEFORE THE PLAYER DOES!!!!
        // -----------------------------------------------------------------------------------------

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
                    
                    this.world = new World(this.scene, worldMap);


                    const block = this.world.blocks.get(`${4},${4}`);
                    
                    console.log(`World loaded ${worldMap.size} blocks.`);

                    console.log("About to load player");
                    
                    // Create player after world is loaded
                    const playerStartPosition = new THREE.Vector2(10,10);
                    this.player = new Player(
                        this.scene,
                        this.world,
                        this.camera,
                        playerStartPosition
                    );

                    console.log("Adding scene");
                    this.scene.add(this.camera);
            
                    // sun light
                    const directionalLight = new THREE.DirectionalLight( 0xffffff, 1.2 );
                    directionalLight.position.set(-1,1,1);
                    this.scene.add( directionalLight );
            
                    const light = new THREE.AmbientLight( 0x404040 ); // soft white light
                    this.scene.add( light );
            
                    // time stamp for interpolation
                    this.lastUpdateTime = performance.now();
            
                    this.updateRate = 15; // milliseconds
                    this.lastUpdateSent = 0;
            
                    // buffer for interpolation
                    this.positionBuffer = new Map();
            
                    this.setupSocketListeners()
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

        this.socket.on('playerMoved', (updateData) => {
            const player = this.otherPlayers.get(updateData.id);
            if (player) {
                // store in postion buffer for interpolation
                if (!this.positionBuffer.has(updateData.id)) {
                    this.positionBuffer.set(updateData.id, []);
                }
                const buffer = this.positionBuffer.get(updateData.id);
                buffer.push({
                    position: new THREE.Vector2().copy(updateData.position),
                    velocity: new THREE.Vector2().copy(updateData.velocity),
                    timestamp: performance.now()
                });
                // keeping only last second of buffer data
                // shouldn't use a while loop, look back at this later
                buffer = buffer.filter(entry => entry.timestamp > performance.now() - 500);
                
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

    sendPlayerPosition() {
        this.socket.emit('playerUpdate', {
            position: this.player.position,
            velocity: this.player.velocity,
            timestamp: performance.now()
        });
    }

    setupEventListeners() {
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize( window.innerWidth, window.innerHeight );
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
                console.log("TRUKE NUKE!!!!!!!!!!!!!!!!!!");
                
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
            timestamp: performance.now()
        });
    }
}