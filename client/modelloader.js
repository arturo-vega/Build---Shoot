import { GLTFLoader } from '../node_modules/three/examples/jsm/loaders/GLTFLoader';
export class ModelLoader {
    constructor(url) {
        this.url = url;
    }

    loadModel() {
        const gltfLoader = new GLTFLoader();
        gltfLoader.load(this.url, (model) => {


            return model;
        });
    }
}