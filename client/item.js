import * as THREE from 'three';

export class Item {
    constructor(type, scene, world, camera, game, player) {
        this.type = type;
        this.scene = scene;
        this.world = world;
        this.camera = camera;
        this.game = game;
        this.player = player;
        this.mouseRaycaster = new THREE.Raycaster();
        this.previousMousePosition = { x: 10, y: 10 };
        this.currentMousePosition = { x: 0, y: 0 };
        this.ghostBlockOn = false;

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
                this.castRay();
                break;
            default:
                console.error('Unknown item type: ', this.type);
        }
    }

    placeBlock() {
        if (this.player.placeCharge < this.player.maxPlaceCharge || this.player.blocksOwned < 1) {
            return;
        }

        const intersectPoint = this.getRayPlaneIntersection(
            this.camera,
            this.mouseRaycaster.ray.direction
        );

        const x = Math.floor(intersectPoint.x);
        const y = Math.floor(intersectPoint.y);

        if (this.world.isValidSpot(x, y)) {
            this.world.createBlock(x, y, this.player.playerBB);
            this.player.placeCharge = 0;
            this.player.blocksOwned -= 1;
        }
    }

    removeBlock() {
        if (this.player.removeCharge < this.player.maxRemoveCharge) {
            return;
        }

        const intersectPoint = this.getRayPlaneIntersection(
            this.camera,
            this.mouseRaycaster.ray.direction
        );

        const x = Math.floor(intersectPoint.x);
        const y = Math.floor(intersectPoint.y);

        const block = this.world.getBlockAt(x, y);

        if (block && block.type != 'steel') {
            this.world.removeBlock(x, y);
            this.player.removeCharge = 0;
            this.player.blocksOwned += 1;
        }
    }

    updateWandCharge() {
        this.player.wandCharge -= this.player.wandChargeUsed;
        if (this.player.wandCharge < 0) {
            this.player.wandCharge = 0;
        }
    }

    calculateDamage() {
        if (this.player.wandCharge < this.player.wandChargeUsed) {
            let underflow = this.player.wandCharge - this.player.wandChargeUsed
            let damage = this.player.wandChargeUsed + underflow
            return damage
        }

        else {
            return this.player.wandChargeUsed
        }

    }

    castRay() {
        if (this.player.wandCharge < this.player.wandChargeUsed) {
            return;
        }

        const intersectPoint = this.getRayPlaneIntersection(
            this.camera,
            this.mouseRaycaster.ray.direction
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
                    this.world.damageBlock(block.x, block.y, this.calculateDamage());
                    this.updateWandCharge();
                    return;
                }
                const otherPlayer = this.game.otherPlayers.get(objectParent.userData.id);

                // rudimentary player damage
                if (otherPlayer && otherPlayer.playerTeam != this.player.playerTeam) {

                    otherPlayer.damage(this.calculateDamage(), rayDirection);
                    this.player.didDamage = true;
                    this.player.damageDealt = this.calculateDamage();
                    this.player.playerDamaged = otherPlayer.id;
                }

                this.updateWandCharge();
                return;
            }
        } else {
            // creates the beam from the gun -------------------------
            // this is for when the beam does not intersect so extends its full length
            this.game.projectiles.createBeam(rayDirection, { x: this.player.position.x, y: this.player.position.y });
            this.updateWandCharge();
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

    updateGhost(mouse, itemName) {
        this.mouseRaycaster.setFromCamera(mouse, this.camera);

        this.previousMousePosition = this.currentMousePosition;
        this.currentMousePosition = { x: Math.floor(mouse.x), y: Math.floor(mouse.y) };

        const intersectionPoint = this.getRayPlaneIntersection(
            this.camera,
            this.mouseRaycaster.ray.direction
        );

        this.currentMousePosition.x = Math.floor(intersectionPoint.x);
        this.currentMousePosition.y = Math.floor(intersectionPoint.y);

        if (
            (!this.mouseInSameSpot(this.previousMousePosition, this.currentMousePosition) || !this.ghostBlockOn)
            && (this.type === 'placer' || this.type === 'remover')
        ) {
            this.world.removeBlock(this.previousMousePosition.x, this.previousMousePosition.y, 'ghost');
            this.world.blockGhost(Math.floor(intersectionPoint.x), Math.floor(intersectionPoint.y), this.player.playerBB, itemName);
            this.ghostBlockOn = true;
        } else if (this.type === 'weapon' || this.player.isDead) {
            this.world.removeBlock(this.previousMousePosition.x, this.previousMousePosition.y, 'ghost');
            this.ghostBlockOn = false;
        }
    }

    mouseInSameSpot(previousMousePosition, currentMousePosition) {
        return previousMousePosition.x === currentMousePosition.x && previousMousePosition.y === currentMousePosition.y;
    }
}