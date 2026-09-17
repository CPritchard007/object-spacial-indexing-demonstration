# Pachinko Collision Lab

A Vue 3 + Vite HTML Canvas 2D demonstration of spatial indexing, circle collisions, and ball tracking. The physics engine stays DOM-independent so it can be tested without a browser.

## Run

```sh
cd item-indexing-test
npm install
npm run dev
```

Open http://127.0.0.1:5173. `npm start` also launches Vite.

Run `npm run build` to create a production build in `dist/`, then `npm run preview` to preview it locally.

## Explore

- Click a ball (or **Follow a ball**) to highlight its queried cells, candidate objects, exact distance tests, and movement trail.
- Compare **Uniform spatial grid** with **Brute force**. Change cell size to see the tradeoff between bucket coverage and candidate count.
- Pause, advance one tick, slow time, disable automatic drops, or add ten balls. The population is capped at 180. Balls recirculate with persistent IDs.
- The inspector is a current-position snapshot; the global counters measure the last completed physics tick. Since the solver separates contacting circles, a resolved contact may appear clear in the current snapshot.

## Engine layout

- `src/physics.js`: DOM-independent world, spatial hash, collision response, fixed 1/120-second simulation tick.
- `src/App.vue`: Vue UI, accumulator-driven animation loop, high-DPI renderer, pointer selection, controls and inspector.
- `src/main.js`: Vue app bootstrap.
- `style.css`: responsive interface.

The index stores every circle in all cells touched by its AABB. Queries deduplicate objects; the solver deduplicates pairs. Both static pegs and dynamic balls are indexed. Position corrections update the index immediately. Collision resolution uses equal-mass impulses with restitution, immovable pegs, positional separation, gravity, and side-wall constraints. Decorative bottom markings are not colliders.

This is a discrete educational solver, not continuous collision detection: speed is limited to 550 px/s (under 4.6 px per tick). Dense piles may need additional solver iterations; extreme velocities or arbitrary collider sizes would require swept collision detection. Performance counters exclude wall checks and index maintenance. The selected-ball snapshot is extra visualization work, separate from the physics counters.

## Verify

```sh
npm test
```

Tests cover cell boundaries, candidate completeness, pair deduplication, impulse response, static pegs, coincident centers, and simulation/index stability.

## Publish the build to `gh-pages`

Use this project folder as the root of your GitHub repository. The workflow in `.github/workflows/gh-pages.yml` runs on pushes to `main` or `master`, or manually from the Actions tab on either source branch. It installs locked dependencies with `npm ci`, runs the physics tests, builds the Vue app with Vite, and pushes only the contents of `dist/` to `gh-pages`. The branch is created on the first successful run and updated on later runs, with obsolete build files removed and commit history retained.

The workflow uses the automatic `GITHUB_TOKEN` with `contents: write`; no custom secret is required for the branch push. Repository or organization policies must allow that write permission. The build uses relative asset URLs (`--base=./`) so it works under a repository subpath as well as at a domain root.

This workflow publishes the branch; enabling website hosting is a separate repository setting. GitHub documents that commits pushed by `GITHUB_TOKEN` do not trigger a branch-based Pages build. For automatic live-site deployment, add an official Pages artifact/deploy workflow and select **Settings → Pages → Source → GitHub Actions**, or configure a deployment credential that can trigger branch-based Pages publishing. See [GitHub's publishing-source documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).
