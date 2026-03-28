// =============================================
// SCOTT - Ambulance Rescue 64
// A Super Mario 64 inspired 3D game
// =============================================

(function() {
'use strict';

// ---- CONSTANTS ----
// On-foot physics
const GRAVITY = -40;
const JUMP_FORCE = 14.5;
const JUMP_CUT_MULT = 0.4;   // release jump early = shorter jump
const COYOTE_TIME = 0.12;    // seconds after leaving edge you can still jump
const JUMP_BUFFER = 0.1;     // press jump slightly early
const MOVE_SPEED = 17;
const SPRINT_SPEED = 24;
const ACCEL_GROUND = 90;     // snappy ground acceleration
const ACCEL_AIR = 30;        // reduced air control
const FRICTION_GROUND = 28;  // ground deceleration (stops quickly)
const FRICTION_AIR = 1.5;    // barely any air drag
const TURN_SPEED = 15;       // player facing rotation speed
const CAMERA_DIST = 16;
const CAMERA_HEIGHT = 8;
const CAMERA_SMOOTH = 8;     // camera interpolation speed
const WORLD_SIZE = 500;
const PATIENT_INTERACT_DIST = 6;
const AMB_INTERACT_DIST = 6;

// Vehicle physics (GTA-inspired)
const VEH_ENGINE_FORCE = 65;      // engine power (boosted)
const VEH_BRAKE_FORCE = 60;       // brake deceleration
const VEH_REVERSE_FORCE = 25;     // reverse throttle
const VEH_MAX_SPEED = 75;         // top speed (boosted)
const VEH_DRAG = 0.22;            // aerodynamic drag (reduced)
const VEH_ROLL_FRICTION = 1.8;    // rolling resistance (reduced)
const VEH_STEER_MAX = 2.8;        // max steering rate
const VEH_STEER_SPEED_FACTOR = 0.6;// reduce steering at high speed
const VEH_GRIP = 0.92;            // tire lateral grip (0-1)
const VEH_DRIFT_GRIP = 0.45;      // grip while handbraking
const VEH_HANDBRAKE_DRAG = 6;     // handbrake friction
const VEH_MASS = 2800;            // kg - ambulance is heavy
const VEH_SUSPENSION_STIFF = 18;  // how fast it follows terrain
const VEH_BODY_ROLL_MAX = 0.08;   // max roll angle
const VEH_PITCH_MAX = 0.12;       // max pitch angle

// ---- GAME STATE ----
const state = {
    phase: 'title', // title, playing, paused, gameover, win
    stars: 0,
    health: 3,
    lives: 3,
    collectedStars: new Set(),
    playerPos: new THREE.Vector3(0, 2, 0),
    playerVel: new THREE.Vector3(0, 0, 0),
    onGround: false,
    cameraAngle: 0,
    cameraPitch: 0.3,
    nearPatient: null,
    invincible: 0,
    showStarOverlay: false,
    // Ambulance state
    inAmbulance: false,
    nearAmbulance: false,
    facingAngle: 0,
    // Jump helpers
    coyoteTimer: 0,
    jumpBufferTimer: 0,
    wasOnGround: false,
    sprinting: false,
    // Vehicle state
    vehSpeed: 0,          // forward speed (signed)
    vehAngle: 0,          // heading
    vehSteerAngle: 0,     // current visual steer
    vehLateralVel: 0,     // sideways velocity for drift
    vehSuspHeight: 0,     // suspension offset
    vehSuspVel: 0,        // suspension velocity
    vehBodyRoll: 0,       // body roll angle
    vehBodyPitch: 0,      // body pitch angle
    vehHandbrake: false,  // handbrake engaged
    vehRPM: 0,            // engine RPM (visual)
    vehWheelRot: 0,       // wheel rotation
    // Camera smoothing
    camPos: new THREE.Vector3(0, 15, -20),
    camLookAt: new THREE.Vector3(0, 2, 0)
};

// ---- INPUT ----
const keys = {};
let mouseDown = false;
let mouseDX = 0, mouseDY = 0;

document.addEventListener('keydown', e => { keys[e.code] = true; handleKey(e); });
document.addEventListener('keyup', e => { keys[e.code] = false; });
document.addEventListener('mousedown', () => mouseDown = true);
document.addEventListener('mouseup', () => mouseDown = false);
document.addEventListener('mousemove', e => {
    if (document.pointerLockElement) {
        mouseDX += e.movementX;
        mouseDY += e.movementY;
    }
});
document.addEventListener('click', () => {
    if (state.phase === 'playing' && renderer.domElement) {
        renderer.domElement.requestPointerLock();
    }
});

// ---- ZONE DEFINITIONS (Vancouver geography) ----
const ZONES = [
    { name: 'Downtown Vancouver', pos: [60, 0, 50], color: 0x4488cc, starsRequired: 0,
      desc: 'Office worker collapsed on Robson St!' },
    { name: 'Stanley Park', pos: [-60, 0, 80], color: 0x228844, starsRequired: 0,
      desc: 'Cyclist injured on the Seawall!' },
    { name: 'Gastown', pos: [30, 0, 100], color: 0x886644, starsRequired: 0,
      desc: 'Tourist fell near the Steam Clock!' },
    { name: 'English Bay', pos: [-20, 0, -30], color: 0x3366aa, starsRequired: 2,
      desc: 'Swimmer in distress at the beach!' },
    { name: 'Kitsilano', pos: [-80, 0, -70], color: 0x669944, starsRequired: 3,
      desc: 'Jogger collapsed on Kits Beach!' },
    { name: 'North Vancouver', pos: [0, 15, -150], color: 0x336633, starsRequired: 4,
      desc: 'Hiker lost on Grouse Mountain!' }
];

// ---- THREE.JS SETUP ----
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x88bbdd, 0.003);
scene.background = new THREE.Color(0x88bbdd);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.5, 600);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---- LIGHTING ----
const ambientLight = new THREE.AmbientLight(0x6688aa, 0.6);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffeedd, 1.0);
sunLight.position.set(100, 150, 80);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.left = -150;
sunLight.shadow.camera.right = 150;
sunLight.shadow.camera.top = 150;
sunLight.shadow.camera.bottom = -150;
scene.add(sunLight);

const hemiLight = new THREE.HemisphereLight(0x88ccff, 0x445522, 0.4);
scene.add(hemiLight);

// ---- MATERIALS ----
const mats = {
    grass: new THREE.MeshLambertMaterial({ color: 0x4a8c3f }),
    road: new THREE.MeshLambertMaterial({ color: 0x444444 }),
    building: new THREE.MeshLambertMaterial({ color: 0x888899 }),
    tree_trunk: new THREE.MeshLambertMaterial({ color: 0x664422 }),
    tree_leaves: new THREE.MeshLambertMaterial({ color: 0x2d7a2d }),
    snow: new THREE.MeshLambertMaterial({ color: 0xeeeeff }),
    water: new THREE.MeshLambertMaterial({ color: 0x2255aa, transparent: true, opacity: 0.7 }),
    rock: new THREE.MeshLambertMaterial({ color: 0x777777 }),
    sand: new THREE.MeshLambertMaterial({ color: 0xccbb88 }),
    wood: new THREE.MeshLambertMaterial({ color: 0x886633 }),
    red: new THREE.MeshLambertMaterial({ color: 0xcc3333 }),
    white: new THREE.MeshLambertMaterial({ color: 0xeeeeee }),
    yellow: new THREE.MeshLambertMaterial({ color: 0xffcc00 }),
    gate: new THREE.MeshLambertMaterial({ color: 0xff8800, transparent: true, opacity: 0.5 }),
    patient_glow: new THREE.MeshBasicMaterial({ color: 0x00ffaa }),
};

// ---- COLLISION SYSTEM ----
const colliders = []; // {min: Vec3, max: Vec3}

function addCollider(x, y, z, w, h, d) {
    colliders.push({
        min: new THREE.Vector3(x - w/2, y, z - d/2),
        max: new THREE.Vector3(x + w/2, y + h, z + d/2)
    });
}

function checkCollision(pos, radius) {
    for (const c of colliders) {
        const cx = Math.max(c.min.x, Math.min(pos.x, c.max.x));
        const cz = Math.max(c.min.z, Math.min(pos.z, c.max.z));
        const dx = pos.x - cx;
        const dz = pos.z - cz;
        if (dx * dx + dz * dz < radius * radius && pos.y < c.max.y && pos.y + 2 > c.min.y) {
            return { hit: true, box: c, nx: dx, nz: dz };
        }
    }
    return { hit: false };
}

