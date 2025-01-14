import * as THREE from 'three';
import { Collider } from './collider.js';

export class Player {
    constructor(scene, world) {
        this.world = world;
        this.onGround = false;
        this.velocity = {x: 0, y: 0};
        this.size = {x: 1, y: 1};
        this.position = {x: 10, y: 15};
        this.maxVelocity = 0.3;
        this.minVelocity = -0.3;
        this.friction = -0.1;
        this.jumpSpeed = 1;
        this.gravity = -0.05;

        // player cube
        const geometry = new THREE.BoxGeometry(this.size.x, this.size.y, 1.0);
        const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.set(this.x,this.y,0);

        scene.add(this.mesh);

        this.setupControls();
    }

    get playerPosition() {
        return {x: this.position.x, y: this.position.y};
    }

    set playerPosition({x, y}) {
        this.position.x = x;
        this.position.y = y;
    }

    setupControls() {
        this.keys = {};

        window.addEventListener('keydown', (e) => {
            this.keys[e.key] = true;
        });
        window.addEventListener('keyup', (e) => {
            this.keys[e.key] = false;
        });
    }

    update() {
        const speed = 0.01;

        const nextPosition = {
            x: this.position.x,
            y: this.position.y
        };

        if (!this.onGround) {
            this.velocity.y += this.gravity;
        }

        if (this.keys['ArrowLeft'] || this.keys['a']) {
            if (this.velocity.x <= this.minVelocity) {
                this.velocity.x = this.minVelocity;
            } else {
                this.velocity.x -= speed;
            }
        }
        else if (this.keys['ArrowRight'] || this.keys['d']) {
            if (this.velocity.x >= this.maxVelocity) {
                this.velocity.x = this.maxVelocity;
            } else{
                this.velocity.x += speed;
            }
        }
        else {
            this.velocity.x = 0;
        }
        
        if ((this.keys['ArrowUp'] || this.keys['w']) && this.onGround) {
            this.velocity.y = this.jumpSpeed;
            this.onGround = false;
        }

        nextPosition.x += this.velocity.x;
        nextPosition.y += this.velocity.y;

        const playerBox = Collider.getBoundingBox(nextPosition, this.size);

        let collision = false;

        const nearbyBlocks = this.world.getBlocksInArea(
            Math.floor(nextPosition.x - 2),
            Math.floor(nextPosition.y - 2),
            Math.floor(nextPosition.x + 2),
            Math.floor(nextPosition.y + 2)
        );

        for (let block of nearbyBlocks) {
            const blockBox = Collider.getBoundingBox ({ x: block.position.x, y: block.position.y }, { x: 1, y: 1 });
            if (Collider.checkCollision(playerBox, blockBox)) {
                collision = true;
                // player above block
                if (this.position.y > block.position.y && this.velocity.y < 0) {
                    nextPosition.y = block.position.y + (this.size.y / 2) + (1 / 2);
                    this.velocity.y = 0;
                    this.onGround = true;
                }
                // player is under block
                if (this.position.y < block.position.y && this.velocity.y > 0) {
                    nextPosition.y = (block.position.y - 1) - (this.size.y / 2) + (1 / 2);
                    this.velocity.y = -0.01;
                }

                // player is horizontal to box
                if (this.velocity.x > 0 && nextPosition.y < block.position.y + 1) {
                    nextPosition.x = block.position.x - (this.size.x / 2) - (1 / 2);
                    this.velocity.x = 0;
                }
                else if (this.velocity.x < 0 && nextPosition.y < block.position.y + 1) {
                    nextPosition.x = block.position.x + (this.size.x / 2) + (1 / 2);
                    this.velocity.x = 0;
                }
            }
        }

        console.log(`On ground: ${this.onGround} Velocity x: ${this.velocity.x}`)
        //console.log(`Player x: ${nextPosition.x}`);
        //console.log(`Player y: ${nextPosition.y}`);

        this.mesh.position.set(nextPosition.x, nextPosition.y, 0.0);
        this.position.x = nextPosition.x;
        this.position.y = nextPosition.y;
    }
}