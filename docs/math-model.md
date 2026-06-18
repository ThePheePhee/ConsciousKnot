# ConsciousKnot Math Model

ConsciousKnot renders a framed ribbon around a closed curve. The centerline is sampled as a periodic map from `S^1` into ordinary 3D space for the default mode, or into `R4` for the transition mode before projection back to 3D.

## Framed Knot

The curve is sampled at hundreds of longitudinal points. A stable frame is built with parallel transport instead of a naive Frenet frame, so the ribbon avoids violent flips near low-curvature regions. Each sample stores position, tangent, ribbon normal, binormal, outward radial direction, and a pinch weight.

## Ribbon Embedding

The surface uses the approximate embedding:

```text
X(t, u) = gamma(t) + width * u * n(t) + flare * edge(u) * outward(t)
```

where `t` is the longitudinal coordinate, `u` ranges from `-1` to `1` across the ribbon, and `edge(u)` grows near the ribbon lips. The mesh is triangulated as a closed strip, with UVs preserving `uv.x` along the ribbon and `uv.y` across it.

## Edge Flare

The lips are pushed along the outward radial direction with a high-power edge function. This makes the ribbon edges curl away from the spherical center rather than behaving like a flat tape or round tube.

## Spherical Compaction

Torus-knot parameterizations are blended toward a near-spherical shell. The original torus-knot over/under rhythm remains visible, but the geometry is compacted into a dense orb instead of staying on a donut.

## Approximate C5 / Ten-Tip Structure

The visual target calls for five-periodic organization and about ten outward pinch points. The MVP uses a tenth harmonic radial modulation plus pinch-weighted ribbon width and flare. These tips are not separate spikes; they arise from the sampled centerline and ribbon frame.

## 3D Mode

3D mode samples a selected knot directly in `R3`, applies spherical compaction, then adds a smooth time-dependent slither along the radial and vertical directions. The slither is periodic and coherent, so the knot feels alive while remaining a single closed ribbon.

## 4D Transition Mode

4D mode builds both source and target knots in `R3`, embeds them into `R4`, then interpolates their xyz coordinates while adding a nonzero `w` lift:

```text
P4(t, a).xyz = (1 - a) * A3(t) + a * B3(t)
P4(t, a).w = liftAmplitude * sin(pi * a) * sin(liftFrequency * t + phase)
```

The extra spatial coordinate lets intermediate forms pass through projected states that would be obstructed in ordinary 3D.

## 4D Rotation Planes

After the lift, the point is rotated in six coordinate planes: `XY`, `XZ`, `XW`, `YZ`, `YW`, and `ZW`. These are true 4D plane rotations applied to the coordinate pairs before projection.

## R4 To R3 Projection

The renderer uses perspective projection from `R4` to `R3`:

```text
factor = d4 / (d4 - w)
x3 = factor * x4
y3 = factor * y4
z3 = factor * z4
```

The resulting 3D curve is framed and expanded into the same ribbon mesh used by 3D mode.

## Shader And Color Model

The ribbon shader uses longitudinal UVs as the dominant color coordinate. Oil-slick coloration is built from nonlinear palettes mixing violet, indigo, electric blue, cyan, teal, emerald, copper, gold, rose, and orange. Fine fibre lines run along the ribbon, while layered procedural noise adds cellular and interference-like microstructure. Fresnel, edge highlights, a white core light, sparkles, and bloom create the bright diamond interior.
