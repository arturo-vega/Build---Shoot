import * as THREE from 'three';
import { Block } from './block';

export class World {
    constructor(scene, worldState) {
        this.scene = scene;
        this.blockGhosts = new Map();
        //this.blocksBB = new Map();
        this.blocks = new Map();

        this.blockAdded = false;
        this.blockRemoved = false;
        this.blockDamaged = false;

        this.lastBlockModified = {x: 0, y: 0};

        for (const [key, blockData] of worldState) {

            const block = new Block(blockData.x, blockData.y, blockData.type, blockData.health);

            this.blocks.set(key,block);
            this.scene.add(block.mesh);
        };
    }


    createBlock(x, y, type = 'wood', health, playerBB = null) {
        const key = `${x},${y}`;

        if (!this.isValidSpot(x,y)) return null;

        if (playerBB) {
            const ghostBlock = this.blockGhosts.get(key);
            if (ghostBlock && playerBB.intersectsBox(ghostBlock.boundingBox)) {
                return null;
            }
        }

        const block = new Block(x, y, type, health);
        this.blocks.set(key, block);
        this.scene.add(block.mesh);

        // block.updateNeighbors();

        this.blockAdded = true;

        this.lastBlockModified = { x , y };

        return block;

        /* OLD BLOCK CREATION METHOD
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
            this.scene.add(block);

            const key = `${x},${y}`;
            this.blocks.set(key, block);

            this.blockAdded = true;
            this.lastBlockModified = {
                x: block.position.x,
                y: block.position.y
            }
        }
        */
    }

    damageBlock(x, y, amount) {
        const block = this.getBlockAt(x, y);
        if (!block) return false;

        const destroyed = block.damage(amount);
        this.blockDamaged = true;

        if (destroyed) {
            this.removeBlock(x, y);
        }

        this.blockDamaged = true;

        return destroyed;
    }

    removeBlock(x,y,type) {
        const key = `${x},${y}`;
        if (type === 'ghost') {
            let block = this.blockGhosts.get(key);
            if (block) {
                block.geometry.dispose();
                block.material.dispose();
                this.scene.remove(block);
                this.blockGhosts.delete(key);
            }
        // remove block
        } else {
            let block = this.blocks.get(key);
            if (block) {
                block.destroy();
                this.scene.remove(block.mesh);
                this.blocks.delete(key);

                this.blockRemoved = true;
                this.lastBlockModified = {
                    x: x,
                    y: y
                }
            }
        }
    }

    getBlockAt(x, y) {
        return this.blocks.get(`${x},${y}`);
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