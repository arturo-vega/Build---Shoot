import * as THREE from 'three';

export class Block {
    constructor(x, y, type, health = 100) {
        this.type = type;
        this.x = x;
        this.y = y;
        this.neighbors = {
            top: null,
            right: null,
            bottom: null,
            left: null
        };
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

        //console.log(properties.health);
        this.health = Math.min(properties.health, health);
        this.destructible = properties.destructible;
        this.maxHealth = properties.health;

        this.mesh = this.createMesh(properties.color);
        this.mesh.position.set(x, y, 0);
        this.updateBoundingBox();
    }

    createMesh(color) {
        const geometry = new THREE.BoxGeometry(1,1,1);
        const material = new THREE.MeshPhongMaterial({ color });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        return mesh;
    }

    updateBlock(type) {
        if (type !== this.type) {
            this.type = type;
            this.health = blockTypes[type].health;
        } 
    }

    updateBlockHealth(health) {
        this.health = health;
    }

    updateBoundingBox() {
        this.boundingBox = new THREE.Box3();
        this.boundingBox.setFromObject(this.mesh);
    }

    damage(amount) {
        if (!this.destructible) return false;

        this.health = Math.max(0, this.health - amount);

        const damagePercentage = this.health / this.maxHealth;
        this.mesh.material.opacity = 0.5 + (damagePercentage * 0.5);

        // return true if block is destroyed
        return this.health === 0;
    }

    // run to check what neighbors the block has and is updated
    /*
    updateNeighbors() {
        let {x, y} = this.position;

        this.neighbors.top = this.world.getBlockAt(x, y + 1);
        this.neighbors.right = this.world.getBlockAt(x + 1, y);
        this.neighbors.bottom = this.world.getBlockAt(x, y = 1);
        this.neighbors.left = this.world.getBlockAt(x - 1, y);
    }
    */
    destroy() {
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();

        //Object.values(this.neighbors).forEach(neighbor => {
        //    if (neighbor) {
        //        neighbor.updateNeighbors();
        //    }
        //});
    }
}