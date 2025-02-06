import * as THREE from 'three';
import { Item } from '/item.js';

export class Player {
    constructor(scene, world, camera, startPosition) {
        this.world = world;
        this.camera = camera;
        this.onGround = false;
        this.health = 100;
        this.velocity = {x: 0, y: 0};
        this.size = {x: 0.75, y: 1.75};
        this.position = startPosition;
        this.previousMousePosition = {x:10, y:10};
        this.currentMousePosition = {x:0, y:0};
        
        // make these static
        this.maxVelocity = 0.3;
        this.minVelocity = -0.3;
        this.terminalVelocity = -1.2
        this.friction = -0.1;
        this.jumpSpeed = .5;
        this.gravity = -0.025;
        this.speed = 0.01;

        this.mouseRaycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.items = [
            new Item('placer', scene, world, this),
            new Item('remover', scene, world, this),
            new Item('weapon', scene, world, this)
        ];
        this.currentItemIndex = 2;

        // player cube
        const geometry = new THREE.BoxGeometry(this.size.x, this.size.y, 0.25);
        const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        this.player = new THREE.Mesh(geometry, material);
        this.player.position.set(this.position.x,this.position.y,0);

        // player bounding box
        this.playerBB = new THREE.Box3(new THREE.Vector3(), new THREE.Vector3());
        this.updateBoundingBox();

        this.ghostBlockOn = true;

        scene.add(this.player);
        this.setupControls();

    }

    get positionVelocity() {
        return {
            velocity: this.velocity,
            position: this.position
        }
    }

    //set playerVelocity(velocity) {
    //    this.velocity = velocity;
    //}

    //set playerPosition(position) {
    //    this.position = position;
    //}

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
        this.handleInput();

        this.applyGravity();

        const nextPosition = {
            x: this.position.x,
            y: this.position.y
        };

        nextPosition.x += this.velocity.x;
        nextPosition.y += this.velocity.y;

        //console.log(`y speed: ${this.velocity.y}`)

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
        this.updateGhost();
        //console.log(`Player x: ${this.position.x} y: ${this.position.y}`)
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
            //console.log(block);
            //console.log(`Block: ${block} Bounding block: ${block.boundingBox}`);
            if (this.playerBB.intersectsBox(block.boundingBox)) {
                const collision = this.getCollisionDirection(this.playerBB, block.boundingBox);

                //console.log(`Collided with block at x: ${block.position.x} y: ${block.position.y} on the ${collision.direction}. Overlap: ${collision.overlap}`);
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

        //console.log(`On ground: ${this.onGround}`);

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

    switchItem(index) {
        if (index >= 0 && index < this.items.length) {
            console.log('Item switched: ', index + 1);
            this.currentItemIndex = index;
        }
    }

    handleInput() {
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
        
        if ((this.keys['ArrowUp'] || this.keys['w']) && this.onGround) {
            this.velocity.y = this.jumpSpeed;
            this.onGround = false;
        }

        if (this.keys['1']) {
            this.switchItem(0);
        } else if (this.keys['2']) {
            this.switchItem(1);
        } else if (this.keys['3']) {
            this.switchItem(2);
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
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }


    updateGhost() {
        this.mouseRaycaster.setFromCamera(this.mouse, this.camera);

        this.previousMousePosition = this.currentMousePosition;
        this.currentMousePosition = {x: Math.floor(this.mouse.x), y: Math.floor(this.mouse.y)};

        const intersectionPoint = this.getRayPlaneIntersection(
            this.camera,
            this.mouseRaycaster.ray.direction
        );

        this.currentMousePosition.x = Math.floor(intersectionPoint.x);
        this.currentMousePosition.y = Math.floor(intersectionPoint.y);

        // update ghost block if using block removing or placing items otherwise don't
        if ((!this.mouseInSameSpot(this.previousMousePosition, this.currentMousePosition) || !this.ghostBlockOn) && this.currentItemIndex < 2) {
            this.world.removeBlock(this.previousMousePosition.x, this.previousMousePosition.y, "ghost");
            this.world.blockGhost(Math.floor(intersectionPoint.x), Math.floor(intersectionPoint.y), this.playerBB);
            this.ghostBlockOn = true;
        }
        else if (this.currentItemIndex >= 2) {
            this.world.removeBlock(this.previousMousePosition.x, this.previousMousePosition.y, "ghost");
            this.ghostBlockOn = false;
        }
    }

    mouseInSameSpot(previousMousePosition, currentMousePosition) {
        if (previousMousePosition.x != currentMousePosition.x || previousMousePosition.y != currentMousePosition.y) {
            return false;
        }   else {
            return true;
        }
    }

    onClick() {
        this.useItem();
    }
    useItem() {
        this.items[this.currentItemIndex].use();
    }

    // used for finding out where to place blocks in the world
    getRayPlaneIntersection(camera, rayDirection) {
        // intersection at point z = 0
        // cameraPostion.z + t * rayDirection.z = 0
        // solve for t and find intersection point

        const t = -camera.position.z / rayDirection.z;

        const intersectionPoint = new THREE.Vector3 (
            camera.position.x + t * rayDirection.x,
            camera.position.y + t * rayDirection.y,
            0 // z is always 0
        );

        return intersectionPoint;
    }
}