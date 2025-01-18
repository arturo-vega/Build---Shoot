import * as THREE from 'three';
import { Player } from './player.js';
import { World } from './world.js';

export class Game {
    constructor() {
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

        this.camera.position.set(this.player.playerPosition.x, this.player.playerPosition.y, 10);
        this.camera.lookAt(this.player.playerPosition.x,this.player.playerPosition.y,0);

        this.scene.add(this.camera);

        // sun light
        const directionalLight = new THREE.DirectionalLight( 0xffffff, 1.2 );
        directionalLight.position.set(-1,1,1);
        this.scene.add( directionalLight );

        const light = new THREE.AmbientLight( 0x404040 ); // soft white light
        this.scene.add( light );

        this.setupEventListeners();
        this.animate();
        
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
        this.player.update();
        this.world.update();
        // update camera to follow player
        this.camera.position.set(this.player.playerPosition.x, this.player.playerPosition.y, 7);
        this.camera.lookAt(this.player.playerPosition.x,this.player.playerPosition.y,0);
    }
    render() {
        this.renderer.render(this.scene, this.camera);
    }
}