// ---- HELPER FUNCTIONS ----
function box(w, h, d, mat) {
    const g = new THREE.BoxGeometry(w, h, d);
    const m = new THREE.Mesh(g, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
}

function cylinder(rT, rB, h, seg, mat) {
    const g = new THREE.CylinderGeometry(rT, rB, h, seg);
    const m = new THREE.Mesh(g, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
}

function addTree(x, z, scale) {
    scale = scale || 1;
    const trunk = cylinder(0.3 * scale, 0.4 * scale, 3 * scale, 6, mats.tree_trunk);
    trunk.position.set(x, 1.5 * scale, z);
    scene.add(trunk);
    const leaves = new THREE.Mesh(new THREE.SphereGeometry(2 * scale, 6, 5), mats.tree_leaves);
    leaves.position.set(x, 4 * scale, z);
    leaves.castShadow = true;
    scene.add(leaves);
    addCollider(x, 0, z, 1, 4 * scale, 1);
}

function addRock(x, z, scale) {
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(scale, 0), mats.rock);
    r.position.set(x, scale * 0.5, z);
    r.rotation.set(Math.random(), Math.random(), 0);
    r.castShadow = true;
    scene.add(r);
    addCollider(x, 0, z, scale * 1.5, scale * 1.2, scale * 1.5);
}

function addBuilding(x, z, w, h, d, mat) {
    mat = mat || mats.building;
    const b = box(w, h, d, mat);
    b.position.set(x, h / 2, z);
    scene.add(b);
    addCollider(x, 0, z, w, h, d);
}

function addRoad(x1, z1, x2, z2, width) {
    const dx = x2 - x1, dz = z2 - z1;
    const len = Math.sqrt(dx * dx + dz * dz);
    const r = box(width, 0.15, len, mats.road);
    r.position.set((x1 + x2) / 2, 0.08, (z1 + z2) / 2);
    r.rotation.y = Math.atan2(dx, dz);
    r.receiveShadow = true;
    scene.add(r);
}

// ---- BUILD WORLD (Vancouver-inspired) ----
function buildWorld() {
    // Ground mesh — displaced by getTerrainHeight
    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(WORLD_SIZE * 2, WORLD_SIZE * 2, 120, 120),
        mats.grass
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    const displaceGround = () => {
        const verts = ground.geometry.attributes.position;
        for (let i = 0; i < verts.count; i++) {
            const x = verts.getX(i);
            const y = verts.getY(i);
            const h = getTerrainHeight(x, -y);
            verts.setZ(i, h);
        }
        ground.geometry.computeVertexNormals();
        ground.geometry.attributes.position.needsUpdate = true;
    };
    displaceGround();

    // ========================================
    // BURRARD INLET (water body between downtown and north van)
    // ========================================
    const inlet = new THREE.Mesh(new THREE.PlaneGeometry(250, 60), mats.water);
    inlet.rotation.x = -Math.PI / 2;
    inlet.position.set(0, 0.8, -80);
    scene.add(inlet);
    const inletShimmer = new THREE.Mesh(new THREE.PlaneGeometry(248, 58),
        new THREE.MeshBasicMaterial({ color: 0x2266aa, transparent: true, opacity: 0.25 }));
    inletShimmer.rotation.x = -Math.PI / 2;
    inletShimmer.position.set(0, 0.85, -80);
    scene.add(inletShimmer);

    // ========================================
    // ENGLISH BAY (water on the west side)
    // ========================================
    const bay = new THREE.Mesh(new THREE.CircleGeometry(35, 20), mats.water);
    bay.rotation.x = -Math.PI / 2;
    bay.position.set(-20, 0.8, -30);
    scene.add(bay);
    // Sandy beach
    const bayBeach = new THREE.Mesh(new THREE.RingGeometry(33, 42, 20), mats.sand);
    bayBeach.rotation.x = -Math.PI / 2;
    bayBeach.position.set(-20, 0.15, -30);
    scene.add(bayBeach);
    // Beach volleyball posts
    for (let i = 0; i < 3; i++) {
        const post = cylinder(0.08, 0.08, 3, 4, mats.wood);
        post.position.set(-30 + i * 10, 1.5, -15);
        scene.add(post);
    }

    // ========================================
    // HUB: VGH Hospital (Vancouver General Hospital)
    // ========================================
    // Main Hospital building
    addBuilding(0, -5, 20, 8, 14, new THREE.MeshLambertMaterial({ color: 0xcccccc }));
    // Emergency wing
    addBuilding(12, 0, 10, 5, 8, new THREE.MeshLambertMaterial({ color: 0xbbbbbb }));
    // Red cross on front
    const cross1 = box(6, 1, 0.3, mats.red);
    cross1.position.set(0, 5, -12);
    scene.add(cross1);
    const cross2 = box(1.5, 4, 0.3, mats.red);
    cross2.position.set(0, 4, -12);
    scene.add(cross2);
    // Hospital sign
    const sign = box(8, 1.5, 0.2, new THREE.MeshLambertMaterial({ color: 0x2244aa }));
    sign.position.set(0, 9.5, -12.1);
    scene.add(sign);
    // Parking lot surface (slightly different color)
    const parkingLot = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), mats.road);
    parkingLot.rotation.x = -Math.PI / 2;
    parkingLot.position.set(0, 0.05, 0);
    scene.add(parkingLot);
    // Parking lines
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xdddddd });
    for (let i = -3; i <= 3; i++) {
        const line = box(0.15, 0.01, 4, lineMat);
        line.position.set(i * 3.5, 0.06, 20);
        scene.add(line);
    }

    // ========================================
    // ROAD NETWORK (Vancouver grid + main arteries)
    // ========================================
    // Main arteries from hospital
    addRoad(0, 0, 60, 50, 8);   // to Downtown (like Cambie)
    addRoad(0, 0, -60, 80, 7);  // to Stanley Park (like Georgia St)
    addRoad(0, 0, 30, 100, 7);  // to Gastown (like Hastings)
    addRoad(0, 0, -20, -30, 6); // to English Bay (like Denman)
    addRoad(0, 0, -80, -70, 7); // to Kits (like Broadway)
    addRoad(0, -50, 0, -150, 6);// to North Van (Lions Gate Bridge road)

    // Downtown grid streets (E-W)
    for (let z = 40; z <= 70; z += 15) {
        addRoad(35, z, 95, z, 5);
    }
    // Downtown grid streets (N-S)
    for (let x = 40; x <= 90; x += 12) {
        addRoad(x, 35, x, 75, 5);
    }
    // Connecting roads
    addRoad(60, 50, 30, 100, 5); // Downtown to Gastown
    addRoad(-60, 80, 30, 100, 5); // Stanley Park to Gastown
    addRoad(-60, 80, -20, -30, 5); // Stanley Park to English Bay
    addRoad(-20, -30, -80, -70, 5); // English Bay to Kits

    // Lions Gate Bridge (connecting south to north over inlet)
    const bridgeMat = new THREE.MeshLambertMaterial({ color: 0xcc4422 });
    const bridgeDeck = box(6, 0.5, 55, mats.road);
    bridgeDeck.position.set(0, 3, -80);
    scene.add(bridgeDeck);
    // Bridge towers
    const towerL = box(1.5, 20, 1.5, bridgeMat);
    towerL.position.set(-3, 10, -65);
    scene.add(towerL);
    const towerR = box(1.5, 20, 1.5, bridgeMat);
    towerR.position.set(3, 10, -65);
    scene.add(towerR);
    const towerL2 = box(1.5, 20, 1.5, bridgeMat);
    towerL2.position.set(-3, 10, -95);
    scene.add(towerL2);
    const towerR2 = box(1.5, 20, 1.5, bridgeMat);
    towerR2.position.set(3, 10, -95);
    scene.add(towerR2);
    // Bridge cables (simplified as thin boxes)
    const cableMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
    for (let i = -3; i <= 3; i++) {
        const cable = box(0.1, 0.1, 60, cableMat);
        cable.position.set(i * 1.5, 18, -80);
        scene.add(cable);
    }
    // Bridge railings
    const railing = box(0.2, 1.5, 55, bridgeMat);
    railing.position.set(-3.2, 4, -80);
    scene.add(railing);
    const railing2 = box(0.2, 1.5, 55, bridgeMat);
    railing2.position.set(3.2, 4, -80);
    scene.add(railing2);

    // ========================================
    // ZONE 1: DOWNTOWN VANCOUVER (skyscraper grid)
    // ========================================
    const glassMats = [
        new THREE.MeshLambertMaterial({ color: 0x5588aa }),
        new THREE.MeshLambertMaterial({ color: 0x667788 }),
        new THREE.MeshLambertMaterial({ color: 0x88aacc }),
        new THREE.MeshLambertMaterial({ color: 0x556677 }),
        new THREE.MeshLambertMaterial({ color: 0x779999 }),
    ];
    for (let gx = 0; gx < 5; gx++) {
        for (let gz = 0; gz < 3; gz++) {
            const bx = 42 + gx * 13;
            const bz = 40 + gz * 15;
            const bh = 10 + Math.random() * 20;
            const mat = glassMats[Math.floor(Math.random() * glassMats.length)];
            addBuilding(bx, bz, 8, bh, 8, mat);
        }
    }
    // Landmark: tall tower (like Harbour Centre)
    const tower = cylinder(3, 2.5, 30, 8, new THREE.MeshLambertMaterial({ color: 0x556688 }));
    tower.position.set(70, 15, 55);
    scene.add(tower);
    const towerTop = new THREE.Mesh(new THREE.SphereGeometry(4, 8, 6), new THREE.MeshLambertMaterial({ color: 0x778899 }));
    towerTop.position.set(70, 31, 55);
    towerTop.scale.set(1, 0.4, 1);
    scene.add(towerTop);

    // ========================================
    // ZONE 2: STANLEY PARK (forested peninsula)
    // ========================================
    // Dense forest
    for (let i = 0; i < 40; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 5 + Math.random() * 35;
        const tx = -60 + Math.cos(angle) * radius;
        const tz = 80 + Math.sin(angle) * radius;
        addTree(tx, tz, 0.8 + Math.random() * 0.7);
    }
    // Seawall path (circular road around the park)
    const seawallPts = 16;
    for (let i = 0; i < seawallPts; i++) {
        const a1 = (i / seawallPts) * Math.PI * 2;
        const a2 = ((i + 1) / seawallPts) * Math.PI * 2;
        const r = 38;
        addRoad(-60 + Math.cos(a1) * r, 80 + Math.sin(a1) * r,
                -60 + Math.cos(a2) * r, 80 + Math.sin(a2) * r, 3);
    }
    // Totem poles
    for (let i = 0; i < 3; i++) {
        const totem = cylinder(0.3, 0.35, 4, 6, new THREE.MeshLambertMaterial({ color: 0x664422 }));
        totem.position.set(-55 + i * 5, 2, 95);
        scene.add(totem);
        const totemTop = new THREE.Mesh(new THREE.SphereGeometry(0.5, 6, 4),
            new THREE.MeshLambertMaterial({ color: 0x883322 }));
        totemTop.position.set(-55 + i * 5, 4.2, 95);
        scene.add(totemTop);
    }

    // ========================================
    // ZONE 3: GASTOWN (heritage buildings + steam clock)
    // ========================================
    // Brick heritage buildings
    const brickMat = new THREE.MeshLambertMaterial({ color: 0x884433 });
    for (let i = 0; i < 6; i++) {
        addBuilding(20 + i * 8, 95 + (i % 2) * 12, 6, 4 + Math.random() * 3, 8, brickMat);
    }
    // Steam Clock
    const clockBase = cylinder(0.6, 0.7, 3, 8, new THREE.MeshLambertMaterial({ color: 0xcc9944 }));
    clockBase.position.set(35, 1.5, 105);
    scene.add(clockBase);
    const clockTop = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.5, 8),
        new THREE.MeshLambertMaterial({ color: 0xcc9944 }));
    clockTop.position.set(35, 3.8, 105);
    scene.add(clockTop);
    // Clock face
    const clockFace = new THREE.Mesh(new THREE.CircleGeometry(0.4, 12),
        new THREE.MeshBasicMaterial({ color: 0xffffff }));
    clockFace.position.set(35, 2.5, 105.62);
    scene.add(clockFace);
    // Cobblestone ground
    const cobble = new THREE.Mesh(new THREE.PlaneGeometry(50, 25),
        new THREE.MeshLambertMaterial({ color: 0x887766 }));
    cobble.rotation.x = -Math.PI / 2;
    cobble.position.set(35, 0.06, 100);
    scene.add(cobble);

    // ========================================
    // ZONE 4: ENGLISH BAY (already built above as water)
    // ========================================
    // Lifeguard tower
    const lgTower = box(2, 3, 2, new THREE.MeshLambertMaterial({ color: 0xcc4444 }));
    lgTower.position.set(-10, 2.5, -12);
    scene.add(lgTower);
    const lgRoof = box(3, 0.3, 3, new THREE.MeshLambertMaterial({ color: 0xcc4444 }));
    lgRoof.position.set(-10, 4.2, -12);
    scene.add(lgRoof);
    // Benches along beach
    for (let i = 0; i < 4; i++) {
        const bench = box(2, 0.6, 0.5, mats.wood);
        bench.position.set(-35 + i * 10, 0.3, -8);
        scene.add(bench);
    }

    // ========================================
    // ZONE 5: KITSILANO (residential + Kits Beach)
    // ========================================
    // Houses (residential area)
    const houseMats = [
        new THREE.MeshLambertMaterial({ color: 0x99aa88 }),
        new THREE.MeshLambertMaterial({ color: 0xaa9988 }),
        new THREE.MeshLambertMaterial({ color: 0x8899aa }),
        new THREE.MeshLambertMaterial({ color: 0xccbb99 }),
    ];
    for (let i = 0; i < 12; i++) {
        const hx = -90 + (i % 4) * 12;
        const hz = -80 + Math.floor(i / 4) * 14;
        addBuilding(hx, hz, 6, 3 + Math.random() * 2, 8, houseMats[i % houseMats.length]);
    }
    // Kits Beach
    const kitsBeach = new THREE.Mesh(new THREE.PlaneGeometry(30, 15), mats.sand);
    kitsBeach.rotation.x = -Math.PI / 2;
    kitsBeach.position.set(-80, 0.1, -55);
    scene.add(kitsBeach);
    // Kits Pool (rectangle)
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(12, 6), mats.water);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(-75, 0.5, -52);
    scene.add(pool);

    // ========================================
    // ZONE 6: NORTH VANCOUVER (mountains + forest)
    // ========================================
    // Grouse Mountain
    const grouse = new THREE.Mesh(new THREE.ConeGeometry(30, 35, 8), mats.snow);
    grouse.position.set(0, 17, -165);
    scene.add(grouse);
    const grouse2 = new THREE.Mesh(new THREE.ConeGeometry(22, 25, 7),
        new THREE.MeshLambertMaterial({ color: 0x557755 }));
    grouse2.position.set(20, 12, -155);
    scene.add(grouse2);
    const grouse3 = new THREE.Mesh(new THREE.ConeGeometry(18, 20, 6), mats.snow);
    grouse3.position.set(-25, 10, -160);
    scene.add(grouse3);
    // Dense forest
    for (let i = 0; i < 25; i++) {
        const tx = -30 + Math.random() * 60;
        const tz = -140 - Math.random() * 30;
        addTree(tx, tz, 1.0 + Math.random() * 0.5);
    }
    for (let i = 0; i < 10; i++) {
        addRock(Math.random() * 40 - 20, -145 - Math.random() * 25, 1 + Math.random() * 1.5);
    }
    // Ski lift (simplified poles)
    for (let i = 0; i < 5; i++) {
        const pole = cylinder(0.15, 0.15, 8, 4, new THREE.MeshLambertMaterial({ color: 0x666666 }));
        pole.position.set(-5 + i * 5, 4, -155 + i * 3);
        scene.add(pole);
    }

    // ========================================
    // SCATTERED TREES & ROCKS (fill map)
    // ========================================
    for (let i = 0; i < 80; i++) {
        const x = (Math.random() - 0.5) * WORLD_SIZE * 1.5;
        const z = (Math.random() - 0.5) * WORLD_SIZE * 1.5;
        if (Math.sqrt(x*x + z*z) > 45) addTree(x, z, 0.6 + Math.random() * 0.9);
    }
    for (let i = 0; i < 15; i++) {
        const x = (Math.random() - 0.5) * WORLD_SIZE;
        const z = (Math.random() - 0.5) * WORLD_SIZE;
        if (Math.sqrt(x*x + z*z) > 50) addRock(x, z, 0.8 + Math.random());
    }
}

