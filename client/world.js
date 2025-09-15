import * as THREE from 'three';
import { Block } from './block';

export class World {
    constructor(scene, worldState, listener) {
        this.listener = listener;

        this.scene = scene;
        this.blockGhosts = new Map();
        //this.blocksBB = new Map();
        this.blocks = new Map();

        this.blockAdded = false;
        this.blockRemoved = false;
        this.blockDamaged = false;

        this.lastBlockModified = { x: 0, y: 0 };
        this.damagedBlockHealth = 100;

        this.deathFloor = -10;

        for (const [key, blockData] of worldState) {

            const block = new Block(blockData.x, blockData.y, blockData.type, blockData.health, this.listener);

            this.blocks.set(key, block);
            this.scene.add(block.mesh);
        };
    }


    createBlock(x, y, playerBB) {
        const key = `${x},${y}`;
        const type = 'wood';
        const health = 200;

        if (!this.isValidSpot(x, y)) return null;

        if (playerBB) {
            console.log(playerBB);
            const ghostBlock = this.blockGhosts.get(key);
            if (ghostBlock && playerBB.intersectsBox(ghostBlock.boundingBox)) {
                return null;
            }
        }

        const block = new Block(x, y, type, health, this.listener);
        this.blocks.set(key, block);
        this.scene.add(block.mesh);

        this.blockAdded = true;

        this.lastBlockModified = { x, y };

        return block;
    }

    damageBlock(x, y, damage) {
        const block = this.getBlockAt(x, y);
        if (!block) return false;

        const destroyed = block.damage(damage);
        this.lastBlockModified = { x: x, y: y };

        if (destroyed) {
            this.removeBlock(x, y);
            this.blockRemoved = true;
        } else {
            this.blockDamaged = true;
            this.damagedBlockHealth = block.health;
        }

        return destroyed;
    }

    updateBlock(x, y, type) {
        const block = this.getBlockAt(x, y);
        if (block) {
            block.updateBlock(type, damage);
        }
    }

    updateBlockHealth(x, y, health) {
        const block = this.getBlockAt(x, y);
        if (block) {
            console.log(`block ${x},${y} health: ${health}`);
            block.updateBlockHealth(health);
        }
    }

    removeBlock(x, y, type) {
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

    blockGhost(x, y, playerBB, currentItem) {
        // if valid make a green transparent cube otherwise red
        const key = `${x},${y}`;
        const geometry = new THREE.BoxGeometry(1, 1, 1);
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
        const block = this.getBlockAt(x, y);

        if (currentItem == 'Placer') {
            blockGhost.material.color.setHex(
                isSpotEmpty && doesNotIntersectPlayer && y > this.deathFloor ? 0x98fb98 : 0xdc143c //green if true red if false
            );
        }
        else if (currentItem == 'Remover') {
            blockGhost.material.color.setHex(
                block && block.type != 'steel' ? 0x98fb98 : 0xdc143c //green if true red if false
            );
        }

        this.scene.add(blockGhost);
        this.blockGhosts.set(key, blockGhost);
    }

    // checks to see if a spot in the map has a block there or not or other blocks connected to spot
    isValidSpot(x, y) {
        const key = `${x},${y}`
        const block = this.blocks.get(key);
        if (block || !this.adjacentBlocks(x, y) || y <= this.deathFloor) return false;
        return true;
    }

    adjacentBlocks(x, y) {
        let key = `${x - 1},${y}`
        const spot1 = this.blocks.get(key);

        key = `${x + 1},${y}`
        const spot2 = this.blocks.get(key);

        key = `${x},${y - 1}`
        const spot3 = this.blocks.get(key);

        key = `${x},${y + 1}`
        const spot4 = this.blocks.get(key);

        if (spot1 || spot2 || spot3 || spot4) {
            return true;
        }
        else {
            return false;
        }
    }

    update() {
        // maybe do something with this?
    }
}