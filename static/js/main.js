let allSamples = [];
let allStrokes = [];
let isDrawing = false;
let lastSample = null;
let activeStrokeIndex = -1;
let strokeEditingMode = false;

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
    const colorLocation = gl.getAttribLocation(program, 'a_color');
    const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');

    // Create buffers for positions, radii, and colors
    const positionBuffer = gl.createBuffer();
    const radiusBuffer = gl.createBuffer();
    const colorBuffer = gl.createBuffer();

    // Event listeners for drawing
    canvas.addEventListener('pointerdown', (event) => {
        event.preventDefault(); // Prevent default back gesture
        isDrawing = true;
        const sample = createSample(event, canvas);

        if (strokeEditingMode && activeStrokeIndex !== -1) {
            // Add to the currently selected stroke in editing mode
            lastSample = sample;
            allSamples.push(sample);
            allStrokes[activeStrokeIndex].endIndex = allSamples.length - 1;
            allStrokes[activeStrokeIndex].samples.push(sample);
        } else {
            // Create a new stroke
            lastSample = sample;
            allSamples.push(sample);
            allStrokes.push({ startIndex: allSamples.length - 1, endIndex: allSamples.length - 1, samples: [sample], color: 0xff0000ff, zIndex: 0 });
            activeStrokeIndex = allStrokes.length - 1;
        }

        updateStrokeList();
        updateSampleList();
        render(gl, program, positionLocation, radiusLocation, resolutionLocation, colorLocation, positionBuffer, radiusBuffer, colorBuffer);
    });

    canvas.addEventListener('pointermove', (event) => {
        event.preventDefault(); // Prevent default back gesture
        if (!isDrawing) return;
        const sample = createSample(event, canvas);

        // Add interpolated points between lastSample and current sample
        interpolateSamples(lastSample, sample, 5).forEach(s => {
            allSamples.push(s);
            allStrokes[activeStrokeIndex].samples.push(s);
        });

        allStrokes[activeStrokeIndex].endIndex = allSamples.length - 1;
        lastSample = sample;
        updateSampleList();
        render(gl, program, positionLocation, radiusLocation, resolutionLocation, colorLocation, positionBuffer, radiusBuffer, colorBuffer);
    });

    canvas.addEventListener('pointerup', (event) => {
        event.preventDefault(); // Prevent default back gesture
        isDrawing = false;
        lastSample = null;

        if (!strokeEditingMode) {
            activeStrokeIndex = -1; // Reset active stroke index after lifting pen, only if not in editing mode
        }
    });

    canvas.addEventListener('pointercancel', (event) => {
        event.preventDefault(); // Prevent default back gesture
        isDrawing = false;
        lastSample = null;

        if (!strokeEditingMode) {
            activeStrokeIndex = -1; // Reset active stroke index after lifting pen, only if not in editing mode
        }
    });

    // Resize canvas to fit the window
    canvas.width = window.innerWidth - 200; // Adjust for the debug menu
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

    return { position: [x, y], radius, color: 0x0000FFFF };  // Blue color for input samples
}

function interpolateSamples(sample1, sample2, numPoints) {
    const points = [];
    const dx = (sample2.position[0] - sample1.position[0]) / numPoints;
    const dy = (sample2.position[1] - sample1.position[1]) / numPoints;
    const dr = (sample2.radius - sample1.radius) / numPoints;

    for (let i = 1; i <= numPoints; i++) {
        points.push({
            position: [sample1.position[0] + i * dx, sample1.position[1] + i * dy],
            radius: sample1.radius + i * dr,
            color: 0xFF0000FF  // Red color for interpolated samples
        });
    }
    return points;
}

function updateStrokeList() {
    const strokeListDiv = document.getElementById('strokeList');
    strokeListDiv.innerHTML = ''; // Clear the list

    if (allStrokes.length === 0) {
        strokeListDiv.innerHTML = '<p>No strokes yet.</p>';
        return;
    }

    allStrokes.forEach((stroke, index) => {
        const strokeButton = document.createElement('button');
        strokeButton.textContent = `Stroke ${index + 1}`;
        strokeButton.style.display = 'block';
        strokeButton.style.width = '100%';
        strokeButton.style.marginBottom = '5px';

        if (index === activeStrokeIndex && strokeEditingMode) {
            strokeButton.style.backgroundColor = '#ddd'; // Highlight active stroke
        }

        strokeButton.addEventListener('click', () => {
            activeStrokeIndex = index;
            strokeEditingMode = true; // Enter stroke editing mode
            updateStrokeList();
            updateSampleList();
        });

        strokeListDiv.appendChild(strokeButton);

        // Create expand/collapse functionality
        const sampleListDiv = document.createElement('div');
        sampleListDiv.style.display = 'none';
        sampleListDiv.style.marginLeft = '10px';

        stroke.samples.forEach((sample, sampleIndex) => {
            const sampleDiv = document.createElement('div');
            sampleDiv.textContent = `Sample ${sampleIndex + 1}: Pos(${sample.position[0].toFixed(2)}, ${sample.position[1].toFixed(2)}) Radius: ${sample.radius.toFixed(2)}`;
            sampleListDiv.appendChild(sampleDiv);
        });

        strokeButton.addEventListener('click', () => {
            sampleListDiv.style.display = sampleListDiv.style.display === 'none' ? 'block' : 'none';
        });

        strokeListDiv.appendChild(sampleListDiv);
    });

    // Add "+" button to exit editing mode and create a new stroke
    const newStrokeButton = document.createElement('button');
    newStrokeButton.textContent = '+ New Stroke';
    newStrokeButton.style.display = 'block';
    newStrokeButton.style.width = '100%';
    newStrokeButton.style.marginTop = '10px';
    newStrokeButton.addEventListener('click', () => {
        activeStrokeIndex = -1;
        strokeEditingMode = false;
        updateStrokeList();
    });
    strokeListDiv.appendChild(newStrokeButton);
}

