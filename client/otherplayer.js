import * as THREE from 'three';

export class OtherPlayer {
    constructor(scene, world, velocity, position) {
        this.scene = scene;
        this.world = world;
        this.size = {x: 0.75, y: 1.75};
        this.maxVelocity = 0.3;
        this.minVelocity = -0.3;
        this.terminalVelocity = -1.2
        this.friction = -0.1;
        this.jumpSpeed = .5;
        this.gravity = -0.025;
        this.speed = 0.01;

        //this.id = id
        this.velocity = velocity;
        this.position = position;

        // player cube
        const geometry = new THREE.BoxGeometry(this.size.x, this.size.y, 0.25);
        const material = new THREE.MeshBasicMaterial({ color: 0x00ffaa });
        this.player = new THREE.Mesh(geometry, material);
        this.player.position.set(this.position.x,this.position.y,0);

        // player bounding box
        this.playerBB = new THREE.Box3(new THREE.Vector3(), new THREE.Vector3());
        this.updateBoundingBox();
        
        scene.add(this.player);
    }

    get playerPositionVelocity() {
        return {
            velocity: this.velocity,
            position: this.position
        }
    }

    set playerVelocity(velocity) {
        this.velocity = velocity;
    }

    set playerPosition(position) {
        this.position = position;
    }

    updateBoundingBox() {
        this.playerBB.setFromObject(this.player);
    }
    
    applyGravity() {
        if (!this.onGround) {
            if (this.velocity.y < this.terminalVelocity) {
                this.velocity.y = this.terminalVelocity
            } else {
                this.velocity.y += this.gravity;
            }
        }
    }

    update() {
        this.applyGravity();

        const nextPosition = {
            x: this.position.x,
            y: this.position.y
        };

        nextPosition.x += this.velocity.x;
        nextPosition.y += this.velocity.y;

        const collision = this.checkCollisions(nextPosition);

        // horizontal movement handling
        if (!collision.cancelHorizontal) {
            this.position.x = nextPosition.x;
        } else {
            this.velocity.x = 0;
        }

        if (!collision.cancelVertical) {
            this.position.y = nextPosition.y;
        } else {
            this.velocity.y = 0;
            if (collision.onGround) {
                this.onGround = true;
                this.position.y = nextPosition.y;
            }
        }

        if (!collision.onGround) {
            this.onGround = false;
        }
        
        this.player.position.set(this.position.x, this.position.y, 0);
        this.updateBoundingBox();
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

        let collisionResponse = {
            hasCollision: false,
            cancelHorizontal: false,
            cancelVertical: false,
            onGround: false
        };

        for (let block of nearbyBlocks) {
            if (this.playerBB.intersectsBox(block.boundingBox)) {
                const collision = this.getCollisionDirection(this.playerBB, block.boundingBox);

                if (collision.direction === 'left') {
                    collisionResponse.cancelHorizontal = true;
                    nextPosition.x -= collision.overlap;
                } else if (collision.direction === 'right') {
                    collisionResponse.cancelHorizontal = true;
                    nextPosition.x += collision.overlap;
                } else if (collision.direction === 'top') {
                    collisionResponse.cancelVertical = true;
                    nextPosition.y -= collision.overlap;
                } else if (collision.direction === 'bottom') {
                    collisionResponse.cancelVertical = true;
                    nextPosition.y += collision.overlap;
                    collisionResponse.onGround = true;
                }

                collisionResponse.hasCollision = true;

                // immediately updates position and bounding box after resolving collision
                this.player.position.set(nextPosition.x, nextPosition.y, 0);
                this.updateBoundingBox();
            }
        }
        // reset position
        this.player.position.copy(originalPosition);
                
        return collisionResponse;
    }

    getCollisionDirection(playerBox, blockBox) {
        let overlapX = Math.min(playerBox.max.x - blockBox.min.x, blockBox.max.x - playerBox.min.x);
        let overlapY = Math.min(playerBox.max.y - blockBox.min.y, blockBox.max.y - playerBox.min.y);

        if (overlapX > 1) {
            overlapX = .9;
        }
        if (overlapY > 1) {
            overlapY = .9;
        }

        const playerCenter = {
            x: (playerBox.min.x + playerBox.max.x) / 2,
            y: (playerBox.min.y + playerBox.max.y) / 2
        };

        const blockCenter = {
            x: (blockBox.min.x + blockBox.max.x) / 2,
            y: (blockBox.min.y + blockBox.max.y) /2
        };
        // if player x is less than block center then collision was to right otherwise left
        if (Math.abs(overlapX) < Math.abs(overlapY)) {
            return {
                direction: playerCenter.x < blockCenter.x ? 'left' : 'right',
                overlap: overlapX
            };
        } else {
            return {
                direction: playerCenter.y < blockCenter.y ? 'top' : 'bottom',
                overlap: overlapY
            };
        }
    }
}