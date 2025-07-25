import { Block } from './block.js';

export class World {
    constructor() {
        this.blocks = new Map();
        this.blockGhosts = new Map();

        this.blocksRemoved = [];

        this.lastBlockModified = { x: 0, y: 0 };

        // creates initial blocks for the stage
        for (let i = 0; i < 100; i++) {
            for (let j = 0; j < 5; j++) {
                this.createBlock(i, j, 'steel');
            }
        }
    }

    createBlock(x, y, type = 'wood', health) {
        const key = `${x},${y}`;

        if (!this.isValidSpot(x, y)) return;

        const block = new Block(x, y, type, health);
        this.blocks.set(key, block);

        this.lastBlockModified = { x, y };
    }

    damageBlock(x, y, blockHealth) {
        const block = this.getBlockAt(x, y);

        if (!block) return;

        block.damage(blockHealth);
        this.lastBlockModified = { x, y };

        if (block.health <= 0) {
            this.removeBlock(x, y, block.type);
        }
    }

    removeBlock(x, y, type = 'wood') {
        // type doesn't really matter only to make sure that it's not a ghostblock
        let key = `${x},${y}`;
        if (type === 'ghost') {
            let block = this.blockGhosts.get(key);
            if (block) {
                block.geometry.dispose();
                block.material.dispose();
                this.blockGhosts.delete(key);
            }

        } else {
            let block = this.blocks.get(key);
            if (block) {
                this.blocksRemoved = this.checkForDisconnectedBlocks(x, y);

                for (let i = 0; i < this.blocksRemoved.length; i++) {
                    block = this.blocksRemoved[i];
                    key = `${block.x},${block.y}`;
                    console.log(`Removing block ${block.x}, ${block.y}`)
                    if (block) {
                        block.destroy();
                        this.blocks.delete(key);
                    }
                }
                this.lastBlockModified = {
                    x: x,
                    y: y
                }
            }
        }
    }

    // neighbor is a string indicating where the neighbor block is relative to the coordinates of the block
    updateBlockNeighbor(x, y, neighbor, destroyed) {
        const block = this.getBlockAt(x, y);

        if (!destroyed) {
            switch (neighbor) {
                case 'right':
                    block.neighbors.right = { x: x + 1, y: y };
                    break;

                case 'left':
                    block.neighbors.left = { x: x - 1, y: y };
                    break;

                case 'top':
                    block.neighbors.top = { x: x, y: y + 1 };
                    break;

                case 'bottom':
                    block.neighbors.bottom = { x: x, y: y - 1 };
                    break;
            }
        } else {
            switch (neighbor) {
                case 'right':
                    block.neighbors.right = null;
                    break;

                case 'left':
                    block.neighbors.left = null;
                    break;

                case 'top':
                    block.neighbors.top = null;
                    break;

                case 'bottom':
                    block.neighbors.bottom = null;
                    break;
            }
        }
    }

    getNeighborBlocks(x, y) {
        return [
            { x: x - 1, y: y },
            { x: x + 1, y: y },
            { x: x, y: y - 1 },
            { x: x, y: y + 1 }
        ]
    }

    // takes in coordinates of a block that was destroyed and searches neighbors for disconnected blocks to be removed
    checkForDisconnectedBlocks(x, y) {
        let visited = [];
        let stack = [];
        let goodBlocks = [];
        let startingBlocks = [];
        let badBlocks = [];

        let connected = false;

        badBlocks.push(this.getBlockAt(x, y));

        // get the neighbor blocks of the block that was destroyed
        let neighborBlocks = this.getNeighborBlocks(x, y);

        // get all the blocks around the block tht was destroyed and push them into the starting blocks array
        for (let i = 0; i < neighborBlocks.length; i++) {
            let neighborBlock = this.getBlockAt(neighborBlocks[i].x, neighborBlocks[i].y);
            if (neighborBlock) {
                startingBlocks.push(neighborBlock);
            }
        }

        for (let i = 0; i < startingBlocks.length; i++) {
            let block = startingBlocks[i];
            stack.push(block);

            // reset visited for each starting block
            visited = [];

            while (stack.length != 0) {
                block = stack.pop();

                // skip if the block is already visited or if it's in the BAD BLOCKS (should only be the original block that got removed tho)
                if (visited.includes(block) || badBlocks.includes(block)) {
                    continue;
                }

                visited.push(block);

                neighborBlocks = this.getNeighborBlocks(block.x, block.y);

                // check each neighbor
                for (let j = 0; j < neighborBlocks.length; j++) {
                    let neighborBlock = this.getBlockAt(neighborBlocks[j].x, neighborBlocks[j].y);

                    if (neighborBlock) {
                        // Check if any blocks are indestructible or already marked as good
                        if (visited.some(neighborBlock => !block.destructible || goodBlocks.includes(neighborBlock))) {
                            connected = true;
                            break;
                        } else {
                            stack.push(neighborBlock);
                        }
                    }
                }
            }

            if (connected) {
                goodBlocks = [...goodBlocks, ...visited];
                connected = false;
            } else {
                for (let j = 0; j < visited.length; j++) {
                    let blockToRemove = visited[j];
                    if (blockToRemove) {
                        badBlocks.push(blockToRemove);
                    }
                }
            }
        }
        return badBlocks;
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
            block.health = health;
        }
    }

    getBlockAt(x, y) {
        return this.blocks.get(`${x},${y}`);
    }

    removeBlockFromSet(x, y) {
        this.blocks.remove(`${x},${y}`);
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