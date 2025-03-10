import * as THREE from 'three';

export class Item {
    constructor(type, scene, world, player, game) {
        this.type = type;
        this.scene = scene;
        this.world = world;
        this.player = player;
        this.game = game;
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
                const damage = 20;
                this.castRay(damage);
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

    castRay(damage) {
        const intersectPoint = this.getRayPlaneIntersection(
            this.player.camera,
            this.player.mouseRaycaster.ray.direction
        );

        const rayDirection = new THREE.Vector3(
            intersectPoint.x - this.player.position.x,
            intersectPoint.y - this.player.position.y,
            0
        ).normalize();

        const rayStart = new THREE.Vector3(this.player.position.x, this.player.position.y, 0);
        const raycaster = new THREE.Raycaster(rayStart, rayDirection);

        const intersects = raycaster.intersectObjects(this.scene.children);

        console.log(`Raydirection: ${rayDirection.x}, ${rayDirection.y}`);

        if (intersects.length > 0) {
            const firstIntersected = intersects[0];
            console.log('Ray hit: ', firstIntersected.object);

            const block = this.world.getBlockAt(firstIntersected.object.position.x, firstIntersected.object.position.y);
            if (block) {
                this.world.damageBlock(block.x, block.y, damage);
                console.log(`Block ${block.x}, ${block.y} damaged`);
            }
            // rudimentary player damage
            for (const [playerId, otherPlayer] of this.game.otherPlayers) {
                const intersectPos = firstIntersected.object.position;
                const otherPos = otherPlayer.position;

                if (intersectPos.x === otherPos.x && intersectPos.y === otherPos.y) {
                    console.log(`Hit player ${playerId} dealing ${damage} damage`);

                    otherPlayer.damage(damage,rayDirection);
                    this.player.didDamage = true;
                    this.player.playerRayDirection.x = rayDirection.x;
                    this.player.playerRayDirection.y = rayDirection.y;
                    this.player.damageDealt = damage;
                    this.player.playerDamaged = playerId;
                }
            }
        }
    }

    // used for finding out where to place blocks in the world
    getRayPlaneIntersection(camera, rayDirection) {
        // intersection at point z = 0
        // cameraPosition.z + t * rayDirection.z = 0
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