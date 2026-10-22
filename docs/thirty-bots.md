# Thirty bots on a constrained service

Render Free provides 0.1 CPU and 512 MB RAM:
https://render.com/docs/compute-plans . A separate planner process protects the
Node event loop but still shares the container CPU quota with live physics.
Lower process priority alone does not reserve that quota.

The corrections address these sources of wasted work:

- A forecast ends on out-of-bounds before mechanics can start the maritaca
  rescue and clear its flag. Simulated rescue flights cannot become safe shots.
- A ball at a verified fixed point on static support skips repeated contact resolution.
  Dynamic geometry is still checked every tick. Changed position/velocity,
  shots, changed timestep, water and wind/pet impulses invalidate the cache. Cup regions and
  moving supports keep normal physics. `GOLF_PHYSICS_FULL_REST=1` selects the
  previous path for trajectory comparisons.
- Exactly identical per-ball inputs share one authoritative physics evaluation
  within a tick. All player identities, scores, NPC effects and Impact collision
  resolution remain separate. Simultaneous identical collision sounds are mixed
  once. `GOLF_PHYSICS_FULL_PLAYERS=1` selects individual evaluations for comparison.
- The Render profile targets 150 ms CPU, checked between complete
  heading/power sweeps after finding safe progress. Recovery and ramp searches
  may exceed this target to preserve decision quality. The planner voluntarily
  sleeps to average 0.02 CPU, leaving most
  of the service share for live frames and Node. Nearby bots can share a proposed
  shot, but it is simulated again at the current authoritative time with current
  obstacles, wind and animals before use. Each bot retains its own accuracy,
  effects and attempt history. The unrestricted local profile remains available.

The 5x spectator acceleration runs only when measured physics CPU has headroom
inside `GOLF_CPU_BUDGET`. It returns to 1x under load without dropping fixed
120 Hz simulation steps. Live human play stays at 1x. Slow-profile graph loading
gets a longer loading deadline; live commands retain the 5-second limit.
Background searches get up to five minutes on that profile so a difficult
forecast can yield CPU without being repeatedly killed and restarted. Local
searches retain the 30-second limit. The live round timer keeps running: the
small free CPU share can make bots think slowly on complex fields.

`render.yaml` defines the free profile. Multiple busy rooms still share the same
small service; these limits are not a guarantee of unlimited server capacity.
The regression suite compares 31-ball trajectories against the full solver,
validates 30 shared forecasts without mutating authority, checks voluntary CPU
yielding, and exercises adaptive acceleration. Native tests cover wake-up by
dynamic geometry, external impulses and position changes, alongside water,
bridges, the maritaca, pet effects and course completion.

In a local Windows benchmark on `family04-3`, 31 identical resting balls over
10 simulated seconds used 156.25 ms CPU after the changes, versus 640.625 ms
before (about 76% less). This measures the shared tee state, not 31 distinct
moving trajectories, browser FPS, or a production Render instance. Windows CPU
accounting in this measurement has a 15.625 ms granularity.

A separate 30-second real-clock local room check used 30 expert bots plus one
human on that field with the Render profile. Simulation advanced 29.93 seconds,
387 snapshots were sent, the 95th percentile snapshot gap was 80.94 ms, and a
human shot was accepted in 1.11 ms while searches ran. Seven bot decisions
completed with no planner failures. These figures validate responsiveness of
the profile locally; the machine was not placed inside Render's CPU cgroup.
