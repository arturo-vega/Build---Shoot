import * as THREE from 'three';

export class World {
    constructor(scene) {
        this.scene = scene;
        this.blocks = new Map();
        this.blockGhosts = new Map();

        for (let i = 0; i < 100; i++) {
            for (let j = 0; j < 5; j++) {
                this.createBlock(i, j);
            }
        }


        //const gridHelper = new THREE.gridHelper(10,10);
        //gridHelper.rotation.x = Math.PI / 2;
        //this.scene.add(gridHelper);
    }

    createBlock(x, y) {
        if (this.isValidSpot(x,y)) {
            console.log("VALID SPOT!");
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
        }
    }

    removeBlock(x,y,type) {
        if (type === 'ghost') {
            const key = `${x},${y}`;
            let block = this.blockGhosts.get(key);
            if (block) {
                //console.log(`Destroying block${block.id}: x: ${x} y: ${y}`);
                //console.log('Block to remove:', block);
                //console.log('Block parent:', block.parent);
                //console.log('Is in scene:', this.scene.children.includes(block));
                block.geometry.dispose();
                block.material.dispose();
                this.scene.remove(block);
                this.blockGhosts.delete(key);
            }
        } else {
            const key = `${x},${y}`;
            const block = this.blockMap.get(key);
            if (block) {
                this.scene.remove(block);
                this.blockMap.delete(key);
            }
        }
    }

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

    blockGhost(x, y) {
        // if valid make a green transparent cube
        if (this.isValidSpot(x,y)) {
            const geometry = new THREE.BoxGeometry(1,1,1);
            const material = new THREE.MeshPhongMaterial({
            color: 0x98fb98, // GREEN
            opacity: 0.7,
            transparent: true
            });
            const blockGhost = new THREE.Mesh(geometry, material);

            const key = `${x},${y}`;

            if (!this.blockGhosts.get(key)) {
                blockGhost.position.set(x, y, 0);
                this.scene.add(blockGhost);
                this.blockGhosts.set(key, blockGhost);
            //console.log(`Block set at (${x}, ${y})`);
            }
        // if invalid make a red transparent cube
        } else {
            const geometry = new THREE.BoxGeometry(1,1,1);
            const material = new THREE.MeshPhongMaterial({
            color: 0xdc143c, // RED
            opacity: 0.7,
            transparent: true
            });
            const blockGhost = new THREE.Mesh(geometry, material);

            const key = `${x},${y}`;

            if (!this.blockGhosts.get(key)) {
                blockGhost.position.set(x, y, 0);
                this.scene.add(blockGhost);
                this.blockGhosts.set(key, blockGhost);
            //console.log(`Block set at (${x}, ${y})`);
            }
        //console.log(!this.blockGhosts.get(key));
        }
    }

    // checks to see if a spot in the map has a block there or not
    isValidSpot(x, y) {
        const key = `${x},${y}`
        const block = this.blocks.get(key);
        if (block) {
            return false;
        } else {
            return true;
        }
    }

    update() {
        // maybe do something with this?
    }
}