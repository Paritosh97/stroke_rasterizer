precision mediump float;
varying vec4 v_color;
varying float v_radius;

void main() {
    // Calculate distance from the center of the point/quad
    vec2 coord = gl_PointCoord - vec2(0.5); // Center the coordinates around (0, 0)
    float dist = length(coord * 2.0); // Calculate distance in normalized device coordinates

    // Define the thickness of the border and size of the central dot
    float borderThickness = 0.1;
    float dotSize = 0.2;

    if (dist > 1.0) {
        discard;  // Discard fragments outside the point's radius
    } else if (dist > (1.0 - borderThickness)) {
        // Blue border
        gl_FragColor = vec4(0.0, 0.0, 1.0, 1.0);  // Solid blue for the border
    } else if (dist < dotSize) {
        // Blue dot in the center
        gl_FragColor = vec4(0.0, 0.0, 1.0, 1.0);  // Solid blue for the dot
    } else {
        discard;
    }

    // Smoothing edge transitions only at the very outer boundary
    float edgeSoftness = 0.005;
    if (dist > (1.0 - edgeSoftness)) {
        float alpha = smoothstep(1.0, 1.0 - edgeSoftness, dist);
        gl_FragColor.a *= alpha; // Smooth transition, but ensure full color coverage
    }
}
