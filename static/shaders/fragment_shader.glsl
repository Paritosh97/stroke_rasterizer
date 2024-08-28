precision mediump float;
varying vec4 v_color;
varying float v_radius;

void main() {
    // Calculate distance from the center of the point/quad
    vec2 coord = gl_PointCoord - vec2(0.5); // Center the coordinates around (0, 0)
    float dist = length(coord * 2.0); // Calculate distance in normalized device coordinates

    // Define the thickness of the border
    float borderThickness = 0.1;

    // Define the size of the blue dot in the center
    float dotSize = 0.2;

    if (dist > 1.0) {
        discard;  // Discard fragments outside the point's radius
    } else if (dist > (1.0 - borderThickness)) {
        // Blue border
        gl_FragColor = v_color;  // Use the color passed from the vertex shader
    } else if (dist < dotSize) {
        // Blue dot in the center
        gl_FragColor = vec4(0.0, 0.0, 1.0, 1.0);  // Blue color for the dot
    } else {
        // Hollow inside (transparent)
        discard;  // Make the inside of the shape transparent
    }

    // Apply anti-aliasing to smooth edges
    float edgeSoftness = 0.005; // Softens the edges
    gl_FragColor.a *= smoothstep(1.0, 1.0 - edgeSoftness, dist);
}
