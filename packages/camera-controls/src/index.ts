import { degToRad } from "@realityshell/engine/utils";
import { vec3, mat4 } from "gl-matrix";

export class OrbitCameraControls {
    canvas: HTMLCanvasElement;
    fieldOfViewRadians: number;

    cameraPosition: vec3;
    cameraMatrix: mat4;
    cameraMatrixWorld: mat4;
    viewProjectionMatrix: mat4

    radius: number;
    azimuth: number;
    elevation: number;

    isLeftDragging: boolean;
    isRightDragging: boolean;
    lastMousePosition: { x: number, y: number };

    target: vec3;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;

        this.cameraMatrix = mat4.create();
        this.viewProjectionMatrix = mat4.create();
        this.cameraMatrixWorld = mat4.create();
        this.cameraPosition = vec3.fromValues(0, 0, 0);
        this.fieldOfViewRadians = degToRad(60);

        this.radius = 10; // Initialize to a reasonable default
        this.azimuth = 0; // Initialize to a reasonable default
        this.elevation = 20; // Initialize to a reasonable default

        this.isLeftDragging = false;
        this.isRightDragging = false;
        this.lastMousePosition = { x: 0, y: 0 };

        this.target = vec3.create(); // Initialize to the origin

        this.registerEventListeners();
        this.updateCameraMatrix();
    }

    registerEventListeners() {
        this.canvas.addEventListener('mousedown', (event) => this.onMouseDown(event));
        this.canvas.addEventListener('mousemove', (event) => this.onMouseMove(event));
        this.canvas.addEventListener('mouseup', (event) => this.onMouseUp(event));
        this.canvas.addEventListener('contextmenu', (event) => event.preventDefault());
        this.canvas.addEventListener('wheel', (event) => this.onMouseWheel(event));
    }

    onMouseWheel(event: WheelEvent) {
        // Adjust the radius based on the wheel event's deltaY property
        this.radius += event.deltaY * 0.01;
    
        // Make sure the radius is not too small or too large
        // this.radius = Math.min(Math.max(this.radius, 1), 100);
    
        this.updateCameraMatrix();
    }

    onMouseDown(event: MouseEvent) {
        this.lastMousePosition = { x: event.clientX, y: event.clientY };
    }

    onMouseMove(event: MouseEvent) {
        if (event.buttons === 0) {
            return;
        }
    
        const dx = event.clientX - this.lastMousePosition.x;
        const dy = event.clientY - this.lastMousePosition.y;
    
        if (event.buttons & 1) { // Left mouse button
            this.azimuth += dx * 0.01;
            this.elevation += -dy * 0.01;
        } else if (event.buttons & 2) { // Right mouse button
            // Create a fixed "right" vector for the X-axis and a "forward" vector for the Z-axis
            const right = vec3.fromValues(1, 0, 0);
            const forward = vec3.fromValues(0, 0, -1);
    
            // Calculate the movement vectors in the X-Z plane
            const movementX = vec3.scale(vec3.create(), right, dy * 0.1);
            const movementZ = vec3.scale(vec3.create(), forward, dx * 0.1);
    
            // Add the movement vectors to get the total movement vector
            const movement = vec3.add(vec3.create(), movementX, movementZ);
    
            // Add the movement vector to the target and the camera position
            vec3.add(this.target, this.target, movement);
            vec3.add(this.cameraPosition, this.cameraPosition, movement);
        }
    
        this.lastMousePosition = { x: event.clientX, y: event.clientY };
    
        this.updateCameraMatrix();
    }

    onMouseUp(event: MouseEvent) {
        // empty
    }

    updateCameraMatrix() {
        const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
        const projectionMatrix = mat4.create();
        mat4.perspective(projectionMatrix, this.fieldOfViewRadians, aspect, 1, 2000);
    
        const x = this.radius * Math.sin(this.elevation) * Math.cos(this.azimuth);
        const y = this.radius * Math.cos(this.elevation);
        const z = this.radius * Math.sin(this.elevation) * Math.sin(this.azimuth);
    
        const cameraPosition = vec3.fromValues(x, y, z);
        vec3.add(cameraPosition, cameraPosition, this.cameraPosition);
    
        mat4.lookAt(this.cameraMatrix, cameraPosition, this.target, vec3.fromValues(0, 1, 0));

        // Calculate the camera's world matrix by inverting the view matrix
        this.cameraMatrixWorld = mat4.create();
        mat4.invert(this.cameraMatrixWorld, this.cameraMatrix);
    
        mat4.multiply(this.viewProjectionMatrix, projectionMatrix, this.cameraMatrix);
    }
}