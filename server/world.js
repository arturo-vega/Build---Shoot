import * as THREE from 'three';

export class World {
    constructor(scene) {
        this.scene = scene;
        this.blocks = new Map();
        this.blockGhosts = new Map();

        // creates initial blocks for the stage
        for (let i = 0; i < 100; i++) {
            for (let j = 0; j < 5; j++) {
                this.createNonPlayerBlock(i, j);
            }
        }
    }

    createNonPlayerBlock(x,y) {
        const geometry = new THREE.BoxGeometry(1,1,1);
        const material = new THREE.MeshPhongMaterial({color: 0x8B4513 });
        const block = new THREE.Mesh(geometry, material);

        block.position.set(x, y, 0);
        
        const blockBB = new THREE.Box3(new THREE.Vector3(), new THREE.Vector3());
        blockBB.setFromObject(block);
        block.boundingBox = blockBB;

        block.castShadow = true;
        block.receiveShadow = true;

        const key = `${x},${y}`;
        this.blocks.set(key, block);
    }

    createBlock(x, y, playerBB) {
        const ghostBlock = this.blockGhosts.get(`${x},${y}`);
        const ghostBB = ghostBlock.boundingBox;
        if (this.isValidSpot(x,y) && !playerBB.intersectsBox(ghostBB)) {
            const geometry = new THREE.BoxGeometry(1,1,1);
            const material = new THREE.MeshPhongMaterial({color: 0x8B4513 });
            const block = new THREE.Mesh(geometry, material);

            block.position.set(x, y, 0);
            
            const blockBB = new THREE.Box3(new THREE.Vector3(), new THREE.Vector3());
            blockBB.setFromObject(block);
            block.boundingBox = blockBB;

            block.castShadow = true;
            block.receiveShadow = true;

            const key = `${x},${y}`;
            this.blocks.set(key, block);
        }
    }

    removeBlock(x,y,type) {
        if (type === 'ghost') {
            const key = `${x},${y}`;
            let block = this.blockGhosts.get(key);
            if (block) {
                block.geometry.dispose();
                block.material.dispose();
                this.blockGhosts.delete(key);
            }
        } else {
            const key = `${x},${y}`;
            const block = this.blocks.get(key);
            if (block) {
                this.blocks.delete(key);
            }
        }
    }

    // used to check blocks around player for collision detection
    getBlocksInArea(startX, startY, endX, endY) {
        const blocks = [];
        for (let x = Math.floor(startX); x <= Math.floor(endX); x++) {
            for (let y = Math.floor(startY); y <= Math.floor(endY); y++) {
                const key = `${x},${y}`;
                const block = this.blocks.get(key);
                if (block) {
                    blocks.push(block);
                }
            }
        }
        return blocks;
    }

    blockGhost(x, y, playerBB) {
        // if valid make a green transparent cube otherwise red
        const key = `${x},${y}`;
        const geometry = new THREE.BoxGeometry(1,1,1);
        const blockGhost = new THREE.Mesh(geometry, new THREE.MeshPhongMaterial({
            opacity: 0.7,
            transparent: true
        }));

        // checks if the cube intersects with the player or other blocks to decide on color
        blockGhost.position.set(x, y, 0);
        const blockBB = new THREE.Box3(new THREE.Vector3(), new THREE.Vector3());
        blockBB.setFromObject(blockGhost);
        blockGhost.boundingBox = blockBB;

        const isSpotEmpty = this.isValidSpot(x, y);
        const doesNotIntersectPlayer = !playerBB.intersectsBox(blockBB);

        blockGhost.material.color.setHex(
            isSpotEmpty && doesNotIntersectPlayer ? 0x98fb98 : 0xdc143c //green if true red if false
        );

        this.scene.add(blockGhost);
        this.blockGhosts.set(key, blockGhost);
    }

    // checks to see if a spot in the map has a block there or not
    isValidSpot(x, y) {
        const key = `${x},${y}`
        const block = this.blocks.get(key);
        if (block) return false;
        return true;
    }

    update() {
        // maybe do something with this?
    }
}