# Story: host transfer and ticket history

## Background and goal

A host creates a room and invites a teammate. After both people are in the same
room, the original host transfers host status to the teammate. The new host then
continues the planning session, completes multiple tickets, and verifies that
Tickets history keeps the latest result first while still allowing navigation to
older results.

## Roles

1. **Original host** — creates the room, joins estimation as a player, then hands
   host status to the teammate.
2. **New host** — joins as a player, receives host status, and drives subsequent
   ticket voting.

## Main journey

1. The original host creates a room and switches from observer to player.
2. The original host shares the invite link.
3. The teammate joins from the invite link as a player.
4. The original host transfers host status to the teammate.
5. The new host completes a first ticket.
6. The new host completes a second ticket.
7. The new host completes a third ticket where their own vote is a special
   `?` card and the other player casts a numeric estimate.
8. The new host checks Tickets history: the latest ticket is shown first, older
   navigation reveals the previous ticket, and newer navigation returns to the
   latest ticket.

## Observable results

1. After transfer, the original host is no longer host and does not see host
   controls.
2. The teammate is shown as `Host · Player` and can drive host controls.
3. Tickets history shows `Votes`, `Mean`, and `Std dev` for completed tickets.
4. Tickets history shows the current player's `You:` vote for the new host.
5. History navigation moves left to older tickets and right to newer tickets.
6. Special votes are counted in `Votes`, but are not included in `Mean` or
   `Std dev`.