// ---- PLAYER CHARACTER (Scott) ----
let playerGroup;
function createPlayer() {
    playerGroup = new THREE.Group();
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xd4a574 }); // tan skin
    const shirtMat = new THREE.MeshLambertMaterial({ color: 0x999999 }); // grey t-shirt
    const hairMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a }); // dark hair
    const glassesMat = new THREE.MeshLambertMaterial({ color: 0x22886a }); // green sunglasses
    const jeansMat = new THREE.MeshLambertMaterial({ color: 0x334466 }); // dark jeans
    const shoeMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
    // Legs
    const legL = cylinder(0.18, 0.2, 0.9, 6, jeansMat);
    legL.position.set(-0.22, 0.45, 0);
    playerGroup.add(legL);
    const legR = cylinder(0.18, 0.2, 0.9, 6, jeansMat);
    legR.position.set(0.22, 0.45, 0);
    playerGroup.add(legR);
    // Shoes
    const shoeL = box(0.25, 0.15, 0.4, shoeMat);
    shoeL.position.set(-0.22, 0.08, 0.05);
    playerGroup.add(shoeL);
    const shoeR = box(0.25, 0.15, 0.4, shoeMat);
    shoeR.position.set(0.22, 0.08, 0.05);
    playerGroup.add(shoeR);
    // Torso (grey t-shirt)
    const torso = cylinder(0.5, 0.45, 1.1, 8, shirtMat);
    torso.position.y = 1.5;
    playerGroup.add(torso);
    // Panda design on shirt (white circle)
    const pandaBody = new THREE.Mesh(new THREE.CircleGeometry(0.22, 8), mats.white);
    pandaBody.position.set(0, 1.5, 0.46);
    playerGroup.add(pandaBody);
    const pandaHead = new THREE.Mesh(new THREE.CircleGeometry(0.13, 8), mats.white);
    pandaHead.position.set(0, 1.75, 0.46);
    playerGroup.add(pandaHead);
    // Panda ears (black dots)
    const earMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const earL = new THREE.Mesh(new THREE.CircleGeometry(0.05, 6), earMat);
    earL.position.set(-0.1, 1.85, 0.465);
    playerGroup.add(earL);
    const earR = new THREE.Mesh(new THREE.CircleGeometry(0.05, 6), earMat);
    earR.position.set(0.1, 1.85, 0.465);
    playerGroup.add(earR);
    // Arms (skin)
    const armL = cylinder(0.12, 0.14, 0.8, 6, skinMat);
    armL.position.set(-0.6, 1.4, 0);
    armL.rotation.z = 0.2;
    playerGroup.add(armL);
    const armR = cylinder(0.12, 0.14, 0.8, 6, skinMat);
    armR.position.set(0.6, 1.4, 0);
    armR.rotation.z = -0.2;
    playerGroup.add(armR);
    // Head (tan skin)
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), skinMat);
    head.position.y = 2.5;
    head.scale.set(1, 1.05, 0.95);
    playerGroup.add(head);
    // Hair (dark, thick on top)
    const hairTop = new THREE.Mesh(new THREE.SphereGeometry(0.47, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
    hairTop.position.y = 2.55;
    hairTop.scale.set(1, 1.05, 0.95);
    playerGroup.add(hairTop);
    // Hair sides
    const hairSideL = box(0.08, 0.35, 0.3, hairMat);
    hairSideL.position.set(-0.42, 2.5, -0.05);
    playerGroup.add(hairSideL);
    const hairSideR = box(0.08, 0.35, 0.3, hairMat);
    hairSideR.position.set(0.42, 2.5, -0.05);
    playerGroup.add(hairSideR);
    // Green sunglasses
    const glassL = box(0.22, 0.12, 0.08, glassesMat);
    glassL.position.set(-0.17, 2.52, 0.4);
    playerGroup.add(glassL);
    const glassR = box(0.22, 0.12, 0.08, glassesMat);
    glassR.position.set(0.17, 2.52, 0.4);
    playerGroup.add(glassR);
    // Bridge of sunglasses
    const bridge = box(0.12, 0.04, 0.06, glassesMat);
    bridge.position.set(0, 2.52, 0.42);
    playerGroup.add(bridge);
    // Nose
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 4), skinMat);
    nose.position.set(0, 2.42, 0.42);
    playerGroup.add(nose);
    // Mouth (curved smile)
    const smileCurve = new THREE.TorusGeometry(0.12, 0.025, 6, 12, Math.PI);
    const smileMat = new THREE.MeshLambertMaterial({ color: 0x993333 });
    const smile = new THREE.Mesh(smileCurve, smileMat);
    smile.position.set(0, 2.3, 0.43);
    smile.rotation.z = Math.PI; // flip so it curves down like a smile
    playerGroup.add(smile);
    playerGroup.position.copy(state.playerPos);
    playerGroup.castShadow = true;
    scene.add(playerGroup);
}

