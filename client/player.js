import * as THREE from 'three';

export class Player {
    constructor(scene, world, velocity, spawnPoint, health, listener, playerName, playerTeam, player, id) {
        this.scene = scene;
        this.world = world;
        this.listener = listener;
        this.playerName = playerName;
        this.playerTeam = playerTeam;
        this.player = player; // this is the model
        this.id = id;
        this.spawnPoint = spawnPoint;
        this.velocity = velocity || { x: 0, y: 0, z: 0 };
        this.position = spawnPoint || { x: 0, y: 0, z: 0 };
        this.health = health || 100;
        this.mouseX = new THREE.Vector2();

        this.maxVelocity = 6;
        this.minVelocity = -6;
        this.terminalVelocity = -15;
        this.friction = 0.25;
        this.jumpSpeed = 20;
        this.gravity = -0.5;
        this.acceleration = 0.5;
        this.respawnTimer = 0;
        this.isDead = false;

        // will use this for items
        this.wandCharge = 100;
        this.shovelCharge = 50;
        this.blocksOwned = 50;

        // pvp info
        this.didDamage = false;
        this.playerRayDirection = { x: 0, y: 0 };
        this.damageDealt = 0;
        this.playerDamaged = null;
        this.fired = false;

        // direction
        this.playerLookingRight = true;
        this.playerLookingLeft = false;
        this.lookDirection = 'right';

        // Player model setup
        this.player.position.set(this.position.x, this.position.y + 5, 0);
        this.player.rotateY(Math.PI / 2);
        this.player.userData = { id: this.id, position: this.position };
        scene.add(this.player);

        // Animation setup
        this.mixer = new THREE.AnimationMixer(this.player);
        this.clips = this.player.animations;
        const walkClip = THREE.AnimationClip.findByName(this.clips, 'Walk');
        const trimmedWalk = THREE.AnimationUtils.subclip(walkClip, 'trimmedWalk', 0, 62);
        this.walkingAnimation = this.mixer.clipAction(trimmedWalk);
        const idleClip = THREE.AnimationClip.findByName(this.clips, 'Idle');
        this.idleAnimation = this.mixer.clipAction(idleClip);

        // Bounding box
        this.playerBB = new THREE.Box3();
        this.playerBB.setFromObject(this.player);
        this.initialBBSize = new THREE.Vector3();
        this.playerBB.getSize(this.initialBBSize);
        this.updateBoundingBox();

        // Sounds
        const soundPaths = { shot: './sounds/shot.ogg' };
        this.sounds = { shot: new THREE.PositionalAudio(this.listener) };
        Object.values(this.sounds).forEach(sound => this.player.add(sound));
        this.loadSounds(soundPaths);
    }

    loadSounds(soundPaths) {
        if (!this.listener) {
            console.warn('AudioListener not provided to BasePlayer');
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
            if (this.sounds[type].isPlaying) this.sounds[type].stop();
            this.sounds[type].play();
        } else {
            console.warn("No sound type or buffer:", type);
        }
    }

    updateBoundingBox() {
        const playerPosition = this.player.position.clone();
        playerPosition.y -= 1;
        this.playerBB.setFromCenterAndSize(playerPosition, this.initialBBSize);
    }

    applyGravity() {
        if (!this.onGround) {
            if (this.velocity.y < this.terminalVelocity) {
                this.velocity.y = this.terminalVelocity;
            } else {
                this.velocity.y += this.gravity;
            }
        }
    }

    applyFriction() {
        if (this.isDead) {
            if (this.velocity.z > 0) {
                this.velocity.z -= this.friction;
            } else {
                this.velocity.z += this.friction;
            }
        }
        if (Math.abs(this.velocity.x) < 0.05) {
            this.velocity.x = 0;
        } else {
            if (this.velocity.x > 0)
                this.velocity.x -= this.friction;
            else
                this.velocity.x += this.friction;
        }
    }

    setWalkingDirection() {
        if (this.playerLookingRight && this.velocity.x < -0.05) {
            this.mixer.timeScale = -1.5;
        } else if (this.playerLookingLeft && this.velocity.x > 0.05) {
            this.mixer.timeScale = -1.5;
        } else {
            this.mixer.timeScale = 1.5;
        }
    }

    setLookDirection() {
        if (this.mouseX > 0 && !this.playerLookingRight) {
            this.playerLookingRight = true;
            this.playerLookingLeft = false;
            this.lookDirection = 'right';
            this.player.rotateY(Math.PI);
        } else if (this.mouseX < 0 && !this.playerLookingLeft) {
            this.playerLookingLeft = true;
            this.playerLookingRight = false;
            this.lookDirection = 'left';
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
            y: this.position.y - groundCheckDistance,
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

    moveOrthoganal(deltaTime) {
        if (this.isDead) {
            this.position.z += this.velocity.z * deltaTime;
        }
    }

    hasCollisionAt(nextPosition) {
        if (this.isDead) {
            return false;
        }
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
        this.player.position.copy(originalPosition);
        this.updateBoundingBox();
        return hasCollision;
    }

    damage(rayDirection, amount) {
        console.log(this.velocity);
        this.health = this.health - amount;
        this.velocity.x += (rayDirection.x * 10);
        this.velocity.y += (rayDirection.y * 15);
        this.onGround = false;
        if (this.health <= 0) {
            this.isDead = true;
            this.thenDie(rayDirection);
        }
    }

    thenDie(rayDirection) {
        this.velocity.x += (rayDirection.x * 20);
        this.velocity.y += 20
        const zAngle = Math.random();
        zAngle > 0.5 ? this.velocity.z += 5 : this.velocity.z -= 5;
        this.player.rotateX(Math.PI / 2);
    }

    update(deltaTime) {
        this.checkGroundStatus();
        this.applyGravity();
        this.applyFriction();
        this.moveHorizontally(deltaTime);
        this.moveVertically(deltaTime);
        this.moveOrthoganal(deltaTime);
        this.setLookDirection();
        this.setWalkingDirection();
        this.mixer.update(deltaTime);
        this.animate();
        this.player.position.set(this.position.x, this.position.y, this.position.z);
        this.updateBoundingBox();
    }
}