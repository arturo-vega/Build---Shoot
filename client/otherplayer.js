import * as THREE from 'three';

export class OtherPlayer {
    constructor(scene, world, velocity, position, health, listener, playerName, playerTeam, model, id) {
        this.scene = scene;
        this.world = world;
        this.health = health;
        this.listener = listener;
        this.isDead = false;
        this.size = { x: 0.75, y: 1.75 };
        this.model = model;
        this.id = id;


        this.maxVelocity = 6;
        this.minVelocity = -6;
        this.terminalVelocity = -15
        this.friction = 0.25;
        this.jumpSpeed = 20;
        this.gravity = -0.5;
        this.acceleration = 0.5;

        this.playerLookingRight = true;
        this.playerLookingLeft = false;
        this.lookDirection = 'right';

        this.health = 100;

        this.playerName = playerName;
        this.playerTeam = playerTeam;

        //this.id = id
        this.velocity = velocity;
        this.position = position;

        console.log(`Player Position: ${this.position.x}, ${this.position.y}`);

        this.model.userData = { id: this.id };
        // player cube
        this.player = this.model;
        this.player.position.set(this.position.x, this.position.y + 5, 0);
        this.player.rotateY(Math.PI / 2);
        //this.model.position.set(this.player.position.x, this.player.position.y, 0);


        // animation stuff
        this.mixer = new THREE.AnimationMixer(this.player);
        this.clips = this.player.animations;

        const walkClip = THREE.AnimationClip.findByName(this.clips, 'Walk');
        const trimmedWalk = THREE.AnimationUtils.subclip(walkClip, 'trimmedWalk', 0, 62);
        this.walkingAnimation = this.mixer.clipAction(trimmedWalk);

        const idleClip = THREE.AnimationClip.findByName(this.clips, 'Idle');
        this.idleAnimation = this.mixer.clipAction(idleClip);

        // player bounding box
        this.playerBB = new THREE.Box3();
        this.playerBB.setFromObject(this.player);
        this.initialBBSize = new THREE.Vector3();
        this.playerBB.getSize(this.initialBBSize);

        this.updateBoundingBox();

        // sounds for using weapons, player sounds, etc.
        const soundPaths = { shot: './sounds/shot.ogg' };
        this.sounds = { shot: new THREE.PositionalAudio(this.listener) };

        Object.values(this.sounds).forEach(sound => {
            this.player.add(sound);
        });

        this.loadSounds(soundPaths);

        this.player.userData = {
            position: this.position,
            id: this.id
        };
        scene.add(this.model);
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
        const playerPosition = this.player.position.clone();
        // bounding box spawns with its origin halfway inside the player without this
        playerPosition.y -= 1;

        this.playerBB.setFromCenterAndSize(playerPosition, this.initialBBSize);

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
        this.applyFriction();

        this.moveHorizontally(deltaTime);
        this.moveVertically(deltaTime);
        this.setLookDirection();
        this.setWalkingDirection();
        this.mixer.update(deltaTime);
        this.animate();

        this.player.position.set(this.position.x, this.position.y, 0);
        this.updateBoundingBox();
    }

    setWalkingDirection() {
        if (this.playerLookingRight && this.velocity.x < -0.05) {
            this.mixer.timeScale = -1.5;
        }
        else if (this.playerLookingLeft && this.velocity.x > 0.05) {
            this.mixer.timeScale = -1.5;
        }
        else {
            this.mixer.timeScale = 1.5;
        }
    }

    applyFriction() {
        if (Math.abs(this.velocity.x) < 0.05) {
            this.velocity.x = 0;
        } else {
            if (this.velocity.x > 0)
                this.velocity.x -= this.friction;
            else
                this.velocity.x += this.friction;
        }
    }

    setLookDirection() {
        //console.log(`Otherplayer look direction: ${this.lookDirection} Looking right? ${this.playerLookingRight}`);
        if (this.lookDirection == 'right' && !this.playerLookingRight) {
            this.playerLookingRight = true;
            this.playerLookingLeft = false;
            this.player.rotateY(Math.PI);
        } else if (this.lookDirection == 'left' && !this.playerLookingLeft) {
            this.playerLookingRight = false;
            this.playerLookingLeft = true;
            this.player.rotateY(Math.PI);
        }
    }

    animate() {
        if (Math.abs(this.velocity.x) > 0.05) {
            this.idleAnimation.stop();
            this.walkingAnimation.play();
        } else {
            this.walkingAnimation.stop();
            this.idleAnimation.play();
        }
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
}