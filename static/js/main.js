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
    if (!vertexShader || !fragmentShader) {
        console.error("Shader creation failed. Cannot create program.");
        return null;
    }

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

    // Handle interpolation mode change
    const interpolationDropdown = document.getElementById('interpolationMode');
    interpolationDropdown.addEventListener('change', (event) => {
        interpolationMode = event.target.value;
        render(gl, program, positionLocation, radiusLocation, resolutionLocation, colorLocation, positionBuffer, radiusBuffer, colorBuffer);
    });

    canvas.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        isDrawing = true;
        const sample = createSample(event, canvas);
    
        if (strokeEditingMode && activeStrokeIndex !== -1) {
            lastSample = sample;
            allSamples.push(sample);
            allStrokes[activeStrokeIndex].endIndex = allSamples.length - 1;
            allStrokes[activeStrokeIndex].samples.push(sample);
        } else {
            lastSample = sample;
            allSamples.push(sample);
            allStrokes.push({ startIndex: allSamples.length - 1, endIndex: allSamples.length - 1, samples: [sample], color: 0xff0000ff, zIndex: 0 });
            activeStrokeIndex = allStrokes.length - 1;
        }
    
        updateStrokeList();
        updateSampleList();
        render(gl, program, positionLocation, radiusLocation, resolutionLocation, colorLocation, positionBuffer, radiusBuffer, colorBuffer);
    });
    
    function calculateDistance(sample1, sample2) {
        const dx = sample2.position[0] - sample1.position[0];
        const dy = sample2.position[1] - sample1.position[1];
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    let distanceThreshold = 100; // Default value

    // Update distance threshold when the slider is moved
    const distanceThresholdSlider = document.getElementById('distanceThreshold');
    const distanceThresholdValue = document.getElementById('distanceThresholdValue');

    distanceThresholdSlider.addEventListener('input', (event) => {
        distanceThreshold = parseInt(event.target.value, 10);
        distanceThresholdValue.textContent = distanceThreshold;
    });

    function calculateDistance(sample1, sample2) {
        const dx = sample2.position[0] - sample1.position[0];
        const dy = sample2.position[1] - sample1.position[1];
        return Math.sqrt(dx * dx + dy * dy);
    }

    canvas.addEventListener('pointermove', (event) => {
        event.preventDefault();
        if (!isDrawing) return;
        
        const sample = createSample(event, canvas);
        
        if (calculateDistance(lastSample, sample) > distanceThreshold) {
            // Add the sample only if it's far enough from the last one
            interpolateSamples(lastSample, sample, 5).forEach(s => {
                allSamples.push(s);
                allStrokes[activeStrokeIndex].samples.push(s);
            });

            allStrokes[activeStrokeIndex].endIndex = allSamples.length - 1;
            lastSample = sample;
            updateSampleList();
            render(gl, program, positionLocation, radiusLocation, resolutionLocation, colorLocation, positionBuffer, radiusBuffer, colorBuffer);
        }
    });

    canvas.addEventListener('pointerup', (event) => {
        event.preventDefault();
        isDrawing = false;
        lastSample = null;
    
        if (!strokeEditingMode) {
            activeStrokeIndex = -1;
        }
    });
    
    canvas.addEventListener('pointercancel', (event) => {
        event.preventDefault();
        isDrawing = false;
        lastSample = null;
    
        if (!strokeEditingMode) {
            activeStrokeIndex = -1;
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

    return { position: [x, y], radius, color: 0xFF0000FF };
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
            color: 0xFF0000FF
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

function catmullRomInterpolate(p0, p1, p2, p3, t) {
    const t2 = t * t;
    const t3 = t2 * t;

    return [
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
    ];
}


function interpolateStroke(stroke, numSegments) {
    const interpolatedPoints = [];

    const samples = stroke.samples;
    if (samples.length < 2) return interpolatedPoints;

    for (let i = 0; i < samples.length - 1; i++) {
        const p0 = samples[i === 0 ? i : i - 1].position;
        const p1 = samples[i].position;
        const p2 = samples[i + 1].position;
        const p3 = samples[i + 1 === samples.length - 1 ? i + 1 : i + 2].position;

        for (let t = 0; t < numSegments; t++) {
            const tNorm = t / numSegments;
            const interpolatedPosition = catmullRomInterpolate(p0, p1, p2, p3, tNorm);
            const interpolatedRadius = samples[i].radius + tNorm * (samples[i + 1].radius - samples[i].radius);
            interpolatedPoints.push({ position: interpolatedPosition, radius: interpolatedRadius });
        }
    }

    interpolatedPoints.push({ position: samples[samples.length - 1].position, radius: samples[samples.length - 1].radius });

    return interpolatedPoints;
}

function renderInterpolatedCurve(gl, positionLocation, colorLocation, positionBuffer, colorBuffer) {
    const positions = [];
    const colors = [];
    const redColor = [1.0, 0.0, 0.0, 1.0];  // Red color for the curve

    allStrokes.forEach((stroke, strokeIndex) => {
        const interpolatedPoints = interpolateStroke(stroke, 20);

        for (let i = 0; i < interpolatedPoints.length - 1; i++) {
            const currentPoint = interpolatedPoints[i];
            const nextPoint = interpolatedPoints[i + 1];

            const direction = [
                nextPoint.position[0] - currentPoint.position[0],
                nextPoint.position[1] - currentPoint.position[1]
            ];
            const length = Math.sqrt(direction[0] * direction[0] + direction[1] * direction[1]);
            if (length === 0) continue;  // Skip zero-length segments

            const normalizedDir = [direction[0] / length, direction[1] / length];

            const perpDir = [-normalizedDir[1], normalizedDir[0]];

            const currentRadius = currentPoint.radius;
            const nextRadius = nextPoint.radius;

            // Adjusted vertex generation to handle sharp turns
            const v1 = [
                currentPoint.position[0] + perpDir[0] * currentRadius,
                currentPoint.position[1] + perpDir[1] * currentRadius
            ];
            const v2 = [
                currentPoint.position[0] - perpDir[0] * currentRadius,
                currentPoint.position[1] - perpDir[1] * currentRadius
            ];

            const v3 = [
                nextPoint.position[0] + perpDir[0] * nextRadius,
                nextPoint.position[1] + perpDir[1] * nextRadius
            ];
            const v4 = [
                nextPoint.position[0] - perpDir[0] * nextRadius,
                nextPoint.position[1] - perpDir[1] * nextRadius
            ];

            // To prevent overlapping, adjust the vertex positions if they intersect
            // Use a small adjustment factor
            const adjustmentFactor = 0.01;
            if (Math.abs(v1[0] - v3[0]) < adjustmentFactor && Math.abs(v1[1] - v3[1]) < adjustmentFactor) {
                v1[0] += perpDir[0] * adjustmentFactor;
                v1[1] += perpDir[1] * adjustmentFactor;
                v3[0] -= perpDir[0] * adjustmentFactor;
                v3[1] -= perpDir[1] * adjustmentFactor;
            }

            positions.push(...v1, ...v3, ...v2, ...v4);

            // Add colors for each vertex
            for (let j = 0; j < 4; j++) {
                colors.push(...redColor);
            }
        }

        // Insert degenerate triangles to separate this stroke from the next
        if (strokeIndex < allStrokes.length - 1) {
            const lastPos = positions.slice(-2); // Last position added
            positions.push(...lastPos, ...lastPos); // Add twice to make a degenerate triangle
            colors.push(0, 0, 0, 0, 0, 0, 0, 0); // Invisible color for degenerate triangle
        }
    });

    if (positions.length === 0) return;

    // Load positions into buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    // Load colors into buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);

    // Enable position attribute
    gl.enableVertexAttribArray(positionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Enable color attribute
    gl.enableVertexAttribArray(colorLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.vertexAttribPointer(colorLocation, 4, gl.FLOAT, false, 0, 0);

    // Clear the canvas
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Draw the quads as triangle strips
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, positions.length / 2);
}

function renderSamples(gl, positionLocation, radiusLocation, colorLocation, positionBuffer, radiusBuffer, colorBuffer) {
    const positions = [];
    const radii = [];
    const colors = [];
    const blueColor = [0.0, 0.0, 1.0, 1.0];  // Blue color for the samples

    allStrokes.forEach(stroke => {
        stroke.samples.forEach(sample => {
            positions.push(...sample.position);
            radii.push(sample.radius);
            colors.push(...blueColor);  // Blue color for each sample
        });
    });

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

    // Draw the points (samples)
    gl.drawArrays(gl.POINTS, 0, positions.length / 2);
}

function render(gl, program, positionLocation, radiusLocation, resolutionLocation, colorLocation, positionBuffer, radiusBuffer, colorBuffer) {
    if (interpolationMode === 'smoothCurve') {
        renderInterpolatedCurve(gl, positionLocation, colorLocation, positionBuffer, colorBuffer);
        renderSamples(gl, positionLocation, radiusLocation, colorLocation, positionBuffer, radiusBuffer, colorBuffer);
    } else {
        renderSamples(gl, positionLocation, radiusLocation, colorLocation, positionBuffer, radiusBuffer, colorBuffer);
    }
}

window.onload = main;
