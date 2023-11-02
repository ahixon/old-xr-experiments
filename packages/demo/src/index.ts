import * as THREE from 'three';

import { WebGLRenderer } from '@realityshell/webgl-xr-renderer';

import { BoxLineGeometry } from './BoxLineGeometry.js';
// import { XRControllerModelFactory } from './three.js/examples/jsm/webxr/XRControllerModelFactory.js';

const clock = new THREE.Clock();

let container, container2;
let camera, scene, raycaster, renderer, renderer2;

let room;

let controller, controllerGrip;
let INTERSECTED;

let inlineSession;
const tempMatrix = new THREE.Matrix4();

init();
animate();

document.getElementById('viewer')?.addEventListener('click', () => {
    renderer.xr.beginPresentation('inline');
})

document.getElementById('immersive')?.addEventListener('click', () => {
    renderer.xr.beginPresentation('immersive-vr', {
        requiredFeatures: ["local-floor"],
    });
})

// window.setTimeout(() => {
//     console.log('starting presentation');
//     renderer.xr.beginPresentation('inline');
//     renderer2.xr.beginPresentation('inline');
// }, 1000)


const defaultCamera = new THREE.PerspectiveCamera( 90, window.innerWidth / window.innerHeight * 2, 0.1, 2000 );
defaultCamera.position.set( 0, 0, 0 );
scene.add( defaultCamera );

function init() {

    container = document.createElement( 'div' );
    document.body.appendChild( container );

    container2 = document.createElement( 'div' );
    document.body.appendChild( container2 );

    scene = new THREE.Scene();
    scene.background = new THREE.Color( 0x505050 );

    room = new THREE.LineSegments(
        new BoxLineGeometry( 6, 6, 6, 10, 10, 10 ).translate( 0, 3, 0 ),
        new THREE.LineBasicMaterial( { color: 0xbcbcbc } )
    );
    scene.add( room );

    const planeGeometry = new THREE.PlaneGeometry( 1, 1 );
    const material = new THREE.MeshBasicMaterial( {color: 0xffff00, side: THREE.DoubleSide} );
    const plane = new THREE.Mesh( planeGeometry, material );
    plane.position.x = 0;
    plane.position.y = 0;
    plane.position.z = -1;
    scene.add(plane)

    scene.add( new THREE.HemisphereLight( 0xa5a5a5, 0x898989, 3 ) );

    const light = new THREE.DirectionalLight( 0xffffff, 3 );
    light.position.set( 1, 1, 1 ).normalize();
    scene.add( light );

    const geometry = new THREE.BoxGeometry( 0.15, 0.15, 0.15 );

    for ( let i = 0; i < 200; i ++ ) {

        const object = new THREE.Mesh( geometry, new THREE.MeshLambertMaterial( { color: Math.random() * 0xffffff } ) );

        object.position.x = Math.random() * 4 - 2;
        object.position.y = Math.random() * 4;
        object.position.z = Math.random() * 4 - 2;

        object.rotation.x = Math.random() * 2 * Math.PI;
        object.rotation.y = Math.random() * 2 * Math.PI;
        object.rotation.z = Math.random() * 2 * Math.PI;

        object.scale.x = Math.random() + 0.5;
        object.scale.y = Math.random() + 0.5;
        object.scale.z = Math.random() + 0.5;

        object.userData.velocity = new THREE.Vector3();
        object.userData.velocity.x = Math.random() * 0.01 - 0.005;
        object.userData.velocity.y = Math.random() * 0.01 - 0.005;
        object.userData.velocity.z = Math.random() * 0.01 - 0.005;

        room.add( object );

    }

    raycaster = new THREE.Raycaster();

    renderer = new WebGLRenderer( { antialias: true } );
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight / 2 );
    // renderer.xr.enabled = true;
    container.appendChild( renderer.domElement );

    renderer2 = new WebGLRenderer( { antialias: true } );
    renderer2.setPixelRatio( window.devicePixelRatio );
    renderer2.setSize( window.innerWidth, window.innerHeight / 2 );
    container2.appendChild( renderer2.domElement );

    //

    function onSelectStart() {

        this.userData.isSelecting = true;

    }

    function onSelectEnd() {

        this.userData.isSelecting = false;

    }

    // controller = renderer.xr.getController( 0 );
    // controller.addEventListener( 'selectstart', onSelectStart );
    // controller.addEventListener( 'selectend', onSelectEnd );
    // controller.addEventListener( 'connected', function ( event ) {

    //     this.add( buildController( event.data ) );

    // } );
    // controller.addEventListener( 'disconnected', function () {

        // this.remove( this.children[ 0 ] );

    // } );
    // scene.add( controller );

    // const controllerModelFactory = new XRControllerModelFactory();

    // controllerGrip = renderer.xr.getControllerGrip( 0 );
    // controllerGrip.add( controllerModelFactory.createControllerModel( controllerGrip ) );
    // scene.add( controllerGrip );

    window.addEventListener( 'resize', onWindowResize );

}

