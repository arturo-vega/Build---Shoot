export class Collider {
    static checkCollision(box1, box2) {
        return (
            box1.minX < box2.maxX &&
            box1.maxX > box2.minX &&
            box1.minY < box2.maxY &&
            box1.maxY > box2.minY
        );
    }

    static getBoundingBox(position, size) {
        if (!(size.x === 1) || !(size.y === 1)) { // work around for the player
            console.log(`minX: ${position.x + Math.abs(1 - size.x)} maxX: ${position.x - Math.abs(1 - size.x)} minY: ${position.y - (Math.abs(1 - size.y) / 2)} maxY: ${position.y + (Math.abs(1 - size.y) / 2)}`);
            return {
                minX: position.x + Math.abs(1 - size.x),
                maxX: position.x - Math.abs(1 - size.x),
                minY: position.y - (Math.abs(1 - size.y) / 2),
                maxY: position.y + (Math.abs(1 - size.y) / 2)
            };
        }
        else{
            return {
                minX: position.x,
                maxX: position.x + size.x,
                minY: position.y,
                maxY: position.y + size.y
            };
        }
    }

    static between(x, min, max) {
        return x >= min && x <= max;
    }
}