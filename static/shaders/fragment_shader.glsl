precision mediump float;
uniform vec4 u_color;
varying float v_radius;

void main() {
    // Calculate distance from center of point
    vec2 coord = 2.0 * gl_PointCoord - 1.0;
    float dist = length(coord);
    if (dist > 1.0) {
        discard;
    }
    gl_FragColor = u_color;
}
