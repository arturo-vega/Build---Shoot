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
        return {
            minX: position.x - size.x / 2,
            maxX: position.x + size.x / 2,
            minY: position.y - size.y / 2,
            maxY: position.y + size.y / 2
        };
    }
}