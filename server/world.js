import { Block } from './block.js';

export class World {
    constructor() {
        this.blocks = new Map();
        this.blockGhosts = new Map();

        this.lastBlockModified = {x: 0, y: 0};

        // creates initial blocks for the stage
        for (let i = 0; i < 100; i++) {
            for (let j = 0; j < 5; j++) {
                this.createBlock(i, j, 'steel');
            }
        }
    }

    createBlock(x, y, type = 'wood', health) {
            const key = `${x},${y}`;
    
            if (!this.isValidSpot(x,y)) return null;
    
            const block = new Block(x, y, type, health);
            this.blocks.set(key, block);
    
            // ----------------------------- neighbors
            //block.updateNeighbors();
    
            this.lastBlockModified = { x , y };
    
            return block;
    }

    damageBlock(x, y, amount) {
        const block = this.getBlockAt(x, y);
        if (!block) return false;

        const destroyed = block.damage(amount);

        if (destroyed) {
            this.removeBlock(x, y);
        }

        return destroyed;
    }

    removeBlock(x,y,type) {
        const key = `${x},${y}`;
        if (type === 'ghost') {
            let block = this.blockGhosts.get(key);
            if (block) {
                block.geometry.dispose();
                block.material.dispose();
                this.blockGhosts.delete(key);
            }
        // remove block
        } else {
            let block = this.blocks.get(key);
            if (block) {
                block.destroy();
                this.blocks.delete(key);

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