function updateSampleList() {
    const strokeListDiv = document.getElementById('strokeList');
    if (activeStrokeIndex !== -1) {
        const sampleListDiv = document.createElement('div');
        sampleListDiv.style.marginTop = '10px';
        sampleListDiv.style.padding = '5px';
        sampleListDiv.style.backgroundColor = '#eee';
        sampleListDiv.style.border = '1px solid #ccc';

        const samples = allStrokes[activeStrokeIndex].samples;

        if (samples.length > 0) {
            samples.forEach((sample, sampleIndex) => {
                const sampleDiv = document.createElement('div');
                sampleDiv.textContent = `Sample ${sampleIndex + 1}: Pos(${sample.position[0].toFixed(2)}, ${sample.position[1].toFixed(2)}) Radius: ${sample.radius.toFixed(2)}`;
                sampleDiv.style.marginBottom = '3px';
                sampleListDiv.appendChild(sampleDiv);
            });
        } else {
            sampleListDiv.innerHTML = '<p>No samples in this stroke.</p>';
        }

        strokeListDiv.appendChild(sampleListDiv);
    }
}

function render(gl, program, positionLocation, radiusLocation, resolutionLocation, colorLocation, positionBuffer, radiusBuffer, colorBuffer) {
    // Separate arrays for original samples (blue) and interpolated samples (red)
    const originalPositions = [];
    const originalRadii = [];
    const originalColors = [];
    const interpolatedPositions = [];
    const interpolatedRadii = [];
    const interpolatedColors = [];

    allStrokes.forEach(stroke => {
        stroke.samples.forEach(sample => {
            const isInterpolated = sample.color === 0xFF0000FF; // Check if the sample is red
            if (isInterpolated) {
                interpolatedPositions.push(...sample.position);
                interpolatedRadii.push(sample.radius);
                interpolatedColors.push(
                    ((sample.color >> 24) & 0xFF) / 255.0,
                    ((sample.color >> 16) & 0xFF) / 255.0,
                    ((sample.color >> 8) & 0xFF) / 255.0,
                    (sample.color & 0xFF) / 255.0
                );
            } else {
                originalPositions.push(...sample.position);
                originalRadii.push(sample.radius);
                originalColors.push(
                    ((sample.color >> 24) & 0xFF) / 255.0,
                    ((sample.color >> 16) & 0xFF) / 255.0,
                    ((sample.color >> 8) & 0xFF) / 255.0,
                    (sample.color & 0xFF) / 255.0
                );
            }
        });
    });

    // Render interpolated points (red) first
    renderPoints(gl, positionLocation, radiusLocation, colorLocation, interpolatedPositions, interpolatedRadii, interpolatedColors, positionBuffer, radiusBuffer, colorBuffer);

    // Render original samples (blue) on top
    renderPoints(gl, positionLocation, radiusLocation, colorLocation, originalPositions, originalRadii, originalColors, positionBuffer, radiusBuffer, colorBuffer);
}

function renderPoints(gl, positionLocation, radiusLocation, colorLocation, positions, radii, colors, positionBuffer, radiusBuffer, colorBuffer) {
    if (positions.length === 0) return;

    // Load positions into buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    // Load radii into buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, radiusBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(radii), gl.STATIC_DRAW);

    // Load colors into buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);

    // Enable position attribute
    gl.enableVertexAttribArray(positionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Enable radius attribute
    gl.enableVertexAttribArray(radiusLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, radiusBuffer);
    gl.vertexAttribPointer(radiusLocation, 1, gl.FLOAT, false, 0, 0);

    // Enable color attribute
    gl.enableVertexAttribArray(colorLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.vertexAttribPointer(colorLocation, 4, gl.FLOAT, false, 0, 0);

    // Draw the points
    gl.drawArrays(gl.POINTS, 0, positions.length / 2);
}


window.onload = main;
