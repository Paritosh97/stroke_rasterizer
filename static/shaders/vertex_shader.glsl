attribute vec2 a_position;
attribute float a_radius;
uniform vec2 u_resolution;
varying float v_radius;

void main() {
    // Convert the position from pixels to normalized device coordinates
    vec2 zeroToOne = a_position / u_resolution;
    vec2 zeroToTwo = zeroToOne * 2.0;
    vec2 clipSpace = zeroToTwo - 1.0;

    gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
    v_radius = a_radius / u_resolution.x;  // Adjust radius by resolution for consistent appearance
    gl_PointSize = a_radius * 2.0;
}
