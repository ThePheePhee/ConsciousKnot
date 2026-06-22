# Spherical Weaving Architecture

This note records the next mathematical architecture for the developer mode and, later, the final visualization. The important correction is that spherical adherence is not a cosmetic post-process. It is the native mathematical domain of the object.

## Topological Constraint

A nontrivial knot cannot be represented by a simple closed centerline lying exactly on one round 2-sphere in ordinary 3-space. By the Jordan curve theorem and Schoenflies theorem, a simple closed curve on a sphere bounds a disk on that sphere, so as a space curve in the surrounding 3-ball it is an unknot.

Therefore the intended object cannot be "a knot curve on S2" in the literal sense. It must be a knot diagram on S2, realized as an embedded ribbon inside a thickened spherical shell:

```text
S2 x [-epsilon, epsilon]
```

The projection to `S2` carries the visual weaving pattern. The shell thickness carries over/under information by a signed radial height. The fourth dimension is reserved for changing the diagram, not for making stable states look spherical.

## Research Anchors

- Ropelength and tube thickness are the right self-avoidance model for a ribbon centerline. Ashton, Cantarella, Piatek, and Rawdon's constrained-gradient ropelength work is a direct model for "keep the tube embedded while minimizing length or energy": https://arxiv.org/abs/1002.1723
- Tangent-point energies give a smooth self-repulsive functional whose finite-energy curves avoid self-intersections and preserve knot type under descent: https://arxiv.org/abs/1006.4566
- Elastic-knot numerics combine bending energy with tangent-point self-avoidance, which is close to the intended "smooth, low-energy, no self-intersection" behavior: https://arxiv.org/abs/1804.02206
- Alternating links in thickened surfaces are an existing mathematical setting for link diagrams on a surface, then realized inside `surface x I`: https://arxiv.org/abs/2008.09895 and https://arxiv.org/abs/1712.01373
- Spherical braid groups model braiding on the sphere itself, with the extra global relation caused by living on `S2`: https://en.wikipedia.org/wiki/Spherical_braid_group
- Circle packing and primal-dual circle packing give a principled way to lay planar/spherical graphs onto the sphere with good symmetry and spacing: https://en.wikipedia.org/wiki/Circle_packing_theorem and https://arxiv.org/abs/1911.00612

## Proposed Mathematical Model

### 1. Combinatorial Spherical Diagram

Represent each state as a spherical knot diagram:

```ts
interface SphericalDiagram {
  vertices: CrossingVertex[];
  edges: DiagramArc[];
  components: ComponentWalk[];
  symmetry: SymmetryGroup;
}

interface CrossingVertex {
  id: string;
  normal: Vec3OnSphere;
  sign: 1 | -1;
  overPair: [HalfEdgeId, HalfEdgeId];
  underPair: [HalfEdgeId, HalfEdgeId];
}

interface DiagramArc {
  id: string;
  from: HalfEdgeId;
  to: HalfEdgeId;
  controlNormals: Vec3OnSphere[];
}
```

This replaces the current "sample pointwise between two Euclidean knot curves" approach. The diagram knows what the crossings are before geometry is generated.

### 2. Symmetric Layout On The Sphere

The diagram is embedded on `S2` using one of several layout families:

- **Polyhedral weaving:** start from tetrahedral, octahedral, or icosahedral symmetry, then trace an Eulerian circuit through a 4-valent medial graph. This is the most likely route for dense symmetric sphere-filling visuals.
- **Spherical braid bands:** choose latitudinal or great-circle braid tracks on the sphere, then close them using spherical braid words. This gives stronger continuity and a clean algebraic control surface.
- **Circle-packed diagram:** take a planar/spherical 4-valent graph, compute a circle-packing or primal-dual packing, lift it to the sphere, and route diagram arcs along the packing contact graph. This is a more principled route for arbitrary knots and high-crossing diagrams.

The key is that symmetry is a layout constraint, not a post-process. If the target has sixfold or icosahedral symmetry, crossings are placed in orbits of that symmetry group.

### 3. Thickened-Shell Realization

For every sampled point along the diagram, store:

```text
n(s): unit normal on S2
h(s): signed radial layer inside the shell
w(s): fourth-dimensional coordinate
```

Stable rendered 3D position:

```text
p3(s) = (R + h(s)) * n(s)
```

At crossings, the over strand gets a positive radial bump and the under strand gets a negative radial bump, using compact smooth bump functions. Away from crossings, `h(s)` relaxes toward zero or toward a small lane offset. Stable states should have `w(s) = 0`.