// ---- AMBULANCE VEHICLE ----
let ambulanceGroup;
function createAmbulance() {
    ambulanceGroup = new THREE.Group();
    const ambWhite = new THREE.MeshLambertMaterial({ color: 0xf0f0f0 });
    const ambRed = new THREE.MeshLambertMaterial({ color: 0xcc2222 });
    const chromeMat = new THREE.MeshLambertMaterial({ color: 0xcccccc });
    const glassMat = new THREE.MeshLambertMaterial({ color: 0x88bbdd, transparent: true, opacity: 0.5 });
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
    const hubMat = new THREE.MeshLambertMaterial({ color: 0x999999 });
    const doorMat = new THREE.MeshLambertMaterial({ color: 0xe8e8e8 });

    // Main body (box van shape)
    const body = box(3.4, 2.4, 6.0, ambWhite);
    body.position.y = 1.7;
    ambulanceGroup.add(body); // [0]
    // Red stripe along each side
    const stripeL = box(0.06, 0.5, 5.6, ambRed);
    stripeL.position.set(-1.73, 1.5, 0);
    ambulanceGroup.add(stripeL); // [1]
    const stripeR = box(0.06, 0.5, 5.6, ambRed);
    stripeR.position.set(1.73, 1.5, 0);
    ambulanceGroup.add(stripeR); // [2]
    // Roof light bar
    const lightBar = box(2.2, 0.35, 0.9, ambRed);
    lightBar.position.set(0, 3.1, -1.0);
    ambulanceGroup.add(lightBar); // [3]
    const lightBlue = box(0.5, 0.3, 0.45, new THREE.MeshBasicMaterial({ color: 0x4488ff }));
    lightBlue.position.set(-0.55, 3.15, -1.0);
    ambulanceGroup.add(lightBlue); // [4]
    const lightRedR = box(0.5, 0.3, 0.45, new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    lightRedR.position.set(0.55, 3.15, -1.0);
    ambulanceGroup.add(lightRedR); // [5]
    // Windshield (front glass)
    const windshield = box(2.8, 1.0, 0.12, glassMat);
    windshield.position.set(0, 2.3, -2.95);
    ambulanceGroup.add(windshield); // [6]
    // ---- WHEELS (bigger, visible) ----
    const wheelPositions = [[-1.3, 0.5, -1.8], [1.3, 0.5, -1.8], [-1.3, 0.5, 1.8], [1.3, 0.5, 1.8]];
    wheelPositions.forEach(([wx, wy, wz]) => {
        const wheelGroup = new THREE.Group();
        // Tire
        const tire = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.18, 8, 12), wheelMat);
        tire.rotation.y = Math.PI / 2;
        wheelGroup.add(tire);
        // Hubcap
        const hub = cylinder(0.28, 0.28, 0.22, 8, hubMat);
        hub.rotation.z = Math.PI / 2;
        wheelGroup.add(hub);
        // Inner disk
        const disk = new THREE.Mesh(new THREE.CircleGeometry(0.25, 8), hubMat);
        disk.position.set(0.12, 0, 0);
        disk.rotation.y = Math.PI / 2;
        wheelGroup.add(disk);
        wheelGroup.position.set(wx, wy, wz);
        ambulanceGroup.add(wheelGroup); // [7-10]
    });
    // Wheel wells (dark indents)
    wheelPositions.forEach(([wx, wy, wz]) => {
        const well = box(0.15, 1.0, 1.2, new THREE.MeshLambertMaterial({ color: 0x333333 }));
        well.position.set(wx > 0 ? 1.72 : -1.72, 0.9, wz);
        ambulanceGroup.add(well);
    });
    // ---- DOORS ----
    // Driver door (left front)
    const doorL = box(0.1, 1.6, 1.4, doorMat);
    doorL.position.set(-1.76, 1.5, -1.5);
    ambulanceGroup.add(doorL);
    // Door handle
    const handleL = box(0.05, 0.08, 0.25, chromeMat);
    handleL.position.set(-1.82, 1.6, -1.5);
    ambulanceGroup.add(handleL);
    // Passenger door (right front)
    const doorR = box(0.1, 1.6, 1.4, doorMat);
    doorR.position.set(1.76, 1.5, -1.5);
    ambulanceGroup.add(doorR);
    const handleR = box(0.05, 0.08, 0.25, chromeMat);
    handleR.position.set(1.82, 1.6, -1.5);
    ambulanceGroup.add(handleR);
    // Rear doors (double door)
    const rearDoorL = box(0.8, 1.8, 0.1, doorMat);
    rearDoorL.position.set(-0.5, 1.6, 3.05);
    ambulanceGroup.add(rearDoorL);
    const rearDoorR = box(0.8, 1.8, 0.1, doorMat);
    rearDoorR.position.set(0.5, 1.6, 3.05);
    ambulanceGroup.add(rearDoorR);
    const rearHandleL = box(0.15, 0.06, 0.05, chromeMat);
    rearHandleL.position.set(-0.5, 1.8, 3.12);
    ambulanceGroup.add(rearHandleL);
    const rearHandleR = box(0.15, 0.06, 0.05, chromeMat);
    rearHandleR.position.set(0.5, 1.8, 3.12);
    ambulanceGroup.add(rearHandleR);
    // ---- BUMPERS ----
    const frontBumper = box(3.2, 0.4, 0.3, chromeMat);
    frontBumper.position.set(0, 0.5, -3.05);
    ambulanceGroup.add(frontBumper);
    const rearBumper = box(3.2, 0.4, 0.3, chromeMat);
    rearBumper.position.set(0, 0.5, 3.15);
    ambulanceGroup.add(rearBumper);
    // ---- HEADLIGHTS ----
    const hlMat = new THREE.MeshBasicMaterial({ color: 0xffffcc });
    const hlL = box(0.5, 0.35, 0.1, hlMat);
    hlL.position.set(-1.0, 1.1, -3.05);
    ambulanceGroup.add(hlL);
    const hlR = box(0.5, 0.35, 0.1, hlMat);
    hlR.position.set(1.0, 1.1, -3.05);
    ambulanceGroup.add(hlR);
    // ---- TAIL LIGHTS ----
    const tlMat = new THREE.MeshBasicMaterial({ color: 0xff3333 });
    const tlL = box(0.4, 0.3, 0.1, tlMat);
    tlL.position.set(-1.2, 1.1, 3.05);
    ambulanceGroup.add(tlL);
    const tlR = box(0.4, 0.3, 0.1, tlMat);
    tlR.position.set(1.2, 1.1, 3.05);
    ambulanceGroup.add(tlR);
    // Cross symbol on each side
    const sideCrossV = box(0.05, 1.0, 0.3, ambRed);
    sideCrossV.position.set(-1.74, 2.2, 1.0);
    ambulanceGroup.add(sideCrossV);
    const sideCrossH = box(0.05, 0.3, 0.8, ambRed);
    sideCrossH.position.set(-1.74, 2.2, 1.0);
    ambulanceGroup.add(sideCrossH);
    // Cross on back
    const crossV = box(0.3, 1.0, 0.05, ambRed);
    crossV.position.set(0, 2.2, 3.08);
    ambulanceGroup.add(crossV);
    const crossH = box(0.8, 0.3, 0.05, ambRed);
    crossH.position.set(0, 2.2, 3.08);
    ambulanceGroup.add(crossH);

    ambulanceGroup.position.set(8, 0, 5);
    ambulanceGroup.castShadow = true;
    scene.add(ambulanceGroup);
}

// ---- NPC PEDESTRIANS ----
const npcs = [];
const NPC_COUNT = 25;
const NPC_SPEED = 3;
const NPC_HIT_RADIUS = 1.5;
const NPC_COLORS = [0x4466aa, 0xaa4444, 0x44aa66, 0xaa8844, 0x8844aa, 0xaa4488, 0x448899, 0x997744];

function createNPCs() {
    for (let i = 0; i < NPC_COUNT; i++) {
        const npcGroup = new THREE.Group();
        const color = NPC_COLORS[i % NPC_COLORS.length];
        const npcMat = new THREE.MeshLambertMaterial({ color });
        const npcSkin = new THREE.MeshLambertMaterial({ color: 0xddbb99 });

        // Legs
        const nL = cylinder(0.12, 0.14, 0.7, 5, new THREE.MeshLambertMaterial({ color: 0x444466 }));
        nL.position.set(-0.15, 0.35, 0);
        npcGroup.add(nL);
        const nR = cylinder(0.12, 0.14, 0.7, 5, new THREE.MeshLambertMaterial({ color: 0x444466 }));
        nR.position.set(0.15, 0.35, 0);
        npcGroup.add(nR);
        // Body
        const nb = cylinder(0.35, 0.3, 0.9, 6, npcMat);
        nb.position.y = 1.2;
        npcGroup.add(nb);
        // Arms
        const aL = cylinder(0.08, 0.1, 0.6, 5, npcSkin);
        aL.position.set(-0.4, 1.1, 0);
        aL.rotation.z = 0.15;
        npcGroup.add(aL);
        const aR = cylinder(0.08, 0.1, 0.6, 5, npcSkin);
        aR.position.set(0.4, 1.1, 0);
        aR.rotation.z = -0.15;
        npcGroup.add(aR);
        // Head
        const nh = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), npcSkin);
        nh.position.y = 2.0;
        npcGroup.add(nh);

        // Random spawn near zones
        const zoneIdx = i % ZONES.length;
        const zonePos = ZONES[zoneIdx].pos;
        const ox = (Math.random() - 0.5) * 40;
        const oz = (Math.random() - 0.5) * 40;
        const spawnX = zonePos[0] * 0.5 + ox;
        const spawnZ = zonePos[2] * 0.5 + oz;

        npcGroup.position.set(spawnX, 0, spawnZ);
        npcGroup.castShadow = true;
        scene.add(npcGroup);

        npcs.push({
            group: npcGroup,
            x: spawnX, z: spawnZ,
            angle: Math.random() * Math.PI * 2,
            speed: NPC_SPEED * (0.6 + Math.random() * 0.8),
            turnTimer: Math.random() * 5,
            hit: false, hitTimer: 0,
            homeX: spawnX, homeZ: spawnZ
        });
    }
}

