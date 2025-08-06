import * as THREE from 'three';

export class Projectiles {
    constructor(scene) {
        this.scene = scene;
        this.currentProjectiles = [];
    }

    createBeam(rayDirection, playerPosition, objectPosition = null) {
        let beamLength = 40;
        // if the beam intersected an object shorten the beam length based on the distance between player and object
        if (objectPosition != null) {
            let x1 = playerPosition.x;
            let y1 = playerPosition.y;
            let x2 = objectPosition.x;
            let y2 = objectPosition.y;

            beamLength = Math.sqrt(Math.pow((x2 - x1), 2) + Math.pow((y2 - y1), 2));
        }
        //radius top, radius bottom, height (length), radial segments (how 'round' it is)
        const geometry = new THREE.CylinderGeometry(0.1, 0.1, beamLength, 3);
        const material = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        const cylinder = new THREE.Mesh(geometry, material);

        cylinder.rotateZ(Math.PI / 2); // make beam horizontal along Z axis

        const angle = Math.atan2(rayDirection.y, rayDirection.x)
        cylinder.rotateZ(angle);

        // set playerPosition of ray but off set it by half the length of the beam so it starts at the player
        cylinder.position.set(playerPosition.x, playerPosition.y);
        cylinder.position.add(rayDirection.multiplyScalar(beamLength / 2));

        cylinder.material.transparent = true;
        //cylinder.material.needsUpdate = true;

        let timeToLive = 15;
        const projectileType = {
            type: 'beam',
            timeToLive: timeToLive,
            object: cylinder
        };

        this.currentProjectiles.push(projectileType);

        this.scene.add(cylinder);
    }

    update() {
        for (let i = 0; i < this.currentProjectiles.length; i++) {

            const projectile = this.currentProjectiles[i];

            if (projectile.type === 'beam') {
                projectile.timeToLive -= 1;
                projectile.object.material.opacity += 0.1;

                if (projectile.timeToLive <= 0) {
                    this.currentProjectiles.shift();
                    this.destroy(projectile);
                } else {
                    this.currentProjectiles[i].timeToLive = projectile.timeToLive;
                }
            }
            else {
                // do something else
            }
        }
    }

    destroy(projectile) {
        this.scene.remove(projectile.object);
    }
}