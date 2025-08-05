import * as THREE from 'three';
import { GLTFLoader } from '../node_modules/three/examples/jsm/loaders/GLTFLoader';
import { Item } from '/item.js';
import { TextGeometry } from '../node_modules/three/examples/jsm/geometries/TextGeometry.js';
import { FontLoader } from '../node_modules/three/examples/jsm/loaders/FontLoader.js';
import { ModelLoader } from './modelloader.js';

export class Player {
    constructor(scene, world, camera, startPosition, game, listener, playerName, playerTeam, model) {
        this.game = game;
        this.world = world;
        this.camera = camera;
        this.listener = listener;
        this.onGround = false;
        this.jumpPressed = false;
        this.health = 100;
        this.velocity = { x: 0, y: 0 };
        this.size = { x: 0.75, y: 2, z: 0.25 };
        this.position = startPosition;
        this.previousMousePosition = { x: 10, y: 10 };
        this.currentMousePosition = { x: 0, y: 0 };
        this.playerName = playerName;
        this.playerTeam = playerTeam;
        this.model = model;

        this.playerLookingRight = true;
        this.playerLookingLeft = false;
        this.lookDirection = 'right';

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

        this.blueTeamModel = './models/bluerobot.gltf';
        this.redTeamModel = './models/redrobot.gltf';

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

        // player model
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

        this.boxHelper = new THREE.Box3Helper(this.playerBB, 0xffff00);
        scene.add(this.boxHelper);

        this.updateBoundingBox();

        Object.values(this.sounds).forEach(sound => {
            this.player.add(sound);
        });

        this.loadSounds(soundPaths);

        this.ghostBlockOn = true;

        scene.add(this.model);
        this.setupControls();


    }

    createPlayerModel(playerName) {

        if (this.playerTeam === 'blue') {
            const gltfLoader = new GLTFLoader();
            gltfLoader.load(this.blueTeamModel, (model) => {
                console.log(model);
                return model;
            });
        } else {
            const gltfLoader = new GLTFLoader();
            gltfLoader.load(this.redTeamModel, (model) => {
                return model;
            });
        }

        //const geometry = new THREE.BoxGeometry(this.size.x, this.size.y, 0.25);
        //const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        //const playerModel = new THREE.Mesh(geometry, material);

        // will work on this later
        //if (playerName) {
        //    const nameLabel = this.createNameLabel(playerName);
        //    nameLabel.position.set(0, 2, 0);
        //    playerMesh.add(nameLabel);
        //}
    }

    createNameLabel(name) {
        const loader = new FontLoader();

        loader.load('../node_modules/three/examples/fonts/helvetiker_regular.typeface.json', (droidFont) => {
            const textGeometry = new TextGeometry(name, {
                height: 2,
                size: 10,
                font: droidFont,
            });

            const textMaterial = new THREE.MeshNormalMaterial();
            const mesh = new THREE.Mesh(textGeometry, textMaterial);
            mesh.castShadow = false;
            mesh.receiveShadow = false;

            return mesh;
        });
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
        const playerPosition = this.player.position.clone();
        // bounding box spawns with its origin halfway inside the player without this
        playerPosition.y -= 1;

        this.playerBB.setFromCenterAndSize(playerPosition, this.initialBBSize);

        // Update the box helper
        this.boxHelper.box.copy(this.playerBB);

        //console.log(`BoundingBox width: ${this.playerBB.max.x - this.playerBB.min.x} height: ${this.playerBB.max.y - this.playerBB.min.y}`);
        //console.log(`BBminx: ${this.playerBB.min.x} BBmaxX: ${this.playerBB.max.x} BBminy: ${this.playerBB.min.y} BBmaxy: ${this.playerBB.max.y}`);
        //console.log(`Position.x = ${this.position.x} This position.y = ${this.position.y} BoundingBox x = ${this.playerBB.min.x} y = ${this.playerBB.min.y}`);
        //console.log`Position x:${this.position.x} y:${this.position.y} - bb.min.x${this.playerBB.min.x} bb.min.y${this.playerBB.min.y} - bb.max.x${this.playerBB.max.x} bb.max.y${this.playerBB.max.y}`
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
        //this.updateBoundingBox();
        this.handleInput();
        this.checkGroundStatus();
        this.applyGravity();

        this.moveHorizontally(deltaTime);
        this.moveVertically(deltaTime);
        this.setLookDirection();
        this.setWalkingDirection();
        this.mixer.update(deltaTime);
        this.animate();

        this.player.position.set(this.position.x, this.position.y, 0);
        this.updateBoundingBox();
        this.updateGhost();
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

    setLookDirection() {
        if (this.mouse.x > 0 && !this.playerLookingRight) {
            this.playerLookingRight = true;
            this.playerLookingLeft = false;
            this.lookDirection = 'right';
            this.player.rotateY(Math.PI);
        } else if (this.mouse.x < 0 && !this.playerLookingLeft) {
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