function updateNPCs(dt) {
    npcs.forEach((npc, idx) => {
        if (npc.hit) {
            npc.hitTimer -= dt;
            if (npc.hitTimer <= 0) {
                npc.hit = false;
                npc.group.position.y = getTerrainHeight(npc.x, npc.z);
                npc.group.rotation.x = 0;
            } else {
                npc.group.rotation.x = Math.PI / 2 * Math.min(1, npc.hitTimer / 1.5);
                return;
            }
        }

        // Random direction changes
        npc.turnTimer -= dt;
        if (npc.turnTimer <= 0) {
            const dx = npc.homeX - npc.x;
            const dz = npc.homeZ - npc.z;
            const distFromHome = Math.sqrt(dx * dx + dz * dz);
            if (distFromHome > 35) {
                npc.angle = Math.atan2(dx, dz) + (Math.random() - 0.5) * 1;
            } else {
                npc.angle += (Math.random() - 0.5) * 2.5;
            }
            npc.turnTimer = 2 + Math.random() * 4;
        }

        // Move
        npc.x += Math.sin(npc.angle) * npc.speed * dt;
        npc.z += Math.cos(npc.angle) * npc.speed * dt;
        const ty = getTerrainHeight(npc.x, npc.z);
        npc.group.position.set(npc.x, ty, npc.z);
        npc.group.rotation.y = npc.angle;

        // Walk animation
        const t = Date.now() * 0.01 + idx * 100;
        if (npc.group.children[0]) npc.group.children[0].rotation.x = Math.sin(t) * 0.3;
        if (npc.group.children[1]) npc.group.children[1].rotation.x = -Math.sin(t) * 0.3;
        if (npc.group.children[3]) npc.group.children[3].rotation.x = -Math.sin(t) * 0.25;
        if (npc.group.children[4]) npc.group.children[4].rotation.x = Math.sin(t) * 0.25;

        // Check ambulance collision
        if (state.inAmbulance && !npc.hit) {
            const dx = npc.x - ambulanceGroup.position.x;
            const dz = npc.z - ambulanceGroup.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < NPC_HIT_RADIUS + 2.5 && Math.abs(state.vehSpeed) > 3) {
                npc.hit = true;
                npc.hitTimer = 2.5;
                takeDamage();
                // BLOOD SPLATTER — more particles, multiple bursts
                const hitForce = Math.abs(state.vehSpeed) / VEH_MAX_SPEED;
                const bloodCount = Math.floor(20 + hitForce * 30);
                spawnParticles(npc.group.position, 0xcc0000, bloodCount);
                spawnParticles(npc.group.position, 0x880000, Math.floor(bloodCount * 0.6));
                spawnParticles(npc.group.position, 0xff2222, Math.floor(bloodCount * 0.3));
                // Blood pool on ground
                const poolSize = 1 + hitForce * 2;
                const pool = new THREE.Mesh(
                    new THREE.CircleGeometry(poolSize, 8),
                    new THREE.MeshBasicMaterial({ color: 0x660000, transparent: true, opacity: 0.7 })
                );
                pool.rotation.x = -Math.PI / 2;
                pool.position.set(npc.x, 0.05, npc.z);
                scene.add(pool);
                // Fade pool out over time
                setTimeout(() => { scene.remove(pool); }, 15000);
                const pushAngle = Math.atan2(dx, dz);
                npc.x += Math.sin(pushAngle) * (3 + hitForce * 6);
                npc.z += Math.cos(pushAngle) * (3 + hitForce * 6);
                state.vehSpeed *= 0.5;
            }
        }

        // Avoid water
        if (isInWater(npc.x, npc.z)) {
            npc.angle += Math.PI;
            npc.turnTimer = 1;
        }
    });
}

// ---- PATIENTS ----
const patients = [];

function createPatients() {
    ZONES.forEach((zone, i) => {
        const group = new THREE.Group();
        // Body
        const pbody = cylinder(0.4, 0.5, 1.2, 8, mats.patient_glow);
        pbody.position.y = 1;
        group.add(pbody);
        // Head
        const phead = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), mats.patient_glow);
        phead.position.y = 2;
        group.add(phead);
        // Glow ring
        const ring = new THREE.Mesh(
            new THREE.TorusGeometry(1.5, 0.1, 8, 20),
            new THREE.MeshBasicMaterial({ color: 0x00ffaa, transparent: true, opacity: 0.4 })
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.1;
        group.add(ring);
        // Exclamation point above
        const exclMat = new THREE.MeshBasicMaterial({ color: 0xff4444 });
        const excl = box(0.2, 1, 0.2, exclMat);
        excl.position.y = 3.2;
        group.add(excl);
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 4), exclMat);
        dot.position.y = 2.5;
        group.add(dot);

        group.position.set(zone.pos[0], zone.pos[1], zone.pos[2]);
        scene.add(group);
        patients.push({ group, zone, collected: false, index: i });
    });
}

// ---- STAR GATES ----
const gates = [];

function createGates() {
    ZONES.forEach((zone, i) => {
        if (zone.starsRequired > 0) {
            const gate = new THREE.Group();
            // Gate posts
            const postL = box(1, 8, 1, mats.yellow);
            postL.position.set(-3, 4, 0);
            gate.add(postL);
            const postR = box(1, 8, 1, mats.yellow);
            postR.position.set(3, 4, 0);
            gate.add(postR);
            // Gate bar
            const bar = box(7, 1, 1, mats.yellow);
            bar.position.set(0, 8, 0);
            gate.add(bar);
            // Barrier
            const barrier = box(5, 7, 0.3, mats.gate);
            barrier.position.set(0, 3.5, 0);
            gate.add(barrier);
            // Star requirement sign
            const signMat = new THREE.MeshBasicMaterial({ color: 0xffd700 });
            const starSign = box(2, 2, 0.3, signMat);
            starSign.position.set(0, 9.5, 0);
            gate.add(starSign);

            // Position gate between hub and zone
            const gx = zone.pos[0] * 0.5;
            const gz = zone.pos[2] * 0.5;
            gate.position.set(gx, 0, gz);
            gate.lookAt(new THREE.Vector3(zone.pos[0], 0, zone.pos[2]));
            scene.add(gate);

            gates.push({
                group: gate,
                pos: new THREE.Vector3(gx, 0, gz),
                required: zone.starsRequired,
                zoneIndex: i,
                open: false
            });
            addCollider(gx, 0, gz, 7, 8, 2);
        }
    });
}

// ---- PARTICLES ----
const particleSystems = [];

function spawnParticles(pos, color, count) {
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = [];
    for (let i = 0; i < count; i++) {
        positions[i * 3] = pos.x;
        positions[i * 3 + 1] = pos.y + 1;
        positions[i * 3 + 2] = pos.z;
        velocities.push(new THREE.Vector3(
            (Math.random() - 0.5) * 10,
            Math.random() * 10 + 5,
            (Math.random() - 0.5) * 10
        ));
    }
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color, size: 1.2, transparent: true, opacity: 0.9 });
    const points = new THREE.Points(geom, mat);
    scene.add(points);
    particleSystems.push({ points, velocities, life: 3, elapsed: 0 });
}

function updateParticles(dt) {
    for (let i = particleSystems.length - 1; i >= 0; i--) {
        const ps = particleSystems[i];
        ps.elapsed += dt;
        if (ps.elapsed > ps.life) {
            scene.remove(ps.points);
            particleSystems.splice(i, 1);
            continue;
        }
        const positions = ps.points.geometry.attributes.position;
        for (let j = 0; j < positions.count; j++) {
            ps.velocities[j].y -= 15 * dt;
            positions.setX(j, positions.getX(j) + ps.velocities[j].x * dt);
            positions.setY(j, positions.getY(j) + ps.velocities[j].y * dt);
            positions.setZ(j, positions.getZ(j) + ps.velocities[j].z * dt);
        }
        positions.needsUpdate = true;
        ps.points.material.opacity = 1 - (ps.elapsed / ps.life);
        ps.points.material.transparent = true;
    }
}

