import * as THREE from 'three';

export class OtherPlayer {
    constructor(scene, world, velocity, position, health, listener, name) {
        this.scene = scene;
        this.world = world;
        this.health = health;
        this.listener = listener;
        this.isDead = false;
        this.size = { x: 0.75, y: 1.75 };


        this.maxVelocity = 6;
        this.minVelocity = -6;
        this.terminalVelocity = -15
        this.friction = 0.25;
        this.jumpSpeed = 20;
        this.gravity = -0.5;
        this.acceleration = 0.5;

        this.health = 100;

        this.name = name;

        //this.id = id
        this.velocity = velocity;
        this.position = position;

        // player cube
        const geometry = new THREE.BoxGeometry(this.size.x, this.size.y, 0.25);
        const material = new THREE.MeshBasicMaterial({ color: 0x00ffaa });
        this.player = new THREE.Mesh(geometry, material);
        this.player.position.set(this.position.x, this.position.y, 0);

        // sounds for using weapons, player sounds, etc.
        const soundPaths = { shot: './sounds/shot.ogg' };
        this.sounds = { shot: new THREE.PositionalAudio(this.listener) };

        Object.values(this.sounds).forEach(sound => {
            this.player.add(sound);
        });

        this.loadSounds(soundPaths);

        // player bounding box
        this.playerBB = new THREE.Box3(new THREE.Vector3(), new THREE.Vector3());
        this.updateBoundingBox();

        scene.add(this.player);
    }

    loadSounds(soundPaths) {
        if (!this.listener) {
            console.warn('AudioListener not provided to Player');
            return;
        }

        const audioLoader = new THREE.AudioLoader();

        for (const type in soundPaths) {
            audioLoader.load(soundPaths[type], (buffer) => {
                this.sounds[type].setBuffer(buffer);

                this.sounds[type].setRefDistance(5);
                this.sounds[type].setRolloffFactor(2);
                this.sounds[type].setVolume(0.5);
            });
        }
    }

    playSound(type) {
        if (this.sounds[type] && this.sounds[type].buffer) {
            if (this.sounds[type].isPlaying) {
                this.sounds[type].stop();
            }
            this.sounds[type].play();
        }
        else {
            console.warn("No sound type: ", this.sounds[type], "Or buffer: ", this.sounds[type].buffer);
        }
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

    update(deltaTime) {
        this.checkGroundStatus();
        this.applyGravity();

        this.moveHorizontally(deltaTime);
        this.moveVertically(deltaTime);

        this.player.position.set(this.position.x, this.position.y, 0);
        this.updateBoundingBox();
    }

    checkGroundStatus() {
        const groundCheckDistance = 0.01;
        const testPosition = {
            x: this.position.x,
            y: this.position.y - groundCheckDistance
        };

        this.onGround = this.hasCollisionAt(testPosition);
    }

    moveHorizontally(deltaTime) {
        if (Math.abs(this.velocity.x) < 0.01) return;

        const nextX = this.position.x + this.velocity.x * deltaTime;
        const testPosition = { x: nextX, y: this.position.y };

        if (!this.hasCollisionAt(testPosition)) {
            this.position.x = nextX;
        } else {
            this.velocity.x = 0;
            // maybe do precise positioning function
        }
    }

    moveVertically(deltaTime) {
        if (Math.abs(this.velocity.y) < 0.01) return;

        const nextY = this.position.y + this.velocity.y * deltaTime;
        const testPosition = { x: this.position.x, y: nextY };

        if (!this.hasCollisionAt(testPosition)) {
            this.position.y = nextY;
            this.onGround = false;
        } else {
            this.velocity.y = 0;
        }
    }

    hasCollisionAt(nextPosition) {
        const originalPosition = this.player.position.clone();
        this.player.position.set(nextPosition.x, nextPosition.y, 0);
        this.updateBoundingBox();

        const nearbyBlocks = this.world.getBlocksInArea(
            Math.floor(nextPosition.x - 2),
            Math.floor(nextPosition.y - 2),
            Math.floor(nextPosition.x + 2),
            Math.floor(nextPosition.y + 2)
        );

        let hasCollision = false;
        for (let block of nearbyBlocks) {
            if (this.playerBB.intersectsBox(block.boundingBox)) {
                hasCollision = true;
                break;
            }
        }

        // reset position
        this.player.position.copy(originalPosition);
        this.updateBoundingBox();

        return hasCollision;
    }

    damage(rayDirection, amount) {
        this.health = this.health - amount;
        this.velocity.x += (rayDirection.x * 0.25);
        this.velocity.y += (rayDirection.y * 0.25);
        if (this.health <= 0) {
            this.isDead = true;
            // do something
        }
    }

    getCollisionDirection(playerBox, blockBox) {

        const overlapLeft = playerBox.max.x - blockBox.min.x;
        const overlapRight = blockBox.max.x - playerBox.min.x;
        const overlapTop = playerBox.max.y - blockBox.min.y;
        const overlapBottom = blockBox.max.y - playerBox.min.y;

        const minOverlapX = Math.min(overlapLeft, overlapRight);
        const minOverlapY = Math.min(overlapTop, overlapBottom);

        if (minOverlapX < minOverlapY) {
            return {
                direction: overlapLeft < overlapRight ? 'left' : 'right',
                overlap: minOverlapX
            };
        } else {
            return {
                direction: overlapTop < overlapBottom ? 'top' : 'bottom',
                overlap: minOverlapY
            };
        }
    }
}