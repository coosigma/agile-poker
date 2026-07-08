# Actor Extension

Keep XState out of ordinary routes. Add actor modules only for long-lived
workflow or stateful coordination.

Recommended shape when needed:

```txt
stateful/session/
  session.types.ts
  session.rules.ts
  session.machine.ts
  session.actor.ts
```

Rules stay pure and functional. Machines describe state transitions. Actor hosts
adapt Cloudflare Durable Objects or the self-hosted in-process runtime.
