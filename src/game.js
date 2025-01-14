import * as THREE from 'three';
import { Player } from './player.js';
import { World } from './world.js';

export class Game {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight);
        const canvas = document.querySelector('canvas.webgl')

        this.renderer = new THREE.WebGLRenderer({canvas: canvas})
        this.renderer.setSize(window.innerWidth, window.innerHeight);

        this.world = new World(this.scene);
        this.player = new Player(this.scene, this.world);

        this.camera.position.set(this.player.playerPosition.x, this.player.playerPosition.y+1, 15);
        this.camera.lookAt(this.player.playerPosition.x,this.player.playerPosition.y,0);

        this.setupEventListeners();
        this.animate();
    }

    setupEventListeners() {
        window.addEventListener('resize', () => {
            const width = window.innerHeight;
            const height = window.innerHeight;

            this.camera.aspect(width / height);
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(width, height);
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
        this.camera.position.set(this.player.playerPosition.x, this.player.playerPosition.y+1, 15);
        this.camera.lookAt(this.player.playerPosition.x,this.player.playerPosition.y,0);
    }
    render() {
        this.renderer.render(this.scene, this.camera);
    }
}