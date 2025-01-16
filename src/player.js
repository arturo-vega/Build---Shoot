import * as THREE from 'three';

export class Player {
    constructor(scene, world) {
        this.world = world;
        this.onGround = false;
        this.velocity = {x: 0, y: 0};
        this.size = {x: 0.75, y: 1.75};
        this.position = {x: 10, y: 12};
        this.maxVelocity = 0.3;
        this.minVelocity = -0.3;
        this.friction = -0.1;
        this.jumpSpeed = .5;
        this.gravity = -0.025;
        this.speed = 0.01;

        // player cube
        const geometry = new THREE.BoxGeometry(this.size.x, this.size.y, .5);
        const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        this.player = new THREE.Mesh(geometry, material);
        this.player.position.set(this.position.x,this.position.y,0);

        // player bounding box
        this.playerBB = new THREE.Box3(new THREE.Vector3(), new THREE.Vector3());
        this.playerBB.setFromObject(this.player);

        scene.add(this.player);
        this.setupControls();
    }

    get playerPosition() {
        return {x: this.position.x, y: this.position.y};
    }

    set playerPosition({x, y}) {
        this.position.x = x;
        this.position.y = y;
    }

    updateBoundingBox() {
        this.playerBB.setFromObject(this.player);
    }

    update() {
        this.handleInput();

        const nextPosition = {
            x: this.position.x,
            y: this.position.y
        };

        //if (!this.onGround) {
        //    this.velocity.y += this.gravity;
        //}

        nextPosition.x += this.velocity.x;
        nextPosition.y += this.velocity.y;

        this.onGround = false;

        // check if next position would cause a collision
        if (!this.checkCollisions(nextPosition)) {
            // if no collision, update position
            this.position.x = nextPosition.x;
            this.position.y = nextPosition.y;
            this.player.position.set(this.position.x, this.position.y, 0);
            this.updateBoundingBox();
        }
    }

    checkCollisions(nextPosition) {
        const originalPosition = this.player.position.clone();
        this.player.position.set(nextPosition.x, nextPosition.y, 0);
        this.updateBoundingBox();

        const nearbyBlocks = this.world.getBlocksInArea(
            Math.floor(nextPosition.x - 2),
            Math.floor(nextPosition.y - 2),
            Math.floor(nextPosition.x + 2),
            Math.floor(nextPosition.y + 2)
        );

        let collision = false;

        for (let block of nearbyBlocks) {
            if (this.playerBB.intersectsBox(block.boundingBox)) {
                collision = true;
                break;
            }
        }

        // Reset position
        this.player.position.copy(originalPosition);
        this.updateBoundingBox();
                
        return collision;
    }

    handleInput() {
        // pauses game
        if (this.keys['p']) {
            while(true) {}
        }

        if (this.keys['ArrowLeft'] || this.keys['a']) {
            if (this.velocity.x <= this.minVelocity) {
                this.velocity.x = this.minVelocity;
            } else {
                this.velocity.x -= this.speed;
            }
        } else if (this.keys['ArrowRight'] || this.keys['d']) {
            if (this.velocity.x >= this.maxVelocity) {
                this.velocity.x = this.maxVelocity;
            } else{
                this.velocity.x += this.speed;
            }
        } else {
            this.velocity.x = 0;
        }
        
        if ((this.keys['ArrowUp'] || this.keys['w'])) { //&& this.onGround
            this.velocity.y += this.speed;
            //this.velocity.y = this.jumpSpeed;
            //this.onGround = false;
        } else if ((this.keys['ArrowUp'] || this.keys['s']) ) {
            this.velocity.y -= this.speed;
        } else {
            this.velocity.y = 0;
        }
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
}