function buildController( data ) {

    let geometry, material;

    switch ( data.targetRayMode ) {

        case 'tracked-pointer':

            geometry = new THREE.BufferGeometry();
            geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( [ 0, 0, 0, 0, 0, - 1 ], 3 ) );
            geometry.setAttribute( 'color', new THREE.Float32BufferAttribute( [ 0.5, 0.5, 0.5, 0, 0, 0 ], 3 ) );

            material = new THREE.LineBasicMaterial( { vertexColors: true, blending: THREE.AdditiveBlending } );

            return new THREE.Line( geometry, material );

        case 'gaze':

            geometry = new THREE.RingGeometry( 0.02, 0.04, 32 ).translate( 0, 0, - 1 );
            material = new THREE.MeshBasicMaterial( { opacity: 0.5, transparent: true } );
            return new THREE.Mesh( geometry, material );

    }

}

function onWindowResize() {

    defaultCamera.aspect = window.innerWidth / window.innerHeight * 2;
    defaultCamera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight / 2 );
    renderer2.setSize( window.innerWidth, window.innerHeight / 2 );

}

//

function animate() {

    renderer.setAnimationLoop( render );
    renderer2.setAnimationLoop( render );

    
}

function render(time, frame, cameras, renderer) {

    const delta = clock.getDelta() * 60;

    // if ( controller.userData.isSelecting === true ) {

    //     const cube = room.children[ 0 ];
    //     room.remove( cube );

    //     cube.position.copy( controller.position );
    //     cube.userData.velocity.x = ( Math.random() - 0.5 ) * 0.02 * delta;
    //     cube.userData.velocity.y = ( Math.random() - 0.5 ) * 0.02 * delta;
    //     cube.userData.velocity.z = ( Math.random() * 0.01 - 0.05 ) * delta;
    //     cube.userData.velocity.applyQuaternion( controller.quaternion );
    //     room.add( cube );

    // }

    // find intersections

    // tempMatrix.identity().extractRotation( controller.matrixWorld );

    // raycaster.ray.origin.setFromMatrixPosition( controller.matrixWorld );
    // raycaster.ray.direction.set( 0, 0, - 1 ).applyMatrix4( tempMatrix );

    // const intersects = raycaster.intersectObjects( room.children, false );

    // if ( intersects.length > 0 ) {

    //     if ( INTERSECTED != intersects[ 0 ].object ) {

    //         if ( INTERSECTED ) INTERSECTED.material.emissive.setHex( INTERSECTED.currentHex );

    //         INTERSECTED = intersects[ 0 ].object;
    //         INTERSECTED.currentHex = INTERSECTED.material.emissive.getHex();
    //         INTERSECTED.material.emissive.setHex( 0xff0000 );

    //     }

    // } else {

    //     if ( INTERSECTED ) INTERSECTED.material.emissive.setHex( INTERSECTED.currentHex );

    //     INTERSECTED = undefined;

    // }

    // Keep cubes inside room

    for ( let i = 0; i < room.children.length; i ++ ) {

        const cube = room.children[ i ];

        cube.userData.velocity.multiplyScalar( 1 - ( 0.001 * delta ) );

        cube.position.add( cube.userData.velocity );

        if ( cube.position.x < - 3 || cube.position.x > 3 ) {

            cube.position.x = THREE.MathUtils.clamp( cube.position.x, - 3, 3 );
            cube.userData.velocity.x = - cube.userData.velocity.x;

        }

        if ( cube.position.y < 0 || cube.position.y > 6 ) {

            cube.position.y = THREE.MathUtils.clamp( cube.position.y, 0, 6 );
            cube.userData.velocity.y = - cube.userData.velocity.y;

        }

        if ( cube.position.z < - 3 || cube.position.z > 3 ) {

            cube.position.z = THREE.MathUtils.clamp( cube.position.z, - 3, 3 );
            cube.userData.velocity.z = - cube.userData.velocity.z;

        }

        cube.rotation.x += cube.userData.velocity.x * 2 * delta;
        cube.rotation.y += cube.userData.velocity.y * 2 * delta;
        cube.rotation.z += cube.userData.velocity.z * 2 * delta;

    }

    if (!cameras) {
        cameras = [defaultCamera];
    }

    for (const camera of cameras) {
        renderer.render( scene, camera );
    }
}

window.addEventListener('resize', () => {
    console.log('resized')
});
