async function loadShaderFile(url) {
    const response = await fetch(url);
    return await response.text();
}

async function loadShaders() {
    const vertexShaderSource = await loadShaderFile('/static/shaders/vertex_shader.glsl');
    const fragmentShaderSource = await loadShaderFile('/static/shaders/fragment_shader.glsl');

    return {
        vertexShaderSource,
        fragmentShaderSource
    };
}

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

    // Create buffer for positions
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    // Example data (replace this with your dynamic data)
    const allSamples = [
        { position: [100, 100], radius: 10 },
        { position: [150, 150], radius: 15 },
        { position: [200, 200], radius: 20 },
        { position: [250, 250], radius: 25 },
        { position: [300, 300], radius: 30 },
    ];

    const allStrokes = [
        { startIndex: 0, endIndex: 4, color: 0xff0000ff, zIndex: 0 }
    ];

    // Flattened array for positions and radii
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
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    // Create buffer for radii
    const radiusBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, radiusBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(radii), gl.STATIC_DRAW);

    // Resize canvas
    gl.canvas.width = window.innerWidth;
    gl.canvas.height = window.innerHeight;
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    // Clear canvas
    gl.clearColor(1, 1, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Use our shader program
    gl.useProgram(program);

    // Pass the resolution to the shader
    gl.uniform2f(resolutionLocation, gl.canvas.width, gl.canvas.height);

    // Enable position attribute
    gl.enableVertexAttribArray(positionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Enable radius attribute
    gl.enableVertexAttribArray(radiusLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, radiusBuffer);
    gl.vertexAttribPointer(radiusLocation, 1, gl.FLOAT, false, 0, 0);

    // Set color
    const strokeColor = allStrokes[0].color;
    const r = ((strokeColor >> 24) & 0xFF) / 255.0;
    const g = ((strokeColor >> 16) & 0xFF) / 255.0;
    const b = ((strokeColor >> 8) & 0xFF) / 255.0;
    const a = (strokeColor & 0xFF) / 255.0;
    gl.uniform4f(colorLocation, r, g, b, a);

    // Draw the points
    gl.drawArrays(gl.POINTS, 0, positions.length / 2);
}

window.onload = main;
