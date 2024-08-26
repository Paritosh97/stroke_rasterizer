let allSamples = [];
let allStrokes = [];
let isDrawing = false;
let lastSample = null;

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function createProgram(gl, vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(program));
        return null;
    }
    return program;
}

async function main() {
    const canvas = document.getElementById('glCanvas');
    const gl = canvas.getContext('webgl');

    if (!gl) {
        console.error('WebGL not supported');
        return;
    }

    // Prevent context menu on right-click or long press
    canvas.addEventListener('contextmenu', (event) => {
        event.preventDefault();
    });

    // Load shaders from files
    const { vertexShaderSource, fragmentShaderSource } = await loadShaders();

    // Create shaders
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

    // Create program
    const program = createProgram(gl, vertexShader, fragmentShader);

    // Look up attribute and uniform locations
    const positionLocation = gl.getAttribLocation(program, 'a_position');
    const radiusLocation = gl.getAttribLocation(program, 'a_radius');
    const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');
    const colorLocation = gl.getUniformLocation(program, 'u_color');

    // Create buffers for positions and radii
    const positionBuffer = gl.createBuffer();
    const radiusBuffer = gl.createBuffer();

    // Event listeners for drawing
    canvas.addEventListener('pointerdown', (event) => {
        event.preventDefault(); // Prevent default back gesture
        isDrawing = true;
        lastSample = createSample(event, canvas);
        allSamples.push(lastSample);
        allStrokes.push({ startIndex: allSamples.length - 1, endIndex: allSamples.length - 1, color: 0xff0000ff, zIndex: 0 });
        render(gl, program, positionLocation, radiusLocation, resolutionLocation, colorLocation, positionBuffer, radiusBuffer);
    });

    canvas.addEventListener('pointermove', (event) => {
        event.preventDefault(); // Prevent default back gesture
        if (!isDrawing) return;
        const sample = createSample(event, canvas);

        // Add interpolated points between lastSample and current sample
        interpolateSamples(lastSample, sample, 5).forEach(s => allSamples.push(s));
        
        allStrokes[allStrokes.length - 1].endIndex = allSamples.length - 1;
        lastSample = sample;
        render(gl, program, positionLocation, radiusLocation, resolutionLocation, colorLocation, positionBuffer, radiusBuffer);
    });

    canvas.addEventListener('pointerup', (event) => {
        event.preventDefault(); // Prevent default back gesture
        isDrawing = false;
        lastSample = null;
    });

    canvas.addEventListener('pointercancel', (event) => {
        event.preventDefault(); // Prevent default back gesture
        isDrawing = false;
        lastSample = null;
    });

    // Resize canvas to fit the window
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(1, 1, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(program);
    gl.uniform2f(resolutionLocation, gl.canvas.width, gl.canvas.height);
}

function createSample(event, canvas) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Use pressure from the pointer event if available, otherwise default to 1.0
    const pressure = event.pressure || 1.0;

    // Set radius based on pressure (adjust the scaling factor as needed)
    const radius = Math.min(50, 5 + pressure * 45);  // Scales pressure (0 to 1) to radius (5 to 50px)

    return { position: [x, y], radius };
}

function interpolateSamples(sample1, sample2, numPoints) {
    const points = [];
    const dx = (sample2.position[0] - sample1.position[0]) / numPoints;
    const dy = (sample2.position[1] - sample1.position[1]) / numPoints;
    const dr = (sample2.radius - sample1.radius) / numPoints;

    for (let i = 1; i <= numPoints; i++) {
        points.push({
            position: [sample1.position[0] + i * dx, sample1.position[1] + i * dy],
            radius: sample1.radius + i * dr
        });
    }
    return points;
}

function render(gl, program, positionLocation, radiusLocation, resolutionLocation, colorLocation, positionBuffer, radiusBuffer) {
    // Prepare positions and radii arrays
    const positions = [];
    const radii = [];

    allStrokes.forEach(stroke => {
        for (let i = stroke.startIndex; i <= stroke.endIndex; i++) {
            const sample = allSamples[i];
            positions.push(...sample.position);
            radii.push(sample.radius);
        }
    });

    // Load positions into buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    // Load radii into buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, radiusBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(radii), gl.STATIC_DRAW);

    // Set color
    const strokeColor = 0xff0000ff;
    const r = ((strokeColor >> 24) & 0xFF) / 255.0;
    const g = ((strokeColor >> 16) & 0xFF) / 255.0;
    const b = ((strokeColor >> 8) & 0xFF) / 255.0;
    const a = (strokeColor & 0xFF) / 255.0;
    gl.uniform4f(colorLocation, r, g, b, a);

    // Enable position attribute
    gl.enableVertexAttribArray(positionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Enable radius attribute
    gl.enableVertexAttribArray(radiusLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, radiusBuffer);
    gl.vertexAttribPointer(radiusLocation, 1, gl.FLOAT, false, 0, 0);

    // Clear canvas
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Draw the points
    gl.drawArrays(gl.POINTS, 0, positions.length / 2);
}

window.onload = main;
