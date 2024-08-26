// Vertex Shader (VS)
attribute vec2 a_position;
attribute float a_radius;
attribute vec4 a_color;
uniform vec2 u_resolution;
varying float v_radius;
varying vec4 v_color;

void main() {
    // Convert position from pixels to normalized device coordinates
    vec2 zeroToOne = a_position / u_resolution;
    vec2 zeroToTwo = zeroToOne * 2.0;
    vec2 clipSpace = zeroToTwo - 1.0;

    gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
    v_radius = a_radius;
    v_color = a_color;

    // Set point size
    gl_PointSize = a_radius * 2.0;
}
