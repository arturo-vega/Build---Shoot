import * as THREE from 'three';
import { OtherPlayer } from './otherplayer.js';
import { Player } from './player.js';
import { World } from './world.js';

export class Game {
    constructor(socket) {
        this.socket = socket;
        this.setupSocketListeners();
        this.otherPlayers = new Map();

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight);
        const canvas = document.querySelector('canvas.webgl')

        try {
            this.renderer = new THREE.WebGLRenderer({canvas: canvas})
        } catch {
            alert("WebGL failed to initialize. Try restarting your browser or check your browser's compatibiliy.");
        }
        this.renderer.setSize(window.innerWidth, window.innerHeight);

        this.world = new World(this.scene);
        this.player = new Player(this.scene, this.world, this.camera);

        // send initial player information to the server
        this.socket.emit('playerJoin', this.player.position, this.player.velocity);

        this.camera.position.set(this.player.position.x, this.player.position.y, 10);
        this.camera.lookAt(this.player.position.x,this.player.position.y,0);

        this.scene.add(this.camera);

        // sun light
        const directionalLight = new THREE.DirectionalLight( 0xffffff, 1.2 );
        directionalLight.position.set(-1,1,1);
        this.scene.add( directionalLight );

        const light = new THREE.AmbientLight( 0x404040 ); // soft white light
        this.scene.add( light );

        // time stamp for interpolation
        this.lastUpdateTime = performance.now();

        this.updateRate = 50; // milliseconds
        this.lastUpdateSent = 0;

        // buffer for interpolation
        this.positionBuffer = new Map();

        this.setupSocketListeners()
        this.setupEventListeners();
        this.animate();
        
    }

    setupSocketListeners() {
        this.socket.on('playerJoined', (playerData) => {
            console.log('Player joined:', playerData.id);
            console.log('Player position:', playerData.position);
            const newPlayer = new OtherPlayer(
                this.scene,
                this.world,
                new THREE.Vector2().copy(playerData.velocity),
                new THREE.Vector2().copy(playerData.position)
            );
            this.otherPlayers.set(playerData.id, newPlayer);
        });

        this.socket.on('playerMoved', (updateData) => {
            const player = this.otherPlayers.get(updateData.id);
            console.log('This is the updateData log', updateData);
            if (player) {
                // store in postion buffer for interpolation
                if (!this.positionBuffer.has(updateData.id)) {
                    this.positionBuffer.set(updateData.id, []);
                }
                const buffer = this.positionBuffer.get(updateData.id);
                buffer.push({
                    position: new THREE.Vector2().copy(updateData.position),
                    velocity: new THREE.Vector2().copy(updateData.velcoty),
                    timestamp: performance.now()
                });
                // keeping only last second of buffer data
                // shouldn't use a while loop, look back at this later
                while (buffer.length > 0 && buffer[0].timestamp < performance.now() - 1000) {
                    buffer.shift();
                }
            }
        });

        this.socket.on('playerLeft', (playerId) => {
            const player = this.otherPlayers.get(playerId);
            if (player) {
                console.log(`Player ${playerId} has left the game.`);
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
        const deltaTime = (currentTime - this.lastUpdateTime) / 1000;

        this.player.update();
        this.world.update();

        // sends updates at constant rate rather than every frame (every 50 milliseconds)
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
        const currentTime = performance.now();

        // the position buffer contains previous movements of other players along with a new movements
        // not yet rendered. We need to find the two movement positions we have the player currently
        // rendered
        let previousUpdate = buffer[0];
        let nextUpdate = buffer[1];

        for (let i = 1; i < buffer.length; i++) {
            if (buffer[i].timestamp > currentTime) {
                previousUpdate = buffer[i - 1];
                nextUpdate = buffer[i];
                break;
            }
        }

        const total = nextUpdate.timestamp - previousUpdate.timestamp;
        const progress = (currentTime - previousUpdate.timestamp) / total;

        // sets this vector to be the vector linearly interpolated between v1 and v2 by progress
        player.position.lerpVectors(
            previousUpdate.position,
            nextUpdate.positon,
            progress
        );
        // ditto
        player.velocity.lerpVectors(
            previousUpdate.velocity,
            nextUpdate.velocity,
            progress
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