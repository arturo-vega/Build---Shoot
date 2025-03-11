import * as THREE from 'three';

export class Block {
    constructor(x, y, type, health = 100) {
        this.type = type;
        this.x = x;
        this.y = y;

        const blockTypes = {
            'steel': {
                health: 100,
                destructible: false,
                color: 0x808080,
            },
            'concrete': {
                health: 100,
                destructible: true,
                color: 0x8b8b8b,
            },
            'wood': {
                health: 50,
                destructible: true,
                color: 0x8b4513,
            }
        };

        // set block to wood if the type is undefined
        const properties = blockTypes[type] || blockTypes.wood;

        this.health = Math.min(properties.health, health);
        this.destructible = properties.destructible;
        this.maxHealth = properties.health;

        this.mesh = this.createMesh(properties.color);
        this.mesh.position.set(x, y, 0);
        this.updateBoundingBox();
    }

    createMesh(color) {
        const textureLoader = new THREE.TextureLoader();

        console.log("IN here");

        const geometry = new THREE.BoxGeometry(1,1,1);
        const material = new THREE.MeshPhongMaterial({ color });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.material.transparent = true;

        textureLoader.load(`./textures/${this.type}.jpg`, (texture) => {
            console.log("Loading texture");
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(1, 1);

            mesh.material.map = texture;
            mesh.material.needsUpdate = true;
        });
        
        return mesh;
    }

    updateBlockHealth(health) {
        this.health = health;
        const damagePercentage = this.health / this.maxHealth;
        this.mesh.material.opacity  = 0.5 + (damagePercentage * 0.5);
        console.log("New opacity:   ",this.mesh.material.opacity );
    }
    updateBlockType(type) {
        if (type !== this.type) {
            this.type = type;
            this.health = blockTypes[type].health;
        }
    }

    updateBoundingBox() {
        this.boundingBox = new THREE.Box3();
        this.boundingBox.setFromObject(this.mesh);
    }

    damage(amount) {
        if (!this.destructible) return false;

        this.health = Math.max(0, this.health - amount);

        console.log(`Block health: ${this.health}`);

        // return true if block is destroyed
        return this.health === 0;
    }

    destroy() {
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
    }
}