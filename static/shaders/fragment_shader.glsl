precision mediump float;
varying vec4 v_color;
varying float v_radius;

void main() {
    // Calculate distance from the center of the point
    vec2 coord = 2.0 * gl_PointCoord - 1.0;
    float dist = length(coord);

    // Define the thickness of the border
    float borderThickness = 0.1;

    // Define the size of the blue dot in the center
    float dotSize = 0.2;

    if (dist > 1.0) {
        discard;  // Discard fragments outside the point's radius
    } else if (dist > (1.0 - borderThickness)) {
        // Blue border
        gl_FragColor = vec4(0.0, 0.0, 1.0, 1.0);  // Blue color
    } else if (dist < dotSize) {
        // Blue dot in the center
        gl_FragColor = vec4(0.0, 0.0, 1.0, 1.0);  // Blue color
    } else {
        // Make the inside of the circle hollow (transparent)
        discard;
    }
}
