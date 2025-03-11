import * as THREE from 'three';

export class Block {
    constructor(x, y, type, health = 100, listener) {
        this.listener = listener;
        this.type = type;
        this.x = x;
        this.y = y;

        // all using wood sound but can change later
        const blockTypes = {
            'steel': {
                health: 100,
                destructible: false,
                color: 0x808080,
                sounds : {
                    place: './sounds/wood_place.ogg',
                    damage: './sounds/wood_damage.ogg',
                    destroy: './sounds/wood_destroy.ogg'
                }
            },
            'concrete': {
                health: 100,
                destructible: true,
                color: 0x8b8b8b,
                sounds : {
                    place: './sounds/wood_place.ogg',
                    damage: './sounds/wood_damage.ogg',
                    destroy: './sounds/wood_destroy.ogg'
                }
            },
            'wood': {
                health: 50,
                destructible: true,
                color: 0x8b4513,
                sounds : {
                    place: './sounds/wood_place.ogg',
                    damage: './sounds/wood_damage.ogg',
                    destroy: './sounds/wood_destroy.ogg'
                }
            }
        };

        // set block to wood if the type is undefined
        const properties = blockTypes[type] || blockTypes.wood;

        this.health = Math.min(properties.health, health);
        this.destructible = properties.destructible;
        this.maxHealth = properties.health;
        this.soundPaths = properties.sounds;

        this.sounds = {
            place: new THREE.PositionalAudio(this.listener),
            damage: new THREE.PositionalAudio(this.listener),
            destroy: new THREE.PositionalAudio(this.listener)
        };

        this.mesh = this.createMesh(properties.color);
        this.mesh.position.set(x, y, 0);

        Object.values(this.sounds).forEach(sound => {
            this.mesh.add(sound);
        });

        this.loadSounds();

        // play sound when block is created
        this.playSound('place');

        this.updateBoundingBox();
    }

    createMesh(color) {
        const textureLoader = new THREE.TextureLoader();

        const geometry = new THREE.BoxGeometry(1,1,1);
        const material = new THREE.MeshPhongMaterial({ color });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.material.transparent = true;

        textureLoader.load(`./textures/${this.type}.jpg`, (texture) => {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(1, 1);

            mesh.material.map = texture;
            mesh.material.needsUpdate = true;
        });
        
        return mesh;
    }

    loadSounds() {
        if (!this.listener) {
            console.warn("AudioListener not provided to Block");
            return;
        }

        const audioLoader = new THREE.AudioLoader();

        Object.entries(this.soundPaths).forEach(([type, path]) => {
            audioLoader.load(path, (buffer) => {
                // store the buffer in the corresponding sound object
                this.sounds[type].setBuffer(buffer);

                this.sounds[type].setRefDistance(5); // Distance at which the volume reduction starts
                this.sounds[type].setRolloffFactor(2); // How quickly the sound attenuates
                this.sounds[type].setVolume(0.5); // Default volume
            });
        });
    }

    playSound(type) {
        if (this.sounds[type] && this.sounds[type].buffer) {
            // stop any sounds already playing
            if (this.sounds[type].isPlaying) {
                this.sounds[type].stop();
            }
            this.sounds[type].play();
        }
    }

    updateBlockHealth(health) {
        const previousHealth = health;
        this.health = health;
        const damagePercentage = this.health / this.maxHealth;
        this.mesh.material.opacity  = 0.5 + (damagePercentage * 0.5);
        console.log("New opacity:   ",this.mesh.material.opacity );

        // check previous health of block and if it's higher than current it's been damaged
        if (this.health < previousHealth && this.health > 0) {
            this.playSound('damage');
        }
    }
    updateBlockType(type) {
        if (type !== this.type) {
            this.type = type;
            this.health = blockTypes[type].health;
        }
    }

    updateBoundingBox() {
        this.boundingBox = new THREE.Box3();
        this.boundingBox.setFromObject(this.mesh);
    }

    damage(amount) {
        if (!this.destructible) return false;

        this.health = Math.max(0, this.health - amount);

        console.log(`Block health: ${this.health}`);

        const damagePercentage = this.health / this.maxHealth;
        this.mesh.material.opacity = 0.5 + (damagePercentage * 0.5);

        // play damage sound if health isn't 0
        if (this.health > 0) {
            this.playSound('damage');
        }

        // return true if block is destroyed
        return this.health === 0;
    }

    destroy() {
        this.playSound('destroy');
        
        // small delay to allow sound to play before disposing resources
        setTimeout(() => {
            // clean up audio resources
            Object.values(this.sounds).forEach(sound => {
                if (sound.source) {
                    sound.disconnect();
                }
            });
            
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
        }, 250); // 200ms delay to let the sound play
    }
}