This gives a visible woven shell: the ribbon conforms to the sphere globally, but crossings are real 3D separations inside shell thickness.

### 4. Ribbon Framing

The default frame should be shell-parallel:

```text
tangent = d p3 / ds
radial = normalize(p3)
widthNormal = normalize(radial - tangent * dot(radial, tangent))
surfaceNormal = cross(tangent, widthNormal)
```

Twist should be introduced only as a controlled ribbon framing parameter or when required by ribbon topology. It should not leak into W, and it should not be used to solve crossings.

### 5. Transition Movies

Transitions should be movies of diagrams, not pointwise morphs of unrelated curves.

Allowed local moves:

- **Ambient spherical isotopy:** slide vertices and arcs over the sphere while preserving crossing signs and radial separation.
- **Flype/Reidemeister-style local moves:** for diagram simplification and reorganization, applied in local spherical disks.
- **Crossing change through W:** when knot type changes, only a compact crossing neighborhood enters the fourth dimension. The centerline remains 3D and shell-realized everywhere else.

For a crossing change, the crossing disc should follow this pattern:

```text
1. Local strands approach a near-degenerate crossing in the spherical diagram.
2. The moving strand lifts into W over a compact time window.
3. The radial over/under assignment swaps.
4. The W coordinate returns to zero.
5. The shell-radial separation remains valid before and after the event.
```

This directly addresses the earlier bug where W motion appeared in unrelated parts of the ribbon.

## Energy Functional

The solver should minimize a single energy, not apply independent ad hoc fixes:

```text
E =
  shellAdherence
  + sphericalArcElasticity
  + angularCrossingRegularity
  + tubeThicknessBarrier
  + symmetryOrbitError
  + ribbonTwistPenalty
  + transitionVelocityPenalty
```

Where:

- `shellAdherence` keeps `|p3|` near `R + h`.
- `sphericalArcElasticity` keeps arcs smooth as curves on `S2`.
- `angularCrossingRegularity` prefers near-orthogonal or evenly angled crossings.
- `tubeThicknessBarrier` is ropelength/tangent-point inspired and prevents self-intersection.
- `symmetryOrbitError` keeps crossings and arcs in symmetric orbits.
- `ribbonTwistPenalty` keeps the ribbon radial/untwisted unless explicitly requested.
- `transitionVelocityPenalty` gives continuous nonzero motion without pauses.

## Validation Requirements

Each frame in developer mode should pass numerical checks:

- No non-neighboring ribbon centerline segments closer than the tube clearance, except paired crossing branches that are radially separated by more than the ribbon thickness.
- No ribbon surface triangle intersections in 3D when W-hidden mode is off.
- In stable states, all `w(s)` values are zero.
- During a crossing change, nonzero W is localized to the intended crossing neighborhood.
- The projected spherical diagram matches the intended crossing signs.
- The transition has near-constant speed in an energy metric, not long plateaus plus sudden jumps.

## Implementation Plan

### Phase 1: New Developer Core

Add a parallel developer-mode renderer that does not use `devKnotPoint` as the source of truth. It should generate one simple spherical diagram first:

- unknot as a seam-like simple closed spherical curve with no crossings
- trefoil as a three-crossing spherical diagram in a thickened shell
- figure-eight as a four-crossing spherical diagram

The point is not full knot-table coverage yet. The point is proving that the new shell-native model behaves correctly.

### Phase 2: Symmetric Weaving Families

Add menu options for:

- `dihedral braid shell`
- `tetrahedral weave`
- `octahedral weave`
- `icosahedral weave`
- `circle-packed diagram`

These are not merely visual themes. They are different mathematical layout generators.

### Phase 3: Transition Operators

Replace global linear morphing with local diagram movies:

- crossing-change W movie
- local arc slide
- flype-like rearrangement
- spherical braid generator move

The speed slider should advance arclength in movie space, not raw interpolation time.

### Phase 4: Full Visualization

Once developer mode passes validation on small knots, the final visualization should use the same `SphericalDiagram -> ThickenedShellEmbedding -> RibbonMesh` pipeline, but with denser graphs, richer shader passes, and presentation controls.

## Important Design Decision

The current app has been trying to morph between classical knots and then confine them. The new model should instead generate woven spherical-shell diagrams first. The knot type comes from crossing data in the spherical diagram and radial layer realization. That is the mathematical object matching the experience more closely.

In other words:

```text
Old:
  Euclidean knot curve -> spherical deformation -> repair intersections

New:
  spherical diagram -> thickened-shell embedding -> local 4D transition movies
```

The old model can remain as a comparison/debug mode, but it should no longer be treated as the foundation for the final visualization.