// ---- MINIMAP ----
function drawMinimap() {
    const canvas = document.getElementById('minimap-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const scale = W / (WORLD_SIZE * 1.2);

    ctx.clearRect(0, 0, W, H);
    // Background
    ctx.fillStyle = 'rgba(0, 40, 80, 0.9)';
    ctx.fillRect(0, 0, W, H);

    const cx = W / 2, cy = H / 2;
    const px = state.playerPos.x * scale;
    const pz = state.playerPos.z * scale;

    // Draw roads
    ctx.strokeStyle = 'rgba(100, 100, 100, 0.6)';
    ctx.lineWidth = 2;
    ZONES.forEach(z => {
        ctx.beginPath();
        ctx.moveTo(cx - px, cy - pz);
        ctx.lineTo(cx + z.pos[0] * scale - px, cy + z.pos[2] * scale - pz);
        ctx.stroke();
    });

    // Draw zones
    ZONES.forEach((z, i) => {
        const zx = cx + z.pos[0] * scale - px;
        const zy = cy + z.pos[2] * scale - pz;
        const collected = state.collectedStars.has(i);
        ctx.fillStyle = collected ? '#ffd700' : '#ff4444';
        ctx.beginPath();
        ctx.arc(zx, zy, 4, 0, Math.PI * 2);
        ctx.fill();
    });

    // Hub
    ctx.fillStyle = '#4488ff';
    ctx.beginPath();
    ctx.arc(cx - px, cy - pz, 4, 0, Math.PI * 2);
    ctx.fill();

    // Player (always center)
    ctx.fillStyle = '#00ff88';
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Direction indicator
    const dirX = cx + Math.sin(state.cameraAngle) * 10;
    const dirY = cy + Math.cos(state.cameraAngle) * 10;
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(dirX, dirY);
    ctx.stroke();
}

// ---- HUD UPDATE ----
function updateHUD() {
    document.getElementById('star-count').textContent = state.stars;
    for (let i = 1; i <= 3; i++) {
        const h = document.getElementById('heart-' + i);
        h.classList.toggle('lost', i > state.health);
    }
    // Find nearest zone
    let nearest = 'British Columbia';
    let nearestDist = Infinity;
    ZONES.forEach(z => {
        const d = Math.sqrt(
            (state.playerPos.x - z.pos[0]) ** 2 +
            (state.playerPos.z - z.pos[2]) ** 2
        );
        if (d < nearestDist) { nearestDist = d; nearest = z.name; }
    });
    if (Math.sqrt(state.playerPos.x ** 2 + state.playerPos.z ** 2) < 25) {
        nearest = 'Ambulance Station';
    }
    document.getElementById('hud-zone').textContent = nearest;
}

// ---- GAME LOGIC ----
function getTerrainHeight(x, z) {
    // Flat hospital parking lot (radius 35)
    const distToCenter = Math.sqrt(x * x + z * z);
    if (distToCenter < 35) return 0;
    const edgeFactor = Math.min(1, Math.max(0, (distToCenter - 35) / 20));

    // Lions Gate Bridge deck (elevated road at y=3 over water)
    if (Math.abs(x) < 4 && z < -55 && z > -110) return 3;

    let h = Math.sin(x * 0.015) * 2 + Math.cos(z * 0.012) * 2.5;

    // North Vancouver hills (z < -110)
    if (z < -110) {
        const northFactor = Math.min(1, (-110 - z) / 40);
        h += northFactor * 12;
        // Grouse Mountain
        const dGrouse = Math.sqrt(x * x + (z + 165) ** 2);
        if (dGrouse < 40) h += Math.max(0, (40 - dGrouse) * 0.4);
    }

    // Flatten downtown area (around 60, 50)
    const dDowntown = Math.sqrt((x - 60) ** 2 + (z - 50) ** 2);
    if (dDowntown < 40) h *= Math.min(1, dDowntown / 40);

    // Flatten Gastown (around 30, 100)
    const dGastown = Math.sqrt((x - 30) ** 2 + (z - 100) ** 2);
    if (dGastown < 30) h *= Math.min(1, dGastown / 30);

    // Flatten Kitsilano (around -80, -70)
    const dKits = Math.sqrt((x + 80) ** 2 + (z + 70) ** 2);
    if (dKits < 35) h *= Math.min(1, dKits / 35);

    return Math.max(0, h * edgeFactor);
}

function isInWater(x, z) {
    // Burrard Inlet (wide water body between city and north van)
    if (z < -55 && z > -110 && Math.abs(x) > 4) {
        // Allow bridge crossing
        if (Math.abs(x) < 5) return false;
        return true;
    }
    // English Bay
    const dBay = Math.sqrt((x + 20) ** 2 + (z + 30) ** 2);
    if (dBay < 33) return true;
    // Kits Pool (small rectangle)
    if (x > -82 && x < -68 && z > -55 && z < -49) return true;
    return false;
}

function handleKey(e) {
    if (e.code === 'Enter') {
        if (state.phase === 'title') startGame();
        else if (state.phase === 'gameover' || state.phase === 'win') resetGame();
    }
    if (e.code === 'KeyP' && (state.phase === 'playing' || state.phase === 'paused')) {
        togglePause();
    }
    if (e.code === 'KeyE' && state.phase === 'playing') {
        if (state.inAmbulance) {
            exitAmbulance();
        } else if (state.nearPatient) {
            rescuePatient(state.nearPatient);
        } else if (state.nearAmbulance) {
            enterAmbulance();
        }
    }
}

function enterAmbulance() {
    state.inAmbulance = true;
    state.vehAngle = ambulanceGroup.rotation.y;
    state.vehSpeed = 0;
    state.vehLateralVel = 0;
    state.vehSteerAngle = 0;
    state.vehHandbrake = false;
    state.vehBodyRoll = 0;
    state.vehBodyPitch = 0;
    state.vehSuspHeight = 0;
    state.vehSuspVel = 0;
    state.vehRPM = 800;
    playerGroup.visible = false;
}

function exitAmbulance() {
    state.inAmbulance = false;
    state.vehSpeed = 0;
    // Place Scott next to ambulance
    const exitAngle = state.vehAngle + Math.PI / 2;
    state.playerPos.set(
        ambulanceGroup.position.x + Math.cos(exitAngle) * 3.5,
        ambulanceGroup.position.y + 0.5,
        ambulanceGroup.position.z + Math.sin(exitAngle) * 3.5
    );
    state.playerVel.set(0, 0, 0);
    playerGroup.visible = true;
    playerGroup.position.copy(state.playerPos);
}

function startGame() {
    state.phase = 'playing';
    document.getElementById('title-screen').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    renderer.domElement.requestPointerLock();
}

function resetGame() {
    state.stars = 0;
    state.health = 3;
    state.lives = 3;
    state.collectedStars.clear();
    state.playerPos.set(0, 2, 0);
    state.playerVel.set(0, 0, 0);
    state.invincible = 0;
    patients.forEach(p => {
        p.collected = false;
        p.group.visible = true;
    });
    gates.forEach(g => {
        g.open = false;
        g.group.visible = true;
    });
    // Re-add gate colliders (simplified - just show gates)
    document.getElementById('game-over').classList.add('hidden');
    document.getElementById('win-screen').classList.add('hidden');
    state.phase = 'playing';
    document.getElementById('hud').classList.remove('hidden');
}

function togglePause() {
    if (state.phase === 'playing') {
        state.phase = 'paused';
        document.getElementById('pause-menu').classList.remove('hidden');
        document.exitPointerLock();
        // Update star list
        const list = document.getElementById('pause-star-list');
        list.innerHTML = '';
        ZONES.forEach((z, i) => {
            const div = document.createElement('div');
            div.className = 'pause-star-item' + (state.collectedStars.has(i) ? ' collected' : '');
            div.textContent = (state.collectedStars.has(i) ? '⭐ ' : '☆ ') + z.name;
            list.appendChild(div);
        });
    } else if (state.phase === 'paused') {
        state.phase = 'playing';
        document.getElementById('pause-menu').classList.add('hidden');
        renderer.domElement.requestPointerLock();
    }
}

function takeDamage() {
    if (state.invincible > 0) return;
    state.health--;
    state.invincible = 2;
    spawnParticles(state.playerPos, 0xff0000, 15);
    if (state.health <= 0) {
        state.lives--;
        if (state.lives <= 0) {
            gameOver();
        } else {
            state.health = 3;
            state.playerPos.set(0, 2, 0);
            state.playerVel.set(0, 0, 0);
        }
    }
}

function gameOver() {
    state.phase = 'gameover';
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('game-over').classList.remove('hidden');
    document.exitPointerLock();
}

function rescuePatient(patient) {
    if (patient.collected) return;
    // Check star gate
    const zone = patient.zone;
    if (zone.starsRequired > state.stars) return;

    patient.collected = true;
    patient.group.visible = false;
    state.stars++;
    state.collectedStars.add(patient.index);
    spawnParticles(patient.group.position, 0xffd700, 30);

    // Show star overlay
    document.getElementById('star-zone-name').textContent = zone.name + ' — Patient Rescued!';
    document.getElementById('star-overlay').classList.remove('hidden');
    state.showStarOverlay = true;
    setTimeout(() => {
        document.getElementById('star-overlay').classList.add('hidden');
        state.showStarOverlay = false;
        if (state.stars >= 6) winGame();
    }, 3000);

    // Open any gates that match
    gates.forEach(g => {
        if (state.stars >= g.required && !g.open) {
            g.open = true;
            g.group.visible = false;
            // Remove collider for this gate
        }
    });
}

function winGame() {
    state.phase = 'win';
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('win-screen').classList.remove('hidden');
    document.exitPointerLock();
}

// ---- PHYSICS / UPDATE ----
function updatePlayer(dt) {
    if (state.phase !== 'playing' || state.showStarOverlay) return;

    // Camera rotation from mouse
    state.cameraAngle -= mouseDX * 0.004;
    state.cameraPitch = Math.max(-0.3, Math.min(0.85, state.cameraPitch + mouseDY * 0.004));
    mouseDX = 0;
    mouseDY = 0;

    if (state.inAmbulance) {
        updateAmbulanceDriving(dt);
        return;
    }

    // Sprint
    state.sprinting = !!(keys['ShiftLeft'] || keys['ShiftRight']);
    const maxSpeed = state.sprinting ? SPRINT_SPEED : MOVE_SPEED;
    const accel = state.onGround ? ACCEL_GROUND : ACCEL_AIR;
    const friction = state.onGround ? FRICTION_GROUND : FRICTION_AIR;

    // Input
    let inputX = 0, inputZ = 0;
    if (keys['KeyS'] || keys['ArrowUp']) inputZ -= 1;
    if (keys['KeyW'] || keys['ArrowDown']) inputZ += 1;
    if (keys['KeyD'] || keys['ArrowLeft']) inputX -= 1;
    if (keys['KeyA'] || keys['ArrowRight']) inputX += 1;
    const hasInput = inputX !== 0 || inputZ !== 0;

    if (hasInput) {
        const len = Math.sqrt(inputX * inputX + inputZ * inputZ);
        inputX /= len; inputZ /= len;
        const sin = Math.sin(state.cameraAngle);
        const cos = Math.cos(state.cameraAngle);
        const worldX = inputX * cos + inputZ * sin;
        const worldZ = -inputX * sin + inputZ * cos;

        // Accelerate — apply force in desired direction
        state.playerVel.x += worldX * accel * dt;
        state.playerVel.z += worldZ * accel * dt;

        // Speed clamp
        const hSpeed = Math.sqrt(state.playerVel.x ** 2 + state.playerVel.z ** 2);
        if (hSpeed > maxSpeed) {
            const scale = maxSpeed / hSpeed;
            state.playerVel.x *= scale;
            state.playerVel.z *= scale;
        }

        // Smooth facing
        const targetAngle = Math.atan2(worldX, worldZ);
        let angleDiff = targetAngle - state.facingAngle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        state.facingAngle += angleDiff * Math.min(1, TURN_SPEED * dt);
        playerGroup.rotation.y = state.facingAngle;
    } else {
        // Friction deceleration
        const hSpeed = Math.sqrt(state.playerVel.x ** 2 + state.playerVel.z ** 2);
        if (hSpeed > 0.2) {
            const drop = friction * dt;
            const newSpeed = Math.max(0, hSpeed - drop);
            const scale = newSpeed / hSpeed;
            state.playerVel.x *= scale;
            state.playerVel.z *= scale;
        } else {
            state.playerVel.x = 0;
            state.playerVel.z = 0;
        }
    }

    // ---- JUMP (with coyote time + buffer) ----
    // Track coyote time
    if (state.onGround) {
        state.coyoteTimer = COYOTE_TIME;
    } else {
        state.coyoteTimer -= dt;
    }

    // Buffer jump input
    if (keys['Space']) {
        state.jumpBufferTimer = JUMP_BUFFER;
    } else {
        state.jumpBufferTimer -= dt;
    }

    // Execute jump if buffered and within coyote time
    if (state.jumpBufferTimer > 0 && state.coyoteTimer > 0) {
        state.playerVel.y = JUMP_FORCE;
        state.coyoteTimer = 0;
        state.jumpBufferTimer = 0;
        state.onGround = false;
    }

    // Variable jump height — release early for shorter jump
    if (!keys['Space'] && state.playerVel.y > 0) {
        state.playerVel.y *= JUMP_CUT_MULT;
    }

    // Gravity (stronger when falling for snappier feel)
    const gravMult = state.playerVel.y < 0 ? 1.6 : 1.0;
    state.playerVel.y += GRAVITY * gravMult * dt;

    // Move
    const newPos = state.playerPos.clone();
    newPos.x += state.playerVel.x * dt;
    newPos.z += state.playerVel.z * dt;
    newPos.y += state.playerVel.y * dt;

    // Collision (slide along walls)
    const collision = checkCollision(newPos, 0.8);
    if (collision.hit) {
        const len = Math.sqrt(collision.nx ** 2 + collision.nz ** 2);
        if (len > 0.01) {
            // Push out of collision along normal
            const nx = collision.nx / len;
            const nz = collision.nz / len;
            newPos.x = state.playerPos.x + nx * 0.05;
            newPos.z = state.playerPos.z + nz * 0.05;
            // Remove velocity component into wall, keep tangent (wall sliding)
            const dot = state.playerVel.x * nx + state.playerVel.z * nz;
            if (dot < 0) {
                state.playerVel.x -= dot * nx;
                state.playerVel.z -= dot * nz;
            }
        }
    }

    // Terrain
    const terrainY = getTerrainHeight(newPos.x, newPos.z);
    if (newPos.y <= terrainY) {
        newPos.y = terrainY;
        // Slope response — only zero out vertical if ground is mostly flat
        if (state.playerVel.y < 0) state.playerVel.y = 0;
        state.onGround = true;
    } else {
        state.onGround = false;
    }

    // World bounds
    newPos.x = Math.max(-WORLD_SIZE, Math.min(WORLD_SIZE, newPos.x));
    newPos.z = Math.max(-WORLD_SIZE, Math.min(WORLD_SIZE, newPos.z));

    state.playerPos.copy(newPos);
    playerGroup.position.copy(state.playerPos);

    // Water damage
    if (isInWater(state.playerPos.x, state.playerPos.z) && state.playerPos.y < 1.8) {
        takeDamage();
    }

    // Fall damage
    if (state.playerPos.y < -10) {
        takeDamage();
        state.playerPos.set(0, 5, 0);
        state.playerVel.set(0, 0, 0);
    }

    // Invincibility
    if (state.invincible > 0) {
        state.invincible -= dt;
        playerGroup.visible = Math.floor(state.invincible * 10) % 2 === 0;
    } else {
        playerGroup.visible = true;
    }

    // Walk/run animation
    const speed = Math.sqrt(state.playerVel.x ** 2 + state.playerVel.z ** 2);
    const animSpeed = state.sprinting ? 0.018 : 0.013;
    if (state.onGround && speed > 1) {
        const t = Date.now() * animSpeed;
        const bobAmt = Math.min(speed / MOVE_SPEED, 1) * 0.15;
        playerGroup.position.y += Math.abs(Math.sin(t)) * bobAmt;
        // Legs
        if (playerGroup.children[0]) playerGroup.children[0].rotation.x = Math.sin(t) * 0.5 * (speed / MOVE_SPEED);
        if (playerGroup.children[1]) playerGroup.children[1].rotation.x = -Math.sin(t) * 0.5 * (speed / MOVE_SPEED);
        // Arms
        if (playerGroup.children[10]) playerGroup.children[10].rotation.x = -Math.sin(t) * 0.5 * (speed / MOVE_SPEED);
        if (playerGroup.children[11]) playerGroup.children[11].rotation.x = Math.sin(t) * 0.5 * (speed / MOVE_SPEED);
    } else {
        [0, 1, 10, 11].forEach(i => {
            if (playerGroup.children[i]) playerGroup.children[i].rotation.x *= 0.85;
        });
    }

    // Proximity checks
    state.nearAmbulance = false;
    const ambDist = state.playerPos.distanceTo(ambulanceGroup.position);
    const interactPrompt = document.getElementById('interact-prompt');
    const gatePrompt = document.getElementById('gate-prompt');
    interactPrompt.classList.add('hidden');
    gatePrompt.classList.add('hidden');

    if (ambDist < AMB_INTERACT_DIST) {
        state.nearAmbulance = true;
        interactPrompt.classList.remove('hidden');
        document.querySelector('.interact-content').innerHTML = 'Press <strong>E</strong> to enter ambulance';
    }

    state.nearPatient = null;
    patients.forEach(p => {
        if (p.collected) return;
        const d = state.playerPos.distanceTo(p.group.position);
        if (d < PATIENT_INTERACT_DIST) {
            if (p.zone.starsRequired > state.stars) {
                gatePrompt.classList.remove('hidden');
                document.getElementById('gate-text').textContent =
                    `Need ${p.zone.starsRequired} \u2b50 to rescue (you have ${state.stars})`;
            } else {
                state.nearPatient = p;
                state.nearAmbulance = false;
                interactPrompt.classList.remove('hidden');
                document.querySelector('.interact-content').innerHTML = 'Press <strong>E</strong> to rescue patient';
            }
        }
    });

    // Objective
    const objDiv = document.getElementById('hud-objective');
    const objText = document.getElementById('objective-text');
    let showObj = false;
    ZONES.forEach((z, i) => {
        const d = Math.sqrt((state.playerPos.x - z.pos[0]) ** 2 + (state.playerPos.z - z.pos[2]) ** 2);
        if (d < 30 && !state.collectedStars.has(i)) {
            objText.textContent = '\ud83d\udea8 ' + z.desc;
            showObj = true;
        }
    });
    objDiv.classList.toggle('hidden', !showObj);

    updateCamera(state.playerPos, 2, dt);
}

// ============================================
// GTA-STYLE AMBULANCE DRIVING
// ============================================
function updateAmbulanceDriving(dt) {
    const absSpeed = Math.abs(state.vehSpeed);
    const speedRatio = absSpeed / VEH_MAX_SPEED;
    const goingForward = state.vehSpeed > 0.5;
    const goingBackward = state.vehSpeed < -0.5;

    // --- STEERING ---
    let steerInput = 0;
    if (keys['KeyD'] || keys['ArrowLeft']) steerInput = -1;
    if (keys['KeyA'] || keys['ArrowRight']) steerInput = 1;

    // Speed-sensitive steering: more responsive at low speed, tighter at high speed
    const steerRate = VEH_STEER_MAX * (1.0 - speedRatio * VEH_STEER_SPEED_FACTOR);
    const steerAmount = steerInput * steerRate * dt * (absSpeed > 1 ? 1 : 0.15);

    // Only steer if actually moving
    if (absSpeed > 0.5) {
        const steerDir = state.vehSpeed > 0 ? 1 : -1; // reverse steering in reverse
        state.vehAngle += steerAmount * steerDir;
    }
    // Visual steering wheel
    state.vehSteerAngle += (steerInput * 0.5 - state.vehSteerAngle) * 8 * dt;

    // --- HANDBRAKE ---
    state.vehHandbrake = !!(keys['Space']);
    const grip = state.vehHandbrake ? VEH_DRIFT_GRIP : VEH_GRIP;

    // --- THROTTLE / BRAKE ---
    const throttle = !!(keys['KeyW'] || keys['ArrowUp']);
    const brake = !!(keys['KeyS'] || keys['ArrowDown']);

    if (throttle) {
        if (state.vehSpeed < 0) {
            // Braking while going backward
            state.vehSpeed += VEH_BRAKE_FORCE * dt;
        } else {
            // Accelerate forward — power drops at high speed
            const powerCurve = 1.0 - speedRatio * 0.6;
            state.vehSpeed += VEH_ENGINE_FORCE * powerCurve * dt;
        }
    } else if (brake) {
        if (state.vehSpeed > 1) {
            // Brake
            state.vehSpeed -= VEH_BRAKE_FORCE * dt;
        } else {
            // Reverse
            state.vehSpeed -= VEH_REVERSE_FORCE * dt;
        }
    }

    // Handbrake drag
    if (state.vehHandbrake) {
        const hbDrag = VEH_HANDBRAKE_DRAG * dt;
        if (state.vehSpeed > hbDrag) state.vehSpeed -= hbDrag;
        else if (state.vehSpeed < -hbDrag) state.vehSpeed += hbDrag;
        else state.vehSpeed = 0;
    }

    // Aero drag + rolling friction
    const drag = (VEH_DRAG * state.vehSpeed * absSpeed + VEH_ROLL_FRICTION * state.vehSpeed) * dt;
    state.vehSpeed -= drag;

    // Speed clamp
    state.vehSpeed = Math.max(-VEH_MAX_SPEED * 0.35, Math.min(VEH_MAX_SPEED, state.vehSpeed));

    // Tiny dead zone
    if (!throttle && !brake && absSpeed < 0.3) state.vehSpeed = 0;

    // --- LATERAL VELOCITY (drift / grip) ---
    // Calculate slip from steering
    const slipForce = steerAmount * absSpeed * 0.8;
    state.vehLateralVel += slipForce;
    // Apply grip — pull lateral vel back toward 0
    state.vehLateralVel *= (1.0 - grip * Math.min(1, 6 * dt));
    // Clamp max drift
    state.vehLateralVel = Math.max(-15, Math.min(15, state.vehLateralVel));

    // --- POSITION UPDATE ---
    const sinA = Math.sin(state.vehAngle);
    const cosA = Math.cos(state.vehAngle);
    // Forward motion (negated: windshield is at -Z in model)
    let ax = ambulanceGroup.position.x - sinA * state.vehSpeed * dt;
    let az = ambulanceGroup.position.z - cosA * state.vehSpeed * dt;
    // Lateral drift motion
    ax -= cosA * state.vehLateralVel * dt;
    az += sinA * state.vehLateralVel * dt;
    // World bounds
    ax = Math.max(-WORLD_SIZE, Math.min(WORLD_SIZE, ax));
    az = Math.max(-WORLD_SIZE, Math.min(WORLD_SIZE, az));

    // --- SUSPENSION ---
    const targetY = getTerrainHeight(ax, az);
    const suspDiff = targetY - (ambulanceGroup.position.y - state.vehSuspHeight);
    state.vehSuspVel += suspDiff * VEH_SUSPENSION_STIFF * dt;
    state.vehSuspVel *= 0.85; // damping
    state.vehSuspHeight += state.vehSuspVel * dt;
    state.vehSuspHeight = Math.max(-0.5, Math.min(0.5, state.vehSuspHeight));
    const ay = targetY + state.vehSuspHeight;

    ambulanceGroup.position.set(ax, ay, az);
    ambulanceGroup.rotation.y = state.vehAngle;

    // --- BODY ROLL & PITCH ---
    const targetRoll = -steerInput * speedRatio * VEH_BODY_ROLL_MAX;
    state.vehBodyRoll += (targetRoll - state.vehBodyRoll) * 6 * dt;
    ambulanceGroup.rotation.z = state.vehBodyRoll;

    // Pitch from acceleration
    let pitchTarget = 0;
    if (throttle && goingForward) pitchTarget = -VEH_PITCH_MAX * 0.5;
    if (brake && goingForward) pitchTarget = VEH_PITCH_MAX;
    const slopeF = getTerrainHeight(ax - sinA * 3, az - cosA * 3);
    const slopeB = getTerrainHeight(ax + sinA * 3, az + cosA * 3);
    const slopePitch = Math.atan2(slopeF - slopeB, 6);
    pitchTarget += slopePitch * 0.6;
    state.vehBodyPitch += (pitchTarget - state.vehBodyPitch) * 5 * dt;
    ambulanceGroup.rotation.x = state.vehBodyPitch;

    // --- WHEEL ROTATION ---
    state.vehWheelRot += state.vehSpeed * dt * 0.5;
    // Spin front wheels visually (7-10 are wheel indices)
    for (let i = 7; i <= 10; i++) {
        if (ambulanceGroup.children[i]) {
            ambulanceGroup.children[i].rotation.x = state.vehWheelRot;
        }
    }

    // --- ENGINE RPM (visual) ---
    const targetRPM = throttle ? 2000 + speedRatio * 5000 : 800 + speedRatio * 2000;
    state.vehRPM += (targetRPM - state.vehRPM) * 4 * dt;

    // --- LIGHTS ---
    if (absSpeed > 2) {
        const flash = Math.floor(Date.now() / 250) % 2 === 0;
        if (ambulanceGroup.children[4]) ambulanceGroup.children[4].material.color.setHex(flash ? 0x4488ff : 0x112244);
        if (ambulanceGroup.children[5]) ambulanceGroup.children[5].material.color.setHex(flash ? 0x112200 : 0xff2222);
    } else {
        if (ambulanceGroup.children[4]) ambulanceGroup.children[4].material.color.setHex(0x4488ff);
        if (ambulanceGroup.children[5]) ambulanceGroup.children[5].material.color.setHex(0xff2222);
    }

    // --- COLLISION ---
    const vehCollision = checkCollision(ambulanceGroup.position, 2.5);
    if (vehCollision.hit) {
        state.vehSpeed *= -0.3; // bounce back
        ambulanceGroup.position.x += vehCollision.nx * 0.1;
        ambulanceGroup.position.z += vehCollision.nz * 0.1;
    }

    // Sync player pos
    state.playerPos.copy(ambulanceGroup.position);

    // Prompts
    const interactPrompt = document.getElementById('interact-prompt');
    interactPrompt.classList.remove('hidden');
    document.querySelector('.interact-content').innerHTML = 'Press <strong>E</strong> to exit ambulance';
    const gatePrompt = document.getElementById('gate-prompt');
    gatePrompt.classList.add('hidden');
    state.nearPatient = null;

    // Objective
    const objDiv = document.getElementById('hud-objective');
    const objText = document.getElementById('objective-text');
    let showObj = false;
    ZONES.forEach((z, i) => {
        const d = Math.sqrt((state.playerPos.x - z.pos[0]) ** 2 + (state.playerPos.z - z.pos[2]) ** 2);
        if (d < 30 && !state.collectedStars.has(i)) {
            objText.textContent = '\ud83d\udea8 ' + z.desc;
            showObj = true;
        }
    });
    objDiv.classList.toggle('hidden', !showObj);

    // --- GTA-STYLE CHASE CAMERA ---
    const camDist = 18 + speedRatio * 8;
    const camHeight = 8 + speedRatio * 4;
    // Look ahead (toward windshield = -sin/-cos direction)
    const lookAheadDist = speedRatio * 6;
    const lookX = ax - sinA * lookAheadDist;
    const lookZ = az - cosA * lookAheadDist;

    const idealCamX = ax + sinA * camDist;
    const idealCamZ = az + cosA * camDist;
    const idealCamY = ay + camHeight;

    // Smooth camera with lerp
    const camSmooth = Math.min(1, 4 * dt);
    state.camPos.lerp(new THREE.Vector3(idealCamX, idealCamY, idealCamZ), camSmooth);
    state.camLookAt.lerp(new THREE.Vector3(lookX, ay + 2, lookZ), camSmooth * 1.5);

    camera.position.copy(state.camPos);
    camera.lookAt(state.camLookAt);
}

// ---- SMOOTH CAMERA (on-foot) ----
function updateCamera(target, lookHeight, dt) {
    const idealX = target.x - Math.sin(state.cameraAngle) * CAMERA_DIST * Math.cos(state.cameraPitch);
    const idealZ = target.z - Math.cos(state.cameraAngle) * CAMERA_DIST * Math.cos(state.cameraPitch);
    const idealY = target.y + CAMERA_HEIGHT + Math.sin(state.cameraPitch) * CAMERA_DIST * 0.5;

    const smooth = Math.min(1, CAMERA_SMOOTH * dt);
    state.camPos.lerp(new THREE.Vector3(idealX, idealY, idealZ), smooth);
    const lookTarget = new THREE.Vector3(target.x, target.y + lookHeight, target.z);
    state.camLookAt.lerp(lookTarget, smooth * 1.2);

    camera.position.copy(state.camPos);
    camera.lookAt(state.camLookAt);
}

// ---- ANIMATE PATIENTS ----
function animatePatients(time) {
    patients.forEach((p, i) => {
        if (p.collected) return;
        p.group.position.y = p.zone.pos[1] + Math.sin(time * 2 + i) * 0.3;
        p.group.rotation.y = time * 1.5 + i;
        // Pulse glow ring
        if (p.group.children[2]) {
            p.group.children[2].scale.setScalar(1 + Math.sin(time * 3 + i) * 0.2);
        }
    });
}

// ---- GAME LOOP ----
let lastTime = 0;

buildWorld();
createPlayer();
createAmbulance();
createNPCs();
createPatients();
createGates();

function gameLoop(timestamp) {
    requestAnimationFrame(gameLoop);
    const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
    lastTime = timestamp;

    if (state.phase === 'playing') {
        const time = timestamp / 1000;
        updatePlayer(dt);
        updateNPCs(dt);
        animatePatients(time);
        updateParticles(dt);
        updateHUD();
        drawMinimap();
        // Show driving mode in HUD
        const zoneEl = document.getElementById('hud-zone');
        if (state.inAmbulance) {
            const speedKmh = Math.abs(Math.round(state.vehSpeed * 3.6));
            const drift = state.vehHandbrake ? ' 🔥 DRIFT' : '';
            zoneEl.textContent = '🚑 ' + speedKmh + ' km/h' + drift;
        }
    }

    renderer.render(scene, camera);
}

requestAnimationFrame(gameLoop);

})();
