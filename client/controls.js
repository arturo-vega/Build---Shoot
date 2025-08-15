import * as THREE from 'three';

export class Controls {
    constructor(camera, game, items, player, world) {
        this.camera = camera;
        this.game = game;
        this.world = world;
        this.mouseRaycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.mouse = { x: 0, y: 0 };
        this.player = player
        this.items = items;

        this.currentItemIndex = 2;

        // used for HUD
        this.itemNames = [
            'Placer',
            'Remover',
            'Weapon'
        ];

        this.keys = {};
        this.setupControls();
    }

    getCurrentItem() {
        return this.itemNames[this.currentItemIndex];
    }

    switchItem(index) {
        if (index >= 0 && index < this.items.length) {
            this.currentItemIndex = index;
        }
    }

    handleInput() {
        if (!this.player.isDead) {
            if (this.keys['ArrowLeft'] || this.keys['a']) {
                if (this.player.velocity.x <= this.player.minVelocity) {
                    this.player.velocity.x = this.player.minVelocity;
                } else {
                    this.player.velocity.x -= this.player.acceleration;
                    if (this.player.velocity.x > 0) this.player.velocity.x -= this.player.acceleration;
                }
            } else if (this.keys['ArrowRight'] || this.keys['d']) {
                if (this.player.velocity.x >= this.player.maxVelocity) {
                    this.player.velocity.x = this.player.maxVelocity;
                } else {
                    this.player.velocity.x += this.player.acceleration;
                    if (this.player.velocity.x < 0) this.player.velocity.x += this.player.acceleration;
                }
            } else {
                this.player.applyFriction();
            }

            if ((this.keys['ArrowUp'] || this.keys['w']) && this.player.onGround && !this.player.jumpPressed) {
                this.player.velocity.y += this.player.jumpSpeed;
                this.player.onGround = false;
                this.player.jumpPressed = true;
            }

            if (!(this.keys['ArrowUp'] || this.keys['w'])) {
                this.player.jumpPressed = false;
            }

            if (this.keys['1']) this.switchItem(0);
            else if (this.keys['2']) this.switchItem(1);
            else if (this.keys['3']) this.switchItem(2);
        } else {
            this.player.applyFriction();
        }
    }

    setupControls() {
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

    onClick() {
        if (!this.player.isDead) this.useItem();
    }

    useItem() {
        this.items[this.currentItemIndex].use();
        if (this.currentItemIndex === 2) {
            this.player.playSound('shot');
            this.player.fired = true;
        }
    }

    update() {
        this.handleInput();
        this.items[this.currentItemIndex].updateGhost(this.mouse, this.getCurrentItem());
    }
}