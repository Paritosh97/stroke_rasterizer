precision mediump float;
varying vec4 v_color;
varying float v_radius;

void main() {
    // Calculate distance from the center of the point
    vec2 coord = 2.0 * gl_PointCoord - 1.0;
    float dist = length(coord);

    // Discard fragments outside the point's radius
    if (dist > 1.0) {
        discard;
    }

    // Set the fragment color
    gl_FragColor = v_color;
}