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

        this.world.createBlock(x, y, this.player.playerBB);
    }

    removeBlock() {
        const intersectPoint = this.getRayPlaneIntersection(
            this.player.camera,
            this.player.mouseRaycaster.ray.direction
        );

        const x = Math.floor(intersectPoint.x);
        const y = Math.floor(intersectPoint.y);

        const block = this.world.getBlockAt(x, y);

        if (block && block.type != 'steel') {
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

        // update the player ray direction
        this.player.playerRayDirection.x = rayDirection.x;
        this.player.playerRayDirection.y = rayDirection.y;

        const rayStart = new THREE.Vector3(this.player.position.x, this.player.position.y, 0);
        const raycaster = new THREE.Raycaster(rayStart, rayDirection);

        const intersects = raycaster.intersectObjects(this.scene.children);

        const taggableMeshes = ["head", "Body_1", "block"];

        // check after 1 because currently the beam will always detect the player's head
        if (intersects.length > 1) {
            for (let i = 1; i < intersects.length; i++) {

                // get the actual 3D game instance of what it intersects
                let object = intersects[i].object;
                let intesectPoint = intersects[i].point;

                // creates the beam from the gun -------------------------
                // this is for when the beam needs to be truncated because it intersected with an object
                // sends player and coordinates of the object
                this.game.projectiles.createBeam(
                    rayDirection,
                    { x: this.player.position.x, y: this.player.position.y }, // player position
                    { x: intesectPoint.x, y: intesectPoint.y } // object position
                );

                const block = this.world.getBlockAt(object.position.x, object.position.y);
                if (block) {
                    this.world.damageBlock(block.x, block.y, damage);
                    return;
                }

                let objectParent = object;
                while (objectParent.parent.type !== 'Scene') {
                    objectParent = objectParent.parent;

                    if (objectParent.parent === null || objectParent === null) {
                        break;
                    }
                }

                if (this.player.id == objectParent.userData.id) {
                    continue;
                }
                const otherPlayer = this.game.otherPlayers.get(objectParent.userData.id);
                // rudimentary player damage
                if (otherPlayer) {

                    otherPlayer.damage(damage, rayDirection);
                    this.player.didDamage = true;
                    this.player.damageDealt = damage;
                    this.player.playerDamaged = otherPlayer.id;
                }
                return;
            }
        } else {
            // creates the beam from the gun -------------------------
            // this is for when the beam does not intersect so extends its full length
            this.game.projectiles.createBeam(rayDirection, { x: this.player.position.x, y: this.player.position.y });
        }

    }

    intersectsPlayerBB(playerBB, intesectPoint) {
        if (intesectPoint.x >= playerBB.min.x &&
            intesectPoint.x <= playerBB.max.x &&
            intesectPoint.y >= playerBB.min.y &&
            intesectPoint.y <= playerBB.max.y) {
            console.log("intersected player");
            return true;
        }

        return false;
    }

    // used for finding out where to place blocks in the world
    getRayPlaneIntersection(camera, rayDirection) {
        // intersection at point z = 0
        // cameraPosition.z + t * rayDirection.z = 0
        // solve for t and find intersection point

        const t = -camera.position.z / rayDirection.z;

        const intersectionPoint = new THREE.Vector3(
            camera.position.x + t * rayDirection.x,
            camera.position.y + t * rayDirection.y,
            0 // z is always 0
        );

        return intersectionPoint;
    }
}