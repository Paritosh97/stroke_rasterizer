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
