import * as THREE from 'three';

export class Item {
    constructor(type, scene, world, player) {
        this.type = type;
        this.scene = scene;
        this.world = world;
        this.player = player;
    }

    use() {
        switch (this.type) {
            case 'placer':
                this.placeBlock();
                break;
            case 'remover':
                this.removeBlock();
                break;
            case 'weapon':
                break;
            default:
                console.error('Unknown item type: ', this.type);
        }
    }

    placeBlock() {
        const intersectPoint = this.getRayPlaneIntersection(
            this.player.camera,
            this.player.mouseRaycaster.ray.direction
        );

        const x = Math.floor(intersectPoint.x);
        const y = Math.floor(intersectPoint.y);

        if (this.world.isValidSpot(x, y)) {
            this.world.createBlock(x, y, this.player.playerBB);
        }
    }

    removeBlock() {
        const intersectPoint = this.getRayPlaneIntersection(
            this.player.camera,
            this.player.mouseRaycaster.ray.direction
        );

        const x = Math.floor(intersectPoint.x);
        const y = Math.floor(intersectPoint.y);

        if (!this.world.isValidSpot(x,y)) {
            this.world.removeBlock(x, y);
        }
    }

    castRay() {
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(this.player.mouse, this.player.camera);

        const intersects = raycaster.intersectObject(this.scene.children);

        if (intersects.length > 0) {
            const firstIntersected = intersects[0];
            console.log('Ray hit: ', firstIntersected.object);

            // --------------- add more?
        }
    }


    // used for finding out where to place blocks in the world
    getRayPlaneIntersection(camera, rayDirection) {
        // intersection at point z = 0
        // cameraPostion.z + t * rayDirection.z = 0
        // solve for t and find intersection point

        const t = -camera.position.z / rayDirection.z;

        const intersectionPoint = new THREE.Vector3 (
            camera.position.x + t * rayDirection.x,
            camera.position.y + t * rayDirection.y,
            0 // z is always 0
        );

        return intersectionPoint;
        }
}