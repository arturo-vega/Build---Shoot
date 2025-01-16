import * as THREE from 'three';

export class World {
    constructor(scene) {
        this.scene = scene;
        this.blocks = new Map();

        for (let i = 0; i < 20; i++) {
            for (let j = 0; j < 10; j++) {
                this.createBlock(i, j);
            }
        }

        for (let i = 0; i < 5; i++) {
            this.createBlock(i, 12)
        }
        for (let i = 0; i < 20; i++) {
            this.createBlock(20, i);
        }

        //const gridHelper = new THREE.gridHelper(10,10);
        //gridHelper.rotation.x = Math.PI / 2;
        //this.scene.add(gridHelper);
    }

    createBlock(x, y) {
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

    removeBlock(x,y) {
        const key = `${x},${y}`;
        const block = this.blocks.get(key);
        if (block) {
            this.scene.remove(block);
            this.blocks.delete(key);
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


    update() {
        // maybe do something with this?
    }
}