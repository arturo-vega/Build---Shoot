import * as THREE from 'three';
import { Item } from '/item.js';

export class Player {
    constructor(scene, world, camera, startPosition, game, listener, playerName) {
        this.game = game;
        this.world = world;
        this.camera = camera;
        this.listener = listener;
        this.onGround = false;
        this.jumpPressed = false;
        this.health = 100;
        this.velocity = { x: 0, y: 0 };
        this.size = { x: 0.75, y: 1.75 };
        this.position = startPosition;
        this.previousMousePosition = { x: 10, y: 10 };
        this.currentMousePosition = { x: 0, y: 0 };
        this.playerName = playerName;

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

        // make these static
        this.maxVelocity = 6;
        this.minVelocity = -6;
        this.acceleration = 0.5;
        this.terminalVelocity = -15
        this.friction = 0.25;
        this.jumpSpeed = 20;
        this.gravity = -0.5;

        this.mouseRaycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.items = [
            new Item('placer', scene, world, this, this.game),
            new Item('remover', scene, world, this, this.game),
            new Item('weapon', scene, world, this, this.game)
        ];
        this.currentItemIndex = 2;

        // used for HUD
        this.itemNames = [
            'Placer',
            'Remover',
            'Weapon'
        ];

        // sounds for using weapons, player sounds, etc.
        const soundPaths = { shot: './sounds/shot.ogg' };
        this.sounds = { shot: new THREE.PositionalAudio(this.listener) };

        // player cube
        const geometry = new THREE.BoxGeometry(this.size.x, this.size.y, 0.25);
        const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        this.player = new THREE.Mesh(geometry, material);
        this.player.position.set(this.position.x, this.position.y, 0);

        // player bounding box
        this.playerBB = new THREE.Box3(new THREE.Vector3(), new THREE.Vector3());
        this.updateBoundingBox();

        Object.values(this.sounds).forEach(sound => {
            this.player.add(sound);
        });

        this.loadSounds(soundPaths);

        this.ghostBlockOn = true;

        scene.add(this.player);
        this.setupControls();

    }

    getCurrentItem() {
        return this.itemNames[this.currentItemIndex];
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

    get positionVelocity() {
        return {
            velocity: this.velocity,
            position: this.position
        }
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
        this.handleInput();
        this.checkGroundStatus();
        this.applyGravity();

        this.moveHorizontally(deltaTime);
        this.moveVertically(deltaTime);

        this.player.position.set(this.position.x, this.position.y, 0);
        this.updateBoundingBox();
        this.updateGhost();
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

    switchItem(index) {
        if (index >= 0 && index < this.items.length) {
            this.currentItemIndex = index;
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

    handleInput() {
        if (!this.isDead) {
            if (this.keys['ArrowLeft'] || this.keys['a']) {
                if (this.velocity.x <= this.minVelocity) {
                    this.velocity.x = this.minVelocity;
                } else {
                    this.velocity.x -= this.acceleration;
                    if (this.velocity.x > 0) {
                        this.velocity.x -= this.acceleration;
                    }
                }
            } else if (this.keys['ArrowRight'] || this.keys['d']) {
                if (this.velocity.x >= this.maxVelocity) {
                    this.velocity.x = this.maxVelocity;
                } else {
                    this.velocity.x += this.acceleration;
                    if (this.velocity.x < 0) {
                        this.velocity.x += this.acceleration;
                    }
                }
            } else {
                this.applyFriction();
            }

            if ((this.keys['ArrowUp'] || this.keys['w']) && this.onGround && !this.jumpPressed) {
                this.velocity.y += this.jumpSpeed;
                this.onGround = false;
                this.jumpPressed = true;
            }

            if (!(this.keys['ArrowUp'] || this.keys['w'])) {
                this.jumpPressed = false;
            }

            if (this.keys['1']) {
                this.switchItem(0);
            } else if (this.keys['2']) {
                this.switchItem(1);
            } else if (this.keys['3']) {
                this.switchItem(2);
            }
        } else {
            this.applyFriction();
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

        window.addEventListener('mousemove', this.onMouseMove.bind(this), true);
        window.addEventListener('click', this.onClick.bind(this), false);


    }

    onMouseMove(event) {
        this.mouse.x = (event.clientX / this.game.windowWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / this.game.windowHeight) * 2 + 1;
    }


    updateGhost() {
        this.mouseRaycaster.setFromCamera(this.mouse, this.camera);

        this.previousMousePosition = this.currentMousePosition;
        this.currentMousePosition = { x: Math.floor(this.mouse.x), y: Math.floor(this.mouse.y) };

        const intersectionPoint = this.getRayPlaneIntersection(
            this.camera,
            this.mouseRaycaster.ray.direction
        );

        this.currentMousePosition.x = Math.floor(intersectionPoint.x);
        this.currentMousePosition.y = Math.floor(intersectionPoint.y);

        const currentItem = this.getCurrentItem();

        // update ghost block if using block removing or placing items otherwise don't
        if ((!this.mouseInSameSpot(this.previousMousePosition, this.currentMousePosition) || !this.ghostBlockOn) && this.currentItemIndex < 2) {
            this.world.removeBlock(this.previousMousePosition.x, this.previousMousePosition.y, "ghost");
            this.world.blockGhost(Math.floor(intersectionPoint.x), Math.floor(intersectionPoint.y), this.playerBB, currentItem);
            this.ghostBlockOn = true;
        }
        else if (this.currentItemIndex >= 2 || this.isDead) {
            this.world.removeBlock(this.previousMousePosition.x, this.previousMousePosition.y, "ghost");
            this.ghostBlockOn = false;
        }
    }

    mouseInSameSpot(previousMousePosition, currentMousePosition) {
        if (previousMousePosition.x != currentMousePosition.x || previousMousePosition.y != currentMousePosition.y) {
            return false;
        } else {
            return true;
        }
    }

    onClick() {
        if (!this.isDead) { this.useItem(); }
    }
    useItem() {
        this.items[this.currentItemIndex].use();
        if (this.currentItemIndex === 2) {
            this.playSound('shot');
            this.fired = true;
        }
    }

    damage(rayDirection, amount) {
        this.health = this.health - amount;
        this.velocity.x += (rayDirection.x * 5.25);
        this.velocity.y += (rayDirection.y * 0.3);
        this.onGround = false;
        if (this.health <= 0) {
            this.isDead = true;
            // do something?
        }
    }

    // used for finding out where to place blocks in the world
    getRayPlaneIntersection(camera, rayDirection) {
        // intersection at point z = 0
        // cameraPostion.z + t * rayDirection.z = 0
        // solve for t and find intersection point

        const t = -camera.position.z / rayDirection.z;

        const intersectionPoint = new THREE.Vector3(
            camera.position.x + t * rayDirection.x,
            camera.position.y + t * rayDirection.y,
            0 // z is always 0
        );

        return intersectionPoint;
    }
}